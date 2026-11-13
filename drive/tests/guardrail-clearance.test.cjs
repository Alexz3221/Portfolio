'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const C = require('cannon');
const Imported = require('../js/imported-city');
const Physics = require('../js/physics');

async function loadCity() {
  const root = path.resolve(__dirname, '..');
  return Imported.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () =>
      JSON.parse(await fs.readFile(path.join(root, url), 'utf8')) })
  });
}

function railHitsCarLane(rail, point) {
  const length = rail.length * Math.cos(rail.pitch || 0);
  const dx = Math.sin(rail.yaw || 0), dz = Math.cos(rail.yaw || 0);
  const along = Math.max(-length / 2, Math.min(length / 2,
    (point.x - rail.x) * dx + (point.z - rail.z) * dz));
  const x = rail.x + dx * along, z = rail.z + dz * along;
  const railY = rail.y - Math.tan(rail.pitch || 0) * along;
  return Math.hypot(point.x - x, point.z - z) < 1.1 &&
    point.y + 1.7 > railY - rail.height / 2 &&
    point.y - .3 < railY + rail.height / 2;
}

test('Cornfield merge has no generated guardrail across permitted lane centers', async () => {
  const map = await loadCity();
  await map.ensureNear(5632, 815, 150);
  const laneCenters = [
    { connectorId: 4388534, x: 5630.721, y: 11.271, z: 812.178 },
    { connectorId: 4385485, x: 5633.443, y: 10.980, z: 817.425 }
  ];
  const connectors = map.nearbyLaneConnectors(5632, 815, 50);
  const rails = map.nearbyGuardrails(5632, 815, 50);
  for (const point of laneCenters) {
    assert.ok(connectors.some(connector => connector.entity_id === point.connectorId),
      `native permitted connector ${point.connectorId} is present`);
    assert.ok(!rails.some(rail => railHitsCarLane(rail, point)),
      `no guardrail blocks permitted connector ${point.connectorId}`);
  }
  // Prevent Physics.create's initial spawn request from evicting this distant
  // tile while the ray checks its actual driveable collision surface.
  const physics = Physics.create({ map: 'city', city: { ...map, ensureNear: () => Promise.resolve([]) },
    distanceToRoad: map.distanceToRoad, roadHalfWidth: map.roadHalfWidth });
  try {
    physics.reset(5632, 815);
    for (const point of laneCenters) {
      const hit = new C.RaycastResult();
      assert.ok(physics.world.raycastClosest(new C.Vec3(point.x, 30, point.z),
        new C.Vec3(point.x, -10, point.z), {}, hit));
      assert.ok(hit.hitPointWorld.y > point.y - .2 && hit.hitPointWorld.y < point.y + 1,
        `collision follows connector ${point.connectorId} without a raised wall`);
    }
  } finally { physics.dispose(); }
});

test('Chestnut bend has no guardrail across its native turn lane', async () => {
  const map = await loadCity();
  await map.ensureNear(6022, -50, 150);
  const connector = map.nearbyLaneConnectors(6022, -50, 40)
    .find(item => item.entity_id === 3304659);
  assert.ok(connector, 'native Chestnut turn connector is present');
  const rails = map.nearbyGuardrails(6022, -50, 45);
  for (const sample of connector.samples) {
    assert.ok(!rails.some(rail => railHitsCarLane(rail, sample)),
      'no guardrail blocks the Chestnut turn lane');
  }
});

test('Highland bridge collider smooths the malformed native lane height step', async () => {
  const map = await loadCity();
  await map.ensureNear(5605, 730, 150);
  const physics = Physics.create({ map: 'city', city: { ...map, ensureNear: () => Promise.resolve([]) },
    distanceToRoad: map.distanceToRoad, roadHalfWidth: map.roadHalfWidth });
  try {
    physics.reset(5605, 730);
    const height = (x, z) => {
      const hit = new C.RaycastResult();
      assert.ok(physics.world.raycastClosest(new C.Vec3(x, 30, z),
        new C.Vec3(x, -10, z), {}, hit));
      return hit.hitPointWorld.y;
    };
    const before = height(5604.375, 721.782);
    const after = height(5604.158, 721.635);
    assert.ok(before > 13 && after > 13, 'raised bridge is solid above the lower street');
    assert.ok(Math.abs(after - before) < .5,
      `physical deck has no 3m cliff over 26cm: ${before}, ${after}`);
  } finally { physics.dispose(); }
});

test('Cornfield ramp handoff eases from the road collider onto its lane approach', async () => {
  const map = await loadCity();
  await map.ensureNear(5676, 803, 150);
  const road = map.highwaySegments.filter(item => item.id === '530495')
    .sort((a, b) => Math.abs((b.y2 - b.y1) / Math.hypot(b.x2 - b.x1, b.z2 - b.z1)) -
      Math.abs((a.y2 - a.y1) / Math.hypot(a.x2 - a.x1, a.z2 - a.z1)))[0];
  assert.ok(road, 'the exported steep Cornfield ramp exists');
  assert.ok(map.nearbyLaneApproaches(5676, 803, 35)
    .some(item => item.entity_id === 5344686), 'the native approach is rendered');
  const physics = Physics.create({ map: 'city', city: { ...map, ensureNear: () => Promise.resolve([]) },
    distanceToRoad: map.distanceToRoad, roadHalfWidth: map.roadHalfWidth });
  try {
    physics.reset(5676, 803);
    const heights = [];
    for (let i = 0; i <= 24; i++) {
      const t = .42 + i * .013;
      const x = road.x1 + (road.x2 - road.x1) * t;
      const z = road.z1 + (road.z2 - road.z1) * t;
      const hit = new C.RaycastResult();
      assert.ok(physics.world.raycastClosest(new C.Vec3(x, 12, z),
        new C.Vec3(x, -5, z), {}, hit), `the ramp is solid at station ${i}`);
      heights.push({ x, z, y: hit.hitPointWorld.y });
    }
    const grades = heights.slice(1).map((sample, i) =>
      Math.abs(sample.y - heights[i].y) /
      Math.hypot(sample.x - heights[i].x, sample.z - heights[i].z));
    assert.ok(Math.max(...grades) < .56,
      `the road-to-approach collider seam is eased: ${Math.max(...grades)}`);
  } finally { physics.dispose(); }
});

test('curved Ashridge lane collider covers its tail beyond the compound body center', async () => {
  const map = await loadCity();
  await map.ensureNear(6287, -2267, 150);
  const connector = map.nearbyLaneConnectors(6287, -2267, 40)
    .find(item => item.entity_id === 4385905);
  assert.ok(connector, 'native curved connector is present');
  const sample = connector.samples[14];
  const physics = Physics.create({ map: 'city', city: { ...map, ensureNear: () => Promise.resolve([]) },
    distanceToRoad: map.distanceToRoad, roadHalfWidth: map.roadHalfWidth });
  try {
    physics.reset(6287, -2267);
    const hit = new C.RaycastResult();
    assert.ok(physics.world.raycastClosest(
      new C.Vec3(sample.x, sample.y + 1, sample.z),
      new C.Vec3(sample.x, sample.y - 1, sample.z), {}, hit),
    'the far end of a bent connector remains in the physics broadphase');
    assert.ok(Math.abs(hit.hitPointWorld.y - sample.y) < .2,
      'the tire contact agrees with the drawn lane at the curve tail');
  } finally { physics.dispose(); }
});
