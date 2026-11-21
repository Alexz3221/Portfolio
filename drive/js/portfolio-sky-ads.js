(function(root, factory) {
  const ads = factory();
  if (typeof module === 'object' && module.exports) module.exports = ads;
  else root.DrivePortfolioSkyAds = ads;
})(globalThis, function() {
  'use strict';

  const route = [[.17,.32],[.31,.40],[.46,.40],[.62,.59],[.79,.59],[.84,.67]];

  function makeArtwork(THREE, paint, width, height) {
    if (typeof document === 'undefined') return new THREE.DataTexture(new Uint8Array(4),1,1);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'),width,height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 4;
    return texture;
  }

  function farlineArtwork(THREE) {
    return makeArtwork(THREE,(ctx,w,h)=>{
      const cy = u=>h*(1-u);
      ctx.fillStyle = '#0c2834d0';
      ctx.beginPath();
      ctx.moveTo(-2,.15*h);
      ctx.lineTo(.24*w,0);
      ctx.lineTo(w,0);
      ctx.lineTo(w,.80*h);
      ctx.lineTo(.78*w,h);
      ctx.lineTo(0,h);
      ctx.closePath();
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.rect(.115*w,.285*h,.77*w,.475*h);
      ctx.clip();
      ctx.strokeStyle = '#7ce9e055';
      ctx.lineWidth = 1;
      for (let col=0;col<13;col++) {
        const x=w*(.115+.77*col/12);
        ctx.beginPath();
        ctx.moveTo(x,.29*h);
        ctx.lineTo(x,.76*h);
        ctx.stroke();
      }
      for (let row=0;row<10;row++) {
        const y=h*(.285+.475*row/9);
        ctx.beginPath();
        ctx.moveTo(0,y);
        ctx.lineTo(w,y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#da86cb';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(.27*w,.32*h);
      ctx.lineTo(.31*w,cy(.40));
      ctx.lineTo(.43*w,.70*h);
      ctx.lineTo(.77*w,.70*h);
      ctx.stroke();
      ctx.restore();

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#aef8ef';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(route[0][0]*w,cy(route[0][1]));
      for (const [x,y] of route.slice(1)) ctx.lineTo(x*w,cy(y));
      ctx.stroke();
      for (const [x,y] of route) {
        ctx.fillStyle = '#11323e';
        ctx.beginPath();
        ctx.arc(x*w,cy(y),11,0,2*Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#c5fdf2';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      ctx.fillStyle = '#caffef';
      ctx.font = '900 104px system-ui, sans-serif';
      ctx.fillText('FARLINE',.116*w,.176*h,.77*w);
      ctx.fillStyle = '#f1a4d9';
      ctx.font = '700 29px ui-monospace, monospace';
      ctx.fillText('NIGHT SERVICE',.122*w,.237*h);
      ctx.fillStyle = '#a3e6e0';
      ctx.fillRect(.119*w,.26*h,.76*w,3);
      ctx.fillRect(.119*w,.803*h,.76*w,3);
      ctx.font = '700 37px ui-monospace, monospace';
      ctx.fillText('PLAZA LOOP',.12*w,.88*h);
    },640,890);
  }

  function curvedSurface(THREE,width,height) {
    const geometry = new THREE.PlaneGeometry(width,height,24,1);
    const points = geometry.attributes.position;
    for (let i=0;i<points.count;i++) points.setZ(i,-.74*Math.pow(points.getX(i)/(width*.5),2));
    geometry.computeVertexNormals();
    return geometry;
  }

  function projectionMaterial(THREE, art, reducedMotion) {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{
      clock:{value:0}, motion:{value:reducedMotion ? 0 : 1},
      art:{value:null}, signal:{value:new THREE.Vector2(.46,.40)}
    }]);
    uniforms.art.value = art;
    return new THREE.ShaderMaterial({
      uniforms,fog:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
      vertexShader:`
        varying vec2 panel;
        #include <fog_pars_vertex>
        void main() {
          panel = uv;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`
        varying vec2 panel;
        uniform sampler2D art;
        uniform float clock, motion;
        uniform vec2 signal;
        #include <fog_pars_fragment>
        void main() {
          vec2 p = vec2(gl_FrontFacing ? panel.x : 1. - panel.x, panel.y);
          p.x += sin(clock * .46) * .019 * motion;
          vec4 ink = texture2D(art, p);
          vec3 color = pow(ink.rgb, vec3(2.2));
          float edge = smoothstep(.015,.085,p.x) * smoothstep(.015,.085,1.-p.x);
          float hFade = smoothstep(.025,.13,p.y) * smoothstep(.01,.08,1.-p.y);
          float stripe = .87 + .13 * cos(p.y * 463. + clock * 3. * motion);
          float sweep = 1. - smoothstep(.0,.068,abs(p.y-fract(clock * .18)));
          float spot = 1. - smoothstep(.005,.036,length((p-signal) * vec2(1.,1.38)));
          float halo = 1. - smoothstep(.015,.068,length((p-signal) * vec2(1.,1.38)));
          float cycle = mod(clock,17.);
          float dip = smoothstep(12.1,12.2,cycle) * (1.-smoothstep(12.27,12.4,cycle)) * motion;
          color += vec3(.045,.13,.15) * sweep * motion + vec3(.11,.64,.66)*spot + vec3(.04,.14,.16)*halo;
          gl_FragColor = vec4(color, max(ink.a * .82,spot*.93) * edge * hFade * stripe * (1.-.19*dip));
          #include <encodings_fragment>
          #include <fog_fragment>
        }`
    });
  }

  function mount(THREE, group, box, shell, light, reach) {
    const batches = new Map([[shell,[]],[light,[]]]);
    const transform = new THREE.Object3D();
    function part(material,x,y,z,width,height,depth,roll=0) {
      transform.position.set(x,y,z);
      transform.rotation.x = roll;
      transform.scale.set(width,height,depth);
      transform.updateMatrix();
      batches.get(material).push(transform.matrix.clone());
    }
    part(shell,0,.17,0,2.62,.34,2.04);
    part(shell,0,1.37,.14,1.67,2.34,1.43);
    part(shell,0,2.46,reach/2,1.48,.38,reach+1.08);
    for (const x of [-.61,.61]) part(shell,x,1.65,reach*.40,.16,2.59,.20,.82);
    part(shell,0,2.7,reach,3.44,.39,2.11);
    part(light,0,2.89,reach+.85,2.60,.086,.085);
    part(light,0,2.89,reach-.85,2.60,.086,.085);
    for (const [material,matrices] of batches) {
      const mesh = new THREE.InstancedMesh(box,material,matrices.length);
      mesh.name = 'portfolio-sky-ad-emitter';
      matrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.03,.075,7,32),light);
    ring.rotation.x = Math.PI/2;
    ring.position.set(0,2.92,reach);
    group.add(ring);
  }

  function addTransit(THREE,root,box,shell,reducedMotion) {
    const group = new THREE.Group();
    group.name = 'portfolio-farline-sky-ad';
    group.position.set(-28,6,29.60);
    group.rotation.y = Math.PI-.19;
    root.add(group);
    const light = new THREE.MeshBasicMaterial({color:0x6acdc5,toneMapped:false});
    const reach = 3.05;
    mount(THREE,group,box,shell,light,reach);
    const artwork = farlineArtwork(THREE);
    const material = projectionMaterial(THREE,artwork,reducedMotion);
    const surface = new THREE.Mesh(curvedSurface(THREE,12.4,17.2),material);
    surface.name = 'portfolio-farline-projection';
    surface.position.set(0,11.68,reach + .06);
    group.add(surface);
    const rays = [];
    for (const x of [-3.9,-2.2,2.2,3.9]) {
      rays.push(new THREE.Vector3(x*.14,2.94,reach),new THREE.Vector3(x,5.95,reach-.31));
    }
    const beam = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rays),
      new THREE.LineBasicMaterial({color:0x8af8e4,transparent:true,opacity:.22,depthWrite:false,toneMapped:false}));
    group.add(beam);
    return material.uniforms;
  }

  function addOrbital(THREE,root,box,shell) {
    const base = new THREE.Group();
    base.name = 'portfolio-morrow-sky-ad';
    base.position.set(87,18,-89);
    root.add(base);
    const light = new THREE.MeshBasicMaterial({color:0xffb283,toneMapped:false});
    const warm = new THREE.MeshBasicMaterial({color:0xde8070,toneMapped:false,transparent:true,opacity:.86});
    mount(THREE,base,box,shell,light,0);
    const trim = makeArtwork(THREE,ctx=>{
      ctx.fillStyle='#272735';
      ctx.fillRect(0,0,256,64);
      ctx.fillStyle='#ffd09e';
      ctx.font='900 24px system-ui, sans-serif';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillText('MORROW GRID',128,32);
    },256,64);
    const plaque = new THREE.MeshBasicMaterial({map:trim,toneMapped:false});
    const cabinet = box.clone();
    cabinet.clearGroups();
    cabinet.addGroup(0,24,0);
    cabinet.addGroup(24,12,1);
    const housing = new THREE.Mesh(cabinet,[shell,plaque]);
    housing.position.set(0,2.49,0);
    housing.scale.set(3.52,.54,2.16);
    base.add(housing);
    const node = new THREE.Group();
    node.position.y = 7.10;
    base.add(node);
    const ring = new THREE.TorusGeometry(2.76,.066,7,42);
    const orbits = [[.83,.46,0],[-.59,-.75,.44],[.23,1.57,.22]].map(([x,y,z],index)=>{
      const loop = new THREE.Mesh(ring,index===1 ? light : warm);
      loop.rotation.set(x,y,z);
      loop.scale.setScalar(1+index*.05);
      node.add(loop);
      return loop;
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.47,0),warm.clone());
    core.material.wireframe = true;
    node.add(core);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),light);
    marker.position.set(2.76,0,0);
    orbits[0].add(marker);
    return {node,orbits,core,marker};
  }

  function attach(THREE, world, {reducedMotion=false}={}) {
    const root = new THREE.Group();
    root.name = 'portfolio-sky-ads';
    const box = new THREE.BoxGeometry(1,1,1);
    const shell = new THREE.MeshStandardMaterial({color:0x333d48,roughness:.49,metalness:.48});
    const screen = addTransit(THREE,root,box,shell,reducedMotion);
    const {node,orbits,core,marker} = addOrbital(THREE,root,box,shell);
    let elapsed = 0, disposed = false;
    world.add(root);

    function update(delta) {
      if (disposed || reducedMotion) return;
      elapsed += delta;
      screen.clock.value = elapsed;
      const pathPosition = (elapsed*.52) % (route.length-1);
      const i = Math.floor(pathPosition), t = pathPosition - i;
      screen.signal.value.set(
        THREE.MathUtils.lerp(route[i][0],route[i+1][0],t),
        THREE.MathUtils.lerp(route[i][1],route[i+1][1],t)
      );
      marker.position.set(2.76*Math.cos(elapsed*.72),2.76*Math.sin(elapsed*.72),0);
      node.rotation.y = elapsed*.19;
      orbits[1].rotation.x = -.59 + Math.sin(elapsed*.41)*.33;
      orbits[2].rotation.z = .22 + Math.sin(elapsed*.29)*.29;
      core.rotation.set(elapsed*.21,-elapsed*.26,.1);
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      world.remove(root);
      const geometry = new Set(), materials = new Set(), textures = new Set([screen.art.value]);
      root.traverse(object=>{
        if (object.geometry) geometry.add(object.geometry);
        if (object.material) for (const material of [].concat(object.material)) {
          materials.add(material);
          if (material.map) textures.add(material.map);
        }
      });
      for (const texture of textures) texture.dispose();
      for (const material of materials) material.dispose();
      for (const shape of geometry) shape.dispose();
    }
    return {update,dispose};
  }

  return {attach};
});
