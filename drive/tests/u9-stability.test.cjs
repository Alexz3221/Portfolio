const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('cannon');
const physics = require('../js/physics');

function curbTurn({speed, steer, halfHeight}) {
  // A single raised road edge and an otherwise empty road isolate rollover
  // recovery from unrelated scenery contacts.
  const sim = physics.create({map:'city', city:{edge:400,buildings:[],
    highwaySegments:[],guardrails:[],supports:[]}, car:'u9xtreme'});
  sim.reset(0, 0);
  for (let frame=0;frame<120;frame++) sim.step(1/60);
  // addObstacle takes half-extents, so the edge is twice halfHeight tall.
  sim.addObstacle(.85,12,.3,halfHeight,1.5);
  sim.body.velocity.set(0,0,speed);
  let maxTilt=0, minimumWheels=4;
  for(let frame=0;frame<180;frame++) {
    const state=sim.step(1/60,{steer});
    const up=sim.body.quaternion.vmult(new C.Vec3(0,1,0));
    maxTilt=Math.max(maxTilt,Math.acos(Math.max(-1,Math.min(1,up.y))));
    minimumWheels=Math.min(minimumWheels,state.grounded);
  }
  return {maxTilt,minimumWheels};
}

test('U9 resists rollover when turning across a raised road edge', () => {
  const moderate=curbTurn({speed:20,steer:.5,halfHeight:.27});
  assert.ok(moderate.maxTilt<1,
    `45 mph curb turn tilted ${moderate.maxTilt.toFixed(2)} rad`);
  const fast=curbTurn({speed:35,steer:1,halfHeight:.25});
  assert.ok(fast.maxTilt<1,
    `78 mph curb turn tilted ${fast.maxTilt.toFixed(2)} rad`);
});

test('U9 still responds to deliberate air controls away from the road', () => {
  const sim=physics.create({map:'city',city:{edge:400,buildings:[],
    highwaySegments:[]},car:'u9xtreme'});
  sim.body.position.set(0,100,0);
  let rotation=0;
  for(let frame=0;frame<180;frame++) {
    sim.step(1/60,{throttle:1,steer:1});
    rotation+=sim.body.angularVelocity.length()/60;
  }
  assert.ok(rotation>1,`air controls turned ${rotation.toFixed(2)} rad`);
});
