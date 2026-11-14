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
    assert.ok(sim.courseSlabs.length > 20,id + ' road has solid slabs');
    for (const slab of sim.courseSlabs) {
      const shape = slab.body.shapes[0];
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
    assert.ok(Math.abs(sim.body.position.y-start.y)<1.5,id + ' does not fall through its grid');
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

test('Rainbow switches from its loading road to the scaled source road collision', () => {
  const course = imported.getCourse('rainbowroad');
  assert.equal(course.scale,2.5);
  assert.equal(course.overlayRoad,false,'the pastel fallback hides after the scaled source arrives');
  assert.equal(course.proxyRoad,false,'source mesh replaces the temporary full-course ribbon');
  const sim = physics.create({map:'racetrack',courseId:'rainbowroad',course,car:'u9xtreme'});
  assert.ok(sim.courseSlabs.length > 20,'the route is driveable while the scene loads');
  const {x,y,z} = course.route[0], back = course.spawn.z;
  const loaded = sim.addCourseCollisionMeshes([{vertices:[
    x-3,y,back-3, x-3,y,z+3, x+3,y,z+3, x+3,y,back-3
  ],indices:[0,1,2,0,2,3]}]);
  assert.equal(loaded,true);
  assert.equal(sim.courseSlabs.length,0,'the temporary full-course ribbon is removed');
  sim.reset();
  for(let frame=0;frame<240;frame++)sim.step(1/120);
  assert.ok(sim.car.wheelInfos.every(wheel=>wheel.isInContact),'wide U9 also stays on the grid');
});
