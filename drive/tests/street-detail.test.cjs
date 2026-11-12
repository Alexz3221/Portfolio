'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const Imported = require('../js/imported-city');

test('source lane offsets make marked carriageways, curbs, sidewalks, and street trees', async () => {
  const base = 'data/street-detail/';
  const laneDetails = [-4.5, -1.5, 1.5, 4.5].map((position, index) => ({
    position, width: 3, direction: index < 2 ? 'Forward' : 'Backward', index, speed: 22
  }));
  const road = { type: 'road', id: 'boulevard', kind: 'ROAD', mode: 'GROUND',
    roadClass: 'arterial', width: 24, lanes: { car_lane_count: 4, direction: 0 }, laneDetails,
    points: [[10, 0, 0], [190, 0, 0]] };
  const manifest = { format: 'drive-city-v1', bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 },
    tileSize: 200, focus: [100, 0], terrain: { file: 'terrain.json' },
    tiles: [{ ix: 0, iz: 0, file: 'tiles/0_0.json', buildingCount: 0 }] };
  const joiningRoads = [-100, 100].map((z, index) => ({
    id: 'branch-' + index, kind: 'ROAD', mode: 'GROUND', roadClass: 'street', width: 12,
    points: [[190, 0, 0], [190, 0, z]]
  }));
  const overview = { format: 'drive-city-overview-v1', roads: [road, ...joiningRoads], districts: [], stops: [] };
  const terrain = { format: 'drive-city-terrain-v1', rows: 5, cols: 5,
    origin: [-200, -200], cell: 100, heights: Array(25).fill(0) };
  const files = new Map([[base + 'manifest.json', manifest], [base + 'overview.json', overview],
    [base + 'terrain.json', terrain], [base + 'tiles/0_0.json', { format: 'drive-city-tile-v1', features: [road] }]]);
  const map = await Imported.load(base + 'manifest.json', {
    fetch: async (url) => ({ ok: files.has(url), json: async () => files.get(url) })
  });
  assert.deepEqual(map.roadSegments[0].laneDetails.map((lane) => lane.position), [-4.5, -1.5, 1.5, 4.5]);
  const world = new THREE.Group(), visual = map.build(THREE, world);
  const asphalt = world.getObjectByName('imported-city-road');
  const sidewalk = world.getObjectByName('imported-city-sidewalk');
  const curb = world.getObjectByName('imported-city-curb');
  const white = world.getObjectByName('imported-city-white-marking');
  const yellow = world.getObjectByName('imported-city-yellow-marking');
  const crossing = world.getObjectByName('imported-city-crosswalk');
  const trees = world.getObjectByName('imported-city-tree-canopy');
  assert.ok(asphalt && sidewalk && curb && white && yellow && crossing && trees);
  assert.ok(trees.count >= 4, 'tree instances line both sidewalks');
  assert.equal(sidewalk.geometry.attributes.uv.count, sidewalk.geometry.attributes.position.count);
  const extent = (mesh) => {
    const points = mesh.geometry.attributes.position;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < points.count; i++) {
      min = Math.min(min, points.getZ(i)); max = Math.max(max, points.getZ(i));
    }
    return [min, max];
  };
  const pavement = extent(asphalt), walks = extent(sidewalk), median = extent(yellow);
  assert.ok(pavement[0] > -7 && pavement[1] < 7, 'asphalt follows source vehicle lane extents');
  assert.ok(walks[0] < -11.5 && walks[1] > 11.5, 'sidewalk fills the source road width');
  assert.ok(median[0] > -.3 && median[1] < .3, 'opposing directions get a yellow median');
  visual.dispose();
});

