(function(root, factory) {
  const facades = factory();
  if (typeof module === 'object' && module.exports) module.exports = facades;
  else root.DrivePortfolioFacades = facades;
})(globalThis, function() {
  'use strict';

  const sides = {
    north:[0,-1,Math.PI], south:[0,1,0],
    west:[-1,0,-Math.PI/2], east:[1,0,Math.PI/2]
  };
  const styles = {
    market:{
      trim:0x735853,structure:0x645454,cladding:0xe4c7b8,shade:0xa28772,rail:0x5e5051,
      lit:[0x997161,0xb28b73,0x886a68], dark:[0x242426,0x3d353b], light:0xffd09d
    },
    campus:{
      trim:0x596d68,structure:0x475a56,cladding:0xa5b1ad,shade:0x93a291,rail:0x566864,
      lit:[0x8aab9d,0x95a6a2,0xa59982],dark:[0x263437,0x373e40],light:0xdcfce3
    },
    service:{
      trim:0x66605b,structure:0x4e5057,cladding:0xc5b9ad,shade:0x807567,rail:0x62686c,
      lit:[0xa18c68,0x66858a,0x978975],dark:[0x26343a,0x3a373d],light:0xffd092
    },
    transfer:{
      trim:0x637881,structure:0x4f5c67,cladding:0xaac1c8,shade:0x647e86,rail:0x546c79,
      lit:[0x74949d,0x659098,0xa29c89],dark:[0x202832,0x343841],light:0xa1e6e5
    }
  };
  const assetRoot = typeof document !== 'undefined' && document.currentScript?.src
    ? new URL('../assets/portfolio-type/',document.currentScript.src).href : 'assets/portfolio-type/';
  const skinSettings = {
    market:['terrace-brick.webp',2.7,2.05,.83,.08],
    campus:['cast-stone.webp',3.3,2.5,.71,.13],
    service:['ribbed-titanium.webp',2.45,3.4,.60,.28],
    transfer:['ribbed-titanium.webp',2.7,3.8,.48,.34]
  };

  // Fixed districts and levels keep the reveals clear of the billboard
  // cavities, lower shop awnings, existing skybridges, and ramp openings.
  const fronts = [
    {at:[-23,-78,0],face:'east',floors:[5.75,9.15,12.55,15.95],cols:4,style:'transfer'},
    {at:[-68,2,0],face:'north',floors:[4.82,7.08],cols:7,style:'market',balconies:true},
    {at:[-68,2,0],face:'east',floors:[4.82,7.08],cols:4,style:'market'},
    {at:[-75,-42,0],face:'south',floors:[4.82,7.10],cols:6,style:'market',balconies:true},
    {at:[-92.5,-43.5,0],face:'south',floors:[4.65,7.73,10.81,13.89],cols:3,style:'market',balconies:true},
    {at:[-92.5,-43.5,0],face:'west',floors:[4.65,7.73,10.81,13.89],cols:4,style:'market'},
    {at:[-61.2,14.5,0],face:'north',floors:[4.97,8.39,11.81,15.23],cols:4,style:'market',balconies:true},
    {at:[-31.5,-27.5,0],face:'south',floors:[5.0,7.75],cols:4,style:'transfer'},
    {at:[-31.5,-27.5,0],face:'east',floors:[4.92,7.62],cols:5,style:'transfer'},
    {at:[-31.5,-27.5,0],face:'west',floors:[4.92,7.62],cols:5,style:'transfer'},
    {at:[-31.5,-27.5,22.5],face:'east',floors:[27.6,31.1,34.6,38.1,41.6],cols:5,style:'transfer'},
    {at:[-31.5,-27.5,22.5],face:'west',floors:[27.6,31.1,34.6,38.1,41.6],cols:5,style:'transfer'},
    {at:[36.5,-27.5,0],face:'south',floors:[5.0,7.75],cols:5,style:'transfer'},
    {at:[36.5,-27.5,0],face:'north',floors:[5.0,7.75],cols:5,style:'transfer'},
    {at:[-63.5,62.4,0],face:'south',floors:[6.8,10.65,14.50,18.35],cols:4,style:'campus'},
    {at:[-63.5,62.4,0],face:'east',floors:[6.8,10.65,14.50,18.35],cols:3,style:'campus',balconies:true},
    {at:[-55.8,94.5,0],face:'north',floors:[6.3,9.75,13.2,16.65,20.1],cols:4,style:'campus',balconies:true},
    {at:[-55.8,94.5,0],face:'east',floors:[6.3,9.75,13.2,16.65,20.1],cols:3,style:'campus'},
    {at:[-43,101,0],face:'north',floors:[5.45,8.8,12.15],cols:3,style:'campus',balconies:true},
    {at:[-125,28,0],face:'east',floors:[4.72],cols:6,style:'campus'},
    {at:[129,1.2,0],face:'west',floors:[5.65,9.15,12.65,16.15,19.65],cols:3,style:'service'},
    {at:[130,-60,0],face:'west',floors:[4.85,7.07],cols:6,style:'service'},
    {at:[133.3,-30.4,0],face:'west',floors:[5.4,8.03,10.65],cols:4,style:'service'},
    {at:[133.3,-30.4,0],face:'north',floors:[5.4,8.03,10.65],cols:5,style:'service'}
  ];

  function matchingBlock(buildings,[x,z,y]) {
    return buildings.find(b=>Math.abs(b.x-x)<.04 && Math.abs(b.z-z)<.04 && Math.abs(b.baseY-y)<.04);
  }

  function facadeSkins(THREE) {
    if (typeof document === 'undefined') return {};
    const loader = new THREE.TextureLoader();
    const textures = new Map();
    return Object.fromEntries(Object.entries(skinSettings).map(([type,[file,uSpan,vSpan,roughness,metalness]])=>{
      if (!textures.has(file)) {
        const texture = loader.load(assetRoot+file);
        texture.name = file;
        texture.encoding = THREE.sRGBEncoding;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = 4;
        textures.set(file,texture);
      }
      const material = new THREE.MeshStandardMaterial({color:0xffffff,map:textures.get(file),roughness,metalness});
      material.customProgramCacheKey = ()=>'portfolio-facade-skin-at-world-scale';
      material.onBeforeCompile = shader=>{
        shader.uniforms.skinSpan = {value:new THREE.Vector2(uSpan,vSpan)};
        shader.vertexShader = 'varying vec2 vSkinUv; uniform vec2 skinSpan;\n'+shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
          vec3 size = vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
          vec3 origin = instanceMatrix[3].xyz;
          vec2 face = abs(normal.y) > .5 ? size.xz : vec2(abs(normal.x) > .5 ? size.z : size.x,size.y);
          vSkinUv = (uv * face + vec2(origin.x + origin.z*.23,origin.y)) / skinSpan;`);
        shader.fragmentShader = ('varying vec2 vSkinUv;\n'+shader.fragmentShader).replace('#include <map_fragment>',
          THREE.ShaderChunk.map_fragment.replace('vUv','vSkinUv'));
      };
      return ['skin-'+type,material];
    }));
  }

  function attach(THREE, world, city) {
    const root = new THREE.Group();
    root.name = 'portfolio-facades';
    const box = new THREE.BoxGeometry(1,1,1);
    const paint = new THREE.MeshStandardMaterial({color:0xffffff,roughness:.76,metalness:.14});
    const metal = new THREE.MeshStandardMaterial({color:0xffffff,roughness:.43,metalness:.37});
    const glass = new THREE.MeshBasicMaterial({color:0x91a9c0,transparent:true,opacity:.115,depthWrite:false});
    const interior = new THREE.MeshBasicMaterial({color:0xffffff});
    const bulbs = new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});
    const materials = {paint,metal,glass,interior,bulbs,...facadeSkins(THREE)};
    const batches = new Map();
    const transform = new THREE.Object3D();

    function makeWall(b,face) {
      const [nx,nz,yaw] = sides[face];
      const x=b.x+nx*b.width/2, z=b.z+nz*b.depth/2;
      function part(kind,u,y,d,w,h,depth,color,pitch=0) {
        if (!batches.has(kind)) batches.set(kind,[]);
        transform.position.set(x+nx*d+nz*u,y,z+nz*d-nx*u);
        transform.scale.set(w,h,depth);
        transform.rotation.set(pitch,yaw,0,'YXZ');
        transform.updateMatrix();
        batches.get(kind).push({matrix:transform.matrix.clone(),color});
      }
      return part;
    }

    function balcony(part,x,bottom,w,front,style,variant) {
      const outer = front+.67, length = outer-.13;
      const floor = bottom-.085;
      const railWidth=w+.17;
      part('paint',x,floor,outer/2,railWidth,.17,outer,style.structure);
      part('metal',x,floor+.10,outer-.015,railWidth,.12,.14,style.rail);
      part('metal',x,floor+1.03,outer,railWidth,.09,.081,style.rail);
      part('metal',x,floor+.48,outer,railWidth,.067,.066,style.rail);
      for (let i=0;i<=5;i++) {
        const u=x+railWidth*(i/5-.5);
        part('metal',u,floor+.55,outer,.057,.96,.065,style.rail);
      }
      for (const direction of [-1,1]) {
        const u=x+direction*(railWidth/2-.02);
        part('metal',u,floor+1.03,outer-length/2,.067,.075,length,style.rail);
        part('metal',u,floor+.53,front+.08,.068,.94,.075,style.rail);
        part('paint',u,floor-.43,.39,.125,.86,.11,style.structure,-.47);
      }
      if (variant%2 === 0) {
        const u=x+w*.28;
        part('paint',u,floor+.29,outer-.26,w*.28,.34,.30,0x575c54);
        part('paint',u,floor+.51,outer-.27,w*.23,.18,.25,0x53624d);
      } else {
        const u=x-w*.25;
        part('metal',u,floor+.29,outer-.33,.55,.38,.30,0x5f6061);
        for (let rail=0;rail<3;rail++)
          part('paint',u,floor+.20+rail*.085,outer-.173,.40,.032,.024,0x323841);
      }
    }

    function fitRoom(part,x,y,w,h,front,style,type,variant,lit) {
      const floor=y-h/2, top=y+h/2;
      const backing = lit ? style.lit[variant%style.lit.length] : style.dark[variant%style.dark.length];
      const detail = lit ? 0x4e4547 : 0x292d34;
      part('interior',x,y,.054,w,h,.061,backing);
      part('interior',x,floor+.049,front*.445,w,.098,front*.86,lit?0x665856:detail);
      part('interior',x,top-.052,front*.445,w,.104,front*.86,lit?0x827773:detail);
      if (lit) {
        part('bulbs',x,top-.117,front*.31,w*(variant%3===0 ? .58 : .36),.07,.13,style.light);
        if ((type==='campus' && variant%3!==0) || variant%4===3) {
          const shelfX=x-w*.25;
          const shelves = variant%2 ? 3 : 2;
          part('interior',shelfX,floor+.174*shelves,.28,w*.35,.348*shelves,.25,detail);
          for (let i=0;i<shelves;i++) {
            const height=floor+.26+i*.32;
            part('interior',shelfX,height,.437,w*.32,.036,.10,0x8f7a67);
            part('interior',shelfX-.06,height+.102,.435,w*(i%2 ? .24 : .17),.166,.12,[0xa68f76,0x788b81,0x936d6d][i]);
          }
        } else {
          const tableX=x+w*.18;
          part('interior',tableX,floor+.48,front*.52,w*.49,.095,.25,detail);
          part('interior',tableX,floor+.27,front*.54,w*.39,.42,.16,0x615052);
          part('interior',tableX-.18,floor+.64,front*.57,.16,.22,.095,0xa38776);
          part('interior',x-w*.34,floor+.57,.19,.20,1.02,.10,0x655c5d);
        }
      }
      if (variant%4 === 0 || (!lit && variant%2===0)) {
        // Slats and folds sit behind the frame and occlude what is behind them.
        const shadeW = w*(lit ? .47 : .85);
        const shadeX = x-(w-shadeW)*.37;
        for (let row=0;row<(lit ? 5 : 8);row++) {
          const shadeY=top-.17-row*h*.076;
          part('interior',shadeX,shadeY,front-.23,shadeW,.072,.043,lit?style.shade:detail);
        }
      } else if (variant%4===2) {
        for (let fold=0;fold<4;fold++) {
          const shadeX=x+w*(.26+fold*.05);
          part('interior',shadeX,y,front-.20,w*.055,h*.92,.074,fold%2 ? detail : style.shade);
        }
      }
      part('glass',x,y,front-.075,w-.13,h-.107,.022,null);
      const mullionX=x+w*(variant%2===0 ? -.135 : .128);
      part('metal',mullionX,y,front-.037,.066,h,.09,style.trim);
      if (variant%3!==2)
        part('metal',x,y-h*.18,front-.032,w,.068,.098,style.trim);
    }

    const placements = [];
    for (const [index,spec] of fronts.entries()) {
      const {at,face,floors,cols,style:type,balconies} = spec;
      const b = matchingBlock(city.buildings,at);
      if (!b) continue;
      const style = styles[type];
      const width=(sides[face][0] ? b.depth : b.width)-.68;
      const front=type==='campus' ? .87 : type==='market' ? .76 : .69;
      const openingHeight=type==='campus' ? 2.05 : 1.66;
      const rowHeights=floors.filter(y=>y-openingHeight/2>b.baseY+.28 && y+openingHeight/2<b.baseY+b.height-.22);
      if (!rowHeights.length || width<4) continue;
      placements.push({x:b.x,z:b.z,face,style:type,stories:rowHeights.length,rooms:rowHeights.length*cols});
      const emit = makeWall(b,face);
      const pier = type==='campus' ? .24 : .30;
      const roomWidth = (width-pier*(cols+1))/cols;
      const lowest = rowHeights[0]-openingHeight/2-.15;
      const highest = rowHeights.at(-1)+openingHeight/2+.18;
      const cover = highest-lowest;
      const surface = 'skin-'+type;
      const wallTint = materials[surface] ? style.cladding : style.structure;
      for (let col=0;col<=cols;col++) {
        const u=-width/2+pier/2+col*(roomWidth+pier);
        emit(surface,u,(lowest+highest)/2,front/2,pier,cover,front,wallTint);
        emit('metal',u,(lowest+highest)/2,front+.022,.065,cover+.07,.058,style.trim);
      }
      for (const [row,y] of rowHeights.entries()) {
        const lower=y-openingHeight/2;
        const from=row>0 ? rowHeights[row-1]+openingHeight/2 : lowest;
        emit(surface,0,(lower+from)/2,front/2,width,lower-from,front,wallTint);
        emit('metal',0,lower-.052,front+.035,width+.095,.105,.145,style.trim);
        for (let col=0;col<cols;col++) {
          const x=-width/2+pier+(col+.5)*roomWidth+col*pier;
          const variant=(index*13+row*17+col*29+(col+2)*(row+3))%43;
          const lit=(variant*11+row*31+col*19+index*7)%13<8;
          fitRoom(emit,x,y,roomWidth,openingHeight,front,style,type,variant,lit);
          if (balconies && (index+row*2+col)%4===1) balcony(emit,x,lower,roomWidth,front,style,variant);
        }
      }
      emit(surface,0,highest-.09,front*.53,width+.15,.18,front*1.06,wallTint);
      emit('metal',0,highest+.036,front-.10,width+.20,.10,.36,style.trim);
    }

    for (const [kind,parts] of batches) {
      const material = materials[kind] || paint;
      const mesh = new THREE.InstancedMesh(box,material,parts.length);
      mesh.name = 'portfolio-facade-'+kind;
      for (const [i,{matrix,color}] of parts.entries()) {
        mesh.setMatrixAt(i,matrix);
        if (color !== null) mesh.setColorAt(i,new THREE.Color(color).convertSRGBToLinear());
      }
      mesh.instanceMatrix.needsUpdate = true;
      root.add(mesh);
    }
    root.userData.facades=placements;
    world.add(root);
    return root;
  }

  return {attach};
});
