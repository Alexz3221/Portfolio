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
  // The four exported zoning roles have 55 authored silhouettes. Landmark
  // families add another 40. Source IDs select a stable recipe within a family;
  // prefab and category decide which family a building belongs to.
  const zoningModelFamilies = Object.freeze({
    residential: ['house', 'rowhouse', 'apartments', 'tower'],
    commercial: ['storefront', 'gasstation', 'glass'],
    industrial: ['industrial', 'warehouse'],
    office: ['office', 'officeTower']
  });
  const modelFamilies = [...Object.values(zoningModelFamilies).flat(),
    'civic', 'campus', 'hospital', 'castle', 'airport', 'stadium', 'parking', 'monument'];
  const modelCatalog = Object.freeze(modelFamilies.flatMap((style) =>
    Array.from({ length: 5 }, (_, variant) => `${style}:${variant}`)));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const key = (ix, iz) => ix + ',' + iz;
  const isElevated = (mode) => /elevated|bridge|viaduct|overpass|flyover/i.test(String(mode || ''));
  const isTunnel = (mode) => /tunnel|underground/i.test(String(mode || ''));
  const isMotorway = (road) => road.roadClass ? /highway|motorway|freeway|express/i.test(String(road.roadClass)) :
    /highway|motorway|freeway|express/i.test(String(road.kind || '') + ' ' + String(road.level || '')) ||
    (finite(road.lanes && road.lanes.car_lane_count) >= 6 && road.width >= 28);
  function isLandscapeCategory(category) {
    const label = String(category || '').trim();
    if (/\b(?:cafe|stand|center|building|station|garage)\b/i.test(label)) return false;
    return /\bdecal\b|^cemetery$|\b(?:park|playground)$|^(?:soccer|football|basketball|tennis) (?:field|court)$|^community pool$/i.test(label);
  }
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
  function cubicPoint(curve, t) {
    const s = 1 - t, a = s * s * s, b = 3 * s * s * t,
      c = 3 * s * t * t, d = t * t * t;
    return [0, 1, 2].map((axis) =>
      curve[0][axis] * a + curve[1][axis] * b + curve[2][axis] * c + curve[3][axis] * d);
  }
  function cubicTangent(curve, t) {
    const s = 1 - t;
    return [0, 1, 2].map((axis) =>
      3 * s * s * (curve[1][axis] - curve[0][axis]) +
      6 * s * t * (curve[2][axis] - curve[1][axis]) +
      3 * t * t * (curve[3][axis] - curve[2][axis]));
  }
  function validLaneCurve(curve) {
    return Array.isArray(curve) && curve.length === 4 && curve.every((p) =>
      Array.isArray(p) && p.length === 3 && p.every(Number.isFinite));
  }
  function sampleLaneConnector(connector, terrainHeight) {
    const curve = connector.curve;
    if (!validLaneCurve(curve)) return [];
    let controlLength = 0;
    for (let i = 0; i < 3; i++)
      controlLength += Math.hypot(curve[i + 1][0] - curve[i][0], curve[i + 1][2] - curve[i][2]);
    const steps = clamp(Math.ceil(controlLength / 3), 2, 32), samples = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, [x, sourceY, z] = cubicPoint(curve, t);
      let [dx, , dz] = cubicTangent(curve, t);
      let length = Math.hypot(dx, dz);
      if (length < .001) {
        dx = curve[3][0] - curve[0][0]; dz = curve[3][2] - curve[0][2];
        length = Math.hypot(dx, dz) || 1;
      }
      samples.push({ x, y: Math.max(sourceY + .08, terrainHeight(x, z) + .095), z,
        nx: dz / length, nz: -dx / length, sourceY });
    }
    return samples;
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
    let pathDistance = 0;
    // Offset every piece of a sampled curve from the same shared corner.
    // Independent rectangular strips leave a triangle open at each bend.
    const normals = [];
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1][0] - points[i][0], dz = points[i + 1][2] - points[i][2];
      const length = Math.hypot(dx, dz);
      normals.push(length > .1 ? [dz / length, -dx / length] : null);
    }
    const corner = (index, fallback) => {
      const before = normals[index - 1], after = normals[index];
      if (!before || !after) return before || after || fallback;
      const cosine = before[0] * after[0] + before[1] * after[1];
      if (cosine < -.8) return after;
      const scale = 1 / (1 + cosine);
      const x = (before[0] + after[0]) * scale;
      const z = (before[1] + after[1]) * scale;
      const magnitude = Math.hypot(x, z);
      return magnitude > 3 ? [x * 3 / magnitude, z * 3 / magnitude] : [x, z];
    };
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (length < .1) continue;
      const normal = normals[i];
      segments.push({
        id: record.id, part: record.part, x1: a[0], y1: a[1], z1: a[2],
        x2: b[0], y2: b[1], z2: b[2], width,
        startMiter: corner(i, normal), endMiter: corner(i + 1, normal), pathDistance,
        kind: record.kind || 'street', roadClass: record.roadClass || null,
        name: record.name || '', mode: record.mode || 'normal', level: record.level ?? null,
        lanes: record.lanes || null, carAccess: record.carAccess || null,
        carSpeed: record.carSpeed || null, trafficFlow: record.trafficFlow || null,
        laneDetails: Array.isArray(record.laneDetails) ? record.laneDetails : null
      });
      pathDistance += length;
    }
    return segments;
  }
  function insetConvexFootprint(ring, distance) {
    if (ring.length < 3 || distance <= 0) return ring;
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    if (Math.abs(area) < .01) return ring;
    const winding = Math.sign(area), edges = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < .05) return ring;
      edges.push({ x: a[0] - winding * dz / length * distance,
        z: a[1] + winding * dx / length * distance, dx, dz });
    }
    const result = [];
    for (let i = 0; i < edges.length; i++) {
      const previous = edges[(i + edges.length - 1) % edges.length], current = edges[i];
      const det = previous.dx * current.dz - previous.dz * current.dx;
      if (Math.abs(det) < 1e-5) return ring;
      const qx = current.x - previous.x, qz = current.z - previous.z;
      const t = (qx * current.dz - qz * current.dx) / det;
      const point = [previous.x + previous.dx * t, previous.z + previous.dz * t];
      if (!point.every(Number.isFinite) || Math.hypot(point[0] - ring[i][0], point[1] - ring[i][1]) > distance * 8) return ring;
      result.push(point);
    }
    let innerArea = 0;
    for (let i = 0; i < result.length; i++) {
      const a = result[i], b = result[(i + 1) % result.length];
      innerArea += a[0] * b[1] - b[0] * a[1];
    }
    return Math.sign(innerArea) === winding && Math.abs(innerArea) > 1 ? result : ring;
  }
  function normalizeBuilding(record, terrainHeight, meshBackedParentIds) {
    const sourceFootprint = Array.isArray(record.footprint) ? record.footprint
      .map((p) => [finite(p[0], NaN), finite(p[1], NaN)])
      .filter((p) => p.every(Number.isFinite)) : [];
    if (sourceFootprint.length > 2 && Math.hypot(sourceFootprint[0][0] - sourceFootprint[sourceFootprint.length - 1][0], sourceFootprint[0][1] - sourceFootprint[sourceFootprint.length - 1][1]) < .001) sourceFootprint.pop();
    if (sourceFootprint.length < 3) return null;
    const skipParent = meshBackedParentIds?.has(String(record.id)) || false;
    const landscape = isLandscapeCategory(record.category);
    const edges = sourceFootprint.map((point, i) => Math.hypot(
      sourceFootprint[(i + 1) % sourceFootprint.length][0] - point[0],
      sourceFootprint[(i + 1) % sourceFootprint.length][1] - point[1]));
    const proxy = record.geometrySource === 'cs2:mesh-bounds';
    // Airport mesh 0 is a bounds-only envelope for the entire airfield. Its
    // box contains the terminal roads and is not a driveable building shell.
    const airportEnvelope = proxy && /airport.*mesh\s+0/i.test(String(record.prefab || '')) &&
      Math.max(...edges) > 300;
    const rowhouse = /row housing|old town/i.test(String(record.category || ''));
    const desiredSetback = proxy ? .12 : skipParent || landscape ? 0 : rowhouse ? .34 :
      record.growthKind === 'placed' ? .42 : .72 + (hash('setback:' + record.id) % 5) * .16;
    const setback = Math.min(desiredSetback, Math.min(...edges) * .14);
    const footprint = insetConvexFootprint(sourceFootprint, setback);
    const xs = footprint.map((p) => p[0]), zs = footprint.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    if (maxX - minX < .3 || maxZ - minZ < .3) return null;
    const x = (minX + maxX) / 2, z = (minZ + maxZ) / 2;
    const height = clamp(finite(record.height, 12), 2, 600);
    const baseY = Number.isFinite(Number(record.baseY)) ? Number(record.baseY) : terrainHeight(x, z);
    return { id: record.id, x, z, width: maxX - minX, depth: maxZ - minZ,
      height, baseY, footprint, sourceFootprint, setback, role: record.role || '', category: record.category || '', name: record.name || '',
      prefab: record.prefab || '', parentBuildingId: record.parentBuildingId || null,
      growthKind: record.growthKind || '', geometrySource: record.geometrySource || '',
      skipVisual: skipParent || airportEnvelope,
      skipCollider: skipParent || landscape || airportEnvelope, landscape,
      airportEnvelope: airportEnvelope && /internationalairport01/i.test(String(record.prefab || '')),
      modelVariant: hash('model:' + record.id) % 5 };
  }
  function airportTerminalBuildings(site, terrainHeight, meshBackedParentIds) {
    const ring = site.sourceFootprint;
    if (!site.airportEnvelope || ring.length !== 4) return [];
    // The Save 12 international airport's giant mesh bounds include both the
    // runway and its one-way ground/elevated dropoff loop. Place a compact
    // terminal on the airfield side, with open curbside canopy above the loop.
    const region = (u0, u1, v0, v1) => {
      const at = (u, v) => [0, 1].map(axis =>
        ring[0][axis] * (1 - u) * (1 - v) + ring[3][axis] * u * (1 - v) +
        ring[2][axis] * u * v + ring[1][axis] * (1 - u) * v);
      return [at(u0, v0), at(u0, v1), at(u1, v1), at(u1, v0)];
    };
    const specs = [
      ['terminal-north', 'International Airport Terminal', .695, .782, .385, .445, 21],
      ['terminal-center', 'International Airport Terminal', .695, .782, .460, .520, 23],
      ['terminal-south', 'International Airport Terminal', .695, .782, .535, .595, 20],
      ['concourse-north', 'International Airport Concourse', .425, .699, .402, .428, 10],
      ['concourse-center', 'International Airport Concourse', .425, .699, .477, .503, 11],
      ['concourse-south', 'International Airport Concourse', .425, .699, .552, .578, 10],
      ['control-tower', 'International Airport Control Tower', .630, .675, .475, .508, 43],
      ['dropoff-canopy-north', 'International Airport Dropoff Canopy', .782, .825, .385, .445, 8.3],
      ['dropoff-canopy-center', 'International Airport Dropoff Canopy', .782, .825, .460, .520, 8.3],
      ['dropoff-canopy-south', 'International Airport Dropoff Canopy', .782, .825, .535, .595, 8.3]
    ];
    return specs.map(([suffix, prefab, u0, u1, v0, v1, height]) => {
      const part = normalizeBuilding({ id: `${site.id}:${suffix}`,
        footprint: region(u0, u1, v0, v1), baseY: site.baseY, height,
        role: 'AIRPORT', category: 'International Airport', prefab,
        name: prefab, growthKind: 'placed', geometrySource: 'procedural-airport',
        parentBuildingId: site.id }, terrainHeight, meshBackedParentIds);
      if (part && suffix.startsWith('dropoff-canopy')) part.skipCollider = true;
      return part;
    }).filter(Boolean);
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
  function roadDeckAt(segments, x, z) {
    let best = null, bestDistance = Infinity;
    for (const road of segments || []) {
      const hit = segmentDistance(x, z, road);
      if (hit.distance >= bestDistance) continue;
      best = road.y1 + (road.y2 - road.y1) * hit.t;
      bestDistance = hit.distance;
      if (bestDistance < .01) break;
    }
    const width = segments?.[0]?.width || 0;
    return bestDistance <= width / 2 + 6 ? best : null;
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
      // Face into the longer remaining side of the street. A stop snapped to
      // the end of a segment must not launch the car into the next building.
      const heading = Math.atan2(road.x2 - road.x1, road.z2 - road.z1) + (t > .5 ? Math.PI : 0);
      return { id: template.id, title: authored && authored.title || template.title,
        color: authored && authored.color || template.color,
        landmark: authored && authored.landmark || '',
        x: road.x1 + (road.x2 - road.x1) * t,
        y: road.y1 + (road.y2 - road.y1) * t,
        z: road.z1 + (road.z2 - road.z1) * t,
        heading, roadWidth: road.width };
    });
  }

  function create(manifest, overview, terrainRaw, options = {}) {
    if (!manifest || manifest.format !== 'drive-city-v1') throw new Error('Imported city manifest has an unsupported format');
    if (!overview || overview.format !== 'drive-city-overview-v1') throw new Error('Imported city overview has an unsupported format');
    const detailBounds = validBounds(manifest.bounds);
    const worldBounds = validBounds(manifest.worldBounds || manifest.bounds);
    const tileSize = finite(manifest.tileSize);
    if (tileSize <= 0 || !Array.isArray(manifest.tiles)) throw new Error('Imported city manifest has invalid tiles');
    const meshBackedParentIds = new Set((manifest.meshBackedParentIds || []).map(String));
    const terrain = terrainFromRaw(terrainRaw);
    const terrainHeight = (x, z) => sampleTerrain(terrain, x, z);
    // Underground centerlines are useful source data but are not a surface
    // visitors can drive on in this browser terrain.
    const allOverviewRoads = (overview.roads || []).flatMap(normalizeRoad).filter((road) => !isTunnel(road.mode));
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
    const laneConnectorIndex = spatialIndex(120);
    for (const road of allOverviewRoads) roadIndex.add(road, {
      minX: Math.min(road.x1, road.x2) - road.width, maxX: Math.max(road.x1, road.x2) + road.width,
      minZ: Math.min(road.z1, road.z2) - road.width, maxZ: Math.max(road.z1, road.z2) + road.width
    });
    const districts = (overview.districts || []).map((district) => ({
      id: district.id, name: typeof district.name === 'string' ? district.name : district.name && district.name.text || '',
      kind: district.kind || '', polygon: Array.isArray(district.polygon) ? district.polygon
        .map((p) => [finite(p[0], NaN), finite(p[1], NaN)]).filter((p) => p.every(Number.isFinite)) : []
    })).filter((district) => district.polygon.length >= 3);
    const trafficLights = (options.trafficLights?.lights || []).filter((light) =>
      light && Array.isArray(light.position) && light.position.length === 3 &&
      light.position.every(Number.isFinite)).map((light) => ({
      nodeId: light.nodeId, position: light.position, active: !!light.active }));
    const map = { source: 'CSLModernMap', imported: true, manifest, bounds, detailBounds, worldBounds, focus, edge, tileSize, terrain,
      roadHalfWidth, overviewRoads, networkRoads: allOverviewRoads, stops, routeSamples, buildings: [], roadSegments: [],
      highwaySegments: [], guardrails: [], supports: [], laneConnectors: [], trafficLights, districts, terrainHeight };
    map.snapToRoad = (x, z) => {
      const normal = (road) => !isElevated(road.mode) && !isMotorway(road);
      const match = closestRoad(x, z, detailedRoads, normal) || closestRoad(x, z, detailedRoads);
      if (!match) return null;
      const road = match.road, t = match.t;
      return {
        x: road.x1 + (road.x2 - road.x1) * t,
        y: road.y1 + (road.y2 - road.y1) * t,
        z: road.z1 + (road.z2 - road.z1) * t,
        heading: Math.atan2(road.x2 - road.x1, road.z2 - road.z1) + (t > .5 ? Math.PI : 0),
        roadWidth: road.width, roadId: road.id, distance: match.distance
      };
    };
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
    map.nearbyLaneConnectors = (x, z, radius = 100) => laneConnectorIndex.query(x, z, radius).filter((connector) =>
      connector.bounds.maxX >= x - radius && connector.bounds.minX <= x + radius &&
      connector.bounds.maxZ >= z - radius && connector.bounds.minZ <= z + radius);
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
      const graph = manifest.laneGraph;
      const graphTiles = new Map((Array.isArray(graph?.tiles) ? graph.tiles : [])
        .filter((tile) => Number.isInteger(tile?.ix) && Number.isInteger(tile?.iz))
        .map((tile) => [key(tile.ix, tile.iz), tile]));
      const graphFields = { edgeLanes: graph?.edgeFields, connectors: graph?.connectorFields };
      function decodeLaneTile(raw, kind, ix, iz) {
        if (!raw) return [];
        if (raw.format !== 'drive-city-lane-tile-v1' || raw.kind !== kind || raw.ix !== ix || raw.iz !== iz ||
            !Array.isArray(raw.items) || !Array.isArray(graphFields[kind])) {
          console.warn('Imported city ' + kind + ' tile has an unsupported format:', ix, iz);
          return [];
        }
        const fields = graphFields[kind];
        return raw.items.filter((item) => Array.isArray(item) && item.length === fields.length)
          .map((item) => Object.fromEntries(fields.map((field, index) => [field, item[index]])))
          .filter((item) => validLaneCurve(item.curve));
      }
      async function loadLanePart(info, kind) {
        const file = info?.[kind]?.file;
        if (!file) return null;
        try { return await loadJson(resolve(base, file)); }
        catch (error) {
          console.warn('City lane graph tile could not load:', file, error);
          return null;
        }
      }
      function prepareConnector(connector, ix, iz) {
        if (connector.forbidden || connector.path_methods_bits != null &&
            !(Number(connector.path_methods_bits) & 2)) return false;
        const midpoint = cubicPoint(connector.curve, .5);
        if (Math.floor(midpoint[0] / tileSize) !== ix || Math.floor(midpoint[2] / tileSize) !== iz)
          return false;
        connector.samples = sampleLaneConnector(connector, terrainHeight);
        if (connector.samples.length < 2) return false;
        const reach = clamp(finite(connector.width_m, 3), 1.5, 9) / 2 + 2;
        connector.bounds = {
          minX: Math.min(...connector.samples.map((p) => p.x)) - reach,
          maxX: Math.max(...connector.samples.map((p) => p.x)) + reach,
          minZ: Math.min(...connector.samples.map((p) => p.z)) - reach,
          maxZ: Math.max(...connector.samples.map((p) => p.z)) + reach
        };
        return true;
      }
      function gradeMergeConnectors(connectors, owned, roads) {
        if (!owned.length || !roads.length) return;
        const roadsById = new Map(), byNode = new Map();
        for (const road of roads) {
          const id = String(road.id);
          if (!roadsById.has(id)) roadsById.set(id, []);
          roadsById.get(id).push(road);
        }
        for (const connector of connectors) {
          if (connector.forbidden || connector.path_methods_bits != null &&
              !(Number(connector.path_methods_bits) & 2)) continue;
          const id = String(connector.node_id);
          if (!byNode.has(id)) byNode.set(id, { from: new Set(), to: new Set() });
          byNode.get(id).from.add(String(connector.from_edge_id));
          byNode.get(id).to.add(String(connector.to_edge_id));
        }
        for (const connector of owned) {
          const node = byNode.get(String(connector.node_id));
          if (!node || !(node.from.size >= 2 && node.to.size === 1 ||
              node.from.size === 1 && node.to.size >= 2)) continue;
          const first = connector.curve[0], last = connector.curve[3];
          const source = roadDeckAt(roadsById.get(String(connector.from_edge_id)), first[0], first[2]);
          const target = roadDeckAt(roadsById.get(String(connector.to_edge_id)), last[0], last[2]);
          // Native lane elevations can differ several metres from the road
          // mesh at a graded merge. Match both mouths to the rendered deck,
          // preserving the source curves for lane identity and paint layout.
          const delta0 = source !== null && Math.abs(source - first[1]) <= 6 ? source - first[1] : 0;
          const delta1 = target !== null && Math.abs(target - last[1]) <= 6 ? target - last[1] : 0;
          if (Math.abs(delta0) < .01 && Math.abs(delta1) < .01) continue;
          const length = connector.samples.length - 1;
          for (let i = 0; i <= length; i++) {
            const sample = connector.samples[i], t = i / length;
            sample.sourceY += delta0 * (1 - t) + delta1 * t;
            sample.y = Math.max(sample.sourceY + .08, terrainHeight(sample.x, sample.z) + .095);
          }
        }
      }
      const endpointCells = new Map();
      for (const feature of overview.roads || []) {
        if (!Array.isArray(feature.points) || feature.points.length < 2 || isTunnel(feature.mode)) continue;
        for (const raw of [feature.points[0], feature.points[feature.points.length - 1]]) {
          const [x, y, z] = point(raw), cell = key(Math.floor(x / 3), Math.floor(z / 3));
          if (!endpointCells.has(cell)) endpointCells.set(cell, []);
          endpointCells.get(cell).push({ x, y, z, id: String(feature.id) });
        }
      }
      function branchNodeAt(x, y, z) {
        const ix = Math.floor(x / 3), iz = Math.floor(z / 3), roads = new Set();
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
          for (const end of endpointCells.get(key(ix + dx, iz + dz)) || [])
            if (Math.hypot(end.x - x, end.z - z) < 1.8 && Math.abs(end.y - y) < 2.5)
              roads.add(end.id);
        return roads.size >= 3;
      }
      const branchNodesByRoad = new Map();
      for (const feature of overview.roads || []) {
        if (!Array.isArray(feature.points) || feature.points.length < 2) continue;
        for (const raw of [feature.points[0], feature.points[feature.points.length - 1]]) {
          const [x, y, z] = point(raw);
          if (!branchNodeAt(x, y, z)) continue;
          const id = String(feature.id);
          if (!branchNodesByRoad.has(id)) branchNodesByRoad.set(id, []);
          branchNodesByRoad.get(id).push({x, y, z});
        }
      }
      function roadBounds(road) {
        return { minX: Math.min(road.x1, road.x2) - road.width, maxX: Math.max(road.x1, road.x2) + road.width,
          minZ: Math.min(road.z1, road.z2) - road.width, maxZ: Math.max(road.z1, road.z2) + road.width };
      }
      function generateBridgeParts(road) {
        const dx = road.x2 - road.x1, dz = road.z2 - road.z1, dy = road.y2 - road.y1;
        const horizontal = Math.hypot(dx, dz), slopeLength = Math.hypot(horizontal, dy);
        const yaw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, horizontal);
        const centerX = (road.x1 + road.x2) / 2, centerZ = (road.z1 + road.z2) / 2;
        const clearanceAt = (t) => {
          const x = road.x1 + dx * t, z = road.z1 + dz * t;
          return road.y1 + dy * t - terrainHeight(x, z);
        };
        const firstClearance = clearanceAt(0), lastClearance = clearanceAt(1);
        // Rails begin where the ramp has room for a barrier. Keep the deck
        // continuous through the ground-to-elevated transition instead of
        // cutting its entire segment at an arbitrary clearance threshold.
        let railStart = 0, railEnd = 1;
        const barrierClearance = 2.5;
        if (firstClearance < barrierClearance && lastClearance < barrierClearance) railEnd = 0;
        else if (firstClearance < barrierClearance && lastClearance >= barrierClearance)
          railStart = clamp((barrierClearance - firstClearance) / (lastClearance - firstClearance), 0, 1);
        else if (lastClearance < barrierClearance && firstClearance >= barrierClearance)
          railEnd = clamp((barrierClearance - firstClearance) / (lastClearance - firstClearance), 0, 1);
        for (const node of branchNodesByRoad.get(String(road.id)) || []) {
          const d0 = Math.hypot(road.x1 - node.x, road.z1 - node.z);
          const d1 = Math.hypot(road.x2 - node.x, road.z2 - node.z);
          if (Math.min(d0, d1) >= 6 ||
            Math.min(Math.abs(road.y1 - node.y), Math.abs(road.y2 - node.y)) >= 2.5) continue;
          if (d0 < 6 && d1 < 6) { railStart = 1; railEnd = 0; }
          else if (d0 < 6) railStart = Math.max(railStart, clamp((6 - d0) / (d1 - d0), 0, 1));
          else railEnd = Math.min(railEnd, clamp((d0 - 6) / (d0 - d1), 0, 1));
        }
        road.railStart = railStart;
        road.railEnd = railEnd;
        const rails = [];
        if ((railEnd - railStart) * horizontal > 2) {
          const mid = (railStart + railEnd) / 2, centerY = road.y1 + dy * mid;
          for (const side of [-1, 1]) rails.push({
            roadId: road.id,
            x: road.x1 + dx * mid + side * Math.cos(yaw) * (road.width / 2 - .22),
            y: centerY + .55 / Math.cos(pitch),
            z: road.z1 + dz * mid - side * Math.sin(yaw) * (road.width / 2 - .22),
            width: .24, height: 1.1, length: slopeLength * (railEnd - railStart), yaw, pitch
          });
        }
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
        for (const connector of data.ownedConnectors || []) {
          laneConnectorIndex.remove(connector);
          map.laneConnectors.splice(map.laneConnectors.indexOf(connector), 1);
        }
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
        // Mounting several dense building/junction tiles in one browser frame
        // can stall fast travel. Keep two fetch/decode jobs in flight.
        while (active < 2 && queue.length) {
          const job = queue.shift();
          active++;
          const descriptor = job.entry.descriptor;
          const laneTile = graphTiles.get(key(descriptor.ix, descriptor.iz));
          Promise.resolve().then(() => Promise.all([
            loadJson(resolve(base, descriptor.file)),
            loadLanePart(laneTile, 'edgeLanes'),
            loadLanePart(laneTile, 'connectors')
          ])).then(([raw, edgeRaw, connectorRaw]) => {
              if (!raw || raw.format !== 'drive-city-tile-v1') throw new Error('Imported city tile has an unsupported format');
              const tileEdgeLanes = decodeLaneTile(edgeRaw, 'edgeLanes', descriptor.ix, descriptor.iz);
              const tileConnectors = decodeLaneTile(connectorRaw, 'connectors', descriptor.ix, descriptor.iz);
              const ownedConnectors = tileConnectors.filter((connector) =>
                prepareConnector(connector, descriptor.ix, descriptor.iz));
              const tileRoads = [], tileHighways = [], tileBuildings = [], tileRails = [], tileSupports = [];
              for (const feature of raw.features || []) {
                if (!feature || !feature.type) continue;
                if (feature.type === 'road') for (const road of normalizeRoad(feature)) {
                  if (isTunnel(road.mode)) continue;
                  // Keep every source-elevated road in one continuous deck.
                  // Segment-by-segment clearance classification cut ramps at
                  // the first 2.5 m of lift, leaving a visible slab end.
                  if (isElevated(road.mode)) {
                    const slab = { ...road, topStart: road.y1, topEnd: road.y2 };
                    tileHighways.push(slab);
                    const parts = generateBridgeParts(slab);
                    tileRails.push(...parts.rails); tileSupports.push(...parts.supports);
                  } else tileRoads.push(road);
                }
                if (feature.type === 'building') {
                  const building = normalizeBuilding(feature, terrainHeight, meshBackedParentIds);
                  if (building) {
                    tileBuildings.push(building);
                    tileBuildings.push(...airportTerminalBuildings(building, terrainHeight, meshBackedParentIds));
                  }
                }
              }
              gradeMergeConnectors(tileConnectors, ownedConnectors, [...tileRoads, ...tileHighways]);
              job.entry.data = { ix: job.entry.descriptor.ix, iz: job.entry.descriptor.iz,
                roads: tileRoads, highways: tileHighways, buildings: tileBuildings,
                guardrails: tileRails, supports: tileSupports,
                edgeLanes: tileEdgeLanes, connectors: tileConnectors, ownedConnectors };
              job.entry.state = 'loaded';
              for (const connector of ownedConnectors) {
                map.laneConnectors.push(connector);
                laneConnectorIndex.add(connector, connector.bounds);
              }
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
      // Keep regenerated map tiles fresh on static hosts while fixture fetches
      // continue to use their exact in-memory paths.
      const requestPath = options.fetch ? path : path + (path.includes('?') ? '&' : '?') + 'v=5';
      const response = await requester(requestPath);
      if (!response || !response.ok) throw new Error('Could not load imported city asset: ' + path);
      return response.json();
    }
    const base = url.slice(0, url.lastIndexOf('/') + 1);
    const manifest = await getJson(url);
    if (!manifest || manifest.format !== 'drive-city-v1') throw new Error('Imported city manifest has an unsupported format');
    const [overview, terrain, trafficLights] = await Promise.all([
      getJson(resolve(base, manifest.overview && manifest.overview.file || 'overview.json')),
      getJson(resolve(base, manifest.terrain && manifest.terrain.file || 'terrain.json')),
      manifest.trafficLights?.file ? getJson(resolve(base, manifest.trafficLights.file))
        .catch((error) => { console.warn('City traffic lights could not load:', error); return null; }) : null
    ]);
    const map = create(manifest, overview, terrain, { loadJson: getJson, baseUrl: base, trafficLights });
    const spawn = map.routeSamples[0];
    await map.ensureNear(spawn.x, spawn.z, Math.max(240, map.tileSize * 1.05));
    return map;
  }

  function build(THREE, world, map) {
    const mirrorGlyphs = world.scale.z < 0;
    const chunkRoot = new THREE.Group(), terrainRoot = new THREE.Group();
    chunkRoot.name = 'imported-city-tiles'; terrainRoot.name = 'imported-city-terrain';
    world.add(terrainRoot, chunkRoot);
    function asphaltTexture() {
      const size = 128, pixels = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const n = hash(x + ':' + y), grain = (n & 31) - 16;
        const streak = x % 23 < 3 ? -5 : 0;
        const speck = n % 79 === 0 ? 27 : 0;
        const shade = 76 + grain * .65 + streak + speck;
        const i = (y * size + x) * 4;
        pixels[i] = shade * .78; pixels[i + 1] = shade * .88;
        pixels[i + 2] = shade; pixels[i + 3] = 255;
      }
      const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.encoding = THREE.sRGBEncoding;
      texture.needsUpdate = true;
      return texture;
    }
    const asphalt = asphaltTexture();
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x8d9fb3, map: asphalt, bumpMap: asphalt,
      bumpScale: .045, metalness: .16, roughness: .68, side: THREE.DoubleSide });
    const highwayRoadMat = new THREE.MeshStandardMaterial({ color: 0xb7a69a, map: asphalt, bumpMap: asphalt,
      bumpScale: .045, metalness: .18, roughness: .65, side: THREE.DoubleSide });
    const elevatedMat = new THREE.MeshStandardMaterial({ color: 0x8799ae, map: asphalt, bumpMap: asphalt,
      bumpScale: .045, metalness: .2, roughness: .59, side: THREE.DoubleSide });
    function pavementTexture() {
      const size = 128, pixels = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const row = Math.floor(y / 16), joint = y % 16 < 2 || (x + (row % 2) * 8) % 32 < 2;
        const shade = 112 + (hash(x + ':p:' + y) % 17) - (joint ? 29 : 0);
        const i = (y * size + x) * 4;
        pixels[i] = shade * .84; pixels[i + 1] = shade * .94;
        pixels[i + 2] = shade; pixels[i + 3] = 255;
      }
      const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true; texture.encoding = THREE.sRGBEncoding;
      texture.needsUpdate = true;
      return texture;
    }
    const pavement = pavementTexture();
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xbcc8d3, map: pavement,
      bumpMap: pavement, bumpScale: .025, roughness: .89, metalness: .06, side: THREE.DoubleSide });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x8fa6b1, roughness: .79, side: THREE.DoubleSide });
    const whiteMarkingMat = new THREE.MeshBasicMaterial({ color: 0xe5e7dd, transparent: true,
      opacity: .88, depthWrite: false, side: THREE.DoubleSide });
    const yellowMarkingMat = new THREE.MeshBasicMaterial({ color: 0xe6b45f, transparent: true,
      opacity: .9, depthWrite: false, side: THREE.DoubleSide });
    function speedAtlasTexture() {
      // One atlas serves every streamed tile. Numeric labels come from the
      // exported car-lane limits, not guessed road-class defaults.
      const cell = 64, columns = 8, rows = 8, width = cell * columns;
      const pixels = new Uint8Array(width * cell * rows * 4);
      const digits = {
        '0': ['11111','10001','10011','10101','11001','10001','11111'],
        '1': ['00100','01100','00100','00100','00100','00100','01110'],
        '2': ['11111','00001','00001','11111','10000','10000','11111'],
        '3': ['11111','00001','00001','01111','00001','00001','11111'],
        '4': ['10001','10001','10001','11111','00001','00001','00001'],
        '5': ['11111','10000','10000','11111','00001','00001','11111'],
        '6': ['11111','10000','10000','11111','10001','10001','11111'],
        '7': ['11111','00001','00010','00100','01000','01000','01000'],
        '8': ['11111','10001','10001','11111','10001','10001','11111'],
        '9': ['11111','10001','10001','11111','00001','00001','11111']
      };
      const unit = {
        K: ['101','110','100','110','101'], M: ['101','111','111','101','101'],
        '/': ['001','001','010','100','100'], H: ['101','101','111','101','101']
      };
      function pixel(x, y, color) {
        const index = (y * width + x) * 4;
        pixels[index] = color[0]; pixels[index + 1] = color[1];
        pixels[index + 2] = color[2]; pixels[index + 3] = 255;
      }
      for (let slot = 0; slot < 64; slot++) {
        const x0 = slot % columns * cell, y0 = Math.floor(slot / columns) * cell;
        for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
          const border = x < 3 || x > 60 || y < 3 || y > 60;
          const rim = x < 9 || x > 54 || y < 9 || y > 54;
          pixel(x0 + x, y0 + y, border ? [29, 38, 50] :
            rim ? [194, 54, 67] : [242, 240, 226]);
        }
        const label = String((slot + 1) * 5);
        const scale = 3, glyph = 5 * scale, gap = 3;
        const textWidth = label.length * glyph + (label.length - 1) * gap;
        const left = Math.floor((cell - textWidth) / 2), top = 20;
        for (let index = 0; index < label.length; index++) {
          const rows = digits[label[index]];
          for (let row = 0; row < rows.length; row++) for (let column = 0; column < 5; column++) {
            if (rows[row][column] !== '1') continue;
            for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++)
              pixel(x0 + left + index * (glyph + gap) + column * scale + xx,
                y0 + cell - 1 - (top + row * scale + yy), [20, 35, 45]);
          }
        }
        for (let index = 0; index < 4; index++) {
          const rows = unit['KM/H'[index]], start = 17 + index * 8;
          for (let row = 0; row < 5; row++) for (let column = 0; column < 3; column++) {
            if (rows[row][column] !== '1') continue;
            for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++)
              pixel(x0 + start + column * 2 + xx,
                y0 + cell - 1 - (44 + row * 2 + yy), [42, 73, 91]);
          }
        }
      }
      const texture = new THREE.DataTexture(pixels, width, cell * rows, THREE.RGBAFormat);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.encoding = THREE.sRGBEncoding;
      texture.needsUpdate = true;
      return texture;
    }
    const speedAtlas = speedAtlasTexture();
    const speedSignMat = new THREE.MeshBasicMaterial({ map: speedAtlas, side: THREE.FrontSide });
    const speedSignBackMat = new THREE.MeshBasicMaterial({ color: 0x394a56, side: THREE.BackSide });
    const speedPostMat = new THREE.MeshStandardMaterial({ color: 0x536a78, metalness: .7,
      roughness: .4, side: THREE.DoubleSide });
    const airportSignTexture = signTexture('DEPARTURES', '#86e7f1');
    const airportSignMat = airportSignTexture ?
      new THREE.MeshBasicMaterial({ map: airportSignTexture, side: THREE.DoubleSide }) : null;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d4845, roughness: .95 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .93,
      emissive: 0x0d352d, emissiveIntensity: .12 });
    const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: .06, side: THREE.DoubleSide });
    const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .65, metalness: .28, side: THREE.DoubleSide });
    const bridgePartMat = new THREE.MeshStandardMaterial({ color: 0x58718c, metalness: .48,
      roughness: .43, side: THREE.DoubleSide });
    const districtMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide });
    const box = new THREE.BoxGeometry(1, 1, 1);
    const tileGroups = new Map(), terrainChunks = new Map();
    let disposed = false;

    // One small procedural atlas per architectural family keeps the tile meshes
    // merged while giving houses, factories and towers visibly different fronts.
    const facadeKinds = ['house', 'rowhouse', 'apartments', 'tower', 'storefront', 'gasstation',
      'glass', 'industrial', 'warehouse', 'office', 'officeTower', 'civic',
      'campus', 'hospital', 'castle', 'airport'];
    const facadeVariants = 4;
    const facadeBase = {
      house: [210, 206, 193], rowhouse: [187, 161, 145], apartments: [179, 185, 193],
      tower: [132, 161, 184], storefront: [180, 172, 185], gasstation: [186, 202, 198],
      glass: [116, 166, 204], industrial: [153, 166, 166], warehouse: [135, 153, 162],
      office: [169, 175, 183], officeTower: [106, 130, 152],
      civic: [198, 190, 176], campus: [174, 132, 115],
      hospital: [212, 225, 228], castle: [154, 157, 154], airport: [129, 176, 198]
    };
    function facadeTextures(kind, variant) {
      const width = 96, height = 128, pixels = new Uint8Array(width * height * 4);
      const glow = new Uint8Array(width * height * 4), base = facadeBase[kind];
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const bayX = Math.floor(x / 24), bayY = Math.floor(y / 32), px = x % 24, py = y % 32;
        const lit = hash(kind + ':' + variant + ':' + bayX + ':' + bayY) %
          (kind === 'glass' || kind === 'tower' || kind === 'officeTower' ? 5 : 9) < 3;
        const glassWindow = variant === 0 ? px > 3 && px < 21 && py > 3 && py < 29 :
          variant === 1 ? (px > 4 && px < 10 || px > 14 && px < 20) && py > 4 && py < 28 :
          variant === 2 ? px > 2 && px < 22 && (py > 4 && py < 14 || py > 19 && py < 28) :
          px > 7 && px < 17 && py > 4 && py < 28 && bayX % 3 !== 1;
        const window = kind === 'industrial' ? px > 4 && px < 20 && py > 19 && py < 27 && bayY % 2 === 0 :
          kind === 'warehouse' ? px > 3 && px < 21 && (py > 21 && py < 28 ||
            py > 3 && py < 19 && bayY % 2 === 0 && bayX % 2 === 0) :
          kind === 'gasstation' ? px > 2 && px < 22 && py > 7 && py < 25 && bayY % 2 === 0 :
          kind === 'office' ? px > 2 && px < 22 && py > 8 && py < 26 && bayX % 3 !== variant % 3 :
          kind === 'officeTower' ? glassWindow && bayX % 2 !== variant % 2 :
          kind === 'castle' ? px > 10 && px < 14 && py > 9 && py < 27 && bayX % 2 === 0 :
          kind === 'airport' ? px > 2 && px < 22 && py > 5 && py < 28 :
          kind === 'hospital' ? px > 3 && px < 21 && py > 7 && py < 25 && bayX % 2 === 0 :
          kind === 'campus' ? px > 6 && px < 18 && py > 6 && py < 27 :
          kind === 'glass' || kind === 'tower' ? glassWindow :
          kind === 'house' ? px > 5 && px < 19 && py > (variant === 1 ? 12 : 9) && py < 25 && (variant !== 2 || bayX % 3 !== 2) :
          variant === 2 ? px > 3 && px < 21 && py > 10 && py < 24 :
          px > (variant === 1 ? 7 : 5) && px < (variant === 1 ? 17 : 19) && py > 7 && py < 27;
        const mullion = window && (px === 12 || py === 17 && kind !== 'glass');
        const brick = (kind === 'rowhouse' || kind === 'civic' || kind === 'campus' || kind === 'castle') &&
          (py % (variant === 1 ? 6 : 8) === 0 || px % 12 === 0 && Math.floor(py / 8) % 2 === 0);
        const siding = kind === 'house' && py % 5 === 0;
        const corrugated = (kind === 'industrial' || kind === 'warehouse') && px % 4 === 0;
        const glowColor = kind === 'glass' || kind === 'tower' || kind === 'officeTower' ?
          [[103, 224, 242], [255, 197, 117], [230, 112, 191], [180, 218, 229]][variant] :
          kind === 'airport' ? [103, 224, 242] :
          kind === 'gasstation' ? [255, 164, 95] : [255, 206, 145];
        let rgb = window ? (lit ? glowColor : [27, 47, 67]) :
          base.map((channel) => channel - (brick ? 30 : siding ? 18 : corrugated ? 24 : 0) + (variant - 1) * 7);
        if (mullion || px === 0 || py === 0) rgb = base.map((channel) => Math.round(channel * .43));
        const i = (y * width + x) * 4;
        pixels[i] = rgb[0]; pixels[i + 1] = rgb[1]; pixels[i + 2] = rgb[2]; pixels[i + 3] = 255;
        const light = window && lit && !mullion;
        glow[i] = light ? rgb[0] : 0; glow[i + 1] = light ? rgb[1] : 0;
        glow[i + 2] = light ? rgb[2] : 0; glow[i + 3] = 255;
      }
      function texture(data) {
        const result = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
        result.wrapS = result.wrapT = THREE.RepeatWrapping;
        result.magFilter = THREE.LinearFilter;
        result.minFilter = THREE.LinearMipmapLinearFilter;
        result.generateMipmaps = true; result.encoding = THREE.sRGBEncoding; result.needsUpdate = true;
        return result;
      }
      return { color: texture(pixels), glow: texture(glow) };
    }
    const wallMaterials = Object.create(null);
    function wallMaterial(kind, variant) {
      const key = kind + ':' + variant;
      if (wallMaterials[key]) return wallMaterials[key];
      const atlas = facadeTextures(kind, variant);
      return wallMaterials[key] = new THREE.MeshStandardMaterial({ color: 0xffffff, map: atlas.color,
        emissive: 0xffffff, emissiveMap: atlas.glow,
        emissiveIntensity: kind === 'glass' || kind === 'tower' || kind === 'officeTower' ?
          [.6, .43, .58, .3][variant] : .48,
        vertexColors: true, roughness: kind === 'glass' || kind === 'officeTower' ? .25 :
          kind === 'industrial' || kind === 'warehouse' ? .77 : .58,
        metalness: kind === 'glass' || kind === 'officeTower' ? .55 :
          kind === 'industrial' || kind === 'warehouse' ? .2 : .12, side: THREE.DoubleSide });
    }
    const buildingTrimMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
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
    function worldUvQuad(out, a, b, c, d) {
      for (const point of [a, b, c, a, c, d]) out.push(point[0] / 5, point[2] / 5);
    }
    function roadStrip(out, road, halfWidth, yOffset, uvs, followTerrain = false,
      centerOffset = 0, start = 0, end = 1, maxStep = 10, worldUV = false) {
      const dx = road.x2 - road.x1, dz = road.z2 - road.z1, length = Math.hypot(dx, dz);
      if (length < .1 || end - start < .00001) return;
      const nx = dz / length, nz = -dx / length;
      const steps = followTerrain ? Math.max(1, Math.ceil(length * (end - start) / maxStep)) : 1;
      const phase = (road.x1 * dx + road.z1 * dz) / length / 5;
      function gridSurface(target, t, offset) {
        for (const grid of target.surfaceGrids || []) {
          if (t < grid.start - .00001 || t > grid.end + .00001) continue;
          const row = clamp((t - grid.start) / (grid.end - grid.start) * grid.steps, 0, grid.steps);
          const column = clamp((1 - (offset - grid.centerOffset) / grid.halfWidth) * .5 * grid.columns,
            0, grid.columns);
          const r = Math.min(grid.steps - 1, Math.floor(row)), c = Math.min(grid.columns - 1, Math.floor(column));
          const fr = row - r, fc = column - c, stride = grid.columns + 1;
          const a = grid.heights[r * stride + c], b = grid.heights[(r + 1) * stride + c];
          const d = grid.heights[r * stride + c + 1], corner = grid.heights[(r + 1) * stride + c + 1];
          return fr >= fc ? a * (1 - fr) + b * (fr - fc) + corner * fc :
            a * (1 - fc) + d * (fc - fr) + corner * fr;
        }
        return -Infinity;
      }
      function carriageSurface(t, offset, x, z) {
        let highest = gridSurface(road, t, offset);
        if (t > .2 && t < .8) return highest;
        for (const adjacent of road.surfaceNeighbors || []) {
          const ax = adjacent.x2 - adjacent.x1, az = adjacent.z2 - adjacent.z1;
          const lengthSquared = ax * ax + az * az;
          if (lengthSquared < .01) continue;
          const raw = ((x - adjacent.x1) * ax + (z - adjacent.z1) * az) / lengthSquared;
          if (raw < -.03 || raw > 1.03) continue;
          const position = clamp(raw, 0, 1);
          const baseX = adjacent.x1 + ax * position, baseZ = adjacent.z1 + az * position;
          const first = adjacent.startMiter || [az / Math.sqrt(lengthSquared), -ax / Math.sqrt(lengthSquared)];
          const last = adjacent.endMiter || first;
          const mx = first[0] * (1 - position) + last[0] * position;
          const mz = first[1] * (1 - position) + last[1] * position;
          const side = ((x - baseX) * mx + (z - baseZ) * mz) / (mx * mx + mz * mz || 1);
          if (Math.abs(side) > adjacent.width / 2 + .5) continue;
          highest = Math.max(highest, gridSurface(adjacent, position, side));
        }
        return highest;
      }
      function vertex(t, side) {
        const offset = centerOffset + halfWidth * side;
        const first = road.startMiter || [nx, nz], last = road.endMiter || [nx, nz];
        const x = road.x1 + dx * t + (first[0] * (1 - t) + last[0] * t) * offset;
        const z = road.z1 + dz * t + (first[1] * (1 - t) + last[1] * t) * offset;
        const sourceY = road.y1 + (road.y2 - road.y1) * t;
        // Coarse terrain samples can bury the source centerline. Sample both
        // road edges and subdivide long spans so asphalt remains visible.
        const surfaceY = followTerrain ? Math.max(sourceY, map.terrainHeight(x, z)) : sourceY;
        const roadY = yOffset >= .09 && yOffset < .14 ? carriageSurface(t, offset, x, z) : -Infinity;
        return [x, Math.max(surfaceY + yOffset, roadY + .045), z];
      }
      if (followTerrain && maxStep <= 5) {
        // Junction approaches can cross a steep terrain-cell diagonal across
        // their width. Sample a two-dimensional ribbon, not only its edges.
        const columns = Math.max(1, Math.ceil(halfWidth * 2 / (maxStep <= 2 ? 2.5 : 4)));
        const vertices = [], faces = [], rowLength = columns + 1;
        for (let row = 0; row <= steps; row++) {
          const t = start + (end - start) * row / steps;
          for (let column = 0; column <= columns; column++) {
            const side = 1 - 2 * column / columns;
            const p = vertex(t, side);
            vertices.push([p[0], p[1], p[2],
              worldUV ? p[0] / 5 : halfWidth * 2 / 5 * column / columns,
              worldUV ? p[2] / 5 : phase + length * t / 5,
              t, centerOffset + halfWidth * side]);
          }
        }
        for (let row = 0; row < steps; row++) for (let column = 0; column < columns; column++) {
          const a = row * rowLength + column, b = a + rowLength;
          const c = b + 1, d = a + 1;
          faces.push([a, c, b], [a, d, c]);
        }
        const probes = [[1 / 3, 1 / 3, 1 / 3], [.6, .2, .2], [.2, .6, .2],
          [.2, .2, .6], [.5, .5, 0], [0, .5, .5], [.5, 0, .5]];
        for (const indices of faces) {
          const points = indices.map((index) => vertices[index]);
          let lift = 0;
          for (const weights of probes) {
            const x = points.reduce((sum, p, index) => sum + p[0] * weights[index], 0);
            const z = points.reduce((sum, p, index) => sum + p[2] * weights[index], 0);
            const y = points.reduce((sum, p, index) => sum + p[1] * weights[index], 0);
            lift = Math.max(lift, map.terrainHeight(x, z) + .075 - y);
            if (yOffset >= .09 && yOffset < .14 && road.surfaceGrids?.length) {
              const t = points.reduce((sum, p, index) => sum + p[5] * weights[index], 0);
              const lateral = points.reduce((sum, p, index) => sum + p[6] * weights[index], 0);
              lift = Math.max(lift, carriageSurface(t, lateral, x, z) + .045 - y);
            }
          }
          if (lift > 0) for (const index of indices) vertices[index][1] += lift;
        }
        for (const indices of faces) {
          const [a, b, c] = indices.map((index) => vertices[index]);
          triangle(out, a.slice(0, 3), b.slice(0, 3), c.slice(0, 3));
          if (uvs) uvs.push(a[3], a[4], b[3], b[4], c[3], c[4]);
        }
        if (maxStep === 5 && yOffset === .06) {
          if (!road.surfaceGrids) road.surfaceGrids = [];
          road.surfaceGrids.push({ start, end, steps, columns, halfWidth, centerOffset,
            heights: vertices.map((p) => p[1]) });
        }
        return;
      }
      for (let step = 0; step < steps; step++) {
        const t0 = start + (end - start) * step / steps;
        const t1 = start + (end - start) * (step + 1) / steps;
        const a = vertex(t0, 1), b = vertex(t1, 1), c = vertex(t1, -1), d = vertex(t0, -1);
        triangle(out, a, c, b); triangle(out, a, d, c);
        if (uvs) {
          if (worldUV) uvs.push(a[0] / 5, a[2] / 5, c[0] / 5, c[2] / 5,
            b[0] / 5, b[2] / 5, a[0] / 5, a[2] / 5,
            d[0] / 5, d[2] / 5, c[0] / 5, c[2] / 5);
          else {
            const u = halfWidth * 2 / 5, v0 = phase + length * t0 / 5, v1 = phase + length * t1 / 5;
            uvs.push(0, v0, u, v1, 0, v1, 0, v0, u, v0, u, v1);
          }
        }
      }
    }
    function roadLayout(road) {
      const half = road.width / 2;
      let lanes = (road.laneDetails || []).map((lane) => ({
        // TrafficExport measures from the road's left normal (-dz, +dx);
        // roadStrip uses the opposite (+dz, -dx) normal.
        position: -Number(lane.position), width: Number(lane.width),
        direction: String(lane.direction || ''), speed: Number(lane.speed)
      })).filter((lane) => Number.isFinite(lane.position) && Number.isFinite(lane.width) &&
        lane.width > .5 && lane.width < 8 && Math.abs(lane.position) < half + 8);
      if (!lanes.length) {
        const count = clamp(Math.round(finite(road.lanes?.car_lane_count, Math.max(1, Math.round(road.width / 4)))), 1, 8);
        const width = Math.min(3.5, road.width / count);
        const flow = road.trafficFlow ||
          (Number(road.lanes?.direction) === 2 ? 'backward-only' :
            Number(road.lanes?.direction) === 0 ? 'two-way' : 'forward-only');
        lanes = Array.from({ length: count }, (_, index) => ({
          position: (index + .5 - count / 2) * width, width,
          direction: flow === 'backward-only' ||
            flow === 'two-way' && index >= Math.floor(count / 2) ? 'Backward' : 'Forward',
          speed: NaN
        }));
      }
      lanes.sort((a, b) => a.position - b.position);
      const laneMin = Math.min(...lanes.map((lane) => lane.position - lane.width / 2));
      const laneMax = Math.max(...lanes.map((lane) => lane.position + lane.width / 2));
      const highway = isMotorway(road);
      const directions = new Set(lanes.map((lane) => lane.direction.toLowerCase()).filter((direction) =>
        direction === 'forward' || direction === 'backward'));
      const oneWay = road.trafficFlow === 'forward-only' || road.trafficFlow === 'backward-only' ||
        road.trafficFlow !== 'two-way' && directions.size === 1;
      const carriageMin = highway ? -half : clamp(laneMin - .3, -half, half - 1);
      const carriageMax = highway ? half : clamp(laneMax + .3, carriageMin + 1, half);
      return { lanes, highway, oneWay, carriageMin, carriageMax,
        leftWalk: Math.max(0, carriageMin + half), rightWalk: Math.max(0, half - carriageMax) };
    }
    function dashStripe(out, road, offset, halfWidth, yOffset, followTerrain,
      start = 0, end = 1, maxStep = 10) {
      const length = Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
      if (length < .1) return;
      const phase = hash(String(road.id) + ':marking') % 8;
      const pathStart = finite(road.pathDistance);
      for (let distance = -((pathStart + phase) % 8); distance < length; distance += 8) {
        const from = Math.max(length * start, distance), to = Math.min(length * end, distance + 4);
        if (to - from > .7) roadStrip(out, road, halfWidth, yOffset, null, followTerrain,
          offset, from / length, to / length, maxStep);
      }
    }
    function markRoad(outWhite, outYellow, road, layout, followTerrain, intervals = [[0, 1]]) {
      const lanes = layout.lanes;
      const markStep = road.surfaceGrids?.length ? 2 : 10;
      const leftEdge = lanes[0].position - lanes[0].width / 2;
      const rightEdge = lanes[lanes.length - 1].position + lanes[lanes.length - 1].width / 2;
      for (const [start, end] of intervals) {
        roadStrip(outWhite, road, .09, followTerrain ? .096 : .055, null, followTerrain, leftEdge - .13, start, end, markStep);
        roadStrip(outWhite, road, .09, followTerrain ? .096 : .055, null, followTerrain, rightEdge + .13, start, end, markStep);
        for (let index = 0; index < lanes.length - 1; index++) {
          const a = lanes[index], b = lanes[index + 1];
          const boundary = (a.position + a.width / 2 + b.position - b.width / 2) / 2;
          if (a.direction !== b.direction && a.direction && b.direction) {
            roadStrip(outYellow, road, .065, followTerrain ? .101 : .06, null, followTerrain, boundary - .13, start, end, markStep);
            roadStrip(outYellow, road, .065, followTerrain ? .101 : .06, null, followTerrain, boundary + .13, start, end, markStep);
          } else dashStripe(outWhite, road, boundary, .085, followTerrain ? .096 : .055, followTerrain, start, end, markStep);
        }
      }
    }
    function roadPaintPoint(road, t, offset) {
      // Match the asphalt's sampled height instead of putting a flat decal
      // across a ramp or a curved road's terrain-lifted triangles.
      const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
      const length = Math.hypot(dx, dz) || 1;
      const first = road.startMiter || [dz / length, -dx / length];
      const last = road.endMiter || [dz / length, -dx / length];
      const sideX = first[0] * (1 - t) + last[0] * t;
      const sideZ = first[1] * (1 - t) + last[1] * t;
      const x = road.x1 + dx * t + sideX * offset;
      const z = road.z1 + dz * t + sideZ * offset;
      const sourceY = road.y1 + (road.y2 - road.y1) * t;
      let surfaceY = -Infinity;
      for (const grid of road.surfaceGrids || []) {
        if (t < grid.start - .00001 || t > grid.end + .00001) continue;
        const row = clamp((t - grid.start) / (grid.end - grid.start) * grid.steps, 0, grid.steps);
        const column = clamp((1 - (offset - grid.centerOffset) / grid.halfWidth) * .5 * grid.columns,
          0, grid.columns);
        const r = Math.min(grid.steps - 1, Math.floor(row));
        const c = Math.min(grid.columns - 1, Math.floor(column));
        const fr = row - r, fc = column - c, stride = grid.columns + 1;
        const a = grid.heights[r * stride + c], b = grid.heights[(r + 1) * stride + c];
        const d = grid.heights[r * stride + c + 1], corner = grid.heights[(r + 1) * stride + c + 1];
        surfaceY = Math.max(surfaceY, fr >= fc ? a * (1 - fr) + b * (fr - fc) + corner * fc :
          a * (1 - fc) + d * (fc - fr) + corner * fr);
      }
      return [x, Math.max(Math.max(sourceY, map.terrainHeight(x, z)) + .115, surfaceY + .055), z];
    }
    function addDirectionArrows(out, records, entries) {
      // An exported curve can have more than a hundred one-metre samples.
      // Place paint along the source road's cumulative distance instead of
      // requiring any one normalized segment to hold an entire arrow.
      const roads = new Map();
      for (const entry of entries) {
        const { road, layout, intervals } = entry;
        if (!layout.highway && !layout.oneWay) continue;
        const length = Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
        if (length < .1 || !intervals.length) continue;
        const source = `${road.id}:${road.part ?? 0}:${road.mode}`;
        if (!roads.has(source)) roads.set(source, []);
        roads.get(source).push({ road, layout, intervals, length,
          start: finite(road.pathDistance), end: finite(road.pathDistance) + length });
      }
      for (const segments of roads.values()) {
        segments.sort((a, b) => a.start - b.start);
        const firstRoad = segments[0].road, firstLayout = segments[0].layout;
        const lanesByDirection = new Map();
        for (const lane of firstLayout.lanes) {
          const direction = /^backward$/i.test(lane.direction) ? 'Backward' :
            /^forward$/i.test(lane.direction) ? 'Forward' : null;
          if (!direction) continue;
          if (!lanesByDirection.has(direction)) lanesByDirection.set(direction, []);
          lanesByDirection.get(direction).push(lane);
        }
        const paintable = segments.flatMap((segment) => segment.intervals.map(([start, end]) =>
          [segment.start + start * segment.length, segment.start + end * segment.length]));
        paintable.sort((a, b) => a[0] - b[0]);
        const runs = [];
        for (const [start, end] of paintable) {
          const previous = runs[runs.length - 1];
          if (previous && start <= previous[1] + .02) previous[1] = Math.max(previous[1], end);
          else runs.push([start, end]);
        }
        function sample(distance, lateral) {
          const piece = segments.find((segment) =>
            distance >= segment.start - .0001 && distance <= segment.end + .0001);
          return piece ? roadPaintPoint(piece.road,
            clamp((distance - piece.start) / piece.length, 0, 1), lateral) : null;
        }
        for (const [direction, lanes] of lanesByDirection) {
          const lane = lanes[Math.floor(lanes.length / 2)];
          const travel = direction === 'Forward' ? 1 : -1;
          const spacing = firstLayout.highway ? 78 : 55;
          const phase = hash(String(firstRoad.id) + ':arrow:' + direction) % spacing;
          function paint(distance) {
            const point = (along, lateral) => sample(distance + travel * along,
              lane.position + lateral);
            const shaft = [point(-1.55, -.17), point(.45, -.17),
              point(.45, .17), point(-1.55, .17)];
            const head = [point(.2, -.8), point(1.9, 0), point(.2, .8)];
            const center = sample(distance, lane.position);
            if (!center || shaft.some((vertex) => !vertex) || head.some((vertex) => !vertex)) return false;
            quad(out, ...shaft);
            triangle(out, ...head);
            records.push({ roadId: String(firstRoad.id), direction, x: center[0], z: center[2] });
            return true;
          }
          for (const [start, end] of runs) {
            const margin = 3.2;
            if (end - start < margin * 2 + 3) continue;
            let painted = 0;
            const first = Math.ceil((start + margin - phase) / spacing) * spacing + phase;
            for (let distance = first; distance <= end - margin; distance += spacing)
              if (paint(distance)) painted++;
            // A short ramp or connector may fall between cadence points.
            if (!painted && end - start >= 14) paint((start + end) / 2);
          }
        }
      }
    }
    function bezierPoint(curve, t) {
      const u = 1 - t, a = u * u * u, b = 3 * u * u * t;
      const c = 3 * u * t * t, d = t * t * t;
      return [0, 1, 2].map(i => a * curve[0][i] + b * curve[1][i] +
        c * curve[2][i] + d * curve[3][i]);
    }
    function bezierTangent(curve, t) {
      const u = 1 - t;
      return [0, 1, 2].map(i => 3 * (u * u * (curve[1][i] - curve[0][i]) +
        2 * u * t * (curve[2][i] - curve[1][i]) + t * t * (curve[3][i] - curve[2][i])));
    }
    function laneTurn(source, target, connector) {
      const incoming = bezierTangent(source?.curve || connector.curve, source ? 1 : 0);
      const outgoing = bezierTangent(target?.curve || connector.curve, target ? 0 : 1);
      const al = Math.hypot(incoming[0], incoming[2]), bl = Math.hypot(outgoing[0], outgoing[2]);
      if (al < .01 || bl < .01) return 'straight';
      const dot = clamp((incoming[0] * outgoing[0] + incoming[2] * outgoing[2]) / (al * bl), -1, 1);
      const angle = Math.acos(dot);
      if (angle < Math.PI / 7) return 'straight';
      if (angle > Math.PI * .78) return 'uturn';
      // In the city map's X/Z plane, turning from +X toward +Z is left.
      return incoming[0] * outgoing[2] - incoming[2] * outgoing[0] > 0 ? 'left' : 'right';
    }
    function beforeLaneEnd(curve, distance) {
      const samples = 24, lengths = [0];
      let previous = curve[0];
      for (let i = 1; i <= samples; i++) {
        const current = bezierPoint(curve, i / samples);
        lengths.push(lengths[i - 1] + Math.hypot(current[0] - previous[0], current[2] - previous[2]));
        previous = current;
      }
      const total = lengths[samples];
      if (total < 7) return null;
      const target = Math.max(2.7, total - Math.min(distance, total * .55));
      let i = 1;
      while (i < samples && lengths[i] < target) i++;
      const fraction = (target - lengths[i - 1]) / Math.max(.001, lengths[i] - lengths[i - 1]);
      const t = (i - 1 + fraction) / samples;
      return { point: bezierPoint(curve, t), tangent: bezierTangent(curve, t) };
    }
    function addLaneGraphPaint(tile, arrows, mergeGuides, stopLines, records) {
      if (!tile.edgeLanes?.length || !tile.connectors?.length) return;
      const endLanes = new Map(), startLanes = new Map(), exits = new Map(), matched = [];
      const signalNodes = new Set((map.trafficLights || []).filter(light => light.active)
        .map(light => String(light.nodeId)));
      function addTo(index, key, item) {
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(item);
      }
      const roadsById = new Map();
      for (const road of tile.roads || []) addTo(roadsById, String(road.id), road);
      function roadDeckPaintY(edgeId, x, z, rawY) {
        let nearest = null, nearestDistance = Infinity;
        for (const road of roadsById.get(String(edgeId)) || []) {
          const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
          const lengthSquared = dx * dx + dz * dz;
          if (lengthSquared < .01) continue;
          const t = clamp(((x - road.x1) * dx + (z - road.z1) * dz) / lengthSquared, 0, 1);
          const alongX = road.x1 + dx * t, alongZ = road.z1 + dz * t;
          const distance = Math.hypot(x - alongX, z - alongZ);
          if (distance >= nearestDistance) continue;
          const length = Math.sqrt(lengthSquared);
          const offset = ((x - alongX) * dz - (z - alongZ) * dx) / length;
          nearest = roadPaintPoint(road, t, offset)[1] + .02;
          nearestDistance = distance;
        }
        return nearestDistance < 14 ? nearest :
          Math.max(rawY + .135, map.terrainHeight(x, z) + .155);
      }
      function connectorPaintY(connector, t) {
        const samples = connector.samples;
        if (!samples?.length) return bezierPoint(connector.curve, t)[1] + .135;
        const at = t * (samples.length - 1), low = Math.floor(at);
        const high = Math.min(low + 1, samples.length - 1), fraction = at - low;
        return samples[low].y * (1 - fraction) + samples[high].y * fraction + .055;
      }
      const laneKey = (edge, lane) => `${edge}:${lane}`;
      for (const lane of tile.edgeLanes) {
        addTo(endLanes, laneKey(lane.edge_id, lane.end_lane_index), lane);
        addTo(startLanes, laneKey(lane.edge_id, lane.start_lane_index), lane);
      }
      const nearest = (lanes, point, end) => (lanes || []).reduce((best, lane) => {
        const p = lane.curve[end ? 3 : 0];
        const distance = Math.hypot(p[0] - point[0], (p[1] - point[1]) * 2, p[2] - point[2]);
        return !best || distance < best.distance ? { lane, distance } : best;
      }, null);
      for (const connector of tile.connectors) {
        // Unsafe node paths include opposing-carriageway shortcuts and U-turns.
        // Keep their source graph geometry, but do not advertise them as
        // ordinary lane instructions painted on the road.
        if (connector.forbidden || connector.unsafe || connector.public_only ||
            !Array.isArray(connector.curve)) continue;
        const from = laneKey(connector.from_edge_id, connector.from_lane_index);
        const to = laneKey(connector.to_edge_id, connector.to_lane_index);
        const source = nearest(endLanes.get(from), connector.curve[0], true);
        const target = nearest(startLanes.get(to), connector.curve[3], false);
        if (!source || source.distance > 3 || !target || target.distance > 3) continue;
        const kind = laneTurn(source.lane, target.lane, connector);
        addTo(exits, `${connector.node_id}:${from}`, { connector, source: source.lane, kind });
        matched.push({ connector, kind });
      }
      const insideTile = p => p[0] >= tile.ix * map.tileSize &&
        p[0] < (tile.ix + 1) * map.tileSize && p[2] >= tile.iz * map.tileSize &&
        p[2] < (tile.iz + 1) * map.tileSize;
      for (const [key, options] of exits) {
        const source = options[0].source;
        const placement = beforeLaneEnd(source.curve, 11);
        if (!placement || !insideTile(placement.point)) continue;
        const [x, sourceY, z] = placement.point;
        const [tx, ty, tz] = placement.tangent, length = Math.hypot(tx, tz);
        if (length < .01) continue;
        const ux = tx / length, uz = tz / length, lx = -uz, lz = ux;
        const grade = ty / length;
        const point = (forward, left) => {
          const px = x + ux * forward + lx * left, pz = z + uz * forward + lz * left;
          return [px, roadDeckPaintY(source.edge_id, px, pz,
            sourceY + grade * forward), pz];
        };
        if (options.some(option => signalNodes.has(String(option.connector.node_id)))) {
          const stop = beforeLaneEnd(source.curve, 2.2);
          if (stop && insideTile(stop.point)) {
            const [sx, sy, sz] = stop.point, [vx, vy, vz] = stop.tangent;
            const vl = Math.hypot(vx, vz) || 1, acrossX = vz / vl, acrossZ = -vx / vl;
            const half = clamp(Number(source.width_m) / 2 - .13, .6, 3.5);
            const stopPoint = (forward, side) => {
              const px = sx + vx / vl * forward + acrossX * side;
              const pz = sz + vz / vl * forward + acrossZ * side;
              return [px, roadDeckPaintY(source.edge_id, px, pz,
                sy + vy / vl * forward), pz];
            };
            quad(stopLines, stopPoint(-.18, -half), stopPoint(.18, -half),
              stopPoint(.18, half), stopPoint(-.18, half));
          }
        }
        const kinds = [...new Set(options.map(option => option.kind))];
        const order = { left: 0, straight: 1, right: 2, uturn: 3 };
        kinds.sort((a, b) => order[a] - order[b]);
        // U-turns are often permitted alongside a normal turn but painting
        // both heads into a 3 m lane creates an unreadable white knot.
        const paintedKinds = kinds.length > 1 ? kinds.filter(kind => kind !== 'uturn') : kinds;
        quad(arrows, point(-1.4, -.14), point(.5, -.14),
          point(.5, .14), point(-1.4, .14));
        if (paintedKinds.includes('straight')) triangle(arrows,
          point(.35, -.63), point(1.65, 0), point(.35, .63));
        for (const kind of paintedKinds.filter(value => value !== 'straight')) {
          const side = kind === 'left' || kind === 'uturn' ? 1 : -1;
          const reach = kind === 'uturn' ? .65 : .9;
          quad(arrows, point(.12, side * .02), point(.62, side * .02),
            point(.62, side * reach), point(.12, side * reach));
          triangle(arrows, point(-.08, side * (reach - .2)),
            point(.38, side * (reach + .38)), point(.84, side * (reach - .2)));
        }
        records.push({ roadId: String(source.edge_id), laneIndex: source.end_lane_index,
          turns: kinds, connectorIds: options.map(option => String(option.connector.entity_id)), x, z });
      }
      // Road merges need boundaries between lanes, not dashes through lane
      // centers. Pair the actual parallel node paths. The gap check starts a
      // new ramp separator only where its lane has joined the carriageway.
      const byNode = new Map();
      for (const entry of matched) if (entry.kind === 'straight')
        addTo(byNode, String(entry.connector.node_id), entry.connector);
      const paintedPairs = new Set();
      function paintParallel(paths) {
        if (paths.length < 2) return;
        let dx = 0, dz = 0;
        for (const path of paths) {
          dx += path.curve[3][0] - path.curve[0][0];
          dz += path.curve[3][2] - path.curve[0][2];
        }
        const length = Math.hypot(dx, dz);
        if (length < .1) return;
        const lx = dz / length, lz = -dx / length;
        paths.sort((a, b) => {
          const pa = bezierPoint(a.curve, .5), pb = bezierPoint(b.curve, .5);
          return (pa[0] - pb[0]) * lx + (pa[2] - pb[2]) * lz;
        });
        for (let p = 0; p < paths.length - 1; p++) {
          const left = paths[p], right = paths[p + 1];
          const pairKey = [left.entity_id, right.entity_id].sort().join(':');
          if (paintedPairs.has(pairKey)) continue;
          paintedPairs.add(pairKey);
          const separateRoads = left.from_edge_id !== right.from_edge_id ||
            left.to_edge_id !== right.to_edge_id;
          const halfWidths = (clamp(finite(left.width_m, 4), 1.5, 9) +
            clamp(finite(right.width_m, 4), 1.5, 9)) / 2;
          const samples = 30;
          for (let i = 0; i < samples; i++) {
            if (i % 6 >= 4) continue;
            const t0 = i / samples, t1 = (i + 1) / samples;
            const a0 = bezierPoint(left.curve, t0), b0 = bezierPoint(right.curve, t0);
            const a1 = bezierPoint(left.curve, t1), b1 = bezierPoint(right.curve, t1);
            const gap = Math.hypot((a0[0] + a1[0] - b0[0] - b1[0]) / 2,
              (a0[2] + a1[2] - b0[2] - b1[2]) / 2);
            if (gap > halfWidths + (separateRoads ? 1 : 2.5)) continue;
            const m0 = [(a0[0] + b0[0]) / 2,
              Math.max(connectorPaintY(left, t0), connectorPaintY(right, t0)),
              (a0[2] + b0[2]) / 2];
            const m1 = [(a1[0] + b1[0]) / 2,
              Math.max(connectorPaintY(left, t1), connectorPaintY(right, t1)),
              (a1[2] + b1[2]) / 2];
            if (!insideTile([(m0[0] + m1[0]) / 2, 0, (m0[2] + m1[2]) / 2])) continue;
            const vx = m1[0] - m0[0], vz = m1[2] - m0[2];
            const vl = Math.hypot(vx, vz);
            if (vl < .03) continue;
            const nx = vz / vl * .07, nz = -vx / vl * .07;
            const vertex = (point, side) => {
              const x = point[0] + nx * side, z = point[2] + nz * side;
              return [x, Math.max(point[1], map.terrainHeight(x, z) + .155), z];
            };
            quad(mergeGuides, vertex(m0, -1), vertex(m1, -1),
              vertex(m1, 1), vertex(m0, 1));
          }
        }
      }
      for (const connectors of byNode.values()) {
        const fromRoads = new Set(connectors.map(connector => String(connector.from_edge_id)));
        const toRoads = new Set(connectors.map(connector => String(connector.to_edge_id)));
        if ((fromRoads.size === 2 && toRoads.size === 1) ||
            (fromRoads.size === 1 && toRoads.size === 2)) paintParallel(connectors);
        else {
          const routes = new Map();
          for (const connector of connectors)
            addTo(routes, `${connector.from_edge_id}:${connector.to_edge_id}`, connector);
          for (const paths of routes.values()) paintParallel(paths);
        }
      }
    }
    function addSpeedSigns(out, uvs, posts, records, sites, road, layout, intervals) {
      const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
      const length = Math.hypot(dx, dz);
      if (length < 20 || records.length >= 48) return;
      const usable = intervals.find(([start, end]) => (end - start) * length > 20);
      if (!usable) return;
      const t = (usable[0] + usable[1]) / 2;
      const normalX = dz / length, normalZ = -dx / length;
      for (const direction of ['Forward', 'Backward']) {
        const lanes = layout.lanes.filter((lane) => lane.direction.toLowerCase() === direction.toLowerCase());
        if (!lanes.length) continue;
        const key = direction.toLowerCase();
        const exported = Number(road.carSpeed?.[key]);
        const laneSpeeds = lanes.map((lane) => lane.speed).filter((speed) => Number.isFinite(speed) && speed > 0);
        const speed = Number.isFinite(exported) && exported > 0 ? exported :
          laneSpeeds.length ? Math.max(...laneSpeeds) : NaN;
        if (!Number.isFinite(speed)) continue;
        const speedKmh = Math.round(speed * 3.6 / 5) * 5;
        if (speedKmh < 5 || speedKmh > 320) continue;
        const travel = direction === 'Forward' ? 1 : -1;
        const offset = travel > 0 ?
          layout.carriageMax + (isElevated(road.mode) ? -.65 : 1.1) :
          layout.carriageMin + (isElevated(road.mode) ? .65 : -1.1);
        const x = road.x1 + dx * t + normalX * offset;
        const z = road.z1 + dz * t + normalZ * offset;
        const ux = travel * dx / length, uz = travel * dz / length;
        if (nearBuildingFootprint(x, z, 1.5) || sites.some((site) =>
          site.speedKmh === speedKmh && site.direction === direction &&
          site.ux * ux + site.uz * uz > .8 && Math.hypot(site.x - x, site.z - z) < 110)) continue;
        const sourceY = road.y1 + (road.y2 - road.y1) * t;
        const baseY = Math.max(sourceY, map.terrainHeight(x, z)) + (isElevated(road.mode) ? .06 : 0);
        const hx = -travel * normalX, hz = -travel * normalZ;
        const half = .72, low = baseY + 2.05, high = baseY + 3.49;
        const a = [x - hx * half, low, z - hz * half];
        const b = [x + hx * half, low, z + hz * half];
        const c = [x + hx * half, high, z + hz * half];
        const d = [x - hx * half, high, z - hz * half];
        quad(out, a, b, c, d);
        const slot = speedKmh / 5 - 1, column = slot % 8, row = Math.floor(slot / 8);
        const u0 = (column * 64 + 1) / 512, u1 = (column * 64 + 63) / 512;
        uvQuad(uvs, mirrorGlyphs ? u1 : u0, (row * 64 + 1) / 512,
          mirrorGlyphs ? u0 : u1, (row * 64 + 63) / 512);
        quad(posts, [x - hx * .055, baseY, z - hz * .055],
          [x + hx * .055, baseY, z + hz * .055],
          [x + hx * .055, low, z + hz * .055],
          [x - hx * .055, low, z - hz * .055]);
        const record = { roadId: String(road.id), direction, speedKmh, x, z };
        records.push(record);
        sites.push({ ...record, ux, uz });
        if (records.length >= 48) break;
      }
    }
    function elevatedPoint(road, t, offset) {
      const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
      const length = Math.hypot(dx, dz);
      const first = road.startMiter || [dz / length, -dx / length];
      const last = road.endMiter || [dz / length, -dx / length];
      const x = road.x1 + dx * t + (first[0] * (1 - t) + last[0] * t) * offset;
      const z = road.z1 + dz * t + (first[1] * (1 - t) + last[1] * t) * offset;
      const sourceY = road.y1 + (road.y2 - road.y1) * t;
      const ground = map.terrainHeight(x, z);
      return { x, y: Math.max(sourceY, ground) + .06, z,
        clearance: Math.max(0, sourceY - ground) };
    }
    function elevatedVertex(point, rise = 0) { return [point.x, point.y + rise, point.z]; }
    function bridgeBox(out, uvs, road) {
      const length = Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
      if (length < .1) return;
      // The same mitered edge coordinates as the road markings are used for
      // every piece of deck. Subdivision follows the heightfield at low ramps;
      // a full-width box per curve sample left seams and hard slab ends.
      const steps = Math.max(1, Math.ceil(length / 8));
      const half = road.width / 2;
      const columns = Math.max(1, Math.ceil(road.width / 4));
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps, t1 = (i + 1) / steps;
        for (let column = 0; column < columns; column++) {
          const offset0 = -half + road.width * column / columns;
          const offset1 = -half + road.width * (column + 1) / columns;
          const left0 = elevatedPoint(road, t0, offset0);
          const right0 = elevatedPoint(road, t0, offset1);
          const right1 = elevatedPoint(road, t1, offset1);
          const left1 = elevatedPoint(road, t1, offset0);
          const a = elevatedVertex(left0), b = elevatedVertex(right0);
          const c = elevatedVertex(right1), d = elevatedVertex(left1);
          quad(out, a, b, c, d);
          worldUvQuad(uvs, a, b, c, d);
        }
        const a = elevatedPoint(road, t0, -half), b = elevatedPoint(road, t0, half);
        const c = elevatedPoint(road, t1, half), d = elevatedPoint(road, t1, -half);
        const under = (p) => elevatedVertex(p, -Math.min(.5, p.clearance));
        if (Math.max(a.clearance, b.clearance, c.clearance, d.clearance) < .08) continue;
        quad(out, under(d), under(c), under(b), under(a));
        uvQuad(uvs, 0, length * t0 / 5, road.width / 5, length * t1 / 5);
        quad(out, elevatedVertex(a), elevatedVertex(d), under(d), under(a));
        uvQuad(uvs, 0, length * t0 / 5, .5 / 5, length * t1 / 5);
        quad(out, elevatedVertex(c), elevatedVertex(b), under(b), under(c));
        uvQuad(uvs, 0, length * t0 / 5, .5 / 5, length * t1 / 5);
      }
    }
    function bridgeRail(out, road) {
      const from = road.railStart ?? 0, to = road.railEnd ?? 1;
      if (to - from < .001) return;
      const length = Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
      if (length * (to - from) <= 2) return;
      const half = road.width / 2;
      const steps = Math.max(1, Math.ceil(length * (to - from) / 8));
      for (const side of [-1, 1]) for (let i = 0; i < steps; i++) {
        const t0 = from + (to - from) * i / steps, t1 = from + (to - from) * (i + 1) / steps;
        const inner0 = elevatedPoint(road, t0, side * (half - .40));
        const outer0 = elevatedPoint(road, t0, side * (half - .10));
        const inner1 = elevatedPoint(road, t1, side * (half - .40));
        const outer1 = elevatedPoint(road, t1, side * (half - .10));
        const b0 = elevatedVertex(inner0, .08), b1 = elevatedVertex(inner1, .08);
        const b2 = elevatedVertex(outer1, .08), b3 = elevatedVertex(outer0, .08);
        const t0v = elevatedVertex(inner0, 1.12), t1v = elevatedVertex(inner1, 1.12);
        const t2v = elevatedVertex(outer1, 1.12), t3v = elevatedVertex(outer0, 1.12);
        quad(out, b0, b1, t1v, t0v);
        quad(out, b3, t3v, t2v, b2);
        quad(out, t0v, t1v, t2v, t3v);
      }
    }
    function buildingStyle(building) {
      const role = String(building.role || '').toLowerCase();
      const category = String(building.category || '').toLowerCase();
      const label = category + ' ' + String(building.prefab || '').toLowerCase();
      const height = building.height;
      if (building.landscape) return 'landscape';
      if (/castle|fortress|medieval/.test(label)) return 'castle';
      if (/radio mast|telecom tower|observation tower|bronze statue|monument/.test(label)) return 'monument';
      if (/parking (?:building|garage)|parking hall|overground parking|underground parking/.test(label)) return 'parking';
      if (/stadium|sport park stand|basketball center|football field|soccer field|tennis court/.test(label)) return 'stadium';
      if (/hospital|medical|clinic|health research|crematorium/.test(label)) return 'hospital';
      if (/university|school|college|library/.test(label)) return 'campus';
      if (/international airport dropoff canopy/.test(label)) return 'airportCanopy';
      if (/international airport control tower/.test(label)) return 'airportTower';
      if (/international airport concourse/.test(label)) return 'airportConcourse';
      if (/international airport terminal/.test(label)) return 'airportTerminal';
      if (/airport|hangar|terminal/.test(label) || role === 'airport') return 'airport';
      if (/industrial/.test(role) || /factory|warehouse|shipping container|refinery/.test(category))
        return /warehouse|shipping container|industrialmanufacturing02|cattle shed|chicken coop/.test(label) ?
          'warehouse' : 'industrial';
      if (/office/.test(role) || /office/.test(category)) return height > 40 ? 'officeTower' : 'office';
      if (/gas station|gasstation|petrol/.test(label)) return 'gasstation';
      if (/commercial/.test(role) || /business|storefront|shop|retail/.test(category)) return height > 35 ? 'glass' : 'storefront';
      if (/residential/.test(role) || /housing|apartment/.test(category)) {
        if (/row housing|old town/.test(category)) return 'rowhouse';
        if (height > 36) return 'tower';
        if (height < 17 && /low density|waterfront/.test(category)) return 'house';
        return 'apartments';
      }
      if (/education|healthcare|transit|emergency|park_service|airport|infrastructure/.test(role)) return 'civic';
      return height > 45 ? 'tower' : height < 12 ? 'house' : 'civic';
    }
    const buildingPalettes = {
      house: [0xe0c8ac, 0xb2c9c1, 0xbaaed0, 0xe1b6b1, 0xd6d2b9, 0xaec1d9],
      rowhouse: [0xc99782, 0xb8889d, 0xc8ad8e, 0xa78b9b, 0xb6a38f],
      apartments: [0xb0b8c4, 0xc0ad9d, 0xaebcb1, 0xbdaec0],
      tower: [0x8aa6b8, 0x9a9fb5, 0x8ba8a8, 0xa5aabc],
      storefront: [0xc5a0b6, 0xb6a88d, 0x8daeb4, 0xaf9aaa],
      gasstation: [0xd7e0d8, 0xb4cbd0, 0xe5cebe, 0xadb9cb],
      glass: [0x9dbecb, 0x91a9c4, 0x99c1be, 0xa6a7c6],
      industrial: [0xa3b0a9, 0x9ba3b2, 0xb5a48d, 0x8caaa6],
      warehouse: [0x829aa6, 0x9eaab1, 0xb3a99e, 0x83978d],
      office: [0xb6bec2, 0xa9adb9, 0xc1bab3, 0x9fb6b8],
      officeTower: [0x839bac, 0x8b9cab, 0x779aa6, 0x9da9b9],
      civic: [0xc7c0ac, 0xb2b7bd, 0xc2b3a9, 0xb6b8a4],
      campus: [0xb88776, 0xa7776e, 0xc19b83], hospital: [0xd9e6e7, 0xbfcdd6, 0xe2e5de],
      castle: [0x969b97, 0xa8a49a, 0x838e91], airport: [0x90b6c3, 0xabbcc4, 0x829fb2],
      airportTerminal: [0x8faeb9, 0xa6c1c6, 0x91b4bf],
      airportConcourse: [0x839ca6, 0x98aab1, 0x8baeb7],
      airportTower: [0x7c9ead, 0x90adb8], airportCanopy: [0x87aab9, 0x9bbec9],
      stadium: [0x848f9a, 0xa1a9a8], parking: [0x858f94, 0x9b9e9e],
      monument: [0x7d9b9d, 0x9a8e7a], landscape: [0x538469, 0x607f69]
    };
    function buildingColor(building, style) {
      const palette = buildingPalettes[style];
      return new THREE.Color(palette[hash(building.id || building.x + ':' + building.z) % palette.length]);
    }
    function roofColor(style, building) {
      const palette = style === 'house' ? [0x554a59, 0x57636a, 0x76595c, 0x6c6573] :
        style === 'industrial' || style === 'warehouse' ? [0x65747d, 0x7b8587, 0x6d7770] :
        style === 'office' || style === 'officeTower' ? [0x525d68, 0x687b82, 0x54687b] :
        style === 'civic' ? [0x7f8186, 0x867e79] : [0x555f70, 0x6e7182, 0x596b75];
      return new THREE.Color(palette[hash('roof:' + building.id) % palette.length]);
    }
    function ringPoint(point, y) { return [point[0], y, point[1]]; }
    function ringCenter(ring) {
      return ring.reduce((center, p) => [center[0] + p[0] / ring.length, center[1] + p[1] / ring.length], [0, 0]);
    }
    function insetRing(ring, scale) {
      const center = ringCenter(ring);
      return ring.map((p) => [center[0] + (p[0] - center[0]) * scale, center[1] + (p[1] - center[1]) * scale]);
    }
    // A bilinear patch stays inside a rotated lot. It lets a model have two
    // wings, a stepped podium or an offset core without adding a new draw call.
    function subRing(ring, u0, u1, v0, v1) {
      const at = (u, v) => [0, 1].map((axis) =>
        ring[0][axis] * (1 - u) * (1 - v) + ring[1][axis] * u * (1 - v) +
        ring[2][axis] * u * v + ring[3][axis] * (1 - u) * v);
      return [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
    }
    function roofTriangle(out, colors, a, b, c, tint) {
      triangle(out, a, b, c); colorTriangle(colors, tint);
    }
    function roofQuad(out, colors, a, b, c, d, tint) {
      quad(out, a, b, c, d); colorQuad(colors, tint);
    }
    function roofPlate(out, colors, ring, y, tint) {
      let triangles;
      if (ring.length === 4) triangles = [[0, 1, 2], [0, 2, 3]];
      else if (THREE.ShapeUtils?.triangulateShape) {
        try { triangles = THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p[0], p[1])), []); }
        catch (_) { return; }
      } else return;
      for (const face of triangles) roofTriangle(out, colors,
        ringPoint(ring[face[0]], y), ringPoint(ring[face[1]], y), ringPoint(ring[face[2]], y), tint);
    }
    function addWallRing(batch, ring, bottom, top, tint, building, style) {
      const bay = style === 'industrial' || style === 'warehouse' ? 5 :
        style === 'glass' || style === 'officeTower' ? 2.7 : style === 'house' ? 3.6 : 3.2;
      const floor = style === 'industrial' || style === 'warehouse' ? 6 : style === 'house' ? 3.1 : 3.6;
      const u0 = (hash('u:' + building.id) % 4) / 4, v0 = (hash('v:' + building.id) % 4) / 4;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < .1) continue;
        quad(batch.positions, ringPoint(a, bottom), ringPoint(b, bottom), ringPoint(b, top), ringPoint(a, top));
        colorQuad(batch.colors, tint);
        uvQuad(batch.uvs, u0, v0, u0 + length / (bay * 4), v0 + (top - bottom) / (floor * 4));
      }
    }
    function roofLedge(out, colors, outer, inner, y, tint) {
      for (let i = 0; i < outer.length; i++) {
        const next = (i + 1) % outer.length;
        roofQuad(out, colors, ringPoint(outer[i], y), ringPoint(outer[next], y),
          ringPoint(inner[next], y), ringPoint(inner[i], y), tint);
      }
    }
    function roofPrism(out, colors, ring, bottom, top, tint) {
      for (let i = 0; i < ring.length; i++) {
        const next = (i + 1) % ring.length;
        roofQuad(out, colors, ringPoint(ring[i], bottom), ringPoint(ring[next], bottom),
          ringPoint(ring[next], top), ringPoint(ring[i], top), tint);
      }
      roofPlate(out, colors, ring, top, tint.clone().multiplyScalar(1.1));
    }
    function slopedRing(out, colors, outer, inner, outerY, innerY, tint) {
      for (let i = 0; i < outer.length; i++) {
        const next = (i + 1) % outer.length;
        roofQuad(out, colors, ringPoint(outer[i], outerY), ringPoint(outer[next], outerY),
          ringPoint(inner[next], innerY), ringPoint(inner[i], innerY), tint);
      }
    }
    function localPad(center, radius) {
      return [[center[0] - radius, center[1] - radius], [center[0] + radius, center[1] - radius],
        [center[0] + radius, center[1] + radius], [center[0] - radius, center[1] + radius]];
    }
    function facadeCross(out, colors, ring, base, height, tint) {
      const y = base + Math.min(height - .6, Math.max(2, height * .67));
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
        if (length < 6) continue;
        const side = (t) => [a[0] + dx * t - dz / length * .11, a[1] + dz * t + dx / length * .11];
        const center = .5, arm = Math.min(.13, 2.3 / length), stem = Math.min(.038, .6 / length);
        roofQuad(out, colors, ringPoint(side(center - stem), y - 1.5), ringPoint(side(center + stem), y - 1.5),
          ringPoint(side(center + stem), y + 1.5), ringPoint(side(center - stem), y + 1.5), tint);
        roofQuad(out, colors, ringPoint(side(center - arm), y - .32), ringPoint(side(center + arm), y - .32),
          ringPoint(side(center + arm), y + .32), ringPoint(side(center - arm), y + .32), tint);
      }
    }
    function addTrimBand(out, colors, ring, y, tint) {
      const center = ringCenter(ring);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const outward = (p) => {
          const dx = p[0] - center[0], dz = p[1] - center[1], d = Math.hypot(dx, dz) || 1;
          return [p[0] + dx / d * .07, p[1] + dz / d * .07];
        };
        const aa = outward(a), bb = outward(b);
        roofQuad(out, colors, ringPoint(aa, y - .08), ringPoint(bb, y - .08),
          ringPoint(bb, y + .08), ringPoint(aa, y + .08), tint);
      }
    }
    function addTowerAccents(out, colors, ring, bottom, top, variant) {
      const accent = new THREE.Color([0x6bd5e4, 0xe9bd83, 0xdf8bbd, 0xa9d1db, 0xc0a2ef][variant]);
      const belts = [
        [.16, .32, .48, .64, .8], [], [.25, .5, .75], [.12, .88], [.2, .4, .6, .8]
      ][variant];
      for (const f of belts) addTrimBand(out, colors, ring, bottom + (top - bottom) * f, accent);
      if (variant === 0 || variant === 2) return;
      const center = ringCenter(ring);
      const ribs = variant === 1 ? [[.14, .025], [.86, .025]] :
        variant === 3 ? [[.5, .12]] : [[.08, .018], [.34, .018], [.66, .018], [.92, .018]];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < 3) continue;
        const point = (t) => {
          const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          const dx = p[0] - center[0], dz = p[1] - center[1], d = Math.hypot(dx, dz) || 1;
          return [p[0] + dx / d * .22, p[1] + dz / d * .22];
        };
        for (const [t, width] of ribs) {
          const half = Math.min(width, 1.6 / length);
          roofQuad(out, colors, ringPoint(point(t - half), bottom),
            ringPoint(point(t + half), bottom), ringPoint(point(t + half), top),
            ringPoint(point(t - half), top), accent);
        }
      }
    }
    function addNamedTowerCrown(outRoofs, outRoofColors, outTrim, outTrimColors, building) {
      if (building.height < 80 || building.name === building.category) return;
      const name = String(building.name || '').toLowerCase(), ring = building.footprint;
      const top = building.baseY + building.height;
      if (/stylus tower/.test(name)) {
        const blade = insetRing(ring, .15);
        roofPrism(outRoofs, outRoofColors, blade, top, top + 12, new THREE.Color(0x91bec5));
        slopedRing(outRoofs, outRoofColors, blade, insetRing(ring, .025), top + 12, top + 29,
          new THREE.Color(0x85d7e3));
        addTrimBand(outTrim, outTrimColors, ring, top - 5, new THREE.Color(0xe8a9d5));
      } else if (/watanabe tower/.test(name)) {
        roofPrism(outRoofs, outRoofColors, insetRing(ring, .68), top, top + 5,
          new THREE.Color(0x6f8390));
        roofPrism(outRoofs, outRoofColors, insetRing(ring, .38), top + 5, top + 11,
          new THREE.Color(0x9bb2b6));
        addTrimBand(outTrim, outTrimColors, ring, top - 11, new THREE.Color(0xe2acb7));
      } else if (/century castle/.test(name)) {
        for (const corner of ring) roofPrism(outRoofs, outRoofColors,
          localPad(corner, Math.min(2.2, Math.min(building.width, building.depth) * .08)),
          top - 8, top + 7, new THREE.Color(0xb0aaa1));
        addTrimBand(outTrim, outTrimColors, ring, top - 6, new THREE.Color(0xe1c39d));
      } else if (/waterfall array/.test(name)) {
        addTowerAccents(outTrim, outTrimColors, ring, building.baseY + 4, top, 0);
        roofPrism(outRoofs, outRoofColors, insetRing(ring, .55), top, top + 5,
          new THREE.Color(0x79bdd3));
      } else if (/colossal tower|multistory multimedia/.test(name)) {
        roofPrism(outRoofs, outRoofColors, insetRing(ring, .48), top, top + 8,
          new THREE.Color(0xa19ba9));
        addTrimBand(outTrim, outTrimColors, ring, top - 8, new THREE.Color(0xe8a6d3));
      }
    }
    function addHouseRoof(out, colors, ring, eave, peak, tint, variant) {
      if (variant === 0) {
        const center = ringCenter(ring), apex = ringPoint(center, peak);
        for (let i = 0; i < ring.length; i++) roofTriangle(out, colors,
          ringPoint(ring[i], eave), ringPoint(ring[(i + 1) % ring.length], eave), apex,
          tint.clone().multiplyScalar(i % 2 ? .85 : 1.05));
        return;
      }
      const a = Math.hypot(ring[1][0] - ring[0][0], ring[1][1] - ring[0][1]);
      const b = Math.hypot(ring[2][0] - ring[1][0], ring[2][1] - ring[1][1]);
      const pair = a >= b ? [[ring[0], ring[3]], [ring[1], ring[2]]] :
        [[ring[0], ring[1]], [ring[3], ring[2]]];
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const ridgeA = ringPoint(mid(...pair[0]), peak), ridgeB = ringPoint(mid(...pair[1]), peak);
      roofQuad(out, colors, ringPoint(pair[0][0], eave), ringPoint(pair[1][0], eave),
        ridgeB, ridgeA, tint);
      roofQuad(out, colors, ridgeA, ridgeB, ringPoint(pair[1][1], eave),
        ringPoint(pair[0][1], eave), tint.clone().multiplyScalar(.82));
      roofTriangle(out, colors, ringPoint(pair[0][0], eave), ridgeA, ringPoint(pair[0][1], eave), tint);
      roofTriangle(out, colors, ringPoint(pair[1][0], eave), ringPoint(pair[1][1], eave), ridgeB, tint);
    }
    function addIndustrialRoof(out, colors, ring, eave, peak, tint, modelVariant = 0) {
      const a = Math.hypot(ring[1][0] - ring[0][0], ring[1][1] - ring[0][1]);
      const b = Math.hypot(ring[2][0] - ring[1][0], ring[2][1] - ring[1][1]);
      const ends = a >= b ? [[ring[0], ring[3]], [ring[1], ring[2]]] :
        [[ring[0], ring[1]], [ring[3], ring[2]]];
      const count = clamp(Math.floor(Math.min(a, b) / (modelVariant % 2 ? 6 : 9)), 1, 5);
      const at = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      for (let i = 0; i < count; i++) {
        const t0 = i / count, tm = (i + .65) / count, t1 = (i + 1) / count;
        const p = ends.map((edge) => at(edge[0], edge[1], t0));
        const q = ends.map((edge) => at(edge[0], edge[1], tm));
        const r = ends.map((edge) => at(edge[0], edge[1], t1));
        roofQuad(out, colors, ringPoint(p[0], eave), ringPoint(p[1], eave),
          ringPoint(q[1], peak), ringPoint(q[0], peak), tint);
        roofQuad(out, colors, ringPoint(q[0], peak), ringPoint(q[1], peak),
          ringPoint(r[1], eave), ringPoint(r[0], eave), tint.clone().multiplyScalar(.76));
        roofTriangle(out, colors, ringPoint(p[0], eave), ringPoint(q[0], peak), ringPoint(r[0], eave), tint);
        roofTriangle(out, colors, ringPoint(r[1], eave), ringPoint(q[1], peak), ringPoint(p[1], eave), tint);
      }
    }
    function addEverydayRoof(outRoofs, outRoofColors, outTrim, outTrimColors,
      ring, top, height, tint, style, modelVariant) {
      const accent = new THREE.Color(style === 'storefront' ? 0xe991b7 :
        style === 'rowhouse' ? 0xc6b09a : style === 'apartments' ? 0x91b6c2 : 0xc5c2b4);
      const detailHeight = Math.min(3.8, Math.max(.8, height * .09));
      if (modelVariant === 0) {
        roofPlate(outRoofs, outRoofColors, ring, top, tint);
        roofPrism(outRoofs, outRoofColors, insetRing(ring, .95), top,
          top + .42, accent);
      } else if (modelVariant === 1) {
        roofPlate(outRoofs, outRoofColors, ring, top, tint);
        roofPrism(outRoofs, outRoofColors, insetRing(ring, .58), top, top + detailHeight, tint.clone().multiplyScalar(1.12));
      } else if (modelVariant === 2) {
        roofPlate(outRoofs, outRoofColors, ring, top, tint);
        const corners = insetRing(ring, .57);
        const radius = Math.min(1.4, Math.min(
          Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]),
          Math.hypot(corners[2][0] - corners[1][0], corners[2][1] - corners[1][1])) * .16);
        for (const index of [0, Math.floor(ring.length / 2)])
          roofPrism(outRoofs, outRoofColors, localPad(corners[index], radius), top, top + detailHeight * .72, accent);
      } else if (modelVariant === 3) {
        roofPlate(outRoofs, outRoofColors, ring, top, tint);
        const inset = insetRing(ring, .64);
        slopedRing(outRoofs, outRoofColors, ring, inset, top, top + detailHeight, tint.clone().multiplyScalar(1.18));
        roofPlate(outRoofs, outRoofColors, inset, top + detailHeight, accent);
      } else {
        roofPlate(outRoofs, outRoofColors, ring, top, tint);
        const upper = insetRing(ring, .75), crown = insetRing(ring, .4);
        roofLedge(outRoofs, outRoofColors, ring, upper, top + .16, accent);
        roofPrism(outRoofs, outRoofColors, crown, top, top + detailHeight * 1.45, tint.clone().multiplyScalar(.88));
      }
      if (style === 'apartments') {
        const bands = 1 + modelVariant % 3;
        for (let floor = 1; floor <= bands; floor++)
          addTrimBand(outTrim, outTrimColors, ring, top - floor * Math.min(3.4, height / (bands + 1)), accent);
      }
    }
    function addZonedModel(batches, outRoofs, outRoofColors, outTrim, outTrimColors,
      building, style, modelVariant, facadeVariant, tint, roofTint) {
      if (!['storefront', 'gasstation', 'warehouse', 'office', 'officeTower'].includes(style) ||
          building.footprint.length !== 4) return false;
      const ring = building.footprint, base = building.baseY, height = building.height;
      const top = base + height, batch = batches[style][facadeVariant];
      const accent = new THREE.Color(style === 'gasstation' ? 0xf2a06e :
        style === 'warehouse' ? 0x8baab0 : style === 'storefront' ? 0xf19bc7 : 0x71cad6);
      const wall = (outline, from, to, shade = tint) =>
        addWallRing(batch, outline, from, to, shade, building, style);
      const plate = (outline, y = top) => roofPlate(outRoofs, outRoofColors, outline, y, roofTint);
      const prism = (outline, from, to, shade = roofTint) =>
        roofPrism(outRoofs, outRoofColors, outline, from, to, shade);
      if (style === 'storefront') {
        wall(ring, base, top);
        const signY = base + Math.min(height - .3, Math.max(2, height * .57));
        addTrimBand(outTrim, outTrimColors, ring, signY, accent);
        if (modelVariant === 0) {
          plate(ring); prism(insetRing(ring, .91), top, top + .5, accent);
        } else if (modelVariant === 1) {
          plate(ring); prism(insetRing(ring, .65), top, top + Math.min(2, height * .23));
          addTrimBand(outTrim, outTrimColors, ring, top - .7, accent);
        } else if (modelVariant === 2) {
          plate(ring); prism(subRing(ring, .04, .25, .05, .95), top,
            top + Math.min(3.2, height * .5), accent);
        } else if (modelVariant === 3) {
          slopedRing(outRoofs, outRoofColors, ring, insetRing(ring, .48), top,
            top + Math.min(1.8, height * .2), roofTint);
          plate(insetRing(ring, .48), top + Math.min(1.8, height * .2));
        } else {
          plate(ring);
          prism(subRing(ring, .06, .44, .08, .9), top, top + .9, accent);
          prism(subRing(ring, .56, .94, .08, .9), top, top + 1.45, roofTint);
        }
      } else if (style === 'gasstation') {
        // The export gives a lot outline, not pump/kiosk submeshes. Keep a
        // visible full shell so its collision remains honest, then vary its roof.
        wall(ring, base, top);
        const bandY = base + Math.min(height - .2, Math.max(2.2, height * .62));
        addTrimBand(outTrim, outTrimColors, ring, bandY, accent);
        if (modelVariant === 0) {
          plate(ring); prism(subRing(ring, .06, .94, .08, .38), top, top + .55, accent);
        } else if (modelVariant === 1) {
          plate(ring);
          prism(subRing(ring, .08, .92, .08, .3), top, top + .8, accent);
          prism(subRing(ring, .08, .92, .7, .92), top, top + .8, accent);
        } else if (modelVariant === 2) {
          slopedRing(outRoofs, outRoofColors, ring, insetRing(ring, .58), top,
            top + 1.45, roofTint);
          plate(insetRing(ring, .58), top + 1.45);
        } else if (modelVariant === 3) {
          plate(ring);
          prism(subRing(ring, .04, .21, .05, .3), top, top + 2.8, accent);
          prism(subRing(ring, .16, .9, .12, .37), top, top + .5, roofTint);
        } else {
          plate(ring); prism(insetRing(ring, .72), top, top + 1.2, roofTint);
          roofLedge(outRoofs, outRoofColors, ring, insetRing(ring, .82), top + .32, accent);
        }
      } else if (style === 'warehouse') {
        const eave = top - Math.min(3.2, Math.max(.65, height * .18));
        wall(ring, base, eave);
        if (modelVariant === 0) {
          prism(ring, eave, top - .45);
          prism(subRing(ring, .16, .84, .36, .64), top - .45, top, accent);
        } else if (modelVariant === 1) {
          addHouseRoof(outRoofs, outRoofColors, ring, eave, top, roofTint, 1);
          prism(subRing(ring, .07, .93, .04, .15), eave, eave + .45, accent);
        } else if (modelVariant === 2) {
          addIndustrialRoof(outRoofs, outRoofColors, ring, eave, top, roofTint, 0);
          prism(subRing(ring, .08, .24, .1, .28), eave, eave + .75, accent);
        } else if (modelVariant === 3) {
          slopedRing(outRoofs, outRoofColors, ring, insetRing(ring, .45), eave, top, roofTint);
          plate(insetRing(ring, .45));
        } else {
          prism(ring, eave, top - .6);
          for (const u of [.13, .52])
            prism(subRing(ring, u, u + .35, .2, .8), top - .6, top, accent);
        }
        addTrimBand(outTrim, outTrimColors, ring, base + Math.min(4.2, height * .48), accent);
      } else if (style === 'office') {
        const podium = base + Math.min(5, height * .36);
        wall(ring, base, podium, tint.clone().multiplyScalar(.9));
        if (modelVariant === 0) {
          wall(ring, podium, top); plate(ring);
          prism(insetRing(ring, .3), top, top + 1.15);
        } else if (modelVariant === 1) {
          const upper = insetRing(ring, .75);
          roofLedge(outRoofs, outRoofColors, ring, upper, podium, roofTint);
          wall(upper, podium, top); plate(upper);
          prism(insetRing(upper, .38), top, top + 1.7, accent);
        } else if (modelVariant === 2) {
          plate(ring, podium);
          for (const wing of [subRing(ring, .04, .44, .08, .92), subRing(ring, .56, .96, .08, .92)]) {
            wall(wing, podium, top); plate(wing);
          }
        } else if (modelVariant === 3) {
          plate(ring, podium);
          for (const wing of [subRing(ring, .05, .43, .05, .95), subRing(ring, .43, .95, .58, .95)]) {
            wall(wing, podium, top); plate(wing);
          }
        } else {
          const mid = podium + (top - podium) * .54, upper = insetRing(ring, .63);
          wall(ring, podium, mid);
          roofLedge(outRoofs, outRoofColors, ring, upper, mid, roofTint);
          wall(upper, mid, top); plate(upper);
          prism(insetRing(upper, .48), top, top + 1.05, accent);
        }
        addTrimBand(outTrim, outTrimColors, ring, podium, accent);
      } else {
        const lobby = base + Math.min(8, height * .09);
        wall(ring, base, lobby, tint.clone().multiplyScalar(1.16));
        if (modelVariant === 0) {
          const shaft = insetRing(ring, .84);
          roofLedge(outRoofs, outRoofColors, ring, shaft, lobby, roofTint);
          wall(shaft, lobby, top); plate(shaft);
          prism(insetRing(shaft, .16), top, top + Math.min(7, height * .06), accent);
        } else if (modelVariant === 1) {
          plate(ring, lobby);
          for (const shaft of [subRing(ring, .05, .44, .07, .93), subRing(ring, .56, .95, .07, .93)]) {
            wall(shaft, lobby, top); plate(shaft);
          }
        } else if (modelVariant === 2) {
          const mid = base + height * .52, high = base + height * .8;
          const first = insetRing(ring, .86), second = insetRing(ring, .64), third = insetRing(ring, .4);
          roofLedge(outRoofs, outRoofColors, ring, first, lobby, roofTint);
          wall(first, lobby, mid);
          roofLedge(outRoofs, outRoofColors, first, second, mid, roofTint);
          wall(second, mid, high);
          roofLedge(outRoofs, outRoofColors, second, third, high, roofTint);
          wall(third, high, top); plate(third);
        } else if (modelVariant === 3) {
          plate(ring, lobby);
          for (const wing of [subRing(ring, .07, .47, .06, .94), subRing(ring, .47, .93, .55, .94)]) {
            wall(wing, lobby, top); plate(wing);
          }
          prism(subRing(ring, .11, .34, .16, .41), top, top + 3, accent);
        } else {
          const mid = base + height * .64, first = subRing(ring, .07, .93, .07, .93);
          const upper = subRing(ring, .25, .87, .15, .83);
          roofLedge(outRoofs, outRoofColors, ring, first, lobby, roofTint);
          wall(first, lobby, mid);
          roofLedge(outRoofs, outRoofColors, first, upper, mid, roofTint);
          wall(upper, mid, top); plate(upper);
          prism(insetRing(upper, .27), top, top + 2.2, accent);
        }
        addTrimBand(outTrim, outTrimColors, ring, lobby, accent);
      }
      return true;
    }
    function addBuilding(batches, outRoofs, outRoofColors, outTrim, outTrimColors, building) {
      const ring = building.footprint, base = building.baseY, height = building.height;
      const style = buildingStyle(building);
      const facadeVariant = hash('facade:' + building.id) % facadeVariants;
      const batch = batches[facadeKinds.includes(style) ? style : 'civic'][facadeVariant];
      const tint = buildingColor(building, style), roofTint = roofColor(style, building);
      const variant = hash(building.id || building.x + ':' + building.z) % 4;
      const modelVariant = building.modelVariant ?? hash('model:' + building.id) % 5;
      if (style === 'landscape') {
        const category = String(building.category || '').toLowerCase();
        const color = /pool|water/.test(category) ? 0x3a90aa :
          /basketball|tennis|skate/.test(category) ? 0x9b695d :
          /cemetery/.test(category) ? 0x536e63 : 0x3e8057;
        roofPlate(outRoofs, outRoofColors, ring, base + .07, new THREE.Color(color));
        if (/field|court/.test(category)) {
          const inside = insetRing(ring, .91);
          roofLedge(outTrim, outTrimColors, ring, inside, base + .09, new THREE.Color(0xcbd4be));
        }
        return;
      }
      if (addZonedModel(batches, outRoofs, outRoofColors, outTrim, outTrimColors,
        building, style, modelVariant, facadeVariant, tint, roofTint)) return;
      if (style === 'airportCanopy') {
        const eave = base + height - .72;
        roofPrism(outRoofs, outRoofColors, ring, eave, base + height,
          new THREE.Color(0x7492a3));
        roofLedge(outTrim, outTrimColors, ring, insetRing(ring, .92), base + height + .08,
          new THREE.Color(0x67c8d9));
        // Supports stay on the terminal side; the one-way curb lane remains
        // clear beneath the roof and can use the exported ground road.
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          const anchor = [ring[0][0] * (1 - t) + ring[1][0] * t,
            ring[0][1] * (1 - t) + ring[1][1] * t];
          roofPrism(outRoofs, outRoofColors, localPad(anchor, .38), base, eave,
            new THREE.Color(0x91aab3));
        }
        return;
      }
      if (style === 'airportTerminal') {
        const eave = base + height * .72;
        addWallRing(batches.airport[facadeVariant], ring, base, eave, tint, building, 'airport');
        slopedRing(outRoofs, outRoofColors, ring, insetRing(ring, .85), eave,
          eave + 2.2, roofTint);
        roofPlate(outRoofs, outRoofColors, insetRing(ring, .85), eave + 2.2,
          roofTint.clone().multiplyScalar(1.12));
        addTrimBand(outTrim, outTrimColors, ring, base + 4.2, new THREE.Color(0x68c9dc));
        addTrimBand(outTrim, outTrimColors, ring, eave - .5, new THREE.Color(0xd4e8e9));
        // Each terminal pod has two broad recessed entrances facing the loop.
        // They break the repeating window wall at the scale a driver sees.
        const frontA = ring[3], frontB = ring[2], center = ringCenter(ring);
        const length = Math.hypot(frontB[0] - frontA[0], frontB[1] - frontA[1]) || 1;
        const midpoint = [(frontA[0] + frontB[0]) / 2, (frontA[1] + frontB[1]) / 2];
        const outwardLength = Math.hypot(midpoint[0] - center[0], midpoint[1] - center[1]) || 1;
        const outward = [(midpoint[0] - center[0]) / outwardLength,
          (midpoint[1] - center[1]) / outwardLength];
        const at = (fraction, y, depth = .12) => ringPoint([
          frontA[0] + (frontB[0] - frontA[0]) * fraction + outward[0] * depth,
          frontA[1] + (frontB[1] - frontA[1]) * fraction + outward[1] * depth], y);
        for (const fraction of [.28, .72]) {
          const half = 3.4 / length, jamb = .32 / length;
          roofQuad(outTrim, outTrimColors, at(fraction - half, base + .08),
            at(fraction + half, base + .08), at(fraction + half, base + 4.55),
            at(fraction - half, base + 4.55), new THREE.Color(0x10293b));
          for (const side of [-1, 1]) {
            const edge = fraction + side * half;
            roofQuad(outTrim, outTrimColors, at(edge - jamb, base + .08, .16),
              at(edge + jamb, base + .08, .16),
              at(edge + jamb, base + 4.9, .16),
              at(edge - jamb, base + 4.9, .16), new THREE.Color(0xa8dce1));
          }
          roofQuad(outTrim, outTrimColors, at(fraction - half, base + 4.55, .16),
            at(fraction + half, base + 4.55, .16),
            at(fraction + half, base + 4.95, .16),
            at(fraction - half, base + 4.95, .16), new THREE.Color(0x72d7df));
        }
        return;
      }
      if (style === 'airportConcourse') {
        const eave = base + height * .82;
        addWallRing(batches.airport[facadeVariant], ring, base, eave, tint, building, 'airport');
        slopedRing(outRoofs, outRoofColors, ring, insetRing(ring, .71), eave,
          base + height, new THREE.Color(0x718897));
        roofPlate(outRoofs, outRoofColors, insetRing(ring, .71), base + height,
          new THREE.Color(0x9bbbc4));
        addTrimBand(outTrim, outTrimColors, ring, base + 3.8, new THREE.Color(0x82d8df));
        // Short raised jet bridges make the airside wings legible from above.
        const along = (a, b, t) => [a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t];
        for (let i = 0; i < 3; i++) {
          const t = .2 + i * .28, north = i % 2 === 0;
          const edgeA = north ? ring[0] : ring[1];
          const edgeB = north ? ring[3] : ring[2];
          const oppositeA = north ? ring[1] : ring[0];
          const anchor = along(edgeA, edgeB, t);
          const opposite = along(oppositeA, north ? ring[2] : ring[3], t);
          const delta = [anchor[0] - opposite[0], anchor[1] - opposite[1]];
          const magnitude = Math.hypot(...delta) || 1;
          const outward = [delta[0] / magnitude * 13, delta[1] / magnitude * 13];
          const p = along(edgeA, edgeB, t - .012), q = along(edgeA, edgeB, t + .012);
          roofPrism(outRoofs, outRoofColors,
            [p, q, [q[0] + outward[0], q[1] + outward[1]],
              [p[0] + outward[0], p[1] + outward[1]]],
            base + 4.6, base + 7.4, new THREE.Color(0x78a2b0));
        }
        return;
      }
      if (style === 'airportTower') {
        const shaft = insetRing(ring, .48);
        roofPrism(outRoofs, outRoofColors, shaft, base, base + height * .76,
          new THREE.Color(0x78939e));
        addWallRing(batches.airport[facadeVariant], ring, base + height * .75,
          base + height * .96, tint, building, 'airport');
        roofLedge(outRoofs, outRoofColors, ring, insetRing(ring, .78),
          base + height * .98, new THREE.Color(0xa7c0c9));
        roofPlate(outRoofs, outRoofColors, ring, base + height,
          new THREE.Color(0x718c9e));
        return;
      }
      if (style === 'stadium') {
        const lower = base + Math.min(4, height * .25);
        const rim = base + Math.min(height, Math.max(5, height * (.64 + modelVariant * .055)));
        const stands = insetRing(ring, .78 - modelVariant * .025);
        const field = insetRing(ring, .58 - modelVariant * .02);
        addWallRing(batches.civic[facadeVariant], ring, base, lower, tint, building, 'civic');
        slopedRing(outRoofs, outRoofColors, ring, stands, rim, base + Math.min(2.5, height * .22), roofTint);
        roofLedge(outRoofs, outRoofColors, stands, field, base + Math.min(2.5, height * .22),
          roofTint.clone().multiplyScalar(1.22));
        roofPlate(outRoofs, outRoofColors, field, base + .16, new THREE.Color(0x398261));
        addTrimBand(outTrim, outTrimColors, ring, rim, new THREE.Color(0x7ed6dc));
        if (modelVariant === 1 || modelVariant === 4)
          roofLedge(outRoofs, outRoofColors, ring, stands, rim + 1.3, roofTint.clone().multiplyScalar(1.25));
        if (modelVariant === 2 || modelVariant === 4)
          for (const corner of insetRing(ring, .83)) roofPrism(outRoofs, outRoofColors,
            localPad(corner, Math.min(1.2, Math.min(building.width, building.depth) * .035)),
            rim - 1, rim + 2.2, roofTint);
        if (modelVariant === 3 || modelVariant === 4)
          roofPrism(outRoofs, outRoofColors, insetRing(ring, .31), rim - .3, rim + 1.4,
            roofTint.clone().multiplyScalar(.83));
        return;
      }
      if (style === 'parking') {
        const levels = clamp(Math.round(height / (3.35 - modelVariant * .12)), 2, 10);
        const slab = new THREE.Color(0x788991), rail = new THREE.Color(0x9aaeb1);
        for (let floor = 1; floor <= levels; floor++) {
          const y = base + height * floor / levels;
          roofPrism(outRoofs, outRoofColors, ring, y - .28, y, slab);
          if (floor < levels) addTrimBand(outTrim, outTrimColors, ring, y - .15, rail);
        }
        const radius = Math.min(1.1, Math.max(.4, Math.min(building.width, building.depth) * .04));
        for (const point of insetRing(ring, .88))
          roofPrism(outRoofs, outRoofColors, localPad(point, radius), base, base + height, slab);
        if (modelVariant === 1 || modelVariant === 4)
          roofPrism(outRoofs, outRoofColors, insetRing(ring, .22), base + height,
            base + height + 2.4, rail);
        if (modelVariant === 2 || modelVariant === 4)
          roofLedge(outRoofs, outRoofColors, ring, insetRing(ring, .8),
            base + height + 1.1, rail);
        if (modelVariant === 3 || modelVariant === 4)
          roofPrism(outRoofs, outRoofColors, insetRing(ring, .54), base + height,
            base + height + 1.2, slab.clone().multiplyScalar(1.18));
        return;
      }
      if (style === 'monument') {
        const low = base + Math.min(4, height * (.12 + modelVariant * .018));
        const mid = base + height * (.64 + modelVariant * .04);
        const plinth = insetRing(ring, .65 - modelVariant * .035);
        const shaft = insetRing(ring, .27 - modelVariant * .025);
        const tip = insetRing(ring, .08 + modelVariant * .007);
        roofPrism(outRoofs, outRoofColors, plinth, base, low, roofTint);
        slopedRing(outRoofs, outRoofColors, plinth, shaft, low, mid, tint);
        slopedRing(outRoofs, outRoofColors, shaft, tip, mid, base + height, new THREE.Color(0xb5c5c5));
        roofPlate(outRoofs, outRoofColors, tip, base + height, new THREE.Color(0xe39c72));
        if (modelVariant === 1 || modelVariant === 4)
          roofPrism(outRoofs, outRoofColors, tip, base + height, base + height + 3.5, tint);
        if (modelVariant === 2 || modelVariant === 4)
          roofLedge(outRoofs, outRoofColors, plinth, shaft, low + .6, tint);
        if (modelVariant === 3 || modelVariant === 4)
          roofPrism(outRoofs, outRoofColors, insetRing(ring, .82), base,
            base + (low - base) * .78, roofTint);
        return;
      }
      if (style === 'castle') {
        const parapet = base + height * (.73 + modelVariant * .03);
        const stone = roofTint.clone().multiplyScalar(1.15);
        addWallRing(batch, ring, base, parapet, tint, building, style);
        roofPlate(outRoofs, outRoofColors, ring, parapet, stone);
        const radius = Math.min(3, Math.max(.5, Math.min(building.width, building.depth) * .065));
        for (const point of insetRing(ring, .82))
          roofPrism(outRoofs, outRoofColors, localPad(point, radius), base + height * .58,
            base + height * (modelVariant === 2 ? 1.12 : 1), stone);
        const battlementRing = insetRing(ring, .8);
        for (let edge = 0; edge < battlementRing.length; edge++) {
          const a = battlementRing[edge], b = battlementRing[(edge + 1) % battlementRing.length];
          const count = 2 + modelVariant % 3;
          for (let i = 1; i <= count; i++) {
            const t = i / (count + 1);
            const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
            roofPrism(outRoofs, outRoofColors, localPad(p, radius * .27), parapet,
              base + height * .92, stone);
          }
        }
        if (modelVariant === 1 || modelVariant === 4)
          roofPrism(outRoofs, outRoofColors, insetRing(ring, .32), parapet,
            base + height * 1.13, stone.clone().multiplyScalar(.87));
        if (modelVariant === 3 || modelVariant === 4)
          slopedRing(outRoofs, outRoofColors, insetRing(ring, .52), insetRing(ring, .24),
            parapet, base + height * 1.07, roofTint);
        return;
      }
      if (style === 'airport') {
        const terminalTop = base + Math.max(5, height * (.58 + modelVariant * .035));
        addWallRing(batch, ring, base, terminalTop, tint, building, style);
        roofPlate(outRoofs, outRoofColors, ring, terminalTop, roofTint);
        roofLedge(outRoofs, outRoofColors, ring, insetRing(ring, .82 - modelVariant * .025), terminalTop + .25,
          roofTint.clone().multiplyScalar(1.22));
        if (modelVariant === 2 || modelVariant === 4)
          slopedRing(outRoofs, outRoofColors, ring, insetRing(ring, .61), terminalTop,
            terminalTop + Math.min(3, height * .14), roofTint);
        if (modelVariant === 3)
          for (const point of [ringCenter(ring), insetRing(ring, .52)[0]])
            roofPrism(outRoofs, outRoofColors, localPad(point, Math.min(2.8, building.width * .09)),
              terminalTop, base + height, new THREE.Color(0x7096a8));
        else roofPrism(outRoofs, outRoofColors, insetRing(ring, .12 + modelVariant * .025),
          terminalTop, base + height, new THREE.Color(0x7096a8));
        addTrimBand(outTrim, outTrimColors, ring, base + 2.8, new THREE.Color(0x78d9e9));
        return;
      }
      if (style === 'hospital') {
        addWallRing(batch, ring, base, base + height, tint, building, style);
        roofPlate(outRoofs, outRoofColors, ring, base + height, roofTint);
        facadeCross(outTrim, outTrimColors, ring, base, height, new THREE.Color(0xf07379));
        const hospitalTop = base + height;
        if (height > 10) roofPrism(outRoofs, outRoofColors, insetRing(ring, .17 + modelVariant * .075),
          hospitalTop, hospitalTop + Math.min(1.8 + modelVariant * .45, height * .13), roofTint);
        if (modelVariant === 1 || modelVariant === 4)
          roofLedge(outRoofs, outRoofColors, ring, insetRing(ring, .86),
            hospitalTop + .45, new THREE.Color(0xf07379));
        if (modelVariant === 2 || modelVariant === 4)
          roofPrism(outRoofs, outRoofColors, localPad(insetRing(ring, .55)[0],
            Math.min(2.2, Math.min(building.width, building.depth) * .1)), hospitalTop,
            hospitalTop + 2.4, new THREE.Color(0xc7d4d9));
        if (modelVariant === 3 || modelVariant === 4)
          roofPrism(outRoofs, outRoofColors, insetRing(ring, .43), hospitalTop + 1.2,
            hospitalTop + 2.1, new THREE.Color(0xa6c3c9));
        return;
      }
      if (style === 'campus') {
        const rise = Math.min(4.5, Math.max(1.3, height * (.13 + modelVariant * .016)));
        const eave = base + height - rise;
        addWallRing(batch, ring, base, eave, tint, building, style);
        if (modelVariant === 2) addEverydayRoof(outRoofs, outRoofColors, outTrim, outTrimColors,
          ring, eave, height, roofTint, style, modelVariant);
        else if (ring.length === 4) addHouseRoof(outRoofs, outRoofColors, ring, eave,
          base + height, roofTint, modelVariant % 2);
        else roofPlate(outRoofs, outRoofColors, ring, base + height, roofTint);
        addTrimBand(outTrim, outTrimColors, ring, base + Math.min(4, height * .22), new THREE.Color(0xe0bf9c));
        if (height > 8) {
          const midRing = insetRing(ring, .72);
          const midpoint = [(midRing[0][0] + midRing[1][0]) / 2,
            (midRing[0][1] + midRing[1][1]) / 2];
          roofPrism(outRoofs, outRoofColors, localPad(midpoint, Math.min(2, building.width * .08)), base,
            base + Math.min(4.5, height * .3), new THREE.Color(0xd8c6ac));
        }
        if (modelVariant === 1 || modelVariant === 4)
          roofPrism(outRoofs, outRoofColors, localPad(ringCenter(ring),
            Math.min(1.6, Math.min(building.width, building.depth) * .09)), base + height - .25,
            base + height + 2.5, new THREE.Color(0xc9aa90));
        if (modelVariant === 3 || modelVariant === 4)
          roofPrism(outRoofs, outRoofColors, insetRing(ring, .42), eave,
            base + height * 1.03, new THREE.Color(0xb78c77));
        return;
      }
      if (style === 'house' && ring.length === 4 && height >= 4) {
        const rise = Math.min(3.7, Math.max(1.1, height * (.17 + modelVariant * .025)));
        const eave = base + height - rise;
        const upper = modelVariant === 3 ? insetRing(ring, .86) :
          modelVariant === 4 ? insetRing(ring, .8) : ring;
        if (modelVariant >= 3) {
          const porch = base + Math.min(3.4, height * .43);
          addWallRing(batch, ring, base, porch, tint, building, style);
          roofLedge(outRoofs, outRoofColors, ring, upper, porch, roofTint);
          addWallRing(batch, upper, porch, eave, tint.clone().multiplyScalar(1.05), building, style);
        } else addWallRing(batch, ring, base, modelVariant === 2 ? base + height : eave,
          tint, building, style);
        if (modelVariant === 2)
          addEverydayRoof(outRoofs, outRoofColors, outTrim, outTrimColors,
            ring, base + height, height, roofTint, style, modelVariant);
        else addHouseRoof(outRoofs, outRoofColors, upper, eave, base + height,
          roofTint, modelVariant === 0 || modelVariant === 4 ? 0 : 1);
        if (modelVariant === 3 || modelVariant === 4)
          roofPrism(outRoofs, outRoofColors, localPad(insetRing(upper, .5)[0],
            Math.min(.65, Math.min(building.width, building.depth) * .08)),
            eave + rise * .24, base + height + (modelVariant === 4 ? .5 : .8),
            new THREE.Color(0x8a6a63));
        if (modelVariant === 4)
          roofPrism(outRoofs, outRoofColors, localPad(insetRing(upper, .5)[2],
            Math.min(.5, Math.min(building.width, building.depth) * .06)),
            eave + rise * .16, base + height + .7, new THREE.Color(0x8a6a63));
      } else if (style === 'industrial' && ring.length === 4 && height >= 6) {
        const rise = Math.min(3.2, Math.max(1.2, height * .16));
        const eave = base + height - rise;
        addWallRing(batch, ring, base, eave, tint, building, style);
        if (modelVariant === 2) {
          slopedRing(outRoofs, outRoofColors, ring, insetRing(ring, .58),
            eave, base + height, roofTint);
          roofPlate(outRoofs, outRoofColors, insetRing(ring, .58), base + height, roofTint);
        } else if (modelVariant === 3) {
          roofPlate(outRoofs, outRoofColors, ring, eave, roofTint);
          for (const point of insetRing(ring, .49))
            roofPrism(outRoofs, outRoofColors, localPad(point, Math.min(1.3, building.width * .07)),
              eave, base + height, roofTint.clone().multiplyScalar(.75));
        } else addIndustrialRoof(outRoofs, outRoofColors, ring, eave, base + height,
          roofTint, modelVariant);
        if (modelVariant === 1 || modelVariant === 4)
          roofPrism(outRoofs, outRoofColors, localPad(insetRing(ring, .48)[0],
            Math.min(1.2, building.width * .07)), base + height - .3,
            base + height + 2.4, new THREE.Color(0x718b90));
      } else if ((style === 'tower' || style === 'glass') && ring.length === 4 && height >= 38) {
        const firstTop = base + height * ([.72, .59, .83, .68, .76][modelVariant]);
        const upper = insetRing(ring, [.78, .72, .88, .63, .74][modelVariant]);
        const lobbyTop = base + Math.min(6, height * .09);
        addWallRing(batches.storefront[facadeVariant], ring, base, lobbyTop, tint.clone().multiplyScalar(1.16), building, 'storefront');
        addWallRing(batch, ring, lobbyTop, firstTop, tint, building, style);
        addTowerAccents(outTrim, outTrimColors, ring, lobbyTop, firstTop, modelVariant);
        roofLedge(outRoofs, outRoofColors, ring, upper, firstTop, roofTint);
        if (height > 65 && (modelVariant === 1 || modelVariant === 4)) {
          const secondTop = base + height * (modelVariant === 1 ? .86 : .91);
          const crown = insetRing(ring, modelVariant === 1 ? .48 : .56);
          addWallRing(batch, upper, firstTop, secondTop, tint.clone().multiplyScalar(.88), building, style);
          addTowerAccents(outTrim, outTrimColors, upper, firstTop, secondTop, modelVariant);
          roofLedge(outRoofs, outRoofColors, upper, crown, secondTop, roofTint);
          addWallRing(batch, crown, secondTop, base + height, tint, building, style);
          addTowerAccents(outTrim, outTrimColors, crown, secondTop, base + height, modelVariant);
          roofPlate(outRoofs, outRoofColors, crown, base + height, roofTint);
          addTrimBand(outTrim, outTrimColors, crown, secondTop, new THREE.Color(0x67d9e6));
        } else {
          addWallRing(batch, upper, firstTop, base + height, tint.clone().multiplyScalar(.9), building, style);
          addTowerAccents(outTrim, outTrimColors, upper, firstTop, base + height, modelVariant);
          roofPlate(outRoofs, outRoofColors, upper, base + height, roofTint);
        }
        if (modelVariant === 3) {
          const crown = insetRing(upper, .53);
          roofPrism(outRoofs, outRoofColors, crown, base + height, base + height + 3.5,
            roofTint.clone().multiplyScalar(1.25));
        }
        if (modelVariant === 4) {
          const crown = insetRing(upper, .39);
          roofPrism(outRoofs, outRoofColors, crown, base + height,
            base + height + Math.min(5.5, height * .055), roofTint);
        }
        if (modelVariant % 2 === 0) addTrimBand(outTrim, outTrimColors, upper, firstTop,
          new THREE.Color(style === 'glass' ? 0x67d9e6 : 0xd285bc));
      } else {
        addWallRing(batch, ring, base, base + height, tint, building, style);
        addEverydayRoof(outRoofs, outRoofColors, outTrim, outTrimColors,
          ring, base + height, height, roofTint, style, modelVariant);
      }
      if (style === 'tower' || style === 'glass')
        addNamedTowerCrown(outRoofs, outRoofColors, outTrim, outTrimColors, building);
      if (style === 'storefront' || style === 'rowhouse') {
        addTrimBand(outTrim, outTrimColors, ring, base + Math.min(height - .35, 3.4),
          new THREE.Color(style === 'storefront' ? (variant % 2 ? 0xe978ae : 0x70dce3) : 0x8c92a6));
      }
      if ((style === 'industrial' || style === 'civic') && height > 12 && variant === 0) {
        const equipment = insetRing(ring, .19);
        roofPrism(outRoofs, outRoofColors, equipment, base + height, base + height + Math.min(1.5, height * .05),
          roofTint.clone().multiplyScalar(.68));
      }
    }
    function placeBox(instance, part, i) {
      const dummy = new THREE.Object3D();
      dummy.position.set(part.x, part.y, part.z);
      dummy.rotation.set(part.pitch || 0, part.yaw || 0, 0, 'YXZ');
      dummy.scale.set(part.width, part.height, part.length || part.depth);
      dummy.updateMatrix(); instance.setMatrixAt(i, dummy.matrix);
    }
    function addStreetTrees(group, sites) {
      if (!sites.length) return;
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.13, .19, 1, 5), trunkMat, sites.length);
      const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), canopyMat, sites.length * 2);
      trunk.name = 'imported-city-tree-trunks'; canopy.name = 'imported-city-tree-canopy';
      const transform = new THREE.Object3D();
      const leafColors = [0x486d5b, 0x587f69, 0x426e67, 0x69816a];
      sites.forEach((site, i) => {
        transform.position.set(site.x, site.y + site.height * .3, site.z);
        transform.scale.set(1, site.height * .6, 1);
        transform.updateMatrix(); trunk.setMatrixAt(i, transform.matrix);
        for (let tier = 0; tier < 2; tier++) {
          const radius = site.height * (tier ? .17 : .24);
          transform.position.set(site.x + (tier ? .35 : 0), site.y + site.height * (tier ? .94 : .72), site.z);
          transform.scale.set(radius, radius * .8, radius);
          transform.updateMatrix(); canopy.setMatrixAt(i * 2 + tier, transform.matrix);
          canopy.setColorAt(i * 2 + tier, new THREE.Color(leafColors[(site.variant + tier) % leafColors.length]));
        }
      });
      trunk.instanceMatrix.needsUpdate = true; canopy.instanceMatrix.needsUpdate = true;
      if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
      group.add(trunk, canopy);
    }
    function nearBuildingFootprint(x, z, margin = 2) {
      for (const building of map.nearbyBuildings(x, z, margin)) {
        if (building.skipVisual) continue;
        const ring = building.footprint;
        if (!ring || ring.length < 3) continue;
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[i], b = ring[j];
          if ((a[1] > z) !== (b[1] > z) &&
            x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
          const dx = b[0] - a[0], dz = b[1] - a[1];
          const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
          if (Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < margin) return true;
        }
        if (inside) return true;
      }
      return false;
    }
    // The overview keeps the original network endpoints; tile features contain
    // extra clipped endpoints and curve samples. Only the former define nodes.
    const endpointCells = new Map(), endpointNodes = [];
    const elevatedEndpointCells = new Map(), elevatedEndpointNodes = [];
    function attachEndpoint(road, atStart, cells = endpointCells, nodes = endpointNodes) {
      const x = atStart ? road.x1 : road.x2, y = atStart ? road.y1 : road.y2;
      const z = atStart ? road.z1 : road.z2;
      const ix = Math.floor(x / 3), iz = Math.floor(z / 3);
      let node = null;
      for (let dx = -1; dx <= 1 && !node; dx++) for (let dz = -1; dz <= 1 && !node; dz++) {
        for (const candidate of cells.get(key(ix + dx, iz + dz)) || []) {
          if (Math.hypot(candidate.x - x, candidate.z - z) < 1.8 && Math.abs(candidate.y - y) < 2.5) {
            node = candidate; break;
          }
        }
      }
      if (!node) {
        node = { x, y, z, samples: 0, arms: [] };
        nodes.push(node);
        const cell = key(ix, iz);
        if (!cells.has(cell)) cells.set(cell, []);
        cells.get(cell).push(node);
      }
      node.x = (node.x * node.samples + x) / (node.samples + 1);
      node.y = (node.y * node.samples + y) / (node.samples + 1);
      node.z = (node.z * node.samples + z) / (node.samples + 1);
      node.samples++;
      const length = Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
      const sign = atStart ? 1 : -1;
      node.arms.push({ road, atStart, length,
        ux: sign * (road.x2 - road.x1) / length, uz: sign * (road.z2 - road.z1) / length });
    }
    for (const road of map.networkRoads || map.overviewRoads) {
      if (isTunnel(road.mode)) continue;
      if (isElevated(road.mode)) {
        attachEndpoint(road, true, elevatedEndpointCells, elevatedEndpointNodes);
        attachEndpoint(road, false, elevatedEndpointCells, elevatedEndpointNodes);
      } else { attachEndpoint(road, true); attachEndpoint(road, false); }
    }
    const junctionsByRoad = new Map(), junctionsByTile = new Map();
    const smoothJoinsByRoad = new Map();
    function smoothJoin(node) {
      if (node.arms.length !== 2) return false;
      const [a, b] = node.arms;
      const first = roadLayout(a.road), second = roadLayout(b.road);
      const widthA = first.carriageMax - first.carriageMin;
      const widthB = second.carriageMax - second.carriageMin;
      if (Math.abs(a.road.width - b.road.width) > .55 ||
          Math.abs(widthA - widthB) > .7 ||
          Math.abs((first.carriageMin + first.carriageMax) / 2) > .7 ||
          Math.abs((second.carriageMin + second.carriageMax) / 2) > .7 ||
          Math.abs(first.leftWalk - second.leftWalk) > .7 ||
          Math.abs(first.rightWalk - second.rightWalk) > .7) return false;
      const originalNormal = (arm) => {
        const road = arm.road;
        return [(road.z2 - road.z1) / arm.length, -(road.x2 - road.x1) / arm.length];
      };
      const normalA = originalNormal(a), normalB = originalNormal(b);
      const relation = a.atStart === b.atStart ? -1 : 1;
      const alignedB = [normalB[0] * relation, normalB[1] * relation];
      const cosine = normalA[0] * alignedB[0] + normalA[1] * alignedB[1];
      if (cosine < -.72) return false;
      const vector = [(normalA[0] + alignedB[0]) / (1 + cosine),
        (normalA[1] + alignedB[1]) / (1 + cosine)];
      if (Math.hypot(...vector) > 2.7) return false;
      for (const [arm, direction] of [[a, 1], [b, relation]]) {
        const id = String(arm.road.id);
        if (!smoothJoinsByRoad.has(id)) smoothJoinsByRoad.set(id, []);
        smoothJoinsByRoad.get(id).push({ x: node.x, z: node.z,
          vector: [vector[0] * direction, vector[1] * direction] });
      }
      return true;
    }
    function tileOwner(node) {
      const ix = Math.floor(node.x / map.tileSize), iz = Math.floor(node.z / map.tileSize);
      if (map.loadedTiles.has(key(ix, iz))) return key(ix, iz);
      let nearest = null, distance = Infinity;
      for (const entry of map.loadedTiles.values()) {
        const tile = entry.descriptor;
        const dx = Math.max(tile.ix * map.tileSize - node.x, 0, node.x - (tile.ix + 1) * map.tileSize);
        const dz = Math.max(tile.iz * map.tileSize - node.z, 0, node.z - (tile.iz + 1) * map.tileSize);
        const d = Math.hypot(dx, dz);
        if (d < distance) { distance = d; nearest = key(tile.ix, tile.iz); }
      }
      return distance < 2 ? nearest : null;
    }
    for (const node of endpointNodes) {
      if (node.arms.length < 2) continue;
      node.arms.sort((a, b) => Math.atan2(a.uz, a.ux) - Math.atan2(b.uz, b.ux));
      if (smoothJoin(node)) continue;
      const owner = tileOwner(node);
      if (!owner) continue;
      const width = Math.max(...node.arms.map((arm) => arm.road.width));
      let cut = Math.max(7, width / 2 + 3);
      for (let i = 0; i < node.arms.length; i++) {
        const a = node.arms[i], b = node.arms[(i + 1) % node.arms.length];
        const angle = Math.acos(clamp(a.ux * b.ux + a.uz * b.uz, -1, 1));
        if (angle > .18 && angle < 2.8) cut = Math.max(cut, width / (2 * Math.sin(angle / 2)) + 2);
      }
      cut = Math.min(cut, 48, width * 2.1 + 3);
      for (const arm of node.arms) {
        arm.cut = Math.min(cut, Math.max(.2, arm.length * .48));
        const id = String(arm.road.id);
        if (!junctionsByRoad.has(id)) junctionsByRoad.set(id, []);
        junctionsByRoad.get(id).push({ node, radius: arm.cut });
      }
      if (!junctionsByTile.has(owner)) junctionsByTile.set(owner, []);
      junctionsByTile.get(owner).push(node);
    }
    for (const node of elevatedEndpointNodes) if (node.arms.length === 2) smoothJoin(node);
    map.junctionStats = {
      nodes: [...junctionsByTile.values()].reduce((sum, nodes) => sum + nodes.length, 0),
      intersections: [...junctionsByTile.values()].reduce((sum, nodes) =>
        sum + nodes.filter((node) => node.arms.length >= 3).length, 0),
      bends: [...junctionsByTile.values()].reduce((sum, nodes) =>
        sum + nodes.filter((node) => node.arms.length === 2).length, 0)
    };
    function applySmoothJoins(road) {
      for (const join of smoothJoinsByRoad.get(String(road.id)) || []) {
        if (Math.hypot(road.x1 - join.x, road.z1 - join.z) < 1.8)
          road.startMiter = join.vector;
        if (Math.hypot(road.x2 - join.x, road.z2 - join.z) < 1.8)
          road.endMiter = join.vector;
      }
    }
    function visibleRoadIntervals(road) {
      const hits = junctionsByRoad.get(String(road.id));
      if (!hits) return [[0, 1]];
      const dx = road.x2 - road.x1, dz = road.z2 - road.z1, a = dx * dx + dz * dz;
      let visible = [[0, 1]];
      for (const hit of hits) {
        const arm = hit.node.arms.find(candidate => String(candidate.road.id) === String(road.id));
        const radius = arm?.graphLanes?.length ? arm.renderCut : hit.radius;
        const px = road.x1 - hit.node.x, pz = road.z1 - hit.node.z;
        const b = 2 * (px * dx + pz * dz), c = px * px + pz * pz - radius * radius;
        const disc = b * b - 4 * a * c;
        if (disc <= 0) continue;
        const root = Math.sqrt(disc), from = (-b - root) / (2 * a), to = (-b + root) / (2 * a);
        if (to <= 0 || from >= 1) continue;
        const next = [];
        for (const [start, end] of visible) {
          if (from > start + .00001) next.push([start, Math.min(end, from)]);
          if (to < end - .00001) next.push([Math.max(start, to), end]);
        }
        visible = next.filter(([start, end]) => end - start > .00001);
        if (!visible.length) break;
      }
      return visible;
    }
    function prepareJunction(node) {
      for (const arm of node.arms) {
        arm.mouth = null;
        const radius = Math.min(arm.length * .49, (arm.renderCut ?? arm.cut) + .35);
        let best = null, bestScore = Infinity;
        for (const road of map.nearbyRoads(node.x, node.z, radius + 8)) {
          if (String(road.id) !== String(arm.road.id)) continue;
          const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
          const px = road.x1 - node.x, pz = road.z1 - node.z;
          const a = dx * dx + dz * dz;
          if (a < .01) continue;
          const b = 2 * (px * dx + pz * dz), c = px * px + pz * pz - radius * radius;
          const disc = b * b - 4 * a * c;
          if (disc < 0) continue;
          for (const t of [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)]) {
            if (t < -.0001 || t > 1.0001) continue;
            const x = road.x1 + dx * t, z = road.z1 + dz * t;
            const outward = (x - node.x) * arm.ux + (z - node.z) * arm.uz;
            if (outward < -1) continue;
            const startDistance = Math.hypot(road.x1 - node.x, road.z1 - node.z);
            const endDistance = Math.hypot(road.x2 - node.x, road.z2 - node.z);
            // A curve can enter the same radius more than once. Keep the first
            // outward crossing in the source road's direction from this node.
            const orientation = arm.atStart ? endDistance - startDistance : startDistance - endDistance;
            const score = (orientation < -.01 ? 1000 : 0) + Math.abs(outward - radius);
            if (score >= bestScore) continue;
            const normal = [(road.startMiter?.[0] ?? dz / Math.sqrt(a)) * (1 - t) +
              (road.endMiter?.[0] ?? dz / Math.sqrt(a)) * t,
            (road.startMiter?.[1] ?? -dx / Math.sqrt(a)) * (1 - t) +
              (road.endMiter?.[1] ?? -dx / Math.sqrt(a)) * t];
            best = { x, z, y: road.y1 + (road.y2 - road.y1) * t,
              normal, ux: (arm.atStart ? 1 : -1) * dx / Math.sqrt(a),
              uz: (arm.atStart ? 1 : -1) * dz / Math.sqrt(a) };
            bestScore = score;
          }
        }
        if (best) arm.mouth = best;
      }
    }
    function junctionPoint(arm, offset, rise) {
      const mouth = arm.mouth;
      let x, z, sourceY;
      if (mouth) {
        x = mouth.x + mouth.normal[0] * offset;
        z = mouth.z + mouth.normal[1] * offset;
        sourceY = mouth.y;
      } else {
        const road = arm.road, length = arm.length;
        const distance = Math.min(length * .49, (arm.renderCut ?? arm.cut) + .35);
        const t = arm.atStart ? distance / length : 1 - distance / length;
        const nx = (road.z2 - road.z1) / length, nz = -(road.x2 - road.x1) / length;
        x = road.x1 + (road.x2 - road.x1) * t + nx * offset;
        z = road.z1 + (road.z2 - road.z1) * t + nz * offset;
        sourceY = road.y1 + (road.y2 - road.y1) * t;
      }
      return { x, y: Math.max(sourceY, map.terrainHeight(x, z)) + rise, z };
    }
    function edgeIntersection(a, armA, b, armB) {
      const ux = -(armA.mouth?.ux ?? armA.ux), uz = -(armA.mouth?.uz ?? armA.uz);
      const vx = -(armB.mouth?.ux ?? armB.ux), vz = -(armB.mouth?.uz ?? armB.uz);
      const determinant = ux * vz - uz * vx;
      if (Math.abs(determinant) < .04) return null;
      const dx = b.x - a.x, dz = b.z - a.z;
      const ta = (dx * vz - dz * vx) / determinant;
      const tb = (dx * uz - dz * ux) / determinant;
      if (ta < 0 || tb < 0 || ta > armA.cut + armA.road.width ||
          tb > armB.cut + armB.road.width) return null;
      const x = a.x + ux * ta, z = a.z + uz * ta;
      if (Math.hypot(x - armA.road.x1, z - armA.road.z1) > 200) return null;
      return { x, z, y: Math.max(map.terrainHeight(x, z) + .068, (a.y + b.y) / 2) };
    }
    function junctionOutline(node) {
      const mouths = node.arms.map((arm) => {
        const layout = roadLayout(arm.road);
        return { right: junctionPoint(arm, arm.atStart ? layout.carriageMax : layout.carriageMin, .068),
          left: junctionPoint(arm, arm.atStart ? layout.carriageMin : layout.carriageMax, .068) };
      });
      const outline = [];
      for (let i = 0; i < node.arms.length; i++) {
        const arm = node.arms[i], next = node.arms[(i + 1) % node.arms.length];
        const mouth = mouths[i], nextMouth = mouths[(i + 1) % node.arms.length];
        outline.push(mouth.right, mouth.left);
        const angleA = Math.atan2(arm.uz, arm.ux), angleB = Math.atan2(next.uz, next.ux);
        const sector = (angleB - angleA + 2 * Math.PI) % (2 * Math.PI);
        const corner = sector < Math.PI - .04 ? edgeIntersection(mouth.left, arm, nextMouth.right, next) : null;
        if (corner) outline.push(corner);
        else if (sector > Math.PI + .04) outline.push({ x: node.x, z: node.z,
          y: Math.max(node.y, map.terrainHeight(node.x, node.z)) + .068 });
      }
      return outline;
    }
    function addJunction(out, uvs, node) {
      const outline = junctionOutline(node);
      if (outline.length < 3) return;
      const faces = THREE.ShapeUtils.triangulateShape(outline.map((p) => new THREE.Vector2(p.x, p.z)), []);
      const vertices = [], triangleIndices = [], byPosition = new Map();
      const vertexIndex = (p) => {
        const id = `${p[0].toFixed(4)},${p[2].toFixed(4)}`;
        let index = byPosition.get(id);
        if (index === undefined) {
          index = vertices.length;
          vertices.push(p);
          byPosition.set(id, index);
        } else vertices[index][1] = Math.max(vertices[index][1], p[1]);
        return index;
      };
      for (const [ia, ib, ic] of faces) {
        const a = outline[ia], b = outline[ib], c = outline[ic];
        const longest = Math.max(Math.hypot(a.x - b.x, a.z - b.z),
          Math.hypot(b.x - c.x, b.z - c.z), Math.hypot(c.x - a.x, c.z - a.z));
        const steps = Math.max(1, Math.ceil(longest / 4));
        const at = (i, j) => {
          const wa = 1 - (i + j) / steps, wb = i / steps, wc = j / steps;
          const x = a.x * wa + b.x * wb + c.x * wc;
          const z = a.z * wa + b.z * wb + c.z * wc;
          return [x, Math.max(a.y * wa + b.y * wb + c.y * wc,
            map.terrainHeight(x, z) + .075), z];
        };
        const grid = [];
        for (let i = 0; i <= steps; i++) {
          grid[i] = [];
          for (let j = 0; j <= steps - i; j++) grid[i][j] = vertexIndex(at(i, j));
        }
        for (let i = 0; i < steps; i++) for (let j = 0; j < steps - i; j++) {
          triangleIndices.push([grid[i][j], grid[i + 1][j], grid[i][j + 1]]);
          if (i + j + 1 < steps) triangleIndices.push([grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]);
        }
      }
      // The terrain heightfield changes plane at its grid diagonals. Lift a
      // shared vertex when an interior sample would fall below that plane;
      // neighboring triangles inherit the same correction without a crack.
      const probes = [[1 / 3, 1 / 3, 1 / 3], [.6, .2, .2], [.2, .6, .2],
        [.2, .2, .6], [.5, .5, 0], [0, .5, .5], [.5, 0, .5],
        [.8, .1, .1], [.1, .8, .1], [.1, .1, .8]];
      for (const indices of triangleIndices) {
        const points = indices.map((index) => vertices[index]);
        let lift = 0;
        for (const weights of probes) {
          const x = points.reduce((sum, p, index) => sum + p[0] * weights[index], 0);
          const z = points.reduce((sum, p, index) => sum + p[2] * weights[index], 0);
          const y = points.reduce((sum, p, index) => sum + p[1] * weights[index], 0);
          lift = Math.max(lift, map.terrainHeight(x, z) + .065 - y);
        }
        if (lift > 0) for (const index of indices) vertices[index][1] += lift;
      }
      for (const indices of triangleIndices) {
        const [a, b, c] = indices.map((index) => vertices[index]);
        triangle(out, a, b, c);
        uvs.push(a[0] / 5, a[2] / 5, b[0] / 5, b[2] / 5, c[0] / 5, c[2] / 5);
      }
    }
    function graphJunctionId(node, tile) {
      if (!tile.connectors?.length) return null;
      const arms = new Set(node.arms.map((arm) => String(arm.road.id)));
      const reach = Math.max(24, ...node.arms.map((arm) => (arm.cut || 0) + 10));
      const groups = new Map();
      for (const connector of tile.connectors) {
        if (connector.forbidden || connector.path_methods_bits != null &&
            !(Number(connector.path_methods_bits) & 2) || !validLaneCurve(connector.curve)) continue;
        const from = String(connector.from_edge_id), to = String(connector.to_edge_id);
        if (!arms.has(from) && !arms.has(to)) continue;
        const [x, , z] = cubicPoint(connector.curve, .5);
        if (Math.hypot(x - node.x, z - node.z) > reach) continue;
        if (!groups.has(connector.node_id)) groups.set(connector.node_id, new Set());
        const group = groups.get(connector.node_id);
        if (arms.has(from)) group.add(from);
        if (arms.has(to)) group.add(to);
      }
      for (const [nodeId, covered] of groups)
        if ([...arms].every((id) => covered.has(id))) return String(nodeId);
      return null;
    }
    function graphMergeOrSplit(node, nodeId, tile) {
      const arms = new Set(node.arms.map(arm => String(arm.road.id)));
      const from = new Set(), to = new Set();
      for (const connector of tile.connectors || []) {
        if (String(connector.node_id) !== nodeId || connector.forbidden ||
            !arms.has(String(connector.from_edge_id)) ||
            !arms.has(String(connector.to_edge_id))) continue;
        from.add(String(connector.from_edge_id));
        to.add(String(connector.to_edge_id));
      }
      return from.size >= 2 && to.size === 1 || from.size === 1 && to.size >= 2;
    }
    function addLaneRibbon(out, uvs, samples, width, entityId, include, extraWidth) {
      if (!samples || samples.length < 2) return;
      const half = clamp(finite(width, 3), 1.5, 9) / 2 + .16;
      const lift = hash(entityId) % 7 * .001;
      const edge = (sample, side) => {
        const radius = half + (extraWidth ? extraWidth(sample) : 0);
        const x = sample.x + sample.nx * radius * side;
        const z = sample.z + sample.nz * radius * side;
        return [x, Math.max(sample.y, map.terrainHeight(x, z) + .095) + lift, z];
      };
      for (let i = 0; i < samples.length - 1; i++) {
        if (include && !include(samples[i], samples[i + 1])) continue;
        const a = edge(samples[i], 1), b = edge(samples[i + 1], 1);
        const c = edge(samples[i + 1], -1), d = edge(samples[i], -1);
        triangle(out, a, c, b); triangle(out, a, d, c);
        for (const p of [a, c, b, a, d, c]) uvs.push(p[0] / 5, p[2] / 5);
      }
    }
    function addLaneConnector(out, uvs, connector) {
      addLaneRibbon(out, uvs, connector.samples, connector.width_m, connector.entity_id);
    }
    function prepareGraphArms(tile, graphNodes) {
      const roadsById = new Map();
      for (const road of [...tile.roads, ...tile.highways]) {
        const id = String(road.id);
        if (!roadsById.has(id)) roadsById.set(id, []);
        roadsById.get(id).push(road);
      }
      for (const [node, nodeId] of graphNodes) {
        let complete = true;
        for (const arm of node.arms) {
          const lanes = [];
          for (const lane of tile.edgeLanes || []) {
            if (String(lane.edge_id) !== String(arm.road.id) || !validLaneCurve(lane.curve)) continue;
            const atStart = String(lane.edge_start_node_id) === nodeId;
            const atEnd = String(lane.edge_end_node_id) === nodeId;
            if (!atStart && !atEnd) continue;
            const terminal = lane.curve[atStart ? 0 : 3];
            const distance = Math.hypot(terminal[0] - node.x, terminal[2] - node.z);
            if (distance > arm.cut + 12) continue;
            lanes.push({ lane, terminal, distance });
          }
          if (!lanes.length) { complete = false; break; }
          arm.graphLanes = lanes;
          arm.graphSegments = roadsById.get(String(arm.road.id)) || [];
          arm.renderCut = Math.min(arm.cut,
            Math.max(7, ...lanes.map(entry => entry.distance + 4)));
        }
        if (!complete) {
          graphNodes.delete(node);
          for (const arm of node.arms) {
            delete arm.graphLanes; delete arm.graphSegments; delete arm.renderCut;
          }
        }
      }
    }
    function addGraphApproaches(out, uvs, tile, graphNodes) {
      if (!graphNodes.size || !tile.edgeLanes?.length) return;
      for (const node of graphNodes.keys()) for (const arm of node.arms) {
        const lanes = arm.graphLanes || [];
        if (!lanes.length) continue;
        const layout = roadLayout(arm.road);
        const carriageWidth = layout.carriageMax - layout.carriageMin;
        const laneWidth = lanes.reduce((total, entry) => total + finite(entry.lane.width_m, 3), 0);
        const shoulder = clamp((carriageWidth - laneWidth) / 2, 0, 3.5);
        const dx = arm.road.x2 - arm.road.x1, dz = arm.road.z2 - arm.road.z1;
        const length = Math.hypot(dx, dz) || 1;
        const nx = dz / length, nz = -dx / length;
        lanes.sort((a, b) => (a.terminal[0] - node.x) * nx + (a.terminal[2] - node.z) * nz -
          (b.terminal[0] - node.x) * nx - (b.terminal[2] - node.z) * nz);
        for (let i = 0; i < lanes.length; i++) {
          const { lane, distance } = lanes[i];
          const samples = sampleLaneConnector(lane, map.terrainHeight);
          const reach = arm.renderCut + 4;
          for (const sample of samples) {
            if (Math.hypot(sample.x - node.x, sample.z - node.z) > reach + 7) continue;
            const deck = roadDeckAt(arm.graphSegments, sample.x, sample.z);
            if (deck === null) continue;
            sample.sourceY = deck;
            sample.y = Math.max(deck + .08, map.terrainHeight(sample.x, sample.z) + .095);
          }
          const outer = i === 0 || i === lanes.length - 1 ? shoulder : 0;
          const extraWidth = outer ? sample => outer * clamp(
            (Math.hypot(sample.x - node.x, sample.z - node.z) - distance) /
              Math.max(2, arm.renderCut - distance), 0, 1) : null;
          addLaneRibbon(out, uvs, samples, lane.width_m, lane.entity_id, (a, b) => {
            const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
            return Math.hypot(x - node.x, z - node.z) <= reach;
          }, extraWidth);
        }
      }
    }
    function addCornerSidewalks(outWalks, outUVs, outCurbs, node) {
      for (let i = 0; i < node.arms.length; i++) {
        const arm = node.arms[i], next = node.arms[(i + 1) % node.arms.length];
        const angleA = Math.atan2(arm.uz, arm.ux), angleB = Math.atan2(next.uz, next.ux);
        const sector = (angleB - angleA + Math.PI * 2) % (Math.PI * 2);
        if (sector > Math.PI + .1 || isMotorway(arm.road) || isMotorway(next.road)) continue;
        const layoutA = roadLayout(arm.road), layoutB = roadLayout(next.road);
        const innerA = arm.atStart ? layoutA.carriageMin : layoutA.carriageMax;
        const outerA = arm.atStart ? -arm.road.width / 2 : arm.road.width / 2;
        const innerB = next.atStart ? layoutB.carriageMax : layoutB.carriageMin;
        const outerB = next.atStart ? next.road.width / 2 : -next.road.width / 2;
        if (Math.abs(innerA - outerA) < .9 || Math.abs(innerB - outerB) < .9) continue;
        const a = junctionPoint(arm, innerA, .16), b = junctionPoint(arm, outerA, .16);
        const c = junctionPoint(next, outerB, .16), d = junctionPoint(next, innerB, .16);
        quad(outWalks, [a.x, a.y, a.z], [b.x, b.y, b.z], [c.x, c.y, c.z], [d.x, d.y, d.z]);
        outUVs.push(a.x / 4, a.z / 4, b.x / 4, b.z / 4, c.x / 4, c.z / 4,
          a.x / 4, a.z / 4, c.x / 4, c.z / 4, d.x / 4, d.z / 4);
        const curb = { id: 'junction-curb', x1: a.x, y1: a.y - .16, z1: a.z,
          x2: d.x, y2: d.y - .16, z2: d.z };
        roadStrip(outCurbs, curb, .12, .185, null, true);
      }
    }
    function addCrosswalks(out, node) {
      if (node.arms.length < 3) return;
      for (const arm of node.arms) {
        const road = arm.road, layout = roadLayout(road);
        const cut = arm.renderCut ?? arm.cut;
        if (layout.highway || arm.length < cut + 5.5) continue;
        const near = (cut + 1.25) / arm.length, far = (cut + 4.25) / arm.length;
        const start = arm.atStart ? near : 1 - far, end = arm.atStart ? far : 1 - near;
        for (let offset = layout.carriageMin + .34; offset + .58 < layout.carriageMax - .34; offset += .95)
          roadStrip(out, road, .29, .115, null, true, offset + .29, start, end);
      }
    }
    function alignSampledRoadJoins(tile, batches) {
      // Every segment of an exported curve is tessellated against terrain on
      // its own. Interior lift probes can raise one side of their shared edge
      // a few centimetres more than the next, exposing a hairline of terrain.
      const joins = new Map(), lifted = new Map();
      const coordinate = (value) => Math.round(value * 1000);
      for (const road of tile.roads) for (const grid of road.surfaceGrids || []) {
        const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
        const length = Math.hypot(dx, dz);
        if (length < .1) continue;
        const first = road.startMiter || [dz / length, -dx / length];
        const last = road.endMiter || [dz / length, -dx / length];
        const stride = grid.columns + 1;
        for (const [t, row] of [[grid.start, 0], [grid.end, grid.steps]]) {
          if (t > .00001 && t < .99999) continue;
          const sourceY = road.y1 + (road.y2 - road.y1) * t;
          for (let column = 0; column <= grid.columns; column++) {
            const offset = grid.centerOffset + grid.halfWidth * (1 - 2 * column / grid.columns);
            const x = road.x1 + dx * t + (first[0] * (1 - t) + last[0] * t) * offset;
            const z = road.z1 + dz * t + (first[1] * (1 - t) + last[1] * t) * offset;
            const index = row * stride + column, y = grid.heights[index];
            const key = `${road.id}:${coordinate(x)}:${coordinate(z)}:${coordinate(sourceY)}`;
            if (!joins.has(key)) joins.set(key, []);
            joins.get(key).push({ grid, index, x, z, y });
          }
        }
      }
      for (const entries of joins.values()) {
        if (entries.length < 2) continue;
        const height = Math.max(...entries.map((entry) => entry.y));
        for (const entry of entries) {
          if (height - entry.y < .00001) continue;
          entry.grid.heights[entry.index] = height;
          lifted.set(`${coordinate(entry.x)}:${coordinate(entry.z)}:${coordinate(entry.y)}`, height);
        }
      }
      if (!lifted.size) return;
      for (const positions of batches) for (let i = 0; i < positions.length; i += 3) {
        const key = `${coordinate(positions[i])}:${coordinate(positions[i + 2])}:${coordinate(positions[i + 1])}`;
        const height = lifted.get(key);
        if (height !== undefined) positions[i + 1] = height;
      }
    }
    function renderTile(tile) {
      if (disposed) return;
      const id = key(tile.ix, tile.iz);
      if (tileGroups.has(id)) return;
      const group = new THREE.Group(); group.name = 'imported-city-tile';
      group.userData.tile = { ix: tile.ix, iz: tile.iz };
      chunkRoot.add(group); tileGroups.set(id, group);
      const groundPositions = [], groundUVs = [], groundHighways = [], highwayUVs = [];
      const bridgePositions = [], bridgeUVs = [], bridgeRailPositions = [];
      const junctionPositions = [], junctionUVs = [];
      const laneConnectorPositions = [], laneConnectorUVs = [];
      const approachPositions = [], approachUVs = [];
      const sidewalkPositions = [], sidewalkUVs = [];
      const junctionSidewalks = [], junctionSidewalkUVs = [], junctionCurbs = [];
      const curbPositions = [], whiteLines = [], yellowLines = [], crosswalkPositions = [], treeSites = [];
      const arrowPositions = [], arrowRecords = [], arrowEntries = [];
      const turnArrowPositions = [], turnArrowRecords = [], mergeGuidePositions = [], stopLinePositions = [];
      const speedSignPositions = [], speedSignUVs = [], speedPostPositions = [];
      const speedSignRecords = [], speedSignSites = [];
      const markQueue = [];
      const ownerJunctions = junctionsByTile.get(id) || [];
      const graphNodes = new Map();
      for (const node of ownerJunctions) {
        const graphId = graphJunctionId(node, tile);
        if (graphId !== null) graphNodes.set(node, graphId);
      }
      const taperNodes = new Map([...graphNodes].filter(([node, nodeId]) =>
        graphMergeOrSplit(node, nodeId, tile)));
      prepareGraphArms(tile, taperNodes);
      for (const road of tile.roads) {
        applySmoothJoins(road);
        road.surfaceGrids = [];
        road.surfaceNeighbors = [];
        const layout = roadLayout(road), length = Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
        const intervals = visibleRoadIntervals(road);
        const carriageCenter = (layout.carriageMin + layout.carriageMax) / 2;
        const carriageHalf = (layout.carriageMax - layout.carriageMin) / 2;
        // A junction's outline cannot assume that a curved source road follows
        // the overview's straight tangent. Keep its real swept carriageway
        // beneath the node surface, while stopping all lines and walks.
        const approachStrip = (start, end) => {
          if (end <= start + .00001) return;
          const t = (start + end) / 2;
          const x = road.x1 + (road.x2 - road.x1) * t;
          const z = road.z1 + (road.z2 - road.z1) * t;
          // Full-width slabs at a graph-covered split produce a blocky,
          // overlapping "star". Its actual edge lanes will fill this space.
          for (const node of taperNodes.keys()) {
            const arm = node.arms.find(candidate => String(candidate.road.id) === String(road.id));
            if (!arm?.graphLanes?.length) continue;
            if (Math.hypot(x - node.x, z - node.z) <=
                arm.renderCut + 1) return;
          }
          roadStrip(approachPositions, road, carriageHalf, .065,
            approachUVs, true, carriageCenter, start, end, 2, true);
        };
        let cursor = 0;
        for (const [start, end] of intervals) {
          if (start > cursor + .00001) approachStrip(cursor, start);
          cursor = end;
        }
        if (cursor < 1 - .00001) approachStrip(cursor, 1);
        if (!intervals.length) continue;
        for (const [start, end] of intervals) roadStrip(layout.highway ? groundHighways : groundPositions,
          road, carriageHalf, .06, layout.highway ? highwayUVs : groundUVs,
          true, carriageCenter, start, end, 5, true);
        markQueue.push({ road, layout, intervals });
        if (layout.highway) continue;
        for (const side of [-1, 1]) {
          const width = side < 0 ? layout.leftWalk : layout.rightWalk;
          if (width < .9) continue;
          const center = side < 0 ? layout.carriageMin - width / 2 : layout.carriageMax + width / 2;
          for (const [start, end] of intervals) {
            roadStrip(sidewalkPositions, road, width / 2, .16, sidewalkUVs, true, center, start, end);
            roadStrip(curbPositions, road, .12, .185, null, true,
              side < 0 ? layout.carriageMin - .1 : layout.carriageMax + .1, start, end);
          }
          if (width < 2.2 || length < 24) continue;
          const nx = (road.z2 - road.z1) / length, nz = -(road.x2 - road.x1) / length;
          const lateral = side < 0 ? layout.carriageMin - width * .58 : layout.carriageMax + width * .58;
          const phase = 11 + hash(String(road.id) + ':' + side) % 12;
          for (let distance = phase; distance < length - 9 && treeSites.length < 150; distance += 38) {
            const t = distance / length;
            if (!intervals.some(([start, end]) => t > start + 4 / length && t < end - 4 / length)) continue;
            const x = road.x1 + (road.x2 - road.x1) * t + nx * lateral;
            const z = road.z1 + (road.z2 - road.z1) * t + nz * lateral;
            if (nearBuildingFootprint(x, z)) continue;
            const y = Math.max(road.y1 + (road.y2 - road.y1) * t, map.terrainHeight(x, z)) + .16;
            const seed = hash(String(road.id) + ':' + Math.round(distance) + ':' + side);
            treeSites.push({ x, y, z, height: 4.6 + seed % 26 / 10, variant: seed % 4 });
          }
        }
      }
      alignSampledRoadJoins(tile, [groundPositions, groundHighways]);
      const endpointGroups = new Map();
      for (const road of tile.roads) for (const [x, y, z] of [
        [road.x1, road.y1, road.z1], [road.x2, road.y2, road.z2]
      ]) {
        const id = `${x.toFixed(2)},${z.toFixed(2)}`;
        if (!endpointGroups.has(id)) endpointGroups.set(id, []);
        endpointGroups.get(id).push({ road, y });
      }
      for (const group of endpointGroups.values()) for (let i = 0; i < group.length; i++)
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i], b = group[j];
          if (a.road === b.road || Math.abs(a.y - b.y) > 2.5 ||
              Math.abs(a.road.width - b.road.width) > 1) continue;
          a.road.surfaceNeighbors.push(b.road);
          b.road.surfaceNeighbors.push(a.road);
        }
      for (const entry of markQueue) {
        markRoad(whiteLines, yellowLines, entry.road, entry.layout, true, entry.intervals);
        arrowEntries.push(entry);
        addSpeedSigns(speedSignPositions, speedSignUVs, speedPostPositions,
          speedSignRecords, speedSignSites, entry.road, entry.layout, entry.intervals);
      }
      for (const node of ownerJunctions) {
        prepareJunction(node);
        if (!graphNodes.has(node)) addJunction(junctionPositions, junctionUVs, node);
        addCornerSidewalks(junctionSidewalks, junctionSidewalkUVs, junctionCurbs, node);
        addCrosswalks(crosswalkPositions, node);
      }
      addGraphApproaches(laneConnectorPositions, laneConnectorUVs, tile, taperNodes);
      for (const connector of tile.ownedConnectors || [])
        addLaneConnector(laneConnectorPositions, laneConnectorUVs, connector);
      for (const road of tile.highways) {
        applySmoothJoins(road);
        bridgeBox(bridgePositions, bridgeUVs, road);
        bridgeRail(bridgeRailPositions, road);
        const layout = roadLayout(road), intervals = [[0, 1]];
        markRoad(whiteLines, yellowLines, road, layout, true);
        arrowEntries.push({ road, layout, intervals });
        addSpeedSigns(speedSignPositions, speedSignUVs, speedPostPositions,
          speedSignRecords, speedSignSites, road, layout, intervals);
      }
      addDirectionArrows(arrowPositions, arrowRecords, arrowEntries);
      addLaneGraphPaint(tile, turnArrowPositions, mergeGuidePositions,
        stopLinePositions, turnArrowRecords);
      mesh('imported-city-road', groundPositions, roadMat, group, null, groundUVs);
      mesh('imported-city-junction-approach', approachPositions, roadMat, group, null, approachUVs);
      mesh('imported-city-junction', junctionPositions, roadMat, group, null, junctionUVs);
      mesh('imported-city-lane-connector', laneConnectorPositions, roadMat, group, null, laneConnectorUVs);
      mesh('imported-city-highway-grade', groundHighways, highwayRoadMat, group, null, highwayUVs);
      mesh('imported-city-highway', bridgePositions, elevatedMat, group, null, bridgeUVs);
      mesh('imported-city-guardrail', bridgeRailPositions, bridgePartMat, group);
      mesh('imported-city-sidewalk', sidewalkPositions, sidewalkMat, group, null, sidewalkUVs);
      mesh('imported-city-curb', curbPositions, curbMat, group);
      mesh('imported-city-junction-sidewalk', junctionSidewalks, sidewalkMat, group, null, junctionSidewalkUVs);
      mesh('imported-city-junction-curb', junctionCurbs, curbMat, group);
      mesh('imported-city-white-marking', whiteLines, whiteMarkingMat, group);
      mesh('imported-city-yellow-marking', yellowLines, yellowMarkingMat, group);
      mesh('imported-city-crosswalk', crosswalkPositions, whiteMarkingMat, group);
      const arrows = mesh('imported-city-direction-arrow', arrowPositions, whiteMarkingMat, group);
      if (arrows) arrows.userData.arrows = arrowRecords;
      const turns = mesh('imported-city-turn-arrow', turnArrowPositions, whiteMarkingMat, group);
      if (turns) turns.userData.turnArrows = turnArrowRecords;
      mesh('imported-city-merge-guide', mergeGuidePositions, whiteMarkingMat, group);
      mesh('imported-city-stop-line', stopLinePositions, whiteMarkingMat, group);
      const speedSigns = mesh('imported-city-speed-sign', speedSignPositions,
        speedSignMat, group, null, speedSignUVs);
      if (speedSigns) speedSigns.userData.signs = speedSignRecords;
      mesh('imported-city-speed-sign-back', speedSignPositions, speedSignBackMat, group);
      mesh('imported-city-speed-post', speedPostPositions, speedPostMat, group);
      addStreetTrees(group, treeSites);
      const facades = Object.fromEntries(facadeKinds.map((kind) => [kind,
        Array.from({ length: facadeVariants }, () => ({ positions: [], colors: [], uvs: [] }))]));
      const roofs = [], roofColors = [], trim = [], trimColors = [];
      for (const building of tile.buildings) if (!building.skipVisual)
        addBuilding(facades, roofs, roofColors, trim, trimColors, building);
      const buildingRoot = new THREE.Group(); buildingRoot.name = 'imported-city-building'; group.add(buildingRoot);
      for (const kind of facadeKinds) {
        for (let variant = 0; variant < facadeVariants; variant++) {
          const batch = facades[kind][variant];
          if (batch.positions.length) mesh('imported-city-building-' + kind, batch.positions,
            wallMaterial(kind, variant), buildingRoot, batch.colors, batch.uvs);
        }
      }
      mesh('imported-city-roof', roofs, roofMat, buildingRoot, roofColors);
      mesh('imported-city-building-trim', trim, buildingTrimMat, buildingRoot, trimColors);
      if (airportSignMat) for (const building of tile.buildings) {
        if (!/International Airport Terminal/.test(building.prefab) ||
            building.footprint?.length !== 4) continue;
        const ring = building.footprint;
        const front = [(ring[2][0] + ring[3][0]) / 2,
          (ring[2][1] + ring[3][1]) / 2];
        const center = ringCenter(ring);
        const dx = front[0] - center[0], dz = front[1] - center[1];
        const length = Math.hypot(dx, dz) || 1, nx = dx / length, nz = dz / length;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.6), airportSignMat);
        sign.name = 'imported-city-airport-departures';
        sign.position.set(front[0] + nx * .2, building.baseY + 6.1,
          front[1] + nz * .2);
        sign.rotation.y = Math.atan2(nx, nz);
        buildingRoot.add(sign);
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
    function refreshJunctionTile(id) {
      const group = tileGroups.get(id), nodes = junctionsByTile.get(id);
      if (!group || !nodes?.length) return;
      const pavement = [], pavementUVs = [], walks = [], walkUVs = [], curbs = [];
      for (const node of nodes) {
        prepareJunction(node);
        const tile = map.loadedTiles.get(id)?.data;
        if (graphJunctionId(node, tile || {}) === null) addJunction(pavement, pavementUVs, node);
        addCornerSidewalks(walks, walkUVs, curbs, node);
      }
      for (const [name, positions, material, uvs] of [
        ['imported-city-junction', pavement, roadMat, pavementUVs],
        ['imported-city-junction-sidewalk', walks, sidewalkMat, walkUVs],
        ['imported-city-junction-curb', curbs, curbMat, null]
      ]) {
        const previous = group.getObjectByName(name);
        if (previous) { previous.geometry.dispose(); group.remove(previous); }
        mesh(name, positions, material, group, null, uvs);
      }
    }
    function refreshAffectedJunctions(tile) {
      const changed = new Set(tile.roads.map((road) => String(road.id)));
      for (const [id, nodes] of junctionsByTile) {
        if (!tileGroups.has(id) || id === key(tile.ix, tile.iz)) continue;
        if (nodes.some((node) => node.arms.some((arm) => changed.has(String(arm.road.id)))))
          refreshJunctionTile(id);
      }
    }
    const unsubscribe = map.onTileChanged(({ type, tile }) => {
      if (type === 'load') renderTile(tile);
      else dropTile(tile);
      refreshAffectedJunctions(tile);
    });
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
      if (mirrorGlyphs) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.fillStyle = color; ctx.fillText(label, 256, 65);
      const texture = new THREE.CanvasTexture(canvas);
      if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
      return texture;
    }
    for (const stop of map.stops) {
      const beacon = new THREE.Group(); beacon.name = 'imported-city-landmark';
      const heading = Number.isFinite(stop.heading) ? stop.heading : 0;
      const edge = Math.max(5, Number.isFinite(stop.roadWidth) ? stop.roadWidth / 2 + 1.4 : 6);
      const x = stop.x + Math.cos(heading) * edge;
      const z = stop.z - Math.sin(heading) * edge;
      beacon.position.set(x, map.terrainHeight(x, z), z);
      const tint = new THREE.Color(stop.color);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 3.8, 6),
        new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(.55) }));
      post.position.y = 1.9; beacon.add(post);
      const texture = signTexture(stop.title.toUpperCase(), stop.color);
      if (texture) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3),
          new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
        sign.position.y = 4.15; sign.rotation.y = heading;
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
    function dispose() {
      disposed = true; unsubscribe();
      speedAtlas.dispose(); speedSignMat.dispose(); speedSignBackMat.dispose(); speedPostMat.dispose();
      airportSignTexture?.dispose(); airportSignMat?.dispose();
      for (const material of Object.values(wallMaterials)) {
        material.map?.dispose(); material.emissiveMap?.dispose(); material.dispose();
      }
    }
    return { update, dispose };
  }

  return { assetUrl, create, load, modelCatalog };
});
