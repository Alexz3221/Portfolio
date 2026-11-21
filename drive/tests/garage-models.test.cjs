const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('three');
const {vehicles} = require('../js/physics.js');

const files = [
  {type:'hypercar', file:'delorean.glb', author:'cadwalader', license:'CC BY 4.0', triangles:117341, maxBytes:5200000},
  {type:'rally', file:'rally.glb', author:'tevy', license:'CC0 1.0', triangles:17770, maxBytes:800000},
  {type:'pickup', file:'pickup.glb', author:'Quaternius', license:'CC0 1.0', triangles:13184, maxBytes:800000}
];
const wheelNames = ['wheel-back-right','wheel-front-right','wheel-back-left','wheel-front-left'];

const loaderThree = {...THREE, TextureLoader:class {
  setCrossOrigin() { return this; }
  setRequestHeader() { return this; }
  load(url, onLoad) {
    assert.ok(url.startsWith('blob:'), 'all textures are self-contained');
    queueMicrotask(() => onLoad(new THREE.Texture()));
  }
}};
const context = vm.createContext({THREE:loaderThree, console, TextDecoder, TextEncoder, Blob,
  self:{URL}, URL, setTimeout, clearTimeout});
for (const modulePath of ['../js/vendor/GLTFLoader.js', '../js/vehicle-assets.js']) {
  vm.runInContext(fs.readFileSync(require.resolve(modulePath), 'utf8'), context);
}

for (const {type,file,author,license,triangles,maxBytes} of files) {
  test(`${file} fits the retained chassis and exposes both brake faces`, async () => {
    const spec = vehicles[type];
    const bytes = fs.readFileSync(path.join(__dirname,'../assets/vehicles/garage',file));
    const data = JSON.parse(bytes.subarray(20, 20+bytes.readUInt32LE(12)).toString());
    assert.equal(data.asset.extras.author, author);
    assert.ok(data.asset.extras.license.startsWith(license));
    assert.equal(data.extensionsRequired?.length || 0, 0);
    assert.ok(bytes.length < maxBytes, 'model fits the lazy download budget');
    const source = await new Promise((resolve,reject) => {
      new loaderThree.GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength), '', resolve, reject);
    });
    let sourceTriangles = 0;
    source.scene.traverse(mesh => {
      if (mesh.isMesh) sourceTriangles += (mesh.geometry.index?.count || mesh.geometry.attributes.position.count)/3;
    });
    assert.equal(sourceTriangles, triangles);

    for (const [index,name] of wheelNames.entries()) {
      const axle = spec.wheelLayout[index];
      const wheel = source.scene.getObjectByName(name);
      assert.ok(wheel, name);
      const bounds = new THREE.Box3().setFromObject(wheel);
      const center = bounds.getCenter(new THREE.Vector3());
      const radius = bounds.getSize(new THREE.Vector3()).y/2;
      assert.ok(Math.abs(center.x-axle.x)<.0001);
      assert.ok(Math.abs(center.z-axle.z)<.0001);
      assert.ok(Math.abs(radius-axle.radius)<.001);
    }

    const prepared = context.DriveVehicleAssets.prepare(source.scene,spec,type);
    assert.equal(prepared.wheels.length,4);
    for (const wheel of prepared.wheels) {
      const center = new THREE.Box3().setFromObject(wheel).getCenter(new THREE.Vector3());
      assert.ok(center.length()<.0001, 'each wheel rotates about its hub');
    }
    if (type==='hypercar') {
      const point = new THREE.Vector3(), rimCenter = new THREE.Vector3();
      for (const index of [1,3]) {
        const wheel = prepared.wheels[index];
        const rim = wheel.children.find(part=>part.material.name==='material');
        const tire = wheel.children.find(part=>part.material.name==='tyre');
        assert.ok(rim && tire, 'source wheel includes its rim and tire');
        const rimBounds = new THREE.Box3().setFromBufferAttribute(rim.geometry.attributes.position);
        assert.ok(rimBounds.max.x-rimBounds.min.x<.05, 'rim face is perpendicular to the spin axle');
        const positions = tire.geometry.attributes.position;
        for (let eighth=0;eighth<8;eighth++) {
          wheel.rotation.x = eighth*Math.PI/4;
          wheel.updateMatrixWorld(true);
          rimBounds.getCenter(rimCenter).applyMatrix4(rim.matrixWorld);
          assert.ok(Math.hypot(rimCenter.y,rimCenter.z)<.004, 'spinning rim center stays on the axle');
          let radius = 0;
          for (let i=0;i<positions.count;i++) {
            point.fromBufferAttribute(positions,i).applyMatrix4(tire.matrixWorld);
            radius = Math.max(radius,Math.abs(point.y));
          }
          assert.ok(Math.abs(radius-spec.wheelLayout[index].radius)<.004, 'tread stays round throughout a turn');
        }
      }
    }
    const lampBounds = new THREE.Box3();
    const atlasLampSides = new Set();
    prepared.body.traverse(mesh => {
      if (!mesh.isMesh || !prepared.brakeMaterials.includes(mesh.material)) return;
      assert.equal(mesh.material.emissiveIntensity,.22);
      lampBounds.union(new THREE.Box3().setFromObject(mesh));
      if (type==='hypercar') {
        assert.ok(mesh.material.map && mesh.material.emissiveMap, 'both original lamp maps are present');
        const {position,uv} = mesh.geometry.attributes;
        assert.ok(uv, 'the lamp atlas is mapped onto its source geometry');
        for (let i=0;i<position.count;i++) {
          if (position.getZ(i)<-2.05 && uv.getX(i)>.107 && uv.getX(i)<.293 && uv.getY(i)>.534 && uv.getY(i)<.737)
            atlasLampSides.add(Math.sign(position.getX(i)));
        }
      }
    });
    if (type==='hypercar') {
      assert.deepEqual([...atlasLampSides].sort(),[-1,1], 'rear red atlas cells are present on both sides');
      assert.ok(prepared.brakeMaterials.every(material=>material.customProgramCacheKey()==='garage-delorean-brake-atlas'));
    } else {
      assert.ok(lampBounds.min.x<-.15 && lampBounds.max.x>.15, 'lenses on both sides');
      assert.ok(lampBounds.max.z<-.8, 'lenses face rearward');
    }
  });
}
