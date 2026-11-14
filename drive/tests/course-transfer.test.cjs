const test = require('node:test');
const assert = require('node:assert/strict');
const Cannon = require('cannon');
const physics = require('../js/physics');
const imported = require('../js/imported-courses');

test('a native-road gap stays open and a guided jump lands on the next road', () => {
  const from = {x:0,y:0,z:5};
  const to = {x:0,y:5,z:10};
  const course = {
    id:'gap-test', loop:false, width:6, floor:-20, proxyRoad:true,
    route:imported.routeFrom([[0,0,0],[0,0,5],[0,5,10],[0,5,20]],false,6,1),
    spawn:{x:0,y:0,z:0,heading:0}, spawnBack:5,
    transfers:[{from,to,radius:2,duration:.5,arc:2,takeoffHeading:0,
      landingHeading:0,landingSpeed:12}]
  };
  const sim = physics.create({map:'racetrack',courseId:course.id,course,car:'comet'});
  const hit = new Cannon.RaycastResult();
  assert.equal(sim.world.raycastClosest(new Cannon.Vec3(0,8,7.5),
    new Cannon.Vec3(0,-5,7.5),{},hit),false,
  'the route proxy leaves the source-model jump gap open');
  sim.body.position.set(from.x,from.y+1.1,from.z);
  sim.body.velocity.set(0,0,10);
  sim.step(1/120);
  for(let frame=0;frame<60;frame++)sim.step(1/120);
  assert.ok(Math.abs(sim.body.position.z-to.z)<.4,'the car crosses the empty span');
  assert.ok(Math.abs(sim.body.position.y-(to.y+1.1))<.4,'the car reaches the elevated landing');
  assert.ok(sim.body.velocity.z>8,'the car keeps forward speed after landing');
  sim.reset();
  assert.ok(sim.body.position.z<1,'reset returns to the grid after a transfer');
});

test('point-to-point finish keeps loading-road runout without extending ghost time', () => {
  const course = {id:'runout-test',loop:false,width:6,floor:-20,proxyRoad:true,
    route:imported.routeFrom([[0,0,0],[0,0,10]],false,6,2),
    spawn:{x:0,y:0,z:-5,heading:0},finishRunout:20,ghostSpeed:20};
  const sim = physics.create({map:'racetrack',courseId:course.id,course,car:'comet'});
  const hit = new Cannon.RaycastResult();
  assert.ok(sim.world.raycastClosest(new Cannon.Vec3(0,5,25),
    new Cannon.Vec3(0,-5,25),{},hit),'the road remains solid beyond the gate');
  assert.ok(Math.abs(hit.hitPointWorld.y)<.2);
  const ghost = imported.makeGhostTrace(course,'comet');
  assert.ok(Math.abs(ghost.lapTime-.5)<.001,'ghost finishes at the gate');
  assert.equal(ghost.frames.at(-1)[2],10);
});

test('assisted driving survives a physics rebuild for a car change', () => {
  const course = {id:'assist-test',loop:false,width:6,floor:-20,proxyRoad:true,
    route:imported.routeFrom([[0,0,0],[0,0,5],[0,5,10],[0,5,20]],false,6,5),
    spawn:{x:0,y:0,z:0,heading:0},
    guidedSections:[{fromIndex:1,toIndex:3,radius:2,speed:10,landingSpeed:8}]};
  const first = physics.create({map:'racetrack',courseId:course.id,course,car:'comet'});
  first.body.position.set(0,1.1,5);
  assert.equal(first.restoreAssistState({kind:'guide',index:0,distance:0,
    segment:0,lateral:0}),true);
  const state = first.getAssistState();
  assert.equal(state?.kind,'guide');
  for(let frame=0;frame<12;frame++)first.step(1/120,{throttle:1});
  const saved = first.getAssistState();
  const second = physics.create({map:'racetrack',courseId:course.id,course,car:'pickup'});
  second.body.position.copy(first.body.position);
  second.body.quaternion.copy(first.body.quaternion);
  assert.equal(second.restoreAssistState(saved),true);
  const before = second.body.position.z;
  for(let frame=0;frame<12;frame++)second.step(1/120,{throttle:1});
  assert.ok(second.body.position.z>before+0.5,'new car continues along guided road');
});
