(function(root, factory) {
  const signText = typeof module === 'object' && module.exports
    ? require('./portfolio-sign-text') : root.DrivePortfolioSignText;
  const api = factory(signText);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePortfolioPublicSpaces = api;
})(globalThis, function(signText) {
  'use strict';

  const footprints = {
    plaza:{minX:4.4,maxX:33.81,minZ:15.65,maxZ:43.9},
    plazaWest:{minX:-26.45,maxX:-4.4,minZ:14.4,maxZ:43.9},
    plazaWestApproach:{minX:-40.30,maxX:-18.6,minZ:8.65,maxZ:28.05},
    plazaWestJoin:{minX:-54.65,maxX:-23.90,minZ:-2.85,maxZ:16.25},
    campusParkJoin:{minX:-137.5,maxX:-117.5,minZ:34.35,maxZ:40.5},
    park:{minX:-147,maxX:-118.35,minZ:40,maxZ:73}
  };
  const walkY = .185;
  const crossingZ = 30.2;
  const facilities = {x:29.03,z:36.35,w:5.73,d:8.1,h:6.30};
  const destinations = [
    {id:'projects-plaza',title:'Projects Plaza',x:0,z:22,heading:0,mapX:15.95,mapZ:35.4,kind:'landmark'},
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
      globalThis.DrivePortfolioStreets?.finishPlazaJoin?.(THREE,world,pavers);
    }
    const materials = {
      matte:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.86}),
      curb:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92,map:pavers}),
      foliage:new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true}),
      metal:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.57,metalness:.48}),
      glass:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.31,metalness:.14,transparent:true,opacity:.37,depthWrite:false}),
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

    function deck(name, bounds, grade, pavementColor, apronColor, plaza=false, approach=null) {
      function outline(inset, corner) {
        const left=bounds.minX+inset, right=bounds.maxX-inset;
        const near=bounds.minZ+inset, far=bounds.maxZ-inset;
        const boundary = approach ? [
          [approach.minX+inset,approach.minZ+inset], [approach.maxX-inset,approach.minZ+inset],
          [approach.maxX-inset,near], [right,near], [right,far], [left,far],
          [left,approach.maxZ-inset], [approach.minX+inset,approach.maxZ-inset]
        ] : [[left,near],[right,near],[right,far],[left,far]];
        return boundary.flatMap(([x,z],i)=>{
          const previous=boundary[(i+boundary.length-1)%boundary.length], next=boundary[(i+1)%boundary.length];
          const [from,to]=[previous,next].map(([px,pz])=>{
            const dx=px-x, dz=pz-z, length=Math.hypot(dx,dz);
            const reach=Math.min(corner,length*.43)/length;
            return [x+dx*reach,z+dz*reach];
          });
          if (!approach) return [from,to];
          return Array.from({length:11},(_,step)=>{
            const t=step/10, s=1-t;
            return [s*s*from[0]+2*s*t*x+t*t*to[0],s*s*from[1]+2*s*t*z+t*t*to[1]];
          });
        });
      }
      function pavingUV(geometry) {
        const position=geometry.attributes.position, uv=[];
        for (let i=0; i<position.count; i++) uv.push(position.getX(i)/3.5,position.getZ(i)/3.5);
        geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      }
      function top(outer, inner) {
        const contour = ring => ring.map(([x,z])=>new THREE.Vector2(x,-z));
        const shape = new THREE.Shape(contour(outer));
        if (inner) shape.holes.push(new THREE.Path(contour(inner)));
        const geometry = new THREE.ShapeGeometry(shape);
        geometry.rotateX(-Math.PI/2);
        geometry.translate(0,walkY,0);
        pavingUV(geometry);
        return geometry;
      }
      function show(geometry, finish, color, suffix) {
        const material = materials[finish].clone();
        material.color.setHex(color).convertSRGBToLinear();
        if (suffix==='perimeter-walk' || plaza) material.onBeforeCompile = shader => {
          const pattern = plaza && suffix==='court' ? 'vec2(2.22,1.65)' : 'vec2(1.34,1.15)';
          shader.vertexShader = 'varying vec2 vPavingPosition;\n'+shader.vertexShader.replace(
            '#include <begin_vertex>','#include <begin_vertex>\nvPavingPosition=position.xz;'
          );
          shader.fragmentShader = 'varying vec2 vPavingPosition;\n'+shader.fragmentShader.replace(
            '#include <map_fragment>',`#include <map_fragment>
              vec2 slab=vPavingPosition/${pattern};
              slab.x+=mod(floor(slab.y),2.0)*.5;
              vec2 edge=.5-abs(fract(slab)-.5);
              vec2 pixel=fwidth(vPavingPosition)/${pattern};
              vec2 joint=1.-smoothstep(vec2(.012),vec2(.019)+pixel,edge);
              joint*=1.-smoothstep(vec2(.07),vec2(.30),pixel);
              float wear=fract(sin(dot(floor(slab),vec2(12.9898,78.233)))*43758.5453);
              diffuseColor.rgb*=mix(.87,1.08,wear)*(1.-.56*max(joint.x,joint.y));
            `
          );
        };
        if (plaza && suffix==='court') material.customProgramCacheKey = ()=> 'projects-plaza-court';
        const mesh = new THREE.Mesh(geometry,material);
        mesh.name = name+'-'+suffix;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      const outer = outline(0,1.05);
      const slab = outline(.34,.86);
      const inner = outline(2.85,.65);
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
      if (plaza) pavingUV(ramp);
      show(center,'curb',pavementColor,'court');
      show(apron,'curb',apronColor,'perimeter-walk');
      show(ramp,plaza ? 'curb' : 'matte',plaza ? apronColor : 0x485251,'curb-cut');
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

    function plaque(id,title,subtitle,color,x,y,z,w,h,yaw) {
      const geometry=new THREE.BoxGeometry(w,h,.158);
      let material=materials.metal;
      if (typeof document!=='undefined' && signText) {
        const {canvas,ctx}=signText.canvas(w,h,512,128);
        ctx.fillStyle='#1d262a'; ctx.fillRect(0,0,512,128);
        ctx.strokeStyle=color; ctx.lineWidth=4; ctx.strokeRect(7,7,498,114);
        ctx.fillStyle=color; ctx.textAlign='center';
        ctx.font='800 49px system-ui'; signText.text(ctx,title,256,subtitle ? 69 : 83,471);
        if (subtitle) {
          ctx.fillStyle='#e7d6c4'; ctx.font='700 23px ui-monospace, monospace';
          signText.text(ctx,subtitle,256,103,458);
        }
        const texture=new THREE.CanvasTexture(canvas);
        texture.encoding=THREE.sRGBEncoding;
        texture.anisotropy=4;
        geometry.clearGroups();
        geometry.addGroup(0,24,0);
        geometry.addGroup(24,6,1);
        geometry.addGroup(30,6,0);
        material=[materials.metal,new THREE.MeshBasicMaterial({map:texture,toneMapped:false})];
      }
      const mesh=new THREE.Mesh(geometry,material);
      mesh.name='portfolio-plaza-'+id;
      mesh.position.set(x,y,z);
      mesh.rotation.y=yaw;
      mesh.userData.portfolioAdFace=true;
      mesh.userData.portfolioAdId='projects-plaza-'+id;
      group.add(mesh);
    }

    function kiosk({id,x,z,toward,cloth,trim,title,subtitle,contents,wall}) {
      const yaw=toward*Math.PI/2;
      const item=(shape,finish,color,u,y,d,w,h,l,tilt=0)=>
        part(shape,finish,color,x+toward*d,walkY+y,z-toward*u,w,h,l,yaw,tilt);
      item('box','matte',trim,0,.54,.1,2.8,1.07,.79);
      item('box','metal',0x9a8271,0,1.10,.18,2.97,.12,.97);
      for (const u of [-1.38,1.38]) {
        item('box','metal',0x595450,u,1.38,-.45,.12,2.76,.14);
        item('box','metal',0x595450,u,1.30,.59,.12,2.60,.14);
      }
      item('box','matte',cloth,0,2.69,.03,3.12,.12,1.54,.135);
      item('box','matte',cloth,0,2.55,.80,3.16,.28,.065);
      for (const u of [-1.23,-.72,-.18,.36,.9])
        item('box','matte',trim,u,2.55,.842,.112,.25,.021);
      item('box','light',0xffd1a3,0,2.50,.55,2.45,.037,.043);
      if (wall) {
        // The cover spans from the staffed counter back to the shop wall.
        const span=Math.abs(x-wall)-.62;
        item('box','metal',0x535359,0,2.73,-.62-span*.5,2.91,.087,span);
        for (const u of [-1.18,1.18]) item('box','metal',0x696465,u,2.70,-.64-span*.5,.09,.14,span+.13);
      }
      plaque(id,title,subtitle,'#ffdeb8',x+toward*.87,walkY+2.48,z,2.49,.40,yaw);
      for (let i=0;i<8;i++) {
        const u=(i%4-1.5)*.49, d=i<4 ? .32 : -.19;
        if (contents==='cups') {
          item('trunk','matte',i%2 ? 0xcab492 : 0x938b71,u,1.285,d,.251,.25,.25);
          item('disk','metal',0xaa9280,u,1.415,d,.147,.052,.147);
        } else if (contents==='print') {
          item('box','matte',[0x87775c,0xa58465,0x718177,0x9d8179][i%4],u,1.165+d*.3,d,.41,.13,.31,.17);
          item('box','curb',0xaf9b80,u,1.248+d*.3,d+.03,.36,.024,.28,.17);
        } else {
          item('box','matte',0x716550,u,1.23,d,.41,.16,.38);
          for (let col=0;col<3;col++) {
            item('leaves','matte',i%3 ? 0xa78451 : 0x7b8d52,u+(col-1)*.11,1.34,d,.117,.113,.117);
          }
        }
      }
      item('box','matte',0x7f6e58,-1.32,.18,-.45,.44,.37,.64);
      item('box','metal',0x48494c,1.22,.22,-.47,.46,.43,.61);
      solid(x,walkY+.56,z,2.83,1.12,.94,yaw);
      markerSpill(x+toward*.67,z,walkY+.009,4.6,4.3,0xffb979);
    }

    function publicFacilities() {
      const {x,z,w,d,h} = facilities;
      const front=x-w/2, back=x+w/2, near=z-d/2, far=z+d/2;
      const first=3.14;
      const rest=(finish,color,px,y,pz,width,height,depth)=>block(finish,color,px,walkY+y,pz,width,height,depth);
      rest('curb',0x88857b,x,.105,z,w+.24,.21,d+.23);
      rest('curb',0x87847e,back-.14,first*.5,z,.28,first-.14,d);
      for (const pz of [near+.13,far-.13]) rest('curb',0x7e817c,x,first*.5,pz,w,first-.14,.26);
      const gaps=[[near+.74,near+2.27],[near+3.27,near+4.82],[far-1.72,far-.39]];
      let from=near;
      for (const [i,[a,b]] of gaps.entries()) {
        rest('curb',0x8b9184,front+.15,1.34,(from+a)*.5,.30,2.68,a-from);
        rest('matte',0x4a5350,front+.47,1.22,(a+b)*.5,.13,2.27,b-a-.08);
        for (const edge of [a,b]) rest('metal',0x534941,front+.17,1.21,edge,.35,2.31,.112);
        rest('metal',0x857766,front+.37,1.08,b-.16,.094,.27,.076);
        rest('light',0xf4cd96,front+.20,2.32,(a+b)*.5,.162,.061,b-a-.23);
        if (i<2) rest('matte',0x679993,front+.37,1.70,(a+b)*.5,.085,.32,.56);
        from=b;
      }
      rest('curb',0x8b9184,front+.15,1.34,(from+far)*.5,.30,2.68,far-from);
      rest('curb',0x8b9184,front+.15,2.89,z,.31,.53,d);
      rest('metal',0x66635d,front-.22,2.74,z,.46,.13,d+.25);
      const west=-Math.PI/2;
      plaque('restrooms','PUBLIC RESTROOMS','', '#d1e7df',front-.27,walkY+2.976,near+2.68,4.70,.57,west);
      plaque('office-stairs','OFFICE','', '#e4cca3',front-.22,walkY+2.966,far-1.05,1.48,.32,west);
      rest('curb',0x777a73,x,3.18,z,w+.24,.28,d+.34);

      // The smaller office floor sits back on the restroom walls.
      const pane=front+.48;
      rest('matte',0x3b5354,back-.34,4.53,z,.30,2.47,d-.82);
      for (const pz of [near+.48,far-.48]) rest('matte',0x4d5e5d,x+.06,4.65,pz,w-.83,2.58,.34);
      rest('matte',0x43555a,x,5.99,z,w-.30,.32,d-.30);
      rest('metal',0x6b6e69,x,6.226,z,w-.08,.148,d-.14);
      for (const yy of [3.53,5.62]) rest('metal',0x566465,pane,yy,z,.23,.20,d-.78);
      for (let column=0;column<4;column++) {
        const zz=near+1.33+column*1.78;
        rest('glass',column%3 ? 0x7baba4 : 0x6d8b8f,pane,4.56,zz,.042,1.91,1.62);
        rest('metal',0x515559,pane,4.57,zz-.83,.20,1.98,.103);
        rest('matte',0x6d584c,pane+1.31,3.97,zz,.83,.22,1.14);
        rest('matte',0x716758,pane+1.61,4.20,zz+.16,.23,.31,.51);
        rest('light',column%3 ? 0xffce9e : 0x81beae,pane+1.23,5.83,zz,.56,.075,1.11);
      }
      rest('metal',0x515559,pane,4.57,far-.55,.20,1.98,.103);
      rest('metal',0x505959,back-1.42,5.99,z,.33,.60,1.93);
      plaque('plaza-office','PLAZA OFFICE','', '#d9e3c7',front-.16,walkY+5.93,z+.47,3.34,.36,west);
      for (const offset of [-1.03,1.03])
        rest('metal',0x484e4d,front+.10,5.93,z+.47+offset,.59,.17,.14);
      // A shallow rear canopy ties the pavilion to the Little Hours frontage.
      const shopWall=33.86, gap=shopWall-back, reach=(back+shopWall)*.5;
      for (const pz of [31.0,38.82]) rest('metal',0x535857,reach,3.15,pz,gap+.30,.19,.18);
      for (const px of [back+.05,shopWall-.05]) rest('metal',0x525855,px,3.14,34.91,.14,.16,7.88);
      for (let i=0;i<4;i++) {
        const pz=31.97+i*1.95;
        rest('glass',0x9eaaa6,reach,3.22,pz,gap-.13,.042,1.89);
        rest('metal',0x696f67,reach,3.17,pz+.87,gap+.10,.11,.10);
      }
      rest('light',0xf3d2ad,reach,3.08,34.91,.046,.052,7.21);
      solid(x,walkY+h*.5,z,w,h,d);
      markerSpill(front-.88,z-.94,walkY+.009,4.1,7.35,0xe3c788);
    }

    deck('portfolio-projects-plaza',footprints.plaza,.045,0xa39d91,0x9eaeae,true);
    deck('portfolio-projects-plaza-west',footprints.plazaWest,.045,0xa39d91,0x9eaeae,true,footprints.plazaWestApproach);
    for (let i=-5;i<=5;i++) block('matte',0xededde,i*.765,.055,crossingZ,.405,.009,3.12);
    for (const side of [-1,1]) {
      for (const z of [19.18,24.2,36.9,41.25]) {
        block('metal',0x58615f,side*4.94,walkY+.39,z,.136,.77,.139);
        block('light',0xb0d4c3,side*4.94,walkY+.71,z,.144,.063,.147);
        solid(side*4.94,walkY+.39,z,.15,.78,.15);
      }
      const outer=side>0 ? 25.7 : 22.9, inner=4.79;
      for (const z of [crossingZ-1.83,crossingZ+1.83]) {
        block('matte',0x757a70,side*(outer+inner)*.5,walkY+.009,z,outer-inner,.016,.073);
        for (const x of [5.15,5.45,5.75,6.05])
          block('curb',0xc6ae75,side*x,walkY+.018,z-.15,.18,.024,.19);
      }
    }
    const sculptureX=15.95,sculptureZ=35.4;
    part('disk','curb',0x9d8e7c,sculptureX,walkY+.031,sculptureZ,6.67,.065,6.67);
    part('disk','metal',0x655e55,sculptureX,walkY+.060,sculptureZ,5.87,.041,5.87);
    part('disk','curb',0x788285,sculptureX,walkY+.215,sculptureZ,4.72,.315,4.72);
    part('ring','metal',0x786b62,sculptureX,walkY+1.78,sculptureZ,3.04,3.04,3.04,.52,-.30);
    part('ring','light',0x7de8cf,sculptureX,walkY+1.78,sculptureZ,2.86,2.86,2.86,.52,-.30);
    part('ring','metal',0x777062,sculptureX,walkY+1.75,sculptureZ,2.60,2.60,2.60,1.75,.22);
    solid(sculptureX,walkY+.22,sculptureZ,3.4,.43,3.4,.78);
    markerSpill(sculptureX,sculptureZ,walkY+.016,8.1,7.2,0x77dbd2);
    bench(15.4,40.3,Math.PI,0x6ce7d6);
    bench(10.35,36.1,Math.PI/2,0x6ce7d6);
    bench(22.9,29.0,Math.PI,0x6ce7d6);
    bench(-14.3,39.1,Math.PI,0x6ce7d6);
    bench(-8.1,35.2,Math.PI/2,0x6ce7d6);
    bench(-34.2,13.1,0,0x62988c);
    lamp(11.45,19.9,0xffa765);
    lamp(23.0,39.75,0x81f3dd);
    lamp(-13.7,22.8,0xffbd84);
    lamp(-19.4,40.2,0x81f3dd);
    lamp(-37.14,25.29,0xffbd84);
    block('curb',0x827b6d,-15,walkY+.225,35.7,5.79,.45,2.7);
    block('matte',0x574f3e,-15,walkY+.449,35.7,5.51,.075,2.43);
    solid(-15,walkY+.225,35.7,5.79,.45,2.7);
    for (let i=0;i<22;i++) {
      const h=.20+random()*.49;
      part('leaves','foliage',i%3 ? 0x4d694b : 0x718052,-15+(random()-.5)*4.97,
        walkY+.47+h*.5,35.7+(random()-.5)*2.16,.52+h,h,.48+h,random()*6.28);
    }
    kiosk({id:'little-hours-counter',x:30.88,z:23.0,toward:-1,cloth:0x85544f,trim:0xbb8e64,
      title:'LITTLE HOURS',subtitle:'COFFEE PICKUP',contents:'cups',wall:33.79});
    kiosk({id:'corner-press-counter',x:-23.06,z:30.7,toward:1,cloth:0x615f72,trim:0xa38b7c,
      title:'CORNER PRESS',subtitle:'USED BOOKS',contents:'print',wall:-26.46});
    kiosk({id:'produce-counter',x:-22.6,z:21.05,toward:1,cloth:0x59786e,trim:0x829680,
      title:'MARKET PRODUCE',contents:'produce'});
    publicFacilities();
    rubble(-18.45,41.1,3.8,.85,10);

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

    if (typeof document !== 'undefined' && signText) {
      const width=4.47, height=.89;
      const {canvas,ctx}=signText.canvas(width,height,512,128);
      ctx.fillStyle='#17221e'; ctx.fillRect(0,0,512,128);
      ctx.strokeStyle='#afea91'; ctx.lineWidth=4; ctx.strokeRect(8,8,496,112);
      ctx.fillStyle='#daf4bd'; ctx.textAlign='center';
      ctx.font='800 44px system-ui'; signText.text(ctx,'SWITCHYARD PARK',256,61,476);
      ctx.font='600 22px monospace'; signText.text(ctx,'WEST RING',256,95,476);
      const map = new THREE.CanvasTexture(canvas);
      map.encoding = THREE.sRGBEncoding;
      const display = new THREE.MeshBasicMaterial({map,toneMapped:false});
      const geometry = new THREE.BoxGeometry(width,height,.19);
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
