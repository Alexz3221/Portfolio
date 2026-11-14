const test = require('node:test');
const assert = require('node:assert/strict');
const Cannon = require('cannon');
const physics = require('../js/physics');
const imported = require('../js/imported-courses');

function ray(world,x,z,top,bottom) {
  const hit = new Cannon.RaycastResult();
  assert.ok(world.raycastClosest(new Cannon.Vec3(x,top,z),new Cannon.Vec3(x,bottom,z),{},hit));
  return hit.hitPointWorld.y;
}

test('each imported course has a physical road, a stable grid, and a fast course ghost', () => {
  for (const id of ['rainbowroad','racegame','bangkok']) {
    const course = imported.getCourse(id);
    assert.ok(course.route.length > 20,id + ' route is ordered at driving scale');
    const start = course.route[0];
    const back = course.spawnBack ?? 8;
    const x = start.x - start.tx * back, z = start.z - start.tz * back;
    const sim = physics.create({map:'racetrack',courseId:id,course,car:'comet'});
    assert.equal(sim.courseRoute,course.route);
    assert.ok(sim.courseSlabs.length >= (course.proxyMesh ? 2 : 20),
      id + ' road has solid fallback surfaces');
    for (const slab of sim.courseSlabs) {
      const shape = slab.body.shapes[0];
      if (course.proxyMesh) {
        assert.equal(shape.type,Cannon.Shape.types.TRIMESH,
          id + ' uses continuous one-sided road support');
        continue;
      }
      for (let face = 0; face < shape.faces.length; face++) {
        const origin = shape.vertices[shape.faces[face][0]];
        assert.ok(shape.faceNormals[face].dot(origin) > 0,id + ' slab has outward collision normals');
      }
    }
    assert.ok(Math.abs(ray(sim.world,start.x,start.z,start.y+2,start.y-2)-start.y)<.15,
      id + ' start line is on its physical road');
    sim.reset(x,z,Math.atan2(start.tx,start.tz));
    for (let frame = 0; frame < 240; frame++) sim.step(1/120);
    assert.ok(sim.car.wheelInfos.every(wheel=>wheel.isInContact),id + ' spawns on four wheels');
    assert.ok(Math.abs(sim.body.position.y-(course.spawn?.y??start.y))<1.5,
      id + ' does not fall through its grid: '+sim.body.position.y.toFixed(2)+
        ' vs '+(course.spawn?.y??start.y).toFixed(2));
    const ghost = course.ghostTraces.comet;
    assert.ok(course.ghostTraces.pickup.lapTime > ghost.lapTime &&
      ghost.lapTime > course.ghostTraces.hypercar.lapTime,
      id + ' opponent car changes the path ghost pace');
    assert.equal(ghost.routeLength,course.route.length);
    assert.equal(ghost.frames.at(-1)[7],course.route.length);
    assert.ok(ghost.frames.every(frame=>frame.length===8&&frame.every(Number.isFinite)));
    let distance=0;
    for(let index=1;index<course.route.length;index++)distance+=Math.hypot(
      course.route[index].x-course.route[index-1].x,course.route[index].z-course.route[index-1].z);
    assert.ok(distance/ghost.lapTime*2.236936>40,id + ' standard ghost exceeds 40 mph average');
  }
});

