'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('cannon');
const { deriveCenters } = require('../js/portfolio-ui');
const ImportedCity = require('../js/imported-city');
const Physics = require('../js/physics');
const { generateTravelCandidates } = require('../scripts/travel-candidates.cjs');

test('center travel uses named export clusters and snaps onto drivable streets', () => {
  const requested = [];
  const city = {
    detailBounds: { minX: -3000, maxX: 5000, minZ: -4000, maxZ: 6000 },
    manifest: {
      source: { cityName: "Obamna's America" },
      centerCandidates: [
        { id: 'center-4_-2', x: 2304, z: -768, score: 1100 },
        { id: 'center--5_6', x: -2304, z: 3328, score: 650 },
        { id: 'center-9_5', x: 9000, z: 2816, score: 640 },
        { id: 'center-7_2', x: 3840, z: 1280, score: 630 }
      ]
    },
    snapToRoad(x, z) {
      requested.push([x, z]);
      return { x: x + 6, y: 3, z: z - 4, heading: 1.2, roadId: 'street-1', distance: x === 3840 ? 410 : 8 };
    }
  };
  const centers = deriveCenters(city);
  assert.deepEqual(requested, [[2304, -768], [-2304, 3328], [3840, 1280]]);
  assert.deepEqual(centers.map(center => center.title), ['Downtown Core', 'Campus District']);
  assert.deepEqual([centers[0].x, centers[0].z, centers[0].heading, centers[0].roadId],
    [2310, -772, 1.2, 'street-1']);
  assert.equal(centers[0].score, 1100);
});

test('other city exports use neutral names and reject unsafe or absent road snaps', () => {
  const city = {
    bounds: { minX: -500, maxX: 500, minZ: -500, maxZ: 500 },
    manifest: { source: { cityName: 'Another City' },
      centerCandidates: [{ id: 'center-0_0', x: 0, z: 0 }, { id: 'center-1_0', x: 200, z: 0 }] },
    snapToRoad(x) { return x === 0 ? { x: 5, z: 0, heading: 0, distance: 5 } : null; }
  };
  assert.deepEqual(deriveCenters(city).map(center => center.title), ['City Center 01']);
  assert.deepEqual(deriveCenters({ ...city, snapToRoad: undefined }), []);
});

test('street jump heading and lane offset use the nearby curve segment, not a distant same-ID tail', () => {
  const laneDetails = [
    { position: -3, width: 3, direction: 'Forward' },
    { position: 3, width: 3, direction: 'Backward' }
  ];
  const city = {
    bounds: { minX: 0, maxX: 1000, minZ: 0, maxZ: 1000 },
    detailBounds: { minX: 0, maxX: 1000, minZ: 0, maxZ: 1000 },
    manifest: { source: { cityName: 'Curved City' }, centerCandidates: [],
      travelCandidates: [{ id: 'travel-0_0', x: 100, z: 100,
        roadId: 'curve-1', roadName: 'Curve Road' }] },
    networkRoads: [
      { id: 'curve-1', mode: 'GROUND', roadClass: 'street', width: 16,
        x1: 80, z1: 100, x2: 120, z2: 100, laneDetails },
      { id: 'curve-1', mode: 'GROUND', roadClass: 'street', width: 16,
        x1: 900, z1: 900, x2: 900, z2: 950, laneDetails }
    ],
    terrainHeight: () => 0,
    snapToRoad: () => ({ x: 100, y: 0, z: 100,
      heading: 0, roadWidth: 16, roadId: 'curve-1', distance: 0 })
  };
  const [jump] = deriveCenters(city);
  assert.ok(jump, 'the curved road has a street jump');
  assert.ok(Math.abs(jump.heading - Math.PI / 2) < 1e-8,
    'the car faces east along the nearby segment');
  assert.ok(Math.abs(jump.x - 100) < 1e-8 && Math.abs(jump.z - 97) < 1e-8,
    'the car lands three metres to the right of that segment');
  assert.deepEqual([jump.mapX, jump.mapZ], [100, 100],
    'the map marker remains at the road waypoint');
});

test('all seven exported Obamna centers land on ground city streets', () => {
  const base = path.join(__dirname, '..', 'data', 'imported-city');
  const read = name => JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));
  const manifest = read('manifest.json');
  const city = ImportedCity.create(manifest, read('overview.json'), read('terrain.json'));
  const centers = deriveCenters(city);
  assert.equal(manifest.centerCandidates.length, 7);
  assert.deepEqual(centers.slice(0, 7).map(center => center.title), [
    'Downtown Core', 'North Center', 'Terminus District', 'Northeast Center',
    'Northwest Center', 'Campus District', 'East Center'
  ]);
  for (const center of centers.slice(0, 7)) {
    const street = city.networkRoads.find(road => road.id === center.roadId);
    assert.ok(street, `${center.title} has a source road`);
    assert.equal(street.mode, 'GROUND', `${center.title} is at street level`);
    assert.doesNotMatch(street.roadClass, /highway|motorway|freeway/i);
    assert.ok(center.distance <= 150, `${center.title} stays near its dense neighborhood`);
  }
});

