(function(root,factory) {
  const campus=factory();
  if (typeof module==='object' && module.exports) module.exports=campus;
  else root.DrivePortfolioEducationCampus=campus;
})(globalThis,function() {
  'use strict';

  const east=Math.PI/2, north=Math.PI;
  const sandstone=0xd7ab83, mortar=0xa18c77, limestone=0xe1d5bd;
  const oldBrick=0x954e3c, tile=0xa75644, iron=0x364248, amber=0xffce97, ice=0xc0ebed;
  const arcadeX=-134.45, arcadeZ=6.55;
  const columnZ=[1.07,4.73,8.39,12.05];

  function attach(THREE,world,city,physics) {
    const group=new THREE.Group();
    group.name='portfolio-education-campus';
    const Cannon=globalThis.CANNON, streets=globalThis.DrivePortfolioStreets;
    const geometries=[], materials=[], textures=[], bodies=[];
    const boxShape=new THREE.BoxGeometry(1,1,1), pipeShape=new THREE.CylinderGeometry(.5,.5,1,8);
    const crownShape=new THREE.IcosahedronGeometry(.5,1);
    geometries.push(boxShape,pipeShape,crownShape);
    function material(type,options) {
      const value=new THREE[type](options);
      materials.push(value);
      return value;
    }
    const pavers=world.getObjectByName('portfolio-curbs')?.material?.map || null;
    const finishes={
      stone:material('MeshStandardMaterial',{color:0xffffff,map:pavers,roughness:.92}),
      glazed:material('MeshStandardMaterial',{color:0xffffff,roughness:.70,metalness:.11}),
      iron:material('MeshStandardMaterial',{color:0xffffff,roughness:.59,metalness:.39}),
      plant:material('MeshStandardMaterial',{color:0xffffff,flatShading:true,roughness:1}),
      light:material('MeshBasicMaterial',{color:0xffffff,toneMapped:false})
    };
    const batchPose=new THREE.Object3D(), beamFrom=new THREE.Vector3(), beamTo=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);

    const level=(x,z)=>streets?.surfaceHeight(world,x,z) ?? 0;
    function paved(x,z,w,d) {
      return [-1,1].every(i=>[-1,1].every(j=>level(x+i*w/2,z+j*d/2)>=.14));
    }
    function collide(x,y,z,w,h,d) {
      if (!physics?.world || !Cannon) return;
      const body=new Cannon.Body({mass:0,position:new Cannon.Vec3(x,y,z)});
      body.addShape(new Cannon.Box(new Cannon.Vec3(w/2,h/2,d/2)));
      physics.world.addBody(body);
      bodies.push(body);
    }

    function section(name) {
      const owner=new THREE.Group(), batches=new Map();
      owner.name='portfolio-campus-'+name;
      group.add(owner);
      function collect(shape,finish,color) {
        const key=shape.id+'-'+finish;
        if (!batches.has(key)) batches.set(key,{shape,finish,items:[]});
        batchPose.updateMatrix();
        batches.get(key).items.push({matrix:batchPose.matrix.clone(),color});
      }
      function shape(geometry,finish,color,x,y,z,w,h,d,heading=0,roll=0) {
        batchPose.position.set(x,y,z);
        batchPose.scale.set(w,h,d);
        batchPose.rotation.set(0,heading,roll,'YXZ');
        collect(geometry,finish,color);
      }
      const box=(finish,color,...args)=>shape(boxShape,finish,color,...args);
      const light=(color,...args)=>box('light',color,...args);
      function tube(finish,color,from,to,diameter) {
        beamFrom.fromArray(from);
        beamTo.fromArray(to);
        batchPose.position.copy(beamFrom).lerp(beamTo,.5);
        beamTo.sub(beamFrom);
        batchPose.scale.set(diameter,beamTo.length(),diameter);
        batchPose.quaternion.setFromUnitVectors(up,beamTo.normalize());
        collect(pipeShape,finish,color);
      }
      const tree=(color,...args)=>shape(crownShape,'plant',color,...args);
      function render() {
        for (const {shape,finish,items} of batches.values()) {
          const mesh=new THREE.InstancedMesh(shape,finishes[finish],items.length);
          mesh.name=owner.name+'-'+finish;
          for (const [index,{matrix,color}] of items.entries()) {
            mesh.setMatrixAt(index,matrix);
            mesh.setColorAt(index,new THREE.Color(color).convertSRGBToLinear());
          }
          owner.add(mesh);
        }
      }
      return {owner,box,light,tube,shape,tree,render};
    }

    function sign(owner,id,{x,y,z,w,h,heading},layout) {
      let face=finishes.light;
      if (typeof document!=='undefined') {
        const signText=globalThis.DrivePortfolioSignText;
        const {canvas,ctx,width,height}=signText.canvas(w,h,768,layout.rows ? 384 : 160);
        ctx.fillStyle='#2b383b';
        ctx.fillRect(0,0,width,height);
        ctx.strokeStyle='#b89675';
        ctx.lineWidth=3;
        ctx.strokeRect(13,12,742,height-24);
        ctx.textAlign='center';
        ctx.fillStyle='#f0d7b2';
        ctx.font=layout.rows ? '800 45px system-ui,sans-serif' : '800 56px system-ui,sans-serif';
        signText.text(ctx,layout.title,384,75,698);
        ctx.fillStyle='#e4d9ca';
        ctx.font='700 27px system-ui,sans-serif';
        signText.text(ctx,layout.caption,384,layout.rows ? 120 : 121,704);
        for (const [i,row] of (layout.rows || []).entries()) {
          const baseline=183+i*67;
          ctx.fillStyle='#5e6c68';
          ctx.fillRect(40,baseline-25,688,38);
          ctx.fillStyle='#f0e0c9';
          ctx.font='700 25px system-ui,sans-serif';
          signText.text(ctx,row,384,baseline,646);
        }
        const map=new THREE.CanvasTexture(canvas);
        map.encoding=THREE.sRGBEncoding;
        textures.push(map);
        face=material('MeshBasicMaterial',{map,toneMapped:false});
      }
      const geometry=new THREE.PlaneGeometry(w,h);
      geometries.push(geometry);
      const mesh=new THREE.Mesh(geometry,face);
      mesh.position.set(x,y,z);
      mesh.rotation.y=heading;
      mesh.name='portfolio-campus-display-'+id;
      mesh.userData.portfolioAdFace=true;
      mesh.userData.portfolioAdId='campus-'+id;
      owner.add(mesh);
    }

    // The full arcade is set behind an open stretch of the pedestrian commons.
    if (paved(arcadeX,arcadeZ,5.30,12.5)) {
      const {owner,box,light,tube,shape,render}=section('sandstone-arcade');
      const y=level(arcadeX,arcadeZ), deck=12.6, spring=2.25, radius=1.593, archThickness=.29;
      box('stone',mortar,arcadeX,y+.053,arcadeZ,5.45,.106,12.49);
      for (const edgeX of [-136.55,-132.35]) {
        for (const z of columnZ) {
          box('stone',sandstone,edgeX,y+1.18,z,.54,2.32,.53);
          box('stone',limestone,edgeX,y+.17,z,.71,.26,.72);
          box('stone',limestone,edgeX,y+2.15,z,.67,.21,.68);
          collide(edgeX,y+1.09,z,.58,2.18,.62);
        }
      }
      function archStone(inner,outer,a,b,depth,finish,tone) {
        const profile=new THREE.Shape();
        profile.moveTo(inner*Math.cos(a),inner*Math.sin(a));
        profile.absarc(0,0,inner,a,b,false);
        profile.lineTo(outer*Math.cos(b),outer*Math.sin(b));
        profile.absarc(0,0,outer,b,a,true);
        profile.closePath();
        const stone=new THREE.ExtrudeGeometry(profile,{depth,bevelEnabled:false,curveSegments:8});
        stone.translate(0,0,-depth/2);
        geometries.push(stone);
        for (let span=0;span<columnZ.length-1;span++) {
          const z=(columnZ[span]+columnZ[span+1])/2;
          for (const edgeX of [-136.55,-132.35]) {
            shape(stone,finish,tone,edgeX,y+spring,z,1,1,1,east);
          }
        }
      }
      archStone(radius+.018,radius+archThickness-.014,0,Math.PI,.391,'glazed',0x91836b);
      for (let i=0;i<11;i++) {
        const step=Math.PI/11, a=i*step+.012, b=(i+1)*step-.012;
        archStone(radius,radius+archThickness,a,b,.43,'stone',i===5 ? limestone : i%2 ? 0xc69d78 : sandstone);
      }
      for (const x of [-136.58,-132.32]) {
        box('stone',sandstone,x,y+4.31,arcadeZ,.62,.55,deck);
        box('stone',limestone,x,y+4.05,arcadeZ,.68,.14,deck+.12);
        box('iron',iron,x,y+3.93,arcadeZ,.26,.10,deck-.34);
      }
      box('stone',oldBrick,arcadeX,y+4.48,arcadeZ,4.83,.21,deck+.13);
      for (const side of [-1,1]) {
        box('glazed',tile,arcadeX+side*1.225,y+4.88,arcadeZ,2.64,.19,deck+.22,0,-side*.325);
        for (let i=0;i<21;i++) {
          const z=arcadeZ+(i-10)*.58;
          const shade=[0xa05443,0xac624b,0x945041,0xa15949][(i+(side>0?2:0))%4];
          tube('glazed',shade,[arcadeX,y+5.36,z],[arcadeX+side*2.48,y+4.51,z],.17);
        }
      }
      tube('glazed',0xac6856,[arcadeX,y+5.35,arcadeZ-deck/2],[arcadeX,y+5.35,arcadeZ+deck/2],.23);
      box('iron',0x4b5552,-131.989,y+4.34,arcadeZ,.13,1.02,7.25);
      sign(owner,'arcade',{x:-131.911,y:y+4.34,z:arcadeZ,w:6.96,h:.90,heading:east},
        {title:'BOULDER CAMPUS',caption:'UNIVERSITY OF COLORADO BOULDER'});
      for (const z of [2.9,6.55,10.22]) {
        box('iron',iron,-133.55,y+3.35,z,.11,.87,.12);
        box('iron',iron,-133.55,y+2.96,z,.37,.16,.39);
        light(amber,-133.55,y+2.78,z,.265,.28,.26);
        box('iron',iron,-133.55,y+2.61,z,.32,.075,.33);
      }
      render();
    }

    // A shared planter frames three eroded stone slabs inspired by the Flatirons.
    const gardenX=-127.1,gardenZ=6.55;
    if (paved(gardenX,gardenZ,5.52,5.64)) {
      const {box,tube,shape,tree,render}=section('flatiron-garden');
      const y=level(gardenX,gardenZ);
      box('stone',sandstone,gardenX,y+.23,gardenZ,5.46,.45,5.57);
      box('glazed',mortar,gardenX,y+.448,gardenZ,5.38,.10,5.47);
      box('plant',0x66694b,gardenX,y+.507,gardenZ,4.89,.044,4.97);
      for (const [i,[dx,dz,height]] of [[-.62,-1.28,2.32],[.21,-.03,3.37],[.55,1.27,2.59]].entries()) {
        const face=new THREE.Shape();
        face.moveTo(-.63,0);
        face.lineTo(-.48,height*.66);
        face.lineTo(-.12,height*.914);
        face.lineTo(.24,height);
        face.lineTo(.44,height*.77);
        face.lineTo(.80,.05);
        face.closePath();
        const slab=new THREE.ExtrudeGeometry(face,{depth:.36,bevelEnabled:true,bevelThickness:.055,bevelSize:.074,bevelSegments:1});
        geometries.push(slab);
        shape(slab,'stone',[0x958e85,0xb79981,0xa69986][i],gardenX+dx,y+.51,gardenZ+dz,1,1,1,east+.20*i,.08-i*.095);
      }
      for (const [dx,dz] of [[1.68,2.03],[-1.87,1.73],[-1.84,-1.85],[1.88,-1.69],[1.92,.32]]) {
        tree(0x667452,gardenX+dx,y+.59,gardenZ+dz,.63,.30,.51,.34);
      }
      for (const z of [gardenZ-2.53,gardenZ+2.52]) tube('iron',iron,[gardenX-2.46,y+.586,z],[gardenX+2.46,y+.586,z],.047);
      collide(gardenX,y+.48,gardenZ,5.45,.96,5.55);
      render();
    }

    const court=section('walks-and-landscaping');
    for (const [x,z] of [[-130,12.85],[-130,.26]]) {
      if (!paved(x,z,1.88,1.88)) continue;
      const y=level(x,z);
      court.box('stone',sandstone,x,y+.18,z,1.80,.36,1.80);
      court.box('plant',0x4e5847,x,y+.38,z,1.54,.10,1.54);
      court.tube('plant',0x71674c,[x,y+.31,z],[x+.11,y+2.71,z-.11],.15);
      court.tree(0x677949,x+.21,y+2.83,z-.11,1.74,1.45,1.65,.2);
      court.tree(0x7e8955,x-.24,y+2.56,z+.34,1.22,1.09,1.36,.52);
      court.tree(0x5e7151,x+.53,y+2.48,z-.55,1.07,1.03,1.24,.19);
      collide(x,y+.22,z,1.82,.44,1.82);
    }
    for (const [x,z] of [[-124.02,10.72],[-124.18,2.31]]) {
      if (!paved(x,z,2.81,1.03)) continue;
      const y=level(x,z);
      for (const side of [-1,1]) court.box('stone',limestone,x+side*.95,y+.24,z,.27,.47,.63);
      court.box('glazed',0x714f3f,x,y+.49,z,2.68,.15,.73);
      court.box('iron',iron,x,y+.77,z-.28,2.60,.25,.11);
      collide(x,y+.38,z,2.70,.76,.77);
    }
    for (const z of [1.52,12.4]) {
      if (!paved(-124.22,z,13.22,.31)) continue;
      court.box('glazed',tile,-124.22,level(-124.22,z)+.014,z,13.05,.017,.28);
      court.box('stone',limestone,-124.22,level(-124.22,z)+.016,z+.18,13.05,.020,.065);
    }
    court.render();

    const data=globalThis.DrivePortfolioDistricts?.education || [];
    const directoryX=-121.85,directoryZ=5.61;
    if (data.length && paved(directoryX,directoryZ,1.03,4.11)) {
      const {owner,box,light,render}=section('directory');
      const y=level(directoryX,directoryZ);
      box('stone',sandstone,directoryX,y+.19,directoryZ,1.06,.37,4.01);
      box('stone',limestone,directoryX,y+1.59,directoryZ,.61,2.72,3.85);
      box('iron',iron,directoryX+.30,y+1.68,directoryZ,.125,2.16,3.66);
      light(amber,directoryX+.39,y+2.83,directoryZ,.08,.043,3.60);
      light(ice,directoryX+.385,y+.44,directoryZ-1.59,.043,.043,.38);
      sign(owner,'directory',{x:directoryX+.372,y:y+1.68,z:directoryZ,w:3.48,h:2.05,heading:east},
        {title:'BOULDER CAMPUS',caption:'PROGRAM DIRECTORY',rows:data.map(program=>program.title)});
      collide(directoryX,y+1.38,directoryZ,.73,2.76,3.81);
      render();
    }

    const post=section('path-lanterns');
    for (const [x,z] of [[-118.45,.2],[-118.45,12.2],[-118.34,31.7],[-118.34,37.4],[-118.20,68.6],
      [-98.11,17.2],[-98.05,30.4],[-98.05,46.93],[-98.05,53.1],[-98.05,66.74]]) {
      if (!paved(x,z,.64,.64)) continue;
      const y=level(x,z);
      post.box('stone',limestone,x,y+.17,z,.63,.34,.60);
      post.tube('iron',iron,[x,y+.31,z],[x,y+3.04,z],.128);
      post.box('iron',iron,x,y+2.94,z,.38,.17,.39);
      post.box('light',amber,x,y+3.16,z,.274,.36,.276);
      post.box('iron',iron,x,y+3.36,z,.45,.12,.46);
      post.box('glazed',tile,x,y+3.45,z,.26,.10,.27);
      for (const dx of [-.145,.145]) for (const dz of [-.147,.147])
        post.box('iron',iron,x+dx,y+3.14,z+dz,.035,.42,.036);
      collide(x,y+1.23,z,.43,2.46,.43);
    }
    post.render();

    if (city.stops.some(stop=>stop.id==='education')) world.add(group);
    return {dispose() {
      world.remove(group);
      materials.forEach(finish=>finish.dispose());
      geometries.forEach(geometry=>geometry.dispose());
      textures.forEach(map=>map.dispose());
      for (const body of bodies) physics.world.removeBody(body);
    }};
  }

  return {attach};
});
