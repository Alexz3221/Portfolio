'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const THREE = require('three');
const Imported = require('../js/imported-city');

async function loadCity() {
  const root = path.resolve(__dirname, '..');
  return Imported.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () =>
      JSON.parse(await fs.readFile(path.join(root, url), 'utf8')) })
  });
}

function loaded(map, kind) {
  return [...map.loadedTiles.values()].filter(tile => tile.state === 'loaded')
    .flatMap(tile => tile.data[kind] || []);
}

test('Bayview centerline lies between native opposing lanes, not on the other side', async () => {
  const map = await loadCity();
  const world = new THREE.Group(), visual = map.build(THREE, world);
  try {
    const x = 3300, z = -3735;
    await map.ensureNear(x, z, 320);
    visual.update({ position: { x, y: map.terrainHeight(x, z) + 25, z } }, 0);
    const road = loaded(map, 'roads').filter(item => String(item.id) === '5338074')
      .sort((a, b) => Math.hypot(b.x2 - b.x1, b.z2 - b.z1) -
        Math.hypot(a.x2 - a.x1, a.z2 - a.z1))[0];
    assert.ok(road, 'real Bayview segment is loaded');
    const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
    const length = Math.hypot(dx, dz), lengthSquared = length * length;
    const project = (px, pz) => {
      const t = ((px - road.x1) * dx + (pz - road.z1) * dz) / lengthSquared;
      const lateral = ((px - road.x1) * dz - (pz - road.z1) * dx) / length;
      return { t, lateral };
    };
    const nativeLanes = [...new Map(loaded(map, 'edgeLanes')
      .filter(lane => String(lane.edge_id) === '5338074')
      .map(lane => [lane.entity_id, lane])).values()]
      .map(lane => {
        const first = lane.curve[0], last = lane.curve[3];
        const midpoint = [(first[0] + last[0]) / 2, (first[2] + last[2]) / 2];
        return { ...project(...midpoint), direction: Math.sign(
          (last[0] - first[0]) * dx + (last[2] - first[2]) * dz) };
      }).filter(lane => lane.t > .15 && lane.t < .35 && Math.abs(lane.lateral) < 8)
      .sort((a, b) => a.lateral - b.lateral);
    const boundary = nativeLanes.findIndex((lane, index) => index > 0 &&
      lane.direction !== nativeLanes[index - 1].direction);
    assert.ok(boundary > 0, 'native curves identify the opposing traffic boundary');
    const expected = (nativeLanes[boundary - 1].lateral + nativeLanes[boundary].lateral) / 2;
    const yellow = [];
    world.traverse(object => {
      if (object.name !== 'imported-city-yellow-marking') return;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const at = project(positions.getX(i), positions.getZ(i));
        if (at.t > .15 && at.t < .35 && Math.abs(at.lateral) < 6)
          yellow.push(at.lateral);
      }
    });
    assert.ok(yellow.length > 20, 'double yellow paint is present on the actual road');
    const painted = yellow.reduce((sum, offset) => sum + offset, 0) / yellow.length;
    assert.ok(Math.abs(painted - expected) < .35,
      `painted centerline ${painted.toFixed(2)}m matches native lane boundary ${expected.toFixed(2)}m`);
  } finally { visual.dispose(); }
});

test('exceptional crossing paths do not become ordinary turn arrows', async () => {
  const map = await loadCity();
  const world = new THREE.Group(), visual = map.build(THREE, world);
  try {
    const x = 2099, z = -2364;
    await map.ensureNear(x, z, 280);
    visual.update({ position: { x, y: map.terrainHeight(x, z) + 25, z } }, 0);
    const crossing = map.nearbyLaneConnectors(x, z, 60)
      .find(connector => connector.entity_id === 4572382);
    assert.ok(crossing?.unsafe, 'the exceptional Brookhaven crossing remains in the native graph');
    const arrows = [];
    world.traverse(object => {
      if (object.name === 'imported-city-turn-arrow')
        arrows.push(...(object.userData.turnArrows || []));
    });
    const source = arrows.find(record => record.roadId === '3375608' &&
      record.laneIndex === 2 && Math.hypot(record.x - x, record.z - z) < 80);
    assert.ok(source, 'the incoming lane still has a painted instruction');
    assert.ok(source.connectorIds.includes('4572424'), 'ordinary connector is retained');
    assert.ok(!source.connectorIds.includes('4572382'),
      'opposing-carriageway shortcut is not advertised as an ordinary turn');
  } finally { visual.dispose(); }
});
