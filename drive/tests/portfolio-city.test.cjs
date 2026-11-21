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

test('the skyway crosses both tower portals in both directions above the open lower street', () => {
  const simulation = physics.create({map:'city', city, distanceToRoad:city.distanceToRoad, roadHalfWidth:city.roadHalfWidth});
  for (const [start, direction] of [[city.skyway.west,1], [city.skyway.east,-1]]) {
    simulation.reset(start.x, start.z, start.heading);
    let abovePlaza = false;
    for (let frame=0; frame<2200; frame++) {
      const state = simulation.step(1/120, {throttle:.52});
      const {x,y,z} = simulation.body.position;
      assert.ok(Math.abs(z-start.z) < .35, `${start.id} remains in its lane`);
      if (Math.abs(x)<8 && state.grounded===4 && y>11.5) abovePlaza = true;
      if ((x-start.x)*direction>216 && y<1.6) break;
    }
    assert.ok(abovePlaza, `${start.id} drives on an elevated deck through the plaza`);
    assert.ok((simulation.body.position.x-start.x)*direction>216 && simulation.body.position.y<1.6,
      `${start.id} returns to the opposite ground-level street`);
  }
  simulation.reset(0,-40,0);
  for (let frame=0; frame<900 && simulation.body.position.z<-21; frame++) {
    simulation.step(1/120,{throttle:.52});
    assert.ok(simulation.body.position.y<1.5, 'lower approach stays below the raised deck');
  }
  assert.ok(simulation.body.position.z>=-21, 'the lower route continues through the crossing');
});

test('the chase camera clears the skyway slab and retains an open view down the street', () => {
  const focus = {x:-72,y:1.5,z:-21.5};
  assert.ok(city.constrainCamera(focus,{x:-72,y:4.9,z:-32}) < .95);
  assert.equal(city.constrainCamera(focus,{x:-72,y:4.2,z:-16}),1);
  assert.equal(city.constrainCamera({x:5,y:13.2,z:-27.5},{x:-7,y:16,z:-27.5}),1);
});
