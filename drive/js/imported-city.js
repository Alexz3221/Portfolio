/* Browser adapter for the reduced, tiled CSLModernMap export. The source save
 * never belongs in the site; only the converter's drive-city-v1 data does. */
(function (root, factory) {
  const adapter = factory();
  if (typeof module === 'object' && module.exports) module.exports = adapter;
  else root.DriveImportedCity = adapter;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const assetUrl = 'data/imported-city/manifest.json';
  const stopTemplates = [
    { id: 'about', title: 'The Workshop', color: '#fb6aa8', fx: .35, fz: .35 },
    { id: 'projects', title: 'Project Arcade', color: '#5ce9f6', fx: .65, fz: .35 },
    { id: 'experience', title: 'The Shift Log', color: '#ffc06a', fx: .65, fz: .65 },
    { id: 'education', title: 'Campus Corner', color: '#b89bff', fx: .35, fz: .65 },
    { id: 'skills', title: 'The Toolbox', color: '#9bf5ae', fx: .2, fz: .5 },
    { id: 'contact', title: 'Signal Tower', color: '#ff87dd', fx: .8, fz: .5 }
  ];
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const key = (ix, iz) => ix + ',' + iz;
  const isElevated = (mode) => /elevated|bridge|viaduct|overpass|flyover/i.test(String(mode || ''));
  const isTunnel = (mode) => /tunnel|underground/i.test(String(mode || ''));
  const isMotorway = (road) => road.roadClass ? /highway|motorway|freeway|express/i.test(String(road.roadClass)) :
    /highway|motorway|freeway|express/i.test(String(road.kind || '') + ' ' + String(road.level || '')) ||
    (finite(road.lanes && road.lanes.car_lane_count) >= 6 && road.width >= 28);
  function hash(value) {
    let h = 2166136261;
    for (const char of String(value)) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
    return h >>> 0;
  }
  function resolve(base, path) {
    if (/^(?:https?:)?\/\//.test(path) || path[0] === '/') return path;
    return base + path.replace(/^\.\//, '');
  }
  function point(raw) {
    if (Array.isArray(raw)) return [finite(raw[0]), finite(raw[1]), finite(raw[2])];
    if (raw && typeof raw === 'object') return [finite(raw.x), finite(raw.y), finite(raw.z)];
    return [0, 0, 0];
  }
  function validBounds(raw) {
    if (!raw || !['minX', 'maxX', 'minZ', 'maxZ'].every((name) => Number.isFinite(Number(raw[name])))) throw new Error('Imported city has invalid bounds');
    const bounds = { minX: Number(raw.minX), maxX: Number(raw.maxX), minZ: Number(raw.minZ), maxZ: Number(raw.maxZ) };
    if (bounds.maxX <= bounds.minX || bounds.maxZ <= bounds.minZ) throw new Error('Imported city has empty bounds');
    return bounds;
  }
  function normalizeRoad(record) {
    const points = Array.isArray(record.points) ? record.points.map(point) : [];
    if (points.length < 2) return [];
    const width = clamp(finite(record.width, 12), 2.5, 80);
    const segments = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      if (Math.hypot(b[0] - a[0], b[2] - a[2]) < .1) continue;
      segments.push({
        id: record.id, part: record.part, x1: a[0], y1: a[1], z1: a[2],
        x2: b[0], y2: b[1], z2: b[2], width,
        kind: record.kind || 'street', roadClass: record.roadClass || null,
        name: record.name || '', mode: record.mode || 'normal', level: record.level ?? null,
        lanes: record.lanes || null
      });
    }
    return segments;
  }
  function normalizeBuilding(record, terrainHeight) {
    const footprint = Array.isArray(record.footprint) ? record.footprint
      .map((p) => [finite(p[0], NaN), finite(p[1], NaN)])
      .filter((p) => p.every(Number.isFinite)) : [];
    if (footprint.length > 2 && Math.hypot(footprint[0][0] - footprint[footprint.length - 1][0], footprint[0][1] - footprint[footprint.length - 1][1]) < .001) footprint.pop();
    if (footprint.length < 3) return null;
    const xs = footprint.map((p) => p[0]), zs = footprint.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    if (maxX - minX < .3 || maxZ - minZ < .3) return null;
    const x = (minX + maxX) / 2, z = (minZ + maxZ) / 2;
    const height = clamp(finite(record.height, 12), 2, 600);
    const baseY = Number.isFinite(Number(record.baseY)) ? Number(record.baseY) : terrainHeight(x, z);
    return { id: record.id, x, z, width: maxX - minX, depth: maxZ - minZ,
      height, baseY, footprint, role: record.role || '', category: record.category || '', name: record.name || '' };
  }
  function terrainFromRaw(raw) {
    if (!raw || raw.format !== 'drive-city-terrain-v1') throw new Error('Imported city terrain has an unsupported format');
    const rows = finite(raw.rows), cols = finite(raw.cols), cell = finite(raw.cell);
    const originX = finite(raw.origin && raw.origin[0]), originZ = finite(raw.origin && raw.origin[1]);
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2 || rows * cols > 2000000 || cell <= 0 || !Array.isArray(raw.heights) || raw.heights.length !== rows * cols) throw new Error('Imported city terrain grid is invalid');
    // CANNON Heightfield's first axis is +X and its second becomes -Z after
    // the -90 degree floor rotation. Keep this exact matrix for both engines.
    const data = Array.from({ length: cols }, (_, i) => Array.from({ length: rows }, (_, j) => finite(raw.heights[(rows - 1 - j) * cols + i])));
    return { data, elementSize: cell, originX: originX + cell / 2,
      maxZ: originZ + (rows - .5) * cell, rows, cols, waterDepths: raw.waterDepths || null };
  }
  function sampleTerrain(terrain, x, z) {
    if (!terrain) return 0;
    const cellsX = terrain.cols - 1, cellsZ = terrain.rows - 1;
    const u = clamp((x - terrain.originX) / terrain.elementSize, 0, cellsX);
    const v = clamp((terrain.maxZ - z) / terrain.elementSize, 0, cellsZ);
    const i = Math.min(cellsX - 1, Math.floor(u)), j = Math.min(cellsZ - 1, Math.floor(v));
    const a = u - i, b = v - j, data = terrain.data;
    if (a + b <= 1) return data[i][j] * (1 - a - b) + data[i + 1][j] * a + data[i][j + 1] * b;
    return data[i + 1][j + 1] * (a + b - 1) + data[i][j + 1] * (1 - a) + data[i + 1][j] * (1 - b);
  }
  function segmentDistance(x, z, road) {
    const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
    const t = clamp(((x - road.x1) * dx + (z - road.z1) * dz) / (dx * dx + dz * dz), 0, 1);
    return { distance: Math.hypot(x - road.x1 - dx * t, z - road.z1 - dz * t), t };
  }
  function spatialIndex(cellSize) {
    const cells = new Map();
    const memberships = new WeakMap();
    function add(item, bounds) {
      const x0 = Math.floor(bounds.minX / cellSize), x1 = Math.floor(bounds.maxX / cellSize);
      const z0 = Math.floor(bounds.minZ / cellSize), z1 = Math.floor(bounds.maxZ / cellSize);
      const locations = [];
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const id = key(x, z);
        if (!cells.has(id)) cells.set(id, new Set());
        cells.get(id).add(item);
        locations.push(id);
      }
      memberships.set(item, locations);
    }
    function remove(item) {
      for (const id of memberships.get(item) || []) {
        const cell = cells.get(id);
        if (cell) { cell.delete(item); if (!cell.size) cells.delete(id); }
      }
      memberships.delete(item);
    }
    function query(x, z, radius) {
      const found = new Set();
      const x0 = Math.floor((x - radius) / cellSize), x1 = Math.floor((x + radius) / cellSize);
      const z0 = Math.floor((z - radius) / cellSize), z1 = Math.floor((z + radius) / cellSize);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
        for (const item of cells.get(key(i, j)) || []) found.add(item);
      }
      return Array.from(found);
    }
    return { add, remove, query };
  }
  function closestRoad(x, z, roads, predicate) {
    let selected = null, best = Infinity, selectedT = 0;
    for (const road of roads) {
      if (predicate && !predicate(road)) continue;
      const result = segmentDistance(x, z, road);
      if (result.distance < best) { selected = road; best = result.distance; selectedT = result.t; }
    }
    return selected && { road: selected, t: selectedT, distance: best };
  }
  function routeNearStop(stop, overviewRoads) {
    const match = closestRoad(stop.x, stop.z, overviewRoads, (road) => !isElevated(road.mode) && !isTunnel(road.mode) && !isMotorway(road));
    const road = (match || closestRoad(stop.x, stop.z, overviewRoads)).road;
    const initialT = match ? match.t : .5;
    const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
    const magnitude = Math.hypot(dx, dz);
    return Array.from({ length: 480 }, (_, i) => {
      const phase = i / 480 * 3;
      let t, direction;
      if (phase < 1) { t = initialT + (1 - initialT) * phase; direction = 1; }
      else if (phase < 2) { t = 2 - phase; direction = -1; }
      else { t = initialT * (phase - 2); direction = 1; }
      return { x: road.x1 + dx * t, y: road.y1 + (road.y2 - road.y1) * t,
        z: road.z1 + dz * t, tx: dx / magnitude * direction, tz: dz / magnitude * direction };
    });
  }
  function chooseStops(rawStops, overviewRoads, bounds, focus) {
    const byId = new Map((Array.isArray(rawStops) ? rawStops : []).filter((stop) => stop && stop.id).map((stop) => [stop.id, stop]));
    return stopTemplates.map((template) => {
      const authored = byId.get(template.id);
      const targetX = authored ? finite(authored.x) : template.id === 'about' ? focus.x : bounds.minX + (bounds.maxX - bounds.minX) * template.fx;
      const targetZ = authored ? finite(authored.z) : template.id === 'about' ? focus.z : bounds.minZ + (bounds.maxZ - bounds.minZ) * template.fz;
      const normal = (road) => !isElevated(road.mode) && !isTunnel(road.mode) && !isMotorway(road);
      const match = closestRoad(targetX, targetZ, overviewRoads, normal) || closestRoad(targetX, targetZ, overviewRoads);
      if (!match) throw new Error('Imported city has no driveable roads for portfolio stops');
      const road = match.road, t = match.t;
      return { id: template.id, title: authored && authored.title || template.title,
        color: authored && authored.color || template.color,
        x: road.x1 + (road.x2 - road.x1) * t,
        y: road.y1 + (road.y2 - road.y1) * t,
        z: road.z1 + (road.z2 - road.z1) * t };
    });
  }

  function create(manifest, overview, terrainRaw, options = {}) {
    if (!manifest || manifest.format !== 'drive-city-v1') throw new Error('Imported city manifest has an unsupported format');
    if (!overview || overview.format !== 'drive-city-overview-v1') throw new Error('Imported city overview has an unsupported format');
    const detailBounds = validBounds(manifest.bounds);
    const worldBounds = validBounds(manifest.worldBounds || manifest.bounds);
    const tileSize = finite(manifest.tileSize);
    if (tileSize <= 0 || !Array.isArray(manifest.tiles)) throw new Error('Imported city manifest has invalid tiles');
    const terrain = terrainFromRaw(terrainRaw);
    const terrainHeight = (x, z) => sampleTerrain(terrain, x, z);
    const allOverviewRoads = (overview.roads || []).flatMap(normalizeRoad);
    if (!allOverviewRoads.length) throw new Error('Imported city overview has no roads');
    const cityExtent = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
    for (const road of allOverviewRoads) {
      cityExtent.minX = Math.min(cityExtent.minX, road.x1, road.x2);
      cityExtent.minZ = Math.min(cityExtent.minZ, road.z1, road.z2);
      cityExtent.maxX = Math.max(cityExtent.maxX, road.x1, road.x2);
      cityExtent.maxZ = Math.max(cityExtent.maxZ, road.z1, road.z2);
    }
    const margin = Math.max(150, tileSize / 2);
    const bounds = {
      minX: Math.max(detailBounds.minX, cityExtent.minX - margin),
      minZ: Math.max(detailBounds.minZ, cityExtent.minZ - margin),
      maxX: Math.min(detailBounds.maxX, cityExtent.maxX + margin),
      maxZ: Math.min(detailBounds.maxZ, cityExtent.maxZ + margin)
    };
    const ordinaryWidths = allOverviewRoads.filter((road) => !isMotorway(road)).map((road) => road.width).sort((a, b) => a - b);
    const roadHalfWidth = clamp((ordinaryWidths[Math.floor(ordinaryWidths.length / 2)] || 16) / 2, 4, 16);
    const populatedTiles = manifest.tiles.filter((tile) => Number.isFinite(Number(tile.buildingCount)));
    populatedTiles.sort((a, b) => Number(b.buildingCount) - Number(a.buildingCount));
    const focusTile = populatedTiles[0];
    const focus = Array.isArray(manifest.focus) ? { x: finite(manifest.focus[0]), z: finite(manifest.focus[1]) } : focusTile ? {
      x: (focusTile.ix + .5) * tileSize, z: (focusTile.iz + .5) * tileSize
    } : { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
    const detailedRoads = allOverviewRoads.filter((road) =>
      Math.max(road.x1, road.x2) >= detailBounds.minX && Math.min(road.x1, road.x2) <= detailBounds.maxX &&
      Math.max(road.z1, road.z2) >= detailBounds.minZ && Math.min(road.z1, road.z2) <= detailBounds.maxZ);
    if (!detailedRoads.length) throw new Error('Imported city detail bounds contain no roads');
    const stops = chooseStops(overview.stops, detailedRoads, bounds, focus);
    const routeSamples = routeNearStop(stops[0], detailedRoads);
    const stride = Math.max(1, Math.ceil(allOverviewRoads.length / 1800));
    const overviewRoads = allOverviewRoads.filter((_, i) => i % stride === 0);
    const edge = Math.ceil(Math.max(Math.abs(detailBounds.minX), Math.abs(detailBounds.maxX), Math.abs(detailBounds.minZ), Math.abs(detailBounds.maxZ)) + 40);
    const roadIndex = spatialIndex(180), detailRoadIndex = spatialIndex(180), buildingIndex = spatialIndex(180);
    const highwayIndex = spatialIndex(180), railIndex = spatialIndex(180), supportIndex = spatialIndex(180);
    for (const road of allOverviewRoads) roadIndex.add(road, {
      minX: Math.min(road.x1, road.x2) - road.width, maxX: Math.max(road.x1, road.x2) + road.width,
      minZ: Math.min(road.z1, road.z2) - road.width, maxZ: Math.max(road.z1, road.z2) + road.width
    });
    const districts = (overview.districts || []).map((district) => ({
      id: district.id, name: typeof district.name === 'string' ? district.name : district.name && district.name.text || '',
      kind: district.kind || '', polygon: Array.isArray(district.polygon) ? district.polygon
        .map((p) => [finite(p[0], NaN), finite(p[1], NaN)]).filter((p) => p.every(Number.isFinite)) : []
    })).filter((district) => district.polygon.length >= 3);
    const map = { source: 'CSLModernMap', imported: true, manifest, bounds, detailBounds, worldBounds, focus, edge, tileSize, terrain,
      roadHalfWidth, overviewRoads, stops, routeSamples, buildings: [], roadSegments: [],
      highwaySegments: [], guardrails: [], supports: [], districts, terrainHeight };
    const tiles = new Map();
    const listeners = new Set();
    const changeListeners = new Set();
    for (const tile of manifest.tiles) if (tile && Number.isInteger(tile.ix) && Number.isInteger(tile.iz) && typeof tile.file === 'string') {
      tiles.set(key(tile.ix, tile.iz), { descriptor: tile, state: 'idle', data: null, promise: null });
    }
    map.loadedTiles = tiles;
    map.onTileLoaded = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
    map.onTileChanged = (fn) => { changeListeners.add(fn); return () => changeListeners.delete(fn); };
    map.nearbyBuildings = (x, z, radius = 100) => buildingIndex.query(x, z, radius).filter((b) =>
      Math.abs(b.x - x) <= radius + b.width / 2 && Math.abs(b.z - z) <= radius + b.depth / 2);
    map.nearbyRoads = (x, z, radius = 100) => detailRoadIndex.query(x, z, radius).filter((road) =>
      segmentDistance(x, z, road).distance <= radius + road.width / 2);
    map.nearbyHighways = (x, z, radius = 100) => highwayIndex.query(x, z, radius).filter((road) =>
      segmentDistance(x, z, road).distance <= radius + road.width / 2);
    map.nearbyGuardrails = (x, z, radius = 100) => railIndex.query(x, z, radius).filter((rail) => {
      const dx = x - rail.x, dz = z - rail.z, yaw = rail.yaw || 0;
      return Math.abs(dx * Math.sin(yaw) + dz * Math.cos(yaw)) <= rail.length / 2 + radius &&
        Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw)) <= radius + rail.width / 2;
    });
    map.nearbySupports = (x, z, radius = 100) => supportIndex.query(x, z, radius).filter((support) =>
      Math.abs(x - support.x) <= radius + support.width / 2 && Math.abs(z - support.z) <= radius + support.depth / 2);
    map.distanceToRoad = (x, z) => {
      let best = Infinity;
      for (const road of roadIndex.query(x, z, 60)) {
        const offset = segmentDistance(x, z, road).distance - road.width / 2 + roadHalfWidth;
        if (offset < best) best = offset;
      }
      return Math.max(0, best);
    };

    const loadJson = options.loadJson;
    if (typeof loadJson === 'function') {
      const base = options.baseUrl || '';
      const queue = [];
      let active = 0;
      function roadBounds(road) {
        return { minX: Math.min(road.x1, road.x2) - road.width, maxX: Math.max(road.x1, road.x2) + road.width,
          minZ: Math.min(road.z1, road.z2) - road.width, maxZ: Math.max(road.z1, road.z2) + road.width };
      }
      function generateBridgeParts(road) {
        const dx = road.x2 - road.x1, dz = road.z2 - road.z1, dy = road.y2 - road.y1;
        const horizontal = Math.hypot(dx, dz), slopeLength = Math.hypot(horizontal, dy);
        const yaw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, horizontal);
        const centerX = (road.x1 + road.x2) / 2, centerZ = (road.z1 + road.z2) / 2;
        const rails = [];
        for (const side of [-1, 1]) rails.push({
          x: centerX + side * Math.cos(yaw) * (road.width / 2 - .22),
          y: (road.y1 + road.y2) / 2 + .55 / Math.cos(pitch),
          z: centerZ - side * Math.sin(yaw) * (road.width / 2 - .22),
          width: .35, height: 1.1, length: slopeLength, yaw, pitch
        });
        const supports = [];
        const clearance = (road.y1 + road.y2) / 2 - terrainHeight(centerX, centerZ);
        if (horizontal >= 25 && clearance >= 3) for (const side of [-1, 1]) {
          const x = centerX + side * Math.cos(yaw) * Math.max(2, road.width / 2 - 1.5);
          const z = centerZ - side * Math.sin(yaw) * Math.max(2, road.width / 2 - 1.5);
          const groundY = terrainHeight(x, z), topY = (road.y1 + road.y2) / 2 - .5 / Math.cos(pitch);
          if (topY - groundY > 2) supports.push({ x, y: (groundY + topY) / 2, z,
            width: 1, height: topY - groundY, depth: 1 });
        }
        return { rails, supports };
      }
      function emit(type, data) {
        if (type === 'load') for (const listener of listeners) listener(data);
        for (const listener of changeListeners) listener({ type, tile: data });
      }
      function unload(entry) {
        if (entry.state !== 'loaded' || !entry.data) return;
        const data = entry.data;
        for (const road of data.roads) { detailRoadIndex.remove(road); roadIndex.remove(road); map.roadSegments.splice(map.roadSegments.indexOf(road), 1); }
        for (const road of data.highways) { highwayIndex.remove(road); roadIndex.remove(road); map.highwaySegments.splice(map.highwaySegments.indexOf(road), 1); }
        for (const building of data.buildings) { buildingIndex.remove(building); map.buildings.splice(map.buildings.indexOf(building), 1); }
        for (const rail of data.guardrails) { railIndex.remove(rail); map.guardrails.splice(map.guardrails.indexOf(rail), 1); }
        for (const support of data.supports) { supportIndex.remove(support); map.supports.splice(map.supports.indexOf(support), 1); }
        entry.state = 'idle'; entry.data = null; entry.promise = null;
        emit('unload', data);
      }
      map.trimFar = (x, z, radius = tileSize * 3.2) => {
        for (const entry of tiles.values()) {
          const tile = entry.descriptor;
          const dx = Math.max(tile.ix * tileSize - x, 0, x - (tile.ix + 1) * tileSize);
          const dz = Math.max(tile.iz * tileSize - z, 0, z - (tile.iz + 1) * tileSize);
          if (Math.hypot(dx, dz) > radius) unload(entry);
        }
      };
      function pump() {
        while (active < 4 && queue.length) {
          const job = queue.shift();
          active++;
          Promise.resolve().then(() => loadJson(resolve(base, job.entry.descriptor.file)))
            .then((raw) => {
              if (!raw || raw.format !== 'drive-city-tile-v1') throw new Error('Imported city tile has an unsupported format');
              const tileRoads = [], tileHighways = [], tileBuildings = [], tileRails = [], tileSupports = [];
              for (const feature of raw.features || []) {
                if (!feature || !feature.type) continue;
                if (feature.type === 'road') for (const road of normalizeRoad(feature)) {
                  const middleX = (road.x1 + road.x2) / 2, middleZ = (road.z1 + road.z2) / 2;
                  const clearance = Math.min(road.y1 - terrainHeight(road.x1, road.z1), road.y2 - terrainHeight(road.x2, road.z2),
                    (road.y1 + road.y2) / 2 - terrainHeight(middleX, middleZ));
                  if (isElevated(road.mode) || clearance > 2.5) {
                    const slab = { ...road, topStart: road.y1, topEnd: road.y2 };
                    tileHighways.push(slab);
                    const parts = generateBridgeParts(slab);
                    tileRails.push(...parts.rails); tileSupports.push(...parts.supports);
                  } else tileRoads.push(road);
                }
                if (feature.type === 'building') {
                  const building = normalizeBuilding(feature, terrainHeight);
                  if (building) tileBuildings.push(building);
                }
              }
              job.entry.data = { ix: job.entry.descriptor.ix, iz: job.entry.descriptor.iz,
                roads: tileRoads, highways: tileHighways, buildings: tileBuildings,
                guardrails: tileRails, supports: tileSupports };
              job.entry.state = 'loaded';
              for (const road of tileRoads) {
                map.roadSegments.push(road);
                roadIndex.add(road, roadBounds(road)); detailRoadIndex.add(road, roadBounds(road));
              }
              for (const slab of tileHighways) { map.highwaySegments.push(slab); highwayIndex.add(slab, roadBounds(slab)); roadIndex.add(slab, roadBounds(slab)); }
              for (const building of tileBuildings) {
                map.buildings.push(building);
                buildingIndex.add(building, { minX: building.x - building.width / 2, maxX: building.x + building.width / 2,
                  minZ: building.z - building.depth / 2, maxZ: building.z + building.depth / 2 });
              }
              for (const rail of tileRails) { map.guardrails.push(rail); railIndex.add(rail, { minX: rail.x - rail.length, maxX: rail.x + rail.length, minZ: rail.z - rail.length, maxZ: rail.z + rail.length }); }
              for (const support of tileSupports) { map.supports.push(support); supportIndex.add(support, { minX: support.x - support.width, maxX: support.x + support.width, minZ: support.z - support.depth, maxZ: support.z + support.depth }); }
              emit('load', job.entry.data);
              job.resolve(job.entry.data);
            }).catch((error) => { job.entry.state = 'failed'; job.entry.retryAt = Date.now() + 5000; job.entry.promise = null; job.reject(error); })
            .finally(() => { active--; pump(); });
        }
      }
      function request(entry) {
        if (entry.state === 'loaded') return Promise.resolve(entry.data);
        if (entry.promise) return entry.promise;
        if (entry.state === 'failed' && Date.now() < entry.retryAt) return Promise.resolve(null);
        entry.state = 'loading';
        entry.promise = new Promise((resolveJob, rejectJob) => queue.push({ entry, resolve: resolveJob, reject: rejectJob }));
        pump();
        return entry.promise;
      }
      map.ensureNear = (x, z, radius = tileSize * 1.2) => {
        map.trimFar(x, z, radius + tileSize * 2);
        const jobs = [];
        for (const entry of tiles.values()) {
          const tile = entry.descriptor;
          const dx = Math.max(tile.ix * tileSize - x, 0, x - (tile.ix + 1) * tileSize);
          const dz = Math.max(tile.iz * tileSize - z, 0, z - (tile.iz + 1) * tileSize);
          if (Math.hypot(dx, dz) <= radius) jobs.push(request(entry));
        }
        return Promise.all(jobs);
      };
      map.ensureAll = () => Promise.all(Array.from(tiles.values(), request));
    } else {
      map.ensureNear = () => Promise.resolve([]);
      map.ensureAll = () => Promise.resolve([]);
    }
    map.build = (THREE, world) => build(THREE, world, map);
    return map;
  }

  async function load(url = assetUrl, options = {}) {
    const requester = options.fetch || (typeof fetch === 'function' ? fetch : null);
    if (!requester) throw new Error('fetch is unavailable for imported city');
    async function getJson(path) {
      const response = await requester(path);
      if (!response || !response.ok) throw new Error('Could not load imported city asset: ' + path);
      return response.json();
    }
    const base = url.slice(0, url.lastIndexOf('/') + 1);
    const manifest = await getJson(url);
    if (!manifest || manifest.format !== 'drive-city-v1') throw new Error('Imported city manifest has an unsupported format');
    const [overview, terrain] = await Promise.all([
      getJson(resolve(base, manifest.overview && manifest.overview.file || 'overview.json')),
      getJson(resolve(base, manifest.terrain && manifest.terrain.file || 'terrain.json'))
    ]);
    const map = create(manifest, overview, terrain, { loadJson: getJson, baseUrl: base });
    const spawn = map.routeSamples[0];
    await map.ensureNear(spawn.x, spawn.z, Math.max(240, map.tileSize * 1.05));
    return map;
  }

  function build(THREE, world, map) {
    const chunkRoot = new THREE.Group(), terrainRoot = new THREE.Group();
    chunkRoot.name = 'imported-city-tiles'; terrainRoot.name = 'imported-city-terrain';
    world.add(terrainRoot, chunkRoot);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x101a29, metalness: .32, roughness: .26, side: THREE.DoubleSide });
    const elevatedMat = new THREE.MeshStandardMaterial({ color: 0x24334a, metalness: .38, roughness: .37, side: THREE.DoubleSide });
    const laneMat = new THREE.MeshBasicMaterial({ color: 0x55d9ea, transparent: true, opacity: .76, depthWrite: false, side: THREE.DoubleSide });
    const highwayLaneMat = new THREE.MeshBasicMaterial({ color: 0xffbd73, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide });
    const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: .06, side: THREE.DoubleSide });
    const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .65, metalness: .28, side: THREE.DoubleSide });
    const bridgePartMat = new THREE.MeshStandardMaterial({ color: 0x58718c, metalness: .48, roughness: .43 });
    const districtMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide });
    const box = new THREE.BoxGeometry(1, 1, 1);
    const tileGroups = new Map(), terrainChunks = new Map();
    let disposed = false;

    function facadeTexture() {
      const width = 16, height = 24, pixels = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const frame = x % 4 === 0 || y % 4 === 0;
        const lit = !frame && (hash(x + ':' + y) % 11 < 3);
        const rgb = frame ? [13, 22, 36] : lit ? (x % 2 ? [67, 225, 233] : [241, 81, 168]) : [29, 58, 80];
        pixels[i] = rgb[0]; pixels[i + 1] = rgb[1]; pixels[i + 2] = rgb[2]; pixels[i + 3] = 255;
      }
      const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true; texture.needsUpdate = true;
      return texture;
    }
    const windows = facadeTexture();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xc5d6e2, map: windows,
      emissive: 0x477e9b, emissiveMap: windows, emissiveIntensity: .45,
      vertexColors: true, roughness: .48, metalness: .27, side: THREE.DoubleSide });
    function geometry(positions, colors, uvs) {
      const result = new THREE.BufferGeometry();
      result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      if (colors) result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      if (uvs) result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      result.computeVertexNormals();
      return result;
    }
    function mesh(name, positions, material, parent, colors, uvs) {
      if (!positions.length) return null;
      const result = new THREE.Mesh(geometry(positions, colors, uvs), material);
      result.name = name; result.receiveShadow = true;
      parent.add(result);
      return result;
    }
    function triangle(out, a, b, c) { out.push(...a, ...b, ...c); }
    function quad(out, a, b, c, d) { triangle(out, a, b, c); triangle(out, a, c, d); }
    function colorTriangle(out, color) { for (let i = 0; i < 3; i++) out.push(color.r, color.g, color.b); }
    function colorQuad(out, color) { colorTriangle(out, color); colorTriangle(out, color); }
    function uvQuad(out, ua, va, ub, vb) {
      out.push(ua, va, ub, va, ub, vb, ua, va, ub, vb, ua, vb);
    }
    function roadStrip(out, road, halfWidth, yOffset) {
      const dx = road.x2 - road.x1, dz = road.z2 - road.z1, length = Math.hypot(dx, dz);
      if (length < .1) return;
      const nx = dz / length * halfWidth, nz = -dx / length * halfWidth;
      const a = [road.x1 + nx, road.y1 + yOffset, road.z1 + nz];
      const b = [road.x2 + nx, road.y2 + yOffset, road.z2 + nz];
      const c = [road.x2 - nx, road.y2 + yOffset, road.z2 - nz];
      const d = [road.x1 - nx, road.y1 + yOffset, road.z1 - nz];
      triangle(out, a, c, b); triangle(out, a, d, c);
    }
    function bridgeBox(out, road) {
      const dx = road.x2 - road.x1, dz = road.z2 - road.z1, dy = road.y2 - road.y1;
      const flat = Math.hypot(dx, dz), length = Math.hypot(flat, dy);
      if (flat < .1) return;
      const yaw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, flat);
      const cy = (road.y1 + road.y2) / 2 - .25 / Math.cos(pitch);
      const cx = (road.x1 + road.x2) / 2, cz = (road.z1 + road.z2) / 2;
      function vertex(x, y, z) {
        const yy = y * Math.cos(pitch) - z * Math.sin(pitch);
        const zz = y * Math.sin(pitch) + z * Math.cos(pitch);
        return [cx + x * Math.cos(yaw) + zz * Math.sin(yaw), cy + yy,
          cz - x * Math.sin(yaw) + zz * Math.cos(yaw)];
      }
      const w = road.width / 2, l = length / 2;
      const a = vertex(-w, -.25, -l), b = vertex(w, -.25, -l), c = vertex(w, -.25, l), d = vertex(-w, -.25, l);
      const e = vertex(-w, .25, -l), f = vertex(w, .25, -l), g = vertex(w, .25, l), h = vertex(-w, .25, l);
      quad(out, e, h, g, f); quad(out, d, a, b, c);
      quad(out, a, e, f, b); quad(out, b, f, g, c);
      quad(out, c, g, h, d); quad(out, d, h, e, a);
    }
    function buildingColor(building) {
      const role = (building.role + ' ' + building.category).toLowerCase();
      const palette = /industrial|factory|warehouse/.test(role) ? [0x445e6a, 0x314c58] :
        /commercial|office|shop|retail/.test(role) ? [0x476378, 0x49506e] :
        /residential|house|apartment/.test(role) ? [0x4b526f, 0x3d6072] :
        [0x47556a, 0x53617d];
      return new THREE.Color(palette[hash(building.id || building.x + ':' + building.z) % palette.length]);
    }
    function addBuilding(outWalls, outColors, outUVs, outRoofs, outRoofColors, building) {
      const ring = building.footprint, height = building.height, base = building.baseY;
      const tint = buildingColor(building);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < .1) continue;
        const lowerA = [a[0], base, a[1]], lowerB = [b[0], base, b[1]];
        const upperB = [b[0], base + height, b[1]], upperA = [a[0], base + height, a[1]];
        quad(outWalls, lowerA, lowerB, upperB, upperA);
        colorQuad(outColors, tint);
        uvQuad(outUVs, 0, 0, length / 3.2, height / 4);
      }
      if (!THREE.ShapeUtils || !THREE.ShapeUtils.triangulateShape) return;
      const contour = ring.map((p) => new THREE.Vector2(p[0], p[1]));
      let triangles;
      try { triangles = THREE.ShapeUtils.triangulateShape(contour, []); } catch (_) { return; }
      const roofTint = tint.clone().multiplyScalar(1.12);
      for (const triplet of triangles) {
        triangle(outRoofs, [ring[triplet[0]][0], base + height, ring[triplet[0]][1]],
          [ring[triplet[1]][0], base + height, ring[triplet[1]][1]],
          [ring[triplet[2]][0], base + height, ring[triplet[2]][1]]);
        colorTriangle(outRoofColors, roofTint);
      }
    }
    function placeBox(instance, part, i) {
      const dummy = new THREE.Object3D();
      dummy.position.set(part.x, part.y, part.z);
      dummy.rotation.set(part.pitch || 0, part.yaw || 0, 0, 'YXZ');
      dummy.scale.set(part.width, part.height, part.length || part.depth);
      dummy.updateMatrix(); instance.setMatrixAt(i, dummy.matrix);
    }
    function renderTile(tile) {
      if (disposed) return;
      const id = key(tile.ix, tile.iz);
      if (tileGroups.has(id)) return;
      const group = new THREE.Group(); group.name = 'imported-city-tile';
      group.userData.tile = { ix: tile.ix, iz: tile.iz };
      chunkRoot.add(group); tileGroups.set(id, group);
      const groundPositions = [], groundHighways = [], bridgePositions = [], lanePositions = [], highwayLanes = [];
      for (const road of tile.roads) {
        const highway = isMotorway(road);
        roadStrip(highway ? groundHighways : groundPositions, road, road.width / 2, .035);
        roadStrip(highway ? highwayLanes : lanePositions, road, .12, .05);
      }
      for (const road of tile.highways) {
        bridgeBox(bridgePositions, road);
        roadStrip(isMotorway(road) ? highwayLanes : lanePositions, road, .12, .04);
      }
      mesh('imported-city-road', groundPositions, roadMat, group);
      mesh('imported-city-highway-grade', groundHighways, elevatedMat, group);
      mesh('imported-city-highway', bridgePositions, elevatedMat, group);
      mesh('imported-city-lane-light', lanePositions, laneMat, group);
      mesh('imported-city-highway-lane', highwayLanes, highwayLaneMat, group);
      const walls = [], wallColors = [], wallUVs = [], roofs = [], roofColors = [];
      for (const building of tile.buildings) addBuilding(walls, wallColors, wallUVs, roofs, roofColors, building);
      mesh('imported-city-building', walls, wallMat, group, wallColors, wallUVs);
      mesh('imported-city-roof', roofs, roofMat, group, roofColors);
      if (tile.guardrails.length) {
        const rails = new THREE.InstancedMesh(box, bridgePartMat, tile.guardrails.length);
        rails.name = 'imported-city-guardrail'; rails.castShadow = true;
        tile.guardrails.forEach((part, i) => placeBox(rails, part, i));
        rails.instanceMatrix.needsUpdate = true; group.add(rails);
      }
      if (tile.supports.length) {
        const supports = new THREE.InstancedMesh(box, bridgePartMat, tile.supports.length);
        supports.name = 'imported-city-support'; supports.castShadow = true;
        tile.supports.forEach((part, i) => placeBox(supports, part, i));
        supports.instanceMatrix.needsUpdate = true; group.add(supports);
      }
    }
    function dropTile(tile) {
      const id = key(tile.ix, tile.iz), group = tileGroups.get(id);
      if (!group) return;
      group.traverse((object) => { if (object.geometry && object.geometry !== box) object.geometry.dispose(); });
      chunkRoot.remove(group); tileGroups.delete(id);
    }
    const unsubscribe = map.onTileChanged(({ type, tile }) => type === 'load' ? renderTile(tile) : dropTile(tile));
    for (const entry of map.loadedTiles.values()) if (entry.state === 'loaded' && entry.data) renderTile(entry.data);

    // CMM labels factories and facilities PARK_ZONE too. Only names that
    // actually describe green public space become ground overlays.
    const parkChunkSize = Math.max(512, map.tileSize);
    const parkBuckets = new Map(), parkMeshes = new Map();
    for (const district of map.districts) {
      const label = district.name.trim();
      if (!/\b(?:park|garden|playground|greenway|greenspace)\b/i.test(label) ||
        /\b(?:water|skate|bicycle)\s+park\b/i.test(label)) continue;
      const ring = district.polygon;
      if (ring.length > 5000) continue;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of ring) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const id = key(Math.floor(cx / parkChunkSize), Math.floor(cz / parkChunkSize));
      if (!parkBuckets.has(id)) parkBuckets.set(id, { districts: [], reach: 0 });
      const bucket = parkBuckets.get(id);
      bucket.districts.push(district);
      bucket.reach = Math.max(bucket.reach, Math.hypot(maxX - minX, maxZ - minZ) / 2);
    }
    function parkDistance(x, z, id) {
      const [ix, iz] = id.split(',').map(Number);
      const minX = ix * parkChunkSize, minZ = iz * parkChunkSize;
      return Math.hypot(Math.max(minX - x, 0, x - minX - parkChunkSize),
        Math.max(minZ - z, 0, z - minZ - parkChunkSize));
    }
    function renderParkChunk(id, bucket) {
      if (parkMeshes.has(id) || !THREE.ShapeUtils || !THREE.ShapeUtils.triangulateShape) return;
      const positions = [], colors = [];
      for (const district of bucket.districts) {
        const ring = district.polygon;
        let faces;
        try { faces = THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p[0], p[1])), []); }
        catch (_) { continue; }
        const color = new THREE.Color(0x2c7458);
        for (const face of faces) {
          triangle(positions, ...face.map((i) => [ring[i][0], map.terrainHeight(ring[i][0], ring[i][1]) + .018, ring[i][1]]));
          colorTriangle(colors, color);
        }
      }
      const overlay = mesh('imported-city-park', positions, districtMat, world, colors);
      if (overlay) parkMeshes.set(id, overlay);
    }
    function maintainParks(x, z, radius) {
      for (const [id, bucket] of parkBuckets) {
        if (parkDistance(x, z, id) <= radius + bucket.reach) renderParkChunk(id, bucket);
      }
      for (const [id, overlay] of parkMeshes) {
        const bucket = parkBuckets.get(id);
        if (parkDistance(x, z, id) > radius + bucket.reach + parkChunkSize * 1.5) {
          overlay.geometry.dispose(); world.remove(overlay); parkMeshes.delete(id);
        }
      }
    }

    const terrain = map.terrain;
    const terrainChunkCells = 40;
    function terrainColor(i, j) {
      const rawRow = terrain.rows - 1 - j;
      const depth = terrain.waterDepths && terrain.waterDepths[rawRow * terrain.cols + i] || 0;
      const height = terrain.data[i][j];
      return new THREE.Color(depth > .1 ? 0x12334b : height > 80 ? 0x334352 : height < 1 ? 0x223d43 : 0x273a40);
    }
    function renderTerrainChunk(ci, cj) {
      const id = key(ci, cj);
      if (terrainChunks.has(id)) return;
      const i0 = ci * terrainChunkCells, j0 = cj * terrainChunkCells;
      const i1 = Math.min(terrain.cols - 1, i0 + terrainChunkCells);
      const j1 = Math.min(terrain.rows - 1, j0 + terrainChunkCells);
      if (i0 >= i1 || j0 >= j1) return;
      const positions = [], colors = [], indices = [];
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        positions.push(terrain.originX + i * terrain.elementSize, terrain.data[i][j], terrain.maxZ - j * terrain.elementSize);
        const color = terrainColor(i, j); colors.push(color.r, color.g, color.b);
      }
      const rowLength = i1 - i0 + 1;
      for (let j = 0; j < j1 - j0; j++) for (let i = 0; i < i1 - i0; i++) {
        const a = j * rowLength + i, b = a + 1, c = a + rowLength, d = c + 1;
        indices.push(a, b, c, d, c, b);
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geom.setIndex(indices); geom.computeVertexNormals();
      const ground = new THREE.Mesh(geom, terrainMat); ground.name = 'imported-city-terrain-chunk';
      ground.receiveShadow = true; terrainRoot.add(ground); terrainChunks.set(id, ground);
    }
    function maintainTerrain(x, z, radius) {
      const size = terrainChunkCells * terrain.elementSize;
      const maxI = Math.ceil((terrain.cols - 1) / terrainChunkCells), maxJ = Math.ceil((terrain.rows - 1) / terrainChunkCells);
      for (let ci = 0; ci < maxI; ci++) for (let cj = 0; cj < maxJ; cj++) {
        const x0 = terrain.originX + ci * size, z0 = terrain.maxZ - (cj + 1) * size;
        const dx = Math.max(x0 - x, 0, x - (x0 + size));
        const dz = Math.max(z0 - z, 0, z - (z0 + size));
        if (Math.hypot(dx, dz) < radius) renderTerrainChunk(ci, cj);
      }
      for (const [id, ground] of terrainChunks) {
        const [ci, cj] = id.split(',').map(Number);
        const x0 = terrain.originX + ci * size, z0 = terrain.maxZ - (cj + 1) * size;
        const dx = Math.max(x0 - x, 0, x - (x0 + size));
        const dz = Math.max(z0 - z, 0, z - (z0 + size));
        if (Math.hypot(dx, dz) > radius + size * 1.5) {
          ground.geometry.dispose(); terrainRoot.remove(ground); terrainChunks.delete(id);
        }
      }
    }

    function signTexture(label, color) {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
      const canvas = document.createElement('canvas');
      if (!canvas || typeof canvas.getContext !== 'function') return null;
      canvas.width = 512; canvas.height = 128;
      const ctx = canvas.getContext('2d'); if (!ctx) return null;
      ctx.fillStyle = '#101729'; ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.strokeRect(5, 5, 502, 118);
      let size = 43; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      do { ctx.font = '700 ' + size + 'px monospace'; size -= 2; } while (size > 22 && ctx.measureText(label).width > 465);
      ctx.fillStyle = color; ctx.fillText(label, 256, 65);
      const texture = new THREE.CanvasTexture(canvas);
      if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
      return texture;
    }
    for (const stop of map.stops) {
      const beacon = new THREE.Group(); beacon.name = 'imported-city-landmark';
      beacon.position.set(stop.x, Number.isFinite(stop.y) ? stop.y : map.terrainHeight(stop.x, stop.z), stop.z);
      const tint = new THREE.Color(stop.color);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.24, .32, 9, 8), new THREE.MeshBasicMaterial({ color: tint }));
      pillar.position.set(6, 5, 0);
      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(1.2), new THREE.MeshBasicMaterial({ color: tint }));
      cap.position.set(6, 10, 0); beacon.add(pillar, cap);
      const texture = signTexture(stop.title.toUpperCase(), stop.color);
      if (texture) for (const angle of [0, Math.PI]) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3.2), new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide }));
        sign.position.set(0, 8.5, angle ? -.05 : .05); sign.rotation.y = angle;
        beacon.add(sign);
      }
      world.add(beacon);
    }

    const rainCount = 280, rainPositions = new Float32Array(rainCount * 6), drops = [];
    for (let i = 0; i < rainCount; i++) drops.push({ x: (hash(i + ':x') % 1000) / 10 - 50,
      z: (hash(i + ':z') % 1000) / 10 - 50, y: (hash(i + ':y') % 400) / 10,
      speed: 18 + hash(i + ':s') % 15 });
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: 0x9bc7e2, transparent: true, opacity: .22, depthWrite: false }));
    rain.name = 'imported-city-rain'; rain.frustumCulled = false; world.add(rain);
    function updateRain(camera, dt) {
      rain.position.set(camera.position.x, camera.position.y - 12, camera.position.z);
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i]; d.y -= d.speed * Math.min(.1, dt || 0);
        if (d.y < -3) d.y += 44;
        const p = i * 6;
        rainPositions[p] = d.x; rainPositions[p + 1] = d.y; rainPositions[p + 2] = d.z;
        rainPositions[p + 3] = d.x - .16; rainPositions[p + 4] = d.y - 1.1; rainPositions[p + 5] = d.z;
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }
    let lastX = Infinity, lastZ = Infinity;
    function update(camera, dt) {
      if (disposed || !camera) return;
      const x = camera.position.x, z = camera.position.z;
      updateRain(camera, dt);
      if (Math.hypot(x - lastX, z - lastZ) < Math.max(50, map.tileSize / 3)) return;
      lastX = x; lastZ = z;
      const activeRadius = Math.max(280, map.tileSize * 1.05);
      map.ensureNear(x, z, activeRadius).catch(() => {});
      maintainTerrain(x, z, Math.max(1000, map.tileSize * 2.2));
      maintainParks(x, z, Math.max(950, map.tileSize * 2));
      for (const [id, group] of tileGroups) {
        const [ix, iz] = id.split(',').map(Number);
        const dx = Math.max(ix * map.tileSize - x, 0, x - (ix + 1) * map.tileSize);
        const dz = Math.max(iz * map.tileSize - z, 0, z - (iz + 1) * map.tileSize);
        group.visible = Math.hypot(dx, dz) < 1100;
      }
    }
    const spawn = map.routeSamples[0];
    update({ position: { x: spawn.x, y: spawn.y + 8, z: spawn.z } }, 0);
    function dispose() { disposed = true; unsubscribe(); }
    return { update, dispose };
  }

  return { assetUrl, create, load };
});
