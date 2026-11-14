const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const THREE=require('three');
const C=require('cannon');
const physics=require('../js/physics.js');

test('supplied U9 GLB keeps its original shape, materials, interior and four animated wheels',async()=>{
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
  const rawSize=new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
  let paint,glass;
  gltf.scene.traverse(node=>{
    if(node.material?.name?.includes('Carpaint'))paint=node.material;
    if(node.material?.name==='MAT_Glass')glass=node.material;
  });
  const paintBefore=paint.color.getHex(),glassBefore={opacity:glass.opacity,transmission:glass.transmission,color:glass.color.getHex()};
  const model=context.DriveU9XtremeAsset.prepare(gltf.scene,physics.vehicles.u9xtreme);
  assert.equal(model.wheels.length,4);
  for(let i=0;i<4;i++){
    const box=new THREE.Box3().setFromObject(model.wheels[i]);
    const size=box.getSize(new THREE.Vector3());
    assert.ok(size.y>.70&&size.y<.79);
    assert.ok(box.getCenter(new THREE.Vector3()).length()<.04);
  }
  const bodyBox=new THREE.Box3().setFromObject(model.body);
  assert.ok(Math.abs(bodyBox.getSize(new THREE.Vector3()).x-rawSize.x*physics.vehicles.u9xtreme.length/rawSize.z)<.02);
  let textured=false,interior=false,aero=false,triangles=0;
  model.body.traverse(node=>{
    if(!node.isMesh)return;
    triangles+=(node.geometry.index?.count||node.geometry.attributes.position.count)/3;
    textured ||= !!node.material.map;
    interior ||= node.material.name==='MAT_Details_INT';
    aero ||= node.material.name==='XtremeCarbonAero';
  });
  model.wheels.forEach(wheel=>wheel.traverse(node=>{
    if(node.isMesh)triangles+=(node.geometry.index?.count||node.geometry.attributes.position.count)/3;
  }));
  assert.ok(textured && interior);
  assert.equal(aero,false);
  assert.equal(triangles,98416);
  assert.equal(paint.color.getHex(),paintBefore);
  assert.deepEqual({opacity:glass.opacity,transmission:glass.transmission,color:glass.color.getHex()},glassBefore);
  assert.equal(model.rearLamp,undefined);
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
