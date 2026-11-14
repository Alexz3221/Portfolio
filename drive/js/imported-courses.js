/* Optional downloaded course scenes and their playable time-trial centerlines. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DriveImportedCourses = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function routeFrom(controls, loop, width, step = 3) {
    const route = [];
    const segments = controls.length - (loop ? 0 : 1);
    for (let index = 0; index < segments; index++) {
      const a = controls[index], b = controls[(index + 1) % controls.length];
      const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / step));
      for (let part = 0; part < count; part++) {
        const t = part / count;
        route.push({x: a[0] + (b[0] - a[0]) * t,
          y: a[1] + (b[1] - a[1]) * t,
          z: a[2] + (b[2] - a[2]) * t, width});
      }
    }
    if (!loop) {
      const last = controls.at(-1);
      route.push({x:last[0], y:last[1], z:last[2], width});
    }
    for (let index = 0; index < route.length; index++) {
      const a = route[loop ? (index + route.length - 1) % route.length : Math.max(0, index - 1)];
      const b = route[loop ? (index + 1) % route.length : Math.min(route.length - 1, index + 1)];
      const distance = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      route[index].tx = (b.x - a.x) / distance;
      route[index].tz = (b.z - a.z) / distance;
    }
    return route;
  }

  const rainbowControls = [
    [75,27.583,-10.36],[75,27.583,-7],[75,27.583,-3],[75,27.583,2],
    [72,27.583,3],[68,27.583,3],[63,27.583,3],[58,27.583,3],
    [54,27.583,2],[53.5,27.583,-2],[53.5,27.583,-6],
    [57,27.583,-8],[61,27.583,-8],[66,27.583,-8],
    [67,27.583,-11],[67,27.583,-14],[65.5,27.583,-15.5]
  ];
  // The clean outer arc follows painted asphalt and ends before the model's
  // rock-filled central shortcuts. Road elevations are near y=0.87 m.
  const raceGameControls = [
    [56,.87,-13],[56,.87,-30],[53,.87,-38],[45,.87,-45],
    [25,.87,-45],[0,.87,-45],[-25,.87,-45],[-45,.87,-45],
    [-50,.87,-37],[-50,.87,-30],[-50,.87,-15],[-50,.87,-5]
  ];

  const courses = {
    rainbowroad: {
      id:'rainbowroad', name:'Rainbow Sprint',
      caption:'Rainbow Sprint · short, flat road section · stay out of space',
      asset:'assets/courses/rainbow-road.glb', loop:false, width:4.2,
      route:routeFrom(rainbowControls, false, 4.2, 2.2),
      // Extend a small start pad behind the source stripe so all four wheels
      // are supported before the timed crossing.
      spawn:{x:75,y:27.583,z:-15,heading:0}, spawnBack:1.64,
      proxyRoad:true, overlayRoad:true,
      edge:390, floor:-25, roadSearchWidth:10,
      // The 97-triangle horizontal SFC section is used for exact road contact.
      collisionPattern:/mesh_mdl_SFCroad1_mdl_SFCroad1_0/i,
      ground:0x0d1230, skyLow:0x18265d, skyHigh:0x020415, fog:0x101536,
      ghostSpeed:23
    },
    racegame: {
      id:'racegame', name:'Race Game Outer Run',
      caption:'Race Game Outer Run · painted asphalt · point-to-point',
      asset:'assets/courses/race-game-environment.glb', loop:false, width:8,
      route:routeFrom(raceGameControls, false, 8, 3),
      spawn:{x:56,y:.87,z:-3,heading:Math.PI}, spawnBack:8,
      edge:240, floor:-20, roadSearchWidth:20,
      ground:0x54883b, skyLow:0x9ec5dd, skyHigh:0x6b9fc4, fog:0x99b9ce,
      ghostSpeed:23
    },
    bangkok: {
      id:'bangkok', name:'Bangkok Skyway',
      caption:'Bangkok Skyway · elevated stunt loop above the market',
      asset:'assets/courses/bangkok-rush.glb', scale:.01, loop:true, width:8,
      // The downloaded city has no clean, collision-ready circuit. Keep the
      // existing scene intact and place an authored elevated stunt route over it.
      route:routeFrom([
        [80,35,25],[80,35,-55],[65,35,-85],[40,35,-100],
        [-35,35,-100],[-60,35,-80],[-65,35,-50],[-65,35,40],
        [-45,35,65],[-15,35,70],[50,35,70],[75,35,50]
      ], true, 8, 3),
      overlayRoad:true,
      edge:210, floor:-20, roadSearchWidth:18,
      ground:0x355d42, skyLow:0xcad6c7, skyHigh:0x85a6a2, fog:0x9ab3a6,
      ghostSpeed:25
    }
  };

  function makeGhostTrace(course, car) {
    const route = course.route, positions = course.loop ? [...route, route[0]] : route;
    const lengths = [0];
    for (let index = 1; index < positions.length; index++) lengths.push(lengths.at(-1) +
      Math.hypot(positions[index].x - positions[index - 1].x,
        positions[index].y - positions[index - 1].y,
        positions[index].z - positions[index - 1].z));
    // Imported ghosts use car-specific tuned paces along the same safe path.
    const carPace = {comet:1,rally:.95,pickup:.9,hypercar:1.12,u9xtreme:1.25};
    const distance = lengths.at(-1), speed = course.ghostSpeed * (carPace[car] || 1), dt = 1 / 30;
    const lapTime = distance / speed, frameCount = Math.ceil(lapTime / dt) + 1;
    const frames = [];
    let segment = 0;
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const travelled = Math.min(distance, frameIndex * dt * speed);
      while (segment < lengths.length - 2 && lengths[segment + 1] < travelled) segment++;
      const a = positions[segment], b = positions[segment + 1];
      const fraction = Math.max(0, Math.min(1, (travelled - lengths[segment]) /
        (lengths[segment + 1] - lengths[segment] || 1)));
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      const progress = segment + fraction;
      frames.push([
        a.x + (b.x - a.x) * fraction, a.y + (b.y - a.y) * fraction + 1.0,
        a.z + (b.z - a.z) * fraction,
        0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2),
        Math.min(route.length, progress)
      ]);
    }
    frames.at(-1)[7] = route.length;
    return {car, dt, lapTime, duration:(frames.length - 1) * dt,
      routeLength:route.length, frames};
  }
  for (const course of Object.values(courses)) {
    course.ghostTraces = Object.fromEntries(['comet','rally','pickup','hypercar','u9xtreme']
      .map(car => [car, makeGhostTrace(course, car)]));
  }

  const sceneCache = new Map();
  function deduplicateBangkok(scene) {
    scene.updateMatrixWorld(true);
    const buckets = new Map();
    const sameArray = (a,b) => a === b || a.length === b.length && a.every((value,index) => value === b[index]);
    scene.traverse(object => {
      if (!object.isMesh) return;
      const positions = object.geometry.attributes.position?.array;
      const indices = object.geometry.index?.array;
      if (!positions || !indices) return;
      const sample = array => [array[0],array[Math.floor(array.length/3)],
        array[Math.floor(array.length*2/3)],array[array.length-1]].join(',');
      const key = [positions.length,indices.length,sample(positions),sample(indices),
        object.material?.uuid,object.matrixWorld.elements.map(n => n.toFixed(5)).join(',')].join(':');
      const bucket = buckets.get(key) || [];
      const duplicate = bucket.some(other => sameArray(positions,other.geometry.attributes.position.array) &&
        sameArray(indices,other.geometry.index.array));
      if (duplicate) object.visible = false;
      else { bucket.push(object); buckets.set(key,bucket); }
    });
  }
  function extractCollision(scene, pattern) {
    if (!pattern) return [];
    scene.updateMatrixWorld(true);
    const meshes = [];
    scene.traverse(object => {
      if (!object.isMesh || !pattern.test(object.name)) return;
      const positions = object.geometry.attributes.position;
      const vertices = [], point = new THREE.Vector3();
      for (let index = 0; index < positions.count; index++) {
        point.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
        vertices.push(point.x, point.y, point.z);
      }
      const indices = object.geometry.index ? Array.from(object.geometry.index.array)
        : Array.from({length:positions.count}, (_, index) => index);
      meshes.push({vertices, indices});
    });
    return meshes;
  }
  function load(id) {
    const course = courses[id];
    if (!course) return Promise.reject(new Error('Unknown course: ' + id));
    if (sceneCache.has(id)) return sceneCache.get(id);
    const loading = new Promise((resolve, reject) => {
      if (!globalThis.THREE?.GLTFLoader) { reject(new Error('GLTFLoader is unavailable')); return; }
      new THREE.GLTFLoader().load(course.asset, gltf => {
        const scene = gltf.scene;
        scene.name = id + '-course-asset';
        scene.scale.setScalar(course.scale || 1);
        scene.traverse(object => {
          if (!object.isMesh) return;
          object.castShadow = false;
          object.receiveShadow = true;
        });
        if (id === 'bangkok') deduplicateBangkok(scene);
        resolve({scene, collisionMeshes:extractCollision(scene, course.collisionPattern)});
      }, undefined, reject);
    }).catch(error => { sceneCache.delete(id); throw error; });
    sceneCache.set(id, loading);
    return loading;
  }
  return {getCourse:id => courses[id] || null, load, routeFrom, makeGhostTrace};
});
