(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./personal-best.js'));
  else root.DriveStuntRecords = factory(root.DrivePersonalBest);
})(globalThis, function(replays) {
  'use strict';

  const RECORD_ID = /^[a-f0-9]{32}$/;
  const MAX_LINK_CHARS = 1_400_000;
  const isRaceLink = hash => /^#(?:race|ghost)=/.test(hash);

  function formatTime(time) {
    const millis = Math.round(time * 1000);
    return Math.floor(millis / 60000) + ':' + String(Math.floor(millis / 1000) % 60).padStart(2, '0') +
      '.' + String(millis % 1000).padStart(3, '0');
  }

  async function encodeGhost(trace) {
    if (!replays.validStuntTrace(trace)) throw new Error('Finish a stunt-course lap to create a race link.');
    const stream = new Blob([JSON.stringify([replays.STUNT_REVISION, trace])]).stream();
    const compressed = new Response(stream.pipeThrough(new CompressionStream('gzip')));
    const bytes = new Uint8Array(await compressed.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function decodeGhost(payload) {
    if (payload.length > MAX_LINK_CHARS || !/^[\w-]+$/.test(payload)) throw new Error('Invalid ghost link.');
    const bytes = Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const decoder = new TextDecoder();
    let size = 0, json = '';
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > replays.MAX_CHARS) {
        await reader.cancel();
        throw new Error('Ghost replay is too large.');
      }
      json += decoder.decode(value, {stream:true});
    }
    const [revision, trace] = JSON.parse(json + decoder.decode());
    if (revision !== replays.STUNT_REVISION || !replays.validStuntTrace(trace)) throw new Error('Invalid ghost replay.');
    return trace;
  }

  function create({window, document, carName, getBest, onRace, onOpen}) {
    const byId = id => document.getElementById(id);
    const dialog = byId('stuntRecords'), open = byId('stuntRecordsOpen');
    const bestText = byId('stuntMyBest'), shareBest = byId('stuntShareBest');
    const form = byId('stuntPublishForm'), racerName = byId('stuntRacerName'), publish = byId('stuntPublish');
    const actionStatus = byId('stuntActionStatus'), shareField = byId('stuntShareField'), shareUrl = byId('stuntShareUrl');
    const board = byId('stuntBoard'), boardStatus = byId('stuntBoardStatus'), refresh = byId('stuntBoardRefresh');
    const linkStatus = byId('stuntLinkStatus');
    const api = (document.querySelector('meta[name="stunt-records-api"]')?.content.trim() || '').replace(/\/+$/, '');
    let published = null, posting = false, boardVersion = 0, raceVersion = 0;

    function message(element, text) {
      element.textContent = text;
      element.hidden = !text;
    }

    function raceLink(hash) {
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = hash;
      return url.href;
    }

    async function request(path, body) {
      if (!api) throw new Error('The community leaderboard is offline.');
      const options = {signal:AbortSignal.timeout(10000)};
      if (body) Object.assign(options, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
      const response = await window.fetch(api + path, options);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The records service is unavailable.');
      return result;
    }

    async function loadRecord(id) {
      if (!RECORD_ID.test(id)) throw new Error('Invalid race link.');
      const {name, revision, trace} = await request('/records/' + id);
      if (typeof name !== 'string' || revision !== replays.STUNT_REVISION || !replays.validStuntTrace(trace))
        throw new Error('This ghost is incompatible with the stunt course.');
      return {name, trace};
    }

    async function copyLink(url) {
      try {
        await window.navigator.clipboard.writeText(url);
        message(actionStatus, 'Race link copied.');
        shareField.hidden = true;
      } catch (_) {
        shareUrl.value = url;
        shareField.hidden = false;
        message(actionStatus, 'Select and copy the race link below.');
        if (dialog.open) { shareUrl.focus(); shareUrl.select(); }
      }
    }

    function renderBest() {
      const best = getBest();
      bestText.textContent = best ? formatTime(best.lapTime) + ' · ' + carName(best.car) : 'Finish a lap to set your first record.';
      shareBest.disabled = !best;
      publish.disabled = !best || posting;
    }

    function addRecord(record) {
      if (!RECORD_ID.test(record.id) || typeof record.name !== 'string' || !Number.isFinite(record.lapTime)) return;
      const row = document.createElement('li'), content = document.createElement('div');
      content.className = 'stunt-board-entry';
      const driver = document.createElement('span'), name = document.createElement('strong'), detail = document.createElement('small');
      name.textContent = record.name;
      detail.textContent = formatTime(record.lapTime) + ' · ' + carName(record.car);
      driver.append(name, detail);
      const actions = document.createElement('div');
      actions.className = 'stunt-record-actions';
      const race = document.createElement('button'), copy = document.createElement('button');
      race.type = copy.type = 'button';
      race.textContent = 'Race';
      copy.textContent = 'Copy link';
      race.setAttribute('aria-label', 'Race ' + record.name + '’s ghost');
      copy.setAttribute('aria-label', 'Copy ' + record.name + '’s race link');
      race.addEventListener('click', async () => {
        const version = ++raceVersion;
        race.disabled = true;
        message(boardStatus, 'Loading ' + record.name + '’s ghost…');
        try {
          const entry = await loadRecord(record.id);
          if (!dialog.open || version !== raceVersion) return;
          message(boardStatus, '');
          onRace(entry);
        } catch (_) {
          if (version === raceVersion) message(boardStatus, 'Could not load this ghost. Try again.');
        } finally {
          race.disabled = false;
        }
      });
      copy.addEventListener('click', () => copyLink(raceLink('race=' + record.id)));
      actions.append(race, copy);
      content.append(driver, actions);
      row.append(content);
      board.append(row);
    }

    async function loadBoard() {
      if (!api) { message(boardStatus, 'The community leaderboard is offline.'); return; }
      const version = ++boardVersion;
      refresh.disabled = true;
      message(boardStatus, 'Loading leaderboard…');
      try {
        const {records} = await request('/records');
        if (version !== boardVersion) return;
        board.replaceChildren();
        records.forEach(addRecord);
        message(boardStatus, records.length ? '' : 'No laps posted yet.');
      } catch (_) {
        if (version === boardVersion) message(boardStatus, 'Could not load the leaderboard. Try refreshing.');
      } finally {
        if (version === boardVersion) refresh.disabled = false;
      }
    }

    refresh.hidden = !api;
    form.hidden = !api;
    open.addEventListener('click', () => {
      raceVersion++;
      onOpen();
      message(actionStatus, '');
      shareField.hidden = true;
      renderBest();
      dialog.showModal();
      loadBoard();
    });
    byId('stuntRecordsClose').addEventListener('click', () => dialog.close());
    refresh.addEventListener('click', loadBoard);
    shareBest.addEventListener('click', async () => {
      const trace = getBest();
      if (!trace) return;
      shareBest.disabled = true;
      try {
        const hash = published?.trace === trace ? 'race=' + published.id : 'ghost=' + await encodeGhost(trace);
        await copyLink(raceLink(hash));
      } catch (_) {
        message(actionStatus, 'Could not create a link for this lap.');
      } finally {
        renderBest();
      }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const trace = getBest(), name = racerName.value.trim();
      if (posting || !trace) return;
      if (!name) { message(actionStatus, 'Enter a public driver name.'); return; }
      posting = true;
      renderBest();
      message(actionStatus, 'Posting lap…');
      try {
        const {id} = await request('/records', {name, trace, revision:replays.STUNT_REVISION});
        if (!RECORD_ID.test(id)) throw new Error();
        published = {trace, id};
        message(actionStatus, 'Lap posted. Copy your race link to share it.');
        await loadBoard();
      } catch (error) {
        message(actionStatus, error.message || 'Could not post this lap. Try again.');
      } finally {
        posting = false;
        renderBest();
      }
    });

    async function readLink(hash) {
      message(linkStatus, 'Loading shared ghost…');
      try {
        const entry = hash.startsWith('#race=') ? await loadRecord(hash.slice(6)) :
          {name:'Shared lap', trace:await decodeGhost(hash.slice(7))};
        if (window.location.hash === hash) message(linkStatus, '');
        return entry;
      } catch (_) {
        if (window.location.hash === hash) message(linkStatus, 'Could not load the shared ghost. Check the race link or try again.');
        return null;
      }
    }

    return {isOpen:() => dialog.open, close:() => dialog.close(),
      show:onStuntCourse => { open.hidden = !onStuntCourse; }, readLink};
  }

  return {create, isRaceLink, encodeGhost, decodeGhost, formatTime};
});
