const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('cannon');
const physics = require('../js/physics');
const imported = require('../js/imported-courses');

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

test('U9 center of mass sits below its chassis while all tires keep their road clearance', () => {
  const sim=physics.create({map:'city',city:{edge:400,buildings:[],
    highwaySegments:[]},car:'u9xtreme'});
  sim.reset(0,0);
  for(let frame=0;frame<240;frame++)sim.step(1/120);
  const bodyY=sim.body.position.y;
  assert.equal(sim.car.wheelInfos.filter(wheel=>wheel.isInContact).length,4);
  assert.ok(bodyY>.6&&bodyY<.72,`center of mass is ${bodyY.toFixed(3)} m above the road`);
  assert.ok(Math.abs(bodyY+sim.body.shapeOffsets[0].y-.86)<.05,
    'the actual chassis keeps its prior road height');
  for(const wheel of sim.car.wheelInfos){
    const contactY=bodyY+wheel.chassisConnectionPointLocal.y-
      wheel.suspensionLength-wheel.radius;
    assert.ok(Math.abs(contactY)<.04,`wheel touches the road at ${contactY.toFixed(3)} m`);
  }
});

test('U9 keeps its visible clearance through guided road and jump transitions', () => {
  const route=imported.routeFrom([[0,0,0],[0,5,10],[0,10,20]],false,8,5);
  const course={id:'u9-height-guide',loop:false,width:8,route,edge:100,floor:-20,
    proxyRoad:true,spawn:{x:0,y:0,z:0,heading:0},
    guidedSections:[{fromIndex:0,toIndex:2,radius:3,speed:10}],
    transfers:[{from:{x:0,y:0,z:0},to:{x:0,y:10,z:20},duration:1,arc:1}]};
  const sim=physics.create({map:'racetrack',courseId:course.id,course,car:'u9xtreme'});
  assert.equal(sim.restoreAssistState({kind:'guide',index:0,distance:0,
    segment:0,lateral:0}),true);
  sim.step(1/120);
  const center=sim.body.position.vadd(sim.body.quaternion.vmult(
    new C.Vec3(0,sim.spec.centerOfMassDrop,0)));
  assert.ok(Math.abs(center.x)<.01&&Math.abs(center.y-(1.1+center.z*.5))<.01,
    'the visible chassis follows the steep centerline without a sideways offset');
  sim.reset();
  assert.equal(sim.restoreAssistState({kind:'transfer',index:0,elapsed:0,
    from:{x:0,y:-sim.spec.centerOfMassDrop,z:0},clearance:1.1,
    heading:0,entrySpeed:10}),true);
  for(let frame=0;frame<120;frame++)sim.step(1/120);
  assert.ok(Math.abs(sim.body.position.y+sim.spec.centerOfMassDrop-11.1)<.02,
    'the jump lands the chassis at its original road clearance');
});

test('U9 still responds to air pitch away from the road', () => {
  const sim=physics.create({map:'city',city:{edge:400,buildings:[],
    highwaySegments:[]},car:'u9xtreme'});
  sim.body.position.set(0,100,0);
  let rotation=0;
  for(let frame=0;frame<180;frame++) {
    sim.step(1/60,{throttle:1,steer:1});
    rotation+=sim.body.angularVelocity.length()/60;
  }
  assert.ok(rotation>.7,`air pitch turned ${rotation.toFixed(2)} rad`);
  assert.ok(Math.abs(sim.body.quaternion.z)<.01,
    'holding a steering key does not roll the airborne U9');
});
