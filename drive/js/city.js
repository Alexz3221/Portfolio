/* A sprawling city that doubles as a map of Alex's work. Data and rendering live
 * together so the road, buildings, and raised highway agree with physics. */
(function (root, factory) {
  const city = factory();
  if (typeof module === 'object' && module.exports) module.exports = city;
  else root.DriveCity = city;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const edge = 440;
  const roadCenters = [-400, -320, -240, -160, -80, 0, 80, 160, 240, 320, 400];
  const roadHalfWidth = 10;
  const stops = [
    { id: 'about', title: 'The Workshop', x: -160, z: -160, color: '#fb6aa8' },
    { id: 'projects', title: 'Project Arcade', x: 160, z: -160, color: '#5ce9f6' },
    { id: 'experience', title: 'The Shift Log', x: 160, z: 160, color: '#ffc06a' },
    { id: 'education', title: 'Campus Corner', x: -160, z: 160, color: '#b89bff' },
    { id: 'skills', title: 'The Toolbox', x: -320, z: 0, color: '#9bf5ae' },
    { id: 'contact', title: 'Signal Tower', x: 320, z: 0, color: '#ff87dd' }
  ];

  function randomFrom(seed) {
    let value = seed >>> 0;
    return function () {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }
  const rand = randomFrom(0x7a0e2027);
  const blockCenters = roadCenters.slice(0, -1).map((n) => n + 40);
  const landmarkBlocks = new Map(stops.map((stop) => [
    (stop.x + 40) + ',' + (stop.z + 40), stop.id
  ]));
  const buildings = [];
  for (const x of blockCenters) for (const z of blockCenters) {
    const landmark = landmarkBlocks.get(x + ',' + z);
    const downtown = 1 - Math.min(1, Math.hypot(x, z) / 575);
    const twoTowers = !landmark && rand() < (downtown > .45 ? .68 : .47);
    const count = twoTowers ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const width = landmark ? 34 : twoTowers ? 17 + Math.floor(rand() * 6) : 27 + Math.floor(rand() * 13);
      const depth = landmark ? 35 : twoTowers ? 20 + Math.floor(rand() * 13) : 26 + Math.floor(rand() * 13);
      const px = x + (twoTowers ? (i ? 15 : -15) : (rand() - .5) * 9);
      const pz = z + (landmark ? 3 : (rand() - .5) * 12);
      const districtHeight = 18 + downtown * 55;
      const height = Math.round(landmark ? 84 + downtown * 30 : districtHeight + rand() * (29 + downtown * 70));
      buildings.push({ x: px, z: pz, width, depth, height, style: Math.floor(rand() * 4), landmark: landmark || null });
    }
  }

  // Surface height at segment ends is measured at its min/max Z. The visual
  // boxes use the same pitch and center as the CANNON boxes in physics.js.
  const highwaySegments = [
    { x: 0, z: -340, width: 18, length: 120, topStart: .16, topEnd: 10.16 },
    { x: 0, z: 0, width: 18, length: 560, topStart: 10.16, topEnd: 10.16 },
    { x: 0, z: 340, width: 18, length: 120, topStart: 10.16, topEnd: .16 }
  ];
  for (const segment of highwaySegments) {
    segment.pitch = -Math.atan2(segment.topEnd - segment.topStart, segment.length);
    segment.slopeLength = Math.hypot(segment.length, segment.topEnd - segment.topStart);
    segment.centerY = (segment.topStart + segment.topEnd) / 2 - .25 * Math.cos(segment.pitch);
  }
  const guardrails = [];
  for (const segment of highwaySegments) for (const side of [-1, 1]) {
    guardrails.push({
      x: side * 8.75, y: (segment.topStart + segment.topEnd) / 2 + .52 * Math.cos(segment.pitch), z: segment.z,
      width: .34, height: 1.04, length: segment.slopeLength, pitch: segment.pitch
    });
  }
  const supports = [];
  for (const z of [-200, -120, -40, 40, 120, 200]) for (const x of [-8, 8]) {
    supports.push({ x, y: 4.8, z, width: 1.15, height: 9.6, depth: 1.15 });
  }

  function distanceToRoad(x, z) {
    let dx = Infinity;
    let dz = Infinity;
    for (const c of roadCenters) {
      dx = Math.min(dx, Math.abs(x - c));
      dz = Math.min(dz, Math.abs(z - c));
    }
    const outsideX = Math.max(0, Math.abs(x) - edge);
    const outsideZ = Math.max(0, Math.abs(z) - edge);
    return Math.min(dx, dz) + Math.hypot(outsideX, outsideZ);
  }

  function routePoint(distance) {
    const straight = 302;
    const arc = Math.PI * 9 / 2;
    let d = distance;
    if (d < straight) return { x: -160, z: -151 + d, tx: 0, tz: 1 };
    d -= straight;
    if (d < arc) {
      const a = Math.PI - d / 9;
      return { x: -151 + 9 * Math.cos(a), z: 151 + 9 * Math.sin(a), tx: Math.sin(a), tz: -Math.cos(a) };
    }
    d -= arc;
    if (d < straight) return { x: -151 + d, z: 160, tx: 1, tz: 0 };
    d -= straight;
    if (d < arc) {
      const a = Math.PI / 2 - d / 9;
      return { x: 151 + 9 * Math.cos(a), z: 151 + 9 * Math.sin(a), tx: Math.sin(a), tz: -Math.cos(a) };
    }
    d -= arc;
    if (d < straight) return { x: 160, z: 151 - d, tx: 0, tz: -1 };
    d -= straight;
    if (d < arc) {
      const a = -d / 9;
      return { x: 151 + 9 * Math.cos(a), z: -151 + 9 * Math.sin(a), tx: Math.sin(a), tz: -Math.cos(a) };
    }
    d -= arc;
    if (d < straight) return { x: 151 - d, z: -160, tx: -1, tz: 0 };
    d -= straight;
    const a = -Math.PI / 2 - d / 9;
    return { x: -151 + 9 * Math.cos(a), z: -151 + 9 * Math.sin(a), tx: Math.sin(a), tz: -Math.cos(a) };
  }
  const routeLength = 4 * 302 + 2 * Math.PI * 9;
  const routeSamples = Array.from({ length: 480 }, (_, i) => routePoint(i * routeLength / 480));

  function facadeTexture(THREE, style) {
    const width = 32, height = 64;
    const data = new Uint8Array(width * height * 4);
    const pixels = randomFrom(0x9170ab + style * 131);
    const shades = [
      [[52, 102, 134], [221, 79, 146]],
      [[78, 125, 147], [133, 244, 239]],
      [[108, 106, 146], [252, 177, 101]],
      [[66, 105, 123], [171, 139, 251]]
    ][style];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const frame = x % 4 === 0 || y % 5 === 0;
      const lit = !frame && pixels() < .19;
      const color = frame ? [19, 29, 46] : lit ? shades[1] : shades[0];
      const factor = lit ? .83 + pixels() * .17 : .22 + pixels() * .14;
      data[offset] = Math.round(color[0] * factor);
      data[offset + 1] = Math.round(color[1] * factor);
      data[offset + 2] = Math.round(color[2] * factor);
      data[offset + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  function makeSign(THREE, label, color) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    const canvas = document.createElement('canvas');
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#101829';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 116);
    let size = 43;
    ctx.font = '700 ' + size + 'px monospace';
    while (size > 23 && ctx.measureText(label).width > 464) {
      size -= 2;
      ctx.font = '700 ' + size + 'px monospace';
    }
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 65);
    const texture = new THREE.CanvasTexture(canvas);
    if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function build(THREE, world) {
    const dummy = new THREE.Object3D();
    function instanced(name, geometry, material, count, cast, receive) {
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.name = name;
      mesh.castShadow = !!cast;
      mesh.receiveShadow = !!receive;
      world.add(mesh);
      return mesh;
    }
    function setInstance(mesh, index, x, y, z, sx, sy, sz, color) {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (color) mesh.setColorAt(index, color);
    }
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x0a1221, metalness: .36, roughness: .22 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x344154, metalness: .12, roughness: .85 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x536174, metalness: .15, roughness: .65 });
    const paintMat = new THREE.MeshBasicMaterial({ color: 0x95baca, transparent: true, opacity: .58, depthWrite: false });
    const glowCyan = new THREE.MeshBasicMaterial({ color: 0x22e7fb, transparent: true, opacity: .95, depthWrite: false });
    const glowPink = new THREE.MeshBasicMaterial({ color: 0xff4dbb, transparent: true, opacity: .94, depthWrite: false });
    const box = new THREE.BoxGeometry(1, 1, 1);

    // Two crossed strips per street leave genuinely open intersections.
    const roads = instanced('city-road', box, roadMat, roadCenters.length * 2, false, true);
    let index = 0;
    for (const c of roadCenters) {
      setInstance(roads, index++, c, .027, 0, roadHalfWidth * 2, .055, edge * 2);
      setInstance(roads, index++, 0, .03, c, edge * 2, .06, roadHalfWidth * 2);
    }
    roads.instanceMatrix.needsUpdate = true;

    const plots = instanced('city-sidewalk', box, sidewalkMat, 100, false, true);
    index = 0;
    for (const x of blockCenters) for (const z of blockCenters) {
      setInstance(plots, index++, x, .105, z, 59.5, .21, 59.5);
    }
    plots.instanceMatrix.needsUpdate = true;

    // Dashed lane markers and faint colored curb light give the wet asphalt
    // some rhythm without relying on hundreds of real light sources.
    const dashGeom = new THREE.BoxGeometry(1, 1, 1);
    const laneDashes = instanced('city-road-markings', dashGeom, paintMat, roadCenters.length * 44 * 2, false, false);
    index = 0;
    for (const c of roadCenters) for (let n = 0; n < 44; n++) {
      const along = -430 + n * 20;
      setInstance(laneDashes, index++, c, .064, along, .17, .012, 7.5);
      setInstance(laneDashes, index++, along, .067, c, 7.5, .012, .17);
    }
    laneDashes.instanceMatrix.needsUpdate = true;

    const curbsCyan = instanced('city-curb-light', box, glowCyan, roadCenters.length * 2, false, false);
    const curbsPink = instanced('city-curb-light', box, glowPink, roadCenters.length * 2, false, false);
    let cyanIndex = 0, pinkIndex = 0;
    for (const c of roadCenters) {
      setInstance(curbsCyan, cyanIndex++, c - 10.15, .088, 0, .33, .035, edge * 2);
      setInstance(curbsCyan, cyanIndex++, 0, .09, c - 10.15, edge * 2, .035, .33);
      setInstance(curbsPink, pinkIndex++, c + 10.15, .088, 0, .33, .035, edge * 2);
      setInstance(curbsPink, pinkIndex++, 0, .09, c + 10.15, edge * 2, .035, .33);
    }
    curbsCyan.instanceMatrix.needsUpdate = true;
    curbsPink.instanceMatrix.needsUpdate = true;

    const facades = [0, 1, 2, 3].map((style) => {
      const texture = facadeTexture(THREE, style);
      return new THREE.MeshStandardMaterial({
        color: 0xc6d4e0, map: texture, emissive: 0x5d88a7,
        emissiveMap: texture, emissiveIntensity: .52, metalness: .36, roughness: .48
      });
    });
    const byStyle = [[], [], [], []];
    buildings.forEach((building) => byStyle[building.style].push(building));
    byStyle.forEach((list, style) => {
      if (!list.length) return;
      const mesh = instanced('city-building', box, facades[style], list.length, true, true);
      list.forEach((building, i) => {
        setInstance(mesh, i, building.x, building.height / 2, building.z, building.width, building.height, building.depth);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });

    // A lit roofline makes the skyline readable at speed. Thin strips sit
    // inside the exported building extents, preserving collision dimensions.
    const roofMat = new THREE.MeshBasicMaterial({ color: 0x75dce8, transparent: true, opacity: .78 });
    const roofs = instanced('city-roof-light', box, roofMat, buildings.length * 4, false, false);
    index = 0;
    for (const b of buildings) {
      const y = b.height - .22;
      setInstance(roofs, index++, b.x, y, b.z - b.depth / 2 + .08, b.width, .36, .16);
      setInstance(roofs, index++, b.x, y, b.z + b.depth / 2 - .08, b.width, .36, .16);
      setInstance(roofs, index++, b.x - b.width / 2 + .08, y, b.z, .16, .36, b.depth);
      setInstance(roofs, index++, b.x + b.width / 2 - .08, y, b.z, .16, .36, b.depth);
    }
    roofs.instanceMatrix.needsUpdate = true;

    const storefronts = [
      'MIDNIGHT NOODLES', 'ONE MORE CHAPTER', 'OOPS, THATS CANON',
      'DRAW A LITTLE GUY', 'CAR GO VROOM', 'GOOD IDEAS AFTER 2AM',
      'THE SIDE QUEST', 'SKETCHBOOK CLUB', 'LATE NIGHT BUILDS',
      'FRESH START CAFE', 'TINY ROBOT REPAIR', 'NOODLE.EXE'
    ];
    const signable = buildings.filter((b) => !b.landmark && b.height < 65);
    const selected = signable.filter((_, i) => i % 3 === 0).slice(0, 20);
    selected.forEach((b, i) => {
      const color = i % 2 ? '#66e4ef' : '#ff80bd';
      const texture = makeSign(THREE, storefronts[i % storefronts.length], color);
      if (!texture) return;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(16, b.width - 3), 3.6), new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide }));
      sign.position.set(b.x, 4.8, b.z - b.depth / 2 - .055);
      sign.rotation.y = Math.PI;
      sign.name = 'city-business-sign';
      world.add(sign);
    });

    // Six stops are wayfinding landmarks rather than resume panels pasted on
    // buildings. A driver finds them by their colored tower and crossing.
    const crossing = instanced('city-crosswalk', box, paintMat, stops.length * 12, false, false);
    index = 0;
    for (const stop of stops) for (let i = 0; i < 12; i++) {
      setInstance(crossing, index++, stop.x - 8.25 + i * 1.5, .076, stop.z + 14, .75, .012, 5.5);
    }
    crossing.instanceMatrix.needsUpdate = true;
    for (const stop of stops) {
      const color = new THREE.Color(stop.color);
      const beacon = new THREE.Group();
      beacon.name = 'city-landmark';
      beacon.position.set(stop.x + 11, 0, stop.z + 25);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.7, .5, 8), new THREE.MeshStandardMaterial({ color: 0x182136, metalness: .45, roughness: .35 }));
      base.position.y = .45;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.3, .4, 11, 8), new THREE.MeshBasicMaterial({ color }));
      stem.position.y = 6;
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(1.45, 0), new THREE.MeshBasicMaterial({ color }));
      orb.position.y = 12;
      const halo = new THREE.Mesh(new THREE.TorusGeometry(3.1, .08, 6, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8 }));
      halo.rotation.x = Math.PI / 2;
      halo.position.y = .7;
      beacon.add(base, stem, orb, halo);
      world.add(beacon);
      const home = buildings.find((b) => b.landmark === stop.id);
      const texture = makeSign(THREE, stop.title.toUpperCase(), stop.color);
      if (texture) {
        const signMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide });
        for (const rotation of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
          const wayfinder = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 2.2), signMaterial);
          wayfinder.position.set(Math.sin(rotation) * .045, 7.2, Math.cos(rotation) * .045);
          wayfinder.rotation.y = rotation;
          wayfinder.name = 'city-landmark';
          beacon.add(wayfinder);
        }
        // A clear overhead cue stays centered in the driving lane, visible
        // past the route picker and speed HUD at narrow viewport widths.
        const overheadMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide });
        for (const facing of [0, Math.PI]) {
          const overhead = new THREE.Mesh(new THREE.PlaneGeometry(12, 3.2), overheadMaterial);
          overhead.position.set(stop.x, 8.5, stop.z + 25 + (facing ? -.045 : .045));
          overhead.rotation.y = facing;
          overhead.name = 'city-landmark';
          world.add(overhead);
        }
      }
      if (home && texture) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(25, 5.4), new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide }));
        sign.position.set(home.x, 11, home.z - home.depth / 2 - .07);
        sign.rotation.y = Math.PI;
        sign.name = 'city-landmark';
        world.add(sign);
      }
    }

    // Raised expressway: the slab is the exact box represented by each
    // highwaySegments collider; its ends transition to the ground grid.
    const highwayMat = new THREE.MeshStandardMaterial({ color: 0x27344b, metalness: .32, roughness: .34 });
    const highwayLine = new THREE.MeshBasicMaterial({ color: 0xf0ca89, transparent: true, opacity: .76 });
    highwaySegments.forEach((segment) => {
      const road = new THREE.Mesh(new THREE.BoxGeometry(segment.width, .5, segment.slopeLength), highwayMat);
      road.name = 'city-highway';
      road.position.set(segment.x, segment.centerY, segment.z);
      road.rotation.x = segment.pitch;
      road.castShadow = true;
      road.receiveShadow = true;
      world.add(road);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(.22, .025, segment.slopeLength - 2), highwayLine);
      stripe.position.set(segment.x, (segment.topStart + segment.topEnd) / 2 + .015 * Math.cos(segment.pitch), segment.z);
      stripe.rotation.x = segment.pitch;
      stripe.name = 'city-highway-marking';
      world.add(stripe);
    });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5dacc5, emissive: 0x12506a, metalness: .6, roughness: .27 });
    for (const r of guardrails) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(r.width, r.height, r.length), railMat);
      rail.position.set(r.x, r.y, r.z);
      rail.rotation.x = r.pitch;
      rail.name = 'city-highway-guardrail';
      rail.castShadow = true;
      world.add(rail);
    }
    const supportMat = new THREE.MeshStandardMaterial({ color: 0x4d5a70, metalness: .35, roughness: .67 });
    const supportMesh = instanced('city-highway-support', box, supportMat, supports.length, true, true);
    supports.forEach((s, i) => setInstance(supportMesh, i, s.x, s.y, s.z, s.width, s.height, s.depth));
    supportMesh.instanceMatrix.needsUpdate = true;

    // Streetlamps use one draw call per part. Their reflected color is painted
    // with emissive geometry, keeping the scene usable on modest GPUs.
    const lampSites = [];
    for (let xi = 0; xi < roadCenters.length - 1; xi++) for (let zi = 0; zi < roadCenters.length - 1; zi++) {
      if ((xi + zi) % 2 === 0) lampSites.push({ x: roadCenters[xi] + 11, z: roadCenters[zi] + 11 });
    }
    const lampPoles = instanced('city-streetlight', box, curbMat, lampSites.length, true, false);
    const lampHeads = instanced('city-streetlight-glow', box, glowPink, lampSites.length, false, false);
    lampSites.forEach((site, i) => {
      setInstance(lampPoles, i, site.x, 3.25, site.z, .22, 6.5, .22);
      setInstance(lampHeads, i, site.x, 6.56, site.z, 1.1, .24, .42);
    });
    lampPoles.instanceMatrix.needsUpdate = true;
    lampHeads.instanceMatrix.needsUpdate = true;

    const rainCount = 320;
    const rainRandom = randomFrom(0x24a10e);
    const drops = Array.from({ length: rainCount }, () => ({
      x: (rainRandom() - .5) * 100, z: (rainRandom() - .5) * 100,
      y: rainRandom() * 42, speed: 18 + rainRandom() * 16,
      length: .7 + rainRandom() * 1.2
    }));
    const rainPositions = new Float32Array(rainCount * 6);
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: 0x9acbe6, transparent: true, opacity: .25, depthWrite: false }));
    rain.name = 'city-rain';
    rain.frustumCulled = false;
    world.add(rain);
    function update(camera, dt) {
      if (!camera) return;
      rain.position.set(camera.position.x, 0, camera.position.z);
      for (let i = 0; i < rainCount; i++) {
        const drop = drops[i];
        drop.y -= drop.speed * Math.min(dt || 0, .1);
        if (drop.y < -2) drop.y += 44;
        const p = i * 6;
        rainPositions[p] = drop.x;
        rainPositions[p + 1] = drop.y;
        rainPositions[p + 2] = drop.z;
        rainPositions[p + 3] = drop.x - .17;
        rainPositions[p + 4] = drop.y - drop.length;
        rainPositions[p + 5] = drop.z + .05;
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }
    update({ position: { x: 0, z: 0 } }, 0);
    return { update };
  }

  return { edge, roadCenters, roadHalfWidth, buildings, stops,
    highwaySegments, guardrails, supports, distanceToRoad, routeSamples, build };
});
