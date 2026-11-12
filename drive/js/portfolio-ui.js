/* City portfolio panels. Resume facts are paraphrased; contact links are public profiles only. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePortfolioUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const stories = {
    about: {
      kind: 'ABOUT / THE WORKSHOP',
      title: 'I make things to poke at.',
      intro: 'Stories that remember, local AI tools, a tiny lab for language models, and now a whole city you can drive through. I like building the kind of thing that makes you take one more look.',
      body: `<p>This place is a map of my interests more than a list of credentials. Follow the neon and you will find experiments in storytelling, image making, interpretability, and the occasional car.</p>
        <p>When I am away from this workshop, I study computer science and mathematics at CU Boulder and build software across backend systems, data, and machine learning.</p>
        <div class="city-link-row"><a href="../" class="city-inline-link">The original home page ↗</a><a href="../blog/" class="city-inline-link">Read the blog ↗</a></div>`
    },
    projects: {
      kind: 'PROJECTS / THE ARCADE',
      title: 'Things you can actually touch.',
      intro: 'A small collection of ideas that escaped the notes app.',
      body: `<div class="city-project-grid">
        <a class="city-project" href="./"><span>01 / DRIVE</span><strong>Car Go Vroom</strong><p>Yes, you are already inside this one.</p><b>Drive it ↗</b></a>
        <a class="city-project" href="../projects/local-ai/#adventure"><span>02 / STORY</span><strong>Oops, That’s Canon</strong><p>A local story engine that tries to remember what happened.</p><b>Explore ↗</b></a>
        <a class="city-project" href="../projects/local-ai/#image"><span>03 / IMAGE</span><strong>Computer, Draw a Little Guy</strong><p>An image playground for ideas that need to be seen.</p><b>Explore ↗</b></a>
        <a class="city-project" href="../lab/"><span>04 / LANGUAGE</span><strong>One Neuron Over</strong><p>A lab for looking into strange corners of language models.</p><b>Explore ↗</b></a>
        <article class="city-project"><span>05 / PLANNING</span><strong>Edvise</strong><p>A course planner built with React, Node, Express, Firebase, GCP, and Jenkins.</p></article>
        <article class="city-project"><span>06 / RESEARCH</span><strong>NeurIPS Privacy Challenge</strong><p>Co-authored an attack paper for the 2024 LLM Privacy Competition; our team placed seventh globally.</p></article>
        </div>
        <div class="city-link-row"><a href="../blog/" class="city-inline-link">Unnecessary Lore / blog ↗</a><a href="../reader/" class="city-inline-link">One More Chapter / reader ↗</a></div>`
    },
    experience: {
      kind: 'EXPERIENCE / THE SHIFT LOG',
      title: 'A few places I have built things.',
      intro: 'Different teams, same habit: I like tracing a messy system until it makes sense, then building something useful out of it.',
      body: `<div class="city-timeline">
        <article><span>NOW / VIDEO DELIVERY</span><h3>Spectrum · DevOps co-op</h3><p>Exploring compact language models and video packager workflows. Started August 2026.</p></article>
        <article><span>2026–27 / SYSTEMS</span><h3>RTX / Raytheon · software engineering co-op</h3><p>Systems and applied software work from August 2026 through May 2027.</p></article>
        <article><span>SUMMER 2026 / BACKEND</span><h3>Google · software engineering intern</h3><p>Worked on an event-driven backend for understanding policy impact.</p></article>
        <article><span>SUMMER 2026 / MATERIALS</span><h3>CoorsTek · computational materials intern</h3><p>Used Databricks and Spark in a heat-treatment prediction and estimation workflow.</p></article>
        <article><span>SUMMER 2025 / DATA</span><h3>Rocket Software · software engineering intern</h3><p>Built Python pipelines for enterprise LLM datasets.</p></article>
        </div>`
    },
    education: {
      kind: 'EDUCATION / CAMPUS CORNER',
      title: 'A little math, a lot of computing.',
      intro: 'CU Boulder has been home base for both sides of my brain.',
      body: `<div class="city-school">
        <div><span>COMPLETED MAY 2026</span><h3>B.S. Computer Science</h3><h3>B.A. Mathematics</h3><p>University of Colorado Boulder</p></div>
        <div><span>EXPECTED MAY 2028</span><h3>M.S. Computer Science</h3><p>University of Colorado Boulder</p></div>
        </div>
        <p class="city-side-note">I like the space where a clean mathematical idea meets a messy real system.</p>`
    },
    skills: {
      kind: 'SKILLS / THE TOOLBOX',
      title: 'What is on the workbench.',
      intro: 'Tools are fun when they help make an idea real.',
      body: `<div class="city-tool-grid">
        <div><span>LANGUAGES I REACH FOR</span><p>Python, TypeScript and JavaScript, C/C++, Java, SQL, and Bash.</p></div>
        <div><span>THINGS I HAVE SHIPPED WITH</span><p>React, Node, Express, Firebase, GCP, and Jenkins helped make Edvise work.</p></div>
        <div><span>DEEPER INTO THE ENGINE ROOM</span><p>Databricks, Spark, event-driven backends, video workflows, and compact language models.</p></div>
        </div>
        <p class="city-side-note">The most interesting tool is usually the one that lets someone try the idea for themselves.</p>`
    },
    contact: {
      kind: 'CONTACT / THE SIGNAL TOWER',
      title: 'Send a signal.',
      intro: 'If any of this is your kind of weird, I would love to hear from you.',
      body: `<div class="city-signal-links">
        <a href="https://www.linkedin.com/in/alex-zhou2/" target="_blank" rel="noopener noreferrer"><span>PROFESSIONAL FREQUENCY</span><strong>LinkedIn ↗</strong></a>
        <a href="https://github.com/Alexz3221" target="_blank" rel="noopener noreferrer"><span>BUILD LOG</span><strong>GitHub ↗</strong></a>
        </div>
        <p class="city-side-note">For now, these are the two open channels.</p>`
    }
  };
  const labels = {about: 'About', projects: 'Projects', experience: 'Experience', education: 'Education', skills: 'Skills', contact: 'Contact'};
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function create({document, window, stops, city, onJump, onOpen, onClose, driveTarget}) {
    if (!document?.createElement || !document?.body) throw new Error('Portfolio UI needs a browser document');
    let cityMap = city || null;
    let locations = (stops || cityMap?.stops || []).filter(stop => stories[stop.id]);
    let byId = new Map(locations.map(stop => [stop.id, stop]));
    const routePicker = document.querySelector('.route-picker');
    const guideButton = document.createElement('button');
    guideButton.type = 'button';
    guideButton.className = 'city-guide-trigger';
    guideButton.textContent = '✦ CITY GUIDE / EXPLORE';
    guideButton.setAttribute('aria-haspopup', 'dialog');
    guideButton.hidden = true;
    (routePicker || document.body).appendChild(guideButton);

    const host = document.createElement('div');
    host.className = 'city-ui';
    host.hidden = true;
    host.innerHTML = `
      <button class="city-nearby" type="button" hidden></button>
      <div class="city-overlay" hidden>
        <section class="city-panel" role="dialog" aria-modal="true" aria-labelledby="cityPanelTitle" tabindex="-1">
          <div class="city-panel-head"><div><p class="city-panel-kicker">ALEX / AFTER DARK</p><h2 id="cityPanelTitle">City Guide</h2></div><button class="city-close" type="button" aria-label="Close city guide">×</button></div>
          <div class="city-guide-view">
            <p class="city-guide-intro">Take the long way around, or open a stop right here. The city is yours either way.</p>
            <div class="city-guide-layout">
              <div class="city-map" role="group" aria-label="City map and portfolio stops">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"></svg>
                <span class="city-player-dot" aria-hidden="true"></span>
                <div class="city-map-stops"></div>
                <span class="city-map-key">YOU ARE HERE <i></i></span>
              </div>
              <div class="city-stop-list"></div>
            </div>
          </div>
          <div class="city-story-view" hidden>
            <button class="city-back" type="button">← CITY GUIDE</button>
            <div class="city-story-content"></div>
            <div class="city-story-actions"><button class="city-drive-here" type="button">DRIVE HERE ↗</button></div>
          </div>
        </section>
      </div>`;
    document.body.appendChild(host);
    const overlay = host.querySelector('.city-overlay');
    const panel = host.querySelector('.city-panel');
    const title = host.querySelector('#cityPanelTitle');
    const guide = host.querySelector('.city-guide-view');
    const storyView = host.querySelector('.city-story-view');
    const storyContent = host.querySelector('.city-story-content');
    const nearby = host.querySelector('.city-nearby');
    const playerDot = host.querySelector('.city-player-dot');
    const closeButton = host.querySelector('.city-close');
    const backButton = host.querySelector('.city-back');
    const driveButton = host.querySelector('.city-drive-here');
    const mapStops = host.querySelector('.city-map-stops');
    const stopList = host.querySelector('.city-stop-list');
    const svg = host.querySelector('.city-map svg');
    const driveFocus = driveTarget || document.querySelector('#drive-scene');
    let bounds={minX:-440,maxX:440,minZ:-440,maxZ:440};
    function point(x,z) {
      const span=Math.max(1,bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ);
      const midX=(bounds.minX+bounds.maxX)/2,midZ=(bounds.minZ+bounds.maxZ)/2;
      return {x:Math.max(0,Math.min(100,50+(x-midX)*92/span)),
        y:Math.max(0,Math.min(100,50-(z-midZ)*92/span))};
    }
    function renderMap() {
      const lines=cityMap?.overviewRoads || cityMap?.roadSegments;
      if(lines?.length) {
        const stride=Math.max(1,Math.ceil(lines.length/700));
        svg.innerHTML=lines.filter((_,i)=>i%stride===0).map(line=>{
          const a=point(line.x1,line.z1),b=point(line.x2,line.z2);
          const highway=/highway|motorway|freeway|express/i.test(String(line.roadClass||line.kind||'')) ||
            /elevated|bridge|viaduct|overpass/i.test(String(line.mode||'')) || Number(line.width)>=24;
          const roadClass=highway?' class="city-map-highway"':'';
          return `<line${roadClass} x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
        }).join('');
      } else {
        const roads = [-400,-320,-240,-160,-80,0,80,160,240,320,400];
        svg.innerHTML = roads.map(c => {
          const a=point(c,-400),b=point(c,400),d=point(-400,c),e=point(400,c);
          return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><line x1="${d.x}" y1="${d.y}" x2="${e.x}" y2="${e.y}"/>`;
        }).join('') + '<line class="city-map-highway" x1="50" y1="4" x2="50" y2="96"/>';
      }
      mapStops.replaceChildren();
      stopList.replaceChildren();
      locations.forEach((stop, index) => {
        const number = String(index + 1).padStart(2, '0');
        const mapped=point(stop.x,stop.z);
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'city-map-stop';
        dot.style.left = mapped.x + '%';
        dot.style.top = mapped.y + '%';
        const stopColor = typeof stop.color === 'string' && /^#[\da-f]{6}$/i.test(stop.color)
          ? stop.color : '#' + Number(stop.color || 0x66e7f1).toString(16).padStart(6, '0');
        dot.style.setProperty('--stop-color', stopColor);
        dot.setAttribute('aria-label', `${labels[stop.id]} at ${stop.title}`);
        dot.title = stop.title;
        dot.dataset.stop = stop.id;
        dot.textContent = number;
        mapStops.appendChild(dot);
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'city-stop-item';
        item.dataset.stop = stop.id;
        item.innerHTML = `<span>${number} / ${escapeHtml(labels[stop.id])}</span><strong>${escapeHtml(stop.title)}</strong><small>OPEN STOP ↗</small>`;
        stopList.appendChild(item);
      });
    }
    function setCity(nextCity) {
      cityMap=nextCity || null;
      const edge=Number(cityMap?.edge) || 440;
      bounds=cityMap?.bounds || {minX:-edge,maxX:edge,minZ:-edge,maxZ:edge};
      locations=(cityMap?.stops || stops || []).filter(stop=>stories[stop.id]);
      byId=new Map(locations.map(stop=>[stop.id,stop]));
      if(currentStop)currentStop=byId.get(currentStop.id) || null;
      nearbyStop=null;
      renderMap();
    }

    let map = null, activeView = null, currentStop = null, nearbyStop = null, previousFocus = null, currentSpeed = 0;
    function begin(view, returnFocus) {
      if (!activeView) {
        previousFocus = returnFocus || document.activeElement;
        onOpen?.();
      }
      activeView = view;
      overlay.hidden = false;
      nearby.hidden = true;
    }
    function openGuide(returnFocus) {
      begin('guide', returnFocus);
      currentStop = null;
      title.textContent = 'City Guide';
      guide.hidden = false;
      storyView.hidden = true;
      panel.focus();
    }
    function open(id, returnFocus) {
      const stop = byId.get(id), story = stories[id];
      if (!stop || !story || map !== 'city') return false;
      begin('story', returnFocus);
      currentStop = stop;
      title.textContent = stop.title;
      guide.hidden = true;
      storyView.hidden = false;
      storyContent.innerHTML = `<p class="city-story-kind">${escapeHtml(story.kind)}</p><h3>${escapeHtml(story.title)}</h3><p class="city-story-intro">${escapeHtml(story.intro)}</p>${story.body}`;
      driveButton.hidden = typeof onJump !== 'function';
      panel.focus();
      return true;
    }
    function close(toDrive = false) {
      if (!activeView) return;
      activeView = null;
      currentStop = null;
      overlay.hidden = true;
      onClose?.();
      const desiredFocus = toDrive ? driveFocus : previousFocus;
      const returnTarget = desiredFocus && desiredFocus !== document.body && desiredFocus.isConnected &&
        !desiredFocus.closest?.('[hidden]') ? desiredFocus : driveFocus || guideButton;
      returnTarget.focus?.();
      previousFocus = null;
    }
    function setMap(nextMap) {
      map = nextMap;
      if (map !== 'city') close(true);
      host.hidden = map !== 'city';
      guideButton.hidden = map !== 'city';
      if (map !== 'city') nearby.hidden = true;
    }
    function update(position, speed = 0) {
      if (map !== 'city' || !position) return;
      currentSpeed = speed;
      const mapped=point(position.x,position.z);
      playerDot.style.left = mapped.x + '%';
      playerDot.style.top = mapped.y + '%';
      let nearest = null, distance = Infinity;
      for (const stop of locations) {
        const d = Math.hypot(position.x - stop.x, position.z - stop.z);
        if (d < distance) { nearest = stop; distance = d; }
      }
      nearbyStop = distance < 23 ? nearest : null;
      if (!nearbyStop || activeView) { nearby.hidden = true; return; }
      const slow = Math.abs(speed) < 3;
      nearby.disabled = !slow;
      nearby.textContent = slow ? `Press E / explore ${nearbyStop.title}` : `Slow down for ${nearbyStop.title}`;
      nearby.hidden = false;
    }
    function isOpen() { return activeView !== null; }

    guideButton.addEventListener('click', event => activeView ? close(event.detail > 0) : openGuide(event.detail > 0 ? driveFocus : guideButton));
    closeButton.addEventListener('click', event => close(event.detail > 0));
    backButton.addEventListener('click', () => openGuide());
    nearby.addEventListener('click', event => { if (nearbyStop && !nearby.disabled) open(nearbyStop.id, event.detail > 0 ? driveFocus : nearby); });
    driveButton.addEventListener('click', () => {
      if (currentStop && typeof onJump === 'function') {
        onJump(currentStop);
        close(true);
      }
    });
    host.addEventListener('click', event => {
      const stopButton = event.target.closest('[data-stop]');
      if (stopButton) open(stopButton.dataset.stop);
      else if (event.target === overlay) close(true);
    });
    document.addEventListener('keydown', event => {
      if (map !== 'city') return;
      if (activeView) {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
        if (event.key === 'Tab') {
          const focusable = [...panel.querySelectorAll('button:not([hidden]):not([disabled]), a[href]')].filter(el => !el.closest('[hidden]'));
          if (focusable.length) {
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
          }
          return;
        }
        if (/^(w|a|s|d|c|r|[1-4]|arrowup|arrowdown|arrowleft|arrowright| )$/i.test(event.key)) {
          if (event.key === ' ' && !event.target.matches?.('button, a, input, select, textarea')) event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (!event.repeat && (event.key === 'e' || event.key === 'E') && nearbyStop && Math.abs(currentSpeed || 0) < 3 &&
          !event.target.matches?.('input, select, textarea, [contenteditable]')) {
        event.preventDefault();
        event.stopPropagation();
        open(nearbyStop.id, driveFocus);
      }
    });
    setCity(cityMap);
    return {setCity, setMap, update, isOpen, open, close};
  }

  return {create, stories};
});
