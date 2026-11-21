(function(root, factory) {
  const vault = factory();
  if (typeof module === 'object' && module.exports) module.exports = vault;
  else root.DrivePortfolioUnderwriting = vault;
})(globalThis, function() {
  'use strict';

  const concreteFile = typeof document !== 'undefined' && document.currentScript?.src
    ? new URL('../assets/portfolio-type/board-concrete.webp',document.currentScript.src).href
    : 'assets/portfolio-type/board-concrete.webp';
  const levels = [
    {
      floor:8.8, roof:21,
      base:[[-7.85,-9.30],[-4.80,-12.24],[3.7,-12.22],[7.62,-9.84],[8.08,8.24],[5.08,12.14],[-4.19,12.13],[-7.83,9.16]],
      top:[[-7.38,-9.32],[-4.59,-12.04],[3.92,-11.95],[7.61,-9.28],[8.12,8.53],[5.15,12.25],[-4.37,12.22],[-7.36,9.44]],
      stories:[8.8,12.3,16.09,19.2,21]
    },{
      floor:21, roof:37,
      base:[[-6.31,-7.88],[-3.62,-9.91],[4.64,-9.75],[7.92,-7.25],[8.47,7.36],[5.42,11.28],[-3.78,11.25],[-5.74,8.71]],
      top:[[-5.92,-7.49],[-3.17,-9.78],[4.45,-9.64],[7.76,-7.51],[7.42,7.10],[4.73,10.82],[-2.21,10.82],[-3.86,7.80]],
      stories:[21,25,29,32.6,37]
    },{
      floor:37, roof:53.6,
      base:[[-3.95,-6.40],[-1.95,-8.51],[4.10,-8.45],[7.21,-6.14],[7.18,6.21],[4.47,8.24],[-1.34,8.27],[-3.55,5.42]],
      top:[[-1.75,-5.72],[.12,-7.16],[4.03,-7.16],[6.45,-5.21],[6.63,3.68],[4.62,5.99],[1.04,5.99],[-.71,3.50]],
      stories:[37,41.05,45.18,49.31,53.6]
    }
  ];
  const slots = {0:[.50],3:[.16,.44,.68,.89],5:[.20,.48,.79],6:[.52],7:[.13,.34,.57,.81]};
  const masonryTints = [0xa19991,0xb7a49a,0xbcb0a6,0x9d9998,0xa9988d,0xafa49b];

  function attach(THREE, world, {tower,materials,instance,beam}) {
    const root = new THREE.Group();
    root.name = 'portfolio-zenith-records-vault';
    world.add(root);
    const concrete = new THREE.MeshStandardMaterial({color:0x544b46,roughness:.95,metalness:.03,vertexColors:true});
    const shutters = new THREE.MeshStandardMaterial({color:0x41382f,roughness:.77,metalness:.26,vertexColors:true,
      emissive:0x422d21,emissiveIntensity:.10});
    const slitGlass = new THREE.MeshStandardMaterial({color:0xc49a6d,roughness:.64,metalness:.16,vertexColors:true,
      emissive:0x694020,emissiveIntensity:.37});
    const bronze = new THREE.MeshStandardMaterial({color:0x665144,roughness:.48,metalness:.46,vertexColors:false});
    const slate = new THREE.MeshStandardMaterial({color:0x45464a,roughness:.72,metalness:.20,vertexColors:true});
    const corporate = new THREE.MeshStandardMaterial({color:0x3e4a48,roughness:.33,metalness:.46,vertexColors:true,
      emissive:0x4d4430,emissiveIntensity:.15});
    if (typeof document !== 'undefined') {
      const texture = new THREE.TextureLoader().load(concreteFile,loaded=>{
        if (!root.parent) return loaded.dispose();
        concrete.map = loaded;
        concrete.color.setHex(0xbeaeaa);
        concrete.needsUpdate = true;
      },undefined,()=>{ /* Keep the solid concrete material if the map fails. */ });
      texture.name = 'records-vault-board-form';
      texture.encoding = THREE.sRGBEncoding;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
    }
    const buffers = new Map();
    const finishes = {concrete,shutters,slitGlass,slate,corporate};
    const shade = new THREE.Color();
    function triangle(kind,points,tint,uv) {
      if (!buffers.has(kind)) buffers.set(kind,{positions:[],colors:[],uvs:[]});
      const batch = buffers.get(kind);
      shade.setHex(tint);
      for (const [index,position] of points.entries()) {
        batch.positions.push(...position);
        batch.colors.push(shade.r,shade.g,shade.b);
        batch.uvs.push(...uv[index]);
      }
    }
    function quad(kind,corners,tint,uv) {
      for (const order of [[0,2,1],[1,2,3]]) {
        triangle(kind,order.map(i=>corners[i]),tint,order.map(i=>uv[i]));
      }
    }
    function point(level,side,y,u,offset=0) {
      const t = THREE.MathUtils.clamp((y-level.floor)/(level.roof-level.floor),0,1);
      const end = (side+1)%level.base.length;
      const x0=THREE.MathUtils.lerp(level.base[side][0],level.top[side][0],t);
      const z0=THREE.MathUtils.lerp(level.base[side][1],level.top[side][1],t);
      const dx=THREE.MathUtils.lerp(level.base[end][0],level.top[end][0],t)-x0;
      const dz=THREE.MathUtils.lerp(level.base[end][1],level.top[end][1],t)-z0;
      const length=Math.hypot(dx,dz);
      return [tower.x+x0+dx*u+dz*offset/length,y,tower.z+z0+dz*u-dx*offset/length];
    }
    function strip(level,side,l,r,b,t,kind,tint,offset=0) {
      const a=level.base[side], c=level.base[(side+1)%level.base.length];
      const length=Math.hypot(c[0]-a[0],c[1]-a[1]);
      const u0=(side*13.2+l*length)/3.12,u1=(side*13.2+r*length)/3.12;
      quad(kind,[point(level,side,b,l,offset),point(level,side,b,r,offset),
        point(level,side,t,l,offset),point(level,side,t,r,offset)],tint,
      [[u0,b/2.75],[u1,b/2.75],[u0,t/2.75],[u1,t/2.75]]);
    }
    function lid(level,y,offset,tint) {
      const center=[tower.x+.84,y,tower.z-.18];
      const uv=point=>[point[0]/3.12,point[2]/2.75];
      for (let side=0;side<8;side++) {
        const a=point(level,side,y,0,offset),b=point(level,(side+1)%8,y,0,offset);
        triangle('slate',[center,b,a],tint,[uv(center),uv(b),uv(a)]);
      }
    }
    const detail=(name,material,a,b,w,h,color=null)=>beam('portfolio-zenith-'+name,material,a,b,w,h,color);
    const block=(name,material,p,w,h,d,yaw=0)=>instance('portfolio-zenith-'+name,material,...p,w,h,d,yaw);

    for (const [stage,level] of levels.entries()) {
      for (let side=0;side<8;side++) {
        const oldOpenings = slots[side] || [];
        for (let row=1;row<level.stories.length;row++) {
          const y0=level.stories[row-1],y1=level.stories[row];
          const tint=masonryTints[(side*7+row*3+stage)%masonryTints.length];
          if (!oldOpenings.length || stage===1 && row===2 && side===7) {
            strip(level,side,0,1,y0,y1,'concrete',tint);
            continue;
          }
          const b=y0+(y1-y0)*.48, t=b+(stage===2 ? .50 : .59);
          strip(level,side,0,1,y0,b,'concrete',tint);
          strip(level,side,0,1,t,y1,'concrete',tint);
          let from=0;
          for (const [index,center] of oldOpenings.entries()) {
            if ((index*7+side*3+row+stage)%7===0) continue;
            const [l,r]=[center-.044,center+.044];
            strip(level,side,from,l,b,t,'concrete',tint);
            const edge = .47;
            const a=point(level,side,b,l),c=point(level,side,t,l),i=point(level,side,b,l,-edge),k=point(level,side,t,l,-edge);
            const d=point(level,side,b,r),e=point(level,side,t,r),j=point(level,side,b,r,-edge),m=point(level,side,t,r,-edge);
            const uv=[[0,0],[.4,0],[0,.6],[.4,.6]];
            quad('concrete',[i,a,k,c],0x655a52,uv);
            quad('concrete',[d,j,e,m],0x6d6059,uv);
            quad('concrete',[a,d,i,j],0x87746a,uv);
            quad('concrete',[k,m,c,e],0x544b46,uv);
            strip(level,side,l,r,b,t,(side+stage*7+row*13+index*5)%9<2?'slitGlass':'shutters',0xa0968c,-edge);
            from=r;
          }
          strip(level,side,from,1,b,t,'concrete',tint);
        }
      }
      // The slab edges and roof caps read as part of the load-bearing shell.
      for (const y of [level.roof-.41,level.floor+(stage===0?5.59:7.15)]) {
        for (let side=0;side<8;side++) {
          const out=side>=5 ? .35 : .22;
          strip(level,side,0,1,y-.28,y+.27,'slate',0x9e8f88,out);
          detail('eyebrow-reveals',materials.steel,point(level,side,y-.29,0,out*.55),
            point(level,side,y-.29,1,out*.55),out*1.65,.116);
        }
        lid(level,y+.27,.25,0x847a76);
      }
      lid(level,level.roof,0,0x82766f);
    }

    const lower=levels[0], middle=levels[1];
    // Heavy feed shafts and rusted connections belong to the original vault.
    for (const side of [3,7]) for (const u of [.18,.76]) {
      for (const level of [lower,middle]) {
        detail('bearing-webs',materials.steel,point(level,side,level.floor+.1,u,.11),
          point(level,side,level.roof-.43,u,.11),.46,.39);
      }
      const y=19.62;
      detail('weathered-fasteners',bronze,point(lower,side,y,u-.025,.35),point(lower,side,y,u+.025,.35),.22,.28);
    }
    for (const x of [16.95,18.60,20.08]) {
      block('roof-vents',materials.steel,[tower.x+x-17,54.35,tower.z-2.2],.98,1.52,5.42,-.14);
      block('roof-vent-hoods',bronze,[tower.x+x-17,55.16,tower.z-2.4],1.13,.30,5.95,-.14);
    }

    // A short transition joins the north chamfer to the existing catwalk.
    const dockX=tower.x-6.56, dockZ=tower.z+11;
    block('dock-deck',materials.steel,[dockX,17.53,dockZ],2.52,.53,2.42);
    block('dock-hood',materials.steel,[dockX+.13,20.04,dockZ],2.73,.36,2.47);
    for (const offset of [-1,1]) {
      block('dock-stanchions',bronze,[dockX-.76,18.77,dockZ+offset*1.13],.17,2.15,.19);
      block('dock-screens',materials.steel,[dockX+.55,18.75,dockZ+offset*1.13],1.89,2.20,.13);
      detail('access-light',materials.light,[dockX-.41,19.78,dockZ+offset*1.18],
        [dockX+1.37,19.78,dockZ+offset*1.18],.044,.068,0xf5ba80);
    }

    // One chamfered equipment rack is the only new skin on the upper vault.
    for (const side of [5,6]) for (const [column,band] of [[0,[.14,.33]],[1,[.35,.53]],[2,[.55,.72]],[3,[.74,.91]]]) {
      if (side===5 && column<2) continue;
      const [a,b]=band;
      for (const y of [22.34,25.45,28.56,31.67]) {
        strip(middle,side,a,b,y,y+2.96,'corporate',column%2 ? 0x757a71 : 0x636768,.42);
        detail('access-frames',bronze,point(middle,side,y,a,.47),point(middle,side,y+2.98,a,.47),.108,.114);
        detail('access-frames',bronze,point(middle,side,y,a,.49),point(middle,side,y,b,.49),.137,.135);
        detail('access-frames',materials.steel,point(middle,side,y-.12,a,.04),point(middle,side,y-.12,a,.48),.17,.14);
        if ((side+column)%3===0) detail('access-light',materials.light,point(middle,side,y+.144,a+.018,.48),
          point(middle,side,y+.144,b-.025,.48),.035,.049,0xf4bd82);
      }
    }

    if (typeof document !== 'undefined') {
      const center=point(lower,6,15.22,.49,.43), a=point(lower,6,15.22,.38), b=point(lower,6,15.22,.60);
      addWordmark(THREE,root,bronze,center,Math.atan2(b[2]-a[2],a[0]-b[0]));
    }
    for (const [kind,batch] of buffers) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(batch.colors,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uvs,2));
      geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,finishes[kind]);
      mesh.name='portfolio-zenith-vault-'+kind;
      root.add(mesh);
    }
    return root;
  }

  function addWordmark(THREE,root,frame,position,yaw) {
    const canvas=document.createElement('canvas');
    canvas.width=512;
    canvas.height=256;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#201e1d';
    ctx.fillRect(0,0,512,256);
    ctx.strokeStyle='#aa8365';
    ctx.lineWidth=5;
    ctx.strokeRect(8,8,496,240);
    ctx.fillStyle='#ffe4ae';
    ctx.font='900 107px system-ui, sans-serif';
    ctx.fillText('ZENITH',23,117,458);
    ctx.fillStyle='#d6af90';
    ctx.font='700 36px ui-monospace, monospace';
    ctx.fillText('UNDERWRITING',27,171,458);
    ctx.fillStyle='#806d63';
    ctx.font='700 22px ui-monospace, monospace';
    ctx.fillText('RECORDS VAULT 07',27,218,458);
    const map=new THREE.CanvasTexture(canvas);
    map.encoding=THREE.sRGBEncoding;
    map.anisotropy=4;
    const geometry=new THREE.BoxGeometry(3.84,1.73,.30);
    geometry.clearGroups();
    geometry.addGroup(0,24,0);
    geometry.addGroup(24,6,1);
    geometry.addGroup(30,6,0);
    const mesh=new THREE.Mesh(geometry,[frame,new THREE.MeshBasicMaterial({map,toneMapped:false})]);
    mesh.name='portfolio-zenith-vault-wordmark';
    mesh.userData.portfolioAdFace = true;
    mesh.userData.portfolioAdId = 'zenith-records-vault';
    mesh.position.fromArray(position);
    mesh.rotation.y=yaw;
    root.add(mesh);
    const bracket=new THREE.BoxGeometry(.21,.36,.67);
    for (const x of [-1.21,1.21]) {
      const support=new THREE.Mesh(bracket,frame);
      support.position.set(x,-.17,-.39).applyEuler(mesh.rotation).add(mesh.position);
      support.rotation.copy(mesh.rotation);
      root.add(support);
    }
  }

  return {attach};
});
