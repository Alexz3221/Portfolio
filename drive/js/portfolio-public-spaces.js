(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePortfolioPublicSpaces = api;
})(globalThis, function() {
  'use strict';

  const plaza = {x:18.2,z:23.7,length:14.3};
  const park = {x:-126,z:55,width:16,length:17};
  const destinations = [
    {id:'projects-plaza',title:'Projects Plaza',x:9.3,z:22,heading:Math.PI/2,mapX:plaza.x,mapZ:plaza.z,kind:'landmark'},
    {id:'switchyard-park',title:'Switchyard Park',x:-111,z:55,heading:-Math.PI/2,mapX:park.x,mapZ:park.z,kind:'landmark'}
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

    function paving(x,z,columns,rows,pitch) {
      const colors = [0x6d6e6b,0x777974,0x75706a,0x686c6b,0x85827b,0x646868];
      for (let row=0; row<rows; row++) for (let col=0; col<columns; col++) {
        const xTile=x+(col-(columns-1)/2)*pitch, zTile=z+(row-(rows-1)/2)*pitch;
        block('curb',colors[Math.floor(random()*colors.length)],xTile,.060,zTile,pitch-.024,.055,pitch-.024);
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
        block(finish,color,x+c*u+s*v,y,z-s*u+c*v,w,h,d,yaw);
      for (const offset of [-.78,.78]) {
        benchPart('metal',0x57463e,offset,.29,0,.14,.41,.59);
        benchPart('metal',0x57463e,offset,.61,-.20,.13,.70,.12);
      }
      for (const z of [-.17,0,.17]) benchPart('matte',0x8d6448,0,.465,z,2.16,.09,.14);
      benchPart('matte',0x78604e,0,.78,-.25,2.15,.19,.075);
      benchPart('light',cyan,0,.398,.245,1.96,.035,.033);
      solid(x,.27,z,2.10,.54,.48,yaw);
    }
    function lamp(x,z,color) {
      block('metal',0x475155,x,1.05,z,.15,2.10,.15);
      block('matte',0x696864,x,.17,z,.43,.18,.43);
      block('metal',0x534943,x,2.07,z,.45,.38,.45);
      block('light',color,x,2.07,z,.39,.21,.39);
      markerSpill(x,z,.098,5.7,4.4,color);
    }
    function rubble(x,z,span,depth,count) {
      for (let i=0;i<count;i++) {
        const size=.08+random()*.25;
        const tint=[0x55554c,0x6d5f52,0x3b494d,0x98836b][i%4];
        const dx=x+(random()-.5)*span, dz=z+(random()-.5)*depth;
        part('stone','matte',tint,dx,.095+size*.22,dz,size,size*.44,size*.9,random()*6.28);
      }
    }

    // Keep the main Projects lane and the east junction free. The plaza
    // occupies its own paved pocket on the concourse shoulder.
    paving(plaza.x,plaza.z,7,11,plaza.length/11);
    for (const z of [18.25,29.9]) {
      block('metal',0x544f4f,plaza.x,.17,z,7.9,.20,.18);
      block('light',0x77ebd7,plaza.x,.258,z,6.5,.025,.041);
    }
    const sculptureX=17,sculptureZ=24.0;
    part('disk','curb',0x8c8177,sculptureX,.25,sculptureZ,4.5,.42,4.5);
    part('disk','metal',0x535954,sculptureX,.472,sculptureZ,4.19,.065,4.19);
    part('disk','matte',0x4c686b,sculptureX,.515,sculptureZ,3.95,.055,3.95);
    block('metal',0x6e6257,sculptureX,.57,sculptureZ+.37,.38,.18,.33,.48);
    block('metal',0x514941,sculptureX-.075,.645,sculptureZ-.23,.22,.24,.21,1.63);
    part('ring','metal',0x786b62,sculptureX,1.85,sculptureZ,2.70,2.70,2.70,.52,-.30);
    part('ring','light',0x7de8cf,sculptureX,1.85,sculptureZ,2.51,2.51,2.51,.52,-.30);
    part('ring','metal',0x777062,sculptureX,1.81,sculptureZ,2.32,2.32,2.32,1.75,.22);
    solid(sculptureX,.25,sculptureZ,3.1,.50,3.1,.78);
    bench(21.1,26.65,-Math.PI/2,0x6ce7d6);
    bench(15.95,28.48,Math.PI,0x6ce7d6);
    lamp(20.64,20.2,0xffa765);
    markerSpill(sculptureX,sculptureZ,.097,6.2,7.3,0x77dbd2);
    rubble(plaza.x,plaza.z,8.2,12,49);

    // Switchyard Park is a former maintenance lot on the west ring road.
    // Two worn garden beds leave a clear path from the city sidewalk.
    block('matte',0x474d42,park.x,.044,park.z,park.width-.18,.054,park.length-.13);
    paving(park.x,park.z,2,11,1.48);
    paving(park.x+5.26,park.z,6,2,1.26);
    paving(park.x-4.9,park.z-5.6,4,3,1.22);
    for (const [x,z,w,d] of [[-130.38,55.8,4.58,7.9],[-122.28,50.15,4.97,5.2],[-122.83,60.87,4.38,4.34]]) {
      block('curb',0x6a6960,x,.24,z,w,.45,d);
      block('matte',0x4b493b,x,.482,z,w-.32,.078,d-.31);
      block('light',0xa7ef89,x,.393,z+d/2+.011,w*.74,.032,.036);
      solid(x,.235,z,w,.47,d);
      for (let i=0; i<38; i++) {
        const h=.22+random()*.6, dx=(random()-.5)*(w-.42), dz=(random()-.5)*(d-.42);
        const foliage=[0x686c3e,0x3d593e,0x83764d,0x53653c,0x687d4e][i%5];
        part('leaves','foliage',foliage,x+dx,.47+h*.49,z+dz,.28+h*.70,h,.25+h*.62,random()*Math.PI,(random()-.5)*.6);
      }
      for (const sign of [-1,1]) {
        const tx=x+sign*w*.27,tz=z+sign*d*.24;
        part('trunk','matte',0x6e5947,tx,1.40,tz,.29,2.0,.29,.12,.12*sign);
        for (let i=0; i<8; i++) {
          const h=.47+random()*.81;
          part('leaves','foliage',[0x4c5a3b,0x57683d,0x696744][i%3],
            tx+(random()-.5)*1.78,2.27+i*.151,tz+(random()-.5)*1.62,.8+h*.58,h,.72+h*.59,i*.8,(random()-.5)*.64);
        }
      }
    }
    // The old rail enclosure still lines the back of the maintenance lot.
    const backEdge=park.x-park.width/2+.23;
    solid(backEdge,.55,park.z,.14,1.10,14.12);
    for (let i=0;i<8;i++) {
      const z=park.z-7+i*2;
      block('curb',0x6b6b59,backEdge,.125,z,.34,.26,.44);
      block('metal',i%2 ? 0x694c3a : 0x524a40,backEdge,.68,z,.12,1.16,.11);
      if (i===7) continue;
      block('metal',0x77654f,backEdge,.38,z+1,.076,.08,1.91);
      if (i===4) {
        block('metal',0x82583f,backEdge,.82,z+.6,.082,.09,1.22,0,.3);
      } else {
        block('metal',0x6e5140,backEdge,.994,z+1,.098,.09,1.92);
      }
    }
    bench(-127.65,60.8,Math.PI/2,0xa7ed84);
    bench(-125.5,48.65,0,0xa7ed84);
    bench(-131.2,50.25,0,0xa7ed84);
    lamp(-123.65,54.78,0xffb56b);
    lamp(-127.58,61.8,0xbdff89);
    lamp(-133.25,49.5,0xff9f69);
    rubble(park.x,park.z,14.8,16.4,73);
    for (const z of [54.04,55.96]) {
      for (const x of [-118.63,-118.17,-117.71,-117.25]) {
        block('curb',0x8b8063,x,.177,z,.21,.017,.13);
      }
    }
    for (const z of [52.70,57.12]) {
      block('metal',0x605951,-118.63,1.42,z,.22,2.84,.22);
      block('light',0xb2ef82,-118.50,1.34,z,.062,1.81,.052);
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
      sign.position.set(-118.63,2.92,54.91);
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

  return {attach,destinations};
});
