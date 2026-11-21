(function(root,factory) {
  const props=factory();
  if (typeof module==='object' && module.exports) module.exports=props;
  else root.DrivePortfolioSidewalkProps=props;
})(globalThis,function() {
  'use strict';

  const dimensions={
    bench:[2.34,.90,1.02],bin:[.88,.82,1.10],'bag-pile':[1.16,.90,.66],litter:[1.12,.82,.10],
    planter:[1.50,1.28,1.35],'potted-tree':[1.30,1.28,2.42],'bike-rack':[1.98,.84,.87],
    'crate-stack':[1.08,.90,1.14],'newspaper-box':[.78,.76,1.18],'utility-cabinet':[1.08,.74,1.48],
    'vending-machine':[1.18,.85,1.99],'a-frame':[.85,.81,1.06],bollard:[.42,.42,1.06],
    'market-basket':[1.25,.90,.80],pallet:[1.30,.96,.19],'drain-grate':[.69,.88,.06],
    'street-stool':[.70,.70,.70],'service-cart':[1.38,.86,1.14]
  };
  const catalog=Object.fromEntries(Object.entries(dimensions).map(([id,[width,depth,height]])=>[id,{width,depth,height}]));
  const dark=0x252f35, steel=0x566269, dust=0x8f9590, wood=0x816656, rust=0x906455;
  const yellow=0xcb9f62, frost=0xdbd7c4, amber=0xf3c28c, paper=0xbeac8d;
  const paints={
    about:[0xa75c4f,0xf3ae89,0x77854d],
    experience:[0x52717d,0xa7cfda,0x6e8375],
    projects:[0x4c7573,0x99dad2,0x67865d],
    education:[0x966253,0xf3d299,0x7b905b],
    skills:[0x69745f,0xc6dca6,0x687f5b],
    contact:[0x815c7d,0xdfa1c8,0x796c8e],
    'night-market':[0x895e71,0xf9c386,0x7e8962],
    'switchyard-park':[0x62816c,0xc6e6ad,0x738854],
    default:[0x566a6c,0xbdbfc9,0x729378]
  };
  const aliases={
    'arrival-concourse':'about','service-district':'experience','projects-plaza':'projects',
    'boulder-campus':'education','workshop-quarter':'skills','south-street':'contact'
  };
  const salvagedPaint={2:0x4d6068,4:0x776958};
  const appearances={
    pressure:['SERVICE','72 V','#d4bc81','#333c3e',.376,.293],
    paper:['CITY PRESS','LATE EDITION','#d9c692','#6f4d4e',.493,.160],
    vending:['NIGHT SODA','COLD DRINKS','#bce0d8','#29454e',.926,.236],
    menu:['OPEN','COUNTER SERVICE','#f0cb8b','#2f3337',.661,.629]
  };

  function bench({box,tube,paint,accent,v}) {
    for (const x of [-.81,.81]) {
      box('iron',dark,x,.065,0,.27,.13,.62);
      box('iron',steel,x,.30,.03,.12,.44,.37);
      tube('iron',paint,[x,.36,-.29],[x,.89,-.34],.102);
      tube('iron',steel,[x,.50,.31],[x,.66,.23],.077);
      tube('iron',steel,[x,.66,.23],[x,.70,-.23],.077);
    }
    for (let i=0;i<4;i++) {
      box('matte',v%3===1 ? paint : wood,0,.489,-.24+i*.158,2.25,.089,.142);
      box('matte',i===1 && v%3===2 ? paint : wood,0,.629+i*.105,-.338,2.25,.091,.073);
    }
    box('iron',dark,0,.406,0,1.89,.10,.19);
    box('glow',accent,-1.06,.875,-.29,.067,.047,.024);
  }

  function bin({box,round,paint,accent,v}) {
    round(steel,0,.055,0,.76,.11,.69);
    round(paint,0,.505,0,.76,.86,.71);
    round(steel,0,.865,0,.842,.11,.752);
    round(v%2 ? rust : dark,0,.981,0,.82,.162,.742);
    box('iron',dark,0,.919,.351,.49,.093,.091);
    box('iron',dust,0,.982,.347,.53,.056,.069);
    box('glow',accent,0,.697,.359,.21,.065,.022);
    for (const x of [-.26,.26]) box('matte',dark,x,.45,.283,.043,.57,.034);
  }

  function bagPile({round,shape,box,v,plant}) {
    const bags=v%2 ? [[-.25,.05,.64,.41,.59],[.25,-.11,.54,.37,.46],[.29,.22,.33,.28,.34]]
      : [[-.26,-.08,.63,.43,.64],[.26,.095,.55,.35,.51]];
    for (const [i,[x,z,w,h,d]] of bags.entries()) {
      const color=i===2 ? plant : i ? 0x2e3637 : 0x252b2e;
      shape('lump','rubber',color,x,h*.47,z,w,h,d,.31*(i+v),i%2 ? .16 : -.11);
      shape('lump','rubber',color,x+.024,h*.99,z-.016,w*.25,.113,d*.19,.29);
      round(0x54554d,x+.027,h*.96,z-.016,w*.14,.046,d*.116);
    }
    box('matte',paper,.38,.029,-.30,.21,.033,.115,.55);
  }

  function litter({box,shape,accent,v}) {
    box('matte',v%2 ? 0xaeb5ac : paper,-.23,.015,-.06,.43,.027,.31,v*.20);
    box('matte',frost,-.24,.032,-.12,.28,.015,.12,v*.20);
    box('matte',rust,.21,.019,.22,.27,.023,.24,.7);
    box('matte',0x53636c,.23,.033,.19,.18,.012,.03,.7);
    shape('tube','iron',accent,.33,.039,-.21,.065,.141,.062,.96,1.57);
  }

  function planter({box,shape,tube,paint,plant,v}) {
    box('stone',0x777970,0,.12,0,1.40,.24,1.16);
    box('stone',paint,0,.264,0,1.32,.26,1.09);
    box('stone',dust,0,.379,0,1.47,.093,1.24);
    box('matte',0x514b40,0,.422,0,1.27,.034,1.07);
    for (const [i,[x,z,h]] of [[-.45,.21,.45],[-.22,-.23,.60],[.14,-.19,.77],[.46,.21,.53],[.28,.28,.48]].entries()) {
      tube('wood',wood,[x,.42,z],[x-.043,.41+h,z-.044],.035);
      for (const off of [-1,1]) {
        shape('leaf','foliage',i%2 ? plant : 0x879967,x+off*.11,.39+h*.77,z,.255,.32,.225,
          (v+i)*.69,off*.54);
      }
      shape('leaf','foliage',i%2 ? 0x879967 : plant,x-.04,.47+h,z-.03,.26,.21,.23,i*.71);
    }
  }

  function pottedTree({round,shape,tube,paint,plant,v}) {
    shape('pot','stone',paint,0,.235,0,.66,.47,.65);
    round(steel,0,.446,0,.70,.084,.70);
    round(0x514a40,0,.494,0,.56,.039,.54);
    tube('wood',wood,[.015,.51,0],[-.052,1.84,.002],.078);
    for (const [i,[x,y,z,w,h,d]] of [[-.21,1.87,.05,.70,.65,.67],[.20,1.97,-.08,.75,.64,.70],
      [.02,2.18,.08,.66,.56,.67],[.11,1.77,.20,.54,.51,.55],[-.04,1.83,-.24,.53,.48,.52]].entries()) {
      tube('wood',wood,[-.043,1.33+i*.042,0],[x,y-.21,z],.044);
      const tint=v%3===2 && i%2 ? 0xad9462 : i%2 ? plant : 0x7f8d61;
      shape('leaf','foliage',tint,x,y,z,w,h,d,i*.53);
    }
  }

  function bikeRack({box,shape,tube,paint,accent,v}) {
    for (const x of [-.68,0,.68]) {
      box('iron',dark,x,.037,-.126,.32,.074,.51);
      for (const z of [-.28,.038]) {
        tube('iron',steel,[x,.055,z],[x,.69,z],.075);
      }
      tube('iron',steel,[x,.69,-.28],[x,.775,-.211],.075);
      tube('iron',steel,[x,.775,-.211],[x,.775,-.03],.075);
      tube('iron',steel,[x,.775,-.03],[x,.69,.038],.075);
    }
    if (v%2) {
      for (const x of [-.48,.48]) {
        shape('ring','rubber',dark,x,.235,.253,.57,.57,.53);
        shape('ring','iron',dust,x,.235,.257,.49,.49,.35);
      }
      const A=[-.48,.235,.252],B=[-.16,.573,.252],C=[.07,.263,.252],D=[.37,.576,.252],E=[.48,.235,.252];
      for (const [a,b] of [[A,B],[A,C],[B,C],[B,D],[C,D],[D,E]]) tube('iron',paint,a,b,.051);
      tube('iron',steel,[.37,.57,.252],[.43,.70,.252],.039);
      box('iron',accent,.45,.72,.252,.17,.04,.14);
      box('rubber',dark,-.16,.599,.252,.19,.063,.10);
    }
  }

  function crate({box,paint,v}) {
    const rows=v%3===0 ? 3 : 2;
    for (let i=0;i<rows;i++) {
      const y=.16+i*.324,x=i%2 ? .047 : -.040,z=i%2 ? -.023 : .039;
      const color=v%2 ? (i%2 ? rust : paint) : (i%2 ? steel : wood);
      box('matte',color,x,y-.105,z,.86,.10,.69);
      box('matte',dark,x,y-.038,z,.79,.051,.64);
      for (const dx of [-.395,.395]) for (const dz of [-.31,.31]) box('matte',color,x+dx,y+.027,z+dz,.084,.268,.083);
      for (const dy of [-.06,.072,.147]) for (const side of [-1,1]) {
        box('matte',color,x,y+dy,z+side*.317,.88,.064,.075);
        box('matte',color,x+side*.405,y+dy,z,.071,.064,.70);
      }
    }
  }

  function newspaper({box,label,paint,accent}) {
    box('iron',dark,0,.035,.016,.66,.068,.59);
    box('iron',paint,0,.353,-.052,.54,.66,.47);
    box('iron',paint,0,.795,.003,.71,.72,.65);
    box('iron',accent,0,1.080,.013,.741,.083,.57);
    box('glass',0x38454b,0,.917,.333,.527,.191,.036);
    label('paper',0,.914,.355,.493,.160);
    box('iron',dark,0,.702,.344,.45,.103,.065);
    box('iron',dust,.233,.687,.365,.032,.121,.044);
    box('matte',dust,-.188,.64,.341,.11,.068,.015);
  }

  function utility({box,label,paint,accent,v}) {
    box('stone',dust,0,.058,0,.99,.116,.69);
    box('iron',paint,0,.768,-.02,.93,1.305,.65);
    box('iron',v%2 ? rust : steel,0,1.419,-.018,1.03,.087,.696);
    box('iron',dark,-.089,1.042,.309,.416,.337,.062);
    label('pressure',-.089,1.042,.345,.376,.293);
    for (let i=0;i<6;i++) box('iron',dark,.08,.29+i*.075,.324,.57,.038,.061);
    for (const y of [.30,1.16]) box('iron',dust,-.428,y,.344,.062,.13,.067);
    box('iron',dust,.367,.865,.346,.077,.212,.062);
    box('glow',accent,.276,1.22,.341,.093,.056,.024);
  }

  function vending({box,label,paint,accent,v}) {
    box('iron',dark,0,.035,0,1.13,.07,.79);
    box('iron',paint,0,.998,-.031,1.10,1.87,.753);
    box('iron',dark,0,1.765,.363,.985,.28,.068);
    label('vending',0,1.764,.402,.926,.236);
    box('glass',0x293b43,-.112,1.132,.353,.711,.9,.088);
    box('glow',accent,-.112,1.539,.398,.673,.03,.026);
    const bottles=[0xd5a27e,0xa0bed2,0xc497bc,0xc8ba74];
    for (const [row,y] of [.869,1.104,1.34].entries()) {
      box('iron',steel,-.112,y-.061,.414,.70,.052,.047);
      for (let i=0;i<5;i++) {
        if ((i+row+v)%9===0) continue;
        const x=-.377+i*.134,c=bottles[(v+row+i)%4];
        box('matte',c,x,y+.04,.414,.075,.161,.043);
        box('matte',frost,x,y+.121,.416,.051,.032,.042);
        box('matte',frost,x,y+.037,.439,.069,.028,.012);
      }
    }
    box('iron',dark,.355,1.09,.378,.151,.563,.075);
    box('glow',accent,.355,1.28,.421,.105,.061,.023);
    for (let i=0;i<3;i++) box('matte',dust,.355,1.16-i*.069,.424,.071,.032,.024);
    box('iron',dark,-.107,.379,.371,.671,.222,.102);
    box('iron',steel,-.107,.322,.419,.653,.044,.028);
  }

  function aFrame({box,tube,label,paint}) {
    for (const side of [-1,1]) {
      box('wood',paint,0,.526,side*.156,.773,.87,.082,0,0,-side*.31);
      for (const x of [-.335,.335]) {
        tube('iron',dark,[x,.05,side*.337],[x,.949,0],.098);
        box('iron',dark,x,.049,side*.34,.135,.098,.10);
      }
    }
    box('iron',steel,0,.955,0,.769,.075,.15);
    label('menu',0,.531,.209,.661,.629,0,0,-.31);
  }

  function bollard({round,shape,paint,accent,v}) {
    round(dark,0,.047,0,.403,.094,.403);
    round(v%2 ? steel : paint,0,.485,0,.28,.85,.28);
    round(yellow,0,.671,0,.298,.104,.298);
    shape('tube','glow',accent,0,.824,0,.286,.047,.286);
    round(dark,0,.955,0,.29,.085,.29);
  }

  function marketBasket({box,shape,paint,v}) {
    box('wood',wood,0,.066,0,1.13,.12,.78);
    for (const x of [-.53,.53]) for (const z of [-.356,.356]) box('wood',paint,x,.198,z,.115,.38,.109);
    for (const y of [.147,.268,.356]) {
      for (const side of [-1,1]) box('wood',wood,0,y,side*.363,1.177,.076,.092);
      for (const side of [-1,1]) box('wood',wood,side*.534,y,0,.092,.076,.815);
    }
    box('matte',0x574d44,0,.293,0,1.04,.11,.66);
    const fruit=[0xa46b48,0xc49555,0xa3a362,0x955861];
    for (let i=0;i<12;i++) {
      const x=(i%4-1.5)*.22,z=(Math.floor(i/4)-1)*.177;
      shape('lump','matte',fruit[(v+i)%4],x,.40+(i%3)*.019,z,.175,.162,.173,i*.51);
    }
    box('wood',paint,.14,.527,-.312,.35,.229,.064,0,.12);
    box('matte',paper,.146,.532,-.275,.246,.084,.022,0,.12);
  }

  function pallet({box,v}) {
    for (const z of [-.34,0,.34]) {
      box('wood',wood,0,.04,z,1.16,.08,.104);
      for (const x of [-.41,0,.41]) box('wood',wood,x,.098,z,.139,.083,.13);
    }
    for (let i=0;i<5;i++) box('wood',(i+v)%4 ? wood : rust,0,.146,(i-2)*.164,1.22,.058,.138);
    for (const x of [-.54,.54]) box('iron',steel,x,.149,-.279,.068,.054,.088);
  }

  function drain({box,paint}) {
    box('iron',dark,0,.019,0,.65,.038,.841);
    for (const z of [-.393,.393]) box('iron',steel,0,.035,z,.626,.025,.048);
    for (const x of [-.293,.293]) box('iron',steel,x,.038,0,.047,.028,.741);
    for (let i=0;i<8;i++) box('iron',i===1 ? paint : steel,0,.036,(i-3.5)*.089,.558,.030,.040);
  }

  function stool({box,round,tube,paint,accent,v}) {
    for (let i=0;i<4;i++) {
      const x=i%2 ? .215 : -.215,z=i<2 ? .213 : -.213;
      tube('iron',steel,[x,.047,z],[x*.68,.55,z*.68],.068);
      box('rubber',dark,x,.041,z,.089,.077,.087);
    }
    round(dark,0,.521,0,.52,.105,.52);
    round(v%2 ? paint : wood,0,.588,0,.57,.109,.565);
    round(accent,0,.633,0,.474,.032,.471);
  }

  function cart({box,shape,tube,paint,accent,v}) {
    for (const x of [-.49,.49]) for (const z of [-.268,.268]) {
      shape('tube','rubber',dark,x,.102,z,.189,.075,.189,0,0,Math.PI/2);
      shape('tube','iron',steel,x,.102,z,.108,.085,.108,0,0,Math.PI/2);
    }
    box('iron',steel,0,.221,0,1.16,.115,.717);
    box('iron',paint,0,.283,0,1.15,.073,.678);
    for (const z of [-.279,.279]) tube('iron',dark,[-.459,.264,z],[-.59,1.03,z],.049);
    tube('iron',steel,[-.59,1.03,-.29],[-.59,1.03,.29],.059);
    box('rubber',dark,-.604,1.031,0,.094,.084,.289);
    box('matte',v%2 ? paint : rust,.13,.505,0,.733,.38,.54);
    box('matte',dust,.14,.711,0,.757,.076,.565);
    box('matte',accent,.478,.50,0,.06,.117,.29);
  }

  const designs={
    bench,bin,'bag-pile':bagPile,litter,planter,'potted-tree':pottedTree,'bike-rack':bikeRack,
    'crate-stack':crate,'newspaper-box':newspaper,'utility-cabinet':utility,'vending-machine':vending,
    'a-frame':aFrame,bollard,'market-basket':marketBasket,pallet,'drain-grate':drain,'street-stool':stool,'service-cart':cart
  };

  function attach(THREE,world,items) {
    const group=new THREE.Group();
    group.name='portfolio-sidewalk-props';
    const textures=[], geometries={
      box:new THREE.BoxGeometry(1,1,1),
      tube:new THREE.CylinderGeometry(.5,.5,1,10),
      pot:new THREE.CylinderGeometry(.5,.33,1,10),
      ring:new THREE.TorusGeometry(.37,.048,6,16),
      lump:new THREE.IcosahedronGeometry(.5,1),
      leaf:new THREE.IcosahedronGeometry(.5,0),
      face:new THREE.PlaneGeometry(1,1)
    };
    for (const geometry of Object.values(geometries)) geometry.computeBoundingBox();
    const standard=(options)=>new THREE.MeshStandardMaterial({color:0xffffff,...options});
    const source=world.getObjectByName('portfolio-curbs')?.material?.map || null;
    function wear(wood) {
      if (typeof document==='undefined') return null;
      const canvas=document.createElement('canvas'), size=128;
      canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d'), image=ctx.createImageData(size,size);
      let seed=wood ? 181 : 1771;
      for (let y=0;y<size;y++) for(let x=0;x<size;x++) {
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        const noise=(seed>>>27)-15;
        const grain=wood ? Math.sin(y*.49+Math.sin(x*.052)*.65)*9+Math.cos(y*.22)*7 : Math.sin(y*.11+Math.cos(x*.092))*5;
        const value=wood ? 222+noise*.52+grain : 234+noise*.61+grain;
        const index=(y*size+x)*4;
        image.data[index]=image.data[index+1]=image.data[index+2]=value;
        image.data[index+3]=255;
      }
      ctx.putImageData(image,0,0);
      ctx.fillStyle=wood ? '#351d15aa' : '#36281a66';
      for(let i=0;i<19;i++) {
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        ctx.fillRect((seed>>>8)%size,(seed>>>15)%size,(wood ? 8 : 2)+(seed>>>23)%14,1);
      }
      const map=new THREE.CanvasTexture(canvas);
      map.encoding=THREE.sRGBEncoding;
      textures.push(map);
      return map;
    }
    const finishes={
      iron:standard({map:wear(false),roughness:.60,metalness:.43}),matte:standard({roughness:.82}),
      wood:standard({map:wear(true),roughness:.93}),stone:standard({map:source,roughness:.94}),
      glass:standard({roughness:.33,metalness:.13}),rubber:standard({roughness:.96}),
      foliage:standard({roughness:1,flatShading:true}),
      glow:new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false})
    };
    for(const [id,[title,caption,ink,background,faceWidth,faceHeight]] of Object.entries(appearances)) {
      if(typeof document==='undefined') {
        finishes[id]=finishes.glow;
        continue;
      }
      const signs=globalThis.DrivePortfolioSignText;
      const {canvas,ctx}=signs.canvas(faceWidth,faceHeight,128,64);
      ctx.fillStyle=background;
      ctx.fillRect(0,0,128,64);
      ctx.strokeStyle=ink;
      ctx.strokeRect(3.5,3.5,121,57);
      ctx.textAlign='center';
      ctx.fillStyle=ink;
      ctx.font=`800 ${id==='menu' ? 24 : 21}px system-ui,sans-serif`;
      signs.text(ctx,title,64,32,111);
      ctx.font='700 10px monospace';
      signs.text(ctx,caption,64,49,111);
      const map=new THREE.CanvasTexture(canvas);
      map.encoding=THREE.sRGBEncoding;
      textures.push(map);
      finishes[id]=new THREE.MeshBasicMaterial({map,toneMapped:false});
    }

    const pose=new THREE.Object3D(), place=new THREE.Object3D();
    const a=new THREE.Vector3(), b=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);
    const bounds=new THREE.Box3(), scratchBounds=new THREE.Box3();
    const batches=new Map(), counts={};
    let total=0;
    for (const {type,x,y,z,heading=0,variant=0,district} of items) {
      if (!Object.prototype.hasOwnProperty.call(catalog,type)) continue;
      const {width,depth,height}=catalog[type];
      const [districtPaint,accent,plant]=paints[aliases[district] || district] || paints.default;
      const v=Math.abs(Math.trunc(variant))%24;
      const paint=salvagedPaint[v%6] ?? districtPaint;
      const pieces=[];
      bounds.makeEmpty();
      function add(kind,finish,color) {
        pose.updateMatrix();
        bounds.union(scratchBounds.copy(geometries[kind].boundingBox).applyMatrix4(pose.matrix));
        pieces.push({kind,finish,color,matrix:pose.matrix.clone()});
      }
      function shape(kind,finish,color,x,y,z,w,h,d,yaw=0,roll=0,pitch=0) {
        pose.position.set(x,y,z);
        pose.scale.set(w,h,d);
        pose.rotation.set(pitch,yaw,roll,'YXZ');
        add(kind,finish,color);
      }
      const box=(finish,color,...args)=>shape('box',finish,color,...args);
      const round=(color,...args)=>shape('tube','iron',color,...args);
      const label=(style,x,y,z,w,h,yaw=0,roll=0,pitch=0)=>shape('face',style,0xffffff,x,y,z,w,h,1,yaw,roll,pitch);
      function tube(finish,color,from,to,diameter) {
        a.fromArray(from);
        b.fromArray(to);
        pose.position.copy(a).lerp(b,.5);
        b.sub(a);
        pose.scale.set(diameter,b.length(),diameter);
        pose.quaternion.setFromUnitVectors(up,b.normalize());
        add('tube',finish,color);
      }
      designs[type]({box,round,shape,tube,label,paint,accent,plant,v});
      // Bound the whole prop after its pieces have been posed. Racks and foliage
      // can vary without making their declared sidewalk footprints inaccurate.
      const scale=Math.min(1,width/(2*Math.max(-bounds.min.x,bounds.max.x)),
        depth/(2*Math.max(-bounds.min.z,bounds.max.z)),height/(bounds.max.y-bounds.min.y))*.997;
      place.position.set(x,y-bounds.min.y*scale,z);
      place.rotation.y=heading;
      place.scale.setScalar(scale);
      place.updateMatrix();
      for (const {kind,finish,color,matrix} of pieces) {
        const key=kind+'-'+finish;
        if (!batches.has(key)) batches.set(key,{kind,finish,parts:[]});
        batches.get(key).parts.push({color,matrix:matrix.premultiply(place.matrix)});
      }
      counts[type]=(counts[type] || 0)+1;
      total++;
    }
    for (const [key,{kind,finish,parts}] of batches) {
      const mesh=new THREE.InstancedMesh(geometries[kind],finishes[finish],parts.length);
      mesh.name='portfolio-sidewalk-prop-'+key;
      for (const [i,{matrix,color}] of parts.entries()) {
        mesh.setMatrixAt(i,matrix);
        mesh.setColorAt(i,new THREE.Color(color).convertSRGBToLinear());
      }
      mesh.receiveShadow=finish!=='glow';
      group.add(mesh);
    }
    group.userData.itemCount=total;
    group.userData.itemCounts=counts;
    world.add(group);
    return {group,dispose() {
      world.remove(group);
      for (const geometry of Object.values(geometries)) geometry.dispose();
      for (const material of new Set(Object.values(finishes))) material.dispose();
      for (const texture of textures) texture.dispose();
    }};
  }

  return {catalog,attach};
});
