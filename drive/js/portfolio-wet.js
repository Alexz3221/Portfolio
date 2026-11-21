(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePortfolioWet = api;
})(globalThis, function () {
  'use strict';

  function create(THREE, renderer, scene, world, sky, {compact = false} = {}) {
    const wet = [], hidden = [];
    const materials = new Set();
    world.traverse(mesh => {
      if (mesh.name === 'portfolio-streets' || mesh.name === 'portfolio-plazas' || mesh.userData.wetRoad) {
        wet.push(mesh);
        for (const material of [].concat(mesh.material || [])) materials.add(material);
      }
      if (['terrain', 'portfolio-foundation', 'portfolio-rain', 'portfolio-pavement-reflections'].includes(mesh.name)) hidden.push(mesh);
    });
    if (!wet.length) return null;
    hidden.push(...wet);

    const target = new THREE.WebGLRenderTarget(1, 1, {minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter});
    target.texture.name = 'Portfolio City pavement reflection';
    target.texture.generateMipmaps = false;
    const mirror = new THREE.PerspectiveCamera();
    const projection = new THREE.Matrix4(), gaze = new THREE.Vector3(), lastSkyPosition = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.075), viewPlane = new THREE.Plane();
    const clip = new THREE.Vector4(), corner = new THREE.Vector4();
    const imageSize = new THREE.Vector2(1, 1);
    const texture = new THREE.TextureLoader().load('assets/portfolio/asphalt-diffuse.jpg', image => {
      if (disposed) image.dispose();
      else uniforms.wetHasAsphalt.value = 1;
    }, undefined, () => { /* Procedural aggregate is available before the texture arrives. */ });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    let disposed = false, elapsed = Infinity, time = 0;
    const uniforms = {
      wetImage:{value:target.texture}, wetProjection:{value:projection}, wetSize:{value:imageSize},
      wetAsphalt:{value:texture}, wetHasAsphalt:{value:0}, wetTime:{value:0}
    };

    for (const material of materials) {
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>
            uniform mat4 wetProjection;
            varying vec4 wetClip;
            varying vec2 wetStreet;
          `)
          .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
            vec4 streetPoint = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              streetPoint = instanceMatrix * streetPoint;
            #endif
            streetPoint = modelMatrix * streetPoint;
            wetStreet = streetPoint.xz;
            wetClip = wetProjection * streetPoint;
          `);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
            varying vec4 wetClip;
            varying vec2 wetStreet;
            uniform sampler2D wetImage, wetAsphalt;
            uniform vec2 wetSize;
            uniform float wetHasAsphalt, wetTime;
            float aggregate(vec2 p) { return fract(sin(dot(p,vec2(93.17,71.31)))*453.47); }
          `)
          .replace('#include <color_fragment>', `#include <color_fragment>
            float grit = aggregate(floor(wetStreet * 21.0));
            float asphalt = texture2D(wetAsphalt, wetStreet * .45).r;
            float stone = mix(.68 + grit * .57, .52 + asphalt * 1.55, wetHasAsphalt);
            diffuseColor.rgb *= stone;
          `)
          .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `
            vec2 reflected = wetClip.xy / max(wetClip.w,.01) * .5 + .5;
            float fade = smoothstep(0.,.06,reflected.x) * smoothstep(0.,.06,1.-reflected.x)
              * smoothstep(0.,.06,reflected.y) * smoothstep(0.,.06,1.-reflected.y);
            float puddle = smoothstep(.38,.70, .52 + sin(wetStreet.x*.60+cos(wetStreet.y*.34)*.75)*.19
              + sin(wetStreet.y*1.29+wetStreet.x*.44)*.12);
            float viewAngle = max(0., dot(normal, normalize(vViewPosition)));
            float fresnel = pow(1. - viewAngle, 2.7);
            vec2 drift = vec2(sin(wetStreet.y*7.2+wetTime*2.1),cos(wetStreet.x*3.4+wetStreet.y*3.0-wetTime*1.7));
            reflected += drift * mix(.0018,.00048,puddle);
            vec2 smear = vec2(mix(4.0,.76,puddle),mix(5.1,1.2,puddle)) / wetSize;
            vec3 streetMirror = texture2D(wetImage, reflected).rgb * .46;
            streetMirror += texture2D(wetImage, reflected + smear).rgb * .27;
            streetMirror += texture2D(wetImage, reflected - smear).rgb * .27;
            float reflectivity = (.17+.58*fresnel) * mix(.23,1.,puddle) * fade * step(.01,wetClip.w);
            outgoingLight = outgoingLight * (1. - .34 * reflectivity) + streetMirror * reflectivity;
            gl_FragColor = vec4( outgoingLight, diffuseColor.a );
          `);
      };
      material.needsUpdate = true;
    }

    function update(camera, delta) {
      time += delta;
      uniforms.wetTime.value = time;
      elapsed += delta;
      if (elapsed < (compact ? .065 : .032) || camera.position.y < .13) return;
      elapsed = 0;

      const width = Math.max(144, Math.round(Math.min(compact ? 330 : 576, camera.aspect * (compact ? 300 : 360))));
      const height = Math.min(400, Math.round(width / camera.aspect));
      if (width !== imageSize.x || height !== imageSize.y) {
        target.setSize(width, height);
        imageSize.set(width, height);
      }

      camera.updateMatrixWorld();
      camera.getWorldDirection(gaze).add(camera.position);
      mirror.position.set(camera.position.x, -camera.position.y, camera.position.z);
      mirror.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      mirror.up.y *= -1;
      mirror.lookAt(gaze.x, -gaze.y, gaze.z);
      mirror.far = camera.far;
      mirror.updateMatrixWorld();
      mirror.projectionMatrix.copy(camera.projectionMatrix);
      projection.multiplyMatrices(mirror.projectionMatrix, mirror.matrixWorldInverse);

      // Oblique near plane clips the reflected scene to geometry above the pavement.
      // Adapted from Three.js Reflector (MIT), based on Lengyel's oblique frustum method.
      viewPlane.copy(plane).applyMatrix4(mirror.matrixWorldInverse);
      clip.set(viewPlane.normal.x, viewPlane.normal.y, viewPlane.normal.z, viewPlane.constant);
      const matrix = mirror.projectionMatrix.elements;
      corner.set((Math.sign(clip.x) + matrix[8]) / matrix[0], (Math.sign(clip.y) + matrix[9]) / matrix[5],
        -1, (1 + matrix[10]) / matrix[14]);
      clip.multiplyScalar(2 / clip.dot(corner));
      matrix[2] = clip.x;
      matrix[6] = clip.y;
      matrix[10] = clip.z + 1 - .0005;
      matrix[14] = clip.w;

      const previous = renderer.getRenderTarget();
      const toneMapping = renderer.toneMapping, shadowUpdate = renderer.shadowMap.autoUpdate;
      const visibility = hidden.map(mesh => mesh.visible);
      lastSkyPosition.copy(sky.position);
      sky.position.copy(mirror.position);
      for (const mesh of hidden) mesh.visible = false;
      try {
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.shadowMap.autoUpdate = false;
        renderer.setRenderTarget(target);
        renderer.state.buffers.depth.setMask(true);
        renderer.render(scene, mirror);
      } finally {
        renderer.setRenderTarget(previous);
        renderer.toneMapping = toneMapping;
        renderer.shadowMap.autoUpdate = shadowUpdate;
        sky.position.copy(lastSkyPosition);
        hidden.forEach((mesh, index) => { mesh.visible = visibility[index]; });
      }
    }

    return {update, dispose() { disposed = true; target.dispose(); texture.dispose(); }};
  }

  return {create};
});
