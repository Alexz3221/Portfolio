(() => {
  'use strict';
  const message = document.querySelector('#loadMessage');
  if (!window.THREE || typeof DrivePhysics === 'undefined') { message.textContent = 'Could not load the driving engine. Try reloading.'; return; }

  const canvas = document.querySelector('#drive-scene');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(66, 1, 0.3, 600);
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  const clock = new THREE.Clock();
  const keys = new Set();
  const keyboardKeys = new Set(), touchPointers = new Map();
  const vehicle = new THREE.Group();
  const motion = {speed: 0, heading: 0};
  // Geometry and simulation share dimensions derived from the selected source cars.
  const carSpecs = Object.fromEntries(Object.entries({
    comet: {name:'Comet',color:0x4e83df},
    rally: {name:'Rally',color:0xe3d57b},
    hypercar: {name:'Hypercar',color:0xe14839},
    pickup: {name:'Pickup',color:0x25975b}
  }).map(([type,style]) => [type,{...DrivePhysics.vehicles[type],...style,wheelRadius:DrivePhysics.vehicles[type].radius}]));
  const maps = {
    mountain: {name: 'Cliffside mountain', caption: 'Narrow ledge · sheer drops · winding ascent', ground: 0x817969, fog: 0x9caeae, skyLow: 0xcbd8d2, skyHigh: 0x416b92, mountain: 0x83908b, seed: 93217,
      roadHalfWidth: 3.5, shoulderWidth: .5, points: DrivePhysics.mountainPoints},
    racetrack: {name: 'Racetrack / obstacle course', caption: 'Long circuit · slalom blocks · jump crests', ground: 0x47634a, fog: 0x9dbac7, skyLow: 0xd3e4e7, skyHigh: 0x386e9d, mountain: 0x7f9290, seed: 59221,
      points: [[-164,-138],[-164,-65],[-164,35],[-150,135],[-65,163],[50,163],[145,135],[163,55],[155,-65],[120,-145],[65,-150],[48,-90],[55,0],[35,70],[-25,80],[-55,30],[-48,-55],[-65,-125],[-110,-156]]},
    lakeside: {name: 'Lakeside loop', caption: 'Twilight · rolling shoreline bends', ground: 0x1b2b2d, fog: 0x172633, skyLow: 0x50434f, skyHigh: 0x041020, mountain: 0x33434a, seed: 28473,
      points: [[-58,-49],[-17,-83],[40,-72],[87,-42],[104,-5],[76,34],[70,68],[22,91],[-51,70],[-93,28],[-91,-12]]},
    desert: {name: 'Desert highway', caption: 'Golden hour · sweeping dune crests', ground: 0xa27449, fog: 0xc09a78, skyLow: 0xe8b47a, skyHigh: 0x486d8b, mountain: 0x8e5940, seed: 73452,
      points: [[-145,-95],[-60,-115],[50,-99],[105,-122],[158,-65],[139,5],[155,75],[70,115],[-20,90],[-105,110],[-155,55]]},
    alpine: {name: 'Alpine pass', caption: 'Blue hour · climbing hairpins', ground: 0x3d5554, fog: 0x698994, skyLow: 0x95b9c1, skyHigh: 0x17314f, mountain: 0xa1b2b1, seed: 19482,
      points: [[-120,-100],[-62,-128],[-12,-105],[42,-136],[90,-115],[130,-65],[35,-35],[125,25],[95,100],[10,130],[-110,100],[-140,45],[-45,15],[-125,-35]]}
  };
  let physics = null;
  const world = new THREE.Group();
  scene.add(world);
  let selectedMap = 'lakeside';
  let samples = [];
  const carModels = {};
  let selectedCar = 'comet';
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

  const sky = new THREE.Mesh(new THREE.SphereGeometry(490, 32, 20), new THREE.ShaderMaterial({
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

  scene.add(new THREE.HemisphereLight(0xb1d9e4, 0x273139, .9));
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
    let nearest = Infinity;
    for (let index = 0; index < samples.length; index += 1) {
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
      if (kind === 'ground' && selectedMap === 'desert') shade = 165 + 45 * Math.sin(y * Math.PI / 8 + 2 * Math.sin(x * Math.PI / 64)) + grain * 40;
      if (kind === 'ground' && selectedMap === 'alpine') shade = grain > .78 ? 245 : 125 + grain * 90 + broad * 25;
      if (kind === 'ground' && selectedMap === 'lakeside') shade = 105 + grain * 100 + broad * 35;
      if (kind === 'rock') shade = 145 + grain * 65 + 35 * Math.sin(y * Math.PI / 8 + Math.sin(x * Math.PI / 16));
      if (kind === 'bark') shade = 125 + grain * 55 + 60 * Math.sin(x * Math.PI / 8);
      if (kind === 'water') shade = 190 + 35 * Math.sin(y * Math.PI / 4 + Math.sin(x * Math.PI / 16)) + grain * 20;
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
    // Dispose shared resources once when changing maps, never accumulate old scenery.
    const geometries = new Set(), materials = new Set(), textures = new Set();
    world.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) { materials.add(object.material); for (const value of Object.values(object.material)) if (value?.isTexture) textures.add(value); }
    });
    world.clear();
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    physics = DrivePhysics.create({map:selectedMap, car:selectedCar, distanceToRoad, roadHalfWidth:maps[selectedMap].roadHalfWidth || 6.2});
    const config = maps[selectedMap];
    scene.fog.color.setHex(config.fog);
    scene.background = new THREE.Color(config.fog);
    sky.material.uniforms.low.value.setHex(config.skyLow);
    sky.material.uniforms.high.value.setHex(config.skyHigh);
    renderer.toneMappingExposure = selectedMap === 'desert' ? 1.05 : .9;
    const groundDetail = surfaceTexture(selectedMap === 'mountain' ? 'rock' : 'ground', physics.edge / 4);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(physics.edge * 2, physics.edge * 2, physics.edge, physics.edge), new THREE.MeshStandardMaterial({color: config.ground, roughness: 1, map: groundDetail, bumpMap: groundDetail, bumpScale: selectedMap === 'desert' ? .22 : .12}));
    {
      const pos = ground.geometry.attributes.position;
      for (let i=0;i<pos.count;i++) pos.setZ(i, physics.terrainHeight(pos.getX(i), -pos.getY(i)));
      ground.geometry.computeVertexNormals();
    }
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.name = 'terrain';
    ground.receiveShadow = true;
    world.add(ground);
    const waterDetail = surfaceTexture('water', 12);
    const lake = new THREE.Mesh(new THREE.CircleGeometry(37, 64), new THREE.MeshStandardMaterial({color: 0x0e2633, metalness: .55, roughness: .27, bumpMap: waterDetail, bumpScale: .12}));
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(8, .01, 4);
    if (selectedMap === 'lakeside') world.add(lake);
    else { lake.geometry.dispose(); lake.material.dispose(); waterDetail.dispose(); }

    const path = new THREE.CatmullRomCurve3(config.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    samples = Array.from({length: 480}, (_, index) => ({
      point: path.getPointAt(index / 480), tangent: path.getTangentAt(index / 480).normalize()
    }));

    samples.forEach(sample => { sample.point.y = physics.terrainHeight(sample.point.x, sample.point.z); });

    // Keep long-course triangles short enough to clear its jump crests.
    const ribbonSamples = selectedMap === 'racetrack' ? Array.from({length:960},(_,i)=>({point:path.getPointAt(i/960),tangent:path.getTangentAt(i/960).normalize()})) : samples;
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

    // Solid slalom blocks share their exact dimensions with the physics world.
    if (selectedMap === 'racetrack') [205,225,245,310,330,345].forEach((index,i) => {
      const sample=samples[index];
      const side=i%2?3.7:-3.7;
      physics.addObstacle(sample.point.x-sample.tangent.z*side,sample.point.z+sample.tangent.x*side);
    });
    physics.obstacles.forEach(obstacle => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(obstacle.hx*2, obstacle.hy*2, obstacle.hz*2), new THREE.MeshStandardMaterial({color:0xef7845,roughness:.85}));
      mesh.name = 'solid-obstacle';
      mesh.position.set(obstacle.x,obstacle.y,obstacle.z);
      mesh.castShadow = true; mesh.receiveShadow = true; world.add(mesh);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(obstacle.hx*2+.02,.22,obstacle.hz*2+.02),new THREE.MeshBasicMaterial({color:0xfff5d5}));
      stripe.position.copy(mesh.position); stripe.position.y += .25; world.add(stripe);
    });
    if (selectedMap === 'racetrack') {
      // Terrain-conforming paint, not horizontal tiles cutting into curved hills.
      // Per-vertex colors batch each marking in one draw call without UV seams.
      function paintedQuads(name, quads) {
        const positions=[], colors=[];
        for (const {points,color} of quads) {
          const c=new THREE.Color(color);
          for (const index of [0,1,2,1,3,2]) {
            const p=points[index];
            positions.push(p.x,physics.terrainHeight(p.x,p.z)+.16,p.z);
            colors.push(c.r,c.g,c.b);
          }
        }
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
        const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));
        mesh.name=name;world.add(mesh);
      }
      const kerbs=[];
      for(let i=0;i<samples.length;i++) {
        const a=samples[i],b=samples[(i+1)%samples.length];
        for(const side of [-1,1]) {
          const points=[];
          for(const sample of [a,b]) for(const offset of [6.2,6.9]) {
            points.push(sample.point.clone().addScaledVector(new THREE.Vector3(-sample.tangent.z,0,sample.tangent.x),side*offset));
          }
          kerbs.push({points,color:Math.floor(i/2)%2?0xf4eee2:0xcc433a});
        }
      }
      paintedQuads('circuit-kerbs',kerbs);
      const start=samples[0],right=new THREE.Vector3(-start.tangent.z,0,start.tangent.x),tiles=[];
      for(let row=0;row<2;row++) for(let col=0;col<12;col++) {
        const points=[];
        for(const along of [row-1,row]) for(const across of [col-6,col-5])
          points.push(start.point.clone().addScaledVector(right,across).addScaledVector(start.tangent,along));
        tiles.push({points,color:(row+col)%2?0x161c23:0xffffff});
      }
      paintedQuads('circuit-start-line',tiles);
    }

    const rand = (() => { let seed = config.seed; return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); })();
    const barkDetail = surfaceTexture('bark', 2);
    const bark = new THREE.MeshStandardMaterial({color: 0x68513d, roughness: 1, map: barkDetail, bumpMap: barkDetail, bumpScale: .08});
    const pine = [
      new THREE.MeshStandardMaterial({color: 0x24464b, roughness: 1, flatShading: true}),
      new THREE.MeshStandardMaterial({color: 0x365a57, roughness: 1, flatShading: true}),
      new THREE.MeshStandardMaterial({color: 0x1e3b41, roughness: 1, flatShading: true})
    ];
    const trunkGeometry = new THREE.CylinderGeometry(.18, .24, 1.8, 5);
    const canopyGeometry = selectedMap === 'desert' ? new THREE.CylinderGeometry(.45, .55, 5, 7) : new THREE.ConeGeometry(2.1, 7, 6);
    for (let index = 0; index < (selectedMap === 'desert' ? 55 : 145); index += 1) {
      const x = (rand() - .5) * 360;
      const z = (rand() - .5) * 360;
      if (distanceToRoad(x, z) < 12 || Math.hypot(x - 8, z - 4) < 42) continue;
      const height = 1.2 + rand() * 1.3;
      const trunk = new THREE.Mesh(trunkGeometry, bark);
      trunk.position.set(x, physics.terrainHeight(x,z) + .8 * height, z);
      trunk.scale.set(height, height, height);
      trunk.castShadow = true;
      world.add(trunk);
      const top = new THREE.Mesh(canopyGeometry, pine[index % pine.length]);
      top.position.set(x, physics.terrainHeight(x,z) + (selectedMap === 'desert' ? 4.2 : 4.3) * height, z);
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
      new THREE.MeshStandardMaterial({color: selectedMap === 'desert' ? 0xcfa678 : selectedMap === 'alpine' ? 0xbac8bf : 0x749365, roughness: 1}), 360);
    detail.name = 'roadside-detail';
    const dummy = new THREE.Object3D();
    let count = 0;
    for (let i = 0; i < 720 && count < 360; i++) {
      const sample = samples[Math.floor(rand() * samples.length)];
      const normal = new THREE.Vector3(-sample.tangent.z, 0, sample.tangent.x);
      const side = rand() < .5 ? -1 : 1;
      dummy.position.copy(sample.point).addScaledVector(normal, side * (9 + rand() * 19));
      if (distanceToRoad(dummy.position.x, dummy.position.z) < 8 || (selectedMap === 'lakeside' && Math.hypot(dummy.position.x - 8, dummy.position.z - 4) < 38)) continue;
      const size = .1 + rand() * .45;
      dummy.position.y = physics.terrainHeight(dummy.position.x,dummy.position.z) + size * .2;
      dummy.scale.set(size, selectedMap === 'lakeside' ? size * 2 : size * .5, size);
      dummy.rotation.set(rand(), rand() * Math.PI, 0);
      dummy.updateMatrix(); detail.setMatrixAt(count++, dummy.matrix);
    }
    detail.count = count; detail.receiveShadow = true; world.add(detail);

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
    addGate(15, 0xa9f2e9);
    addGate(156, 0xffc286);
    addGate(316, 0x89bdff);

    const windowDetail = surfaceTexture('windows', 2);
    const townMaterials = [
      new THREE.MeshStandardMaterial({color: 0x6c8389, roughness: .8, map: windowDetail}),
      new THREE.MeshStandardMaterial({color: 0x8b8f91, roughness: .8, map: windowDetail})
    ];
    if (selectedMap !== 'lakeside') { windowDetail.dispose(); townMaterials.forEach(material => material.dispose()); }
    for (let index = 0; index < (selectedMap === 'lakeside' ? 14 : 0); index += 1) {
      const x = (rand() - .5) * 44 + 8;
      const z = (rand() - .5) * 36 + 4;
      const width = 4 + rand() * 5;
      const height = 5 + rand() * 20;
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), townMaterials[index % 2]);
      building.position.set(x, height / 2, z);
      building.castShadow = true;
      building.receiveShadow = true;
      world.add(building);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(width + .4, .2, width + .4), new THREE.MeshBasicMaterial({color: index % 3 ? 0x9bcac5 : 0xffb57d}));
      roof.position.set(x, height + .1, z);
      world.add(roof);
    }

  }


  function part(group, geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function buildCar(type, spec) {
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
    if ((type === 'comet' || type === 'hypercar')) {
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
      const cabinTop = (type === 'comet' || type === 'hypercar') ? 1.97 : 2.27;
      const pillarX = spec.width * ((type === 'comet' || type === 'hypercar') ? .36 : .425);
      [-.78, .65].forEach(z => part(group, new THREE.BoxGeometry(.1, cabinTop - 1.35, .12), paint, side * pillarX, (cabinTop + 1.35) / 2, cabinZ + z));
      part(group, new THREE.BoxGeometry(.36, .18, .32), paint, side * (spec.width / 2 + .18), 1.64, .65);
      part(group, new THREE.BoxGeometry(.3, .11, .03), chrome, side * (spec.width / 2 + .18), 1.65, .48);
      part(group, new THREE.BoxGeometry(.04, .06, .3), chrome, side * (spec.width / 2 + .02), 1.24, -.2);
      part(group, new THREE.BoxGeometry(.08, .14, spec.length * .65), trim, side * (spec.width / 2 + .04), .77, 0);
      const exhaust = part(group, new THREE.CylinderGeometry(.09, .09, .3, 12), chrome, side * .7, .7, -front);
      exhaust.rotation.x = Math.PI / 2;
    });
    if ((type === 'comet' || type === 'hypercar')) {
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
    vehicle.add(group);
    return {group, wheels, rearLamp};
  }

  Object.entries(carSpecs).forEach(([type, spec]) => { carModels[type] = buildCar(type, spec); });
  // Load only the selected car. Keep a playable fallback if an asset fails.
  function loadCarAsset(type) {
    const model = carModels[type];
    if (model.assetState) return;
    if (typeof DriveVehicleAssets === 'undefined') { model.assetState = 'failed'; return; }
    model.assetState = 'loading';
    DriveVehicleAssets.load(type, carSpecs[type], imported => {
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
      if(selectedCar === type) document.querySelector('#modelStatus').textContent = 'Comrade1280 · CC BY 4.0 model';
    }, error => {
      model.assetState = 'failed';
      console.warn('Vehicle asset could not load:', type, error);
      if(selectedCar === type) document.querySelector('#modelStatus').textContent = 'Model unavailable · fallback car';
    });
  }
  scene.add(vehicle);
  function resetVehicle() {
    resetOrbit();
    const spawn = samples[0];
    if (physics) physics.reset(spawn.point.x,spawn.point.z,Math.atan2(spawn.tangent.x,spawn.tangent.z));
    releaseControls();
    document.querySelectorAll('[data-key]').forEach(button => button.classList.remove('pressed'));
    motion.speed = 0;
    motion.heading = Math.atan2(spawn.tangent.x, spawn.tangent.z);
    vehicle.position.set(spawn.point.x, .03, spawn.point.z);
    vehicle.rotation.set(0,motion.heading,0);
    if (physics) vehicle.position.y = physics.body.position.y - 1.05;
    camera.position.set(vehicle.position.x - Math.sin(motion.heading) * 9, vehicle.position.y + 5, vehicle.position.z - Math.cos(motion.heading) * 9);
  }
  function chooseMap(type) {
    if (!maps[type]) return;
    selectedMap = type;
    buildWorld();
    document.querySelector('.garage').style.display = '';
    resetVehicle();
    document.querySelector('#mapDescription').textContent = maps[type].caption;
    document.querySelector('#resetButton').textContent = '↺ BACK TO ROAD';
    chooseCar(selectedCar);
    document.querySelector('#mapSelect').value = type;
  }
  chooseMap('mountain');

  function chooseCar(type) {
    if (!carModels[type]) return;
    if (type !== selectedCar && physics) {
      const previous=physics.body;
      selectedCar=type;
      buildWorld();
      // Keep location and orientation, but stop safely when swapping vehicle mass/size.
      physics.body.position.copy(previous.position);
      physics.body.position.y+=.2;
      physics.body.quaternion.copy(previous.quaternion);
      physics.syncRenderState();
      releaseControls();motion.speed=0;
      document.querySelectorAll('[data-key]').forEach(button=>button.classList.remove('pressed'));
    }
    selectedCar = type;
    loadCarAsset(type);
    document.querySelector('#modelStatus').textContent = carModels[type].assetState === 'ready' ? 'Comrade1280 · CC BY 4.0 model' : carModels[type].assetState === 'failed' ? 'Model unavailable · fallback car' : 'Loading car model…';
    Object.entries(carModels).forEach(([name, model]) => { model.group.visible = name === type; });
    motion.speed = THREE.MathUtils.clamp(motion.speed, -carSpecs[type].maxSpeed * .45, carSpecs[type].maxSpeed);
    document.querySelectorAll('[data-car]').forEach(button => {
      button.classList.toggle('active', button.dataset.car === type);
      button.setAttribute('aria-pressed', String(button.dataset.car === type));
    });
    document.querySelector('#topSpeedValue').textContent = Math.round(carSpecs[type].maxSpeed * 2.236936) + ' mph target top speed';
  }
  chooseCar('comet');

  function setCameraMode() {
    resetOrbit();
    cameraMode = (cameraMode + 1) % cameraModes.length;
    document.querySelector('#cameraButton').textContent = 'CAMERA / ' + cameraModes[cameraMode];
  }
  document.querySelector('#cameraButton').addEventListener('click', setCameraMode);
  document.querySelectorAll('[data-car]').forEach(button => button.addEventListener('click', () => chooseCar(button.dataset.car)));

  document.querySelector('#mapSelect').addEventListener('change', event => {
    chooseMap(event.target.value);
    // A committed native selection otherwise keeps swallowing WASD/arrows.
    // Leave native navigation alone while the selector is being used.
    event.target.blur();
  });
  document.querySelector('#resetButton').addEventListener('click', resetVehicle);

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
    if (!event.repeat && key === 'c') setCameraMode();
    if (!event.repeat && key === 'r') resetVehicle();
  });
  window.addEventListener('keyup', event => {
    const key = event.key.toLowerCase(); keyboardKeys.delete(key); syncInputKey(key);
  });
  function releaseControls() {
    orbit.pointer = null;
    keyboardKeys.clear(); touchPointers.clear(); keys.clear();
    document.querySelectorAll('[data-key]').forEach(button => button.classList.remove('pressed'));
  }
  window.addEventListener('blur', releaseControls);
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
    const steering = Number(keys.has('a') || keys.has('arrowleft')) - Number(keys.has('d') || keys.has('arrowright'));
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
        pivot.rotation.y=w.steering;wheel.rotation.x=w.rotation;
      });
      const braking=keys.has(' ')||throttle<0, model=carModels[selectedCar];
      if(model.brakeMaterials?.length) model.brakeMaterials.forEach(material => {material.emissiveIntensity=braking?1.5:.22;});
      else model.rearLamp.color.setHex(braking?0xff8090:0xff354e);
      document.querySelector('#speedValue').textContent=String(Math.round(physics.body.velocity.length()*2.236936));
      const up=new THREE.Vector3(0,1,0).applyQuaternion(vehicle.quaternion);
      document.querySelector('#surfaceValue').textContent=up.y<.1?'Overturned? Press R / reset':state.grounded?state.grounded+' wheels grounded':'AIRBORNE · ↑↓ pitch / ←→ roll';
      if(physics.body.position.y < -30) resetVehicle();
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
      const eyeHeight = selectedCar === 'comet' || selectedCar === 'hypercar' ? 1.9 : 2.3;
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
    if (cameraMode === 2) camera.position.copy(desired);
    else camera.position.lerp(desired, 1 - Math.exp(-5 * delta));
    if (physics) camera.position.y=Math.max(camera.position.y,physics.terrainHeight(camera.position.x,camera.position.z)+1.5);
    camera.lookAt(target);
    // The old origin-centered sky crossed far=600 away from the map center,
    // clipping a circular black hole. Keep every sky vertex within radius 490.
    sky.position.copy(camera.position);
  }

  let firstFrame = true;
  function animate() {
    const delta = Math.min(clock.getDelta(), .05);
    updateVehicle(delta);
    updateCamera(delta);
    renderer.render(scene, camera);
    if (firstFrame) { message.classList.add('done'); firstFrame = false; }
    requestAnimationFrame(animate);
  }
  resize();
  camera.position.set(vehicle.position.x - 8, 5, vehicle.position.z - 8);
  animate();
})();
