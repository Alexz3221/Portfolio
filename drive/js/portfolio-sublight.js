(function(root,factory) {
  if (typeof module==='object' && module.exports) module.exports=factory(require('./portfolio-exchange-concrete'));
  else root.DrivePortfolioSublight=factory(root.DrivePortfolioExchangeConcrete);
})(globalThis,function(concrete) {
  'use strict';

  // Old transit interlocking and freight hoist. Each list defines the actual
  // masonry setbacks rather than a surface pattern on a shared tower shell.
  const northTiers = [
    {bottom:8.8,top:25.08,outline:[[-8.16,-4.78],[8.18,-4.78],[8.18,4.78],[-6.45,4.78],[-8.16,3.08]]},
    {bottom:25.08,top:44.42,outline:[[-6.16,-4.73],[9.96,-4.73],[9.96,5.56],[-4.20,5.56],[-6.16,3.60]]},
    {bottom:44.42,top:64.30,outline:[[-2.69,-3.32],[11.70,-3.32],[11.70,6.60],[-2.69,6.60]]},
    {bottom:64.30,top:72.45,slope:.47,outline:[[-1.82,-2.84],[9.05,-2.84],[9.05,5.64],[-1.82,5.64]]}
  ];
  const southTiers = [
    {bottom:8.8,top:22.58,outline:[[-6.36,-5.01],[7.78,-5.01],[7.78,4.92],[-8.13,4.92],[-8.13,-3.18]]},
    {bottom:22.58,top:40.94,outline:[[-4.35,-5.48],[9.67,-5.48],[9.67,3.65],[-5.96,3.65],[-5.96,-3.87]]},
    {bottom:40.94,top:52.56,outline:[[-1.83,-5.24],[10.14,-5.24],[10.14,2.67],[-1.83,2.67]]},
    {bottom:52.56,top:57.28,slope:-.38,outline:[[.01,-3.85],[8.83,-3.85],[8.83,2.50],[.01,2.50]]}
  ];

  function attach(THREE, world, {towers,materials,instance,beam,grime}) {
    const masonry=concrete.create(THREE,grime);
    const glass=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.53,metalness:.32,
      emissive:0x334240,emissiveIntensity:.27});
    const trim=new THREE.MeshStandardMaterial({color:0x252424,roughness:.77,metalness:.43});
    const alloy=new THREE.MeshStandardMaterial({color:0x414146,roughness:.43,metalness:.56});
    const glaze=new THREE.MeshStandardMaterial({color:0x4b211e,roughness:.26,metalness:.37,
      emissive:0x6c2420,emissiveIntensity:.35});
    const flavors={masonry,glass,glaze};
    const tint=new THREE.Color();
    const towerPair = [towers.find(tower=>tower.id==='split-lobby-south'),towers.find(tower=>tower.id==='split-lobby-north')];
    for (const [index,tower] of towerPair.entries()) {
      const north=index===1, tiers=north ? northTiers : southTiers;
      const family=north ? 'interlocking' : 'freight-hoist';
      const group=new THREE.Group();
      group.name='portfolio-sublight-'+family;
      world.add(group);
      const parts=new Map();
      function triangle(material,points,shade,uv) {
        if(!parts.has(material)) parts.set(material,{positions:[],colors:[],uvs:[]});
        const batch=parts.get(material);
        tint.setHex(shade).convertSRGBToLinear();
        for(let i=0;i<3;i++) {
          batch.positions.push(...points[i]);
          batch.colors.push(tint.r,tint.g,tint.b);
          batch.uvs.push(...uv[i]);
        }
      }
      function panel(material,a,b,c,d,shade,uv) {
        triangle(material,[a,c,b],shade,[uv[0],uv[2],uv[1]]);
        triangle(material,[b,c,d],shade,[uv[1],uv[2],uv[3]]);
      }
      const box=(feature,material,x,y,z,w,h,d,yaw=0)=>
        instance(group.name+'-'+feature,material,x,y,z,w,h,d,yaw);
      const line=(feature,material,a,b,w,h,color=null)=>
        beam(group.name+'-'+feature,material,a,b,w,h,color);

      for (const [index,tier] of tiers.entries()) {
        const {outline,bottom,top,slope=0}=tier;
        const apex=[tower.x+2.35,top,tower.z];
        const soffit=[apex[0],bottom,apex[2]];
        let offset=north ? 4.6 : 13.2;
        for (const [edge,[x,z]] of outline.entries()) {
          const [nx,nz]=outline[(edge+1)%outline.length];
          const dx=nx-x, dz=nz-z, length=Math.hypot(dx,dz);
          const point=(u,y,inset=0)=>{
            const along=u/length, localZ=z+dz*along;
            return [tower.x+x+dx*along+dz/length*inset,
              y+(y-bottom)/(top-bottom)*slope*localZ,tower.z+localZ-dx/length*inset];
          };
          const strip=(material,a,b,y0,y1,inset,shade)=>panel(material,point(a,y0,inset),point(b,y0,inset),
            point(a,y1,inset),point(b,y1,inset),shade,[[a+offset,y0],[b+offset,y0],[a+offset,y1],[b+offset,y1]]);
          const hues=north ? [0xf3eee8,0xd4c6b1,0xe1d6cc,0xc0c0b8] : [0xcabdad,0xbfae99,0xf1e4ca,0xa89d91];
          const shade=hues[(edge+index*3)%hues.length];
          const roofA=point(0,top),roofB=point(length,top);
          triangle('masonry',[apex,roofB,roofA],0xa49c90,[[apex[0],apex[2]],[roofB[0],roofB[2]],[roofA[0],roofA[2]]]);
          const bottomA=point(0,bottom),bottomB=point(length,bottom);
          triangle('masonry',[soffit,bottomA,bottomB],0x807468,
            [[soffit[0],soffit[2]],[bottomA[0],bottomA[2]],[bottomB[0],bottomB[2]]]);
          if(length<4.1 || index===tiers.length-1) {
            strip('masonry',0,length,bottom,top,0,shade);
            offset+=length;
            continue;
          }
          const west=dz<-.9 && Math.abs(dx)<.1;
          const isHoistSide=!north && west;
          const levels=Math.max(2,Math.round((top-bottom)/(north ? 4.0 : 5.1)));
          for(let storey=0;storey<levels;storey++) {
            const low=bottom+(top-bottom)*storey/levels, high=bottom+(top-bottom)*(storey+1)/levels;
            const sill=low+(north ? 1.37 : 2.03),head=sill+(isHoistSide ? .56 : north ? .94 : .58);
            const bays=Math.max(1,Math.round(length/(isHoistSide ? 4.6 : north ? 2.8 : 3.5)));
            const span=length/bays;
            strip('masonry',0,length,low,sill,0,shade);
            strip('masonry',0,length,head,high,0,shade);
            for(let bay=0;bay<bays;bay++) {
              const a=bay*span,b=a+span;
              const margin=north ? span*.28 : span*.22;
              const left=a+margin,right=b-margin, depth=north ? -.46 : -.31;
              if((bay+edge*2+storey*4+index)%9===0) {
                strip('masonry',a,b,sill,head,0,shade);
                continue;
              }
              strip('masonry',a,left,sill,head,0,shade);
              strip('masonry',right,b,sill,head,0,shade);
              const face=[point(left,sill),point(right,sill),point(left,head),point(right,head)];
              const back=[point(left,sill,depth),point(right,sill,depth),point(left,head,depth),point(right,head,depth)];
              const uv=[[left+offset,sill],[right+offset,sill],[left+offset,head],[right+offset,head]];
              panel('masonry',face[0],back[0],face[2],back[2],0x9e9180,uv);
              panel('masonry',back[1],face[1],back[3],face[3],0x998c7c,uv);
              panel('masonry',back[0],back[1],face[0],face[1],0x887f70,uv);
              panel('masonry',face[2],face[3],back[2],back[3],0xa3907f,uv);
              strip('glass',left,right,sill,head,depth,(bay*7+storey+edge*3)%11<2 ? 0xa88860 : 0x303939);
            }
          }
          // Deep concrete eyebrows above the exposed floor divisions.
          if(north && edge===0 && index<3) for (const fraction of [.33,.67]) {
            const y=bottom+(top-bottom)*fraction;
            line('bearing-bands',materials.concrete,point(.19,y,.19),point(length-.19,y,.19),.68,.43);
          }
          offset+=length;
        }
      }

      // The new operator concentrated its security infrastructure on the old
      // bridge wing and left the other facades in their original concrete.
      if(north) {
        const x=16.54, low=31.36, high=42.05, a=-79.32, b=-69.54;
        const paneX=x-.47;
        const band=[-79.32,-77.18,-74.45,-72.09,-69.54];
        for(const [bay,z] of band.entries()) {
          line('visor-uprights',alloy,[paneX,low,z],[paneX,high,z],.19,.21);
          if(bay===band.length-1) continue;
          const end=band[bay+1];
          for(const [start,top] of [[low+.24,35.0],[35.24,38.41],[38.65,high-.15]]) {
            panel('glaze',[paneX,start,end-.048],[paneX,start,z+.048],[paneX,top,end-.048],[paneX,top,z+.048],0xffffff,[[0,0],[1,0],[0,1],[1,1]]);
          }
          for(const y of [low,35.11,38.51,high]) line('visor-rails',trim,[paneX,y,z],[paneX,y,end],.29,.27);
        }
        // Cantilever beams visibly transfer the new box back onto the old wall.
        for(const z of [a+.20,-75.2,-72.42,b-.20]) {
          line('visor-supports',trim,[x+.88,low-1.62,z],[paneX-.34,low,z],.32,.32);
          line('visor-roof-supports',trim,[paneX,high+.24,z],[x+.70,high+.24,z],.44,.29);
        }
        box('visor-cap',alloy,x-.19,high+.15,(a+b)/2,1.13,.25,b-a+.32);
        line('visor-status',materials.light,[paneX-.14,38.50,a+.40],[paneX-.14,38.50,b-.63],.09,.051,0xf67c60);
        const shin=[-77.35,-72.22];
        for(const z of shin) {
          line('original-buttresses',materials.concrete,[14.86,9.16,z],[14.19,24.97,z],.81,1.09);
          line('original-buttresses',materials.concrete,[17.23,44.21,z],[16.03,32.5,z],.49,.61);
        }
        box('bridge-entry-block',alloy,17.81,29.09,-74.57,3.25,4.69,6.35);
        box('bridge-entry-gasket',trim,16.06,29.09,-74.57,.31,4.94,6.55);
        sign(THREE,group,trim,15.64,41.13,-73.96,6.08,1.06,'SUBLIGHT','AUTHORIZED TRANSIT ONLY','#f1ac94');
      } else {
        const x=14.56, z=-84.6;
        box('hoist-box',trim,15.15,22.85,z,2.0,24.5,3.05);
        for(const side of [-1,1]) {
          line('hoist-rails',materials.copper,[x-.49,9.35,z+side*1.145],[x-.49,35.46,z+side*1.145],.22,.26);
          for(const y of [12.8,17.8,24.3,29.7,35])
            line('hoist-anchors',alloy,[x-.55,y,z+side*1.17],[x+.98,y,z+side*1.17],.31,.30);
        }
        box('motor-housing',alloy,15.05,36.82,z,3.09,2.82,4.18);
        box('lift-cage',materials.copper,14.14,19.43,z,1.10,2.54,2.31);
        for(const y of [18.6,19.12,19.65,20.18]) line('lift-cage-welds',trim,[13.52,y,z-1.04],[13.52,y,z+1.04],.14,.15);
        line('lift-service-light',materials.light,[13.50,36.9,z-.88],[13.50,36.9,z+.66],.072,.067,0xf0b979);
        sign(THREE,group,trim,13.30,36.37,z,3.26,.79,'FREIGHT 03','NO PASSENGERS','#d6a876');
      }

      for(const [name,{positions,colors,uvs}] of parts) {
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
        geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
        geometry.computeVertexNormals();
        const mesh=new THREE.Mesh(geometry,flavors[name]);
        mesh.name=group.name+'-'+name;
        mesh.userData.portfolioAuditSolid=name==='masonry';
        group.add(mesh);
      }
    }
  }

  function sign(THREE,group,material,x,y,z,width,height,title,line,color) {
    if(typeof document==='undefined') return;
    const signs=globalThis.DrivePortfolioSignText;
    const {canvas,ctx}=signs.canvas(width,height,512,128);
    ctx.fillStyle='#25201f'; ctx.fillRect(0,0,512,128);
    ctx.fillStyle=color; ctx.fillRect(15,16,6,96);
    ctx.font='900 48px system-ui,sans-serif'; signs.text(ctx,title,36,60,452);
    ctx.font='700 27px monospace'; signs.text(ctx,line,38,99,440);
    const map=new THREE.CanvasTexture(canvas);
    map.encoding=THREE.sRGBEncoding;
    const display=new THREE.MeshBasicMaterial({map,toneMapped:false});
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,.21),[material,material,material,material,display,material]);
    mesh.name=group.name+'-sign';
    mesh.position.set(x,y,z);
    mesh.rotation.y=-Math.PI/2;
    mesh.userData.portfolioAdFace=true;
    mesh.userData.portfolioAdId=group.name;
    group.add(mesh);
    const brace=new THREE.BoxGeometry(.48,.26,.23);
    for(const offset of [-.31,.31]) {
      const mount=new THREE.Mesh(brace,material);
      mount.name=group.name+'-sign-mount';
      mount.position.set(x+.28,y,z+offset*width);
      group.add(mount);
    }
  }

  return {attach};
});
