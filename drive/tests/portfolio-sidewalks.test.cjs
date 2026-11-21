const test = require('node:test');
const assert = require('node:assert/strict');
const CANNON = require('cannon');
const THREE = require('three');
const physics = require('../js/physics');
const city = require('../js/portfolio-city');
const sidewalks = require('../js/portfolio-arrival-sidewalks');

test('raised walkways and curb cuts match the surface while the driving lanes stay open', () => {
  const original = globalThis.CANNON;
  globalThis.CANNON = CANNON;
  try {
    const simulation = physics.create({map:'city',city,distanceToRoad:city.distanceToRoad,roadHalfWidth:city.roadHalfWidth});
    const world = new THREE.Group();
    const baseBodies = simulation.world.bodies.length;
    const frontage = sidewalks.attach(THREE,world,simulation);
    const ray = new CANNON.RaycastResult();
    for (const [x,z,height] of [
      [0,-103,0], [5.45,-103,0], [-5.45,-103,0], [5.8,-103,.17], [-5.8,-103,.17],
      [7.65,-103,.17], [-7.65,-103,.17], [5.62,-73.6,.072], [12.8,-86,.17], [13.53,-76.4,.17],
      [-77.7,-8.87,.17], [-59,-7.75,.17], [-80,-12.8,.17], [-53.31,-6.07,.17],
      [-77.7,-20,0], [-56.5,-13,0], [-69.3,-13.12,0]
    ]) {
      simulation.world.raycastClosest(new CANNON.Vec3(x,1,z),new CANNON.Vec3(x,-1,z),{skipBackfaces:true},ray);
      assert.ok(ray.hasHit);
      assert.ok(Math.abs(ray.hitPointWorld.y-height)<.008, `collider height at ${x}, ${z}`);
      assert.equal(sidewalks.surfaceHeight(x,z),height, `visual height at ${x}, ${z}`);
    }
    assert.ok(world.getObjectByName('arrival-sidewalk-curbs').geometry.attributes.position.count>100);
    assert.ok(world.getObjectByName('arrival-pedestrian-crossing').geometry.attributes.position.count>30);
    frontage.dispose();
    assert.equal(simulation.world.bodies.length,baseBodies);
  } finally {
    if (original===undefined) delete globalThis.CANNON;
    else globalThis.CANNON=original;
  }
});
