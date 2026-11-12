'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const THREE = require('three');
const Imported = require('../js/imported-city');

const root = path.resolve(__dirname, '..');
const key = (x, z) => `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

async function loadCity() {
  return Imported.load('data/imported-city/manifest.json', {
    fetch: async (url) => {
      try {
        const content = await fs.readFile(path.join(root, url), 'utf8');
        return { ok: true, json: async () => JSON.parse(content) };
      } catch (error) {
        if (error.code === 'ENOENT') return { ok: false };
        throw error;
      }
    }
  });
}

function meshTriangles(world, names = ['imported-city-road', 'imported-city-junction',
  'imported-city-junction-approach', 'imported-city-highway-grade']) {
  const cells = new Map();
  let count = 0;
  world.traverse((object) => {
    if (!names.includes(object.name)) return;
    const position = object.geometry.attributes.position;
    for (let i = 0; i < position.count; i += 3) {
      const a = [position.getX(i), position.getY(i), position.getZ(i)];
      const b = [position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1)];
      const c = [position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2)];
      const triangle = { a, b, c };
      const x0 = Math.floor(Math.min(a[0], b[0], c[0]) / 16);
      const x1 = Math.floor(Math.max(a[0], b[0], c[0]) / 16);
      const z0 = Math.floor(Math.min(a[2], b[2], c[2]) / 16);
      const z1 = Math.floor(Math.max(a[2], b[2], c[2]) / 16);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const cell = `${x},${z}`;
        if (!cells.has(cell)) cells.set(cell, []);
        cells.get(cell).push(triangle);
      }
      count++;
    }
  });
  return { cells, count };
}

function surfaceAt(index, x, z) {
  let highest = -Infinity;
  for (const { a, b, c } of index.cells.get(key(x, z)) || []) {
    const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(denominator) < 1e-8) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator;
    if (u < -1e-4 || v < -1e-4 || u + v > 1 + 1e-4) continue;
    highest = Math.max(highest, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  return highest;
}

function curveJoins(roads) {
  const ends = new Map(), found = [];
  for (const road of roads) {
    if (!road.laneDetails?.length || /elevated|bridge|tunnel/i.test(road.mode)) continue;
    const start = [road.x1, road.z1], end = [road.x2, road.z2];
    for (const [point, atStart] of [[start, true], [end, false]]) {
      const node = `${road.id}:${road.part ?? ''}:${point[0].toFixed(3)}:${point[1].toFixed(3)}`;
      if (!ends.has(node)) ends.set(node, []);
      ends.get(node).push({ road, atStart, point });
    }
  }
  for (const joined of ends.values()) {
    if (joined.length !== 2) continue;
    const [a, b] = joined;
    const start = a.atStart ? [a.road.x2, a.road.z2] : [a.road.x1, a.road.z1];
    const finish = b.atStart ? [b.road.x2, b.road.z2] : [b.road.x1, b.road.z1];
    const center = a.point;
    const first = [(center[0] - start[0]) / distance(center, start),
      (center[1] - start[1]) / distance(center, start)];
    const second = [(finish[0] - center[0]) / distance(center, finish),
      (finish[1] - center[1]) / distance(center, finish)];
    const dot = first[0] * second[0] + first[1] * second[1];
    const cross = first[0] * second[1] - first[1] * second[0];
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (angle < .13 || angle > .75 || distance(center, start) < 5 || distance(center, finish) < 5) continue;
    const laneEdges = a.road.laneDetails.map((lane) => [
      Number(lane.position) - Number(lane.width) / 2,
      Number(lane.position) + Number(lane.width) / 2
    ]).filter((edge) => edge.every(Number.isFinite));
    if (!laneEdges.length) continue;
    const direction = a.atStart ? -1 : 1;
    const storedSide = Math.sign(cross) * direction;
    const sourceOffset = storedSide > 0 ? Math.max(...laneEdges.map((edge) => edge[1])) :
      Math.min(...laneEdges.map((edge) => edge[0]));
    const offset = sourceOffset * direction;
    if (Math.abs(offset) < 2) continue;
    const n1 = [first[1], -first[0]], n2 = [second[1], -second[0]];
    const length = Math.hypot(n1[0] + n2[0], n1[1] + n2[1]);
    const miter = [(n1[0] + n2[0]) / length, (n1[1] + n2[1]) / length];
    const scale = .78 * offset / (miter[0] * n1[0] + miter[1] * n1[1]);
    found.push({ x: center[0] + scale * miter[0], z: center[1] + scale * miter[1],
      center, angle, id: a.road.id });
  }
  return found.sort((a, b) => b.angle - a.angle || String(a.id).localeCompare(String(b.id)));
}

test('an owner junction refreshes when its curved arm tile loads and unloads', async () => {
  const base = 'data/junction-load-order/';
  const road = (id, points) => ({ type: 'road', id, kind: 'ROAD', mode: 'GROUND',
    roadClass: 'street', width: 20, points });
  const west = road('west', [[500, 0, 100], [-350, 0, 100]]);
  const north = road('north', [[500, 0, 100], [500, 0, 270]]);
  const eastOverview = road('curved', [[500, 0, 100], [700, 0, 100]]);
  const eastDetail = road('curved', [[512, 0, 100], [522, 0, 115], [700, 0, 100]]);
  const manifest = { format: 'drive-city-v1',
    bounds: { minX: -500, maxX: 1000, minZ: -100, maxZ: 300 },
    tileSize: 512, focus: [-300, 100], terrain: { file: 'terrain.json' },
    tiles: [{ ix: 0, iz: 0, file: 'tiles/0_0.json', buildingCount: 0 },
      { ix: 1, iz: 0, file: 'tiles/1_0.json', buildingCount: 0 }] };
  const terrain = { format: 'drive-city-terrain-v1', rows: 7, cols: 17,
    origin: [-600, -200], cell: 100, heights: Array(119).fill(0) };
  const files = new Map([
    [base + 'tiles/0_0.json', { format: 'drive-city-tile-v1', features: [west, north] }],
    [base + 'tiles/1_0.json', { format: 'drive-city-tile-v1', features: [eastDetail] }]
  ]);
  const map = Imported.create(manifest,
    { format: 'drive-city-overview-v1', roads: [west, north, eastOverview], districts: [], stops: [] },
    terrain, { baseUrl: base, loadJson: async (url) => files.get(url) });
  await map.ensureNear(500, 100, 0);
  assert.equal(map.loadedTiles.get('1,0').state, 'idle', 'curved arm detail is not loaded yet');
  const world = new THREE.Group(), visual = map.build(THREE, world);
  try {
    const owner = [...world.children.flatMap((child) => child.children)]
      .find((object) => object.name === 'imported-city-tile' && object.userData.tile.ix === 0);
    assert.ok(owner, 'the owner tile is already drawn');
    const initial = owner.getObjectByName('imported-city-junction');
    assert.ok(initial, 'the overview creates an initial junction before detail streams');
    const initialPositions = Array.from(initial.geometry.attributes.position.array);
    await map.ensureNear(600, 100, 0);
    assert.equal(map.loadedTiles.get('1,0').state, 'loaded');
    const detailed = owner.getObjectByName('imported-city-junction');
    assert.notEqual(detailed, initial, 'the owner replaces its pavement mesh after arm detail arrives');
    assert.notDeepEqual(Array.from(detailed.geometry.attributes.position.array), initialPositions,
      'the refreshed junction follows the real curved arm instead of its straight overview fallback');
    map.trimFar(500, 100, 0);
    assert.equal(map.loadedTiles.get('1,0').state, 'idle');
    const reverted = owner.getObjectByName('imported-city-junction');
    assert.notEqual(reverted, detailed, 'the owner refreshes again when the curved arm unloads');
    assert.deepEqual(Array.from(reverted.geometry.attributes.position.array), initialPositions,
      'without detail, the overview fallback makes the same deterministic pavement');
  } finally {
    visual.dispose();
  }
});

test('real exported road curves keep their outer edge paved', async () => {
  const map = await loadCity();
  const world = new THREE.Group(), visual = map.build(THREE, world);
  let sampledJoins = 0;
  const holes = [];
  try {
    const locations = [map.focus, ...map.manifest.centerCandidates];
    for (const location of locations) {
      const x = Number(location.x), z = Number(location.z);
      await map.ensureNear(x, z, map.tileSize * .9);
      const atlas = meshTriangles(world);
      assert.ok(atlas.count > 100, 'the district has rendered asphalt triangles');
      for (const join of curveJoins(map.roadSegments).slice(0, 24)) {
        const y = surfaceAt(atlas, join.x, join.z);
        const terrain = map.terrainHeight(join.x, join.z);
        if (!Number.isFinite(y) || y <= terrain + .025) holes.push(
          `${join.id} at ${join.x.toFixed(1)},${join.z.toFixed(1)} (mesh=${y.toFixed(3)}, terrain=${terrain.toFixed(3)})`);
        sampledJoins++;
      }
    }
    assert.ok(sampledJoins >= 12, 'checked enough real curves to cover more than one road');
    assert.equal(holes.length, 0, `${holes.length}/${sampledJoins} curved road joins have an outer-edge hole: ${holes.slice(0, 8).join('; ')}`);
  } finally {
    visual.dispose();
  }
});

test('real exported right-angle node has pavement across the bend', async () => {
  const map = await loadCity();
  const world = new THREE.Group(), visual = map.build(THREE, world);
  try {
    const knownHole = { x: 1840.721, z: -1052.141 };
    await map.ensureNear(knownHole.x, knownHole.z, map.tileSize * .9);
    const atlas = meshTriangles(world);
    assert.ok(atlas.count > 100, 'the district has rendered asphalt triangles');
    // The two 32 m links make a right-angle turn. These points run from
    // its center toward the outside of even a rounded carriageway corner.
    for (const point of [knownHole, { x: 1837.2, z: -1055.6 },
      { x: 1834.2, z: -1058.6 }]) {
      const y = surfaceAt(atlas, point.x, point.z);
      assert.ok(Number.isFinite(y) && y > map.terrainHeight(point.x, point.z) + .025,
        `right-angle node near ${point.x},${point.z} has visible asphalt across its full width`);
    }
  } finally {
    visual.dispose();
  }
});

test('real exported junction patch interiors stand above terrain', async () => {
  const map = await loadCity();
  const world = new THREE.Group(), visual = map.build(THREE, world);
  let sampledPatches = 0, buriedPatches = 0, triangleOrdinal = 0, worstDeficit = 0;
  let worstPoint = '';
  const buriedExamples = [];
  const byMesh = Object.create(null);
  const stride = process.env.DRIVE_FULL_ROAD_AUDIT === '1' ? 1 : 37;
  const previousFailures = [[3426.3, -3382.0], [-215.8, 1870.0], [3857.1, -3422.2]];
  try {
    const locations = [map.focus, ...map.manifest.centerCandidates];
    for (const location of locations) {
      const x = Number(location.x), z = Number(location.z);
      await map.ensureNear(x, z, map.tileSize * .9);
      world.traverse((object) => {
        if (!['imported-city-junction', 'imported-city-junction-approach'].includes(object.name)) return;
        const stats = byMesh[object.name] ||= { sampled: 0, buried: 0, worst: 0 };
        const p = object.geometry.attributes.position;
        for (let i = 0; i < p.count; i += 3) {
          const centroidX = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
          const centroidZ = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
          const nearOldHole = previousFailures.some(([px, pz]) =>
            Math.hypot(centroidX - px, centroidZ - pz) < 6);
          if (triangleOrdinal++ % stride !== 0 && !nearOldHole) continue;
          const vertices = [[p.getX(i), p.getY(i), p.getZ(i)],
            [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)],
            [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)]];
          for (const weights of [[1 / 3, 1 / 3, 1 / 3], [.6, .2, .2], [.2, .6, .2], [.2, .2, .6]]) {
            const point = [0, 0, 0];
            for (let k = 0; k < 3; k++) for (let axis = 0; axis < 3; axis++)
              point[axis] += weights[k] * vertices[k][axis];
            const terrain = map.terrainHeight(point[0], point[2]);
            if (point[1] <= terrain + .005) {
              buriedPatches++;
              stats.buried++;
              const deficit = terrain + .005 - point[1];
              stats.worst = Math.max(stats.worst, deficit);
              if (deficit > worstDeficit) {
                worstDeficit = deficit;
                worstPoint = `${point[0].toFixed(1)},${point[2].toFixed(1)}`;
              }
              if (buriedExamples.length < 8) buriedExamples.push(
                `${point[0].toFixed(1)},${point[2].toFixed(1)} (mesh=${point[1].toFixed(3)}, terrain=${terrain.toFixed(3)})`);
            }
            sampledPatches++;
            stats.sampled++;
          }
        }
      });
    }
    assert.ok(sampledPatches >= 100, 'checked patch interiors, not just center points');
    if (process.env.DRIVE_FULL_ROAD_AUDIT === '1')
      console.log('Full road audit:', JSON.stringify({ triangles: triangleOrdinal,
        samples: sampledPatches, buried: buriedPatches, byMesh }));
    assert.equal(buriedPatches, 0,
      `${buriedPatches}/${sampledPatches} junction interior samples are obscured by terrain; by mesh ${JSON.stringify(byMesh)}; worst deficit ${worstDeficit.toFixed(3)} m at ${worstPoint}: ${buriedExamples.join('; ')}`);
  } finally {
    visual.dispose();
  }
});

test('lane paint follows the lifted carriageway through a sampled curve', async () => {
  const map = await loadCity();
  const world = new THREE.Group(), visual = map.build(THREE, world);
  try {
    const point = { x: 4406.872, z: 1955.182 }; // Seabreeze Street in the export.
    await map.ensureNear(point.x, point.z, map.tileSize * .9);
    const road = surfaceAt(meshTriangles(world, ['imported-city-road']), point.x, point.z);
    const yellow = surfaceAt(meshTriangles(world, ['imported-city-yellow-marking']), point.x, point.z);
    assert.ok(Number.isFinite(road) && Number.isFinite(yellow));
    assert.ok(yellow > road + .02, 'the yellow line remains visible above its road');
  } finally {
    visual.dispose();
  }
});
