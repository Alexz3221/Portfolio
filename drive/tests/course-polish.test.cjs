const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const THREE=require('three');
const P=require('../js/physics');
// Reuse the application's renderer-stub harness; actual geometry and physics stay real.
const harnessSource=fs.readFileSync(__dirname+'/camera.test.cjs','utf8').split("test('mouse drag")[0];
const context={require,__dirname,console};vm.createContext(context);
vm.runInContext(harnessSource+';globalThis.makeHarness=harness;',context);

test('extended course has terrain-conforming batched markings and a longer closed loop',()=>{
 const {sim}=context.makeHarness();sim.chooseMap('racetrack');
 const route=sim.samples();let length=0;
 route.forEach((s,i)=>length+=s.point.distanceTo(route[(i+1)%route.length].point));
 assert.ok(length>1350,'course length '+length);
 for(const name of ['circuit-kerbs','circuit-start-line']) {
  const mesh=sim.world.getObjectByName(name),positions=mesh.geometry.attributes.position;
  assert.ok(mesh.material.polygonOffset&&mesh.material.vertexColors);
  assert.equal(positions.count,mesh.geometry.attributes.color.count);
  for(let i=0;i<positions.count;i++)assert.ok(Math.abs(positions.getY(i)-sim.physics().terrainHeight(positions.getX(i),positions.getZ(i))-.16)<.00002);
  for(let i=0;i<positions.count;i+=3) {
   const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(positions,i+k));
   assert.ok(points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).length()>.001,'nondegenerate painted triangle');
   const center=points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/3);
   assert.ok(center.y-sim.physics().terrainHeight(center.x,center.z)>.08,'paint stays above terrain/asphalt');
  }
 }
});

test('launch crest gives every car real airtime and recoverable landing',()=>{
 for(const car of Object.keys(P.vehicles)) {
  const p=P.create({map:'racetrack',car});p.reset(-164,-9);
  for(let i=0;i<120;i++)p.step(1/60);
  p.body.velocity.set(0,0,26);
  let airborne=0,landed=false;
  for(let i=0;i<240;i++){
   const state=p.step(1/60);
   if(!state.grounded)airborne++;
   if(airborne>5&&state.grounded)landed=true;
  }
  assert.ok(airborne>8,car+' actual airtime '+airborne);
  assert.ok(landed,car+' returns to collision surface');
  assert.ok(p.body.quaternion.vmult({x:0,y:1,z:0}).y>.5,car+' lands upright');
 }
});
