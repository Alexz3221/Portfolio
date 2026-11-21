const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const streets = require('../js/portfolio-streets');

test('an angled road joint has one paved surface and a continuous curb', () => {
  const world = new THREE.Group();
  const material = new THREE.MeshStandardMaterial();
  streets.build(THREE, world, {
    roads: [
      {x1:-20,z1:0,x2:0,z2:0,width:8},
      {x1:0,z1:0,x2:16,z2:16,width:8}
    ],
    areas: [], asphalt:material, curb:material
  });
  const pavement = world.getObjectByName('portfolio-streets');
  const curb = world.getObjectByName('portfolio-curbs');
  function at(x,z,mesh) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x,5,z),new THREE.Vector3(0,-1,0));
    return ray.intersectObject(mesh);
  }

  // This outside edge of the bend was beyond both rectangular end caps.
  assert.equal(at(1,-3.6,pavement).length, 1);
  assert.equal(at(1,-3.6,curb).length, 0);
  // The outer curb band continues around the same bend without covering the road.
  assert.equal(at(1,-4.4,pavement).length, 0);
  assert.equal(at(1,-4.4,curb).length, 1);
  assert.equal(at(1,-6,curb).length, 0);
});
