const assert = require('node:assert/strict');
const test = require('node:test');
const THREE = require('three');
const CANNON = require('cannon');
const city = require('../js/portfolio-city');
const spaces = require('../js/portfolio-public-spaces');
const physics = require('../js/physics');

test('the public spaces have raised perimeter walks and keep adjacent streets open', () => {
  const world = new THREE.Group();
  const simulation = physics.create({map:'city',city,distanceToRoad:city.distanceToRoad,roadHalfWidth:city.roadHalfWidth});
  const bodyCount = simulation.world.bodies.length;
  const release = spaces.attach(THREE,world,{Cannon:CANNON,physics:simulation});
  world.updateMatrixWorld(true);

  function grade(x,z) {
    const result = new CANNON.RaycastResult();
    simulation.world.raycastClosest(new CANNON.Vec3(x,.32,z),new CANNON.Vec3(x,-.1,z),{skipBackfaces:true},result);
    assert.ok(result.hasHit,`surface at ${x}, ${z}`);
    return result.hitPointWorld.y;
  }

  const perimeter = [
    ['portfolio-projects-plaza',[[13.25,26],[31.65,26],[22.5,17.5],[22.5,39.5]]],
    ['portfolio-switchyard-park',[[-145.30,55],[-119.40,63],[-133,41],[-133,72]]]
  ];
  for (const [name,samples] of perimeter) {
    const walk = world.getObjectByName(name+'-perimeter-walk');
    assert.ok(walk);
    for (const [x,z] of samples) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0));
      const [hit] = ray.intersectObject(walk);
      assert.ok(hit,`paved ${name} at ${x}, ${z}`);
      assert.ok(Math.abs(grade(x,z)-hit.point.y)<.002);
    }
  }
  for (const [x,z,height] of [[12.45,27,.107],[-118.82,55,.185],[0,22,0],[28,12,0],[-108,55,0]]) {
    assert.ok(Math.abs(grade(x,z)-height)<.004,`curb and road height at ${x}, ${z}`);
  }
  release.dispose();
  assert.equal(simulation.world.bodies.length,bodyCount);
});
