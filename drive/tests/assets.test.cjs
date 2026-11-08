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
    const spec={...physics.vehicles[type],wheelRadius:physics.vehicles[type].radius};
    const result=context.DriveVehicleAssets.prepare(gltf.scene,spec);
    assert.ok(result.body.children.length>0);assert.equal(result.wheels.length,4);
    const bodyBounds=new THREE.Box3().setFromObject(result.body);
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