test('seventeen extra street jumps cover safe, distinct roads across the city', () => {
  const base = path.join(__dirname, '..', 'data', 'imported-city');
  const read = name => JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));
  const manifest = read('manifest.json');
  const city = ImportedCity.create(manifest, read('overview.json'), read('terrain.json'));
  const centers = deriveCenters(city);
  assert.equal(manifest.centerCandidates.length, 7, 'the familiar center destinations stay intact');
  assert.equal(manifest.travelCandidates.length, 17);
  assert.deepEqual(manifest.travelCandidates, generateTravelCandidates(city, 17,
    tile => read(tile.file)),
    'reconverting the save reproduces the street destinations');
  assert.equal(centers.length, 24, 'all centers and new street jumps are available');
  assert.ok(centers.slice(7).every((center, index) => center.kind === 'street' &&
    center.title.startsWith(manifest.travelCandidates[index].roadName)),
  'the road names come from the exported city');
  const visitedRoads = new Set();
  for (const center of centers.slice(7)) {
    const road = city.networkRoads.find(item => item.id === center.roadId);
    assert.ok(road, `${center.title} lands on an exported road`);
    assert.equal(road.mode, 'GROUND', `${center.title} is at street level`);
    assert.doesNotMatch(road.roadClass, /highway|motorway|freeway|express/i);
    assert.ok(center.distance <= 1, `${center.title} snaps to its road midpoint`);
    const clearance = center.y - city.terrainHeight(center.x, center.z);
    assert.ok(clearance >= -.25 && clearance <= .5,
      `${center.title} is clear of terrain/tunnel height conflicts: ${clearance}`);
    const rightX = Math.cos(center.heading), rightZ = -Math.sin(center.heading);
    const lateral = (center.x - center.mapX) * rightX +
      (center.z - center.mapZ) * rightZ;
    assert.ok(lateral >= 1.3 && lateral <= road.width / 2 - 2,
      `${center.title} lands within a right-side driving lane: ${lateral}`);
    visitedRoads.add(center.roadId);
  }
  assert.equal(visitedRoads.size, 17, 'each added jump reaches a different road');
  const east = centers.slice(7).map(center => center.x);
  const north = centers.slice(7).map(center => center.z);
  assert.ok(Math.min(...east) < -3000 && Math.max(...east) > 6000 &&
    Math.min(...north) < -3800 && Math.max(...north) > 3900,
  'street jumps reach western, eastern, southern, and northern districts');
});

test('each new street jump spawns on the detailed road without an obstacle collider', async () => {
  const city = await ImportedCity.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () =>
      JSON.parse(fs.readFileSync(path.join(__dirname, '..', url), 'utf8')) })
  });
  const destinations = deriveCenters(city).filter(center => center.kind === 'street');
  const physics = Physics.create({ map: 'city',
    city: { ...city, ensureNear: () => Promise.resolve([]) },
    distanceToRoad: city.distanceToRoad, roadHalfWidth: city.roadHalfWidth });
  try {
    for (const center of destinations) {
      await city.ensureNear(center.x, center.z, 160);
      physics.reset(center.x, center.z, center.heading);
      assert.ok(Math.abs(physics.roadHeight(center.x, center.z) - center.y) < .5,
        `${center.title} agrees with the detailed road height`);
      const intrusions = [];
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]])
        physics.world.raycastAll(
          new C.Vec3(center.x + dx, physics.body.position.y + 2, center.z + dz),
          new C.Vec3(center.x + dx, physics.body.position.y - 1, center.z + dz), {}, hit => {
            if (['building', 'guardrail', 'support'].includes(hit.body?.citySource?.kind))
              intrusions.push(hit.body.citySource);
          });
      assert.deepEqual(intrusions, [], `${center.title} does not spawn in a building or barrier`);
      let state;
      for (let i = 0; i < 90; i++) state = physics.step(1 / 60, {});
      assert.ok(state.grounded, `${center.title} settles on its road`);
      assert.ok(Math.hypot(physics.body.position.x - center.x,
        physics.body.position.z - center.z) < 2,
      `${center.title} stays at the landing spot while settling`);
    }
  } finally { physics.dispose(); }
});
