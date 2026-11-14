const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('cannon');
const P=require('../js/physics');
const cars=Object.keys(P.vehicles);
const up=p=>p.body.quaternion.vmult(new C.Vec3(0,1,0)).y;
function ray(p,x,z,from,to){const hit=new C.RaycastResult();assert.ok(p.world.raycastClosest(new C.Vec3(x,from,z),new C.Vec3(x,to,z),{},hit));return hit;}

test('single ordered circuit uses contiguous closed solids except the explicit jump',()=>{
 const p=P.create({map:'racetrack'});p.body.position.set(190,50,190);
 const route=P.stuntRoute;
 assert.ok(route.length>200);
 let length=0,gaps=0;
 route.forEach((a,i)=>{const b=route[(i+1)%route.length];length+=Math.hypot(b.x-a.x,b.z-a.z);});
 assert.ok(length>950&&length<1400,'readable single loop, length '+length);
 for(let i=0;i<p.stuntSlabs.length;i++){
  const s=p.stuntSlabs[i],next=p.stuntSlabs[(i+1)%p.stuntSlabs.length];
  const shape=s.body.shapes[0];
  for(let f=0;f<shape.faces.length;f++){
   const normal=shape.faceNormals[f],origin=shape.vertices[shape.faces[f][0]];
   assert.ok(normal.dot(origin)>0,'outward convex normals');
   for(const k of shape.faces[f])assert.ok(Math.abs(normal.dot(shape.vertices[k].vsub(origin)))<1e-8,'render quads and collider faces are planar');
  }
  if(Math.hypot(s.b.x-next.a.x,s.b.z-next.a.z)>1e-8){gaps++;assert.equal(s.b.z,80);assert.equal(next.a.z,72);continue;}
  assert.equal(s.b.y,next.a.y,'no vertical joining lip');
  assert.equal(s.b.width,next.a.width,'no lateral joining gap');
  for(const [left,right] of [[5,4],[6,7]]){
   const a=s.vertices[left].vadd(s.body.position),b=next.vertices[right].vadd(next.body.position);
   assert.ok(a.distanceTo(b)<1e-8,'both actual collision edges meet');
  }
  const x=(s.a.x+s.b.x)/2,z=(s.a.z+s.b.z)/2,y=(s.a.y+s.b.y)/2;
  // Start below any upper crossing to sample this particular route level.
  const hit=ray(p,x,z,y+.2,y-.3);
  assert.ok(Math.abs(hit.hitPointWorld.y-y)<1e-6,'shared route surface is collidable');
 }
 assert.equal(gaps,1,'only deliberate 8 m jump interrupts the closed route');
 assert.equal(P.overpasses.length,0,'no optional legacy shortcut roads');
});

test('overpass has full-width lower clearance; gap and balance edges really drop away',()=>{
 const p=P.create({map:'racetrack'});p.body.position.set(190,50,190);
 for(const x of [-6,0,6])for(const z of [-5,0,5]){
  assert.ok(Math.abs(ray(p,x,z,20,-10).hitPointWorld.y-9)<1e-7);
  assert.ok(Math.abs(ray(p,x,z,3,-10).hitPointWorld.y)<1e-7);
  assert.ok(Math.abs(ray(p,x,z,3,12).hitPointWorld.y-8.4)<1e-7);
 }
 for(const x of [-5,0,5])for(const z of [74,76,78])assert.ok(Math.abs(ray(p,x,z,15,-12).hitPointWorld.y+8)<1e-6,'no invisible jump floor');
 for(const z of [-60,-75,-90]){
  assert.ok(Math.abs(ray(p,0,z,10,-12).hitPointWorld.y-4)<1e-7);
  for(const x of [-1.79,1.79])assert.ok(Math.abs(ray(p,x,z,10,-12).hitPointWorld.y-4)<1e-7);
  for(const x of [-2,2])assert.ok(Math.abs(ray(p,x,z,10,-12).hitPointWorld.y+8)<1e-6,'3.6m balance deck has real edges');
 }
});

test('every car clears the visible gap at recommended approach speeds with upright landing',()=>{
 for(const car of cars)for(const speed of [23,26,28]){
  const p=P.create({map:'racetrack',car});p.reset(0,110,Math.PI);
  for(let i=0;i<120;i++)p.step(1/60);
  p.body.velocity.set(0,0,-speed);let air=0,landed=false,minUp=1;
  for(let i=0;i<360&&p.body.position.z>30;i++){
   const state=p.step(1/60);if(!state.grounded)air++;
   if(air>10&&state.grounded&&p.body.position.z<72)landed=true;
   minUp=Math.min(minUp,up(p));
   assert.ok(p.body.position.y+(p.spec.centerOfMassDrop||0)>.4,
    'the visible chassis never falls to the recovery floor');
  }
  assert.ok(air>=40&&air<90,car+' meaningful but controlled airtime: '+air);
  assert.ok(landed,car+' lands beyond the gap');assert.ok(minUp>.9,car+' upright neutral landing');
  assert.ok(p.body.position.z<=30,car+' continues after landing');
 }
});

test('every car traverses the overpass and narrow balance deck at ordinary controlled speeds',()=>{
 for(const car of cars)for(const feature of ['overpass','balance']){
  const p=P.create({map:'racetrack',car});const bridge=feature==='overpass';
  p.reset(bridge?-145:0,bridge?0:-20,bridge?Math.PI/2:Math.PI);
  let air=0,minUp=1;
  for(let i=0;i<3600;i++){
   const speed=p.body.velocity.length();const state=p.step(1/60,{throttle:Math.max(0,Math.min(.6,(bridge?10:6)-speed)),brake:speed>(bridge?12:8)});
   air+=!state.grounded;minUp=Math.min(minUp,up(p));
   if(bridge?p.body.position.x>=145:p.body.position.z<=-110)break;
  }
  assert.ok(bridge?p.body.position.x>=145:p.body.position.z<=-110,car+' completes '+feature);
  assert.ok(minUp>.9);assert.ok(air<15);assert.ok(p.body.position.y>.5);
 }
});
