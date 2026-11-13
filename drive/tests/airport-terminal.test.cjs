'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const C = require('cannon');
const THREE = require('three');
const Imported = require('../js/imported-city');
const Physics = require('../js/physics');

const airportRoads = ['530304', '530305', '530306', '3765898', '3765899',
  '3765900', '3765901', '3765902', '3765903', '3765904', '3765905'];

async function city() {
  const root = path.resolve(__dirname, '..');
  return Imported.load('data/imported-city/manifest.json', {fetch: async url => ({
    ok: true, json: async () => JSON.parse(await fs.readFile(path.join(root, url), 'utf8'))
  })});
}

function pointInside(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
        point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function rayTop(physics, x, z, y) {
  const result = new C.RaycastResult();
  assert.ok(physics.world.raycastClosest(new C.Vec3(x, y + 45, z),
    new C.Vec3(x, y - 15, z), {}, result), `driveable road at ${x}, ${z}`);
  return result.hitPointWorld.y;
}

test('the airport site is open to ground and elevated terminal dropoff roads', async () => {
  const map = await city();
  const world = new THREE.Group(), visual = map.build(THREE, world);
  await map.ensureNear(5900, -2950, 700);
  visual.update({position: {x: 5900, y: 70, z: -2950}}, 0);
  const buildings = [...map.loadedTiles.values()].filter(tile => tile.state === 'loaded')
    .flatMap(tile => tile.data.buildings);
  const parent = buildings.find(item => String(item.id) === '189437');
  const proxy = buildings.find(item => String(item.id) === '2147483633');
  const parts = buildings.filter(item => String(item.id).startsWith('2147483633:'));
  assert.ok(parent?.skipVisual && parent.skipCollider, 'airfield envelope stays non-solid');
  assert.ok(proxy?.skipVisual && proxy.skipCollider, 'giant mesh bounds stay non-solid');
  assert.equal(parts.length, 10, 'terminal pods, concourses, tower, and entrance canopies replace the box');
  assert.equal(parts.filter(item => /Dropoff Canopy/.test(item.prefab) && item.skipCollider).length, 3,
    'three open curbside entrance canopies do not block the road beneath them');

  const roadSet = new Set(airportRoads);
  const roads = [...map.loadedTiles.values()].filter(tile => tile.state === 'loaded')
    .flatMap(tile => [...tile.data.roads, ...tile.data.highways])
    .filter(road => roadSet.has(String(road.id)));
  assert.deepEqual([...new Set(roads.map(road => String(road.id)))].sort(), airportRoads.sort(),
    'all eleven exported terminal approach roads are present');
  await map.ensureNear(6123, -3155, map.tileSize * 1.05);
  assert.ok(map.nearbyBuildings(6123, -3155, 550)
    .some(item => String(item.id) === '2147483633:terminal-center'),
  'terminal remains streamed at the far end of the dropoff loop');
  for (const road of roads) {
    const x = (road.x1 + road.x2) / 2, z = (road.z1 + road.z2) / 2;
    const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
    const length = Math.hypot(dx, dz);
    if (length < .1) continue;
    for (const offset of [-road.width / 2 + 1.5, 0, road.width / 2 - 1.5]) {
      const px = x + dz / length * offset, pz = z - dx / length * offset;
      assert.ok(!parts.some(part => !part.skipCollider &&
        pointInside([px, pz], part.footprint)),
      `terminal mass stays off road ${road.id} at ${px}, ${pz}`);
    }
  }

  const physics = Physics.create({map: 'city', city: map});
  try {
    for (const id of airportRoads) {
      const segments = roads.filter(road => String(road.id) === id)
        .sort((a, b) => a.pathDistance - b.pathDistance);
      const road = segments[Math.floor(segments.length / 2)];
      const x = (road.x1 + road.x2) / 2, z = (road.z1 + road.z2) / 2;
      physics.reset(x, z);
      await map.ensureNear(x, z, 280);
      physics.reset(x, z);
      physics.body.position.set(0, 10000, 0);
      const deck = (road.y1 + road.y2) / 2;
      const top = rayTop(physics, x, z, deck);
      assert.ok(top <= deck + 1.2,
        `road ${id} has no airport wall above its deck: ${top} vs ${deck}`);
    }
  } finally { physics.dispose(); visual.dispose(); }
});
