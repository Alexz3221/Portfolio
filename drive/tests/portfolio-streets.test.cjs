const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const CANNON = require('cannon');
const streets = require('../js/portfolio-streets');
const city = require('../js/portfolio-city');
const arrival = require('../js/portfolio-arrival-sidewalks');
const DrivePhysics = require('../js/physics');

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
  assert.equal(at(1,-6,curb).length, 1);
  assert.equal(at(1,-6.6,curb).length, 0);
  assert.equal(streets.surfaceHeight(world,1,-6),.17);
});

test('the raised network joins plaza paths, keeps road centers clear and defers to authored walks', () => {
  const world = new THREE.Group();
  const material = new THREE.MeshStandardMaterial();
  const areas = [{x:0,z:4,w:48,d:84},{x:78,z:-53,w:40,d:38},{x:-75,z:-20,w:29,d:22}];
  streets.build(THREE,world,{roads:city.networkRoads,areas,asphalt:material,curb:material,premium:arrival.footprint()});
  for (const road of city.networkRoads) {
    assert.equal(streets.surfaceHeight(world,(road.x1+road.x2)/2,(road.z1+road.z2)/2),0);
  }
  for (const [x,z,y] of [[122.25,-40,.17],[-118,25,.17],[-48,125.5,.17],[-25,8,.17],
    [7.6,-73.6,0],[11.25,-86,0],[-71,-10.3,0],[112,-40,0],[-108,25,0]]) {
    assert.equal(streets.surfaceHeight(world,x,z),y,`${x}, ${z}`);
  }
  const simulation=DrivePhysics.create({map:'city',city,distanceToRoad:city.distanceToRoad,roadHalfWidth:city.roadHalfWidth});
  const bodyCount=simulation.world.bodies.length;
  const sidewalkPhysics=streets.attachSidewalkPhysics(world,simulation);
  assert.ok(sidewalkPhysics);
  assert.ok(simulation.world.bodies.length-bodyCount<75,'walks are grouped into local static surfaces');
  for (const [x,z,height] of [[122.25,-40,.17],[-118,25,.17],[-48,125.5,.17],[-25,8,.17],
    [112,-40,0],[-108,25,0],[7.6,-73.6,0]]) {
    const result=new CANNON.RaycastResult();
    simulation.world.raycastClosest(new CANNON.Vec3(x,1,z),new CANNON.Vec3(x,-1,z),{skipBackfaces:true},result);
    assert.ok(result.hasHit);
    assert.ok(Math.abs(result.hitPointWorld.y-height)<.007,`${x}, ${z}`);
  }
  sidewalkPhysics.dispose();
  assert.equal(simulation.world.bodies.length,bodyCount);
  world.clear();
  assert.equal(streets.surfaceHeight(world,122.25,-40),0,'does not leak Portfolio City onto another map');
});
