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

test('Bangkok native asphalt supports a full loop from the built-in checker', async () => {
  const course=imported.getCourse('bangkok');
  assert.equal(course.scale,.052);
  assert.equal(course.loop,true);
  assert.ok(course.route.length>140);
  assert.ok(Math.abs(course.route[0].x+5.2)<.01 &&
    course.route[0].tx>.99 && Math.abs(course.route[0].z)<.01,
    'the model arch/checker is the eastbound lap gate');
  assert.ok(course.spawn.x<course.route[0].x-8,
    'spawn is behind the native checker on its west approach');
  assert.ok(course.route.at(-1).x<course.route[0].x &&
    course.route.at(-1).tx>.99,
    'the loop returns on the west approach in the same direction');
  const routeLength=course.route.slice(1).reduce((length,point,index)=>{
    const previous=course.route[index];
    return length+Math.hypot(point.x-previous.x,point.y-previous.y,point.z-previous.z);
  },0);
  assert.ok(routeLength>400 && routeLength<410,
    'the lap follows the full connected city-block loop');
  assert.ok(course.width>=13,
    'the native asphalt is enlarged enough for the supplied cars');

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
    const initialBodies=new Set(sim.world.bodies);
    assert.equal(sim.addCourseCollisionMeshes(loaded.collisionMeshes),true,
      'the actual source geometry fits CANNON instead of falling back to a proxy');
    const nativeBodies=sim.world.bodies.filter(body=>!initialBodies.has(body));
    assert.equal(scene.objects[3].name,'Object_61',
      'the fourth unique source mesh is the gray asphalt');
    const nativeRoad=nativeBodies[3];
    for(const point of course.route) {
      const heights=[];
      sim.world.raycastAll(new Cannon.Vec3(point.x,point.y+5,point.z),
        new Cannon.Vec3(point.x,point.y-5,point.z),{},hit=>{
          if(hit.body===nativeRoad)heights.push(hit.hitPointWorld.y);
        });
      assert.ok(heights.some(y=>Math.abs(y-point.y)<.4),
        `native gray road covers (${point.x.toFixed(1)},${point.z.toFixed(1)})`);
    }
    sim.reset(course.spawn.x,course.spawn.z,course.spawn.heading);
    for(let frame=0;frame<240;frame++)sim.step(1/120);
    assert.ok(sim.car.wheelInfos.every(wheel=>wheel.isInContact),
      'the car settles on the native west approach behind the arch');
    assert.ok(sim.body.velocity.length()<.5,
      'the parked car stays nearly still before the timed lap');
    sim.dispose();
  } finally { delete globalThis.THREE; }
});
