'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const THREE = require('three');
const C = require('cannon');
const Imported = require('../js/imported-city');
const Physics = require('../js/physics');

async function loadAt(x, z) {
  const root = path.resolve(__dirname, '..');
  const map = await Imported.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () =>
      JSON.parse(await fs.readFile(path.join(root, url), 'utf8')) })
  });
  const world = new THREE.Group(), visual = map.build(THREE, world);
  await map.ensureNear(x, z, 90);
  visual.update({ position: { x, y: 30, z } }, 0);
  return { map, world, visual };
}

function heightsAt(world, name, x, z) {
  const heights = [];
  world.traverse(object => {
    if (object.name !== name) return;
    const p = object.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const ax = p.getX(i), az = p.getZ(i);
      const bx = p.getX(i + 1), bz = p.getZ(i + 1);
      const cx = p.getX(i + 2), cz = p.getZ(i + 2);
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-7) continue;
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
      const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
      if (u < -.001 || v < -.001 || u + v > 1.001) continue;
      heights.push(u * p.getY(i) + v * p.getY(i + 1) + (1 - u - v) * p.getY(i + 2));
    }
  });
  return heights;
}

test('Cobblestone and Florence native merge has no floating centerline deck over its driveable lanes', async () => {
  const x = 5725.502, z = 1230.501;
  const { map, world, visual } = await loadAt(x, z);
  try {
    const site = map.loadedTiles.get('11,2').data.elevatedMerges
      .find(item => item.nodeId === '3025219');
    assert.ok(site, 'real 3+1 to 4 lane elevated junction is recognized');
    for (const [px, pz] of [[x, z], [5706.334, 1237.031]]) {
      const lanes = heightsAt(world, 'imported-city-lane-connector', px, pz);
      const slabs = heightsAt(world, 'imported-city-highway', px, pz);
      assert.ok(lanes.length, `native lane deck covers ${px},${pz}`);
      assert.ok(slabs.every(y => y <= Math.max(...lanes) + .5),
        `source centerline slab no longer floats above lane deck at ${px},${pz}: ${slabs}`);
    }
    for (const id of ['530983', '531237', '530763']) {
      const slabs = map.highwaySegments.filter(road => road.id === id);
      assert.ok(slabs.some(road => road.visibleIntervals?.length === 0),
        `conflicting ${id} deck is removed at the native merge`);
    }
    const lanes = map.loadedTiles.get('11,2').data.edgeLanes;
    const first = lanes.find(lane => lane.entity_id === 599588).approachSamples.at(-1);
    const next = lanes.find(lane => lane.entity_id === 599606).approachSamples[0];
    assert.ok(Math.hypot(first.x - next.x, first.z - next.z) < .01);
    assert.ok(Math.abs(first.y - next.y) < .02,
      'adjacent one-lane ramp sections meet without a vertical seam');
  } finally { visual.dispose(); }
});

test('Highland width change and sharp bend keep a continuous lane grade over the lower street', async () => {
  const { map, world, visual } = await loadAt(5605, 730);
  try {
    const tile = map.loadedTiles.get('10,1').data;
    for (const nodeId of ['3024861', '3025221'])
      assert.ok(tile.elevatedMerges.some(site => site.nodeId === nodeId),
        `native graph covers raised Highland node ${nodeId}`);
    const before = heightsAt(world, 'imported-city-lane-connector', 5604.375, 721.782);
    const after = heightsAt(world, 'imported-city-lane-connector', 5604.158, 721.635);
    assert.ok(before.length && after.length, 'both sides of the exported lane step are paved');
    assert.ok(Math.abs(Math.max(...after) - Math.max(...before)) < .5,
      `the 3.13m rise over 0.26m is repaired: ${before}, ${after}`);
    assert.ok(tile.highways.filter(road => road.id === '530761')
      .every(road => road.visibleIntervals?.length === 0),
    'the source centerline wedge no longer overlays the graph lanes');
    for (const id of [4385988, 4387059, 4385156, 4386129]) {
      const connector = tile.ownedConnectors.find(item => item.entity_id === id);
      assert.ok(connector, `native Highland connector ${id} is present`);
      for (let i = 0; i < connector.samples.length; i += 2) {
        const sample = connector.samples[i];
        const heights = heightsAt(world, 'imported-city-lane-connector', sample.x, sample.z);
        assert.ok(heights.some(y => Math.abs(y - sample.y) < .25),
          `Highland connector ${id} has continuous deck at sample ${i}`);
      }
    }
  } finally { visual.dispose(); }
});

test('Cobblestone ground-to-ramp connector meets both road decks without a two-metre step', async () => {
  const { map, world, visual } = await loadAt(5687, 1247);
  try {
    const connector = map.nearbyLaneConnectors(5687, 1247, 20)
      .find(item => item.entity_id === 3304713);
    assert.ok(connector, 'native mixed-mode ramp connector is loaded');
    assert.ok(connector.samples[0].sourceY > 4.5 &&
      connector.samples.at(-1).sourceY > 4.4,
    'both mouths meet the exported road deck rather than lying two metres below it');
    for (const sample of [connector.samples[0], connector.samples.at(-1)]) {
      const pavement = heightsAt(world, 'imported-city-lane-connector', sample.x, sample.z);
      assert.ok(pavement.some(y => Math.abs(y - sample.y) < .2),
        'the regraded connector is visibly paved at its mouth');
    }
  } finally { visual.dispose(); }
});

