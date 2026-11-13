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

const roadNames = new Set(['imported-city-road', 'imported-city-highway',
  'imported-city-highway-grade', 'imported-city-junction-approach',
  'imported-city-junction', 'imported-city-lane-connector']);
const roadKinds = new Set(['road', 'highway', 'approach', 'connector']);

function visibleRoadHits(world, x, z) {
  world.updateMatrixWorld(true);
  const meshes = [];
  world.traverse(object => {
    if (object.isMesh && roadNames.has(object.name)) meshes.push(object);
  });
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 100, z),
    new THREE.Vector3(0, -1, 0), 0, 200);
  return ray.intersectObjects(meshes, false).map(hit => ({
    y: hit.point.y, name: hit.object.name
  }));
}

function physicalRoadHits(physics, x, z) {
  const hits = [];
  physics.world.raycastAll(new C.Vec3(x, 100, z), new C.Vec3(x, -100, z), {}, hit => {
    if (roadKinds.has(hit.body?.citySource?.kind)) hits.push({
      y: hit.hitPointWorld.y, kind: hit.body.citySource.kind,
      id: hit.body.citySource.id
    });
  });
  return hits.sort((a, b) => b.y - a.y);
}

test('center 03 interchange collision follows visible shoulders and leaves its gaps open', async () => {
  const map = await loadCity();
  const originalEnsureNear = map.ensureNear.bind(map);
  await originalEnsureNear(5880, 1387, 250);
  // The browser initializes physics before it mounts the visual tile. Keep
  // this load order, while avoiding an unrelated spawn request during setup.
  map.ensureNear = () => Promise.resolve([]);
  const physics = Physics.create({ map: 'city', city: map,
    distanceToRoad: map.distanceToRoad, roadHalfWidth: map.roadHalfWidth });
  const world = new THREE.Group();
  let visual;
  try {
    physics.reset(5880, 1387);
    const versionBefore = map.collisionGeometryVersion || 0;
    visual = map.build(THREE, world);
    visual.update({ position: { x: 5880, y: 0, z: 1387 } }, 0);
    assert.ok((map.collisionGeometryVersion || 0) > versionBefore,
      'rendering the graph changes the physical road and shoulder geometry');
    physics.step(1 / 60, {});

    for (const [x, z] of [[5778, 1337], [5818, 1361],
      [5882, 1397], [5882, 1265]]) {
      const visible = visibleRoadHits(world, x, z)
        .find(hit => hit.name === 'imported-city-lane-connector');
      const physical = physicalRoadHits(physics, x, z)
        .find(hit => Math.abs(hit.y - visible?.y) < .08);
      assert.ok(visible, `lane ribbon is visible at ${x}, ${z}`);
      assert.ok(physical, `matching collision supports lane ribbon at ${x}, ${z}`);
      assert.equal(physical.kind, 'approach');
    }

    for (const [x, z] of [[5894, 1397], [5894, 1401]]) {
      const terrain = physics.terrainHeight(x, z);
      const visible = visibleRoadHits(world, x, z);
      const raised = physicalRoadHits(physics, x, z)
        .filter(hit => hit.y > terrain + .35);
      assert.ok(visible.every(hit => hit.y <= terrain + .35),
        `cutback gap at ${x}, ${z} has no raised road mesh`);
      assert.equal(raised.length, 0,
        `cutback gap at ${x}, ${z} has no invisible raised road body`);
    }

    const crossing = physicalRoadHits(physics, 5880, 1348);
    assert.ok(crossing.some(hit => hit.kind === 'highway' && hit.y > 6),
      'upper crossing retains its elevated physical deck');
    assert.ok(crossing.some(hit => hit.kind === 'road' && hit.y < -4),
      'lower crossing remains a separate physical level');

    map.trimFar(-99999, -99999, 0);
    physics.step(1 / 60, {});
    assert.equal(map.nearbyLaneApproaches(5882, 1397, 10).length, 0,
      'unloading removes generated graph approaches');
    assert.equal(physicalRoadHits(physics, 5882, 1397).length, 0,
      'unloading removes their physical bodies');
    await originalEnsureNear(5880, 1387, 250);
    visual.update({ position: { x: 5880, y: 0, z: 1387 } }, 0);
    physics.step(1 / 60, {});
    const restored = visibleRoadHits(world, 5882, 1397)
      .find(hit => hit.name === 'imported-city-lane-connector');
    assert.ok(restored);
    assert.ok(physicalRoadHits(physics, 5882, 1397)
      .some(hit => Math.abs(hit.y - restored.y) < .08),
    'reloading restores one matching physical ribbon');
  } finally {
    physics.dispose();
    visual?.dispose();
  }
});

test('unrendered elevated approach and wide-road fringe have no invisible raised bodies', async () => {
  const cases = [
    { x: 3176.2, z: -208.5, id: '3866535', label: 'unrendered elevated approach' },
    { x: 5380.9, z: -504, id: '5339139', label: 'wide ground road fringe' }
  ];
  for (const site of cases) {
    const map = await loadCity();
    await map.ensureNear(site.x, site.z, 220);
    map.ensureNear = () => Promise.resolve([]);
    const world = new THREE.Group(), visual = map.build(THREE, world);
    const physics = Physics.create({ map: 'city', city: map,
      distanceToRoad: map.distanceToRoad, roadHalfWidth: map.roadHalfWidth });
    try {
      visual.update({ position: { x: site.x, y: 0, z: site.z } }, 0);
      physics.reset(site.x, site.z);
      const terrain = physics.terrainHeight(site.x, site.z);
      assert.ok(visibleRoadHits(world, site.x, site.z)
        .every(hit => hit.y <= terrain + .35),
      `${site.label} has no visible road surface at the probe`);
      assert.equal(physicalRoadHits(physics, site.x, site.z)
        .filter(hit => hit.y > terrain + .35).length, 0,
      `${site.label} has no phantom road collider at the probe`);
      if (site.id === '3866535') {
        const record = map.nearbyLaneApproaches(site.x, site.z, 30)
          .find(item => String(item.entity_id) === site.id);
        assert.ok(record, 'source lane remains available for inspection');
        assert.ok(record.samples.every(sample => !sample.collisionRenderedToNext),
          'the graph omitted every segment of this source lane');
      } else {
        const road = map.nearbyRoads(site.x, site.z, 20)
          .find(item => String(item.id) === site.id);
        assert.ok(road && road.renderedCarriageMax - road.renderedCarriageMin < road.width,
          'collider carriage follows the narrower rendered strip');
      }
    } finally {
      physics.dispose();
      visual.dispose();
    }
  }
});