test('a wide four-way junction trims every arm and owns one seam-spanning asphalt patch', async () => {
  const base = 'data/junction-seam/';
  const lanes = [-4.5, -1.5, 1.5, 4.5].map((position, index) => ({
    position, width: 3, direction: index < 2 ? 'Forward' : 'Backward'
  }));
  const makeRoad = (id, width, points) => ({ type: 'road', id, kind: 'ROAD', mode: 'GROUND',
    roadClass: 'arterial', width, laneDetails: lanes, points });
  const west = makeRoad('west', 24, [[20, 0, 100], [200, 0, 100]]);
  const east = makeRoad('east', 24, [[200, 0, 100], [380, 0, 100]]);
  const north = makeRoad('north', 18, [[200, 0, 100], [200, 0, 185]]);
  const south = makeRoad('south', 18, [[200, 0, 15], [200, 0, 100]]);
  const distant = [makeRoad('far-west', 20, [[1010, 0, 100], [1050, 0, 100]]),
    makeRoad('far-east', 20, [[1050, 0, 100], [1190, 0, 100]]),
    makeRoad('far-north', 16, [[1050, 0, 100], [1050, 0, 185]]),
    makeRoad('far-south', 16, [[1050, 0, 15], [1050, 0, 100]])];
  const manifest = { format: 'drive-city-v1', bounds: { minX: 0, maxX: 1200, minZ: 0, maxZ: 200 },
    tileSize: 200, focus: [190, 100], terrain: { file: 'terrain.json' },
    tiles: [{ ix: 0, iz: 0, file: 'tiles/0_0.json', buildingCount: 0 },
      { ix: 1, iz: 0, file: 'tiles/1_0.json', buildingCount: 0 },
      { ix: 5, iz: 0, file: 'tiles/5_0.json', buildingCount: 0 }] };
  const terrain = { format: 'drive-city-terrain-v1', rows: 7, cols: 17,
    origin: [-200, -200], cell: 100, heights: Array(119).fill(0) };
  const files = new Map([[base + 'manifest.json', manifest],
    [base + 'overview.json', { format: 'drive-city-overview-v1',
      roads: [west, east, north, south, ...distant], districts: [], stops: [] }],
    [base + 'terrain.json', terrain],
    [base + 'tiles/0_0.json', { format: 'drive-city-tile-v1', features: [west] }],
    [base + 'tiles/1_0.json', { format: 'drive-city-tile-v1', features: [east, north, south] }],
    [base + 'tiles/5_0.json', { format: 'drive-city-tile-v1', features: distant }]]);
  const map = await Imported.load(base + 'manifest.json', {
    fetch: async (url) => ({ ok: files.has(url), json: async () => files.get(url) })
  });
  const world = new THREE.Group(), visual = map.build(THREE, world);
  assert.deepEqual(map.junctionStats, { nodes: 2, intersections: 2, bends: 0 });
  assert.equal(map.loadedTiles.get('5,0').state, 'idle', 'distant junction is not loaded at spawn');
  const tiles = [];
  world.traverse((object) => { if (object.name === 'imported-city-tile') tiles.push(object); });
  const westTile = tiles.find((group) => group.userData.tile.ix === 0);
  const eastTile = tiles.find((group) => group.userData.tile.ix === 1);
  assert.ok(westTile && eastTile);
  assert.equal(westTile.getObjectByName('imported-city-junction'), undefined);
  const patch = eastTile.getObjectByName('imported-city-junction');
  assert.ok(patch, 'the junction belongs to one tile at the seam');
  const points = (mesh) => mesh.geometry.attributes.position;
  const distance = (attribute, index) => Math.hypot(attribute.getX(index) - 200, attribute.getZ(index) - 100);
  const patchPoints = points(patch);
  const covers = (object, x, z) => {
    if (!object) return false;
    const a = points(object);
    for (let i = 0; i < a.count; i += 3) {
      const x1 = a.getX(i), z1 = a.getZ(i), x2 = a.getX(i + 1), z2 = a.getZ(i + 1);
      const x3 = a.getX(i + 2), z3 = a.getZ(i + 2);
      const denominator = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      if (Math.abs(denominator) < 1e-8) continue;
      const u = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / denominator;
      const v = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / denominator;
      if (u >= 0 && v >= 0 && u + v <= 1) return true;
    }
    return false;
  };
  assert.ok(covers(patch, 200, 100), 'asphalt seals the exact intersection center');
  for (const name of ['imported-city-sidewalk', 'imported-city-curb',
    'imported-city-white-marking', 'imported-city-yellow-marking']) {
    assert.ok(!covers(eastTile.getObjectByName(name), 200, 100), name + ' cannot cross the intersection');
  }
  assert.ok(covers(eastTile.getObjectByName('imported-city-junction-sidewalk'), 214, 114),
    'adjacent sidewalks meet in a paved corner return');
  assert.ok(!covers(patch, 214, 114), 'the corner return stays outside the asphalt');
  for (const tile of [westTile, eastTile]) for (const name of [
    'imported-city-road', 'imported-city-sidewalk', 'imported-city-curb',
    'imported-city-white-marking', 'imported-city-yellow-marking'
  ]) {
    const street = tile.getObjectByName(name);
    if (!street) continue;
    const attribute = points(street);
    for (let i = 0; i < attribute.count; i++) {
      assert.ok(Number.isFinite(attribute.getX(i)) && Number.isFinite(attribute.getY(i)) &&
        Number.isFinite(attribute.getZ(i)), name + ' has finite geometry');
      assert.ok(distance(attribute, i) > 10, name + ' stops before the middle of the junction');
    }
  }
  const westRoad = points(westTile.getObjectByName('imported-city-road'));
  const westEnd = Math.max(...Array.from({ length: westRoad.count }, (_, i) => westRoad.getX(i)));
  const patchWest = Math.min(...Array.from({ length: patchPoints.count }, (_, i) => patchPoints.getX(i)));
  assert.ok(patchWest < westEnd, 'the junction patch overlaps the trimmed road edge without a hole');
  assert.ok(eastTile.getObjectByName('imported-city-crosswalk'));
  await map.ensureNear(1050, 100, 100);
  let distantTile = null;
  world.traverse((object) => {
    if (object.name === 'imported-city-tile' && object.userData.tile.ix === 5) distantTile = object;
  });
  assert.ok(distantTile?.getObjectByName('imported-city-junction'),
    'a junction owner streams its patch after the initial build');
  visual.dispose();
});