test('shared-edge lane merges have one driveable grade without moving their native mouths', async () => {
  const cases = [
    { id: 4000018, x: 5373.706, z: -433.629 },
    { id: 4386765, x: 6274.619, z: -1996.56 }
  ];
  for (const { id, x, z } of cases) {
    const { map, world, visual } = await loadAt(x, z);
    const physics = Physics.create({ map: 'city',
      city: { ...map, ensureNear: () => Promise.resolve([]) },
      distanceToRoad: map.distanceToRoad, roadHalfWidth: map.roadHalfWidth });
    try {
      const connector = map.nearbyLaneConnectors(x, z, 40)
        .find(item => item.entity_id === id);
      assert.ok(connector, `native connector ${id} is present`);
      const first = connector.samples[0], last = connector.samples.at(-1);
      assert.ok(Math.abs(first.sourceY - connector.curve[0][1]) < .01 &&
        Math.abs(last.sourceY - connector.curve[3][1]) < .01,
      `connector ${id} keeps both native lane mouths`);
      let maxGrade = 0;
      for (let i = 1; i < connector.samples.length; i++) {
        const a = connector.samples[i - 1], b = connector.samples[i];
        maxGrade = Math.max(maxGrade, Math.abs(b.sourceY - a.sourceY) /
          Math.hypot(b.x - a.x, b.z - a.z));
      }
      assert.ok(maxGrade < .45, `connector ${id} grade stays driveable: ${maxGrade}`);
      const sample = connector.samples.reduce((best, point) =>
        Math.hypot(point.x - x, point.z - z) < Math.hypot(best.x - x, best.z - z) ?
          point : best, first);
      const drawn = heightsAt(world, 'imported-city-lane-connector', sample.x, sample.z);
      assert.ok(drawn.some(y => Math.abs(y - sample.y) < .2),
        `connector ${id} visual deck follows its repaired grade`);
      physics.reset(x, z);
      const hit = new C.RaycastResult();
      assert.ok(physics.world.raycastClosest(
        new C.Vec3(sample.x, sample.y + 1.4, sample.z),
        new C.Vec3(sample.x, sample.y - 1.4, sample.z), {}, hit));
      assert.ok(hit.hitPointWorld.y - sample.y < .5,
        `connector ${id} has no higher lane slab across the car's path`);
    } finally { physics.dispose(); visual.dispose(); }
  }
});

test('a neighboring tile does not project its road deck over a native lane mouth', async () => {
  const { map, visual } = await loadAt(5645, 807);
  try {
    const approaches = map.nearbyLaneApproaches(5645, 807, 30)
      .filter(item => item.entity_id === 5347654 &&
        Math.hypot(item.samples[0].x - 5647.356,
          item.samples[0].z - 805.74) < .01);
    assert.ok(approaches.length >= 2, 'both neighboring graph tiles cover the lane');
    for (const approach of approaches)
      assert.ok(Math.abs(approach.samples[0].sourceY - 10.411) < .12,
        'the terminal stays at its native y10.411 across the tile boundary');
  } finally { visual.dispose(); }
});

test('a grade-conflicted ground junction follows its native lane through visual and physical cuts', async () => {
  const x = 2704.826, z = -2947.105;
  const { map, world, visual } = await loadAt(x, z);
  const physics = Physics.create({ map: 'city',
    city: { ...map, ensureNear: () => Promise.resolve([]) },
    distanceToRoad: map.distanceToRoad, roadHalfWidth: map.roadHalfWidth });
  try {
    const tile = map.loadedTiles.get('5,-6').data;
    assert.ok(tile.groundGradeConflicts.some(site => site.nodeId === '5349483'),
      'the three-arm native graph identifies the centerline grade conflict');
    const connector = map.nearbyLaneConnectors(x, z, 40)
      .find(item => item.entity_id === 3183819);
    assert.ok(connector, 'the permitted turn remains driveable');
    const mouth = connector.samples[0];
    assert.ok(heightsAt(world, 'imported-city-lane-connector', x, z)
      .some(y => Math.abs(y - mouth.y) < .2), 'native turn has visible pavement');
    for (const name of ['imported-city-road', 'imported-city-junction-approach'])
      assert.ok(heightsAt(world, name, x, z).every(y => y < mouth.y + .5),
        `${name} does not overlay the lower legal turn`);
    assert.ok(tile.roads.some(road => road.id === '5339610' &&
      Array.isArray(road.visibleIntervals)),
    'physical road intervals match the graph cut');
    physics.reset(x, z);
    for (const sample of connector.samples) {
      const hit = new C.RaycastResult();
      assert.ok(physics.world.raycastClosest(
        new C.Vec3(sample.x, sample.y + 1.4, sample.z),
        new C.Vec3(sample.x, sample.y - 1.4, sample.z), {}, hit),
      'there is physical pavement across the complete turn');
      assert.ok(Math.abs(hit.hitPointWorld.y - sample.y) < .3,
        'physical pavement follows the drawn native turn grade');
    }
  } finally { physics.dispose(); visual.dispose(); }
});
