const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const THREE = require('three');
const manifest = require('../assets/vehicles/manifest.json');
const physics = require('../js/physics.js');
const fakeThree = {...THREE};
// Exercise the actual GLB parser and geometry; image decode requires a browser.
fakeThree.TextureLoader = class {setCrossOrigin(){return this;} setRequestHeader(){return this;} load(url,done){assert.ok(fs.existsSync(url));const t=new THREE.Texture();queueMicrotask(()=>done(t));return t;}};
const context = vm.createContext({THREE:fakeThree, console, TextDecoder, TextEncoder, self:{URL}, URL, setTimeout, clearTimeout});
vm.runInContext(fs.readFileSync(require.resolve('../js/vendor/GLTFLoader.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require.resolve('../js/vehicle-assets.js'),'utf8'),context);
test('all four shipped GLBs parse, match hashes, and become finite bodies with four centered wheels', async()=>{
  let bytes=0;
  for(const [type,meta] of Object.entries(manifest)){
    const buf=fs.readFileSync(require.resolve('../assets/vehicles/'+meta.file));bytes+=buf.length;
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'),meta.sha256);
    const gltf=await new Promise((resolve,reject)=>new fakeThree.GLTFLoader().parse(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),require('node:path').resolve(__dirname,'../assets/vehicles')+'/',resolve,reject));
    const spec={...physics.vehicles[type],wheelRadius:physics.vehicles[type].radius,color:0xae8aff};
    const result=context.DriveVehicleAssets.prepare(gltf.scene,spec);
    assert.ok(result.rearLamp.isMeshBasicMaterial);
    const bodyMaterials=result.body.children.flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]);
    assert.ok(bodyMaterials.includes(result.rearLamp),type+' has working brake lamps');
    const paint=bodyMaterials.find(material=>material.isMeshPhysicalMaterial && material.clearcoat===.8);
    assert.ok(paint,type+' has clear-coated paint');
    assert.equal(paint.color.getHex(),spec.color);
    assert.ok(bodyMaterials.some(material=>material.isMeshPhysicalMaterial && material.clearcoat===1),type+' has separate glazing');
    assert.ok(bodyMaterials.length<=9,'bounded active-car material/draw count');
    if(type==='hypercar') {
      const lamps=result.body.children.filter(mesh=>mesh.name.startsWith('surface-'));
      assert.equal(lamps.filter(mesh=>mesh.name==='surface-tail-lamp').length,2);
      assert.equal(lamps.filter(mesh=>mesh.name==='surface-head-lamp').length,2);
      result.body.updateMatrixWorld(true);
      const panels=result.body.children.filter(mesh=>!mesh.name.startsWith('surface-'));
      for(const lamp of lamps) {
        const direction=lamp.name==='surface-head-lamp'?1:-1;
        const positions=lamp.geometry.attributes.position, indices=lamp.geometry.index;
        const samples=Array.from({length:positions.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(positions,i));
        // Check every corner/grid vertex AND each triangle center, rather than
        // only a center anchor that could leave the lens crossing a silhouette.
        for(let i=0;i<indices.count;i+=3) samples.push(new THREE.Vector3().add(samples[indices.getX(i)]).add(samples[indices.getX(i+1)]).add(samples[indices.getX(i+2)]).multiplyScalar(1/3));
        for(const point of samples) {
          const ray=new THREE.Raycaster(point.clone().add(new THREE.Vector3(0,0,direction*.01)),new THREE.Vector3(0,0,-direction));
          const hit=ray.intersectObjects(panels,false)[0];
          assert.ok(hit,'entire lens has supporting panel');
          assert.ok(hit.face.normal.z*direction>.4,'lamp faces outside car');
          assert.ok(Math.abs(hit.distance-.016)<.0001,'lamp is flush, not floating');
        }
      }
    }
    assert.ok(result.body.children.length>0);assert.equal(result.wheels.length,4);
    const bodyBounds=new THREE.Box3();
    result.body.children.filter(mesh=>!mesh.name.startsWith('surface-')).forEach(mesh=>bodyBounds.expandByObject(mesh));
    assert.ok(Math.abs(bodyBounds.getSize(new THREE.Vector3()).z-spec.length)<.001);
    result.wheels.forEach(wheel=>{
      const box=new THREE.Box3().setFromObject(wheel),size=box.getSize(new THREE.Vector3());
      assert.ok(box.getCenter(new THREE.Vector3()).length()<.00001);
      assert.ok(Math.abs(size.y-spec.radius*2)<.00001);
      assert.ok(Math.abs(size.z-spec.radius*2)<.00001);
    });
    result.body.traverse(mesh=>{if(mesh.geometry)assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));});
  }
  assert.ok(bytes<800000);
});
