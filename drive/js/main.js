(() => {
  "use strict";

  const canvas = document.querySelector("#drive-scene");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 260);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const clock = new THREE.Clock();
  const keys = new Set();

  scene.background = new THREE.Color(0x050508);
  scene.fog = new THREE.FogExp2(0x050508, 0.018);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const ambient = new THREE.HemisphereLight(0x8ca8c8, 0x08080b, 0.85);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
  keyLight.position.set(12, 18, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshStandardMaterial({
      color: 0x08090d,
      metalness: 0.55,
      roughness: 0.48
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(180, 90, 0x4c8994, 0x15252b);
  grid.position.y = 0.012;
  grid.material.transparent = true;
  grid.material.opacity = 0.42;
  scene.add(grid);

  const starPositions = [];
  for (let index = 0; index < 900; index += 1) {
    const angle = index * 2.399963;
    const radius = 35 + ((index * 41) % 170);
    const height = 8 + ((index * 67) % 85);
    starPositions.push(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0xb7dce1, size: 0.22, transparent: true, opacity: 0.65 })
  );
  scene.add(stars);

  function createCar() {
    const car = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8d8d2,
      metalness: 0.78,
      roughness: 0.24
    });
    const darkMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b0c10,
      metalness: 0.45,
      roughness: 0.34
    });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x18242b,
      metalness: 0.1,
      roughness: 0.1,
      transparent: true,
      opacity: 0.72
    });

    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.72, 6.2), bodyMaterial);
    lowerBody.position.y = 0.92;
    lowerBody.castShadow = true;
    car.add(lowerBody);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.46, 1.7), bodyMaterial);
    nose.position.set(0, 1.3, 2.65);
    nose.rotation.x = -0.08;
    nose.castShadow = true;
    car.add(nose);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.92, 2.8), glassMaterial);
    cabin.position.set(0, 1.66, -0.35);
    cabin.scale.x = 0.92;
    cabin.castShadow = true;
    car.add(cabin);

    const wheels = [];
    const wheelGeometry = new THREE.CylinderGeometry(0.56, 0.56, 0.42, 24);
    wheelGeometry.rotateZ(Math.PI / 2);

    [[-1.62, 0.62, 1.95], [1.62, 0.62, 1.95], [-1.62, 0.62, -1.95], [1.62, 0.62, -1.95]].forEach((position) => {
      const wheel = new THREE.Mesh(wheelGeometry, darkMaterial);
      wheel.position.set(...position);
      wheel.castShadow = true;
      wheels.push(wheel);
      car.add(wheel);
    });

    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xc9f7ff });
    [-0.95, 0.95].forEach((x) => {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.08), lightMaterial);
      lamp.position.set(x, 1.18, 3.13);
      car.add(lamp);
    });

    const rearMaterial = new THREE.MeshBasicMaterial({ color: 0xff3e4d });
    [-1.02, 1.02].forEach((x) => {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.08), rearMaterial);
      lamp.position.set(x, 1.1, -3.13);
      car.add(lamp);
    });

    car.position.y = 0.02;
    scene.add(car);
    return { group: car, wheels };
  }

  const car = createCar();
  const motion = { speed: 0, heading: 0 };

  function isDrivingKey(key) {
    return ["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(key);
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (isDrivingKey(key)) {
      event.preventDefault();
      keys.add(key);
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  window.addEventListener("blur", () => keys.clear());
  canvas.addEventListener("pointerdown", () => canvas.focus());

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function updateCar(delta) {
    const forward = keys.has("w") || keys.has("arrowup");
    const reverse = keys.has("s") || keys.has("arrowdown");
    const left = keys.has("a") || keys.has("arrowleft");
    const right = keys.has("d") || keys.has("arrowright");

    const throttle = Number(forward) - Number(reverse);
    motion.speed += throttle * 10 * delta;
    motion.speed *= Math.pow(throttle === 0 ? 0.18 : 0.78, delta);
    motion.speed = THREE.MathUtils.clamp(motion.speed, -8, 15);

    if (Math.abs(motion.speed) > 0.08) {
      const steering = Number(left) - Number(right);
      motion.heading += steering * 1.45 * delta * Math.sign(motion.speed);
    }

    car.group.position.x += Math.sin(motion.heading) * motion.speed * delta;
    car.group.position.z += Math.cos(motion.heading) * motion.speed * delta;
    car.group.position.x = THREE.MathUtils.clamp(car.group.position.x, -82, 82);
    car.group.position.z = THREE.MathUtils.clamp(car.group.position.z, -82, 82);
    car.group.rotation.y = motion.heading;

    car.wheels.forEach((wheel) => {
      wheel.rotation.x += motion.speed * delta * 1.7;
    });
  }

  function updateCamera(delta) {
    const offset = new THREE.Vector3(
      -Math.sin(motion.heading) * 9,
      5.2,
      -Math.cos(motion.heading) * 9
    ).add(car.group.position);

    const responsiveness = 1 - Math.pow(0.001, delta);
    camera.position.lerp(offset, responsiveness);

    const target = new THREE.Vector3(
      car.group.position.x + Math.sin(motion.heading) * 4,
      1.1,
      car.group.position.z + Math.cos(motion.heading) * 4
    );
    camera.lookAt(target);
  }

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    updateCar(delta);
    updateCamera(delta);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  resize();
  updateCamera(1);
  canvas.focus({ preventScroll: true });
  animate();
})();
