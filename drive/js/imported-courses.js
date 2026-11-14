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

  // The source is a miniature display model. 2.5 world units per source unit
  // make its narrow SFC ribbon wide enough for the garage cars. Keep controls
  // in source coordinates so the path remains easy to compare with the mesh.
  const rainbowScale = 2.5;
  const rainbowControls = [
    [75,27.583,-10.36],[75,27.583,-6],[75,27.583,0],[75,27.583,2.7],
    [72,27.583,3],[68,27.583,3],[63,27.583,3],[58,27.583,3],
    [54,27.583,2.7],[53.5,27.583,-2],[53.5,27.583,-6],[53.5,27.583,-7.9],
    [57,27.583,-8.4],[61,27.583,-8.4],[65,27.583,-8.4],
    [66.5,27.583,-9],[67,27.583,-11],[67,27.583,-14],[66,27.583,-15.5]
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
      asset:'assets/courses/rainbow-road.glb', scale:rainbowScale,
      loop:false, width:4.6,
      route:routeFrom(rainbowControls.map(point => point.map(value => value * rainbowScale)), false, 4.6, 2.2),
      // The grid is on the visible ribbon, with room for the rear wheels.
      spawn:{x:75*rainbowScale,y:27.583*rainbowScale,z:-12*rainbowScale,heading:0},
      spawnBack:(12-10.36)*rainbowScale, spawnPadBack:2,
      // Use the source mesh for both road visuals and road collision. A tiny
      // underside patch supports the model's missing start-stripe triangles.
      proxyRoad:false, overlayRoad:false,
      edge:650, floor:-50, roadSearchWidth:12,
      // The 97-triangle horizontal SFC section is used for road contact.
      collisionPattern:/mesh_mdl_SFCroad1_mdl_SFCroad1_0/i,
      ground:0x0d1230, skyLow:0x18265d, skyHigh:0x020415, fog:0x101536,
      ghostSpeed:23
    },
    racegame: {
      id:'racegame', name:'Race Game Outer Run',
      caption:'Race Game Outer Run · painted asphalt · point-to-point',
      asset:'assets/courses/race-game-environment.glb', loop:false, width:8,
      route:routeFrom(raceGameControls, false, 8, 3),
      spawn:{x:56,y:.87,z:-3,heading:Math.PI}, spawnBack:8, spawnPadBack:4,
      finishOffset:-8,
      // The visual model is partitioned into 15 arbitrary mesh chunks. Keep
      // its reachable road, curb and obstacle triangles as collision; the
      // distant decoration and Object_20 background plane stay visual only.
      collisionPattern:/^Object_(?:[4-9]|1[0-8])$/,
      collisionFilter:'reachable', maxCollisionTriangles:120000,
      proxyRoad:true, proxyOffset:-.15,
      edge:240, floor:0, roadSearchWidth:20,
      ground:0x54883b, skyLow:0x9ec5dd, skyHigh:0x6b9fc4, fog:0x99b9ce,
      ghostSpeed:23
    },
    bangkok: {
      id:'bangkok', name:'Bangkok Street Sprint',
      caption:'Bangkok Street Sprint · follow the city road to the finish',
      asset:'assets/courses/bangkok-rush.glb', scale:.01, loop:false, width:7,
      // Object_33 is the source map's long paved road, roughly 8–13 m wide
      // after scaling. The centerline stays within its road mesh, including
      // the tight bend by the city buildings. Keep a loading proxy beneath
      // the source triangles in case a wheel crosses a tiny mesh seam.
      route:routeFrom([
        [-15.5,3.63,-62],[-20,3.63,-55],[-24,3.63,-45],
        [-25,3.63,-35],[-25.5,3.63,-25],[-25.5,3.63,-15],
        [-25,3.63,-5],[-22.5,3.63,0],[-19.5,3.63,5],
        [-15.5,3.63,10],[-11,3.63,15],[-3,3.63,20],
        [9,3.63,24],[24,3.63,29],[33,3.63,35],
        [36.2,3.63,42]
      ], false, 7, 2.5),
      spawn:{x:-9.5,y:3.63,z:-69,heading:-.75}, spawnBack:8,
      collisionPattern:/^Object_33(?:$|_)/i,
      proxyRoad:true, proxyOffset:-.08, overlayRoad:false,
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
  function extractCollision(scene, course) {
    const pattern = course.collisionPattern;
    if (!pattern) return [];
    scene.updateMatrixWorld(true);
    const meshes = [];
    const distanceToRoute = (x,z) => {
      let nearest = Infinity;
      for(let index=0;index<course.route.length-1;index++) {
        const a=course.route[index],b=course.route[index+1];
        const dx=b.x-a.x,dz=b.z-a.z;
        const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
        nearest=Math.min(nearest,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));
      }
      return nearest;
    };
    scene.traverse(object => {
      if (!object.isMesh || !pattern.test(object.name)) return;
      const positions = object.geometry.attributes.position;
      const vertices = [], point = new THREE.Vector3();
      for (let index = 0; index < positions.count; index++) {
        point.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
        vertices.push(point.x, point.y, point.z);
      }
      let indices = object.geometry.index ? Array.from(object.geometry.index.array)
        : Array.from({length:positions.count}, (_, index) => index);
      if(course.collisionFilter==='reachable') {
        const filtered=[];
        for(let index=0;index<indices.length;index+=3) {
          const ia=indices[index]*3,ib=indices[index+1]*3,ic=indices[index+2]*3;
          const ax=vertices[ia],ay=vertices[ia+1],az=vertices[ia+2];
          const bx=vertices[ib],by=vertices[ib+1],bz=vertices[ib+2];
          const cx=vertices[ic],cy=vertices[ic+1],cz=vertices[ic+2];
          const y=(ay+by+cy)/3;
          const abx=bx-ax,aby=by-ay,abz=bz-az;
          const acx=cx-ax,acy=cy-ay,acz=cz-az;
          const nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;
          const up=ny/(Math.hypot(nx,ny,nz)||1);
          // Some painted road strips in this GLB are wound downward even
          // though their visible material is double-sided. Flip those faces
          // upward for CANNON's one-sided vehicle tire contact.
          const flippedRoad=up<-.8&&y>.6&&y<1.1;
          const surface=y>.25&&y<6&&(up>.3||flippedRoad);
          const solidSide=y>-.5&&y<4&&Math.abs(up)<=.5;
          if(!surface&&!solidSide)continue;
          const distance=distanceToRoute((ax+bx+cx)/3,(az+bz+cz)/3);
          if(distance<(surface?15:7))filtered.push(indices[index],
            surface&&flippedRoad?indices[index+2]:indices[index+1],
            surface&&flippedRoad?indices[index+1]:indices[index+2]);
        }
        indices=filtered;
      }
      if(indices.length)meshes.push({vertices, indices});
    });
    return meshes;
  }
  function rainbowStripePatch(course) {
    const start = course.route[0], half = course.width / 2;
    const y = start.y - .12, zMin = start.z - 1.1, zMax = start.z + .9;
    return {vertices:[
      start.x-half,y,zMin, start.x-half,y,zMax,
      start.x+half,y,zMax, start.x+half,y,zMin
    ],indices:[0,1,2,0,2,3]};
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
        const collisionMeshes = extractCollision(scene, course);
        if (id === 'rainbowroad') collisionMeshes.push(rainbowStripePatch(course));
        resolve({scene, collisionMeshes});
      }, undefined, reject);
    }).catch(error => { sceneCache.delete(id); throw error; });
    sceneCache.set(id, loading);
    return loading;
  }
  return {getCourse:id => courses[id] || null, load, routeFrom, makeGhostTrace};
});
