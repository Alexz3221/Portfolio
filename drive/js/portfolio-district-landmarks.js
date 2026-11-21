(function(root,factory) {
  const signText = typeof module === 'object' && module.exports
    ? require('./portfolio-sign-text') : root.DrivePortfolioSignText;
  const landmarks=factory(signText);
  if (typeof module==='object' && module.exports) module.exports=landmarks;
  else root.DrivePortfolioDistrictLandmarks=landmarks;
})(globalThis,function(signText) {
  'use strict';

  const sites=[
    {id:'about',x:36,z:-88.6,heading:Math.PI,title:'ARRIVAL CONCOURSE',detail:'TRANSIT / ABOUT',accent:0xffb197,build:transit},
    {id:'contact',x:60,z:-91.7,heading:Math.PI,title:'SOUTH STREET',detail:'MEDIA KIOSK / INTERESTS',accent:0xff9ace,build:mediaKiosk},
    {id:'education',x:-94,z:23,heading:-Math.PI/2,title:'BOULDER CAMPUS',detail:'COURSE RESERVES',accent:0xe5bf95,build:studyStall},
    {id:'experience',x:127.5,z:59.4,heading:Math.PI,title:'SERVICE DISTRICT',detail:'FIELD OPERATIONS / EXPERIENCE',accent:0xffbf78,build:substation},
    {id:'skills',x:-34.4,z:94.4,heading:Math.PI,title:'WORKSHOP QUARTER',detail:'TOOL LIBRARY / SKILLS',accent:0xc3e99f,build:workshop}
  ];
  const deckWidth=5.5, deckDepth=2.45;
  const track=0x4d565b, enamel=0x303e48, steel=0x525d66, chalk=0x9b9b91;

  function transit({box,light,pipe,accent}) {
    const oxide=0x795e58, stone=0x78797b;
    box('concrete',stone,0,.58,-.79,5.1,1.03,.60);
    box('metal',oxide,0,2.28,-.91,4.88,2.45,.32);
    box('metal',enamel,0,2.25,-.72,4.67,1.64,.13);
    for (const x of [-2.14,2.14]) {
      box('concrete',stone,x,1.55,-.22,.38,2.97,1.53);
      box('metal',oxide,x,1.85,.58,.22,2.0,.16);
      box('metal',enamel,x,.21,.54,.57,.27,.49);
    }
    box('concrete',stone,0,3.23,-.09,5.62,.34,2.36);
    box('metal',oxide,0,3.40,.84,5.48,.131,.29);
    light(accent,0,3.079,.71,5.05,.047,.08);
    for (const y of [1.88,2.16,2.44]) {
      box('metal',0x29353c,0,y,-.61,4.20,.157,.087);
      for (let i=0;i<7;i++) light(i%3===0 ? accent : 0xa9978b,(i-3)*.55,y,-.56,.38,.031,.027);
    }
    for (const x of [-1.33,1.33]) {
      box('metal',track,x,.29,.20,.15,.34,.58);
      pipe(accent,x,3.17,.48,.07,.29,true);
    }
    box('metal',0x64504a,0,.49,.22,3.38,.13,.57);
  }

  function mediaKiosk({box,light,pipe,accent}) {
    const plum=0x70516a, iron=0x3f3752, berry=0xa37898;
    box('metal',iron,0,1.60,-.42,5.27,2.99,1.56);
    box('metal',plum,0,2.98,-.25,5.5,.42,2.06);
    box('metal',berry,0,1.27,.536,4.82,2.10,.11);
    box('metal',iron,0,1.26,.614,4.61,1.85,.07);
    for (const [i,tint] of [0xd889ae,0xa98bdd,0xe2a598].entries()) {
      const x=(i-1)*1.47;
      box('metal',0x343649,x,1.46,.684,1.28,1.21,.14);
      light(tint,x,1.53,.769,1.17,1.0,.036);
      light(chalk,x+.29,1.20,.799,.38,.09,.019);
      light(berry,x-.12,.985,.787,.88,.028,.028);
    }
    for (const x of [-.15,.13]) box('metal',iron,-1.47+x,1.59,.795,.26,.51,.029,0,x*.85);
    box('metal',iron,0,1.59,.796,.51,.44,.03);
    light(0x8b789e,0,1.60,.816,.29,.19,.016);
    box('metal',iron,1.47,1.59,.796,.56,.56,.028,0,Math.PI/4);
    light(0xc99888,1.47,1.59,.817,.17,.17,.016,0,Math.PI/4);
    box('metal',plum,0,.32,.66,4.94,.49,.49);
    box('metal',0x59414f,0,.59,.65,4.89,.105,.58);
    box('metal',0x4a5261,-1.66,3.47,-.55,1.39,.55,.67);
    pipe(steel,-1.84,3.97,-.59,.075,1.13);
    box('metal',steel,-1.84,4.15,-.59,1.46,.055,.044,0,.17);
    light(accent,-2.55,4.03,-.58,.087,.083,.089);
    light(accent,-1.13,4.27,-.58,.087,.083,.089);
    light(accent,0,2.82,.79,5.24,.039,.07);
  }

  function studyStall({box,light,pipe,accent}) {
    const slate=0x67566f, timber=0x795b49, stone=0x706a79, paper=0xd4bc91;
    box('concrete',stone,0,1.56,-.7,5.17,2.98,1);
    box('metal',slate,0,3.18,-.11,5.46,.19,2.16);
    box('metal',slate,0,3.31,.20,5.39,.15,1.26);
    for (const x of [-2.36,2.36]) {
      box('concrete',stone,x,1.45,.75,.28,2.77,.32);
      pipe(0x634c61,x,2.68,.86,.15,.30);
      pipe(accent,x,2.65,.86,.109,.18,true);
    }
    box('metal',0x473c53,0,1.49,-.142,4.70,2.18,.10);
    for (const [i,y] of [1.20,1.93].entries()) {
      box('metal',timber,0,y,.106,4.5,.102,.61);
      for (let j=0;j<12;j++) {
        const height=.24+((j+i*2)%5)*.061;
        const color=[0xac8779,0x9e80af,0xbcab8a,0x7b9294,0xb19bae][(j+i)%5];
        box('metal',color,(j-5.5)*.345,y+height/2+.052,.215,.23,height,.198,0,j%4===2 ? .12 : 0);
      }
    }
    box('metal',timber,0,.47,.43,4.55,.67,.68);
    box('metal',paper,0,.829,.49,4.48,.090,.71);
    box('metal',timber,1.33,1.45,.30,.48,.96,.22);
    light(0xffcf9a,0,2.88,.72,4.36,.055,.17);
  }

  function substation({box,light,pipe,accent}) {
    const copper=0xa37149, rust=0x885c42, concrete=0x78716c;
    box('concrete',concrete,0,.23,-.04,5.1,.33,1.98);
    for (const [x,size] of [[-1.65,1.55],[.14,1.68],[1.81,1.05]]) {
      box('metal',rust,x,1.37,-.25,size,1.93,1.25);
      box('metal',enamel,x,1.53,.414,size-.23,1.29,.104);
      for (let i=0;i<5;i++) box('metal',copper,x,1.10+i*.185,.483,size-.38,.045,.087);
      light(accent,x+.24,2.16,.47,.133,.074,.043);
    }
    box('metal',copper,0,2.64,-.44,5.12,.26,.24);
    for (const x of [-1.66,-.49,.68,1.85]) {
      pipe(steel,x,2.92,-.4,.085,.72);
      for (const y of [2.70,2.88,3.06,3.23]) pipe(0x7a6660,x,y,-.4,.19,.073);
      light(accent,x,3.30,-.4,.09,.065,.08);
    }
    box('metal',enamel,0,.552,.683,5.14,.219,.15);
    for (let i=0;i<14;i++) box('metal',0xcc9e5b,(i-6.5)*.335,.554,.766,.096,.218,.022,0,-.43);
  }

  function workshop({box,light,pipe,accent}) {
    const moss=0x556555, green=0x637c62, red=0x7f5448;
    box('concrete',0x6a7270,0,1.61,-.6,5.28,3.06,1.12);
    box('metal',moss,0,3.10,-.028,5.53,.32,2.26);
    box('metal',green,0,3.23,.65,5.43,.17,.69);
    box('metal',enamel,-1.27,1.41,.04,2.1,2.62,.15);
    for (let i=0;i<9;i++) box('metal',i%3===1 ? green : track,-1.27,.48+i*.237,.14,1.90,.185,.08);
    for (const x of [-2.31,-.24,2.47]) box('metal',green,x,1.45,.51,.23,2.77,.99);
    box('metal',0x675f57,1.13,1.77,.16,2.34,1.65,.10);
    const tools=[[-.58,2.04,.34],[-.15,1.85,.04],[.29,2.06,-.35],[.68,1.82,.24]];
    for (const [x,y,roll] of tools) {
      box('metal',chalk,1.14+x,y,.246,.072,.56,.038,0,roll);
      box('metal',steel,1.20+x,y+.252,.246,.17,.16,.041,0,roll);
    }
    box('metal',red,1.42,.53,.40,1.56,.77,.78);
    for (const y of [.35,.54,.73]) box('metal',chalk,1.42,y,.811,1.14,.047,.053);
    pipe(0xb9a17e,1.64,2.97,.39,.056,.30);
    light(accent,1.07,2.80,.55,2.34,.052,.096);
  }

  function attach(THREE,world,city,physics) {
    const group=new THREE.Group();
    group.name='portfolio-district-landmarks';
    const textures=[], geometries=[];
    const blockGeometry=new THREE.BoxGeometry(1,1,1), pipeGeometry=new THREE.CylinderGeometry(1,1,1,8);
    geometries.push(blockGeometry,pipeGeometry);
    const pavement=world.getObjectByName('portfolio-curbs')?.material?.map;
    const finishes={
      concrete:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.91,map:pavement || null}),
      metal:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.64,metalness:.29}),
      light:new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false})
    };
    const signMaterials=[], collisionBodies=[], pose=new THREE.Object3D();
    const streets=globalThis.DrivePortfolioStreets;
    const Cannon=globalThis.CANNON;
    const stopIds=new Set(city.stops.map(stop=>stop.id));

    for (const {id,x,z,heading,title,detail,accent,build} of sites) {
      if (!stopIds.has(id)) continue;
      const grade=streets?.surfaceHeight(world,x,z) ?? 0;
      if (grade<.10) continue;
      const district=new THREE.Group();
      district.name='portfolio-neighborhood-'+id;
      district.position.set(x,grade,z);
      district.rotation.y=heading;
      const batches=new Map();
      function part(kind,finish,color,x,y,z,width,height,depth,yaw=0,roll=0) {
        const key=kind+'-'+finish;
        if (!batches.has(key)) batches.set(key,{kind,finish,parts:[]});
        pose.position.set(x,y,z);
        pose.scale.set(width,height,depth);
        pose.rotation.set(0,yaw,roll,'YXZ');
        pose.updateMatrix();
        batches.get(key).parts.push({matrix:pose.matrix.clone(),color});
      }
      const box=(finish,color,...values)=>part('box',finish,color,...values);
      const light=(color,...values)=>box('light',color,...values);
      const pipe=(color,x,y,z,radius,height,lit=false)=>
        part('pipe',lit ? 'light' : 'metal',color,x,y,z,radius,height,radius);
      box('concrete',0x62696c,0,.055,0,deckWidth,.11,deckDepth);
      build({box,light,pipe,accent});

      const signHeight=id==='about' ? 3.84 : 3.54;
      box('metal',enamel,0,signHeight,.96,5.28,.69,.22);
      box('metal',track,0,signHeight-.16,.68,5.15,.55,.39);
      light(accent,0,signHeight+.464,1.007,5.07,.038,.115);
      for (const xx of [-2.29,2.29]) box('metal',track,xx,signHeight-.465,.89,.12,.67,.21);
      let face=finishes.light;
      const faceWidth=5.04, faceHeight=.615;
      if (typeof document!=='undefined' && signText) {
        const {canvas,ctx}=signText.canvas(faceWidth,faceHeight,768,132);
        const ink='#'+new THREE.Color(accent).getHexString();
        ctx.fillStyle='#15212a';
        ctx.fillRect(0,0,768,132);
        ctx.strokeStyle=ink;
        ctx.lineWidth=3;
        ctx.strokeRect(8,8,752,116);
        ctx.textAlign='center';
        ctx.fillStyle=ink;
        ctx.font='800 56px system-ui,sans-serif';
        signText.text(ctx,title,384,72,704);
        ctx.font='700 24px monospace';
        ctx.fillStyle='#e2e5df';
        signText.text(ctx,detail,384,105,700);
        const texture=new THREE.CanvasTexture(canvas);
        texture.encoding=THREE.sRGBEncoding;
        textures.push(texture);
        face=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
        signMaterials.push(face);
      }
      const faceGeometry=new THREE.PlaneGeometry(faceWidth,faceHeight);
      geometries.push(faceGeometry);
      const placard=new THREE.Mesh(faceGeometry,face);
      placard.name='portfolio-district-label-'+id;
      placard.position.set(0,signHeight,1.077);
      placard.userData.portfolioAdFace=true;
      placard.userData.portfolioAdId='district-'+id;
      district.add(placard);

      for (const [key,{kind,finish,parts}] of batches) {
        const mesh=new THREE.InstancedMesh(kind==='box' ? blockGeometry : pipeGeometry,finishes[finish],parts.length);
        mesh.name='portfolio-neighborhood-'+id+'-'+key;
        mesh.receiveShadow=finish!=='light';
        for (const [i,{matrix,color}] of parts.entries()) {
          mesh.setMatrixAt(i,matrix);
          mesh.setColorAt(i,new THREE.Color(color).convertSRGBToLinear());
        }
        district.add(mesh);
      }
      group.add(district);

      if (physics?.world && Cannon) {
        const body=new Cannon.Body({mass:0,position:new Cannon.Vec3(x,grade+1.48,z)});
        body.addShape(new Cannon.Box(new Cannon.Vec3(deckWidth/2,1.48,deckDepth/2)));
        body.quaternion.setFromAxisAngle(new Cannon.Vec3(0,1,0),heading);
        physics.world.addBody(body);
        collisionBodies.push(body);
      }
    }
    world.add(group);
    return {dispose() {
      world.remove(group);
      geometries.forEach(geometry=>geometry.dispose());
      Object.values(finishes).forEach(material=>material.dispose());
      signMaterials.forEach(material=>material.dispose());
      textures.forEach(texture=>texture.dispose());
      for (const body of collisionBodies) physics.world.removeBody(body);
    }};
  }

  return {attach};
});
