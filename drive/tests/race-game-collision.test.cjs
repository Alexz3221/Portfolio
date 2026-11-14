const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ThreeBase = require('three');
const Cannon = require('cannon');
const physics = require('../js/physics');
const imported = require('../js/imported-courses');

test('imported collision remaps GLB indices above the signed 16-bit CANNON limit', () => {
  const course = imported.getCourse('racegame');
  const sim = physics.create({map:'racetrack',courseId:'racegame',course,car:'comet'});
  const vertices = Array(40003 * 3).fill(0);
  for (const [index,x,z] of [[40000,20,20],[40001,20,22],[40002,22,20]]) {
    vertices[index * 3] = x;
    vertices[index * 3 + 1] = 2;
    vertices[index * 3 + 2] = z;
  }
  assert.equal(sim.addCourseCollisionMeshes([{vertices,indices:[40000,40001,40002]}]),true);
  const hit = new Cannon.RaycastResult();
  assert.ok(sim.world.raycastClosest(new Cannon.Vec3(20.5,5,20.5),
    new Cannon.Vec3(20.5,1,20.5),{},hit));
  assert.ok(Math.abs(hit.hitPointWorld.y-2)<.001,
    'the former wrapped-index triangle is a physical surface');
});

test('Race Game native asphalt supports the full loop, underpass and bridge', async () => {
  const fakeThree = {...ThreeBase};
  fakeThree.TextureLoader = class {
    setCrossOrigin(){return this;}
    setRequestHeader(){return this;}
    load(_url,done){queueMicrotask(()=>done(new ThreeBase.Texture()));return new ThreeBase.Texture();}
  };
  const context = vm.createContext({THREE:fakeThree,console,TextDecoder,TextEncoder,Blob,
    self:{URL},URL,setTimeout,clearTimeout});
  vm.runInContext(fs.readFileSync(require.resolve('../js/vendor/GLTFLoader.js'),'utf8'),context);
  fakeThree.GLTFLoader.prototype.load = function(path,done,_progress,error) {
    const bytes = fs.readFileSync(require.resolve('../' + path));
    this.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',done,error);
  };
  globalThis.THREE = fakeThree;
  const course = imported.getCourse('racegame');
  const sim = physics.create({map:'racetrack',courseId:'racegame',course,car:'hypercar'});
  const loaded = await imported.load('racegame');
  assert.ok(loaded.collisionMeshes.length>=10,'the reachable model mesh chunks are included');
  const triangles=loaded.collisionMeshes.reduce((sum,mesh)=>sum+mesh.indices.length/3,0);
  assert.ok(triangles>150000&&triangles<230000,
    `native collision keeps full road, bridge and terrain tops without all decoration (${triangles})`);
  assert.equal(sim.addCourseCollisionMeshes(loaded.collisionMeshes),true);
  function nativeRoadAt(x,z) {
    const hits=[];
    sim.world.raycastAll(new Cannon.Vec3(x,4,z),new Cannon.Vec3(x,-1,z),{},hit=>{
      if(hit.shape.type===Cannon.Shape.types.TRIMESH)hits.push(hit.hitPointWorld.y);
    });
    return hits.some(y=>Math.abs(y-.87)<.2);
  }
  for (const [x,z] of [[55,-27],[55,-19.4],[55,0],[45,20],[-45,25],
    [-32,44],[-5,20],[-5,0],[10,-26],[35,-7],[-50,-13],[10,-45]])
    assert.ok(nativeRoadAt(x,z),`visible asphalt at (${x}, ${z}) has native physics triangles`);
  function nativeSurfaceAt(x,z,y,tolerance=.25) {
    const hits=[];
    sim.world.raycastAll(new Cannon.Vec3(x,12,z),new Cannon.Vec3(x,-6,z),{},hit=>{
      if(hit.shape.type===Cannon.Shape.types.TRIMESH)hits.push(hit.hitPointWorld.y);
    });
    return hits.some(top=>Math.abs(top-y)<tolerance);
  }
  for(const [x,z,y] of [[-5,0,.83],[30,-4,.94],[20,-4,1.31],
    [10,-4,5.15],[0,-4,6.91],[-20,-4,6.01],[-30,-4,2.02]])
    assert.ok(nativeSurfaceAt(x,z,y),
      `the underpass or central bridge at (${x}, ${z}) has a collider at ${y} m`);
  const unsupported=[];
  for(let index=0;index<course.route.length;index+=2) {
    const point=course.route[index];
    if(point.kind==='gap')continue;
    if(!nativeSurfaceAt(point.x,point.z,point.y,.45))
      unsupported.push({index,x:point.x,z:point.z,y:point.y});
  }
  assert.deepEqual(unsupported,[],
    'every sampled section of the full lap follows the model at the correct height');
  const gapHits=[];
  sim.world.raycastAll(new Cannon.Vec3(-5,10,20),new Cannon.Vec3(-5,2,20),{},
    hit=>gapHits.push(hit.hitPointWorld.y));
  assert.deepEqual(gapHits,[],
    'the modeled jump remains open above the central underpass');
  for(const [x,z,y] of [[-5,0,.83],[10,-4,5.15],[0,-4,6.91],[-30,-4,2.02]]) {
    sim.reset();
    sim.body.position.set(x,y+1.1,z);
    sim.body.velocity.setZero();
    for(let frame=0;frame<180;frame++)sim.step(1/120);
    assert.ok(sim.body.position.y>y+.45 && sim.car.wheelInfos.filter(w=>w.isInContact).length>=3,
      `the car rests on the model's ${y>1?'bridge':'underpass'} instead of sinking`);
  }
  sim.reset();
  for(let frame=0;frame<320;frame++)sim.step(1/120,{throttle:1});
  assert.ok(sim.body.position.z < -20 && sim.body.position.y > 1.2,
    'the car crosses the native checkerboard stripe in the course direction');
  for(const [x,z,heading] of [[55,0,0],[45,20,-Math.PI/2],
    [-47,30,0],[-5,20,Math.PI],[10,-26,Math.PI/2],
    [-50,-25,Math.PI],[0,-45,Math.PI/2]]) {
    sim.reset(x,z,heading);
    for(let frame=0;frame<180;frame++)sim.step(1/120);
    assert.ok(sim.body.position.y>1.1 && sim.car.wheelInfos.filter(w=>w.isInContact).length>=3,
      `the physical car settles on the native route at (${x}, ${z})`);
  }
  sim.reset(55,-19.4,Math.PI);
  for(let frame=0;frame<180;frame++)sim.step(1/120);
  assert.ok(sim.car.wheelInfos.every(wheel=>wheel.isInContact),
    'the native start and finish stripe sits on solid asphalt');
  for(const car of ['hypercar','rally']) {
    const driver=car==='hypercar'?sim:physics.create({map:'racetrack',courseId:'racegame',course,car});
    if(driver!==sim)assert.equal(driver.addCourseCollisionMeshes(loaded.collisionMeshes),true);
    driver.reset(-45,20,Math.PI/2);
    let jumped=false;
    for(let frame=0;frame<950;frame++) {
      const speed=driver.body.velocity.length();
      driver.step(1/120,{throttle:speed<12.5,brake:speed>13.5});
      const position=driver.body.position;
      if(position.x>-12.5&&position.x<2.5&&position.y>5&&
        driver.car.wheelInfos.every(wheel=>!wheel.isInContact))jumped=true;
    }
    const position=driver.body.position;
    assert.ok(jumped,`${car} actually flies over the native opening`);
    assert.ok(position.x>20&&Math.abs(position.z-20)<2.5&&position.y>1.2&&
      driver.car.wheelInfos.filter(wheel=>wheel.isInContact).length>=3,
    `${car} lands on the east road at about 28 mph and keeps driving`);
  }
});
