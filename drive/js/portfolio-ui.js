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
  const obamnasAmericaCenters = {
    'center-4_-2': 'Downtown Core',
    'center-0_3': 'North Center',
    'center-7_-7': 'Terminus District',
    'center-9_5': 'Northeast Center',
    'center--2_10': 'Northwest Center',
    'center--5_6': 'Campus District',
    'center-7_2': 'East Center'
  };
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function travelRegion(x, z, bounds) {
    const midX = (bounds.minX + bounds.maxX) / 2;
    const midZ = (bounds.minZ + bounds.maxZ) / 2;
    const eastWest = x < midX - (bounds.maxX - bounds.minX) * .15 ? 'West' :
      x > midX + (bounds.maxX - bounds.minX) * .15 ? 'East' : '';
    const northSouth = z < midZ - (bounds.maxZ - bounds.minZ) * .15 ? 'South' :
      z > midZ + (bounds.maxZ - bounds.minZ) * .15 ? 'North' : '';
    return [northSouth, eastWest].filter(Boolean).join(' ') || 'Central';
  }
  function deriveCenters(cityMap) {
    if (!Array.isArray(cityMap?.manifest?.centerCandidates) || typeof cityMap.snapToRoad !== 'function') return [];
    const bounds = cityMap.detailBounds || cityMap.bounds;
    const centerCandidates = cityMap.manifest.centerCandidates.map(candidate => ({...candidate, kind:'center'}));
    const travelCandidates = (Array.isArray(cityMap.manifest.travelCandidates)
      ? cityMap.manifest.travelCandidates : []).map(candidate => ({...candidate, kind:'street'}));
    const roadsById = new Map();
    for (const road of cityMap.networkRoads || []) {
      const id = String(road.id);
      if (!roadsById.has(id)) roadsById.set(id, []);
      roadsById.get(id).push(road);
    }
    return [...centerCandidates, ...travelCandidates].flatMap((candidate, index) => {
      const x = Number(candidate.x), z = Number(candidate.z);
      if (!Number.isFinite(x) || !Number.isFinite(z) || !bounds ||
          x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return [];
      const street = cityMap.snapToRoad(x, z);
      if (!street || !Number.isFinite(street.x) || !Number.isFinite(street.z) ||
          !Number.isFinite(street.heading) || !Number.isFinite(street.distance) || street.distance > 350 ||
          street.x < bounds.minX || street.x > bounds.maxX || street.z < bounds.minZ || street.z > bounds.maxZ) return [];
      let destination = street;
      if (candidate.kind === 'street') {
        const roadParts = roadsById.get(String(street.roadId)) || [];
        const road = roadParts.reduce((best, part) => {
          const distance = item => {
            const dx = item.x2 - item.x1, dz = item.z2 - item.z1;
            const t = Math.max(0, Math.min(1,
              ((street.x - item.x1) * dx + (street.z - item.z1) * dz) /
              (dx * dx + dz * dz || 1)));
            return Math.hypot(street.x - item.x1 - dx * t, street.z - item.z1 - dz * t);
          };
          return !best || distance(part) < distance(best) ? part : best;
        }, null);
        const clearance = typeof cityMap.terrainHeight === 'function'
          ? street.y - cityMap.terrainHeight(street.x, street.z) : NaN;
        if (String(street.roadId) !== String(candidate.roadId) || street.distance > 1 ||
            !road || road.mode !== 'GROUND' ||
            /highway|motorway|freeway|express/i.test(String(road.roadClass || '')) ||
            !Number.isFinite(clearance) || clearance < -.25 || clearance > .5) return [];
        const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
        const length = Math.hypot(dx, dz);
        if (length < .1) return [];
        const lanes = (road.laneDetails || []).filter(lane =>
          Number.isFinite(Number(lane.position)) &&
          /^(forward|backward)$/i.test(String(lane.direction || '')));
        const forward = lanes.filter(lane => /^forward$/i.test(lane.direction))
          .sort((a, b) => Number(a.position) - Number(b.position));
        const backward = lanes.filter(lane => /^backward$/i.test(lane.direction))
          .sort((a, b) => Number(b.position) - Number(a.position));
        const direction = forward.length ? 1 : backward.length ? -1 : 1;
        const offsets = (forward.length ? forward : backward).map(lane =>
          Math.max(-road.width / 2 + 2.5, Math.min(road.width / 2 - 2.5,
            -Number(lane.position))));
        if (!offsets.length) offsets.push(direction * Math.min(3, road.width / 4));
        const lane = offsets.map(offset => ({
          x: street.x + dz / length * offset,
          z: street.z - dx / length * offset,
          heading: Math.atan2(dx * direction, dz * direction)
        })).find(point => {
          const laneClearance = street.y - cityMap.terrainHeight(point.x, point.z);
          return laneClearance >= -.25 && laneClearance <= .65;
        });
        if (!lane) return [];
        destination = { ...street, ...lane, mapX: street.x, mapZ: street.z };
      }
      const namedCenter = candidate.kind === 'center' &&
        cityMap.manifest.source?.cityName === "Obamna's America"
        ? obamnasAmericaCenters[candidate.id] : null;
      const title = candidate.kind === 'street'
        ? `${String(candidate.roadName || `Street Jump ${String(index + 1).padStart(2, '0')}`)} · ${travelRegion(street.x, street.z, bounds)}`
        : namedCenter || `City Center ${String(index + 1).padStart(2, '0')}`;
      return [{ ...destination, id: String(candidate.id || `center-${index + 1}`),
        kind: candidate.kind, title, score: Number(candidate.score) || 0 }];
    });
  }
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
      <button class="city-minimap" type="button" aria-label="Open city map and fast travel">
        <span class="city-minimap-label">CITY MAP <b>↗</b></span>
        <span class="city-minimap-canvas">
          <span class="city-minimap-cone" aria-hidden="true"></span>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"></svg>
          <span class="city-minimap-centers" aria-hidden="true"></span>
          <span class="city-minimap-player" aria-hidden="true"></span>
        </span>
        <span class="city-minimap-hint">CLICK OR M / OPEN</span>
      </button>
      <div class="city-overlay" hidden>
        <section class="city-panel" role="dialog" aria-modal="true" aria-labelledby="cityPanelTitle" tabindex="-1">
          <div class="city-panel-head"><div><p class="city-panel-kicker">ALEX / AFTER DARK</p><h2 id="cityPanelTitle">City Guide</h2></div><button class="city-close" type="button" aria-label="Close city guide">×</button></div>
          <div class="city-guide-view">
            <p class="city-guide-intro">Take the long way around, or open a stop right here. The city is yours either way.</p>
            <div class="city-guide-layout">
              <div class="city-map" role="group" tabindex="0" aria-label="Interactive city map. Drag to pan, scroll to zoom, or use the map controls. Portfolio stops and city centers are clickable.">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"></svg>
                <span class="city-player-dot" aria-hidden="true"></span>
                <div class="city-map-centers"></div>
                <div class="city-map-stops"></div>
                <div class="city-map-controls" aria-label="Map zoom controls">
                  <button class="city-map-zoom-in" type="button" aria-label="Zoom in on city map">+</button>
                  <button class="city-map-zoom-out" type="button" aria-label="Zoom out on city map">−</button>
                  <button class="city-map-zoom-reset" type="button" aria-label="Fit entire city on map">FIT</button>
                  <span class="city-map-zoom-level" aria-live="polite">1×</span>
                </div>
                <span class="city-map-gesture">SCROLL OR +/− TO ZOOM · THEN DRAG TO PAN</span>
                <span class="city-map-key">YOU ARE HERE <i></i></span>
                <span class="city-center-key">◆ CENTER · ◇ JUMP</span>
              </div>
              <div class="city-stop-list"></div>
            </div>
            <section class="city-centers" hidden aria-label="City fast travel">
              <div class="city-centers-head"><h3>Fast travel</h3><span>CENTERS + STREET JUMPS</span></div>
              <div class="city-center-list"></div>
            </section>
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
    const minimap = host.querySelector('.city-minimap');
    const minimapPlayer = host.querySelector('.city-minimap-player');
    const minimapCanvas = host.querySelector('.city-minimap-canvas');
    const minimapCenters = host.querySelector('.city-minimap-centers');
    const minimapSvg = host.querySelector('.city-minimap svg');
    const closeButton = host.querySelector('.city-close');
    const backButton = host.querySelector('.city-back');
    const driveButton = host.querySelector('.city-drive-here');
    const mapStops = host.querySelector('.city-map-stops');
    const mapCenters = host.querySelector('.city-map-centers');
    const centerKey = host.querySelector('.city-center-key');
    const stopList = host.querySelector('.city-stop-list');
    const centerSection = host.querySelector('.city-centers');
    const centerList = host.querySelector('.city-center-list');
    const mapViewport = host.querySelector('.city-map');
    const zoomInButton = host.querySelector('.city-map-zoom-in');
    const zoomOutButton = host.querySelector('.city-map-zoom-out');
    const zoomResetButton = host.querySelector('.city-map-zoom-reset');
    const zoomLevel = host.querySelector('.city-map-zoom-level');
    const svg = host.querySelector('.city-map svg');
    const driveFocus = driveTarget || document.querySelector('#drive-scene');
    let bounds={minX:-440,maxX:440,minZ:-440,maxZ:440};
    let centers = [];
    let centersById = new Map();
    let mapZoom = 1, mapCenterX = 50, mapCenterY = 50, mapDrag = null;
    let mapView = {left: 0, top: 0, width: 100, height: 100};
    let miniView = {left: 0, top: 0, width: 100, height: 100};
    let miniAspect = 1;
    let radarPosition = null, radarRoadAnchor = null, radarRoadGroup = null, radarHeading = 0;
    const maxMapZoom = 12;
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    function placeMapMarker(marker, left, top, width, height) {
      const x = Number(marker.dataset.mapX), y = Number(marker.dataset.mapY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      marker.style.left = (x - left) / width * 100 + '%';
      marker.style.top = (y - top) / height * 100 + '%';
      marker.hidden = x < left || x > left + width || y < top || y > top + height;
    }
    function mapViewSize() {
      const rect = mapViewport.getBoundingClientRect();
      const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 1;
      return {width: 100 * Math.max(1, aspect) / mapZoom,
        height: 100 * Math.max(1, 1 / aspect) / mapZoom};
    }
    function measureMinimap() {
      const rect = minimapCanvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) miniAspect = rect.width / rect.height;
      applyMinimapView();
    }
    function applyMinimapView() {
      const span = Math.max(1, bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
      // About 650 metres of nearby streets vertically, regardless of city size.
      const height = Math.min(92, 650 * 92 / span), width = height * miniAspect;
      const center = point(radarPosition?.x ?? locations[0]?.x ?? 0,
        radarPosition?.z ?? locations[0]?.z ?? 0);
      miniView = {left: center.x - width / 2, top: center.y - height / 2, width, height};
      minimapSvg.setAttribute('viewBox', `${miniView.left} ${miniView.top} ${width} ${height}`);
      drawRadarRoads();
      orientRadar();
    }
    function orientRadar() {
      if (!radarPosition) return;
      // Rotate the guide's city coordinates around the car. The imported 3D
      // city is reflected into the same frame, so turns keep their handedness.
      const center = point(radarPosition.x, radarPosition.z);
      const cosine = Math.cos(radarHeading), sine = Math.sin(radarHeading);
      const a = cosine, b = -sine, c = sine, d = cosine;
      const e = center.x - a * center.x - c * center.y;
      const f = center.y - b * center.x - d * center.y;
      radarRoadGroup?.setAttribute('transform', `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);
      for (const marker of minimapCenters.children) {
        const dx = Number(marker.dataset.mapX) - center.x;
        const dy = Number(marker.dataset.mapY) - center.y;
        const x = center.x + a * dx + c * dy;
        const y = center.y + b * dx + d * dy;
        marker.style.left = (x - miniView.left) / miniView.width * 100 + '%';
        marker.style.top = (y - miniView.top) / miniView.height * 100 + '%';
        marker.hidden = x < miniView.left || x > miniView.left + miniView.width ||
          y < miniView.top || y > miniView.top + miniView.height;
      }
    }
    function applyMapView() {
      const {width, height} = mapViewSize();
      mapCenterX = width >= 100 ? 50 : clamp(mapCenterX, width / 2, 100 - width / 2);
      mapCenterY = height >= 100 ? 50 : clamp(mapCenterY, height / 2, 100 - height / 2);
      const left = mapCenterX - width / 2, top = mapCenterY - height / 2;
      mapView = {left, top, width, height};
      svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
      for (const marker of [playerDot, ...mapStops.children, ...mapCenters.children])
        placeMapMarker(marker, left, top, width, height);
      const label = `${Number(mapZoom.toFixed(1))}×`;
      if (zoomLevel.textContent !== label) zoomLevel.textContent = label;
      zoomInButton.disabled = mapZoom >= maxMapZoom;
      zoomOutButton.disabled = mapZoom <= 1;
    }
    function zoomMap(factor, focalX = .5, focalY = .5) {
      const before = mapViewSize();
      const next = clamp(mapZoom * factor, 1, maxMapZoom);
      if (next === mapZoom) return;
      const anchorX = mapCenterX + (focalX - .5) * before.width;
      const anchorY = mapCenterY + (focalY - .5) * before.height;
      mapZoom = next;
      const after = mapViewSize();
      mapCenterX = anchorX - (focalX - .5) * after.width;
      mapCenterY = anchorY - (focalY - .5) * after.height;
      applyMapView();
    }
    function resetMapView() { mapZoom = 1; mapCenterX = mapCenterY = 50; applyMapView(); }
    function point(x,z) {
      const span=Math.max(1,bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ);
      const midX=(bounds.minX+bounds.maxX)/2,midZ=(bounds.minZ+bounds.maxZ)/2;
      // The city save needs a north/south mirror, not a 180-degree turn.
      return {x:Math.max(0,Math.min(100,50+(x-midX)*92/span)),
        y:Math.max(0,Math.min(100,50-(z-midZ)*92/span))};
    }
    function roadPaths(roads, glow = false) {
      const paths = {street: [], arterial: [], highway: []};
      const compact = value => Math.round(value * 10000) / 10000;
      for (const line of roads) {
        const a = point(line.x1, line.z1), b = point(line.x2, line.z2);
        const highway = /highway|motorway|freeway|express/i.test(String(line.roadClass || line.kind || '')) ||
          /elevated|bridge|viaduct|overpass/i.test(String(line.mode || ''));
        const arterial = /arterial|main/i.test(String(line.roadClass || ''));
        paths[highway ? 'highway' : arterial ? 'arterial' : 'street'].push(
          `M${compact(a.x)} ${compact(a.y)}L${compact(b.x)} ${compact(b.y)}`);
      }
      const path = (className, segments) => segments.length
        ? `<path class="${className}" data-segments="${segments.length}" d="${segments.join('')}"/>` : '';
      return path('city-map-street', paths.street) +
        path('city-map-arterial', paths.arterial) +
        (glow ? path('city-map-highway-glow', paths.highway) : '') +
        path('city-map-highway', paths.highway);
    }
    function drawRadarRoads() {
      const roads = cityMap?.networkRoads || cityMap?.overviewRoads || cityMap?.roadSegments;
      if (!roads?.length || !radarPosition) return;
      const span = Math.max(1, bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
      // Include the diagonal of the rotated viewport plus movement between
      // spatial refreshes, so turns never expose empty corners.
      const radius = Math.hypot(miniView.width * span / 184,
        miniView.height * span / 184) + 180;
      if (radarRoadAnchor &&
          Math.hypot(radarPosition.x - radarRoadAnchor.x, radarPosition.z - radarRoadAnchor.z) < 140 &&
          Math.abs(radius - radarRoadAnchor.radius) < 1) return;
      radarRoadAnchor = {x: radarPosition.x, z: radarPosition.z, radius};
      const minX = radarPosition.x - radius, maxX = radarPosition.x + radius;
      const minZ = radarPosition.z - radius, maxZ = radarPosition.z + radius;
      const nearbyRoads = roads.filter(line =>
        Math.max(line.x1, line.x2) >= minX && Math.min(line.x1, line.x2) <= maxX &&
        Math.max(line.z1, line.z2) >= minZ && Math.min(line.z1, line.z2) <= maxZ);
      minimapSvg.innerHTML = `<g>${roadPaths(nearbyRoads)}</g>`;
      radarRoadGroup = minimapSvg.firstElementChild;
    }
    function renderMap() {
      const lines=cityMap?.networkRoads || cityMap?.overviewRoads || cityMap?.roadSegments;
      if(lines?.length) {
        // Keep every source segment, but batch by style. Thousands of SVG
        // elements made every viewBox pan and zoom trigger expensive paint.
        svg.innerHTML = roadPaths(lines, true);
        radarRoadAnchor = null;
      } else {
        const roads = [-400,-320,-240,-160,-80,0,80,160,240,320,400];
        const roadMarkup = roads.map(c => {
          const a=point(c,-400),b=point(c,400),d=point(-400,c),e=point(400,c);
          return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><line x1="${d.x}" y1="${d.y}" x2="${e.x}" y2="${e.y}"/>`;
        }).join('') + '<line class="city-map-highway" x1="50" y1="4" x2="50" y2="96"/>';
        svg.innerHTML=roadMarkup;
        minimapSvg.innerHTML=`<g>${roadMarkup}</g>`;
        radarRoadGroup = minimapSvg.firstElementChild;
      }
      mapStops.replaceChildren();
      mapCenters.replaceChildren();
      minimapCenters.replaceChildren();
      stopList.replaceChildren();
      centerList.replaceChildren();
      locations.forEach((stop, index) => {
        const number = String(index + 1).padStart(2, '0');
        const mapped=point(stop.x,stop.z);
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'city-map-stop';
        dot.style.left = mapped.x + '%';
        dot.style.top = mapped.y + '%';
        dot.dataset.mapX = mapped.x;
        dot.dataset.mapY = mapped.y;
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
      centerSection.hidden = !centers.length || typeof onJump !== 'function';
      centerKey.hidden = centerSection.hidden;
      centers.forEach((center, index) => {
        const mapped = point(center.mapX ?? center.x, center.mapZ ?? center.z);
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = 'city-map-center';
        marker.style.left = mapped.x + '%';
        marker.style.top = mapped.y + '%';
        marker.dataset.mapX = mapped.x;
        marker.dataset.mapY = mapped.y;
        marker.dataset.center = center.id;
        marker.dataset.kind = center.kind;
        marker.setAttribute('aria-label', `Fast travel to ${center.title}`);
        marker.title = center.title;
        mapCenters.appendChild(marker);
        const miniMarker = document.createElement('span');
        miniMarker.className = 'city-minimap-center';
        miniMarker.style.left = mapped.x + '%';
        miniMarker.style.top = mapped.y + '%';
        miniMarker.dataset.mapX = mapped.x;
        miniMarker.dataset.mapY = mapped.y;
        miniMarker.dataset.kind = center.kind;
        minimapCenters.appendChild(miniMarker);
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'city-center-item';
        item.dataset.center = center.id;
        item.dataset.kind = center.kind;
        item.setAttribute('aria-label', `Fast travel to ${center.title}`);
        item.innerHTML = `<span>${String(index + 1).padStart(2, '0')} / ${center.kind === 'street' ? 'STREET JUMP' : 'CENTER'}</span><strong>${escapeHtml(center.title)}</strong><small>JUMP TO STREET ↗</small>`;
        centerList.appendChild(item);
      });
      resetMapView();
      measureMinimap();
    }
    function setCity(nextCity) {
      cityMap=nextCity || null;
      const edge=Number(cityMap?.edge) || 440;
      bounds=cityMap?.bounds || {minX:-edge,maxX:edge,minZ:-edge,maxZ:edge};
      locations=(cityMap?.stops || stops || []).filter(stop=>stories[stop.id]);
      byId=new Map(locations.map(stop=>[stop.id,stop]));
      centers=deriveCenters(cityMap);
      centersById=new Map(centers.map(center=>[center.id,center]));
      if(currentStop)currentStop=byId.get(currentStop.id) || null;
      nearbyStop=null;
      radarPosition = locations[0] || cityMap?.focus || {x:0,z:0};
      radarRoadAnchor = null;
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
      applyMapView();
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
      const landmark = stop.landmark ? `<p class="city-story-landmark">This stop is near ${escapeHtml(stop.landmark)} in the city I built.</p>` : '';
      storyContent.innerHTML = `<p class="city-story-kind">${escapeHtml(story.kind)}</p><h3>${escapeHtml(story.title)}</h3><p class="city-story-intro">${escapeHtml(story.intro)}</p>${landmark}${story.body}`;
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
      const desiredFocus = driveFocus || previousFocus;
      const returnTarget = desiredFocus && desiredFocus !== document.body && desiredFocus.isConnected &&
        !desiredFocus.closest?.('[hidden]') ? desiredFocus : driveFocus || guideButton;
      returnTarget.focus?.();
      previousFocus = null;
    }
    function setMap(nextMap) {
      map = nextMap;
      if (map !== 'city') close(true);
      host.hidden = map !== 'city';
      document.body.classList.toggle('city-map-active', map === 'city');
      guideButton.hidden = map !== 'city';
      if (map !== 'city') nearby.hidden = true;
      else measureMinimap();
    }
    function update(position, speed = 0, heading = 0) {
      if (map !== 'city' || !position) return;
      currentSpeed = speed;
      const mapped=point(position.x,position.z);
      playerDot.dataset.mapX = mapped.x;
      playerDot.dataset.mapY = mapped.y;
      placeMapMarker(playerDot, mapView.left, mapView.top, mapView.width, mapView.height);
      minimapPlayer.dataset.mapX = mapped.x;
      minimapPlayer.dataset.mapY = mapped.y;
      radarHeading = heading;
      if (!radarPosition || Math.hypot(position.x - radarPosition.x, position.z - radarPosition.z) > .4) {
        radarPosition = {x: position.x, z: position.z};
        applyMinimapView();
      } else orientRadar();
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
    minimap.addEventListener('click', () => openGuide(driveFocus));
    zoomInButton.addEventListener('click', () => zoomMap(1.5));
    zoomOutButton.addEventListener('click', () => zoomMap(1 / 1.5));
    zoomResetButton.addEventListener('click', resetMapView);
    mapViewport.addEventListener('wheel', event => {
      if ((event.deltaY > 0 && mapZoom <= 1) ||
          (event.deltaY < 0 && mapZoom >= maxMapZoom)) return;
      event.preventDefault();
      const rect = mapViewport.getBoundingClientRect();
      zoomMap(event.deltaY < 0 ? 1.25 : 1 / 1.25,
        clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
        clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1));
    }, { passive: false });
    mapViewport.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest?.('button')) return;
      mapDrag = { id: event.pointerId, x: event.clientX, y: event.clientY,
        centerX: mapCenterX, centerY: mapCenterY };
      mapViewport.setPointerCapture?.(event.pointerId);
    });
    mapViewport.addEventListener('pointermove', event => {
      if (!mapDrag || event.pointerId !== mapDrag.id) return;
      const rect = mapViewport.getBoundingClientRect();
      const {width, height} = mapViewSize();
      mapCenterX = mapDrag.centerX - (event.clientX - mapDrag.x) / Math.max(1, rect.width) * width;
      mapCenterY = mapDrag.centerY - (event.clientY - mapDrag.y) / Math.max(1, rect.height) * height;
      applyMapView();
    });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture'])
      mapViewport.addEventListener(eventName, event => {
        if (mapDrag?.id === event.pointerId) mapDrag = null;
      });
    mapViewport.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      if (mapZoom === 1 && key.startsWith('arrow')) return;
      if (['+', '=', '-', '_', '0', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
        event.preventDefault(); event.stopPropagation();
        if (key === '+' || key === '=') zoomMap(1.5);
        else if (key === '-' || key === '_') zoomMap(1 / 1.5);
        else if (key === '0') resetMapView();
        else {
          const {width, height} = mapViewSize();
          mapCenterX += key === 'arrowright' ? width * .18 : key === 'arrowleft' ? -width * .18 : 0;
          mapCenterY += key === 'arrowdown' ? height * .18 : key === 'arrowup' ? -height * .18 : 0;
          applyMapView();
        }
      }
    });
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
      const centerButton = event.target.closest('[data-center]');
      if (centerButton && activeView === 'guide' && typeof onJump === 'function') {
        const center = centersById.get(centerButton.dataset.center);
        if (center) { onJump(center); close(true); }
        return;
      }
      const stopButton = event.target.closest('[data-stop]');
      if (stopButton) open(stopButton.dataset.stop);
      else if (event.target === overlay) close(true);
    });
    document.addEventListener('keydown', event => {
      if (map !== 'city') return;
      if (!event.repeat && event.key.toLowerCase() === 'm' &&
          !event.target.matches?.('input, select, textarea, [contenteditable]')) {
        event.preventDefault(); event.stopPropagation();
        if (activeView === 'guide') close(true);
        else openGuide(driveFocus);
        return;
      }
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
        if (/^(w|a|s|d|c|f|r|[1-4]|arrowup|arrowdown|arrowleft|arrowright| )$/i.test(event.key)) {
          if (event.key === ' ' && !event.target.matches?.('button, a, input, select, textarea')) event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (!event.repeat && (event.key === 'e' || event.key === 'E') && nearbyStop && Math.abs(currentSpeed || 0) < 3 &&
          !event.target.matches?.('input, select, textarea, button, a, [contenteditable]')) {
        event.preventDefault();
        event.stopPropagation();
        open(nearbyStop.id, driveFocus);
      }
    });
    window.addEventListener('resize', () => { applyMapView(); measureMinimap(); });
    if (typeof window.ResizeObserver === 'function') {
      new window.ResizeObserver(applyMapView).observe(mapViewport);
      new window.ResizeObserver(measureMinimap).observe(minimapCanvas);
    }
    setCity(cityMap);
    return {setCity, setMap, update, isOpen, open, close};
  }

  return {create, stories, deriveCenters};
});
