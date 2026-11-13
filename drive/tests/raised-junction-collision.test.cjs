'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const THREE = require('three');
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

function junctionVisual(world, x, z) {
  world.updateMatrixWorld(true);
  const meshes = [];
  world.traverse(object => {
    if (object.isMesh && object.name === 'imported-city-junction') meshes.push(object);
  });
  return new THREE.Raycaster(new THREE.Vector3(x, 100, z),
    new THREE.Vector3(0, -1, 0), 0, 200)
    .intersectObjects(meshes, false)[0]?.point.y;
}

function wheelContact(physics, x, z) {
  const result = new C.RaycastResult();
  const previousResponse = physics.body.collisionResponse;
  physics.body.collisionResponse = false;
  physics.world.rayTest(new C.Vec3(x, 100, z),
    new C.Vec3(x, -100, z), result);
  physics.body.collisionResponse = previousResponse;
  return result;
}

test('raised exported junction fill supports wheel rays and a complete car crossing', async () => {
  const x = 5293.29, z = -1527.04;
  const map = await loadCity();
  const originalEnsureNear = map.ensureNear.bind(map);
  await originalEnsureNear(x, z, 180);
  map.ensureNear = () => Promise.resolve([]);
  // Browser physics is created before visual tiles. The geometry version must
  // mount these newly rendered collision faces on the next physics step.
  const physics = Physics.create({ map: 'city', city: map,
    distanceToRoad: map.distanceToRoad, roadHalfWidth: map.roadHalfWidth });
  const world = new THREE.Group();
  let visual;
  try {
    physics.reset(x, z);
    const initialVersion = map.collisionGeometryVersion || 0;
    visual = map.build(THREE, world);
    visual.update({ position: { x, y: 0, z } }, 0);
    assert.ok((map.collisionGeometryVersion || 0) > initialVersion);
    physics.step(1 / 60, {});

    const surfaces = map.nearbyJunctionSurfaces(x, z, 90);
    assert.equal(surfaces.length, 1, 'only this nearby junction enters the local physics set');
    const body = physics.world.bodies.find(item => item.citySource?.id === surfaces[0].id);
    assert.ok(body, 'one static body supports the raised junction');
    const mesh = body.shapes[0];
    assert.equal(mesh.type, C.Shape.types.TRIMESH);
    const pending = [mesh.tree];
    let indexedTriangles = 0;
    while (pending.length) {
      const node = pending.pop();
      indexedTriangles += node.data.length;
      pending.push(...node.children);
    }
    assert.equal(indexedTriangles, mesh.indices.length / 3,
      'Cannon spatial tree retains every rendered triangle');

    for (const [px, pz] of [[x, z], [5288, -1528],
      [5285, -1519], [5293, -1518]]) {
      const visibleY = junctionVisual(world, px, pz);
      const hit = wheelContact(physics, px, pz);
      assert.ok(Number.isFinite(visibleY) && visibleY > map.terrainHeight(px, pz) + .35,
        `junction pavement is visibly raised at ${px}, ${pz}`);
      assert.equal(hit.body?.citySource?.kind, 'junction',
        `wheel ray reaches raised fill at ${px}, ${pz}`);
      assert.ok(Math.abs(hit.hitPointWorld.y - visibleY) < .02,
        `physical and visual junction heights agree at ${px}, ${pz}`);
    }

    physics.reset(x, -1538, 0);
    let crossingFrames = 0, minimumContacts = 4;
    for (let frame = 0; frame < 240; frame++) {
      const state = physics.step(1 / 60, { throttle: frame > 35 ? 1 : 0 });
      if (physics.body.position.z > -1534 && physics.body.position.z < -1515) {
        crossingFrames++;
        minimumContacts = Math.min(minimumContacts, state.grounded);
      }
    }
    assert.ok(crossingFrames > 40 && physics.body.position.z > -1515,
      'car crosses the raised fill without stopping at a hidden edge');
    assert.ok(minimumContacts >= 2, 'suspension keeps wheel support across the fill');

    physics.reset(x, -1300);
    assert.ok(!physics.world.bodies.some(item => item.citySource?.id === surfaces[0].id),
      'junction body leaves the physics set beyond its local radius');
    physics.reset(x, z);
    assert.ok(physics.world.bodies.some(item => item.citySource?.id === surfaces[0].id));

    map.trimFar(-99999, -99999, 0);
    physics.step(1 / 60, {});
    assert.equal(map.nearbyJunctionSurfaces(x, z, 10).length, 0);
    assert.ok(!physics.world.bodies.some(item => item.citySource?.id === surfaces[0].id),
      'tile unload removes the physical junction');
    await originalEnsureNear(x, z, 180);
    visual.update({ position: { x, y: 0, z } }, 0);
    physics.step(1 / 60, {});
    assert.ok(wheelContact(physics, x, z).body?.citySource?.kind === 'junction',
      'tile reload restores the exact junction surface');
  } finally {
    physics.dispose();
    visual?.dispose();
  }
});
