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

    const target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter:THREE.LinearMipmapLinearFilter, magFilter:THREE.LinearFilter
    });
    target.texture.name = 'Portfolio City pavement reflection';
    target.texture.generateMipmaps = true;
    const mirror = new THREE.PerspectiveCamera();
    const projection = new THREE.Matrix4(), nextProjection = new THREE.Matrix4();
    const gaze = new THREE.Vector3(), lastSkyPosition = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.048), viewPlane = new THREE.Plane();
    const clip = new THREE.Vector4(), corner = new THREE.Vector4();
    const capturePosition = new THREE.Vector3(), captureRotation = new THREE.Quaternion();
    const captureProjection = new THREE.Matrix4();
    const texture = new THREE.TextureLoader().load('assets/portfolio/asphalt-diffuse.jpg', image => {
      if (disposed) image.dispose();
      else uniforms.wetHasAsphalt.value = 1;
    }, undefined, () => { /* Procedural aggregate is available before the texture arrives. */ });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    let disposed = false, elapsed = Infinity, hasCapture = false;
    const uniforms = {
      wetImage:{value:target.texture}, wetProjection:{value:projection},
      wetAsphalt:{value:texture}, wetHasAsphalt:{value:0}, wetImageReady:{value:0}
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
            uniform float wetHasAsphalt, wetImageReady;
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
            float fade = smoothstep(0.,.04,reflected.x) * smoothstep(0.,.04,1.-reflected.x)
              * smoothstep(0.,.04,reflected.y) * smoothstep(0.,.04,1.-reflected.y);
            float puddle = smoothstep(.38,.70, .52 + sin(wetStreet.x*.60+cos(wetStreet.y*.34)*.75)*.19
              + sin(wetStreet.y*1.29+wetStreet.x*.44)*.12);
            float viewAngle = max(0., dot(normal, normalize(vViewPosition)));
            float fresnel = pow(1. - viewAngle, 2.7);
            // Sample averaged mip levels rather than moving individual window
            // pixels across the pavement at grazing camera angles.
            float roughMip = 2.10 + .90*(1.-puddle) + .62*fresnel;
            vec3 streetMirror = texture2D(wetImage, reflected, roughMip).rgb;
            streetMirror /= 1.0 + .9 * max(streetMirror.r,max(streetMirror.g,streetMirror.b));
            float reflectivity = (.14+.34*fresnel) * mix(.28,.88,puddle) * fade
              * smoothstep(.01,.4,wetClip.w) * wetImageReady;
            outgoingLight = outgoingLight * (1. - .34 * reflectivity) + streetMirror * reflectivity;
            gl_FragColor = vec4( outgoingLight, diffuseColor.a );
          `);
      };
      material.needsUpdate = true;
    }

    function fadeCapture(towards, delta) {
      const remaining = Math.exp(-4 * delta);
      uniforms.wetImageReady.value = towards + (uniforms.wetImageReady.value - towards) * remaining;
    }

    function update(camera, delta) {
      elapsed += delta;
      if (plane.distanceToPoint(camera.position) < .085) {
        fadeCapture(0, delta);
        elapsed = Infinity;
        return;
      }
      // The image and its projection need to follow the moving eye together.
      const cameraMoved = camera.position.distanceToSquared(capturePosition) > .0009
        || 1 - Math.abs(camera.quaternion.dot(captureRotation)) > .0000003
        || !captureProjection.equals(camera.projectionMatrix);
      if (hasCapture && !cameraMoved && elapsed < (compact ? .13 : .09)) {
        fadeCapture(1, delta);
        return;
      }

      camera.updateMatrixWorld();
      camera.getWorldDirection(gaze).add(camera.position);
      const surfaceY = -plane.constant;
      mirror.position.set(camera.position.x, 2 * surfaceY - camera.position.y, camera.position.z);
      mirror.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      mirror.up.y *= -1;
      mirror.lookAt(gaze.x, 2 * surfaceY - gaze.y, gaze.z);
      mirror.far = camera.far;
      mirror.updateMatrixWorld();
      mirror.projectionMatrix.copy(camera.projectionMatrix);
      // Overscan keeps the mirror texture available at oblique screen edges.
      const matrix = mirror.projectionMatrix.elements;
      matrix[0] /= 1.12;
      matrix[5] /= 1.12;

      // Oblique near plane clips the reflected scene to geometry above the pavement.
      // Adapted from Three.js Reflector (MIT), based on Lengyel's oblique frustum method.
      viewPlane.copy(plane).applyMatrix4(mirror.matrixWorldInverse);
      clip.set(viewPlane.normal.x, viewPlane.normal.y, viewPlane.normal.z, viewPlane.constant);
      corner.set((Math.sign(clip.x) + matrix[8]) / matrix[0], (Math.sign(clip.y) + matrix[9]) / matrix[5],
        -1, (1 + matrix[10]) / matrix[14]);
      const scale = clip.dot(corner);
      if (!Number.isFinite(scale) || scale < .00001) {
        // Keep the last valid texture and projection together. A near-plane
        // rejection must not switch the reflected lights off for one frame.
        fadeCapture(0, delta);
        elapsed = Infinity;
        return;
      }
      nextProjection.multiplyMatrices(mirror.projectionMatrix, mirror.matrixWorldInverse);
      clip.multiplyScalar(2 / scale);
      matrix[2] = clip.x;
      matrix[6] = clip.y;
      matrix[10] = clip.z + 1 - .0005;
      matrix[14] = clip.w;
      mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();

      const portrait = camera.aspect < .8;
      const wide = camera.aspect > 1.25;
      // Both axes stay powers of two so the mirror's rough mip levels are
      // available on WebGL 1 devices as well.
      const width = portrait ? 128 : 256;
      const height = wide || compact && !portrait ? 128 : 256;
      if (width !== target.width || height !== target.height) target.setSize(width, height);

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
        projection.copy(nextProjection);
        capturePosition.copy(camera.position);
        captureRotation.copy(camera.quaternion);
        captureProjection.copy(camera.projectionMatrix);
        elapsed = 0;
        if (hasCapture) fadeCapture(1, delta);
        else uniforms.wetImageReady.value = 1;
        hasCapture = true;
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
