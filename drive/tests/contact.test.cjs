const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('cannon');
const P=require('../js/physics');
const cars=Object.keys(P.vehicles);
const maps=['lakeside','desert','alpine','mountain','racetrack'];
const up=p=>p.body.quaternion.vmult(new C.Vec3(0,1,0)).y;
const contact=p=>p.world.contacts.some(c=>c.bi===p.body||c.bj===p.body);

// A controlled landing isolates chassis friction from terrain shape and tires.
function incline(car,speed,angle){
 const p=P.create({map:'racetrack',car});const material=p.world.bodies[0].material;
 for(const b of [...p.world.bodies])if(b!==p.body)p.world.removeBody(b);
 const plane=new C.Body({mass:0,material});plane.addShape(new C.Plane());
 plane.quaternion.setFromEuler(-Math.PI/2-angle,0,0);p.world.addBody(plane);
 p.body.position.set(0,.75,0);p.body.velocity.set(0,-2,speed);
 let hit=false,minSpeed=speed,minUp=1;
 for(let i=0;i<60;i++){p.step(1/120);hit ||= contact(p);minSpeed=Math.min(minSpeed,p.body.velocity.z);minUp=Math.min(minUp,up(p));}
 return {hit,minSpeed,minUp};
}
test('shallow bumper landings slide without killing momentum or pitching over',()=>{
 for(const car of cars)for(const speed of [8,25,50]){
  const result=incline(car,speed,.16);
  assert.ok(result.hit,car+' fixture must contact chassis');
  assert.ok(result.minSpeed>speed*.65,car+'/'+speed+' preserves tangent speed '+result.minSpeed);
  assert.ok(result.minUp>.95,car+'/'+speed+' stays upright');
 }
 for(const car of cars){const r=incline(car,50,.08);assert.ok(r.hit);assert.ok(r.minSpeed>45);assert.ok(r.minUp>.95);}
});

test('actual cliff triangles allow low and high speed glancing contacts',()=>{
 for(const car of cars)for(const speed of [8,25,50]){
  const p=P.create({map:'mountain',car});p.reset(133,0);p.body.velocity.set(-2,0,speed);
  let hit=false,minSpeed=speed,minUp=1;
  for(let i=0;i<60;i++){p.step(1/120);hit ||=contact(p);minSpeed=Math.min(minSpeed,p.body.velocity.z);minUp=Math.min(minUp,up(p));}
  // Low speed can be supported entirely by the wheels after the bevel fix.
  if(speed>=25)assert.ok(hit,car+'/'+speed+' actual cliff contact');
  assert.ok(minSpeed>speed*.6,car+'/'+speed+' retains tangent speed '+minSpeed);
  assert.ok(minUp>.9,car+'/'+speed+' no glancing-contact flip');
 }
});

test('every car and map still stops at a solid obstacle at low and maximum speed',()=>{
 for(const map of maps)for(const car of cars)for(const speed of [8,P.vehicles[car].maxSpeed]){
  const p=P.create({map,car}),x=map==='mountain'?136:0;p.reset(x,0);p.addTree(x,8,1,30);
  for(let i=0;i<120;i++)p.step(1/120);
  p.body.velocity.set(0,0,speed);let hit=false,maxZ=-Infinity;
  for(let i=0;i<120;i++){p.step(1/120);hit ||=contact(p);maxZ=Math.max(maxZ,p.body.position.z);}
  assert.ok(hit,map+'/'+car+'/'+speed+' must collide');
  assert.ok(maxZ<8,map+'/'+car+'/'+speed+' must not tunnel: '+maxZ);
  assert.ok(p.body.velocity.z<speed*.3,map+'/'+car+' removes normal momentum');
 }
});

test('chassis contact material does not replace wheel grip or brake behavior',()=>{
 for(const map of maps)for(const car of cars){
  const p=P.create({map,car});const floor=p.world.bodies[0];
  const material=p.world.getContactMaterial(p.body.material,floor.material);
  assert.equal(material.friction,.01);assert.equal(material.restitution,0);
  assert.equal(p.car.wheelInfos[0].frictionSlip,P.vehicles[car].grip);
  const shape=p.body.shapes[0];assert.equal(shape.type,C.Shape.types.CONVEXPOLYHEDRON);
  assert.equal(shape.vertices.length,12);
  shape.faceNormals.forEach((normal,i)=>{
   assert.ok(Number.isFinite(normal.length())&&Math.abs(normal.length()-1)<1e-8);
   assert.ok(normal.dot(shape.vertices[shape.faces[i][0]])>0,'outward hull winding');
  });
 }
});
