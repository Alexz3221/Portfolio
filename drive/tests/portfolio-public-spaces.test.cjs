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
    ['portfolio-projects-plaza',[[5.35,26],[32.75,26],[22.5,16.65],[22.5,42.9]]],
    ['portfolio-projects-plaza-west',[[-39.22,22],[-5.4,26],[-16.5,15.5],[-16.5,42.8]]],
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
  for (const [x,z,height] of [[4.55,27,.107],[-4.55,27,.107],[-118.82,55,.185],[0,22,0],
    [3.75,30.2,0],[-3.75,30.2,0],[28,12,0],[-108,55,0]]) {
    assert.ok(Math.abs(grade(x,z)-height)<.004,`curb and road height at ${x}, ${z}`);
  }
  for (let x=-38; x<=-25; x+=.5) {
    assert.ok(Math.abs(grade(x,20)-.185)<.002,`continuous grade from the west walk to the produce court at ${x}`);
  }
  for (const feature of ['restrooms','plaza-office','little-hours-counter','corner-press-counter','produce-counter']) {
    assert.ok(world.getObjectByName('portfolio-plaza-'+feature),feature);
  }
  const officeSign = world.getObjectByName('portfolio-plaza-plaza-office');
  const officeView = officeSign.position.clone().add(new THREE.Vector3(-6,0,0));
  const [signHit] = new THREE.Raycaster(officeView,new THREE.Vector3(1,0,0))
    .intersectObjects(world.children,true);
  assert.ok(signHit?.object===officeSign,`the office fascia leaves the lettering visible (${signHit?.object.name})`);
  const facilityWall = new CANNON.RaycastResult();
  simulation.world.raycastClosest(new CANNON.Vec3(24,1.35,36.35),new CANNON.Vec3(33,1.35,36.35),{},facilityWall);
  assert.ok(facilityWall.hasHit && Math.abs(facilityWall.hitPointWorld.x-26.165)<.015,'public facilities have a collision wall');

  const destination = spaces.destinations.find(landmark=>landmark.id==='projects-plaza');
  simulation.reset(destination.x,destination.z,destination.heading);
  for (let frame=0;frame<600 && simulation.body.position.z<44;frame++) simulation.step(1/120,{throttle:1,steer:0});
  assert.ok(simulation.body.position.z>=44,'both Projects Plaza approaches are open through the marked crossing');
  release.dispose();
  assert.equal(simulation.world.bodies.length,bodyCount);
});
