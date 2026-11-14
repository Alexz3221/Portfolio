(() => {
  'use strict';
  const message = document.querySelector('#loadMessage');
  if (!window.THREE || typeof DrivePhysics === 'undefined' || !DrivePhysics.city) { message.textContent = 'Could not load the driving engine. Try reloading.'; return; }

  const canvas = document.querySelector('#drive-scene');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(66, 1, 0.3, 950);
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  const clock = new THREE.Clock();
  const keys = new Set();
  const keyboardKeys = new Set(), touchPointers = new Map();
  let driveFocused = true;
  const vehicle = new THREE.Group();
  const vehicleFrame = new THREE.Group();
  vehicleFrame.add(vehicle);
  const motion = {speed: 0, heading: 0};
  // Geometry and simulation share dimensions derived from the selected source cars.
  const carSpecs = Object.fromEntries(Object.entries({
    comet: {name:'Comet',color:0x4e83df},
    rally: {name:'Rally',color:0xe3d57b},
    hypercar: {name:'Hypercar',color:0xe14839},
    pickup: {name:'Pickup',color:0x25975b},
    u9xtreme: {name:'Yangwang U9 Xtreme',color:0x252a31}
  }).map(([type,style]) => [type,{...DrivePhysics.vehicles[type],...style,wheelRadius:DrivePhysics.vehicles[type].radius}]));
  let city = DrivePhysics.city;
  const maps = {
    city: {name: 'City', caption: 'Alex after dark · six stops, one city to explore', ground: 0x202a38, fog: 0x0c1728, skyLow: 0x263447, skyHigh: 0x050b18, seed: 41732},
    mountain: {name: 'Cliffside mountain', caption: 'Narrow ledge · sheer drops · winding ascent', ground: 0x817969, fog: 0x9caeae, skyLow: 0xcbd8d2, skyHigh: 0x416b92, mountain: 0x83908b, seed: 93217,
      roadHalfWidth: 3.5, shoulderWidth: .5, points: DrivePhysics.mountainPoints},
    racetrack: {name: 'Racetrack / stunt course', caption: 'Follow arrows · gap: 52–63 mph · balance bridge: slow', ground: 0x47634a, fog: 0x9dbac7, skyLow: 0xd3e4e7, skyHigh: 0x386e9d, mountain: 0x7f9290, seed: 59221,
      points: DrivePhysics.stuntRoute.map(p=>[p.x,p.z])}
  };
  let physics = null;
  const world = new THREE.Group();
  scene.add(world);
  let selectedMap = 'city';
  const raceCourses = {
    racetrack: {name: 'Stunt course', caption: maps.racetrack.caption},
    rainbowroad: {name: 'Rainbow Road', caption: 'Rainbow Road · full native course', loop: true, revision: 4},
    racegame: {name: 'Race Game Circuit', caption: 'Race Game Circuit · full native lap', loop: true, revision: 4},
    bangkok: {name: 'Bangkok Rush', caption: 'Bangkok Rush · full native street run', loop: false, revision: 4}
  };
  let selectedCourse = 'racetrack';
  const coursePicker = document.querySelector('#coursePicker');
  const courseSelect = document.querySelector('#courseSelect');
  function isRaceCourse() { return selectedMap === 'racetrack'; }
  function activeCourse() {
    return selectedCourse === 'racetrack' ? raceCourses.racetrack
      : globalThis.DriveImportedCourses?.getCourse?.(selectedCourse) || raceCourses[selectedCourse];
  }
  function activeRoute() { return physics?.courseRoute || DrivePhysics.stuntRoute; }
  function mirroredCityView() { return selectedMap === 'city' && !!city.terrain; }
  function displayZ(z) { return mirroredCityView() ? -z : z; }
  let samples = [];
  let cityVisual = null;
  let importedAssetScene = null;
  let worldGeneration = 0;
  let portfolio = null;
  const carModels = {};
  let selectedCar = 'comet';
  const ghostUI = {
    panel: document.querySelector('#ghostPanel'),
    enabled: document.querySelector('#ghostEnabled'),
    source: document.querySelector('#ghostSource'),
    car: document.querySelector('#ghostCar'),
    pace: document.querySelector('#ghostPace'),
    start: document.querySelector('#ghostStartButton'),
    status: document.querySelector('#ghostStatus'),
    best: document.querySelector('#ghostBestValue'),
    hud: document.querySelector('#ghostHud'),
    time: document.querySelector('#ghostTimeValue'),
    gapRow: document.querySelector('#ghostGapRow'),
    gap: document.querySelector('#ghostGapValue')
  };
  const ghostFrame = new THREE.Group(), ghostVehicle = new THREE.Group();
  ghostFrame.name = 'ghost-racer';
  ghostFrame.add(ghostVehicle);
  ghostFrame.visible = false;
  scene.add(ghostFrame);
  let bestStorage = null;
  try { bestStorage = window.localStorage; } catch (_) { /* Timed laps still work without storage. */ }
  const personalBests = new Map();
  function bestForCourse(courseId) {
    if (!personalBests.has(courseId)) personalBests.set(courseId, typeof DrivePersonalBest === 'undefined'
      ? {best:null, start(){}, record(){}, finish(){return {improved:false,best:null};}, cancel(){}}
      : DrivePersonalBest.create({storage:bestStorage, key:courseId === 'racetrack'
        ? DrivePersonalBest.KEY : DrivePersonalBest.KEY + ':' + courseId + ':v' + (raceCourses[courseId].revision || 1)}));
    return personalBests.get(courseId);
  }
  let personalBest = bestForCourse(selectedCourse);
  const ghost = {
    model: null, car: null, running: false, armed: false, elapsed: 0, progress: 0,
    rate: 1, trace: null, wheelRotation: 0, lastPosition: new THREE.Vector3(),
    lastLineDistance: null, lastFinishDistance: null
  };
  let ghostTraceLoad = null;
  let cameraMode = 0;
  const orbit = {yaw: 0, pitch: 0, idle: 4, pointer: null, x: 0, y: 0};
  function resetOrbit() { orbit.yaw = 0; orbit.pitch = 0; orbit.idle = 4; orbit.pointer = null; }
  const cameraModes = ['CHASE', 'WIDE', 'HOOD'];

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .82;
  scene.fog = new THREE.FogExp2(0x172633, .0048);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(850, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {low: {value: new THREE.Color()}, high: {value: new THREE.Color()}},
    vertexShader: 'varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 low; uniform vec3 high; varying vec3 vPosition; void main(){float h=normalize(vPosition).y; vec3 c=mix(low,high,smoothstep(-0.18,0.85,h)); gl_FragColor=vec4(c,1.0);}'
  }));
  scene.add(sky);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(24, 28, 20), new THREE.MeshBasicMaterial({color: 0xffb880, fog: false}));
  sun.position.set(-170, 58, -240);
  scene.add(sun);
  const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(42, 24, 16), new THREE.MeshBasicMaterial({color: 0xffae76, transparent: true, opacity: .13, depthWrite: false, fog: false}));
  sunGlow.position.copy(sun.position);
  scene.add(sunGlow);

  const ambientLight = new THREE.HemisphereLight(0xb1d9e4, 0x273139, .9);
  scene.add(ambientLight);
  const sunsetLight = new THREE.DirectionalLight(0xffd5b0, 1.25);
  sunsetLight.position.set(-80, 120, -90);
  sunsetLight.castShadow = true;
  sunsetLight.shadow.mapSize.set(2048, 2048);
  sunsetLight.shadow.camera.left = -115;
  sunsetLight.shadow.camera.right = 115;
  sunsetLight.shadow.camera.top = 115;
  sunsetLight.shadow.camera.bottom = -115;
  sunsetLight.shadow.bias = -.0002;
  scene.add(sunsetLight);
  const blueFill = new THREE.DirectionalLight(0x76c9dd, .35);
  blueFill.position.set(90, 40, 50);
  scene.add(blueFill);

  function distanceToRoad(x, z) {
    if (selectedMap === 'city') return city.distanceToRoad(x, z);
    let nearest = Infinity;
    const segmentCount = isRaceCourse() && activeCourse()?.loop === false ? samples.length - 1 : samples.length;
    for (let index = 0; index < segmentCount; index += 1) {
      const a = samples[index].point, b = samples[(index + 1) % samples.length].point;
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      nearest = Math.min(nearest, (x - a.x - t * dx) ** 2 + (z - a.z - t * dz) ** 2);
    }
    return Math.sqrt(nearest);
  }

  // Small seeded textures add detail without downloads, extra meshes or per-frame work.
  function surfaceTexture(kind, repeat = 1) {
    const size = 128, pixels = new Uint8Array(size * size * 4);
    let seed = maps[selectedMap].seed;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const grain = random();
      const broad = Math.sin(x * Math.PI / 16) * Math.sin(y * Math.PI / 32);
      let shade = 170 + grain * 60 + broad * 20;
      if (kind === 'asphalt') shade = grain > .97 ? 245 : 145 + grain * 75;
      if (kind === 'ground' && selectedMap === 'city') shade = 170 + grain * 50 + broad * 8;
      if (kind === 'rock') shade = 145 + grain * 65 + 35 * Math.sin(y * Math.PI / 8 + Math.sin(x * Math.PI / 16));
      if (kind === 'bark') shade = 125 + grain * 55 + 60 * Math.sin(x * Math.PI / 8);
      if (kind === 'windows') shade = x % 32 > 7 && x % 32 < 24 && y % 24 > 6 && y % 24 < 17 ? 235 : 85;
      const i = (y * size + x) * 4;
      pixels[i] = shade; pixels[i + 1] = shade; pixels[i + 2] = shade; pixels[i + 3] = 255;
    }
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = Math.min(8, renderer.capabilities?.getMaxAnisotropy?.() || 1);
    texture.encoding = THREE.sRGBEncoding;
    texture.repeat.set(repeat, repeat);
    texture.needsUpdate = true;
    return texture;
  }

  function buildWorld() {
    const generation = ++worldGeneration;
    const imported = isRaceCourse() && selectedCourse !== 'racetrack';
    const importedCourse = imported ? activeCourse() : null;
    // Dispose shared resources once when changing maps, never accumulate old scenery.
    cityVisual?.dispose?.();
    physics?.dispose?.();
    if (importedAssetScene) {
      world.remove(importedAssetScene);
      importedAssetScene = null;
    }
    const geometries = new Set(), materials = new Set(), textures = new Set();
    world.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of object.material ? [].concat(object.material) : []) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    world.clear();
    cityVisual = null;
    world.scale.z = mirroredCityView() ? -1 : 1;
    vehicleFrame.scale.z = world.scale.z;
    ghostFrame.scale.z = world.scale.z;
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    physics = DrivePhysics.create({map:selectedMap, courseId:selectedCourse, course:importedCourse,
      city, car:selectedCar, distanceToRoad,
      roadHalfWidth:selectedMap === 'city' ? city.roadHalfWidth : imported ? importedCourse.width / 2 : maps[selectedMap].roadHalfWidth || 6.2});
    const config = imported ? {...maps.racetrack, ...importedCourse} : maps[selectedMap];
    scene.fog.color.setHex(config.fog);
    scene.background = new THREE.Color(config.fog);
    sky.material.uniforms.low.value.setHex(config.skyLow);
    sky.material.uniforms.high.value.setHex(config.skyHigh);
    scene.fog.density = selectedMap === 'city' ? .0032 : imported ? .0015 : .0048;
    renderer.toneMappingExposure = selectedMap === 'city' ? 1.05 : .9;
    sun.visible = sunGlow.visible = selectedMap !== 'city';
    ambientLight.intensity = selectedMap === 'city' ? .7 : .9;
    sunsetLight.intensity = selectedMap === 'city' ? .22 : 1.25;
    sunsetLight.castShadow = selectedMap !== 'city' && !imported;
    blueFill.intensity = selectedMap === 'city' ? .65 : .35;
    if (!(selectedMap === 'city' && city.terrain)) {
      const groundDetail = imported ? null : surfaceTexture(selectedMap === 'mountain' ? 'rock' : 'ground', physics.edge / 4);
      const groundSegments = selectedMap === 'city' || imported ? 1 : physics.edge;
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(physics.edge * 2, physics.edge * 2, groundSegments, groundSegments), new THREE.MeshStandardMaterial({color: config.ground, roughness: 1, map: groundDetail, bumpMap: groundDetail, bumpScale: .12}));
      if (selectedMap !== 'city' && !imported) {
        const pos = ground.geometry.attributes.position;
        for (let i=0;i<pos.count;i++) pos.setZ(i, physics.terrainHeight(pos.getX(i), -pos.getY(i)));
        ground.geometry.computeVertexNormals();
      }
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = imported ? physics.terrainHeight(0, 0) + (importedCourse.groundVisualOffset || 0) : 0;
      ground.name = 'terrain';
      ground.receiveShadow = true;
      world.add(ground);
    }
    if (selectedMap === 'city') samples = city.routeSamples.map(sample => ({point: new THREE.Vector3(sample.x, sample.y ?? physics.terrainHeight(sample.x,sample.z), sample.z), tangent: new THREE.Vector3(sample.tx, 0, sample.tz)}));
    else if (isRaceCourse()) samples = physics.courseRoute.map(p => ({point:new THREE.Vector3(p.x,p.y,p.z),tangent:new THREE.Vector3(p.tx,0,p.tz),width:p.width,kind:p.kind}));
    else {
      const path = new THREE.CatmullRomCurve3(config.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
      samples = Array.from({length: 480}, (_, index) => ({
        point: path.getPointAt(index / 480), tangent: path.getTangentAt(index / 480).normalize()
      }));
      samples.forEach(sample => { sample.point.y = physics.terrainHeight(sample.point.x, sample.point.z); });
    }

    const ribbonSamples = samples;
    function ribbon(offsetA, offsetB, height, material) {
      const positions = [];
      const uvs = [];
      const indices = [];
      // Subdivide across the road as well as along it to follow the collision surface.
      const columns = Math.max(1, Math.ceil(Math.abs(offsetB - offsetA)));
      material.polygonOffset = true;
      material.polygonOffsetFactor = -1;
      material.polygonOffsetUnits = -1;
      for (let index = 0; index <= ribbonSamples.length; index += 1) {
        const sample = ribbonSamples[index % ribbonSamples.length];
        const normal = new THREE.Vector3(-sample.tangent.z, 0, sample.tangent.x);
        for (let column = 0; column <= columns; column++) {
          const point = sample.point.clone().addScaledVector(normal, offsetA + (offsetB-offsetA)*column/columns);
          positions.push(point.x, physics.terrainHeight(point.x,point.z) + height, point.z);
          uvs.push(point.x / 8, point.z / 8);
          if (index < ribbonSamples.length && column < columns) {
            const first = index * (columns + 1) + column;
            indices.push(first, first+1, first+columns+1, first+1, first+columns+2, first+columns+1);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'road-ribbon';
      mesh.userData.surfaceOffset = height;
      mesh.receiveShadow = true;
      world.add(mesh);
    }

    const halfWidth = config.roadHalfWidth || 6.2, shoulderWidth = config.shoulderWidth || 1.5;
    if(selectedMap!=='racetrack' && selectedMap!=='city') {
    const shoulder = new THREE.MeshStandardMaterial({color:0x58605b,roughness:1,map:surfaceTexture('ground'),side:THREE.DoubleSide});
    // Only draw exposed shoulders, not another almost-coplanar layer under asphalt.
    ribbon(-halfWidth-shoulderWidth,-halfWidth,.045,shoulder);
    ribbon(halfWidth,halfWidth+shoulderWidth,.045,shoulder);
    ribbon(-halfWidth, halfWidth, .075, new THREE.MeshStandardMaterial({color: 0x30383d, roughness: .95, map: surfaceTexture('asphalt'), side: THREE.DoubleSide}));
    const paint = new THREE.MeshBasicMaterial({color: 0xd0d6cd, side: THREE.DoubleSide});
    ribbon(-halfWidth+.24, -halfWidth+.37, .105, paint);
    ribbon(halfWidth-.37, halfWidth-.24, .105, paint);
    for (let index = 0; index < samples.length; index += 8) {
      const sample = samples[index];
      const forward = sample.tangent.clone();
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      const vertices = [];
      for (const [side,along] of [[-.075,-1.4],[.075,-1.4],[-.075,1.4],[.075,1.4]]) {
        const point = sample.point.clone().addScaledVector(right,side).addScaledVector(forward,along);
        vertices.push(point.x,physics.terrainHeight(point.x,point.z)+.11,point.z);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
      geometry.setIndex([0,1,2,1,3,2]); geometry.computeVertexNormals();
      const dash = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color:0xd9b876,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
      world.add(dash);
    }

    }
    // The stunt ribbon is the collider itself, not paint over an old track.
    if(selectedMap==='racetrack' && !imported) {
      const positions=[],colors=[],markings=[],markColors=[];
      function tri(out,cols,a,b,c,color){const col=new THREE.Color(color);for(const p of [a,b,c]){out.push(p.x,p.y,p.z);cols.push(col.r,col.g,col.b);}}
      function quad(out,cols,v,color){tri(out,cols,v[0],v[1],v[2],color);tri(out,cols,v[0],v[2],v[3],color);}
      function edge(p,side,offset=0){return new THREE.Vector3(p.x-p.tz*(p.width/2-offset)*side,p.y+.035,p.z+p.tx*(p.width/2-offset)*side);}
      for(const slab of physics.stuntSlabs){
        const v=slab.vertices.map(p=>new THREE.Vector3(p.x+slab.body.position.x,p.y+slab.body.position.y,p.z+slab.body.position.z));
        const kind=slab.a.kind;
        slab.faces.forEach((f,i)=>quad(positions,colors,f.map(k=>v[k]),i===1?(kind==='launch'?0x99462b:kind==='balance'?0x284e62:0x343f48):0x6e7a80));
        for(const side of [-1,1])quad(markings,markColors,[edge(slab.a,side,.12),edge(slab.b,side,.12),edge(slab.b,side,.32),edge(slab.a,side,.32)],slab.index%4<2?0xffcd58:0x252d32);
        const length=Math.hypot(slab.b.x-slab.a.x,slab.b.z-slab.a.z);
        for(let arrowIndex=0;arrowIndex<Math.max(1,Math.floor(length/18));arrowIndex++){
          if(length<6&&slab.index%9!==3)continue;
          const t=(arrowIndex+.5)/Math.max(1,Math.floor(length/18));
          const a=slab.a,b=slab.b,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=a.y+(b.y-a.y)*t+.055;
          const forward=new THREE.Vector3(b.x-a.x,0,b.z-a.z).normalize(),right=new THREE.Vector3(-forward.z,0,forward.x);
          const center=new THREE.Vector3(x,y,z),rise=(b.y-a.y)/Math.hypot(b.x-a.x,b.z-a.z);
          const arrow=(along,side)=>{const p=center.clone().addScaledVector(forward,along).addScaledVector(right,side);p.y+=rise*along;return p;};
          tri(markings,markColors,arrow(1.2,0),arrow(-1,-.65),arrow(-1,.65),0xf4eee0);
        }
      }
      function batch(name,pos,col,material){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();const m=new THREE.Mesh(g,material);m.name=name;m.receiveShadow=true;world.add(m);return m;}
      batch('stunt-route-solids',positions,colors,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92})).castShadow=true;
      batch('stunt-route-markings',markings,markColors,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
      // Conspicuous yellow launch / landing edges and elevated supports.
      for(const z of [80,72]){
        const y=z===80?3:2;
        const bar=new THREE.Mesh(new THREE.BoxGeometry(12.4,.06,.4),new THREE.MeshBasicMaterial({color:0xffd34e}));bar.position.set(0,y+.035,z+(z===80?.2:-.2));bar.name='jump-edge';world.add(bar);
      }
      for(const p of physics.stuntSupports){
        const post=new THREE.Mesh(new THREE.BoxGeometry(p.hx*2,p.hy*2,p.hz*2),new THREE.MeshStandardMaterial({color:0x647680}));post.position.set(p.x,p.y,p.z);post.name='stunt-support';world.add(post);
      }
      // Alternating gates on the wide east straight leave a 6.3 m opening.
      for(const [i,z] of [48,72,96].entries())physics.addObstacle(175+(i%2?2.8:-2.8),z,3.1,.9,1);
      // Start/finish painted only on the actual slab; never on recovery ground.
      const start=samples[0],right=new THREE.Vector3(-start.tangent.z,0,start.tangent.x);
      for(let row=0;row<2;row++)for(let col=0;col<12;col++){
        const tile=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:(row+col)%2?0xffffff:0x151b23,side:THREE.DoubleSide}));
        tile.rotation.x=-Math.PI/2;tile.rotation.z=-Math.atan2(start.tangent.x,start.tangent.z);
        tile.position.copy(start.point).addScaledVector(right,col-5.5).addScaledVector(start.tangent,row+1);tile.position.y=physics.roadHeight(tile.position.x,tile.position.z)+.04;tile.name='circuit-start-line';world.add(tile);
      }
    }

    if (imported) {
      // A lightweight, playable road is shown while the selected GLB loads.
      // It also keeps this time trial usable if a local asset is unavailable.
      const fallback = new THREE.Group();
      fallback.name = 'imported-course-fallback';
      const route = importedCourse.route;
      const last = route.at(-1),runout = importedCourse.finishRunout || 0;
      const renderRoute = importedCourse.loop === false && runout > 0
        ? [...route,{...last,x:last.x+last.tx*runout,
          y:importedCourse.finishRunoutEndY ?? last.y,z:last.z+last.tz*runout}]
        : route;
      const count = renderRoute.length - (importedCourse.loop === false ? 1 : 0);
      const nearestRouteIndex = point => {
        let at=0, distance=Infinity;
        for(let index=0;index<route.length;index++) {
          const sample=route[index];
          const delta=Math.hypot(sample.x-point.x,sample.y-point.y,sample.z-point.z);
          if(delta<distance){distance=delta;at=index;}
        }
        return at;
      };
      const transferGaps=(importedCourse.transfers||[]).map(link=>({
        from:nearestRouteIndex(link.from),to:nearestRouteIndex(link.to)
      }));
      const gapAt=index=>route[index]?.kind==='gap'||
        transferGaps.some(gap=>index>=gap.from&&index<gap.to);
      const rainbow = selectedCourse === 'rainbowroad';
      const colors = rainbow ? [0xff4646,0xff9a38,0xffed4b,0x57d872,0x4dbaf8,0x6f74f7,0xbc6ff7] : [0x45535a];
      for (let stripe = 0; stripe < colors.length; stripe++) {
        const vertices = [], indices = [];
        const sideA = -importedCourse.width / 2 + importedCourse.width * stripe / colors.length;
        const sideB = -importedCourse.width / 2 + importedCourse.width * (stripe + 1) / colors.length;
        for (let index = 0; index <= count; index++) {
          const p = renderRoute[index % renderRoute.length], tangent = new THREE.Vector3(p.tx,0,p.tz);
          const normal = new THREE.Vector3(-tangent.z,0,tangent.x);
          for (const side of [sideA,sideB]) {
            const point = new THREE.Vector3(p.x,p.y+.035,p.z).addScaledVector(normal,side);
            vertices.push(point.x,point.y,point.z);
          }
          if (index < count && !gapAt(index)) {
            const at = index * 2;
            indices.push(at,at+1,at+2,at+1,at+3,at+2);
          }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        geometry.setIndex(indices);geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:colors[stripe],side:THREE.DoubleSide}));
        mesh.name = 'imported-course-road';fallback.add(mesh);
      }
      const start = route[0], tileWidth = importedCourse.width / 8;
      const grid = new THREE.Group();
      grid.position.set(start.x,start.y+.06,start.z);
      grid.rotation.y = Math.atan2(start.tx,start.tz);
      for (let row=0; row<2; row++) for (let col=0; col<8; col++) {
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(tileWidth,.4),
          new THREE.MeshBasicMaterial({color:(row+col)%2?0xf5f7ee:0x17212a,side:THREE.DoubleSide}));
        tile.rotation.x=-Math.PI/2;
        tile.position.set((col-3.5)*tileWidth,.01,(row-.5)*.4);
        grid.add(tile);
      }
      grid.name='circuit-start-line';fallback.add(grid);
      world.add(fallback);
      const courseId = selectedCourse;
      Promise.resolve().then(() => DriveImportedCourses.load(courseId)).then(loaded => {
        if (generation !== worldGeneration || !isRaceCourse() || selectedCourse !== courseId) return;
        importedAssetScene = loaded.scene;
        world.add(importedAssetScene);
        if (loaded.collisionMeshes.length && !physics.addCourseCollisionMeshes(loaded.collisionMeshes))
          console.warn('Imported course collision unavailable; using its road proxy:',courseId);
        fallback.visible = !!importedCourse.overlayRoad;
        // Bangkok's reverse run starts on native asphalt without a checker.
        // Keep its generated start grid after hiding the loading road.
        if (courseId === 'bangkok' && !fallback.visible) {
          grid.position.y = physics.roadHeight(start.x,start.z)+.12;
          world.add(grid);
        }
      }).catch(error => {
        if (generation !== worldGeneration || selectedCourse !== courseId) return;
        console.warn('Imported course scene unavailable; using playable road proxy:',courseId,error);
        ghostUI.status.textContent = 'Map model unavailable. The timed course remains playable.';
        if (importedCourse.nativeFinish) addFinishMarker(true);
      });
    }

    physics.obstacles.forEach(obstacle => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(obstacle.hx*2, obstacle.hy*2, obstacle.hz*2), new THREE.MeshStandardMaterial({color:0xef7845,roughness:.85}));
      mesh.name = 'solid-obstacle';
      mesh.position.set(obstacle.x,obstacle.y,obstacle.z);
      mesh.castShadow = true; mesh.receiveShadow = true; world.add(mesh);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(obstacle.hx*2+.02,.22,obstacle.hz*2+.02),new THREE.MeshBasicMaterial({color:0xfff5d5}));
      stripe.position.copy(mesh.position); stripe.position.y += .25; world.add(stripe);
    });
    const rand = (() => { let seed = config.seed; return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); })();
    if (selectedMap !== 'city' && !imported) {
    const barkDetail = surfaceTexture('bark', 2);
    const bark = new THREE.MeshStandardMaterial({color: 0x68513d, roughness: 1, map: barkDetail, bumpMap: barkDetail, bumpScale: .08});
    const pine = [
      new THREE.MeshStandardMaterial({color: 0x24464b, roughness: 1, flatShading: true}),
      new THREE.MeshStandardMaterial({color: 0x365a57, roughness: 1, flatShading: true}),
      new THREE.MeshStandardMaterial({color: 0x1e3b41, roughness: 1, flatShading: true})
    ];
    const trunkGeometry = new THREE.CylinderGeometry(.18, .24, 1.8, 5);
    const canopyGeometry = new THREE.ConeGeometry(2.1, 7, 6);
    for (let index = 0; index < 145; index += 1) {
      const x = (rand() - .5) * 360;
      const z = (rand() - .5) * 360;
      if (distanceToRoad(x, z) < 12) continue;
      const height = 1.2 + rand() * 1.3;
      const trunk = new THREE.Mesh(trunkGeometry, bark);
      trunk.position.set(x, physics.terrainHeight(x,z) + .8 * height, z);
      trunk.scale.set(height, height, height);
      trunk.castShadow = true;
      world.add(trunk);
      const top = new THREE.Mesh(canopyGeometry, pine[index % pine.length]);
      top.position.set(x, physics.terrainHeight(x,z) + 4.3 * height, z);
      top.scale.set(height, height, height);
      top.castShadow = true;
      world.add(top);
    }

    const rockDetail = surfaceTexture('rock', 3);
    const stoneMaterials = [
      new THREE.MeshStandardMaterial({color: 0x53636a, roughness: 1, flatShading: true, map: rockDetail, bumpMap: rockDetail, bumpScale: .18}),
      new THREE.MeshStandardMaterial({color: 0x78817a, roughness: 1, flatShading: true, map: rockDetail, bumpMap: rockDetail, bumpScale: .18})
    ];
    for (let index = 0; index < 52; index += 1) {
      const x = (rand() - .5) * 350;
      const z = (rand() - .5) * 350;
      if (distanceToRoad(x, z) < 9) continue;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + rand() * 3, 0), stoneMaterials[index % 2]);
      rock.position.set(x, physics.terrainHeight(x,z) + .3, z);
      rock.scale.y = .45 + rand() * .6;
      rock.rotation.y = rand() * Math.PI;
      rock.castShadow = true;
      world.add(rock);
    }
    for (let index = 0; index < (selectedMap === 'mountain' ? 0 : 19); index += 1) {
      const angle = index * Math.PI * 2 / 19;
      const radius = 205 + rand() * 38;
      const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(20 + rand() * 20, 55 + rand() * 75, 5),
        new THREE.MeshStandardMaterial({color: config.mountain, roughness: 1, flatShading: true, map: rockDetail, bumpMap: rockDetail, bumpScale: .35})
      );
      mountain.position.set(Math.cos(angle) * radius, 18, Math.sin(angle) * radius);
      mountain.rotation.y = rand() * Math.PI;
      world.add(mountain);
    }

    // Small roadside detail uses one instanced draw call, with no per-frame work.
    const detail = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({color: 0x749365, roughness: 1}), 360);
    detail.name = 'roadside-detail';
    const dummy = new THREE.Object3D();
    let count = 0;
    for (let i = 0; i < 720 && count < 360; i++) {
      const sample = samples[Math.floor(rand() * samples.length)];
      const normal = new THREE.Vector3(-sample.tangent.z, 0, sample.tangent.x);
      const side = rand() < .5 ? -1 : 1;
      dummy.position.copy(sample.point).addScaledVector(normal, side * (9 + rand() * 19));
      if (distanceToRoad(dummy.position.x, dummy.position.z) < 8) continue;
      const size = .1 + rand() * .45;
      dummy.position.y = physics.terrainHeight(dummy.position.x,dummy.position.z) + size * .2;
      dummy.scale.set(size, size * .5, size);
      dummy.rotation.set(rand(), rand() * Math.PI, 0);
      dummy.updateMatrix(); detail.setMatrixAt(count++, dummy.matrix);
    }
    detail.count = count; detail.receiveShadow = true; world.add(detail);
    }

    function addGate(index, color) {
      const sample = samples[index];
      const normal = new THREE.Vector3(-sample.tangent.z, 0, sample.tangent.x);
      const group = new THREE.Group();
      const frame = new THREE.MeshStandardMaterial({color: 0x3e5055, metalness: .55, roughness: .42});
      const glow = new THREE.MeshBasicMaterial({color});
      const gateSide = halfWidth + 1.2;
      const gateY = Math.max(...[-gateSide,gateSide].map(side => physics.terrainHeight(sample.point.x+normal.x*side,sample.point.z+normal.z*side)));
      [-gateSide, gateSide].forEach(side => {
        const foot = sample.point.clone().addScaledVector(normal,side);
        const footY = physics.terrainHeight(foot.x,foot.z);
        const postHeight = gateY + 6.2 - footY;
        const post = new THREE.Mesh(new THREE.BoxGeometry(.35, postHeight, .35), frame);
        post.position.copy(foot);
        post.position.y = footY + postHeight/2;
        post.castShadow = true;
        group.add(post);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(.48, 2.6, .48), glow);
        stripe.position.copy(post.position);
        stripe.position.y = gateY + 4.1;
        group.add(stripe);
      });
      const beam = new THREE.Mesh(new THREE.BoxGeometry(gateSide*2+.4, .28, .4), glow);
      beam.position.copy(sample.point);
      beam.position.y = gateY + 6.15;
      beam.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
      group.add(beam);
      world.add(group);
    }
    if (selectedMap === 'mountain') {
      addGate(15, 0xa9f2e9);
      addGate(156, 0xffc286);
      addGate(316, 0x89bdff);
    }
    if (selectedMap === 'city') {
      cityVisual = city.build(THREE, world);
    }

    portfolio?.setCity(city);
    portfolio?.setMap(selectedMap);

  }


  function part(group, geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function buildCar(type, spec, parent = vehicle) {
    const group = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({color: spec.color, metalness: .68, roughness: .28});
    const trim = new THREE.MeshStandardMaterial({color: 0x172126, metalness: .25, roughness: .65});
    const glass = new THREE.MeshStandardMaterial({color: 0x18343f, metalness: .45, roughness: .16});
    const chrome = new THREE.MeshStandardMaterial({color: 0xb7ceca, metalness: .85, roughness: .22});
    const lamp = new THREE.MeshBasicMaterial({color: 0xe9faff});
    const rearLamp = new THREE.MeshBasicMaterial({color: 0xff354e});
    const radius = spec.wheelRadius;
    part(group, new THREE.BoxGeometry(spec.width, .52, spec.length), paint, 0, 1.05, 0);
    part(group, new THREE.BoxGeometry(spec.width + .12, .18, spec.length - .35), trim, 0, .73, 0);
    if ((type === 'comet' || type === 'hypercar' || type === 'u9xtreme')) {
      const nose = part(group, new THREE.BoxGeometry(spec.width * .96, .35, 1.6), paint, 0, 1.27, 1.63);
      nose.rotation.x = -.1;
      const cabin = part(group, new THREE.BoxGeometry(spec.width * .72, .66, 2.12), glass, 0, 1.62, -.45);
      cabin.rotation.x = -.07;
      part(group, new THREE.BoxGeometry(spec.width * .82, .13, .4), trim, 0, 1.57, -2.1);
      part(group, new THREE.BoxGeometry(spec.width * .84, .12, .35), paint, 0, 1.92, -2.15);
      part(group, new THREE.BoxGeometry(.18, .03, 2.2), chrome, 0, 1.46, 1.1);
    } else if (type === 'rally') {
      part(group, new THREE.BoxGeometry(spec.width * .85, .9, 2.6), glass, 0, 1.77, -.32);
      part(group, new THREE.BoxGeometry(spec.width * .9, .18, 2.65), paint, 0, 2.27, -.32);
      part(group, new THREE.BoxGeometry(.16, .15, 2.2), chrome, -.5, 2.42, -.32);
      part(group, new THREE.BoxGeometry(.16, .15, 2.2), chrome, .5, 2.42, -.32);
      part(group, new THREE.BoxGeometry(spec.width, .24, .5), trim, 0, 1.25, -2.35);
      for (let i = -1; i <= 1; i += 1) part(group, new THREE.BoxGeometry(.28, .22, .16), lamp, i * .38, 1.25, 2.48);
    } else {
      part(group, new THREE.BoxGeometry(spec.width * .88, .93, 1.85), glass, 0, 1.8, .68);
      part(group, new THREE.BoxGeometry(spec.width * .96, .16, 1.9), paint, 0, 2.29, .68);
      part(group, new THREE.BoxGeometry(spec.width * .92, .1, 2.5), trim, 0, 1.43, -1.45);
      [-1, 1].forEach(side => part(group, new THREE.BoxGeometry(.13, .42, 2.5), paint, side * (spec.width / 2 - .08), 1.64, -1.45));
      part(group, new THREE.BoxGeometry(spec.width, .18, .2), chrome, 0, .92, 2.86);
    }
    [-1, 1].forEach(side => {
      part(group, new THREE.BoxGeometry(.64, .14, .08), lamp, side * (spec.width / 2 - .48), 1.16, spec.length / 2 + .02);
      part(group, new THREE.BoxGeometry(.6, .17, .08), rearLamp, side * (spec.width / 2 - .48), 1.15, -spec.length / 2 - .02);
    });
    // Small silhouette and surface details make each car readable up close.
    const front = spec.length / 2;
    part(group, new THREE.BoxGeometry(spec.width * .55, .24, .08), trim, 0, .94, front + .04);
    for (let i = -2; i <= 2; i += 1) part(group, new THREE.BoxGeometry(.035, .2, .1), chrome, i * .18, .94, front + .09);
    part(group, new THREE.BoxGeometry(.48, .16, .04), chrome, 0, .93, -front - .07);
    [-1, 1].forEach(side => {
      const cabinZ = type === 'pickup' ? .68 : -.32;
      const cabinTop = (type === 'comet' || type === 'hypercar' || type === 'u9xtreme') ? 1.97 : 2.27;
      const pillarX = spec.width * ((type === 'comet' || type === 'hypercar' || type === 'u9xtreme') ? .36 : .425);
      [-.78, .65].forEach(z => part(group, new THREE.BoxGeometry(.1, cabinTop - 1.35, .12), paint, side * pillarX, (cabinTop + 1.35) / 2, cabinZ + z));
      part(group, new THREE.BoxGeometry(.36, .18, .32), paint, side * (spec.width / 2 + .18), 1.64, .65);
      part(group, new THREE.BoxGeometry(.3, .11, .03), chrome, side * (spec.width / 2 + .18), 1.65, .48);
      part(group, new THREE.BoxGeometry(.04, .06, .3), chrome, side * (spec.width / 2 + .02), 1.24, -.2);
      part(group, new THREE.BoxGeometry(.08, .14, spec.length * .65), trim, side * (spec.width / 2 + .04), .77, 0);
      const exhaust = part(group, new THREE.CylinderGeometry(.09, .09, .3, 12), chrome, side * .7, .7, -front);
      exhaust.rotation.x = Math.PI / 2;
    });
    if ((type === 'comet' || type === 'hypercar' || type === 'u9xtreme')) {
      part(group, new THREE.BoxGeometry(spec.width * .7, .09, 1.1), paint, 0, 1.99, -.5);
      [-.65, .65].forEach(x => part(group, new THREE.BoxGeometry(.08, .37, .14), trim, x, 1.7, -2.15));
      [-.35, .35].forEach(x => part(group, new THREE.BoxGeometry(.15, .025, 1.3), trim, x, 1.46, 1.5));
    } else if (type === 'rally') {
      part(group, new THREE.BoxGeometry(1.6, .15, .3), trim, 0, 2.49, .6);
      for (let i = -2; i <= 2; i += 1) part(group, new THREE.BoxGeometry(.2, .14, .08), lamp, i * .29, 2.51, .78);
      [-1, 1].forEach(side => [-spec.wheelZ, spec.wheelZ].forEach(z => part(group, new THREE.BoxGeometry(.38, .4, .08), trim, side * spec.width / 2, .44, z - .5)));
    } else {
      part(group, new THREE.BoxGeometry(spec.width * .9, .4, .14), paint, 0, 1.64, -front + .08);
      for (let i = -2; i <= 2; i += 1) part(group, new THREE.BoxGeometry(.07, .04, 2.25), chrome, i * .37, 1.5, -1.45);
      part(group, new THREE.BoxGeometry(.5, .08, .05), chrome, 0, 1.72, -front);
    }
    const wheelGeometry = new THREE.CylinderGeometry(radius, radius, .35, 28);
    wheelGeometry.rotateZ(Math.PI / 2);
    const hubGeometry = new THREE.CylinderGeometry(radius * .62, radius * .62, .37, 20);
    hubGeometry.rotateZ(Math.PI / 2);
    const wheels = [];
    [-1, 1].forEach(side => {
      [-spec.wheelZ, spec.wheelZ].forEach(z => {
        const wheel = new THREE.Group();
        part(wheel, wheelGeometry, trim, 0, 0, 0);
        part(wheel, hubGeometry, chrome, 0, 0, 0);
        for (let i = 0; i < 5; i += 1) {
          const angle = i * Math.PI * 2 / 5;
          const spoke = part(wheel, new THREE.BoxGeometry(.39, radius * .95, .07), chrome, 0, 0, 0);
          spoke.rotation.x = angle;
        }
        const pivot = new THREE.Group();
        pivot.add(wheel);
        const axle=spec.wheelLayout[wheels.length];
        pivot.position.set(axle.x,radius+.08,axle.z);
        group.add(pivot);
        wheels.push({pivot, wheel, front: z > 0});
      });
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(spec.width * 1.3, spec.length * 1.1), new THREE.MeshBasicMaterial({color: spec.color, transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide}));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = .04;
    group.add(glow);
    group.visible = false;
    parent.add(group);
    return {group, wheels, rearLamp};
  }

  Object.entries(carSpecs).forEach(([type, spec]) => { carModels[type] = buildCar(type, spec); });
  function formatGhostTime(seconds) {
    const tenths = Math.floor(Math.max(0, seconds) * 10);
    return Math.floor(tenths / 600) + ':' + String(Math.floor(tenths / 10) % 60).padStart(2, '0') + '.' + tenths % 10;
  }
  function ghostCar() { return ghostUI.car.value === 'match' ? selectedCar : ghostUI.car.value; }
  function ghostRate() { return {relaxed:.88, standard:1, quick:1.12}[ghostUI.pace.value] || 1; }
  function disposeGhostModel() {
    if (!ghost.model) return;
    const geometries = new Set(), materials = new Set();
    ghost.model.group.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) [].concat(object.material).forEach(material => materials.add(material));
    });
    ghostVehicle.remove(ghost.model.group);
    // An imported ghost shares its source car's geometry, which stays cached for the garage.
    if (!ghost.model.sharedGeometry) geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    ghost.model = null;
  }
  function buildGhostModel(type) {
    disposeGhostModel();
    const source = carModels[type];
    if (source.assetState === 'ready') {
      const group = source.group.clone(true);
      group.visible = true;
      ghostVehicle.add(group);
      const wheels = source.wheels.map(({pivot}) => {
        const index = source.group.children.indexOf(pivot);
        const copy = group.children[index];
        return {pivot:copy, wheel:copy.children[0]};
      });
      ghost.model = {group, wheels, sharedGeometry:true};
    } else {
      ghost.model = buildCar(type, carSpecs[type], ghostVehicle);
      ghost.model.sharedGeometry = false;
      ghost.model.group.visible = true;
    }
    const clonedMaterials = new Map();
    ghost.model.group.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = object.receiveShadow = false;
      object.renderOrder = 1;
      const style = material => {
        if (clonedMaterials.has(material)) return clonedMaterials.get(material);
        const copy = ghost.model.sharedGeometry ? material.clone() : material;
        const tint = new THREE.Color(0xbaf9ff);
        copy.color?.lerp(tint, .12);
        copy.transparent = true;
        copy.opacity = copy.opacity < .2 ? .16 : copy.name?.startsWith('Glass') ? .4 : .68;
        copy.depthWrite = false;
        if (copy.emissive) { copy.emissive.setHex(0x275c67); copy.emissiveIntensity = .25; }
        clonedMaterials.set(material, copy);
        return copy;
      };
      object.material = Array.isArray(object.material) ? object.material.map(style) : style(object.material);
    });
    ghost.car = type;
    ghost.wheelRotation = 0;
    if (source.assetState !== 'ready') loadCarAsset(type);
  }
  const ghostPosition = new THREE.Vector3(), ghostQuaternion = new THREE.Quaternion();
  const ghostNextQuaternion = new THREE.Quaternion(), ghostOffset = new THREE.Vector3();
  function setGhostPose(time) {
    if (!ghost.trace || !ghost.model) return;
    const {frames, dt} = ghost.trace;
    const index = Math.min(frames.length - 2, Math.max(0, Math.floor(time / dt)));
    const blend = THREE.MathUtils.clamp(time / dt - index, 0, 1);
    const a = frames[index], b = frames[index + 1];
    ghostPosition.set(a[0], a[1], a[2]).lerp(ghostOffset.set(b[0], b[1], b[2]), blend);
    // Give the non-colliding ghost its own start lane, then merge onto its recorded line.
    const start = activeRoute()[0], merge = Math.max(0, 1 - time / 5) ** 2;
    ghostPosition.x += (start.tx * 1.5 - start.tz * 1.7) * merge;
    ghostPosition.z += (start.tz * 1.5 + start.tx * 1.7) * merge;
    ghostQuaternion.set(a[3], a[4], a[5], a[6]);
    ghostNextQuaternion.set(b[3], b[4], b[5], b[6]);
    ghostQuaternion.slerp(ghostNextQuaternion, blend).normalize();
    if (time > 0) ghost.wheelRotation += ghostPosition.distanceTo(ghost.lastPosition) / carSpecs[ghost.car].radius;
    ghost.lastPosition.copy(ghostPosition);
    ghostVehicle.quaternion.copy(ghostQuaternion);
    ghostVehicle.position.copy(ghostPosition).add(ghostOffset.set(0, -1.05, 0).applyQuaternion(ghostQuaternion));
    ghost.model.wheels.forEach(({wheel}) => { wheel.rotation.x = -ghost.wheelRotation; });
  }
  function cancelGhostRun(message) {
    personalBest.cancel();
    ghost.running = false;
    ghost.armed = false;
    ghost.done = false;
    ghost.elapsed = 0;
    ghost.progress = 0;
    ghost.wheelRotation = 0;
    ghost.lastLineDistance = null;
    ghost.lastFinishDistance = null;
    ghostUI.hud.hidden = !isRaceCourse();
    ghostUI.gapRow.hidden = true;
    ghostUI.time.textContent = '0:00.0';
    ghostUI.start.textContent = 'RESET TO START';
    if (message) ghostUI.status.textContent = message;
    if (ghost.trace && ghost.model) setGhostPose(0);
  }
  function courseGhostTrace() {
    if (selectedCourse === 'racetrack') return globalThis.DriveGhostTraces?.[ghostCar()];
    return activeCourse()?.ghostTraces?.[ghostCar()] ||
      globalThis.DriveCourseGhostTraces?.[selectedCourse]?.[ghostCar()] || null;
  }
  function refreshGhostSetup() {
    const onTrack = isRaceCourse();
    ghostUI.panel.hidden = !onTrack;
    ghostUI.best.textContent = personalBest.best ? formatGhostTime(personalBest.best.lapTime) + ' · ' + (carSpecs[personalBest.best.car]?.name || personalBest.best.car) : '—';
    if (!onTrack) { ghostFrame.visible = false; ghostUI.hud.hidden = true; return; }
    ghostUI.hud.hidden = false;
    ghostUI.start.disabled = false;
    const enabled = !!ghostUI.enabled.checked;
    const useBest = ghostUI.source.value === 'best';
    ghostUI.source.disabled = !enabled;
    ghostUI.car.disabled = ghostUI.pace.disabled = !enabled || useBest;
    const candidate = useBest ? personalBest.best : courseGhostTrace();
    const trace = enabled && candidate && candidate.routeLength === activeRoute().length &&
      carSpecs[useBest ? candidate.car : ghostCar()] ? candidate : null;
    const type = useBest ? trace?.car : ghostCar();
    ghost.trace = trace;
    ghost.rate = useBest ? 1 : ghostRate();
    ghostUI.gapRow.hidden = !ghost.running || !trace;
    ghostFrame.visible = !!trace;
    if (trace) {
      if (ghost.car !== type) buildGhostModel(type);
      setGhostPose(ghost.running ? Math.min(ghost.elapsed * ghost.rate, trace.duration) : 0);
    }
    if (!ghost.running) ghostUI.status.textContent = !enabled ? 'Timed lap ready. Drive across the line to start.'
      : useBest && !trace ? 'No best lap yet. Cross the line to record one.'
      : !trace ? selectedCourse === 'racetrack'
        ? 'Loading course ghost… Cross the line to start the timer.'
        : 'Course ghost unavailable here. Cross the line to start the timer.'
      : carSpecs[type].name + ' ghost · target ' + formatGhostTime(trace.lapTime / ghost.rate) + '. Cross the line to start.';
  }
  function loadGhostTraces() {
    if (globalThis.DriveGhostTraces) return Promise.resolve(globalThis.DriveGhostTraces);
    if (ghostTraceLoad) return ghostTraceLoad;
    if (!document.createElement || !document.head?.appendChild) return Promise.resolve(null);
    ghostTraceLoad = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'js/ghost-traces.js?v=2';
      script.onload = () => resolve(globalThis.DriveGhostTraces || null);
      script.onerror = () => reject(new Error('Ghost lap data could not load'));
      document.head.appendChild(script);
    }).catch(error => { ghostTraceLoad = null; console.warn(error); return null; });
    return ghostTraceLoad;
  }
  function resetTimedLapToGrid() {
    if (!isRaceCourse()) return;
    resetVehicle();
    canvas.focus?.({preventScroll:true});
  }
  function ghostTimeAtProgress(progress) {
    const frames = ghost.trace.frames;
    let low = 0, high = frames.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (frames[mid][7] < progress) low = mid + 1;
      else high = mid;
    }
    return low * ghost.trace.dt / ghost.rate;
  }
  function startLineDistance(position) {
    const start = activeRoute()[0];
    const offset = activeCourse()?.startOffset ?? (selectedCourse === 'racetrack' ? 1.5 : 0);
    return (position.x - start.x) * start.tx + (position.z - start.z) * start.tz - offset;
  }
  function finishLineDistance(position) {
    const finish = activeRoute().at(-1);
    const offset = activeCourse()?.finishOffset || 0;
    return (position.x - finish.x) * finish.tx + (position.z - finish.z) * finish.tz - offset;
  }
  function finishProgressThreshold(route) {
    const offset = activeCourse()?.finishOffset || 0;
    const window = Math.max(4, Math.abs(offset) + 4);
    let index = route.length - 1, remaining = 0;
    while (index > 0 && remaining < window) {
      const a = route[index - 1], b = route[index];
      remaining += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      index--;
    }
    return index;
  }
  function crossedCourseLine(body, previous, current, gate) {
    if (previous === null || previous >= 0 || current < 0) return false;
    const pos = body.position;
    const lateral = Math.abs(-(pos.x - gate.x) * gate.tz + (pos.z - gate.z) * gate.tx);
    const forward = body.velocity.x * gate.tx + body.velocity.z * gate.tz;
    return lateral < gate.width / 2 && Math.abs(pos.y - gate.y - 1) < 3 && forward > .5;
  }
  function beginTimedLap() {
    ghost.running = true;
    ghost.armed = false;
    ghost.done = false;
    ghost.elapsed = 0;
    ghost.progress = 0;
    ghost.wheelRotation = 0;
    ghost.lastFinishDistance = activeCourse()?.loop === false ? finishLineDistance(physics.body.position) : null;
    personalBest.start(selectedCar);
    personalBest.record(0, physics.body.position, physics.body.quaternion, 0);
    if (ghost.trace && ghost.model) setGhostPose(0);
    ghostUI.time.textContent = '0:00.0';
    ghostUI.gap.textContent = 'EVEN';
    ghostUI.gapRow.hidden = !ghost.trace;
    ghostUI.status.textContent = ghost.trace ? 'Go! Beat the ' + carSpecs[ghost.car].name + ' ghost.' : 'Go! Timed lap started.';
  }
  function finishTimedLap() {
    const {improved, saved} = personalBest.finish(ghost.elapsed);
    ghost.running = false;
    ghost.armed = false;
    ghost.done = true;
    ghostUI.start.textContent = 'RESET TO START';
    ghostUI.best.textContent = personalBest.best ? formatGhostTime(personalBest.best.lapTime) + ' · ' +
      (carSpecs[personalBest.best.car]?.name || personalBest.best.car) : '—';
    const result = improved ? saved ? 'New personal best!' : 'New best for this session.'
      : activeCourse()?.loop === false ? 'Finish reached.' : 'Lap complete.';
    const comparison = ghost.trace ? ' · ' + (ghost.elapsed <= ghost.trace.lapTime / ghost.rate ? 'beat' : 'behind') +
      ' the ghost by ' + Math.abs(ghost.trace.lapTime / ghost.rate - ghost.elapsed).toFixed(1) + 's.' : '';
    ghostUI.status.textContent = formatGhostTime(ghost.elapsed) + ' · ' + result + comparison;
  }
  function updateGhostRun(delta) {
    if (!isRaceCourse() || !delta) return;
    const body = physics.body;
    const route = activeRoute(), count = route.length, loop = activeCourse()?.loop !== false;
    const lineDistance = startLineDistance(body.position);
    const crossed = crossedCourseLine(body, ghost.lastLineDistance, lineDistance, route[0]);
    ghost.lastLineDistance = lineDistance;
    if (!ghost.running) {
      if (ghost.armed && crossed) beginTimedLap();
      return;
    }
    ghost.elapsed += delta;
    if (ghost.trace && ghost.model) setGhostPose(Math.min(ghost.elapsed * ghost.rate, ghost.trace.duration));
    ghostUI.time.textContent = formatGhostTime(ghost.elapsed);
    const pos = body.position;
    const finishDistance = loop ? null : finishLineDistance(pos);
    const crossedFinish = !loop && crossedCourseLine(body, ghost.lastFinishDistance, finishDistance, route[count - 1]);
    ghost.lastFinishDistance = finishDistance;
    let nearest = Infinity, next = ghost.progress;
    const advance = selectedCourse === 'racetrack' ? 12
      : Math.max(3, Math.ceil(body.velocity.length() * delta / 2) + 2);
    const routeHeightWeight = activeCourse()?.routeHeightWeight ?? .3;
    for (let index = Math.max(0, ghost.progress - 2); index <= Math.min(loop ? count : count - 1, ghost.progress + advance); index++) {
      const point = route[loop ? index % count : index];
      const distance = Math.hypot(point.x - pos.x, point.z - pos.z, (point.y + 1 - pos.y) * routeHeightWeight);
      if (distance < nearest) { nearest = distance; next = index; }
    }
    const routeTolerance = selectedCourse === 'racetrack' ? 10
      : Math.max(4, (route[Math.min(next,count-1)].width || 8) / 2 + 2);
    if (nearest < routeTolerance && body.velocity.length() > .5)
      ghost.progress = Math.max(ghost.progress, next);
    const nearbyRoute = route[Math.min(ghost.progress, count - 1)];
    if (body.position.y < (selectedCourse === 'racetrack' ? -2 : nearbyRoute.y - 8)) {
      ghost.running = false;
      ghost.armed = false;
      personalBest.cancel();
      ghostUI.status.textContent = 'Lap ended: fell off the course. Reset to start to retry.';
      return;
    }
    personalBest.record(ghost.elapsed, body.position, body.quaternion, ghost.progress);
    if (ghost.trace) {
      const gap = ghost.elapsed - ghostTimeAtProgress(ghost.progress);
      ghostUI.gap.textContent = Math.abs(gap) < .15 ? 'EVEN' :
        Math.abs(gap).toFixed(1) + 's ' + (gap > 0 ? 'behind' : 'ahead');
    }
    const minFinishProgress = loop ? count - 4 : finishProgressThreshold(route);
    if ((loop ? crossed : crossedFinish) && ghost.progress >= minFinishProgress) {
      ghost.progress = count;
      personalBest.record(ghost.elapsed, body.position, body.quaternion, count);
      finishTimedLap();
    } else if (ghost.trace && !ghost.done && ghost.elapsed >= ghost.trace.lapTime / ghost.rate) {
      ghost.done = true;
      ghostUI.status.textContent = 'Ghost finished in ' + formatGhostTime(ghost.trace.lapTime / ghost.rate) + '. Keep going!';
    }
  }
  function modelStatus(type) {
    if (type === 'u9xtreme') return carModels[type].assetState === 'ready' ? 'Ddiaz Design · CC BY-NC-SA'
      : carModels[type].assetState === 'failed' ? 'U9 Xtreme model unavailable · fallback visual' : 'Loading U9 Xtreme model…';
    return carModels[type].assetState === 'ready' ? 'Comrade1280 · CC BY 4.0 model'
      : carModels[type].assetState === 'failed' ? 'Model unavailable · fallback car' : 'Loading car model…';
  }
  // Load only the selected car. Keep a playable fallback if an asset fails.
  function loadCarAsset(type) {
    const model = carModels[type];
    if (model.assetState) return;
    if (type === 'u9xtreme' ? typeof DriveU9XtremeAsset === 'undefined' : typeof DriveVehicleAssets === 'undefined') {
      model.assetState = 'failed'; return;
    }
    model.assetState = 'loading';
    const onSuccess = imported => {
      const pivots = new Set(model.wheels.map(w => w.pivot));
      const oldGeometry = new Set(), oldMaterials = new Set();
      model.group.traverse(mesh => { if(mesh.geometry) oldGeometry.add(mesh.geometry); if(mesh.material) oldMaterials.add(mesh.material); });
      [...model.group.children].forEach(child => { if(!pivots.has(child)) model.group.remove(child); });
      model.group.add(imported.body);
      model.wheels.forEach((entry,i) => {
        entry.wheel.clear();entry.wheel.add(imported.wheels[i]);
        entry.pivot.position.x=carSpecs[type].wheelLayout[i].x;
        entry.pivot.position.z=carSpecs[type].wheelLayout[i].z;
      });
      oldGeometry.forEach(geometry => geometry.dispose());
      oldMaterials.forEach(material => material.dispose());
      // Illuminate authored lamp faces or surface-fitted overlays, not bounding-box lamps.
      model.rearLamp = imported.rearLamp || new THREE.MeshBasicMaterial({color:0xff354e});
      model.brakeMaterials = imported.brakeMaterials || [];
      model.assetState = 'ready';
      if(selectedCar === type) document.querySelector('#modelStatus').textContent = modelStatus(type);
      if(ghost.car === type && ghost.model && !ghost.model.sharedGeometry) {
        const rotation = ghost.wheelRotation;
        buildGhostModel(type);
        ghost.wheelRotation = rotation;
        setGhostPose(ghost.running && ghost.trace ? Math.min(ghost.elapsed * ghost.rate, ghost.trace.duration) : 0);
      }
    };
    const onFailure = error => {
      model.assetState = 'failed';
      console.warn('Vehicle asset could not load:', type, error);
      if(selectedCar === type) document.querySelector('#modelStatus').textContent = modelStatus(type);
    };
    if (type === 'u9xtreme') DriveU9XtremeAsset.load(carSpecs[type], onSuccess, onFailure);
    else DriveVehicleAssets.load(type, carSpecs[type], onSuccess, onFailure);
  }
  scene.add(vehicleFrame);
  function resetVehicle() {
    if (isRaceCourse()) cancelGhostRun();
    resetOrbit();
    const pointToPoint = isRaceCourse() && activeCourse()?.loop === false;
    const start = pointToPoint ? activeRoute()[0] : null;
    const back = activeCourse()?.spawnBack ?? 8;
    const authoredSpawn = isRaceCourse() && selectedCourse !== 'racetrack'
      ? activeCourse()?.spawn : null;
    const spawnHeading = authoredSpawn?.heading ?? Math.atan2(activeRoute()[0].tx,activeRoute()[0].tz);
    const spawn = authoredSpawn ? {
      point: new THREE.Vector3(authoredSpawn.x,authoredSpawn.y,authoredSpawn.z),
      tangent: new THREE.Vector3(Math.sin(spawnHeading),0,Math.cos(spawnHeading))
    } : pointToPoint ? {
      point: new THREE.Vector3(start.x - start.tx * back, start.y, start.z - start.tz * back),
      tangent: new THREE.Vector3(start.tx, 0, start.tz)
    } : isRaceCourse() ? samples[samples.length - 2] : samples[0];
    if (physics) physics.reset(spawn.point.x,spawn.point.z,Math.atan2(spawn.tangent.x,spawn.tangent.z));
    releaseControls();
    document.querySelectorAll('[data-key]').forEach(button => button.classList.remove('pressed'));
    motion.speed = 0;
    motion.heading = Math.atan2(spawn.tangent.x, spawn.tangent.z);
    vehicle.position.set(spawn.point.x, .03, spawn.point.z);
    vehicle.rotation.set(0,motion.heading,0);
    if (physics) vehicle.position.y = physics.body.position.y - 1.05;
    camera.position.set(vehicle.position.x - Math.sin(motion.heading) * 9,
      vehicle.position.y + 5, displayZ(vehicle.position.z - Math.cos(motion.heading) * 9));
    if (isRaceCourse()) {
      ghost.armed = true;
      ghost.lastLineDistance = startLineDistance(physics.body.position);
      refreshGhostSetup();
    }
  }
  function recoverVehicleInPlace() {
    if (!physics) return;
    const body = physics.body;
    const x = body.position.x, z = body.position.z, previousY = body.position.y;
    const assist = physics.getAssistState?.();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(body.quaternion);
    const heading = Math.hypot(forward.x, forward.z) > .12
      ? Math.atan2(forward.x, forward.z) : motion.heading;
    resetOrbit();
    releaseControls();
    physics.reset(x, z, heading);
    // Preserve an elevated deck or an airborne recovery instead of dropping
    // the car to the terrain underneath its current position.
    body.position.y = Math.max(body.position.y, previousY + .45);
    physics.restoreAssistState?.(assist);
    physics.syncRenderState();
    motion.speed = 0;
    motion.heading = heading;
    updateVehicle(0);
    camera.position.set(vehicle.position.x - Math.sin(heading) * 9,
      vehicle.position.y + 5, displayZ(vehicle.position.z - Math.cos(heading) * 9));
  }
  function jumpToStop(stop) {
    if (selectedMap !== 'city' || !physics) return;
    releaseControls();
    const destination=city;
    const travel=()=>{
      if(selectedMap !== 'city' || city !== destination || !physics)return;
      resetOrbit();
      const heading = Number.isFinite(stop.heading) ? stop.heading : 0;
      physics.reset(stop.x, stop.z, heading);
      motion.speed = 0;
      motion.heading = heading;
      updateVehicle(0);
      camera.position.set(vehicle.position.x - Math.sin(heading) * 9,
        vehicle.position.y + 5, displayZ(vehicle.position.z - Math.cos(heading) * 9));
    };
    if(typeof city.ensureNear==='function') {
      // Move first so both the visual streamer and physics request the target district.
      // Reset again after its road slabs arrive to use the source street elevation.
      travel();
      Promise.resolve(city.ensureNear(stop.x,stop.z,Math.max(240,city.tileSize*1.2))).then(travel).catch(error=>{
        document.querySelector('#surfaceValue').textContent='Could not load that district';
        console.warn('City stop could not load:',error);
      });
    } else travel();
  }
  function addFinishMarker(force = false) {
    if (!isRaceCourse() || activeCourse()?.loop !== false ||
      (activeCourse()?.nativeFinish && !force)) return;
    const finish = activeRoute().at(-1);
    if (!finish) return;
    const width = Math.max(3, Math.min(24, finish.width || 8));
    const columns = Math.max(4, Math.ceil(width / .8));
    const tileWidth = width / columns;
    const gate = new THREE.Group();
    gate.name = 'course-finish-gate';
    const offset = activeCourse()?.finishOffset || 0;
    gate.position.set(finish.x + finish.tx * offset, finish.y, finish.z + finish.tz * offset);
    gate.rotation.y = Math.atan2(finish.tx, finish.tz);
    const light = new THREE.MeshBasicMaterial({color: 0xf5f5ed, side: THREE.DoubleSide});
    const dark = new THREE.MeshBasicMaterial({color: 0x16212c, side: THREE.DoubleSide});
    for (let row = 0; row < 2; row++) for (let col = 0; col < columns; col++) {
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(tileWidth, .65), (row + col) % 2 ? dark : light);
      tile.rotation.x = -Math.PI / 2;
      tile.position.set((col + .5 - columns / 2) * tileWidth, .08, (row - .5) * .65);
      gate.add(tile);
    }
    const postMaterial = new THREE.MeshStandardMaterial({color: 0xffd35a, roughness: .55});
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 3.2, 8), postMaterial);
      post.position.set(side * (width / 2 + .25), 1.6, 0);
      gate.add(post);
    }
    for (let col = 0; col < columns; col++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(tileWidth, .3, .3), col % 2 ? dark : light);
      block.position.set((col + .5 - columns / 2) * tileWidth, 3.2, 0);
      gate.add(block);
    }
    world.add(gate);
  }
  function chooseMap(type) {
    if (!maps[type]) return;
    cancelGhostRun();
    selectedMap = type;
    document.body?.classList?.toggle('racetrack-mode', isRaceCourse());
    coursePicker.hidden = !isRaceCourse();
    courseSelect.value = selectedCourse;
    buildWorld();
    addFinishMarker();
    document.querySelector('.garage').style.display = '';
    resetVehicle();
    document.querySelector('#mapDescription').textContent = isRaceCourse()
      ? activeCourse()?.caption || raceCourses[selectedCourse].caption : maps[type].caption;
    document.querySelector('#resetButton').textContent = '↺ BACK TO ROAD';
    chooseCar(selectedCar);
    document.querySelector('#mapSelect').value = type;
    refreshGhostSetup();
    if (isRaceCourse() && selectedCourse === 'racetrack') loadGhostTraces().then(traces => {
      if (!isRaceCourse() || selectedCourse !== 'racetrack') return;
      refreshGhostSetup();
      if (!traces && ghostUI.enabled.checked && ghostUI.source.value === 'course')
        ghostUI.status.textContent = 'Course ghost unavailable. Timed laps still work.';
    });
  }
  function chooseCourse(courseId) {
    if (!raceCourses[courseId]) return;
    if (courseId !== selectedCourse) {
      cancelGhostRun();
      selectedCourse = courseId;
      personalBest = bestForCourse(courseId);
    }
    chooseMap('racetrack');
  }
  chooseMap('city');

  function chooseCar(type) {
    if (!carModels[type]) return;
    const changed = type !== selectedCar;
    if (changed) cancelGhostRun('Car changed. Start a new ghost run when ready.');
    if (type !== selectedCar && physics) {
      const assist=physics.getAssistState?.();
      const previous=physics.body;
      selectedCar=type;
      buildWorld();
      addFinishMarker();
      // Keep location and orientation, but stop safely when swapping vehicle mass/size.
      physics.body.position.copy(previous.position);
      physics.body.position.y+=.2;
      physics.body.quaternion.copy(previous.quaternion);
      physics.restoreAssistState?.(assist);
      physics.syncRenderState();
      releaseControls();motion.speed=0;
      document.querySelectorAll('[data-key]').forEach(button=>button.classList.remove('pressed'));
    }
    selectedCar = type;
    loadCarAsset(type);
    document.querySelector('#modelStatus').textContent = modelStatus(type);
    Object.entries(carModels).forEach(([name, model]) => { model.group.visible = name === type; });
    motion.speed = THREE.MathUtils.clamp(motion.speed, -carSpecs[type].maxSpeed * .45, carSpecs[type].maxSpeed);
    document.querySelectorAll('[data-car]').forEach(button => {
      button.classList.toggle('active', button.dataset.car === type);
      button.setAttribute('aria-pressed', String(button.dataset.car === type));
    });
    document.querySelector('#topSpeedValue').textContent = Math.round(carSpecs[type].maxSpeed * 2.236936) + ' mph target top speed'
      + (carSpecs[type].powerPS ? ' · ' + carSpecs[type].powerPS.toLocaleString('en-US') + ' PS' : '');
    if (changed && isRaceCourse()) {
      ghost.armed = true;
      ghost.lastLineDistance = startLineDistance(physics.body.position);
      refreshGhostSetup();
    }
  }
  chooseCar('comet');

  if (window.DrivePortfolioUI?.create) {
    portfolio = window.DrivePortfolioUI.create({
      document, window, city, driveTarget:canvas, onJump:jumpToStop,
      onOpen() {
        releaseControls();
        if (physics) { physics.body.velocity.setZero(); physics.body.angularVelocity.setZero(); physics.syncRenderState(); }
      }
    });
    portfolio.setMap(selectedMap);
    portfolio.update(physics.body.position, 0, motion.heading);
  }

  if (window.DriveImportedCity?.load) {
    Promise.resolve().then(() => window.DriveImportedCity.load()).then(imported => {
      if (!imported || !Number.isFinite(imported.edge) || !imported.routeSamples?.length || !imported.stops?.length || typeof imported.build !== 'function')
        throw new Error('Imported city data is incomplete');
      const fallback=city;
      city=imported;
      try {
        portfolio?.setCity(city);
        if (selectedMap === 'city') chooseMap('city');
      } catch (error) {
        city=fallback;
        portfolio?.setCity(city);
        if (selectedMap === 'city') chooseMap('city');
        throw error;
      }
    }).catch(error => console.warn('Imported city unavailable; using the built-in district:', error));
  }

  function setCameraMode() {
    resetOrbit();
    cameraMode = (cameraMode + 1) % cameraModes.length;
    document.querySelector('#cameraButton').textContent = 'CAMERA / ' + cameraModes[cameraMode];
  }
  function returnToDrivingAfterPointer(event) {
    if (event?.detail > 0 && !portfolio?.isOpen()) canvas.focus?.({preventScroll:true});
  }
  document.querySelector('#cameraButton').addEventListener('click', event => { setCameraMode(); returnToDrivingAfterPointer(event); });
  document.querySelectorAll('[data-car]').forEach(button => button.addEventListener('click', event => { chooseCar(button.dataset.car); returnToDrivingAfterPointer(event); }));

  document.querySelector('#mapSelect').addEventListener('change', event => {
    chooseMap(event.target.value);
    // A committed native selection otherwise keeps swallowing WASD/arrows.
    // Leave native navigation alone while the selector is being used.
    event.target.blur();
    canvas.focus?.({preventScroll:true});
  });
  courseSelect.addEventListener('change', event => {
    chooseCourse(event.target.value);
    event.target.blur();
    canvas.focus?.({preventScroll:true});
  });
  document.querySelector('#resetButton').addEventListener('click', event => { resetVehicle(); returnToDrivingAfterPointer(event); });
  function commitGhostSetting(event) {
    cancelGhostRun();
    if (isRaceCourse()) {
      ghost.armed = true;
      ghost.lastLineDistance = startLineDistance(physics.body.position);
    }
    refreshGhostSetup();
    // Keep native select navigation while it is open; return to driving after the change.
    event?.target?.blur?.();
    canvas.focus?.({preventScroll:true});
  }
  ghostUI.enabled.addEventListener('change', commitGhostSetting);
  ghostUI.source.addEventListener('change', commitGhostSetting);
  ghostUI.car.addEventListener('change', commitGhostSetting);
  ghostUI.pace.addEventListener('change', commitGhostSetting);
  ghostUI.start.addEventListener('click', resetTimedLapToGrid);

  const drivingKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' ']);
  function syncInputKey(key) {
    if (keyboardKeys.has(key) || [...touchPointers.values()].some(input => input.key === key)) keys.add(key);
    else keys.delete(key);
  }
  window.addEventListener('keydown', event => {
    if (event.target.matches('select, input, textarea') || (event.target.matches('button') && [' ', 'Enter'].includes(event.key))) return;
    const key = event.key.toLowerCase();
    if (drivingKeys.has(key)) { event.preventDefault(); keyboardKeys.add(key); syncInputKey(key); }
    if (!event.repeat && ['1', '2', '3', '4'].includes(key)) chooseCar(['comet', 'rally', 'pickup', 'hypercar'][Number(key) - 1]);
    if (!event.repeat && key === '6') chooseCar('u9xtreme');
    if (!event.repeat && key === 'c') setCameraMode();
    if (!event.repeat && key === 'r') resetVehicle();
    if (!event.repeat && key === 'f') recoverVehicleInPlace();
  });
  window.addEventListener('keyup', event => {
    const key = event.key.toLowerCase(); keyboardKeys.delete(key); syncInputKey(key);
  });
  function releaseControls() {
    orbit.pointer = null;
    keyboardKeys.clear(); touchPointers.clear(); keys.clear();
    document.querySelectorAll('[data-key]').forEach(button => button.classList.remove('pressed'));
  }
  window.addEventListener('blur', () => { driveFocused = false; releaseControls(); });
  window.addEventListener('focus', () => { driveFocused = true; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseControls(); });
  const preventSelection = event => event.preventDefault();
  document.querySelectorAll('[data-key]').forEach(button => {
    const key = button.dataset.key;
    button.addEventListener('contextmenu', preventSelection);
    button.addEventListener('selectstart', preventSelection);
    button.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault(); button.setPointerCapture(event.pointerId);
      touchPointers.set(event.pointerId, {key, button}); syncInputKey(key);
      button.classList.add('pressed');
    });
    const release = event => {
      if (touchPointers.get(event.pointerId)?.button !== button) return;
      touchPointers.delete(event.pointerId); syncInputKey(key);
      button.classList.toggle('pressed', [...touchPointers.values()].some(input => input.button === button));
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });

  // One scene pointer controls look; other fingers can keep driving independently.
  canvas.addEventListener('contextmenu', preventSelection);
  canvas.addEventListener('selectstart', preventSelection);
  canvas.addEventListener('pointerdown', event => {
    if ((event.pointerType !== 'mouse' && event.pointerType !== 'touch') || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    if (orbit.pointer !== null) return;
    orbit.pointer = event.pointerId; orbit.x = event.clientX; orbit.y = event.clientY; orbit.idle = 0;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (orbit.pointer !== event.pointerId) return;
    event.preventDefault();
    orbit.yaw -= (event.clientX - orbit.x) * .006;
    orbit.yaw = Math.atan2(Math.sin(orbit.yaw), Math.cos(orbit.yaw));
    orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + (event.clientY - orbit.y) * .005, -.4, .8);
    orbit.x = event.clientX; orbit.y = event.clientY; orbit.idle = 0;
  });
  const endOrbit = event => { if (orbit.pointer === event.pointerId) { orbit.pointer = null; orbit.idle = 0; } };
  canvas.addEventListener('pointerup', endOrbit);
  canvas.addEventListener('pointercancel', endOrbit);
  canvas.addEventListener('lostpointercapture', endOrbit);

  function resize() {
    const width = canvas.clientWidth || window.innerWidth, height = canvas.clientHeight || window.innerHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.DriveMobileUI?.setup({document, window, canvas, controls:document.querySelectorAll('[data-key]'), releaseControls, resize});
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);

  function updateVehicle(delta) {
    const spec = carSpecs[selectedCar];
    const throttle = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
    const steering = (Number(keys.has('a') || keys.has('arrowleft')) -
      Number(keys.has('d') || keys.has('arrowright'))) * (mirroredCityView() ? -1 : 1);
    if (physics) {
      const state=physics.step(delta,{throttle,steer:steering,brake:keys.has(' ')});
      motion.speed=state.speed;
      vehicle.quaternion.copy(physics.renderQuaternion);
      const offset=new THREE.Vector3(0,-1.05,0).applyQuaternion(vehicle.quaternion);
      vehicle.position.copy(physics.renderPosition).add(offset);
      const forward=new THREE.Vector3(0,0,1).applyQuaternion(vehicle.quaternion);
      if (Math.hypot(forward.x,forward.z)>.15) motion.heading=Math.atan2(forward.x,forward.z);
      carModels[selectedCar].wheels.forEach(({wheel,pivot},i)=>{
        const w=physics.renderWheels[i];
        pivot.position.y=1.05+physics.car.wheelInfos[i].chassisConnectionPointLocal.y-w.suspensionLength;
        // CANNON's Y-up wheel angle decreases while the car moves along +Z.
        pivot.rotation.y=w.steering;wheel.rotation.x=-w.rotation;
      });
      const braking=keys.has(' ')||throttle<0, model=carModels[selectedCar];
      if(model.brakeMaterials?.length) model.brakeMaterials.forEach(material => {material.emissiveIntensity=braking?1.5:.22;});
      else model.rearLamp.color.setHex(braking?0xff8090:0xff354e);
      document.querySelector('#speedValue').textContent=String(Math.round(physics.body.velocity.length()*2.236936));
      const up=new THREE.Vector3(0,1,0).applyQuaternion(vehicle.quaternion);
      const importedLowRoad = isRaceCourse() && selectedCourse !== 'racetrack'
        ? Math.min(...activeRoute().map(point => point.y)) : null;
      const courseFallHeight = isRaceCourse()
        ? selectedCourse === 'racetrack' ? -2 : importedLowRoad - 8 : -Infinity;
      document.querySelector('#surfaceValue').textContent=isRaceCourse()&&physics.body.position.y<courseFallHeight
        ?'Fell off course · Press R / Reset':state.guided?'ANTI-GRAVITY · FOLLOWING TRACK'
        :state.gliding?'GLIDING TO NEXT ROAD':up.y<.1?'Overturned? Press F / flip in place'
        :state.grounded?state.grounded+' wheels grounded':'AIRBORNE · ↑↓ pitch / ←→ roll';
      const fallLimit=selectedMap==='city' && city.terrain
        ? physics.terrainHeight(physics.body.position.x,physics.body.position.z)-30
        : importedLowRoad !== null ? importedLowRoad - 30 : -30;
      if(physics.body.position.y < fallLimit) resetVehicle();
      return;
    }

  }

  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();
  function updateCamera(delta) {
    if (orbit.pointer === null) orbit.idle += delta;
    else orbit.idle = 0;
    if (orbit.idle > 4) {
      const decay = Math.exp(-3 * delta);
      orbit.yaw *= decay; orbit.pitch *= decay;
    }
    const lookHeading = motion.heading + orbit.yaw;
    if (cameraMode === 2) {
      const hoodOffset = carSpecs[selectedCar].length * .4;
      const eyeHeight = selectedCar === 'comet' || selectedCar === 'hypercar' || selectedCar === 'u9xtreme' ? 1.9 : 2.3;
      desired.set(0,eyeHeight,hoodOffset).applyQuaternion(vehicle.quaternion).add(vehicle.position);
      target.set(Math.sin(orbit.yaw)*22,eyeHeight-Math.sin(orbit.pitch)*22,Math.cos(orbit.yaw)*22).applyQuaternion(vehicle.quaternion).add(vehicle.position);
    } else {
      const distance = cameraMode === 1 ? 16 : 7.8;
      const height = cameraMode === 1 ? 8 : 4.3;
      const elevation = THREE.MathUtils.clamp(Math.atan2(height - 1.2, distance) + orbit.pitch, .08, 1.25);
      const radius = Math.hypot(distance, height - 1.2);
      desired.set(-Math.sin(lookHeading) * radius * Math.cos(elevation), 1.2 + Math.sin(elevation) * radius, -Math.cos(lookHeading) * radius * Math.cos(elevation)).add(vehicle.position);
      // Aim at the car body, not a point four metres ahead of it.
      target.set(0, 1.2, 0).add(vehicle.position);
    }
    desired.z = displayZ(desired.z);
    target.z = displayZ(target.z);
    if (cameraMode === 2) camera.position.copy(desired);
    else camera.position.lerp(desired, 1 - Math.exp(-5 * delta));
    if (physics) camera.position.y=Math.max(camera.position.y,
      physics.terrainHeight(camera.position.x,displayZ(camera.position.z))+1.5);
    camera.lookAt(target);
    // Keep the enclosing sky centered on the camera and within its far plane.
    sky.position.copy(camera.position);
  }

  let firstFrame = true;
  function animate() {
    const delta = Math.min(clock.getDelta(), .05);
    const driveDelta = document.hidden || !driveFocused || portfolio?.isOpen() ? 0 : delta;
    updateVehicle(driveDelta);
    updateGhostRun(driveDelta);
    updateCamera(delta);
    cityVisual?.update?.(mirroredCityView()
      ? {position:{x:camera.position.x,y:camera.position.y,z:-camera.position.z}} : camera, delta);
    portfolio?.update(physics.body.position, motion.speed, motion.heading);
    renderer.render(scene, camera);
    if (firstFrame) { message.classList.add('done'); firstFrame = false; }
    requestAnimationFrame(animate);
  }
  resize();
  camera.position.set(vehicle.position.x - 8, 5, displayZ(vehicle.position.z - 8));
  animate();
})();
