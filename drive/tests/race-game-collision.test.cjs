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

test('Race Game native asphalt supports driving from the grid and a finish runout', async () => {
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
  assert.ok(triangles>80000&&triangles<120000,
    `native collision keeps the course surfaces while dropping distant detail (${triangles})`);
  assert.equal(sim.addCourseCollisionMeshes(loaded.collisionMeshes),true);
  function nativeRoadAt(x,z) {
    const hits=[];
    sim.world.raycastAll(new Cannon.Vec3(x,4,z),new Cannon.Vec3(x,-1,z),{},hit=>{
      if(hit.shape.type===Cannon.Shape.types.TRIMESH)hits.push(hit.hitPointWorld.y);
    });
    return hits.some(y=>Math.abs(y-.87)<.2);
  }
  for (const [x,z] of [[56,-3],[56,-13],[56,-35],[53,-38],[-50,-13],[-50,-5]])
    assert.ok(nativeRoadAt(x,z),`visible asphalt at (${x}, ${z}) has native physics triangles`);
  sim.reset();
  for(let frame=0;frame<320;frame++)sim.step(1/120,{throttle:1});
  assert.ok(sim.body.position.z < -30 && sim.body.position.y > 1.2,
    'the car drives from the grid through the first straight without sinking');
  for(const [x,z,heading] of [[53,-38,-2.29],[45,-45,-Math.PI/2],[0,-45,-Math.PI/2],[-50,-37,0]]) {
    sim.reset(x,z,heading);
    for(let frame=0;frame<180;frame++)sim.step(1/120);
    assert.ok(sim.body.position.y>1.1 && sim.car.wheelInfos.filter(w=>w.isInContact).length>=3,
      `the physical car settles on the visible outer road at (${x}, ${z})`);
  }
  sim.reset(-50,-13,0);
  for(let frame=0;frame<180;frame++)sim.step(1/120);
  assert.ok(sim.car.wheelInfos.every(wheel=>wheel.isInContact),
    'the finish gate sits on solid asphalt with runout beyond it');
  // Follow the authored bend at a speed the actual road geometry can hold.
  // A straight 43 mph launch leaves this sharp curve and strikes its curb.
  sim.reset();
  for(let frame=0;frame<750;frame++) {
    const pos=sim.body.position;
    let nearest=0,least=Infinity;
    course.route.forEach((point,index)=>{
      const distance=Math.hypot(pos.x-point.x,pos.z-point.z);
      if(distance<least){least=distance;nearest=index;}
    });
    const target=course.route[Math.min(course.route.length-1,nearest+4)];
    const forward=sim.body.quaternion.vmult(new Cannon.Vec3(0,0,1));
    const heading=Math.atan2(forward.x,forward.z);
    const targetHeading=Math.atan2(target.x-pos.x,target.z-pos.z);
    const error=Math.atan2(Math.sin(targetHeading-heading),Math.cos(targetHeading-heading));
    const speed=sim.body.velocity.length();
    sim.step(1/120,{throttle:speed<9?1:0,brake:speed>10,
      steer:Math.max(-1,Math.min(1,error*2.4))});
  }
  assert.ok(sim.body.position.x<40 && sim.body.position.z<-40 && sim.body.position.y>1.2,
    'a controlled turn drives across the first outer bend on the physical road');
  assert.ok(sim.car.wheelInfos.filter(wheel=>wheel.isInContact).length>=3,
    'the car stays grounded after the first bend');
});
