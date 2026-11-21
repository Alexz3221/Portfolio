const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const CANNON = require('cannon');
const streets = require('../js/portfolio-streets');
const city = require('../js/portfolio-city');
const arrival = require('../js/portfolio-arrival-sidewalks');
const publicSpaces = require('../js/portfolio-public-spaces');
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
  assert.equal(at(1,-7.7,curb).length, 1);
  assert.equal(at(1,-8.3,curb).length, 0);
  assert.equal(streets.surfaceHeight(world,1,-6),.17);
});

test('an authored sidewalk joint preserves both top edges without an exposed dividing wall', () => {
  const world=new THREE.Group();
  const material=new THREE.MeshStandardMaterial();
  const premium=[[[[-3,4.25],[3,4.25],[3,8.5],[-3,8.5]]]];
  streets.build(THREE,world,{roads:[{x1:-20,z1:0,x2:20,z2:0,width:8}],areas:[],
    asphalt:material,curb:material,premium});
  const sides=world.getObjectByName('portfolio-sidewalk-faces');
  const towardJoint=new THREE.Raycaster(new THREE.Vector3(0,.08,6),new THREE.Vector3(-1,0,0),0,5);
  const towardOuterCurb=new THREE.Raycaster(new THREE.Vector3(8,.08,10),new THREE.Vector3(0,0,-1),0,3);
  assert.equal(streets.surfaceHeight(world,-3.1,6),.17);
  assert.equal(streets.surfaceHeight(world,-2.9,6),0);
  assert.equal(towardJoint.intersectObject(sides).length,0);
  assert.equal(towardOuterCurb.intersectObject(sides).length,1);
});

test('the raised network joins plaza paths, keeps road centers clear and defers to authored walks', () => {
  const world = new THREE.Group();
  const material = new THREE.MeshStandardMaterial();
  const areas = [{x:0,z:4,w:48,d:84},{x:78,z:-53,w:40,d:38},{x:-75,z:-20,w:29,d:22}];
  streets.build(THREE,world,{roads:city.networkRoads,areas,asphalt:material,curb:material,premium:arrival.footprint()});
  for (const road of city.networkRoads) {
    assert.equal(streets.surfaceHeight(world,(road.x1+road.x2)/2,(road.z1+road.z2)/2),0);
  }
  for (const [x,z,y] of [[122.25,-40,.17],[124.9,-40,.17],[-120.15,25,.17],[-48,125.5,.17],[-25,8,.17],
    [7.6,-73.6,0],[11.25,-86,0],[-71,-10.3,0],[112,-40,0],[-108,25,0]]) {
    assert.equal(streets.surfaceHeight(world,x,z),y,`${x}, ${z}`);
  }
  const simulation=DrivePhysics.create({map:'city',city,distanceToRoad:city.distanceToRoad,roadHalfWidth:city.roadHalfWidth});
  const bodyCount=simulation.world.bodies.length;
  const sidewalkPhysics=streets.attachSidewalkPhysics(world,simulation);
  assert.ok(sidewalkPhysics);
  assert.ok(simulation.world.bodies.length-bodyCount<75,'walks are grouped into local static surfaces');
  for (const [x,z,height] of [[122.25,-40,.17],[124.9,-40,.17],[-120.15,25,.17],[-48,125.5,.17],[-25,8,.17],
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

test('ground-floor building approaches reach the street network and meet both public decks', t => {
  const world=new THREE.Group();
  const material=new THREE.MeshStandardMaterial();
  const areas=[{x:0,z:4,w:48,d:84},{x:78,z:-53,w:40,d:38},{x:-75,z:-20,w:29,d:22}];
  const obstacles=city.supports.map(({x,z,width:w,depth:d})=>({x,z,w,d}));
  streets.build(THREE,world,{roads:city.networkRoads,areas,asphalt:material,curb:material,
    premium:arrival.footprint(),buildings:city.buildings,obstacles,publicSpaces:publicSpaces.footprints});
  const access=streets.buildingAccess(world);
  const buildings=city.buildings.filter(({baseY,collisionOnly,width,depth,height})=>
    baseY===0 && !collisionOnly && width>=4.5 && depth>=4.5 && height>=6);
  assert.deepEqual(access.map(({building})=>building),buildings);

  const simulation=DrivePhysics.create({map:'city',city,distanceToRoad:city.distanceToRoad,roadHalfWidth:city.roadHalfWidth});
  const previousCannon=globalThis.CANNON;
  globalThis.CANNON=CANNON;
  t.after(()=>{globalThis.CANNON=previousCannon;});
  const lifts=[streets.attachSidewalkPhysics(world,simulation),arrival.attach(THREE,world,simulation),
    publicSpaces.attach(THREE,world,{Cannon:CANNON,physics:simulation})];
  function sidewalkHeight(x,z) {
    const result=new CANNON.RaycastResult();
    simulation.world.raycastClosest(new CANNON.Vec3(x,.24,z),new CANNON.Vec3(x,-.05,z),{skipBackfaces:true},result);
    return result.hasHit ? result.hitPointWorld.y : -1;
  }
  for (const {building,x,z,surface} of access) {
    const sinceWall=Math.max(Math.abs(x-building.x)-building.width/2,Math.abs(z-building.z)-building.depth/2);
    assert.ok(sinceWall>0 && sinceWall<3.4,`approaches exterior ${building.x}, ${building.z}`);
    const minHeight=surface==='arrival' ? .065 : .165;
    assert.ok(sidewalkHeight(x,z)>=minHeight,`paved approach at ${x}, ${z}`);
  }
  // Follow the actual apron and deck continuously across the former dirt gaps.
  for (let x=32.25;x<=33.85;x+=.06) assert.ok(sidewalkHeight(x,28)>.165,`plaza join at x=${x}`);
  for (let z=38.15;z<=42;z+=.06) assert.ok(sidewalkHeight(-130,z)>.165,`park join at z=${z}`);
  assert.ok(sidewalkHeight(-51.8,1.3)>.165,'paved corner between the Market frontage and side walk');
  assert.ok(sidewalkHeight(-44,5)<.01,'open courtyard beyond the Market frontage');
  assert.equal(streets.surfaceHeight(world,-50,-31.8),0,'leaves the Skyway support base clear');
  for (const {x1,z1,x2,z2} of city.networkRoads) {
    assert.equal(streets.surfaceHeight(world,(x1+x2)/2,(z1+z2)/2),0);
  }
  for (const lift of lifts) lift.dispose();
  world.clear();
  assert.deepEqual(streets.buildingAccess(world),[]);
});
