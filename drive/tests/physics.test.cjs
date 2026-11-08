const test=require('node:test');const assert=require('node:assert/strict');const P=require('../js/physics');
function run(p,n,input={}){let s;for(let i=0;i<n;i++)s=p.step(1/60,input);return s;}
test('four springs settle under gravity and reset removes all momentum',()=>{const p=P.create();const s=run(p,180);assert.equal(s.grounded,4);assert.ok(p.body.position.y>.95&&p.body.position.y<1.08);assert.ok(Math.abs(p.body.velocity.y)<.01);p.body.angularVelocity.set(3,4,5);p.reset();assert.equal(p.body.velocity.length(),0);assert.equal(p.body.angularVelocity.length(),0);});
test('acceleration takes seconds, coasting preserves momentum, brakes stop and reverse works',()=>{const p=P.create();p.reset(-100,-100);run(p,120);run(p,180,{throttle:1});const speed=p.body.velocity.length();assert.ok(speed>17&&speed<22);run(p,60);const coast=p.body.velocity.length();assert.ok(coast>speed*.85&&coast<speed);run(p,180,{brake:true});assert.ok(p.body.velocity.length()<.2);run(p,120,{throttle:-1});assert.ok(p.body.velocity.z < -3);});
test('ramp launches without teleporting and lands with gravity',()=>{const p=P.create();run(p,120);let launched=false,landed=false,maxY=0;for(let i=0;i<700;i++){const state=p.step(1/60,{throttle:p.body.position.z<30?1:0});maxY=Math.max(maxY,p.body.position.y);if(p.body.position.z>35&&!state.grounded)launched=true;if(launched&&p.body.position.z>50&&state.grounded)landed=true;assert.ok(Number.isFinite(p.body.position.y));}assert.ok(launched);assert.ok(maxY>5);assert.ok(landed);});
test('air controls apply torque and allow real full rotations',()=>{const p=P.create();p.body.position.set(0,100,0);let rotation=0,maxTilt=0;for(let i=0;i<180;i++){p.step(1/60,{throttle:1,steer:1});rotation+=p.body.angularVelocity.length()/60;maxTilt=Math.max(maxTilt,Math.abs(p.body.quaternion.x)+Math.abs(p.body.quaternion.z));}assert.ok(rotation>Math.PI*2);assert.ok(p.body.angularVelocity.length()>2);assert.ok(p.body.position.y<95);assert.ok(maxTilt>.25);});
test('trunk collision stops a car and does not tunnel at driving speed',()=>{const p=P.create();p.reset(-100,-80);p.addTree(-100,-65,.45,8);run(p,120);p.body.velocity.set(0,0,35);run(p,60);assert.ok(p.body.position.z < -65);assert.ok(p.body.velocity.z<5);});
test('terrain has actual elevation and physics is stable at different render rates',()=>{assert.ok(P.terrainHeight(37,32)>7);const results=[30,60,120].map(fps=>{const p=P.create();p.reset(-100,-100);for(let i=0;i<fps*5;i++)p.step(1/fps,{throttle:i>fps?1:0});return p.body.position.z;});assert.ok(Math.max(...results)-Math.min(...results)<1);});

test('wheels rest on the hill rather than the flat world origin',()=>{const p=P.create();p.reset(37,32);const s=run(p,120);assert.ok(p.body.position.y>7.8);assert.ok(s.grounded>=2);});

test('gentle neutral air assist damps rotation but does not snap upright',()=>{
  const rates=[false,true].map(antiFlip=>{const p=P.create({antiFlip});p.body.position.set(0,100,0);p.body.angularVelocity.set(2,0,1);run(p,60);assert.ok(Math.abs(p.body.quaternion.x)>.1);return p.body.angularVelocity.length();});
  assert.ok(rates[1]<rates[0]*.95);assert.ok(rates[1]>rates[0]*.5);
});
test('all cars settle, accelerate, brake and reverse on all four maps',()=>{
  for(const map of ['course','lakeside','desert','alpine'])for(const car of Object.keys(P.vehicles)){
    const p=P.create({map,car});p.reset(-100,-100);let s=run(p,120);assert.equal(s.grounded,4,`${map}/${car} settled`);
    assert.equal(p.body.mass,P.vehicles[car].mass);assert.equal(p.car.wheelInfos[0].radius,P.vehicles[car].radius);
    run(p,120,{throttle:1});assert.ok(p.body.velocity.z>8,`${map}/${car} accelerates`);
    run(p,180,{brake:true});assert.ok(p.body.velocity.length()<.2);
    run(p,120,{throttle:-1});assert.ok(p.body.velocity.z < -3);
  }
});
test('scenic maps have a flat floor past old course boundary and dirt resistance',()=>{
  const speeds=[false,true].map(dirt=>{const p=P.create({map:'desert',distanceToRoad:()=>dirt?20:0});p.reset(180,-100);run(p,120);assert.ok(Math.abs(p.terrainHeight(37,32))<.001);p.body.velocity.set(0,0,20);run(p,60);assert.ok(p.body.position.x>179);return p.body.velocity.length();});assert.ok(speeds[1]<speeds[0]);
});
