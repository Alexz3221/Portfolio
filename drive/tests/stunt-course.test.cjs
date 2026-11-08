const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('cannon');
const P=require('../js/physics');
const cars=Object.keys(P.vehicles);
const up=p=>p.body.quaternion.vmult(new C.Vec3(0,1,0)).y;

function ray(p,x,z,from,to){const hit=new C.RaycastResult();assert.ok(p.world.raycastClosest(new C.Vec3(x,from,z),new C.Vec3(x,to,z),{},hit));return hit;}

test('overpasses are closed solids with two separately usable collision levels',()=>{
 const p=P.create({map:'racetrack'});p.body.position.set(190,50,190);
 assert.equal(p.bridges.length,2);assert.equal(p.world.bodies.length,52);
 for(const b of p.bridges){
  assert.equal(b.segments.length,17);
  for(const s of b.segments){
   // No lips/gaps between adjacent top surfaces, and outward normals.
   const shape=s.body.shapes[0];
   for(let i=0;i<shape.faces.length;i++)assert.ok(shape.faceNormals[i].dot(shape.vertices[shape.faces[i][0]])>0);
   for(const t of [.05,.5,.95])for(const z of [-5,0,5]){
    const x=s.x0+(s.x1-s.x0)*t,y=s.y0+(s.y1-s.y0)*t;
    const hit=ray(p,x,b.z+z,20,-10);
    assert.ok(Math.abs(hit.hitPointWorld.y-y)<1e-7,'deck/ramp ray matches shared top surface');
   }
  }
  // Check a wide crossing corridor, not only the center of a lower road.
  for(const x of [-55,-50,-45,40,45,50,55,60])for(const z of [-5,0,5]){
   const ground=ray(p,x,b.z+z,4,-10);
   assert.ok(Math.abs(ground.hitPointWorld.y-p.terrainHeight(x,b.z+z))<1e-7);
   const underside=ray(p,x,b.z+z,4,12);
   assert.ok(Math.abs(underside.hitPointWorld.y-(b.height-b.thickness))<1e-7);
   assert.ok(underside.hitPointWorld.y-ground.hitPointWorld.y>6.8);
  }
 }
});

test('every car traverses both overpasses in both directions at low and high speeds',()=>{
 for(const car of cars)for(const z of [-55,55])for(const direction of [-1,1])for(const target of [10,28]){
  const p=P.create({map:'racetrack',car});p.reset(-143*direction,z,direction*Math.PI/2);
  for(let i=0;i<120;i++)p.step(1/60);
  p.body.velocity.set(target*direction,0,0);let deckFrames=0,air=0,minUp=1;
  for(let i=0;i<3000&&p.body.position.x*direction<143;i++){
   const speed=p.body.velocity.x*direction;
   const forward=p.body.quaternion.vmult(new C.Vec3(0,0,1));
   let heading=Math.atan2(direction*20,z-p.body.position.z)-Math.atan2(forward.x,forward.z);
   heading=Math.atan2(Math.sin(heading),Math.cos(heading));
   const state=p.step(1/60,{throttle:Math.max(0,Math.min(.7,(target-speed)*.3)),brake:speed>target+2,steer:Math.max(-1,Math.min(1,heading*2.5))});
   if(Math.abs(p.body.position.x)<65){deckFrames++;assert.ok(p.body.position.y>8&&p.body.position.y<9.5,car+' remains on upper deck');}
   minUp=Math.min(minUp,up(p));air+=!state.grounded;
  }
  assert.ok(p.body.position.x*direction>=143,car+'/'+z+'/'+direction+'/'+target+' completes actual ramp-to-ramp drive');
  assert.ok(deckFrames>100);assert.ok(Math.abs(p.body.position.z-z)<2);assert.ok(minUp>.9);
  if(target===10)assert.equal(air,0,'slow crossing retains suspension contact');
 }
});

