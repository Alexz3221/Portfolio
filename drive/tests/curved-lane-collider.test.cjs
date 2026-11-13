'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const THREE = require('three');
const C = require('cannon');
const Imported = require('../js/imported-city');
const Physics = require('../js/physics');

test('a curved connector has no invisible box above its rendered ribbon', async () => {
  const root = path.resolve(__dirname, '..');
  const map = await Imported.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () =>
      JSON.parse(await fs.readFile(path.join(root, url), 'utf8')) })
  });
  const x = 5695.81, z = 683.39;
  await map.ensureNear(x, z, 400);
  // Keep this already loaded junction while the renderer initializes its
  // separate portfolio spawn, just as the streamed browser keeps nearby tiles.
  map.ensureNear = () => Promise.resolve([]);
  const world = new THREE.Group();
  const visual = map.build(THREE, world);
  const physics = Physics.create({ map: 'city', city: map,
    distanceToRoad: map.distanceToRoad, roadHalfWidth: map.roadHalfWidth });
  try {
    physics.reset(x, z);
    physics.step(1 / 60, {});
    world.updateMatrixWorld(true);
    const visible = new THREE.Raycaster(new THREE.Vector3(x, 100, z),
      new THREE.Vector3(0, -1, 0), 0, 200)
      .intersectObjects(world.children, true)
      .find(hit => hit.object.name === 'imported-city-lane-connector');
    assert.ok(visible, 'the curved lane ribbon is visible');
    assert.ok(visible.point.y > map.terrainHeight(x, z) + 10,
      'terrain cannot support this elevated lane');
    const physical = [];
    physics.world.raycastAll(new C.Vec3(x, 100, z),
      new C.Vec3(x, -100, z), {}, hit => {
        if (['road', 'highway', 'connector', 'approach'].includes(
          hit.body.citySource?.kind))
          physical.push({ y: hit.hitPointWorld.y, source: hit.body.citySource });
      });
    assert.ok(physical.some(hit => Math.abs(hit.y - visible.point.y) < .1),
      'the visible ribbon has matching physical support');
    assert.ok(physical.every(hit => hit.y <= visible.point.y + .12),
      'a chord-aligned connector box must not protrude above the curved lane');
  } finally {
    physics.dispose();
    visual.dispose();
  }
});
