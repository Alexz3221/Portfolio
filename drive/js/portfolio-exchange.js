(function(root,factory) {
  if (typeof module==='object' && module.exports) module.exports=factory(require('./portfolio-exchange-concrete'));
  else root.DrivePortfolioExchange=factory(root.DrivePortfolioExchangeConcrete);
})(globalThis,function(concrete) {
  'use strict';

  const floors=[8.79,12.2,15.9,19.65,23.45,27.75,32.2,36.7,41.2,45.8,50.55,55.25,60.1];
  const retrofitFloors=[20.56,24.9,28.9,33.2,37.8];
  const concreteTints=[0xffffff,0xc3bcb0,0xd4ccc0,0xe8e0d1,0xcbc3b8,0xded5c7];

  function attach(THREE, world, {tower,point,shell,materials,instance,beam,grime}) {
    const exchange=new THREE.Group();
    exchange.name='portfolio-municipal-exchange';
    world.add(exchange);
    const stone=concrete.create(THREE,grime);
    const slab=stone.clone();
    slab.vertexColors=false;
    slab.onBeforeCompile=stone.onBeforeCompile;
    slab.customProgramCacheKey=stone.customProgramCacheKey;
    const bronze=new THREE.MeshStandardMaterial({color:0x413629,roughness:.69,metalness:.43});
    const oldGlass=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.62,metalness:.14,
      emissive:0x514739,emissiveIntensity:.28});
    const newGlass=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.24,metalness:.29,
      emissive:0x327568,emissiveIntensity:.46});
    const faceMaterials={wall:stone,punch:oldGlass,retrofit:newGlass};
    const buffers=new Map();
    const metres=2.41;

    function quad(kind,points,shade,uv) {
      if (!buffers.has(kind)) buffers.set(kind,{positions:[],colors:[],uvs:[]});
      const batch=buffers.get(kind), tint=new THREE.Color(shade).convertSRGBToLinear();
      for (const index of [0,2,1,1,2,3]) {
        batch.positions.push(...points[index]);
        batch.colors.push(tint.r,tint.g,tint.b);
        batch.uvs.push(...uv[index]);
      }
    }
    function strip(kind,l,r,b,t,out,shade) {
      quad(kind,[point(b,l,out),point(b,r,out),point(t,l,out),point(t,r,out)],shade,
        [[l*metres,b],[r*metres,b],[l*metres,t],[r*metres,t]]);
    }
    const timber=(feature,material,a,b,w,h,color=null)=>beam('portfolio-exchange-'+feature,material,a,b,w,h,color);
    const block=(feature,material,p,w,h,d,yaw=0)=>instance('portfolio-exchange-'+feature,material,...p,w,h,d,yaw);

    // The original exchange has thick cast-in-place walls with deep, narrow openings.
    for (let storey=0; storey<floors.length-1; storey++) {
      const y0=floors[storey],y1=floors[storey+1];
      for (let sector=0; sector<32; sector++) {
        const shade=concreteTints[(sector*13+Math.floor(storey/2)*7+(sector%5)*3)%concreteTints.length];
        const serviceSide=sector<=8 || sector>=26;
        const punched=(sector%2===1 || serviceSide && sector%3===0) && (sector+storey*3)%11!==0;
        if (!punched) {
          strip('wall',sector,sector+1,y0,y1,0,shade);
          continue;
        }
        const l=sector+.12,r=sector+.86;
        const b=y0+(y1-y0)*.46,t=b+(serviceSide ? .77 : .61),depth=-.42;
        strip('wall',sector,sector+1,y0,b,0,shade);
        strip('wall',sector,sector+1,t,y1,0,shade);
        strip('wall',sector,l,b,t,0,shade);
        strip('wall',r,sector+1,b,t,0,shade);
        const a=point(b,l),c=point(t,l),d=point(b,r),e=point(t,r);
        const ai=point(b,l,depth),ci=point(t,l,depth),di=point(b,r,depth),ei=point(t,r,depth);
        const revealUv=[[l*metres,b],[l*metres+.42,b],[l*metres,t],[l*metres+.42,t]];
        quad('wall',[a,ai,c,ci],0x998f82,revealUv);
        quad('wall',[di,d,ei,e],0x8c8479,revealUv);
        quad('wall',[ai,di,a,d],0xa49684,[[l*metres,b],[r*metres,b],[l*metres,b+.42],[r*metres,b+.42]]);
        quad('wall',[c,e,ci,ei],0x8c8071,[[l*metres,t],[r*metres,t],[l*metres,t+.42],[r*metres,t+.42]]);
        const lit=(sector*11+storey*3)%14<3;
        strip('punch',l,r,b,t,depth,lit ? 0xad9064 : 0x414244);
        timber('old-window-bars',bronze,point(b,(l+r)/2,depth+.027),point(t,(l+r)/2,depth+.027),.061,.063);
      }
    }
    // Old transfer slabs and rough bearing ribs remain readable beyond the new veneer.
    const belts=[[10.78,.58,.58],[19.92,.67,.70],[36.7,.63,.63],[48,.62,.57],[60.21,.49,.22]];
    shell(tower,'terraces',belts,slab,exchange);
    for (const sector of [2,6,10,13,15,18,21,25,29]) {
      for (const [start,end] of [[9.15,19.58],[20.24,36.38],[37.02,47.7],[48.33,59.99]]) {
        for (let y=start; y<end-.02;) {
          const top=tower.contours.find(([level])=>level>y+.03)?.[0] ?? end;
          const next=Math.min(top,end);
          timber('concrete-buttresses',materials.concrete,point(y,sector,.11),point(next,sector,.11),.52,.49);
          y=next;
        }
      }
    }

    // Relay installed a single enclosed cage over the public elevation. Its
    // brackets, seams, and returns leave the original wall visible at both edges.
    const bays=[14.35,15.58,16.87,18.19,19.57,20.53];
    function mounted(y,s) { return point(y,s,.94); }
    for (let level=0; level<retrofitFloors.length-1; level++) {
      const bottom=retrofitFloors[level],top=retrofitFloors[level+1];
      for (let bay=0; bay<bays.length-1; bay++) {
        const a=bays[bay],b=bays[bay+1],span=b-a;
        const rails=[a,a+.36*span,a+.68*span,b];
        const tint=[0x36595b,0x5f9d95,0x3b7470,0x79aba2,0x406663][(bay*3+level*2)%5];
        for (let pane=0;pane<rails.length-1;pane++) {
          strip('retrofit',rails[pane]+.014,rails[pane+1]-.014,bottom+.11,top-.12,.95,tint);
          timber('retrofit-mullions',materials.steel,mounted(bottom,rails[pane]),mounted(top,rails[pane]),.132,.148);
        }
        timber('retrofit-frames',materials.steel,mounted(bottom,a),mounted(bottom,b),.19,.29);
        if ((bay+level)%3!==1) timber('diagnostic-strips',materials.light,
          point(bottom+.27,a+.08,1.06),point(bottom+.27,b-.10,1.06),.053,.047,0x8debd0);
        if ((bay+level)%3===0) for (const s of [a+.25*span,a+.73*span]) {
          timber('service-return',bronze,point(bottom-.13,s,-.09),point(bottom-.13,s,1.08),.21,.19);
        }
        if (level===retrofitFloors.length-2) {
          timber('retrofit-frames',materials.steel,mounted(top,a),mounted(top,b),.19,.29);
          timber('retrofit-cap',materials.steel,point(top+.08,a,.27),point(top+.08,b,.27),1.36,.26);
        }
      }
      const last=bays.at(-1);
      timber('retrofit-mullions',materials.steel,mounted(bottom,last),mounted(top,last),.22,.19);
      for (const s of [bays[0],last]) {
        timber('service-return',bronze,point(bottom,s,.04),mounted(bottom,s),.18,.22);
      }
    }

    // An exposed uplink backbone carries the new service back into the old plant room.
    for (const sector of [20.92,21.08]) {
      const levels=[11.55,14.3,17.5,22.8,28.0,33.4,37.77,41.5];
      for (let i=1;i<levels.length;i++) {
        const y=levels[i],prev=levels[i-1];
        timber('retrofit-conduits',bronze,point(prev,sector,1.00),point(y,sector,1.00),.13,.13);
        timber('conduit-mounts',materials.steel,point(y,sector,0),point(y,sector,1.06),.20,.16);
      }
      timber('retrofit-conduits',bronze,point(11.55,sector,1),point(11.55,sector,.02),.13,.13);
      timber('retrofit-conduits',bronze,point(41.5,sector,1),point(41.5,sector,.01),.13,.13);
    }
    block('uplink-controller',materials.steel,point(13.3,20.99,1.06),.58,1.37,.79);
    timber('diagnostic-strips',materials.light,point(12.9,20.89,1.36),point(13.54,20.89,1.36),.05,.052,0x86cfb6);

    const [roofX,roofZ]=[tower.x+3.42,tower.z+1.68];
    block('old-switch-room',materials.concrete,[roofX+.4,61.32,roofZ],5.1,2.1,5.7);
    block('old-switch-room-cap',bronze,[roofX+.4,62.45,roofZ],5.35,.38,6);
    block('uplink-blades',materials.steel,[roofX-1.5,64.4,roofZ-.8],.26,3.63,1.32);
    block('uplink-blades',materials.steel,[roofX-1.44,65.0,roofZ+.87],.28,4.99,1.15);
    timber('roof-beacon',materials.light,[roofX-1.44,67.42,roofZ+.55],[roofX-1.44,67.42,roofZ+1.17],.092,.088,0xef925e);

    if (typeof document!=='undefined') {
      sign(THREE,exchange,point,bronze,{s:16.02,y:9.67,offset:.34,width:6.65,height:.83,civic:true});
      sign(THREE,exchange,point,materials.steel,{s:15.70,y:14.7,offset:.82,width:7.55,height:1.89,civic:false});
    }
    for (const [kind,{positions,colors,uvs}] of buffers) {
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,faceMaterials[kind]);
      mesh.name=kind==='wall' ? 'portfolio-exchange-canopy-facade' : 'portfolio-exchange-'+kind;
      mesh.userData.portfolioAuditSolid=kind==='wall';
      exchange.add(mesh);
    }
  }

  function sign(THREE,group,point,frame,{s,y,width,height,offset,civic}) {
    const canvas=document.createElement('canvas');
    canvas.width=768;
    canvas.height=civic ? 88 : 192;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle=civic ? '#51473a' : '#141917';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle=civic ? '#6e6455' : '#a27a4b';
    ctx.lineWidth=civic ? 3 : 5;
    ctx.strokeRect(8,8,canvas.width-16,canvas.height-16);
    if (civic) {
      ctx.fillStyle='#bbac94';
      ctx.font='700 42px monospace';
      ctx.fillText('MUNICIPAL TELEPHONE EXCHANGE',23,57,720);
      for (let i=0; i<97; i++) {
        ctx.fillStyle=i%5===0 ? '#a891683f' : '#25231f33';
        ctx.fillRect((i*703)%749+8, (i*31)%72+8, 5+i%11,1+i%4);
      }
    } else {
      ctx.fillStyle='#eebe80';
      ctx.font='900 88px system-ui, sans-serif';
      ctx.fillText('RELAY',31,100);
      ctx.font='700 34px monospace';
      ctx.fillText('PRIORITY NETWORK',34,149);
      ctx.font='700 22px monospace';
      ctx.fillStyle='#c4a276';
      ctx.fillText('MEMBERS',588,69);
      ctx.fillText('ONLY',588,105);
      ctx.fillStyle='#9f734b';
      ctx.fillRect(562,44,3,96);
    }
    const map=new THREE.CanvasTexture(canvas);
    map.encoding=THREE.sRGBEncoding;
    map.anisotropy=4;
    const face=civic ? new THREE.MeshStandardMaterial({map,roughness:.88}) : new THREE.MeshBasicMaterial({map,toneMapped:false});
    const depth=civic ? .15 : .36;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),[frame,frame,frame,frame,face,frame]);
    mesh.name=civic ? 'portfolio-exchange-civic-plaque' : 'portfolio-exchange-relay-cabinet';
    mesh.position.fromArray(point(y,s,offset));
    const a=point(y,s-.07,offset), b=point(y,s+.07,offset);
    mesh.rotation.y=Math.atan2(b[2]-a[2],a[0]-b[0]);
    mesh.userData.portfolioAdFace=true;
    mesh.userData.portfolioAdId=civic ? 'municipal-exchange' : 'relay-priority-network';
    group.add(mesh);
    const support=new THREE.BoxGeometry(.27,civic ? .37 : .68,civic ? .48 : .95);
    for (const x of [-width*.35,width*.35]) {
      const mount=new THREE.Mesh(support,frame);
      mount.name=mesh.name+'-mount';
      mount.position.set(x,0,civic ? -.27 : -.57).applyEuler(mesh.rotation).add(mesh.position);
      mount.rotation.copy(mesh.rotation);
      group.add(mount);
    }
  }

  return {attach};
});