test('every car passes under both bridges along the actual rendered road crossings',()=>{
 const {sim}=context.makeHarness();sim.chooseMap('racetrack');const route=sim.samples();
 const crossings=[];
 for(const bridge of sim.physics().bridges){
  let count=0;
  route.forEach((sample,i)=>{
   const a=sample.point,b=route[(i+1)%route.length].point;
   if((a.z-bridge.z)*(b.z-bridge.z)>0)return;
   const t=(bridge.z-a.z)/(b.z-a.z),x=a.x+(b.x-a.x)*t;
   if(Math.abs(x)>bridge.deckHalfLength-10)return;
   const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
   crossings.push({x,z:bridge.z,dx:dx/length,dz:dz/length});count++;
  });
  assert.equal(count,2,'each bridge crosses both actual infield road sections');
 }
 for(const car of cars)for(const c of crossings)for(const speed of [8,30]){
  const p=P.create({map:'racetrack',car});p.reset(c.x-c.dx*18,c.z-c.dz*18,Math.atan2(c.dx,c.dz));
  for(let i=0;i<120;i++)p.step(1/60);
  p.body.velocity.set(c.dx*speed,0,c.dz*speed);let high=0,grounded=0,progress=-18;
  for(let i=0;i<360&&progress<18;i++){
   const state=p.step(1/60,{throttle:speed===8?.2:0});high=Math.max(high,p.body.position.y);grounded+=state.grounded>0;
   progress=(p.body.position.x-c.x)*c.dx+(p.body.position.z-c.z)*c.dz;
  }
  assert.ok(progress>=18,car+' crosses actual lower road');
  assert.ok(high<2,car+' never snapped to upper deck');assert.ok(grounded>20);assert.ok(up(p)>.95);
  for(const side of [-6,0,6]){
   const x=c.x-c.dz*side,z=c.z+c.dx*side;
   const ground=ray(p,x,z,4,-10),ceiling=ray(p,x,z,4,12);
   assert.ok(ceiling.hitPointWorld.y-ground.hitPointWorld.y>6.8,'full road width clear of deck/supports');
  }
 }
});

test('varied western and eastern launch crests give every car airtime and upright landing',()=>{
 assert.equal(P.stuntBumps.length,12);
 assert.ok(new Set(P.stuntBumps.map(b=>b.h)).size>=6);
 assert.ok(P.stuntBumps.filter(b=>b.x>0).length>=5);
 for(const car of cars)for(const [x,z,speed] of [[-164,-9,26],[-160,40,30],[161,-55,30]]){
  const p=P.create({map:'racetrack',car});p.reset(x,z);
  for(let i=0;i<120;i++)p.step(1/60);
  p.body.velocity.set(0,0,speed);let airborne=0,landed=false,minUp=1;
  for(let i=0;i<240;i++){
   const state=p.step(1/60);if(!state.grounded)airborne++;
   if(airborne>8&&state.grounded)landed=true;minUp=Math.min(minUp,up(p));
  }
  assert.ok(airborne>40,car+' meaningful airtime');assert.ok(landed,car+' returns to surface');assert.ok(minUp>.85,car+' neutral landing remains upright');
 }
});

const fs=require('node:fs'),vm=require('node:vm');
const harnessSource=fs.readFileSync(__dirname+'/camera.test.cjs','utf8').split("test('mouse drag")[0];
const context={require,__dirname,console};vm.createContext(context);vm.runInContext(harnessSource+';globalThis.makeHarness=harness;',context);
test('bridge render geometry matches colliders, approaches connect, resources dispose on map changes',()=>{
 const {sim}=context.makeHarness();sim.chooseMap('racetrack');
 const p=sim.physics(),solid=sim.world.getObjectByName('stunt-overpass-solids');
 const points=solid.geometry.attributes.position;
 // Every rendered structural vertex belongs to a slab or support collision surface.
 let index=0;
 for(const b of p.bridges){
  for(const s of b.segments)for(const f of s.faces)for(const k of [f[0],f[1],f[2],f[0],f[2],f[3]]){
   const v=s.vertices[k];
   assert.ok(Math.abs(points.getX(index)-v.x-s.body.position.x)<1e-5);
   assert.ok(Math.abs(points.getY(index)-v.y-s.body.position.y)<1e-5);
   assert.ok(Math.abs(points.getZ(index)-v.z-b.z)<1e-5);index++;
  }
  index+=b.supports.length*36;
  for(const x of [-165,-140,0,140,165])assert.equal(sim.distanceToRoad(x,b.z),0,'bridge route counted as paved connection');
 }
 assert.equal(index,points.count);
 const meshes=['stunt-overpass-solids','stunt-overpass-markings','stunt-overpass-approaches'].map(name=>sim.world.getObjectByName(name));
 assert.ok(meshes.every(Boolean));assert.ok(meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0)<15000,'bounded three-draw-call addition');
 let disposed=0;meshes.forEach(m=>m.geometry.addEventListener('dispose',()=>disposed++));
 sim.chooseMap('lakeside');assert.equal(disposed,3);assert.equal(sim.physics().bridges.length,0);
 for(let i=0;i<3;i++){sim.chooseMap('racetrack');sim.resetVehicle();assert.equal(sim.physics().bridges.length,2);assert.equal(sim.physics().world.bodies.length,58);sim.chooseMap('mountain');}
});
