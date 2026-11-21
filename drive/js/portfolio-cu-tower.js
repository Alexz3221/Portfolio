(function(root,factory) {
  const signText = typeof module === 'object' && module.exports
    ? require('./portfolio-sign-text') : root.DrivePortfolioSignText;
  const tower=factory(signText);
  if (typeof module==='object' && module.exports) module.exports=tower;
  else root.DrivePortfolioCUTower=tower;
})(globalThis,function(signText) {
  'use strict';

  const x=154.5, z=45;
  const parcel={x,z,width:11.4,depth:17.5,baseY:0,height:7.2};
  // Local lateral coordinates run along the front. Positive depth faces the access road.
  const tiers=[
    {lateral:0,depth:-.6,width:16.8,thickness:10.15,base:7.2,height:17.3,tone:0x77716e},
    {lateral:-.43,depth:-.97,width:14.76,thickness:9.42,base:24.5,height:19.1,tone:0x5d6266},
    {lateral:.63,depth:-1.32,width:11.35,thickness:8.44,base:43.6,height:14.9,tone:0x66696a},
    {lateral:.16,depth:-1.94,width:8.10,thickness:7.12,base:58.5,height:10.25,tone:0x535860},
    {lateral:.16,depth:-1.91,width:5.48,thickness:6.62,base:68.75,height:4.95,tone:0x394851}
  ];
  const colliders=[parcel,...tiers.map(tier=>({
    x:x-tier.depth,z:z+tier.lateral,width:tier.thickness,depth:tier.width,baseY:tier.base,height:tier.height
  }))];
  const stone=0x736e65, dark=0x28323a, asphalt=0x4b555a, brass=0xa98557, copper=0x876347;
  const amber=0xf2c18a, ice=0xaeccd4, shelf=0x614e46;

  function attach(THREE,world) {
    const group=new THREE.Group();
    group.name='portfolio-cu-learning-exchange';
    group.position.set(x,0,z);
    group.rotation.y=-Math.PI/2;
    const geometry=new THREE.BoxGeometry(1,1,1);
    const geometries=[geometry], materials=[], textures=[];
    function material(type,options) {
      const result=new THREE[type](options);
      materials.push(result);
      return result;
    }
    const curbMap=world.getObjectByName('portfolio-curbs')?.material?.map || null;
    const finishes={
      concrete:material('MeshStandardMaterial',{color:0xffffff,map:curbMap,roughness:.93}),
      metal:material('MeshStandardMaterial',{color:0xffffff,roughness:.59,metalness:.38}),
      glass:material('MeshStandardMaterial',{color:0xffffff,roughness:.27,metalness:.16}),
      light:material('MeshBasicMaterial',{color:0xffffff,toneMapped:false})
    };
    const pose=new THREE.Object3D(), start=new THREE.Vector3(), end=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);
    const batches=new Map();
    function record(finish,color) {
      if (!batches.has(finish)) batches.set(finish,[]);
      pose.updateMatrix();
      batches.get(finish).push({matrix:pose.matrix.clone(),color});
    }
    function box(finish,color,u,y,v,w,h,d,roll=0) {
      pose.position.set(u,y,v);
      pose.scale.set(w,h,d);
      pose.rotation.set(0,0,roll);
      record(finish,color);
    }
    const light=(color,...values)=>box('light',color,...values);
    function member(finish,color,a,b,width,depth) {
      start.fromArray(a);
      end.fromArray(b);
      pose.position.copy(start).lerp(end,.5);
      end.sub(start);
      pose.scale.set(width,end.length(),depth);
      pose.quaternion.setFromUnitVectors(up,end.normalize());
      record(finish,color);
    }
    function sign(id,u,y,v,w,h,title,caption) {
      const owner=new THREE.Group();
      owner.name='portfolio-cu-sign-'+id;
      const bodyGeom=new THREE.BoxGeometry(w+.14,h+.14,.14);
      geometries.push(bodyGeom);
      const shell=new THREE.Mesh(bodyGeom,signShell);
      shell.position.set(u,y,v-.075);
      owner.add(shell);
      let label=finishes.light;
      if (typeof document!=='undefined' && signText) {
        const {canvas,ctx}=signText.canvas(w,h,896,216);
        ctx.fillStyle=id==='entry' ? '#252c31' : '#2c2b2a';
        ctx.fillRect(0,0,896,216);
        ctx.strokeStyle='#c39365';
        ctx.lineWidth=3;
        ctx.strokeRect(13,12,870,192);
        ctx.fillStyle='#eac396';
        for (const side of [28,842]) ctx.fillRect(side,27,24,8);
        ctx.textAlign='center';
        ctx.font='800 74px system-ui,sans-serif';
        signText.text(ctx,title,448,109,806);
        ctx.fillStyle='#e1e3df';
        ctx.font='700 30px monospace';
        signText.text(ctx,caption,448,164,794);
        const map=new THREE.CanvasTexture(canvas);
        map.encoding=THREE.sRGBEncoding;
        textures.push(map);
        label=material('MeshBasicMaterial',{map,toneMapped:false});
      }
      const faceGeom=new THREE.PlaneGeometry(w,h);
      geometries.push(faceGeom);
      const face=new THREE.Mesh(faceGeom,label);
      face.position.set(u,y,v+.008);
      face.name='portfolio-cu-display-'+id;
      face.userData.portfolioAdFace=true;
      face.userData.portfolioAdId='cu-learning-'+id;
      owner.add(face);
      group.add(owner);
    }
    const signShell=material('MeshStandardMaterial',{color:0x353d45,roughness:.64,metalness:.32});

    // The cast podium is cut back around the west porch and its archive intake doors.
    box('concrete',stone,0,3.60,-.75,17.45,7.2,9.90);
    box('concrete',0x616264,0,.37,4.96,17.5,.74,1.48);
    box('metal',dark,0,2.37,4.23,5.00,4.36,.38);
    for (const u of [-1.16,1.16]) {
      box('glass',0x4f585c,u,1.74,4.47,2.20,3.18,.13);
      box('metal',copper,u,1.80,4.565,2.22,.13,.075);
      light(amber,u+Math.sign(u)*.16,1.61,4.57,.10,.36,.055);
    }
    for (const u of [-7.62,-3.46,3.21,7.51]) {
      box('concrete',stone,u,2.85,4.88,.89,5.70,1.62);
      box('metal',copper,u,2.84,5.697,.20,4.3,.035);
    }
    for (const u of [-5.66,5.45]) {
      box('glass',0x72665c,u,2.81,4.31,2.86,3.13,.20);
      box('light',0x857361,u,2.82,4.435,2.67,2.97,.045);
      for (const shelfY of [1.86,2.72,3.62]) {
        box('metal',shelf,u,shelfY,4.51,2.72,.105,.13);
        for (let i=0;i<6;i++) {
          const height=.30+((i+Math.floor(shelfY*3))%4)*.089;
          box('metal',i%3 === 1 ? 0xa08778 : 0x655547,u+(i-2.5)*.38,shelfY+.064+height/2,4.54,.20,height,.084,0,i===4 ? .13 : 0);
        }
      }
      for (const offset of [-1.39,1.39]) box('metal',dark,u+offset,2.81,4.59,.115,3.04,.19);
    }
    box('concrete',stone,0,5.38,4.72,16.70,.51,1.93);
    box('metal',asphalt,0,5.60,4.79,16.44,.105,1.56);
    light(ice,0,5.15,5.575,14.5,.040,.065);
    sign('entry',0,6.31,5.34,10.34,1.18,'CU BOULDER','COURSE ASSISTANT / LEARNING EXCHANGE');

    for (const [i,tier] of tiers.entries()) {
      const {lateral:u,depth:v,width:w,thickness:d,base,height,tone}=tier;
      const wall=v+d/2;
      box('concrete',tone,u,base+height/2,v,w,height,d);
      box('metal',dark,u,base+.32,v,w+.23,.60,d+.17);
      box('concrete',stone,u,base+height-.30,v,w+.26,.57,d+.22);
      for (const side of [-1,1]) {
        box('concrete',stone,u+side*(w*.42),base+height/2,wall+.06,.52,height-.25,.39);
        light(side<0 ? ice : amber,u+side*(w*.42),base+height/2,wall+.275,.068,height*.81,.042);
        member('metal',copper,[u+side*w*.24,base+.61,wall+.16],[u+side*w*.39,base+height-.60,wall+.16],.16,.18);
      }
      // Deeply framed brass lecture windows alternate with numbered archive cards.
      const columns=i>2 ? 3 : 5;
      for (let row=0,y=base+1.55;y<base+height-1.19;row++,y+=2.79) {
        if (i===1 && y>=27.8 && y<33.4) continue;
        const cell=w*.70/columns;
        for (let j=0;j<columns;j++) {
          const col=u+(j-(columns-1)/2)*cell;
          const lit=(row+j+i*2)%5<3;
          const color=lit ? ((j+i)%3===0 ? 0xa3a199 : 0xa48a73) : 0x35434b;
          box('metal',dark,col,y,wall+.091,cell*.87,1.82,.13);
          box(lit ? 'light' : 'glass',color,col,y+.09,wall+.176,cell*.75,1.45,.045);
          for (const off of [-.30,.30]) box('metal',copper,col+off*cell,y+.07,wall+.223,.091,1.62,.089);
          box('metal',shelf,col,y-.52,wall+.222,cell*.77,.095,.119);
          if (lit) {
            for (let k=0;k<3;k++) box('metal',k===1 ? 0x615f56 : 0x766356,col+(k-1)*cell*.163,
              y-.269+k*.02,wall+.214,.149+k*.027,.32+k*.052,.064,0,k===2 ? .17 : 0);
          }
        }
        for (const side of [-1,1]) {
          box('glass',0x4c585b,u+side*(w/2+.033),y,v-.37,.053,.88,d*.67);
          light(amber,u+side*(w/2+.063),y-.35,v+d*.04,.043,.049,d*.33);
        }
      }
    }
    const archiveLedge=tiers[1].depth+tiers[1].thickness/2;
    box('metal',dark,-.43,30.36,archiveLedge+.09,11.2,3.81,.35);
    box('metal',brass,-.43,28.31,archiveLedge+.295,11.7,.22,.65);
    sign('directive',-.43,30.36,archiveLedge+.318,10.49,3.38,'KNOWLEDGE MUST BE USEFUL','CIVIC LEARNING DIRECTIVE');
    // Crown ribs outline an open book and double as the top of the archive lantern.
    for (const side of [-1,1]) {
      member('metal',brass,[.16,72.7,1.88],[.16+side*3.34,75.73,.48],.33,.46);
      member('light',amber,[.16,72.71,2.115],[.16+side*3.34,75.81,.715],.065,.082);
      member('metal',dark,[.16+side*2.58,68.82,.59],[.16+side*3.35,75.73,.49],.44,.34);
      light(ice,.16+side*3.36,75.77,.49,.18,.18,.18);
    }

    for (const [finish,items] of batches) {
      const mesh=new THREE.InstancedMesh(geometry,finishes[finish],items.length);
      mesh.name='portfolio-cu-archive-'+finish;
      for (const [i,{matrix,color}] of items.entries()) {
        mesh.setMatrixAt(i,matrix);
        mesh.setColorAt(i,new THREE.Color(color).convertSRGBToLinear());
      }
      mesh.receiveShadow=finish!=='light';
      group.add(mesh);
    }
    world.add(group);
    return {dispose() {
      world.remove(group);
      geometries.forEach(shape=>shape.dispose());
      materials.forEach(finish=>finish.dispose());
      textures.forEach(texture=>texture.dispose());
    }};
  }

  return {parcel,colliders,attach};
});
