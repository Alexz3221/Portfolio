const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const THREE=require('three');
const C=require('cannon');
const physics=require('../js/physics.js');

test('supplied U9 GLB loads with textured body, four aligned wheels and Xtreme aero',async()=>{
  const bytes=fs.readFileSync(require.resolve('../assets/vehicles/u9-xtreme/u9-source.glb'));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'655513d8c18affde05348a0ad4065349e332c790168b1a252ac20ac0c0328657');
  const fakeThree={...THREE};
  fakeThree.TextureLoader=class {
    setCrossOrigin(){return this;}
    setRequestHeader(){return this;}
    load(url,done){const texture=new THREE.Texture();queueMicrotask(()=>done(texture));return texture;}
  };
  const context=vm.createContext({THREE:fakeThree,console,TextDecoder,TextEncoder,Blob,self:{URL},URL,setTimeout,clearTimeout});
  vm.runInContext(fs.readFileSync(require.resolve('../js/vendor/GLTFLoader.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(require.resolve('../js/u9-xtreme-asset.js'),'utf8'),context);
  const gltf=await new Promise((resolve,reject)=>new fakeThree.GLTFLoader().parse(
    bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',resolve,reject));
  const model=context.DriveU9XtremeAsset.prepare(gltf.scene,physics.vehicles.u9xtreme);
  assert.equal(model.wheels.length,4);
  for(let i=0;i<4;i++){
    const box=new THREE.Box3().setFromObject(model.wheels[i]);
    const size=box.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.y/2-physics.vehicles.u9xtreme.wheelLayout[i].radius)<.01);
    assert.ok(box.getCenter(new THREE.Vector3()).length()<.04);
  }
  const bodyBox=new THREE.Box3().setFromObject(model.body);
  assert.ok(bodyBox.max.y<=physics.vehicles.u9xtreme.height+.02);
  let textured=false,aero=false,triangles=0;
  model.body.traverse(node=>{
    if(!node.isMesh)return;
    triangles+=(node.geometry.index?.count||node.geometry.attributes.position.count)/3;
    textured ||= !!node.material.map;
    aero ||= node.material.name==='XtremeCarbonAero';
  });
  model.wheels.forEach(wheel=>wheel.traverse(node=>{
    if(node.isMesh)triangles+=(node.geometry.index?.count||node.geometry.attributes.position.count)/3;
  }));
  assert.ok(textured && aero);
  assert.ok(triangles<80000,`optimized model has ${triangles} triangles`);
  assert.equal(model.rearLamp.color.getHex(),0xff354e);
});

test('original U9 visual fits its published height and keeps four animated wheels',()=>{
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../js/u9-xtreme-model.js'),'utf8'),context);
  const model=context.DriveU9XtremeModel.build(THREE,physics.vehicles.u9xtreme);
  assert.equal(model.wheels.length,4);
  model.wheels.forEach((entry,i)=>{
    const axle=physics.vehicles.u9xtreme.wheelLayout[i];
    assert.equal(entry.pivot.position.x,axle.x);
    assert.equal(entry.pivot.position.z,axle.z);
    assert.equal(entry.front,axle.z>0);
  });
  const bounds=new THREE.Box3().setFromObject(model.group);
  assert.ok(bounds.max.y<=physics.vehicles.u9xtreme.height+.01);
  assert.ok(bounds.max.x-bounds.min.x<2.1);
  let triangles=0;
  model.group.traverse(node=>{
    if(node.isMesh)triangles+=(node.geometry.index?.count||node.geometry.attributes.position.count)/3;
  });
  assert.ok(triangles<3000);
  assert.equal(model.rearLamp.color.getHex(),0xff354e);
});

test('U9 power budget reaches near its 503.17 km/h target on a long straight',()=>{
  const p=physics.create({map:'city',car:'u9xtreme'});
  for(const body of [...p.world.bodies])if(body!==p.body)p.world.removeBody(body);
  const road=new C.Body({mass:0});
  road.addShape(new C.Plane());
  road.quaternion.setFromEuler(-Math.PI/2,0,0);
  p.world.addBody(road);
  p.reset(0,0,0);
  for(let i=0;i<30*60;i++)p.step(1/60,{throttle:1});
  const speedKmh=p.body.velocity.length()*3.6;
  assert.ok(speedKmh>=490 && speedKmh<=503.17,`long-straight speed ${speedKmh} km/h`);
  assert.equal(p.spec.powerKW,2220);
});
