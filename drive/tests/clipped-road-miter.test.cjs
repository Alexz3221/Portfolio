'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const THREE = require('three');
const C = require('cannon');
const Imported = require('../js/imported-city');
const Physics = require('../js/physics');

test('a trimmed curved elevated road keeps collision beneath its visible edge', async () => {
  const root = path.resolve(__dirname, '..');
  const map = await Imported.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () =>
      JSON.parse(await fs.readFile(path.join(root, url), 'utf8')) })
  });
  await map.ensureNear(3200, -221, 250);
  const world = new THREE.Group();
  const visual = map.build(THREE, world);
  const physics = Physics.create({ map: 'city', city: map,
    distanceToRoad: map.distanceToRoad, roadHalfWidth: map.roadHalfWidth });
  try {
    physics.reset(3200, -221);
    physics.step(1 / 60, {});
    const road = map.highwaySegments.find(segment =>
      String(segment.id) === '5264175' &&
      segment.visibleIntervals?.[0]?.[0] > .1);
    assert.ok(road, 'the real elevated road has a graph cutback');
    const t = road.visibleIntervals[0][0] + .006;
    const side = -.95;
    const miter = [0, 1].map(axis => road.startMiter[axis] * (1 - t) +
      road.endMiter[axis] * t);
    const x = road.x1 + (road.x2 - road.x1) * t + miter[0] * side * road.width / 2;
    const z = road.z1 + (road.z2 - road.z1) * t + miter[1] * side * road.width / 2;
    world.updateMatrixWorld(true);
    const visible = new THREE.Raycaster(new THREE.Vector3(x, 50, z),
      new THREE.Vector3(0, -1, 0), 0, 100)
      .intersectObjects(world.children, true)
      .find(hit => hit.object.name === 'imported-city-highway');
    assert.ok(visible, 'the outer edge is visibly paved');
    assert.ok(visible.point.y > map.terrainHeight(x, z) + 5,
      'the pavement needs bridge collision, not terrain support');
    const physical = [];
    physics.world.raycastAll(new C.Vec3(x, 50, z),
      new C.Vec3(x, -50, z), {}, hit => {
        if (hit.body.citySource?.kind === 'highway' &&
            String(hit.body.citySource.id) === String(road.id))
          physical.push(hit.hitPointWorld.y);
      });
    assert.ok(physical.some(y => Math.abs(y - visible.point.y) < .1),
      'the mitered physical deck supports the visible edge');
  } finally {
    physics.dispose();
    visual.dispose();
  }
});