test('an elevated crossing does not create a ground junction', async () => {
  const base = 'data/grade-separated/';
  const road = (id, mode, points) => ({ type: 'road', id, kind: 'ROAD', mode,
    roadClass: 'street', width: 12, points });
  const roads = [road('west', 'GROUND', [[10, 0, 100], [100, 0, 100]]),
    road('east', 'GROUND', [[100, 0, 100], [190, 0, 100]]),
    road('flyover', 'ELEVATED', [[100, 12, 20], [100, 12, 100], [100, 12, 180]])];
  const manifest = { format: 'drive-city-v1', bounds: { minX: 0, maxX: 200, minZ: 0, maxZ: 200 },
    tileSize: 200, focus: [100, 100], terrain: { file: 'terrain.json' },
    tiles: [{ ix: 0, iz: 0, file: 'tiles/0_0.json', buildingCount: 0 }] };
  const terrain = { format: 'drive-city-terrain-v1', rows: 5, cols: 5,
    origin: [-100, -100], cell: 100, heights: Array(25).fill(0) };
  const files = new Map([[base + 'manifest.json', manifest],
    [base + 'overview.json', { format: 'drive-city-overview-v1', roads, districts: [], stops: [] }],
    [base + 'terrain.json', terrain],
    [base + 'tiles/0_0.json', { format: 'drive-city-tile-v1', features: roads }]]);
  const map = await Imported.load(base + 'manifest.json', {
    fetch: async (url) => ({ ok: files.has(url), json: async () => files.get(url) })
  });
  const world = new THREE.Group(), visual = map.build(THREE, world);
  assert.deepEqual(map.junctionStats, { nodes: 0, intersections: 0, bends: 0 });
  assert.equal(world.getObjectByName('imported-city-junction'), undefined);
  visual.dispose();
});
