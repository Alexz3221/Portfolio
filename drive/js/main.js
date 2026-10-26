(() => {
  'use strict';
  const message = document.querySelector('#loadMessage');
  if (!window.THREE) { message.textContent = 'Could not load Three.js. Try reloading.'; return; }

  const canvas = document.querySelector('#drive-scene');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 600);
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  const clock = new THREE.Clock();
  const keys = new Set();
  const vehicle = new THREE.Group();
  const motion = {speed: 0, heading: 0};
  const carSpecs = {
    comet: {name: 'Comet', color: 0xfd7653, length: 5.2, width: 2.25, wheelZ: 1.7, wheelRadius: .52, maxSpeed: 28, acceleration: 18, turn: 1.75},
    rally: {name: 'Rally', color: 0x64d9dc, length: 4.85, width: 2.35, wheelZ: 1.55, wheelRadius: .58, maxSpeed: 24, acceleration: 16, turn: 2.05},
    pickup: {name: 'Pickup', color: 0xecc77a, length: 5.7, width: 2.55, wheelZ: 1.85, wheelRadius: .64, maxSpeed: 21, acceleration: 13, turn: 1.55},
  };
  const carModels = {};
  let selectedCar = 'comet';
  let cameraMode = 0;
  let roadDistance = 0;
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
    vertexShader: 'varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec3 vPosition; void main(){float h=normalize(vPosition).y; vec3 low=vec3(0.31,0.26,0.31); vec3 mid=vec3(0.08,0.15,0.23); vec3 high=vec3(0.015,0.035,0.08); vec3 c=mix(low,mid,smoothstep(-0.18,0.2,h)); c=mix(c,high,smoothstep(0.1,0.85,h)); gl_FragColor=vec4(c,1.0);}'
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

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({color: 0x1b2b2d, roughness: 1}));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.07;
  ground.receiveShadow = true;
  scene.add(ground);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(37, 64), new THREE.MeshStandardMaterial({color: 0x0e2633, metalness: .55, roughness: .27}));
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(8, -.04, 4);
  scene.add(lake);

  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-58, 0, -49), new THREE.Vector3(-17, 0, -78),
    new THREE.Vector3(52, 0, -65), new THREE.Vector3(91, 0, -22),
    new THREE.Vector3(75, 0, 49), new THREE.Vector3(22, 0, 82),
    new THREE.Vector3(-51, 0, 70), new THREE.Vector3(-86, 0, 22)
  ], true, 'centripetal');
  const samples = Array.from({length: 240}, (_, index) => ({
    point: path.getPointAt(index / 240),
    tangent: path.getTangentAt(index / 240).normalize()
  }));

  function ribbon(offsetA, offsetB, height, material) {
    const positions = [];
    const indices = [];
    for (let index = 0; index <= samples.length; index += 1) {
      const sample = samples[index % samples.length];
      const normal = new THREE.Vector3(-sample.tangent.z, 0, sample.tangent.x);
      const a = sample.point.clone().addScaledVector(normal, offsetA);
      const b = sample.point.clone().addScaledVector(normal, offsetB);
      positions.push(a.x, height, a.z, b.x, height, b.z);
      if (index < samples.length) {
        const first = index * 2;
        indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  ribbon(-7.7, 7.7, .005, new THREE.MeshStandardMaterial({color: 0x58605b, roughness: 1, side: THREE.DoubleSide}));
  ribbon(-6.2, 6.2, .016, new THREE.MeshStandardMaterial({color: 0x222b31, roughness: .95, side: THREE.DoubleSide}));
  const paint = new THREE.MeshBasicMaterial({color: 0xd0d6cd, side: THREE.DoubleSide});
  ribbon(-5.96, -5.83, .024, paint);
  ribbon(5.83, 5.96, .024, paint);
  for (let index = 0; index < samples.length; index += 7) {
    const sample = samples[index];
    const dash = new THREE.Mesh(new THREE.BoxGeometry(.15, .018, 2.8), new THREE.MeshBasicMaterial({color: 0xd9b876}));
    dash.position.set(sample.point.x, .04, sample.point.z);
    dash.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
    scene.add(dash);
  }

  const rand = (() => { let seed = 28473; return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  function distanceToRoad(x, z) {
    let nearest = Infinity;
    for (let index = 0; index < samples.length; index += 2) {
      const dx = x - samples[index].point.x;
      const dz = z - samples[index].point.z;
      const d = dx * dx + dz * dz;
      if (d < nearest) nearest = d;
    }
    return Math.sqrt(nearest);
  }

  const bark = new THREE.MeshStandardMaterial({color: 0x394140, roughness: 1});
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
    if (distanceToRoad(x, z) < 12 || Math.hypot(x - 8, z - 4) < 42) continue;
    const height = 1.2 + rand() * 1.3;
    const trunk = new THREE.Mesh(trunkGeometry, bark);
    trunk.position.set(x, .8 * height, z);
    trunk.scale.set(height, height, height);
    trunk.castShadow = true;
    scene.add(trunk);
    const top = new THREE.Mesh(canopyGeometry, pine[index % pine.length]);
    top.position.set(x, 4.3 * height, z);
    top.scale.set(height, height, height);
    top.castShadow = true;
    scene.add(top);
  }

  const stoneMaterials = [
    new THREE.MeshStandardMaterial({color: 0x38464c, roughness: 1, flatShading: true}),
    new THREE.MeshStandardMaterial({color: 0x56605c, roughness: 1, flatShading: true})
  ];
  for (let index = 0; index < 52; index += 1) {
    const x = (rand() - .5) * 350;
    const z = (rand() - .5) * 350;
    if (distanceToRoad(x, z) < 9) continue;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + rand() * 3, 0), stoneMaterials[index % 2]);
    rock.position.set(x, .3, z);
    rock.scale.y = .45 + rand() * .6;
    rock.rotation.y = rand() * Math.PI;
    rock.castShadow = true;
    scene.add(rock);
  }
  for (let index = 0; index < 19; index += 1) {
    const angle = index * Math.PI * 2 / 19;
    const radius = 205 + rand() * 38;
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(20 + rand() * 20, 55 + rand() * 75, 5),
      new THREE.MeshStandardMaterial({color: index % 2 ? 0x263642 : 0x33434a, roughness: 1, flatShading: true})
    );
    mountain.position.set(Math.cos(angle) * radius, 18, Math.sin(angle) * radius);
    mountain.rotation.y = rand() * Math.PI;
    scene.add(mountain);
  }

  function addGate(index, color) {
    const sample = samples[index];
    const normal = new THREE.Vector3(-sample.tangent.z, 0, sample.tangent.x);
    const group = new THREE.Group();
    const frame = new THREE.MeshStandardMaterial({color: 0x3e5055, metalness: .55, roughness: .42});
    const glow = new THREE.MeshBasicMaterial({color});
    [-7.4, 7.4].forEach(side => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.35, 6.2, .35), frame);
      post.position.copy(sample.point).addScaledVector(normal, side);
      post.position.y = 3.1;
      post.castShadow = true;
      group.add(post);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(.48, 2.6, .48), glow);
      stripe.position.copy(post.position);
      stripe.position.y = 4.1;
      group.add(stripe);
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(15.2, .28, .4), glow);
    beam.position.copy(sample.point);
    beam.position.y = 6.15;
    beam.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
    group.add(beam);
    scene.add(group);
  }
  addGate(15, 0xa9f2e9);
  addGate(78, 0xffc286);
  addGate(158, 0x89bdff);

  const townMaterials = [
    new THREE.MeshStandardMaterial({color: 0x3a4c54, roughness: .8}),
    new THREE.MeshStandardMaterial({color: 0x4e565b, roughness: .8})
  ];
  for (let index = 0; index < 14; index += 1) {
    const x = (rand() - .5) * 44 + 8;
    const z = (rand() - .5) * 36 + 4;
    const width = 4 + rand() * 5;
    const height = 5 + rand() * 20;
    const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), townMaterials[index % 2]);
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width + .4, .2, width + .4), new THREE.MeshBasicMaterial({color: index % 3 ? 0x9bcac5 : 0xffb57d}));
    roof.position.set(x, height + .1, z);
    scene.add(roof);
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
    if (type === 'comet') {
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
    const wheelGeometry = new THREE.CylinderGeometry(radius, radius, .35, 18);
    wheelGeometry.rotateZ(Math.PI / 2);
    const hubGeometry = new THREE.CylinderGeometry(radius * .45, radius * .45, .37, 12);
    hubGeometry.rotateZ(Math.PI / 2);
    const wheels = [];
    [-1, 1].forEach(side => {
      [-spec.wheelZ, spec.wheelZ].forEach(z => {
        const wheel = new THREE.Group();
        part(wheel, wheelGeometry, trim, 0, 0, 0);
        part(wheel, hubGeometry, chrome, 0, 0, 0);
        wheel.position.set(side * (spec.width / 2 + .05), radius + .08, z);
        group.add(wheel);
        wheels.push(wheel);
      });
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(spec.width * 1.3, spec.length * 1.1), new THREE.MeshBasicMaterial({color: spec.color, transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide}));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = .04;
    group.add(glow);
    group.visible = false;
    vehicle.add(group);
    return {group, wheels};
  }

  Object.entries(carSpecs).forEach(([type, spec]) => { carModels[type] = buildCar(type, spec); });
  scene.add(vehicle);
  const spawn = samples[0];
  vehicle.position.set(spawn.point.x, .03, spawn.point.z);
  motion.heading = Math.atan2(spawn.tangent.x, spawn.tangent.z);
  vehicle.rotation.y = motion.heading;

  function chooseCar(type) {
    if (!carModels[type]) return;
    selectedCar = type;
    Object.entries(carModels).forEach(([name, model]) => { model.group.visible = name === type; });
    document.querySelectorAll('[data-car]').forEach(button => button.classList.toggle('active', button.dataset.car === type));
  }
  chooseCar('comet');

  function setCameraMode() {
    cameraMode = (cameraMode + 1) % cameraModes.length;
    document.querySelector('#cameraButton').textContent = 'CAMERA / ' + cameraModes[cameraMode];
  }
  document.querySelector('#cameraButton').addEventListener('click', setCameraMode);
  document.querySelectorAll('[data-car]').forEach(button => button.addEventListener('click', () => chooseCar(button.dataset.car)));

  const drivingKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' ']);
  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (drivingKeys.has(key)) { event.preventDefault(); keys.add(key); }
    if (!event.repeat && ['1', '2', '3'].includes(key)) chooseCar(['comet', 'rally', 'pickup'][Number(key) - 1]);
    if (!event.repeat && key === 'c') setCameraMode();
  });
  window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  document.querySelectorAll('[data-key]').forEach(button => {
    const key = button.dataset.key;
    button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); keys.add(key); button.classList.add('pressed'); });
    const release = () => { keys.delete(key); button.classList.remove('pressed'); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });

  function resize() {
    const width = window.innerWidth, height = window.innerHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener('resize', resize);

  function updateVehicle(delta) {
    const spec = carSpecs[selectedCar];
    const throttle = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
    const steering = Number(keys.has('a') || keys.has('arrowleft')) - Number(keys.has('d') || keys.has('arrowright'));
    roadDistance = distanceToRoad(vehicle.position.x, vehicle.position.z);
    const onRoad = roadDistance < 7.3;
    const acceleration = onRoad ? spec.acceleration : spec.acceleration * .58;
    const speedLimit = onRoad ? spec.maxSpeed : spec.maxSpeed * .6;
    motion.speed += throttle * acceleration * delta;
    if (keys.has(' ')) motion.speed *= Math.pow(.035, delta);
    else motion.speed *= Math.pow(throttle ? .88 : (onRoad ? .2 : .09), delta);
    motion.speed = THREE.MathUtils.clamp(motion.speed, -speedLimit * .45, speedLimit);
    if (Math.abs(motion.speed) > .25) motion.heading += steering * spec.turn * delta * Math.sign(motion.speed) * Math.min(1, Math.abs(motion.speed) / 8);
    vehicle.position.x += Math.sin(motion.heading) * motion.speed * delta;
    vehicle.position.z += Math.cos(motion.heading) * motion.speed * delta;
    vehicle.position.x = THREE.MathUtils.clamp(vehicle.position.x, -225, 225);
    vehicle.position.z = THREE.MathUtils.clamp(vehicle.position.z, -225, 225);
    vehicle.rotation.y = motion.heading;
    carModels[selectedCar].wheels.forEach(wheel => { wheel.rotation.x += motion.speed * delta / spec.wheelRadius; });
    document.querySelector('#speedValue').textContent = String(Math.round(Math.abs(motion.speed) * 3.6));
    document.querySelector('#surfaceValue').textContent = onRoad ? 'on the road' : 'taking the scenic route';
  }

  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();
  function updateCamera(delta) {
    if (cameraMode === 2) {
      desired.set(Math.sin(motion.heading) * 1.1, 2.1, Math.cos(motion.heading) * 1.1).add(vehicle.position);
      target.set(Math.sin(motion.heading) * 22, 2.0, Math.cos(motion.heading) * 22).add(vehicle.position);
    } else {
      const distance = cameraMode === 1 ? 16 : 7.8;
      const height = cameraMode === 1 ? 8 : 4.3;
      desired.set(-Math.sin(motion.heading) * distance, height, -Math.cos(motion.heading) * distance).add(vehicle.position);
      target.set(Math.sin(motion.heading) * 4, 1.2, Math.cos(motion.heading) * 4).add(vehicle.position);
    }
    camera.position.lerp(desired, 1 - Math.exp(-5 * delta));
    camera.lookAt(target);
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