test('Rainbow follows the entire native road chain and keeps seam support', () => {
  const course = imported.getCourse('rainbowroad');
  assert.equal(course.scale,2.5);
  assert.equal(course.loop,true,'the full modeled road returns to its checkerboard');
  assert.ok(course.route.length>400,'the path covers the full source model');
  assert.ok(Math.hypot(course.route[0].x-187.9,course.route[0].z+25.9)<1,
    'the lap starts at the source checkerboard');
  assert.ok(course.route[0].tz<-.9,'the car starts southbound into the MK8 section');
  let previous=0;
  for(const [name,match] of [
    ['MK8 loop',point=>point.x>215&&point.z<-40],
    ['MK7 climb',point=>point.x>240&&point.y>105],
    ['DS3DS span',point=>point.x>100&&point.x<150&&point.z<-100],
    ['Wii climb',point=>point.x<-40&&point.y>110&&point.z>-80],
    ['DS spiral',point=>point.x<-100&&point.y<40&&point.z>20],
    ['GCN bends',point=>point.x<-25&&point.z>40&&point.y<40],
    ['GBA hairpin',point=>point.x>75&&point.z>60],
    ['N64 loop',point=>point.x<70&&point.z<-65],
    ['SFC return',point=>point.x>160&&point.z>0]
  ]) {
    const index=course.route.findIndex((point,position)=>position>previous&&match(point));
    assert.ok(index>previous,`${name} comes after the preceding section`);
    previous=index;
  }
  assert.equal(course.transfers.length,2,'the two large source gaps have guided flights');
  for(const transfer of course.transfers) {
    const from=course.route.findIndex(point=>Math.hypot(point.x-transfer.from.x,
      point.y-transfer.from.y,point.z-transfer.from.z)<.01);
    const to=course.route.findIndex((point,index)=>index>from&&Math.hypot(point.x-transfer.to.x,
      point.y-transfer.to.y,point.z-transfer.to.z)<.01);
    assert.ok(from>=0&&to>from,'each transfer follows the ordered route');
  }
  assert.equal(course.overlayRoad,false,'the pastel fallback hides after the scaled source arrives');
  assert.equal(course.proxyRoad,true,'small native mesh seams retain narrow support');
  const sim = physics.create({map:'racetrack',courseId:'rainbowroad',course,car:'u9xtreme'});
  assert.ok(sim.courseSlabs.length>=3,'the full road has continuous grouped support');
  const before=sim.courseSlabs.length;
  const {x,y,z} = course.route[0];
  const mk7Seam=course.route.find(point=>point.x>208&&point.x<209&&point.z<-60);
  assert.ok(mk7Seam,'the authored route includes the MK7 transition');
  assert.ok(Math.abs(ray(sim.world,mk7Seam.x,mk7Seam.z,
    mk7Seam.y+3,mk7Seam.y-3)-mk7Seam.y)<.3,
    'continuous support keeps the MK7 seam at road height');
  const loaded = sim.addCourseCollisionMeshes([{vertices:[
    x-4,y,z-8, x-4,y,z+8, x+4,y,z+8, x+4,y,z-8
  ],indices:[0,1,2,0,2,3]}]);
  assert.equal(loaded,true);
  assert.equal(sim.courseSlabs.length,before,'only the narrow seam support remains');
  sim.reset();
  for(let frame=0;frame<240;frame++)sim.step(1/120);
  assert.ok(sim.car.wheelInfos.every(wheel=>wheel.isInContact),'wide U9 also stays on the grid');
});

test('Race Game follows the entire native lap through both levels of the central crossing', () => {
  const course = imported.getCourse('racegame');
  const route = course.route;
  assert.equal(course.loop,true);
  assert.ok(course.routeHeightWeight>=1,'route progress distinguishes bridge from underpass');
  assert.ok(Math.abs(route[0].x-55)<.1 && Math.abs(route[0].z+19.4)<.1,
    'the timing line is centered on the built-in checkerboard stripe');
  assert.ok(course.spawn.z<route[0].z-5 && route[0].tz>.99,
    'the car starts behind the stripe, facing the course direction');
  assert.ok(route.some(point=>point.kind==='gap'&&point.x<0&&point.z===20&&point.y>6),
    'the native jump is represented as open air above the underpass');
  const proxy=physics.create({map:'racetrack',courseId:'racegame',course,car:'comet'});
  const gapHit=new Cannon.RaycastResult();
  assert.equal(proxy.world.raycastClosest(new Cannon.Vec3(-5,10,20),
    new Cannon.Vec3(-5,2,20),{},gapHit),false,
    'the loading proxy leaves the stunt jump open');
  let after=0;
  for(const [name,onRoad] of [
    ['jump lip',point=>Math.abs(point.x-2.5)<.1&&point.z===20&&point.y>5],
    ['west landing ramp',point=>Math.abs(point.x+12.5)<.1&&point.z===20&&point.y>4],
    ['lower straight',point=>point.x<-30&&Math.abs(point.z-20)<.1&&point.y<2],
    ['bottom U-turn',point=>point.x<-20&&point.z>40&&point.y<2],
    ['underpass',point=>Math.abs(point.x+5)<.1&&Math.abs(point.z)<.1&&point.y<1],
    ['inner U-turn',point=>point.x>10&&point.z<-24&&point.y<2],
    ['bridge crest',point=>Math.abs(point.x)<.1&&Math.abs(point.z+4)<.1&&point.y>6],
    ['left outer bend',point=>point.x<-49&&point.z<-20&&point.y<2],
    ['top straight',point=>point.x>10&&point.z<-44&&point.y<2]
  ]) {
    const index=route.findIndex((point,position)=>position>after&&onRoad(point));
    assert.ok(index>after,`the ${name} follows the previous modeled section`);
    after=index;
  }
  const last=route.at(-1), first=route[0];
  assert.ok(Math.hypot(last.x-first.x,last.z-first.z)<3,
    'the outer straight closes at the native stripe');
  const ghostEnd=course.ghostTraces.comet.frames.at(-1);
  assert.ok(Math.hypot(ghostEnd[0]-first.x,ghostEnd[2]-first.z)<.01,
    'the opponent completes the full modeled loop');
});
