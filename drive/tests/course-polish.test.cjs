const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const P=require('../js/physics');
const C=require('cannon');
const harnessSource=fs.readFileSync(__dirname+'/camera.test.cjs','utf8').split("test('mouse drag")[0];
const context={require,__dirname,console};vm.createContext(context);vm.runInContext(harnessSource+';globalThis.makeHarness=harness;',context);

test('stunt renderer has one exact collision-matched road, markings and real slalom gates',()=>{
 const {sim}=context.makeHarness();sim.chooseMap('racetrack');const p=sim.physics();
 assert.equal(sim.world.children.filter(o=>o.name==='road-ribbon').length,0,'legacy ground ribbon removed');
 assert.equal(sim.world.getObjectByName('stunt-overpass-approaches'),undefined,'no coplanar approach layer');
 const mesh=sim.world.getObjectByName('stunt-route-solids'),points=mesh.geometry.attributes.position;
 let index=0;
 for(const s of p.stuntSlabs)for(const f of s.faces)for(const k of [f[0],f[1],f[2],f[0],f[2],f[3]]){
  const v=s.vertices[k].vadd(s.body.position);
  assert.ok(Math.abs(points.getX(index)-v.x)<1e-5);
  assert.ok(Math.abs(points.getY(index)-v.y)<1e-5);
  assert.ok(Math.abs(points.getZ(index)-v.z)<1e-5);index++;
 }
 assert.equal(index,points.count);
 assert.ok(points.count<8000,'bounded batched geometry');
 assert.ok(p.world.bodies.length<230,'merged flat slabs bound physics bodies');
 assert.equal(p.obstacles.length,3);
 assert.equal(sim.world.children.filter(o=>o.name==='solid-obstacle').length,3);
 for(const o of p.obstacles){assert.ok(Math.abs(o.x-175)<o.hx,'gate crosses the center line and requires steering');assert.ok(6.2+Math.abs(o.x-175)-o.hx>5,'opposite opening fits every car');}
 assert.equal(sim.samples().length,P.stuntRoute.length);
 const meshes=['stunt-route-solids','stunt-route-markings'].map(n=>sim.world.getObjectByName(n));let disposed=0;
 meshes.forEach(m=>m.geometry.addEventListener('dispose',()=>disposed++));
 const count=p.world.bodies.length;sim.chooseMap('city');assert.equal(disposed,2);assert.equal(sim.physics().stuntSlabs.length,0);
 for(let i=0;i<3;i++){sim.chooseMap('racetrack');sim.resetVehicle();assert.equal(sim.physics().world.bodies.length,count);assert.ok(sim.physics().body.position.y>0);sim.chooseMap('mountain');}
});

test('all cars complete the actual mandatory stunts and slalom in a continuous lap',()=>{
 const {sim}=context.makeHarness();const route=P.stuntRoute,N=route.length;
 for(const car of Object.keys(P.vehicles)){
  sim.chooseMap('racetrack');sim.chooseCar(car);sim.resetVehicle();const p=sim.physics();
  let progress=0,maxError=0,minUp=1,air=0,upper=false,lower=false,balance=false,jump=false;
  for(let frame=0;frame<18000&&progress<N;frame++){
   const pos=p.body.position;let nearest=Infinity,next=progress;
   for(let j=Math.max(0,progress-2);j<=progress+12&&j<=N;j++){
    const a=route[j%N],d=Math.hypot(a.x-pos.x,a.z-pos.z,(a.y+1-pos.y)*.3);
    if(d<nearest){nearest=d;next=j;}
   }
   progress=Math.max(progress,next);const a=route[progress%N];
   let targetSpeed=9;
   if(a.x===0&&a.z>55)targetSpeed=26;
   if(a.x===0&&a.z<=55&&a.z>-15)targetSpeed=8;
   if(a.kind==='balance')targetSpeed=6;
   const speed=p.body.velocity.length(),ahead=speed>17?3:2;
   const target={...route[(progress+ahead)%N]};
   // Smooth explicit weaving: drive through the open side of each solid gate.
   if(target.x===175&&target.z>28&&target.z<115){
    let offset=0;
    for(const [i,z] of [48,72,96].entries())offset+=(i%2?-2.5:2.5)*Math.exp(-(((target.z-z)/12)**2));
    target.x+=offset;targetSpeed=7;
   }
   const forward=p.body.quaternion.vmult(new C.Vec3(0,0,1));
   let angle=Math.atan2(target.x-pos.x,target.z-pos.z)-Math.atan2(forward.x,forward.z);angle=Math.atan2(Math.sin(angle),Math.cos(angle));
   const state=p.step(1/60,{throttle:Math.max(0,Math.min(.8,(targetSpeed-speed)*.45)),brake:speed>targetSpeed+1,steer:Math.max(-1,Math.min(1,angle*2.5))});
   if(frame>120){maxError=Math.max(maxError,sim.distanceToRoad(pos.x,pos.z));minUp=Math.min(minUp,p.body.quaternion.vmult(new C.Vec3(0,1,0)).y);air+=!state.grounded;}
   if(Math.abs(pos.x)<5&&Math.abs(pos.z)<5){upper ||=pos.y>9;lower ||=pos.y<2;}
   balance ||=Math.abs(pos.x)<1&&pos.z<-60&&pos.z>-90&&pos.y>4;
   jump ||=pos.z<78&&pos.z>74&&!state.grounded;
   assert.ok(pos.y>-.5,car+' stays on route, progress '+progress);
  }
  assert.ok(progress>=N,car+' completes lap: '+progress+'/'+N);
  assert.ok(upper&&lower&&balance&&jump,car+' actually visits all stunts');
  assert.ok(maxError<3.8,car+' stays within route including weaving: '+maxError);
  assert.ok(minUp>.85,car+' upright throughout lap');assert.ok(air>20&&air<100,car+' real jump without prolonged falls');
 }
});
