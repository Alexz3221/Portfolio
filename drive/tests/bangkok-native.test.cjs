const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Cannon = require('cannon');
const physics = require('../js/physics');
const imported = require('../js/imported-courses');

function nativeBangkokScene() {
  const bytes = fs.readFileSync(path.join(__dirname,'../assets/courses/bangkok-rush.glb'));
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20,20+jsonLength));
  const binaryStart = 20+jsonLength+8;
  const scene = {objects:[],scale:{value:1,setScalar(value){this.value=value;}},
    updateMatrixWorld(){},traverse(callback){this.objects.forEach(callback);}};
  function accessor(index) {
    const spec=gltf.accessors[index],view=gltf.bufferViews[spec.bufferView];
    const columns=spec.type==='VEC3'?3:1;
    const size=spec.componentType===5126||spec.componentType===5125?4:2;
    const stride=view.byteStride||columns*size;
    const offset=binaryStart+(view.byteOffset||0)+(spec.byteOffset||0);
    const result=new (spec.componentType===5126?Float32Array:spec.componentType===5125?Uint32Array:Uint16Array)(spec.count*columns);
    for(let row=0;row<spec.count;row++)for(let column=0;column<columns;column++){
      const pos=offset+row*stride+column*size;
      result[row*columns+column]=spec.componentType===5126?bytes.readFloatLE(pos):
        spec.componentType===5125?bytes.readUInt32LE(pos):bytes.readUInt16LE(pos);
    }
    return result;
  }
  const selected=/^Object_(?:33|37|45|61|62|63|64)$/;
  for(const node of gltf.nodes.filter(node=>selected.test(node.name||''))) {
    const primitive=gltf.meshes[node.mesh].primitives[0];
    const positions=accessor(primitive.attributes.POSITION),indices=accessor(primitive.indices);
    scene.objects.push({isMesh:true,visible:true,name:node.name,
      geometry:{attributes:{position:{array:positions,count:positions.length/3}},index:{array:indices}},
      material:{uuid:`bangkok-${primitive.material}`},
      get matrixWorld(){const scale=scene.scale.value;return {elements:[scale,0,0,0,0,scale,0,0,0,0,scale,0,0,0,0,1],scale};}});
  }
  // The file contains two copies of its geometry. Hidden duplicates must not
  // create duplicate physical triangles when the scene is deduplicated.
  const original=scene.objects.find(object=>object.name==='Object_61');
  scene.objects.push(Object.create(original));
  return scene;
}

test('Bangkok native asphalt loads as collision and covers the extended course', async () => {
  const course=imported.getCourse('bangkok');
  assert.equal(course.scale,.026);
  assert.equal(course.loop,false);
  assert.ok(course.route.length>100);
  assert.ok(Math.abs(course.route[0].x+2.6)<.01 && course.route[0].tz===0,
    'the source arch/checker is the start gate');
  assert.ok(course.spawn.x<course.route[0].x-15,'spawn is behind the native checker');
  const routeLength=course.route.slice(1).reduce((length,point,index)=>{
    const previous=course.route[index];
    return length+Math.hypot(point.x-previous.x,point.y-previous.y,point.z-previous.z);
  },0);
  assert.ok(routeLength>280 && routeLength<300,'timed run uses the southeast gray streets');
  assert.ok(course.finishRunout>=35,'the finish leaves room to stop on native asphalt');

  const scene=nativeBangkokScene();
  class Vector3 {
    fromBufferAttribute(attribute,index){const array=attribute.array;this.x=array[index*3];this.y=array[index*3+1];this.z=array[index*3+2];return this;}
    applyMatrix4(matrix){this.x*=matrix.scale;this.y*=matrix.scale;this.z*=matrix.scale;return this;}
  }
  globalThis.THREE={Vector3,GLTFLoader:class {load(_asset,done){done({scene});}}};
  try {
    const loaded=await imported.load('bangkok');
    const triangles=loaded.collisionMeshes.reduce((sum,mesh)=>sum+mesh.indices.length/3,0);
    assert.equal(loaded.collisionMeshes.length,7,'the duplicated source street is not doubled');
    assert.equal(triangles,17562);
    assert.ok(triangles<=course.maxCollisionTriangles);
    const sim=physics.create({map:'racetrack',courseId:'bangkok',course,car:'comet'});
    assert.equal(sim.addCourseCollisionMeshes(loaded.collisionMeshes),true,
      'the actual source geometry fits CANNON instead of falling back to a proxy');
    for(const point of course.route.filter((_,index)=>index%10===0)) {
      assert.ok(Math.abs(sim.roadHeight(point.x,point.z)-point.y)<.35,
        `native road height matches course at (${point.x.toFixed(1)},${point.z.toFixed(1)})`);
    }
    sim.reset(course.spawn.x,course.spawn.z,course.spawn.heading);
    for(let frame=0;frame<240;frame++)sim.step(1/120);
    assert.ok(sim.car.wheelInfos.every(wheel=>wheel.isInContact),
      'the car settles on the native approach road behind the arch');
    const finish=course.route.at(-1);
    assert.ok(Math.abs(sim.roadHeight(finish.x,finish.z)-finish.y)<.35,
      'the generated finish lies on the native southeast asphalt');
    const runoutDistance=course.finishRunout-3;
    const runoutX=finish.x+finish.tx*runoutDistance;
    const runoutZ=finish.z+finish.tz*runoutDistance;
    const hit=new Cannon.RaycastResult();
    assert.equal(sim.world.raycastClosest(
      new Cannon.Vec3(runoutX,finish.y+3,runoutZ),
      new Cannon.Vec3(runoutX,finish.y-3,runoutZ),{},hit),true,
    'the loading proxy and native road support the finish runout');
    // The source road rises gently by about 1.2 m through this runout.
    assert.ok(hit.hitPointWorld.y>=finish.y-.25 && hit.hitPointWorld.y<=finish.y+1.5,
      `runout height ${hit.hitPointWorld.y.toFixed(2)} vs finish ${finish.y.toFixed(2)}`);
    sim.dispose();
  } finally { delete globalThis.THREE; }
});
