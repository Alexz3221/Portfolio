const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('cannon');
const THREE = require('three');
const physics = require('../js/physics');
const city = require('../js/portfolio-city');
const playground = require('../js/portfolio-play');

test('the portfolio city has six drivable stops and collision-backed buildings', () => {
  assert.notEqual(city, physics.city);
  assert.deepEqual(city.stops.map(stop => stop.id).sort(),
    ['about', 'contact', 'education', 'experience', 'projects', 'skills']);
  const simulation = physics.create({map:'city', city, distanceToRoad:city.distanceToRoad, roadHalfWidth:city.roadHalfWidth});
  for (const stop of city.stops) {
    simulation.reset(stop.x, stop.z, stop.heading);
    let state;
    for (let frame = 0; frame < 90; frame++) state = simulation.step(1 / 120, {});
    assert.ok(city.distanceToRoad(stop.x, stop.z) < city.roadHalfWidth, stop.id + ' is on pavement');
    assert.equal(state.grounded, 4, stop.id + ' has room to park');
    assert.ok(Math.hypot(simulation.body.position.x - stop.x, simulation.body.position.z - stop.z) < .3);
  }
  const building = city.buildings[0];
  const hit = new C.RaycastResult();
  simulation.world.raycastClosest(new C.Vec3(building.x, 200, building.z), new C.Vec3(building.x, -1, building.z), {}, hit);
  assert.ok(hit.hasHit && hit.hitPointWorld.y >= building.height, 'the rendered footprint has a solid collider');
});

test('the portfolio test bay has moveable pylons and a driveable jump', () => {
  const simulation = physics.create({map:'city', city, distanceToRoad:city.distanceToRoad, roadHalfWidth:city.roadHalfWidth});
  const world = new THREE.Group();
  const play = playground.create(C, THREE, world, simulation, city.playProps);
  const pylons = world.getObjectByName('portfolio-test-bay-pylons').children;
  const starts = pylons.map(pylon => pylon.position.clone());
  simulation.reset(80, -78, 0);
  for (let frame = 0; frame < 400; frame++) {
    simulation.step(1 / 120, {throttle:1, steer:0});
    play.update(1 / 120);
  }
  assert.ok(pylons.some((pylon, i) => pylon.position.distanceTo(starts[i]) > 1));
  play.reset();
  pylons.forEach((pylon, i) => assert.ok(pylon.position.distanceTo(starts[i]) < .001));

  simulation.reset(72, -76, 0);
  let peak = 0;
  for (let frame = 0; frame < 420; frame++) {
    simulation.step(1 / 120, {throttle:1, steer:0});
    peak = Math.max(peak, simulation.body.position.y);
  }
  assert.ok(peak > 3.5 && simulation.body.position.z > -50);
  const count = simulation.world.bodies.length;
  play.dispose();
  assert.equal(simulation.world.bodies.length, count - pylons.length);
});
