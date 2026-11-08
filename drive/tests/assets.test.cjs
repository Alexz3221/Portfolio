const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const THREE=require('three'),physics=require('../js/physics.js');
const manifest=require('../assets/vehicles/passenger/manifest.json');
const fakeThree={...THREE};
// Real GLB geometry/material parsing; browser texture decoding is separately required.
fakeThree.TextureLoader=class {setCrossOrigin(){return this;}setRequestHeader(){return this;}load(url,done){assert.ok(url.startsWith('blob:'));const texture=new THREE.Texture();queueMicrotask(()=>done(texture));return texture;}};
const context=vm.createContext({THREE:fakeThree,console,TextDecoder,TextEncoder,Blob,self:{URL},URL,setTimeout,clearTimeout});
vm.runInContext(fs.readFileSync(require.resolve('../js/vendor/GLTFLoader.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require.resolve('../js/vehicle-assets.js'),'utf8'),context);
test('approved passenger GLBs preserve geometry, licenses and physical wheel alignment',async()=>{
 let total=0;
 for(const [type,meta] of Object.entries(manifest)){
  const bytes=fs.readFileSync(require.resolve('../assets/vehicles/passenger/'+meta.file));total+=bytes.length;
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),meta.sha256);
  assert.ok(bytes.length<1200000,type+' bounded lazy download');
  const gltf=await new Promise((resolve,reject)=>new fakeThree.GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',resolve,reject));
  gltf.scene.updateMatrixWorld(true);
  let triangles=0;gltf.scene.traverse(mesh=>{if(mesh.isMesh)triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;});
  assert.equal(triangles,meta.triangles);assert.ok(triangles<8000);
  const spec=physics.vehicles[type];
  assert.ok(Math.abs(spec.width-meta.width)<.000001);assert.ok(Math.abs(spec.length-meta.length)<.000001);
  const order=['wheel-back-right','wheel-front-right','wheel-back-left','wheel-front-left'];
  order.forEach((name,i)=>{
    const wheel=gltf.scene.getObjectByName(name),box=new THREE.Box3().setFromObject(wheel);
    const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    assert.ok(Math.abs(center.x-spec.wheelLayout[i].x)<.00001);
    assert.ok(Math.abs(center.z-spec.wheelLayout[i].z)<.00001);
    assert.ok(Math.abs(size.y/2-spec.wheelLayout[i].radius)<.00001);
  });
  const result=context.DriveVehicleAssets.prepare(gltf.scene,{...spec,wheelRadius:spec.radius});
  assert.equal(result.wheels.length,4);assert.ok(result.brakeMaterials.length>0);
  result.wheels.forEach((wheel,i)=>{
    const box=new THREE.Box3().setFromObject(wheel),size=box.getSize(new THREE.Vector3());
    assert.ok(box.getCenter(new THREE.Vector3()).length()<.00001);
    assert.ok(Math.abs(size.y/2-spec.wheelLayout[i].radius)<.00001);
  });
  let rearTriangles=0, hasGlass=false, hasBodyTexture=false;
  result.body.traverse(mesh=>{
    if(!mesh.isMesh)return;
    assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      if(material.name.startsWith('Glass')) hasGlass=true;
      if(material.name.startsWith('Body') && material.map) hasBodyTexture=true;
      if(material.name.startsWith('BrakeLens')){
        assert.ok(result.brakeMaterials.includes(material));assert.equal(material.emissiveIntensity,.22);
        rearTriangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;
        const index=mesh.geometry.index,positions=mesh.geometry.attributes.position;
        for(let i=0;i<index.count;i++) assert.ok(positions.getZ(index.getX(i))<0,type+' authored lamps at rear');
      }
    }
  });
  assert.ok(hasGlass&&hasBodyTexture,type+' retains source materials');
  assert.equal(rearTriangles,meta.brakeLensTriangles);
 }
 assert.ok(total<4000000,'four optimized models under 4 MB');
 const license=fs.readFileSync(require.resolve('../assets/vehicles/passenger/LICENSE.txt'),'utf8');
 assert.match(license,/Comrade1280/);assert.match(license,/CC-BY-4.0/);assert.match(license,/20f9af9b8a404d5cb022ac6fe87f21f5/);
});
