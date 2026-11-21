(function(root,factory) {
  const campus=factory();
  if (typeof module==='object' && module.exports) module.exports=campus;
  else root.DrivePortfolioEducationBuildings=campus;
})(globalThis,function() {
  'use strict';

  const east=Math.PI/2;
  const slate=0x465760, limestone=0xbdb099;
  const rust=[0x935c4c,0xa66751,0x854d43,0xa57859,0x9a664d,0x7e4c42];
  const stone=[0xaa896d,0xb69778,0x9d7f6c,0xa78067,0xbe9b7d,0xa58c73,0x997b69];
  const assetBase=typeof document!=='undefined' && document.currentScript?.src
    ? new URL('../assets/portfolio/',document.currentScript.src).href : 'assets/portfolio/';
  const sites=[
    {id:'bs-computer-science',x:-86,z:36,heading:-east,width:20,depth:20.2,height:6.65,
      name:'COMPUTING HALL',degree:'B.S. COMPUTER SCIENCE',light:0x9de8d5,design:computing},
    {id:'ba-mathematics',x:-130.8,z:25.2,heading:east,width:19.8,depth:20.6,height:7.10,
      name:'MATHEMATICS HALL',degree:'B.A. MATHEMATICS',light:0xcfc0fa,design:mathematics},
    {id:'ms-computer-science',x:-86.5,z:59.8,heading:-east,width:19.4,depth:16,height:7.70,
      name:'GRADUATE RESEARCH TOWER',degree:'M.S. COMPUTER SCIENCE',light:0xa4e5f5,design:graduate}
  ];

  const blueprints=sites.map(site=>{
    const parts=[],volumes=[];
    const bounds=(x,z,width,depth,baseY,height)=>volumes.push({
      x:site.x+x,z:site.z+z,width,depth,baseY,height
    });
    function box(name,x,y,z,width,height,depth,color,finish='metal') {
      parts.push({kind:'box',name,x,y,z,width,height,depth,color,finish});
    }
    function mass(name,x,z,width,depth,baseY,height,color) {
      box(name,x,baseY+height/2,z,width,height,depth,color,'masonry');
      bounds(x,z,width,depth,baseY,height);
    }
    function beam(name,from,to,width,height,color,finish='metal') {
      parts.push({kind:'beam',name,from,to,width,height,color,finish});
    }
    function gable(name,x,z,width,depth,eaves,peak,alongX=true) {
      parts.push({kind:'gable',name,x,z,width,depth,eaves,peak,alongX});
      bounds(x,z,width,depth,eaves,peak-eaves);
    }
    function octagon(name,x,z,rx,rz,baseY,height,color) {
      parts.push({kind:'octagon',name,x,z,rx,rz,baseY,height,color});
      bounds(x,z,rx*2,rz*2,baseY,height);
    }
    function octRoof(name,x,z,radius,eaves,peak) {
      parts.push({kind:'octRoof',name,x,z,radius,eaves,peak});
      bounds(x,z,radius*2,radius*2,eaves,peak-eaves);
    }
    mass('sandstone podium',0,0,site.width,site.depth,0,site.height,0xa5856c);
    site.design({mass,box,beam,gable,octagon,octRoof,...site});
    return {site,parts,volumes};
  });
  const colliders=blueprints.flatMap(({volumes})=>volumes);

  function computing({mass,box,beam,gable}) {
    mass('central lab hall',0,0,18.5,11.4,6.65,7.50,0xad8b6d);
    gable('terracotta main gable',0,0,19.1,12.4,14.15,20.5);
    for (const side of [-1,1]) {
      const z=side*7.73;
      mass('brick lab wings',.64,z,15.67,4.68,6.65,3.36,0x9e8069);
      gable('lower workshop roof',.64,z,16.8,5.69,10.01,13.67);
      box('copper downpipe',-8.83,7.06,z,.22,7.31,.29,0x856f5a);
      for(let j=0;j<6;j++){
        const x=-5.07+j*2.04;
        box('workshop clearstory slots',x,8.43,z+side*2.391,1.45,1.31,.16,0x31404a);
        box('window sand sill',x,7.72,z+side*2.443,1.68,.12,.27,limestone);
        box('workshop task glow',x,8.32,z+side*2.482,.96,.073,.036,j%3===0?0xc8b991:0xa5c6b9,'light');
      }
      beam('lab steam feed',[-9.22,5.6,side*6.23],[-9.22,9.72,side*6.23],.127,.14,slate);
    }
    for (const y of [7.16,10.22,13.45]) {
      for (const z of [-3.77,-1.90,1.90,3.77]) {
        box('lab window bays',-9.273,y,z,.17,1.58,1.41,0x35454b);
        box('lab window dim LEDs',-9.365,y+.42,z,.031,.047,.97,0xb9e5c9,'light');
        box('lab sill',-9.39,y-.82,z,.30,.121,1.61,limestone,'masonry');
      }
    }
    box('roof vent monitor',2.2,20.48,-.08,3.38,.74,1.38,slate);
    beam('lab roof lead',[2.13,20.55,-.065],[2.13,22.52,-.065],.126,.126,slate);
    box('lab mast glow',2.13,22.53,-.065,.21,.17,.19,0xb5d7c0,'light');
  }

  function mathematics({mass,box,beam,gable,octagon,octRoof}) {
    octagon('scholars rotunda',-.64,1.56,6.78,6.78,7.10,10.1,0xa18575);
    octRoof('eight sided clay dome',-.64,1.56,7.47,17.20,25.35);
    for(const z of [-7.05,8.42]) {
      mass('library wing',-.84,z,16.26,3.59,7.10,3.91,0xb39177);
      gable('reading wing terracotta',-.84,z,17.01,4.45,11.01,14.38);
      for(const x of [-4.80,-.72,3.33]) {
        box('wing windows',x,9.14,z+(z>0?1.85:-1.85),2.23,1.52,.144,0x383c49);
        box('limestone wing sill',x,8.36,z+(z>0?1.89:-1.89),2.48,.144,.25,limestone,'masonry');
      }
    }
    for (let i=0;i<8;i++) {
      const a=i*Math.PI/4, x=-.64+Math.cos(a)*6.08,z=1.56+Math.sin(a)*6.08;
      beam('rotunda frame straps',[x,7.46,z],[x,17.23,z],.42,.41,0xb29a80,'masonry');
    }
    for (const y of [9.3,13.5,15.9]) {
      box('rotunda optics slit',6.16,y,1.56,.114,.63,2.98,0x384047);
      box('way node',6.231,y-.195,1.56,.033,.074,2.52,0xa499cc,'light');
    }
    box('roof ornament block',-.64,25.64,1.56,1.08,.61,1.08,slate);
    beam('survey pin',[-.64,25.81,1.56],[-.64,27.77,1.56],.11,.11,slate);
  }

  function graduate({mass,box,beam,gable}) {
    mass('archive drum',0,0,13.01,12.13,7.7,7.82,0xa8856a);
    mass('stone research shaft',1.40,.54,10.46,9.71,15.52,23.36,0xa38773);
    mass('tower observatory',1.13,.54,9.74,9.15,38.88,6.91,0x9d826f);
    gable('observatory tiled roof',1.13,.54,10.97,9.93,45.79,55.1,false);
    for(const z of [-5.94,6.12])
      gable('ground stack roof',0,z,17.41,3.43,7.71,10.51);
    for(const y of [10.88,14.97,20.34,26.82,33.46,38.26,45.18]){
      const face=y<15.52?-6.51:-3.85;
      box('stone break',face-.07,y,.52,.26,.30,y<15.52?12.28:9.63,limestone,'masonry');
    }
    for(let y=17.06;y<45.49;y+=2.95) {
      const face=y<38.88?-3.84:-3.76;
      for(const z of [-2.74,.54,3.82]) {
        box('research tower recessed windows',face-.062,y,z,.17,1.64,2.58,0x30414b);
        box('lab terminals',face-.159,y-.20,z,.047,.062,1.05,
          Math.floor(y)%4===0?0xd9c26d:0x9cdbdf,'light');
      }
    }
    for(const z of [-3.91,4.98]){
      beam('tall retrofit channels',[-4.24,15.93,z],[-4.24,43.76,z],.33,.31,0x566d72);
      beam('channel indicator',[-4.44,17.12,z],[-4.44,43.2,z],.058,.057,0x9de3e5,'light');
    }
    box('observatory telemetry head',1.13,55.36,.54,2.58,.69,1.75,slate);
    beam('research array mast',[1.13,55.55,.54],[1.13,60.91,.54],.18,.17,0x677c7e);
    box('roof signal',1.13,60.93,.54,.25,.22,.28,0xcee8d4,'light');
  }

  function attach(THREE, world) {
    const campus=new THREE.Group();
    campus.name='portfolio-education-buildings';
    const geometries=new Set(),materials=new Set(),textures=new Set();
    const geometry=shape=>{geometries.add(shape);return shape;};
    const material=(type,params)=>{
      const finish=new THREE[type](params);
      materials.add(finish);
      return finish;
    };
    const color=hex=>new THREE.Color(hex).convertSRGBToLinear();
    let stoneMap=null;
    if (typeof document!=='undefined') {
      stoneMap=new THREE.TextureLoader().load(assetBase+'concrete-bump.jpg');
      stoneMap.wrapS=stoneMap.wrapT=THREE.RepeatWrapping;
      stoneMap.repeat.set(3.1,2.8);
      textures.add(stoneMap);
    }
    const shapes={
      box:geometry(new THREE.BoxGeometry(1,1,1)),
      tile:geometry(new THREE.CylinderGeometry(.5,.5,1,7,1,false,-Math.PI/2,Math.PI))
    };
    const finishes={
      metal:material('MeshStandardMaterial',{color:0xffffff,roughness:.62,metalness:.43}),
      masonry:material('MeshStandardMaterial',{color:0xffffff,bumpMap:stoneMap,bumpScale:.115,roughness:.94}),
      tile:material('MeshStandardMaterial',{color:0xffffff,bumpMap:stoneMap,bumpScale:.055,roughness:.88}),
      light:material('MeshBasicMaterial',{color:0xffffff,toneMapped:false})
    };
    const pose=new THREE.Object3D(),direction=new THREE.Vector3(),forward=new THREE.Vector3(0,0,1),up=new THREE.Vector3(0,1,0);
    const tileNormal=new THREE.Vector3(),tileAcross=new THREE.Vector3(),tileBasis=new THREE.Matrix4();
    const tint=new THREE.Color();
    for (const {site,parts} of blueprints) {
      const building=new THREE.Group();
      building.name='portfolio-education-site-'+site.id;
      building.position.set(site.x,0,site.z);
      const rows=[];
      const box=(name,x,y,z,width,height,depth,color,finish='metal')=>
        rows.push({kind:'box',name,x,y,z,width,height,depth,color,finish});
      const beam=(name,from,to,width,height,color,finish='metal',kind='beam')=>
        rows.push({kind,name,from,to,width,height,color,finish});
      function faceMesh(name,vertices,indices,tone) {
        const bounds=geometry(new THREE.BufferGeometry());
        bounds.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));
        bounds.setIndex(indices);
        bounds.computeVertexNormals();
        const mesh=new THREE.Mesh(bounds,material('MeshStandardMaterial',{color:color(tone),roughness:.93,side:THREE.DoubleSide}));
        mesh.name=building.name+': '+name;
        building.add(mesh);
      }
      for (const part of parts) {
        if (part.kind==='gable') {
          const {x,z,width,depth,eaves,peak,alongX}=part, along=alongX?width:depth, across=alongX?depth:width;
          const at=(u,y,v)=>alongX?[x+u,y,z+v]:[x+v,y,z+u];
          const a=along/2,b=across/2;
          faceMesh(part.name,[at(-a,eaves,-b),at(a,eaves,-b),at(-a,peak,0),at(a,peak,0),at(-a,eaves,b),at(a,eaves,b)],
            [0,1,3,0,3,2,2,3,5,2,5,4,0,2,4,1,5,3],0x825a4e);
          for(const side of [-1,1]) {
            beam('continuous eave brackets',at(-a,eaves-.22,side*b),at(a,eaves-.22,side*b),.24,.31,0x917760,'masonry');
            const columns=Math.max(6,Math.round(along/.63));
            const count=4;
            for(let i=0;i<columns;i++) for(let j=0;j<count;j++) {
              const u=-a+(i+.5)*along/columns;
              const t=j/count,t2=(j+1)/count;
              const p=at(u,eaves+t*(peak-eaves)+.08,side*b*(1-t)+side*.019);
              const q=at(u,eaves+t2*(peak-eaves)+.08,side*b*(1-t2)-side*.031);
              beam('split clay barrel tile',p,q,along/columns*.86,.21,rust[(i*5+j*3+(side+1)*2)%rust.length],'tile','tile');
            }
          }
          beam('ridge caps',at(-a,peak+.105,0),at(a,peak+.105,0),.43,.254,0xa0785a,'masonry');
        } else if(part.kind==='octagon' || part.kind==='octRoof') {
          const {x,z}=part,isRoof=part.kind==='octRoof';
          const bottom=isRoof?part.eaves:part.baseY, top=isRoof?part.peak:bottom+part.height;
          const rx=isRoof?part.radius:part.rx,rz=isRoof?part.radius:part.rz;
          const at=(i,y,r)=>[x+Math.cos(i*Math.PI/4)*rx*r,y,z+Math.sin(i*Math.PI/4)*rz*r];
          const list=Array.from({length:8},(_,i)=>at(i,bottom,1))
            .concat(Array.from({length:8},(_,i)=>at(i,top,isRoof?.057:1)));
          const indices=[];
          for(let i=0;i<8;i++) {
            const j=(i+1)%8;
            indices.push(i,j,8+j,i,8+j,8+i);
            if(i>1) indices.push(8,8+i-1,8+i);
            if (isRoof) {
              for(let q=0;q<7;q++) {
                const along=(q+.5)/7;
                const onFace=(y,radial)=>at(i,y,radial).map((v,k)=>v+(at(j,y,radial)[k]-v)*along);
                for(let r=0;r<5;r++){
                  const t=r/5,t2=(r+1)/5;
                  const p=onFace(bottom+(top-bottom)*t+.079,1-.943*t);
                  const tip=onFace(bottom+(top-bottom)*t2+.084,1-.943*t2);
                  beam('rotunda barrel tiles',p,tip,.65*(1-t*.8),.166,rust[(q*5+r*3+i)%rust.length],'tile','tile');
                }
              }
            }
          }
          faceMesh(part.name,list,indices,isRoof?0x87594c:part.color);
        } else rows.push(part);
      }

      const near=site.width/2,front=site.heading>0 ? near : -near;
      const local=(a,y,d)=>[front+Math.sin(site.heading)*d,y,-Math.sin(site.heading)*a];
      const facadeBox=(name,x,y,d,w,h,l,hex,finish)=>{
        const [gx,gy,gz]=local(x,y,d);
        box(name,gx,gy,gz,l,h,w,hex,finish);
      };
      // Joints and color variations are genuine shallow stone blocks, not a
      // painted checkerboard, so the stone remains legible in moving light.
      const facadeSize=site.depth;
      for(let row=0;row<10;row++) {
        const h=site.height/10,y=(row+.5)*h;
        for(let i=0;i<13;i++) {
          const spacing=facadeSize/13,x=(i-6)*spacing+(row%2===0?.27:-.27);
          if (Math.abs(x)+spacing/2>facadeSize/2+.04) continue;
          const variety=(row*3+i*5+Math.floor(i/3))%stone.length;
          facadeBox('split faced sandstone courses',x,y,.047+(variety%3)*.013,spacing-.040,h-.026,.108,stone[variety],'masonry');
        }
      }
      const structureWidth=site.id==='ba-mathematics'?10.76:site.id==='ms-computer-science'?9.96:11.4;
      facadeBox('entry shadow',0,1.98,.13,structureWidth-1.0,3.75,.19,0x3a4144);
      facadeBox('shared stone threshold',0,.176,.76,4.53,.161,1.42,0xaca89a,'masonry');
      facadeBox('entry door frame',0,1.57,.326,2.83,2.96,.31,0x363b3f);
      for(const side of [-1,1]) {
        facadeBox('beveled glass entrance',side*.68,1.45,.495,1.24,2.69,.13,0x253d45);
        facadeBox('iron handles',side*.296,1.24,.577,.09,.32,.06,0x696d6b);
        facadeBox('limestone piers',side*2.16,1.54,.47,.38,2.83,.31,limestone,'masonry');
        facadeBox('portico footing',side*2.16,.39,.49,.68,.65,.56,0xa39786,'masonry');
        facadeBox('retrofitted analytics cabinet',side*4.05,1.86,.292,1.71,2.14,.24,slate);
        facadeBox('glowing data slot',side*4.05,2.29,.428,1.19,.061,.035,site.light,'light');
        for(let i=0;i<5;i++) facadeBox('iron cabinet screen',side*4.05,1.02+i*.181,.449,1.32,.116,.07,0x293b42);
      }
      for(let i=0;i<11;i++) {
        const a=i*Math.PI/11,b=(i+1)*Math.PI/11;
        beam('limestone arch voussoirs',local(Math.cos(a)*2.16,2.88+Math.sin(a)*1.62,.49),
          local(Math.cos(b)*2.16,2.88+Math.sin(b)*1.62,.49),.30,.37,i===5?0xd5c4a8:limestone,'masonry');
      }
      facadeBox('upper sandstone lintel',0,4.98,.34,structureWidth+.29,.48,.64,0xb29a7c,'masonry');
      facadeBox('lintel indirect light',0,4.70,.61,structureWidth*.94,.066,.075,site.light,'light');
      facadeBox('department sign housing',0,5.57,.23,structureWidth,.97,.31,0x424849);
      const plaqueGeometry=geometry(new THREE.PlaneGeometry(structureWidth-.14,.90));
      const plaqueMaterial=material('MeshBasicMaterial',{color:0x263743,toneMapped:false});
      if (typeof document!=='undefined') {
        const signText=globalThis.DrivePortfolioSignText;
        const {canvas,ctx}=signText.canvas(structureWidth-.14,.90,1024,144);
        ctx.fillStyle='#26343c';
        ctx.fillRect(0,0,1024,144);
        ctx.strokeStyle='#c9bfa9';
        ctx.lineWidth=2;
        ctx.strokeRect(12,8,1000,128);
        ctx.fillStyle='#f1e0bd';
        ctx.font='900 58px Arial, sans-serif';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        signText.text(ctx,site.name,512,54,914);
        ctx.fillStyle='#'+site.light.toString(16);
        ctx.font='700 26px monospace';
        signText.text(ctx,site.degree,512,104,914);
        const plaque=new THREE.CanvasTexture(canvas);
        plaque.encoding=THREE.sRGBEncoding;
        plaque.anisotropy=4;
        textures.add(plaque);
        plaqueMaterial.map=plaque;
        plaqueMaterial.color.setHex(0xffffff);
      }
      const sign=new THREE.Mesh(plaqueGeometry,plaqueMaterial);
      sign.name='portfolio-education-degree-sign';
      sign.position.set(...local(0,5.57,.39));
      sign.rotation.y=site.heading;
      sign.userData={portfolioAdFace:true,portfolioAdId:'education-site-'+site.id};
      building.add(sign);
      for(const [tag,finish] of Object.entries(finishes)) {
        const objects=rows.filter(p=>p.finish===tag);
        if(!objects.length) continue;
        const batch=new THREE.InstancedMesh(tag==='tile'?shapes.tile:shapes.box,finish,objects.length);
        batch.name=building.name+'-'+tag;
        for(const [i,part] of objects.entries()) {
          if(part.kind==='box') {
            pose.position.set(part.x,part.y,part.z);
            pose.scale.set(part.width,part.height,part.depth);
            pose.quaternion.identity();
          } else {
            const {from,to,width,height}=part;
            direction.set(to[0]-from[0],to[1]-from[1],to[2]-from[2]);
            pose.position.set((from[0]+to[0])/2,(from[1]+to[1])/2,(from[2]+to[2])/2);
            if(part.kind==='tile') {
              pose.scale.set(width,direction.length()+.065,height);
              direction.normalize();
              tileNormal.copy(up).addScaledVector(direction,-direction.y).normalize();
              tileAcross.crossVectors(direction,tileNormal);
              pose.quaternion.setFromRotationMatrix(tileBasis.makeBasis(tileAcross,direction,tileNormal));
            } else {
              pose.scale.set(width,height,direction.length());
              pose.quaternion.setFromUnitVectors(forward,direction.normalize());
            }
          }
          pose.updateMatrix();
          tint.setHex(part.color);
          if(tag!=='light') tint.convertSRGBToLinear();
          batch.setMatrixAt(i,pose.matrix);
          batch.setColorAt(i,tint);
        }
        building.add(batch);
      }
      campus.add(building);
    }
    world.add(campus);
    return {
      dispose() {
        world.remove(campus);
        geometries.forEach(mesh=>mesh.dispose());
        materials.forEach(finish=>finish.dispose());
        textures.forEach(texture=>texture.dispose());
      }
    };
  }

  return {attach,colliders};
});
