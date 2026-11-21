(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePortfolioCar = api;
})(globalThis, function () {
  'use strict';

  function loft(THREE, sections) {
    const vertices = sections.flat(2), indices = [];
    const count = sections[0].length;
    for (let row = 0; row < sections.length - 1; row++) {
      for (let j = 0; j < count; j++) {
        const a = row * count + j, b = row * count + (j + 1) % count;
        indices.push(a, a + count, b, b, a + count, b + count);
      }
    }
    for (let j = 1; j < count - 1; j++) {
      const front = (sections.length - 1) * count;
      indices.push(0, j, j + 1, front, front + j + 1, front + j);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  // The material groups share a draw call, even with multiple louvres or fins.
  function bodyParts(THREE, parent) {
    const batches = new Map();
    const matrix = new THREE.Matrix4();
    const angles = new THREE.Euler();
    const translation = new THREE.Vector3();
    function add(source, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
      const geometry = source.index ? source.toNonIndexed() : source;
      matrix.makeRotationFromEuler(angles.set(rx, ry, rz));
      matrix.setPosition(translation.set(x, y, z));
      geometry.applyMatrix4(matrix);
      if (!batches.has(material)) batches.set(material, {positions:[], normals:[]});
      const {positions, normals} = batches.get(material);
      for (const value of geometry.getAttribute('position').array) positions.push(value);
      for (const value of geometry.getAttribute('normal').array) normals.push(value);
      geometry.dispose();
      if (geometry !== source) source.dispose();
    }
    return {
      add,
      box(material, x, y, z, width, height, length, rx, ry, rz) {
        add(new THREE.BoxGeometry(width, height, length), material, x, y, z, rx, ry, rz);
      },
      rail(material, from, to, width, depth = width) {
        const origin = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
        const tangent = end.clone().sub(origin);
        translation.copy(origin).lerp(end, .5);
        const axis = new THREE.Vector3(0, 0, 1);
        const direction = new THREE.Quaternion().setFromUnitVectors(axis, tangent.clone().normalize());
        const rotation = new THREE.Euler().setFromQuaternion(direction);
        add(new THREE.BoxGeometry(width, depth, tangent.length()), material,
          translation.x, translation.y, translation.z, rotation.x, rotation.y, rotation.z);
      },
      finish() {
        for (const [material, {positions, normals}] of batches) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = !material.transparent;
          mesh.receiveShadow = true;
          parent.add(mesh);
        }
      }
    };
  }

  function shell(THREE, x, z, axles) {
    // Longitudinal stations define a pointed front, scalloped sidepods and a wide tail.
    const stations = [
      [-1, .78, .86, .76, .91, 1.09], [-.95, .88, .93, .81, 1.03, 1.21],
      [-.81, .95, .99, .88, 1.09, 1.32], [-.59, .95, 1, .87, 1.12, 1.38],
      [-.34, .87, .94, .80, 1.09, 1.33], [-.10, .82, .89, .77, .95, 1.29],
      [.15, .85, .92, .76, .93, 1.29], [.38, .93, .97, .82, 1.0, 1.27],
      [.56, .96, 1, .87, 1.08, 1.28], [.74, .96, .98, .86, .99, 1.16],
      [.90, .90, .92, .81, .87, 1.04], [1, .69, .75, .72, .77, .96]
    ].map(([position, ...shape]) => [z(position), ...shape]);
    const offsets = [-.51, -.48, -.39, -.26, -.13, 0, .13, .26, .39, .48, .51];
    const slices = [...new Set(stations.map(station => station[0]).concat(axles.flatMap(axle =>
      offsets.map(offset => axle + offset))))].sort((a, b) => a - b);
    return loft(THREE, slices.filter(slice => Math.abs(slice) <= z(1)).map(slice => {
      const i = Math.max(1, stations.findIndex(station => station[0] >= slice));
      const a = stations[i - 1], b = stations[i];
      const t = (slice - a[0]) / (b[0] - a[0]);
      const [belly, edge, deck, shoulder, top] = a.slice(1).map((value, j) => value + t * (b[j + 1] - value));
      const wheelDistance = Math.min(...axles.map(axle => Math.abs(slice - axle)));
      const arch = Math.max(0, 1 - (wheelDistance / .51) ** 2) ** .53;
      const lower = .49 + arch * .60;
      const side = shoulder + arch * (1.15 - shoulder);
      return [
        [-x(belly), lower, slice], [-x(edge), side, slice],
        [-x(deck), top, slice], [0, top - .04, slice], [x(deck), top, slice],
        [x(edge), side, slice], [x(belly), lower, slice], [0, .47, slice]
      ];
    }));
  }

  function cockpit(THREE, x, z) {
    const stations = [
      [-.63, .48, .34, 1.25, 1.32], [-.46, .64, .43, 1.27, 1.53],
      [-.26, .68, .43, 1.27, 1.82], [-.03, .68, .45, 1.28, 1.85],
      [.17, .65, .41, 1.22, 1.68], [.37, .60, .33, 1.22, 1.29]
    ];
    return loft(THREE, stations.map(([position, width, topWidth, low, top]) => [
      [-x(width), low, z(position)], [-x(topWidth), top - .035, z(position)],
      [0, top, z(position)], [x(topWidth), top - .035, z(position)], [x(width), low, z(position)]
    ]));
  }

  function spoiler(THREE, x, z, side) {
    return loft(THREE, [
      [-1.01, .63, .83, 1.485, .014], [-.94, .60, .88, 1.46, .042],
      [-.82, .56, .83, 1.42, .074], [-.70, .55, .73, 1.36, .029]
    ].map(([position, inner, outer, top, thickness]) => {
      const left = Math.min(x(inner) * side, x(outer) * side);
      const right = Math.max(x(inner) * side, x(outer) * side);
      return [[left, top - thickness, z(position)], [left, top, z(position)],
        [right, top + .012, z(position)], [right, top - thickness, z(position)]];
    }));
  }

  function studioReflection(THREE) {
    const width = 128, height = 64, pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const u = x / width, v = y / height, n = (y * width + x) * 4;
      const edge = Math.exp(-((v - .48) ** 2) * 90);
      const softbox = Math.exp(-((v - .27) ** 2) * 70) * Math.exp(-((u - .28) ** 2) * 54);
      const amber = edge * Math.exp(-((u - .58) ** 2) * 40);
      const cyan = edge * Math.exp(-((u - .91) ** 2) * 68);
      pixels[n] = Math.min(255, 22 + softbox * 200 + amber * 200 + cyan * 42);
      pixels[n + 1] = Math.min(255, 28 + softbox * 210 + amber * 103 + cyan * 178);
      pixels[n + 2] = Math.min(255, 44 + softbox * 202 + amber * 33 + cyan * 213);
      pixels[n + 3] = 255;
    }
    const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.encoding = THREE.sRGBEncoding;
    texture.needsUpdate = true;
    return texture;
  }

  function softLight(THREE, color, width, height, opacity) {
    const material = new THREE.ShaderMaterial({
      uniforms:{tint:{value:new THREE.Color(color)}, opacity:{value:opacity}},
      vertexShader:`varying vec2 coords;
        void main() { coords = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader:`varying vec2 coords;
        uniform vec3 tint; uniform float opacity;
        void main() {
          vec2 p = abs(coords * 2.0 - 1.0);
          float falloff = (1.0 - smoothstep(0.18, 1.0, p.x)) * pow(1.0 - smoothstep(0.0, 1.0, p.y), 2.0);
          gl_FragColor = vec4(tint, opacity * falloff);
        }`,
      transparent:true, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  }

  function makeWheel(THREE, parts, material, axle) {
    const {x, radius:r} = axle;
    const side = Math.sign(x) || 1, nose = .174 * side;
    const tire = new THREE.LatheGeometry([
      [.64 * r, -.157], [.87 * r, -.156], [.97 * r, -.12], [r, -.077],
      [r, .077], [.97 * r, .12], [.87 * r, .156], [.64 * r, .157]
    ].map(([u, v]) => new THREE.Vector2(u, v)), 24).rotateZ(Math.PI / 2);
    parts.add(tire, material.tire);
    parts.add(new THREE.CylinderGeometry(.69 * r, .69 * r, .27, 24).rotateZ(Math.PI / 2), material.trim);
    parts.add(new THREE.CylinderGeometry(.28 * r, .28 * r, .052, 12).rotateZ(Math.PI / 2), material.silver, nose, 0, 0);
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      parts.box(material.silver, nose, Math.cos(angle) * r * .48, Math.sin(angle) * r * .48,
        .035, r * .51, .040, angle + .24, 0, 0);
    }
    parts.add(new THREE.TorusGeometry(.71 * r, .012, 5, 24).rotateY(Math.PI / 2), material.silver, nose, 0, 0);
    parts.add(new THREE.TorusGeometry(.73 * r, .007, 4, 24).rotateY(Math.PI / 2), material.marker, nose * .96, 0, 0);
    parts.finish();
  }

  function create(THREE, spec) {
    const group = new THREE.Group();
    group.name = 'portfolio-comet';
    const x = value => value * spec.width / 2, z = value => value * spec.length / 2;
    const physical = settings => new THREE.MeshPhysicalMaterial(settings);
    const standard = settings => new THREE.MeshStandardMaterial(settings);
    const envMap = studioReflection(THREE);
    const paint = physical({color:0xa5b5b8, metalness:.64, roughness:.31, clearcoat:.82,
      clearcoatRoughness:.19, envMap, envMapIntensity:.45});
    const canopy = physical({color:0x312c28, metalness:.53, roughness:.16, clearcoat:1,
      clearcoatRoughness:.09, envMap, envMapIntensity:.76});
    const armor = standard({color:0x26303a, metalness:.52, roughness:.39, envMap, envMapIntensity:.27});
    const trim = standard({color:0x10151c, metalness:.35, roughness:.61});
    const silver = standard({color:0x93a4a5, metalness:.75, roughness:.31, envMap, envMapIntensity:.4});
    const tire = standard({color:0x0d1218, roughness:.93});
    const marker = standard({color:0xa87124, emissive:0xffa037, emissiveIntensity:.55, roughness:.44});
    const accent = new THREE.MeshBasicMaterial({color:0x5ef5f2, toneMapped:false});
    const white = new THREE.MeshBasicMaterial({color:0xdaffff, toneMapped:false});
    const rearLamp = standard({color:0x9a1230, emissive:0xff2050, emissiveIntensity:.22, roughness:.31});
    const parts = bodyParts(THREE, group);

    parts.add(shell(THREE, x, z, [...new Set(spec.wheelLayout.map(axle => Math.round(axle.z * 1000) / 1000))]), paint);
    parts.add(cockpit(THREE, x, z), canopy);
    parts.box(trim, 0, .49, 0, x(1.52), .16, z(1.82));
    parts.box(armor, 0, 1.82, z(-.14), x(.42), .038, z(.21));
    parts.box(trim, 0, .79, z(1.002), x(1.38), .19, .055);
    parts.box(armor, 0, .64, z(.968), x(1.61), .08, .23);
    parts.box(trim, 0, 1.07, z(-1.002), x(1.51), .254, .062);
    parts.box(armor, 0, .70, z(-.986), x(1.56), .15, .18);
    parts.box(trim, 0, .57, z(-.94), x(1.73), .084, .45);
    parts.box(rearLamp, 0, 1.115, z(-1.019), x(1.13), .032, .022);
    const badge = [
      [[1,1],[0,1],[0,0],[1,0]], [[0,0],[0,1],[1,1],[1,0],[0,0]],
      [[0,0],[0,1],[.5,.4],[1,1],[1,0]], [[1,1],[0,1],[0,0],[1,0]], [[0,1],[1,1]]
    ];
    const badgePoint = (letter, [u, v]) => [.244 - letter * .105 - u * .065, .935 + v * .064, z(-1.023)];
    badge.forEach((letter, i) => letter.forEach((point, segment) => {
      if (segment > 0) parts.rail(white, badgePoint(i, letter[segment - 1]), badgePoint(i, point), .009);
    }));
    parts.rail(white, badgePoint(3, [0, .5]), badgePoint(3, [.8, .5]), .009);
    parts.rail(white, badgePoint(4, [.5, 1]), badgePoint(4, [.5, 0]), .009);
    for (let i = -3; i <= 3; i++) {
      if (Math.abs(i) !== 3) parts.add(loft(THREE, [
        [[-.022,.55,-.25], [-.016,.68,-.25], [.016,.68,-.25], [.022,.55,-.25]],
        [[-.028,.59,.17], [-.026,.76,.17], [.026,.76,.17], [.028,.59,.17]]
      ]), trim, i * .235, 0, z(-.984));
      if (i !== 0) parts.box(silver, i * .193, .775, z(1.018), .026, .116, .028, 0, 0, -.29);
    }

    for (const side of [-1, 1]) {
      const X = value => x(value) * side;
      parts.rail(armor, [X(.74), .62, z(-.39)], [X(.80), .59, z(.36)], .085, .18);
      parts.rail(accent, [X(.79), .64, z(-.31)], [X(.83), .60, z(.29)], .024);
      parts.rail(trim, [X(.84), .94, z(-.36)], [X(.88), .84, z(.36)], .025, .042);
      parts.rail(silver, [X(.60), 1.32, z(.38)], [X(.44), 1.82, z(-.02)], .053);
      parts.rail(silver, [X(.44), 1.82, z(-.02)], [X(.56), 1.43, z(-.49)], .044);
      parts.rail(marker, [X(.28), 1.81, z(-.23)], [X(.38), 1.77, z(.06)], .014);
      parts.rail(marker, [X(.93), 1.09, z(-.34)], [X(.88), .99, z(.15)], .021);
      parts.rail(white, [X(.18), .99, z(1.004)], [X(.69), 1.079, z(.938)], .046);
      parts.rail(accent, [X(.68), 1.078, z(.941)], [X(.91), 1.102, z(.793)], .042);
      parts.rail(rearLamp, [X(.27), 1.114, z(-1.018)], [X(.66), 1.180, z(-1.016)], .052);
      parts.rail(rearLamp, [X(.65), 1.178, z(-1.019)], [X(.88), 1.224, z(-.94)], .054);
      parts.rail(rearLamp, [X(.49), .986, z(-1.02)], [X(.73), 1.035, z(-.989)], .023);
      parts.add(spoiler(THREE, x, z, side), paint);
      parts.rail(armor, [X(.69), 1.24, z(-.775)], [X(.74), 1.42, z(-.914)], .080, .049);
      parts.box(armor, X(.70), 1.439, z(.13), .24, .060, .17, .02, side * .24);
      parts.box(accent, X(.766), 1.451, z(.08), .076, .019, .055, 0, side * .24);
      for (let i = 0; i < 4; i++) {
        parts.box(trim, X(.645), 1.22 - i * .034, z(.486 + i * .055), .18, .021, .089, -.17, side * .26);
        parts.box(trim, X(.37 + i * .069), 1.337 - i * .014, z(-.55 + i * .019), .037, .030, .30, -.12, side * .22);
      }
    }
    parts.finish();

    const wheels = spec.wheelLayout.map(axle => {
      const pivot = new THREE.Group(), wheel = new THREE.Group();
      pivot.position.set(axle.x, axle.radius + .08, axle.z);
      pivot.add(wheel);
      group.add(pivot);
      makeWheel(THREE, bodyParts(THREE, wheel), {tire, trim, silver, marker}, axle);
      return {pivot, wheel, front:axle.z > 0};
    });

    const tailGlow = softLight(THREE, 0xff2159, x(1.92), .55, .24);
    tailGlow.position.set(0, 1.13, z(-1.03));
    group.add(tailGlow);
    const underglow = softLight(THREE, 0x2cdef1, spec.width * 1.9, spec.length * .83, .24);
    underglow.rotation.x = -Math.PI / 2;
    underglow.position.y = .36;
    group.add(underglow);

    return {group, wheels, brakeMaterials:[rearLamp]};
  }

  return {create};
});
