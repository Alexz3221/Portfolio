(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePortfolioPublicSpaces = api;
})(globalThis, function() {
  'use strict';

  const footprints = {
    plaza:{minX:12.3,maxX:32.8,minZ:16.5,maxZ:40.5},
    park:{minX:-147,maxX:-118.35,minZ:40,maxZ:73}
  };
  const walkY = .185;
  const destinations = [
    {id:'projects-plaza',title:'Projects Plaza',x:9.3,z:22,heading:Math.PI/2,mapX:18.3,mapZ:30.45,kind:'landmark'},
    {id:'switchyard-park',title:'Switchyard Park',x:-111,z:55,heading:-Math.PI/2,mapX:-132.7,mapZ:56.5,kind:'landmark'}
  ];

  function attach(THREE, world, {Cannon,physics} = {}) {
    const group = new THREE.Group();
    group.name = 'portfolio-public-spaces';
    const shapes = {
      box:new THREE.BoxGeometry(1,1,1), ring:new THREE.TorusGeometry(.5,.023,6,32),
      stone:new THREE.IcosahedronGeometry(.5,0),
      trunk:new THREE.CylinderGeometry(.23,.44,1,7),
      leaves:new THREE.IcosahedronGeometry(.5,1),
      disk:new THREE.CylinderGeometry(.5,.5,1,20)
    };
    const pavers = typeof document === 'undefined' ? null :
      new THREE.TextureLoader().load('assets/portfolio/arrival-sidewalk.webp');
    if (pavers) {
      pavers.encoding = THREE.sRGBEncoding;
      pavers.wrapS = pavers.wrapT = THREE.RepeatWrapping;
      pavers.anisotropy = 4;
    }
    const materials = {
      matte:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.86}),
      curb:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92,map:pavers}),
      foliage:new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true}),
      metal:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.57,metalness:.48}),
      light:new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false})
    };
    const batches = new Map(), collisions = [];
    const pose = new THREE.Object3D();
    let seed = 12039;
    function random() {
      seed = (Math.imul(seed,1664525)+1013904223)>>>0;
      return seed/4294967296;
    }

    function part(shape, finish, color, x,y,z, width,height,depth, yaw=0, tilt=0) {
      const key = shape+'-'+finish;
      if (!batches.has(key)) batches.set(key,{shape,finish,parts:[]});
      pose.position.set(x,y,z);
      pose.scale.set(width,height,depth);
      pose.rotation.set(tilt,yaw,0,'YXZ');
      pose.updateMatrix();
      batches.get(key).parts.push({matrix:pose.matrix.clone(),color});
    }
    const block = (finish,color,...values)=>part('box',finish,color,...values);

    function solid(x,y,z,w,h,d,yaw=0) {
      if (!Cannon || !physics) return;
      const body = new Cannon.Body({mass:0,position:new Cannon.Vec3(x,y,z)});
      body.addShape(new Cannon.Box(new Cannon.Vec3(w/2,h/2,d/2)));
      body.quaternion.setFromAxisAngle(new Cannon.Vec3(0,1,0),yaw);
      physics.world.addBody(body);
      collisions.push(body);
    }

    function deck(name, bounds, grade, pavementColor, apronColor) {
      function octagon(inset, corner) {
        const left=bounds.minX+inset, right=bounds.maxX-inset;
        const near=bounds.minZ+inset, far=bounds.maxZ-inset;
        return [[left+corner,near],[right-corner,near],[right,near+corner],[right,far-corner],
          [right-corner,far],[left+corner,far],[left,far-corner],[left,near+corner]];
      }
      function top(outer, inner) {
        const contour = ring => ring.map(([x,z])=>new THREE.Vector2(x,-z));
        const shape = new THREE.Shape(contour(outer));
        if (inner) shape.holes.push(new THREE.Path(contour(inner)));
        const geometry = new THREE.ShapeGeometry(shape);
        geometry.rotateX(-Math.PI/2);
        geometry.translate(0,walkY,0);
        const {uv,position} = geometry.attributes;
        for (let i=0; i<uv.count; i++) uv.setXY(i,position.getX(i)/3.5,position.getZ(i)/3.5);
        return geometry;
      }
      function show(geometry, finish, color, suffix) {
        const material = materials[finish].clone();
        material.color.setHex(color).convertSRGBToLinear();
        if (suffix==='perimeter-walk') material.onBeforeCompile = shader => {
          shader.vertexShader = 'varying vec2 vPavingPosition;\n'+shader.vertexShader.replace(
            '#include <begin_vertex>','#include <begin_vertex>\nvPavingPosition=position.xz;'
          );
          shader.fragmentShader = 'varying vec2 vPavingPosition;\n'+shader.fragmentShader.replace(
            '#include <map_fragment>',`#include <map_fragment>
              vec2 slab=vPavingPosition/vec2(1.34,1.15);
              slab.x+=mod(floor(slab.y),2.0)*.5;
              vec2 edge=.5-abs(fract(slab)-.5);
              vec2 pixel=fwidth(vPavingPosition)/vec2(1.34,1.15);
              vec2 joint=1.-smoothstep(vec2(.012),vec2(.019)+pixel,edge);
              joint*=1.-smoothstep(vec2(.07),vec2(.30),pixel);
              float wear=fract(sin(dot(floor(slab),vec2(12.9898,78.233)))*43758.5453);
              diffuseColor.rgb*=mix(.87,1.08,wear)*(1.-.56*max(joint.x,joint.y));
            `
          );
        };
        const mesh = new THREE.Mesh(geometry,material);
        mesh.name = name+'-'+suffix;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      const outer = octagon(0,1.05);
      const slab = octagon(.34,.86);
      const inner = octagon(2.85,.65);
      const center = top(inner);
      const apron = top(slab,inner);
      const ramp = new THREE.BufferGeometry();
      const vertices = [], indices = [];
      for (let i=0; i<outer.length; i++) {
        const next=(i+1)%outer.length;
        const [x,z]=outer[i], [endX,endZ]=outer[next];
        const [sx,sz]=slab[i], [endSX,endSZ]=slab[next];
        const steps=Math.ceil(Math.hypot(endX-x,endZ-z)/.55);
        for (let step=0; step<steps; step++) {
          const mix=step/steps, px=x+(endX-x)*mix, pz=z+(endZ-z)*mix;
          const sidewalkHeight=globalThis.DrivePortfolioStreets?.surfaceHeight(world,px,pz) || 0;
          const edgeY=Math.max(grade,sidewalkHeight+.001);
          vertices.push(px,edgeY,pz,sx+(endSX-sx)*mix,walkY,sz+(endSZ-sz)*mix);
        }
      }
      const vertexCount=vertices.length/3;
      for (let a=0; a<vertexCount; a+=2) {
        const b=(a+2)%vertexCount;
        indices.push(a,a+1,b+1,a,b+1,b);
      }
      ramp.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      ramp.setIndex(indices);
      ramp.computeVertexNormals();
      show(center,'curb',pavementColor,'court');
      show(apron,'curb',apronColor,'perimeter-walk');
      show(ramp,'matte',0x485251,'curb-cut');
      if (physics?.addStaticSurface) {
        const x=(bounds.minX+bounds.maxX)/2, z=(bounds.minZ+bounds.maxZ)/2;
        const surface = {x,z,vertices:[],indices:[]};
        for (const geometry of [center,apron,ramp]) {
          const offset=surface.vertices.length/3;
          const {position}=geometry.attributes;
          for (let i=0; i<position.count; i++) {
            surface.vertices.push(position.getX(i)-x,position.getY(i),position.getZ(i)-z);
          }
          for (const index of geometry.index.array) surface.indices.push(index+offset);
        }
        const body = physics.addStaticSurface(surface);
        if (body) collisions.push(body);
      }
    }
    function markerSpill(x,z,y,width,length,color) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(width,length),new THREE.ShaderMaterial({
        uniforms:{tint:{value:new THREE.Color(color)}}, transparent:true, depthWrite:false,
        blending:THREE.AdditiveBlending, toneMapped:false,
        vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`uniform vec3 tint;varying vec2 vUv;void main(){
          float d=length((vUv-.5)*2.);gl_FragColor=vec4(tint,.19*(1.-smoothstep(.07,1.,d)));}`
      }));
      glow.rotation.x = -Math.PI/2;
      glow.position.set(x,y,z);
      group.add(glow);
    }
    function bench(x,z,yaw,cyan) {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const benchPart = (finish,color,u,y,v,w,h,d)=>
        block(finish,color,x+c*u+s*v,y+walkY-.085,z-s*u+c*v,w,h,d,yaw);
      for (const offset of [-.78,.78]) {
        benchPart('metal',0x57463e,offset,.29,0,.14,.41,.59);
        benchPart('metal',0x57463e,offset,.61,-.20,.13,.70,.12);
      }
      for (const z of [-.17,0,.17]) benchPart('matte',0x8d6448,0,.465,z,2.16,.09,.14);
      benchPart('matte',0x78604e,0,.78,-.25,2.15,.19,.075);
      benchPart('light',cyan,0,.398,.245,1.96,.035,.033);
      solid(x,walkY+.27,z,2.10,.54,.48,yaw);
    }
    function lamp(x,z,color) {
      block('metal',0x475155,x,walkY+1.05,z,.15,2.10,.15);
      block('matte',0x696864,x,walkY+.09,z,.43,.18,.43);
      block('metal',0x534943,x,walkY+2.07,z,.45,.38,.45);
      block('light',color,x,walkY+2.07,z,.39,.21,.39);
      markerSpill(x,z,walkY+.009,5.7,4.4,color);
    }
    function rubble(x,z,span,depth,count) {
      for (let i=0;i<count;i++) {
        const size=.08+random()*.25;
        const tint=[0x55554c,0x6d5f52,0x3b494d,0x98836b][i%4];
        const dx=x+(random()-.5)*span, dz=z+(random()-.5)*depth;
        part('stone','matte',tint,dx,walkY+size*.22,dz,size,size*.44,size*.9,random()*6.28);
      }
    }

    deck('portfolio-projects-plaza',footprints.plaza,.045,0x9b9289,0x9eaeae);
    const sculptureX=18.3,sculptureZ=30.45;
    part('disk','curb',0x8c8177,sculptureX,walkY+.21,sculptureZ,5.45,.42,5.45);
    part('disk','metal',0x535954,sculptureX,walkY+.432,sculptureZ,5.1,.065,5.1);
    part('disk','matte',0x4c686b,sculptureX,walkY+.475,sculptureZ,4.84,.055,4.84);
    block('metal',0x6e6257,sculptureX,walkY+.53,sculptureZ+.37,.38,.18,.33,.48);
    block('metal',0x514941,sculptureX-.075,walkY+.605,sculptureZ-.23,.22,.24,.21,1.63);
    part('ring','metal',0x786b62,sculptureX,walkY+2.08,sculptureZ,3.34,3.34,3.34,.52,-.30);
    part('ring','light',0x7de8cf,sculptureX,walkY+2.08,sculptureZ,3.15,3.15,3.15,.52,-.30);
    part('ring','metal',0x777062,sculptureX,walkY+2.04,sculptureZ,2.86,2.86,2.86,1.75,.22);
    solid(sculptureX,walkY+.25,sculptureZ,3.8,.50,3.8,.78);
    bench(22.1,34.45,Math.PI,0x6ce7d6);
    bench(27.8,24.05,-Math.PI/2,0x6ce7d6);
    bench(26.65,34.45,Math.PI,0x6ce7d6);
    lamp(17.02,20.15,0xffa765);
    lamp(28.85,36.46,0x81f3dd);
    markerSpill(sculptureX,sculptureZ,walkY+.009,9.0,10.1,0x77dbd2);
    for (const z of [20.25,36.8]) {
      block('metal',0x544f4f,22.1,walkY+.011,z,8.6,.022,.25);
      for (const x of [18.89,22.1,25.31]) {
        block('light',0x66b8ad,x,walkY+.027,z,2.90,.016,.044);
      }
    }
    for (const x of [13.75,31.32]) for (const z of [25.77,27.35,28.93]) {
      block('metal',0x4a5c5c,x,walkY+.009,z,.84,.018,.068);
      block('curb',0x687e7e,x,walkY+.022,z,.51,.012,.087);
    }
    rubble(sculptureX,sculptureZ,7.0,5.6,30);
    rubble(25.1,35.5,6.1,2.1,22);

    // Four planted beds leave a wide crossing and a clear route around the back.
    deck('portfolio-switchyard-park',footprints.park,.004,0x85857e,0x99a798);
    for (const [x,z,w,d] of [[-140.05,47.65,8.45,7.25],[-124.93,47.45,6.26,7.33],
      [-140.05,64.2,8.45,8.11],[-125.0,65.2,6.10,7.07]]) {
      block('curb',0x6a6960,x,walkY+.225,z,w,.45,d);
      block('matte',0x4b493b,x,walkY+.45,z,w-.32,.078,d-.31);
      block('light',0x98d47a,x,walkY+.367,z+d/2+.011,w*.74,.032,.036);
      solid(x,walkY+.235,z,w,.47,d);
      for (let i=0; i<Math.round(w*d*.94); i++) {
        const h=.22+random()*.6, dx=(random()-.5)*(w-.42), dz=(random()-.5)*(d-.42);
        const foliage=[0x686c3e,0x3d593e,0x83764d,0x53653c,0x687d4e][i%5];
        part('leaves','foliage',foliage,x+dx,walkY+.47+h*.49,z+dz,.28+h*.70,h,.25+h*.62,random()*Math.PI,(random()-.5)*.6);
      }
      for (const sign of [-1,1]) {
        const tx=x+sign*w*.27,tz=z+sign*d*.24;
        part('trunk','matte',0x6e5947,tx,walkY+1.40,tz,.29,2.0,.29,.12,.12*sign);
        for (let i=0; i<8; i++) {
          const h=.47+random()*.81;
          part('leaves','foliage',[0x4c5a3b,0x57683d,0x696744][i%3],
            tx+(random()-.5)*1.78,walkY+2.27+i*.151,tz+(random()-.5)*1.62,.8+h*.58,h,.72+h*.59,i*.8,(random()-.5)*.64);
        }
      }
      rubble(x+w/2+.34,z,.72,d*.92,17);
    }
    const railX = -146.22, railStart = 42.37;
    solid(railX,walkY+.47,railStart+5,.14,.94,10);
    for (let i=0;i<6;i++) {
      const z=railStart+i*2;
      block('curb',0x6b6b59,railX,walkY+.125,z,.34,.26,.44);
      block('metal',i%2 ? 0x694c3a : 0x524a40,railX,walkY+.62,z,.12,1.08,.11);
      if (i===5) continue;
      block('metal',0x77654f,railX,walkY+.37,z+1,.076,.08,1.91);
      block('metal',0x6e5140,railX,walkY+(i===2?.74:.94),z+1,.098,.09,i===2?1.32:1.92,0,i===2?.18:0);
    }
    bench(-134.93,49.15,Math.PI/2,0xa7ed84);
    bench(-134.93,62.25,Math.PI/2,0xa7ed84);
    bench(-126.5,60.72,Math.PI,0xa7ed84);
    bench(-127.3,51.56,0,0xa7ed84);
    lamp(-121.62,53.49,0xffb56b);
    lamp(-133.7,71.33,0xbdff89);
    lamp(-144.4,58.68,0xff9f69);
    lamp(-135.3,42.13,0xa7ef89);
    for (const z of [42.35,70.75]) {
      for (const x of [-143.2,-133.6,-124.0]) {
        block('metal',0x4f583e,x,walkY+.011,z,2.4,.022,.16);
        block('light',0x88b86d,x,walkY+.028,z,1.85,.017,.041);
      }
    }
    for (const z of [54.04,55.96]) {
      for (const x of [-120.14,-119.68,-119.22,-118.76,-118.17,-117.71,-117.25]) {
        block('curb',0x978a69,x,x<-118.45?walkY+.01:.177,z,.21,.017,.13);
      }
    }
    for (const z of [52.70,57.12]) {
      block('metal',0x605951,-119.65,walkY+1.42,z,.22,2.84,.22);
      block('light',0xb2ef82,-119.52,walkY+1.34,z,.062,1.81,.052);
      solid(-119.65,walkY+.68,z,.24,1.36,.24);
    }

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width=512; canvas.height=128;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#17221e'; ctx.fillRect(0,0,512,128);
      ctx.strokeStyle='#afea91'; ctx.lineWidth=4; ctx.strokeRect(8,8,496,112);
      ctx.fillStyle='#daf4bd'; ctx.textAlign='center';
      ctx.font='800 44px system-ui'; ctx.fillText('SWITCHYARD PARK',256,61);
      ctx.font='600 22px monospace'; ctx.fillText('WEST RING',256,95);
      const map = new THREE.CanvasTexture(canvas);
      map.encoding = THREE.sRGBEncoding;
      const display = new THREE.MeshBasicMaterial({map,toneMapped:false});
      const geometry = new THREE.BoxGeometry(4.47,.89,.19);
      const sign = new THREE.Mesh(geometry,[materials.metal,materials.metal,materials.metal,materials.metal,display,display]);
      sign.name = 'portfolio-switchyard-label';
      sign.position.set(-119.65,walkY+2.92,54.91);
      sign.rotation.y=Math.PI/2;
      sign.userData.portfolioAdFace = true;
      sign.userData.portfolioAdId = 'switchyard-park';
      group.add(sign);
    }
    for (const [key,{shape,finish,parts}] of batches) {
      const mesh = new THREE.InstancedMesh(shapes[shape],materials[finish],parts.length);
      mesh.name = 'portfolio-public-space-'+key;
      for (const [index,{matrix,color}] of parts.entries()) {
        mesh.setMatrixAt(index,matrix);
        mesh.setColorAt(index,new THREE.Color(color).convertSRGBToLinear());
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = finish!=='light';
      group.add(mesh);
    }
    world.add(group);
    return {dispose() { for (const body of collisions) physics.world.removeBody(body); }};
  }

  return {attach,destinations,footprints};
});
