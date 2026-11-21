(function(root, factory) {
  const mall = factory();
  if (typeof module === 'object' && module.exports) module.exports = mall;
  else root.DrivePortfolioSkyMall = mall;
})(globalThis, function() {
  'use strict';

  const assetBase = typeof document !== 'undefined' && document.currentScript?.src
    ? new URL('../assets/portfolio/', document.currentScript.src).href : 'assets/portfolio/';
  const deck = {minX:-22,maxX:22,minZ:31,maxZ:65,y:26};
  const destination = {
    id:'sky-mall',title:'Aerie Arcade',x:-14,y:deck.y,z:36,heading:0,mapX:-19,mapZ:59.5,kind:'landmark'
  };
  const stores = [
    {id:'one-more-chapter',x:-12.35,title:'ONE MORE CHAPTER',description:'LATE-NIGHT READING LOUNGE',ink:'#ffbf86',color:0xffbf86,base:0x724639},
    {id:'oops-thats-canon',x:0,title:'OOPS, THAT’S CANON',description:'SIGNAL CINEMA / INTERACTIVE STORIES',ink:'#baf7de',color:0xbaf7de,base:0x365c5c},
    {id:'computer-draw-a-little-guy',x:12.35,title:'COMPUTER, DRAW\nA LITTLE GUY',description:'RENDER WORKSHOP',ink:'#cac3fa',color:0xcac3fa,base:0x51466b}
  ];
  // The north edge leaves two 9.8m openings for the Skyway branches.
  const rails = [
    {x:-20.45,z:31.27,width:3.10,depth:.30},
    {x:0,z:31.27,width:18.2,depth:.30},
    {x:20.45,z:31.27,width:3.10,depth:.30},
    {x:-21.76,z:48.15,width:.30,depth:33.46},
    {x:21.76,z:48.15,width:.30,depth:33.46},
    {x:0,z:64.72,width:43.22,depth:.30}
  ];
  const arcade = {x:0,z:61.05,width:35.9,depth:6.20};
  const island = {x:0,z:35.7,width:13.6,depth:8.45,baseY:26,height:.58};
  const beacon = {x:0,z:36.9,width:4.1,depth:2.6,baseY:26.58,height:5};
  const colliders = [
    ...rails.map(rail=>({...rail,baseY:deck.y,height:1.38})),
    {x:0,z:60.75,width:37.1,depth:7.80,baseY:26.13,height:6.42},
    {x:0,z:61.21,width:23.6,depth:4.45,baseY:32.55,height:1.99},
    ...[-17.4,-5.8,5.8,17.4].map(x=>({x,z:53.69,width:2.18,depth:.62,baseY:26.13,height:.60})),
    island,beacon
  ];
  function turn(side,angle) {
    return [side*(6+8*Math.cos(angle)),38.5+8*Math.sin(angle)];
  }
  const westTurn = [0,1,2,3,4,5].map(step=>turn(-1,step*Math.PI/10));
  const drivePath = [[-14,deck.minZ],...westTurn,
    ...westTurn.slice().reverse().map(([x,z])=>[-x,z]),[14,deck.minZ]];

  function attach(THREE,world) {
    const group = new THREE.Group();
    group.name='portfolio-sky-mall';
    const textures = new Set();
    const materials = new Set();
    const geometries = new Set();
    function material(type,params) {
      const finish=new THREE[type](params);
      materials.add(finish);
      return finish;
    }
    function track(geometry) {
      geometries.add(geometry);
      return geometry;
    }
    function texture(file,x,y) {
      if (typeof document === 'undefined') return null;
      const map=new THREE.TextureLoader().load(assetBase+file);
      map.wrapS=map.wrapT=THREE.RepeatWrapping;
      map.repeat.set(x,y);
      map.anisotropy=4;
      textures.add(map);
      return map;
    }
    const pavement=texture('asphalt-diffuse.jpg',7,5);
    if (pavement) pavement.encoding=THREE.sRGBEncoding;
    const pavers=texture('arrival-sidewalk.webp',14,3);
    if (pavers) pavers.encoding=THREE.sRGBEncoding;
    const concrete=texture('concrete-bump.jpg',4,2);
    const finishes={
      slab:material('MeshStandardMaterial',{color:0x8d979f,map:pavement,roughness:.94}),
      paving:material('MeshStandardMaterial',{color:0x8b9b9b,map:pavers,roughness:.92}),
      cement:material('MeshStandardMaterial',{color:0xffffff,bumpMap:concrete,bumpScale:.26,roughness:.94}),
      steel:material('MeshStandardMaterial',{color:0xffffff,metalness:.52,roughness:.52}),
      window:material('MeshStandardMaterial',{color:0xffffff,metalness:.27,roughness:.27}),
      emission:material('MeshBasicMaterial',{color:0xffffff,toneMapped:false}),
      paint:material('MeshStandardMaterial',{color:0xffffff,roughness:.87})
    };
    const shapes = {
      box:track(new THREE.BoxGeometry(1,1,1)),
      octagon:track(new THREE.CylinderGeometry(.5,.5,1,8))
    };
    const pose = new THREE.Object3D();
    const batches = new Map();
    function part(shape,finish,color,x,y,z,width,height,depth,yaw=0,roll=0) {
      const key=shape+'-'+finish;
      if (!batches.has(key)) batches.set(key,{shape,finish,parts:[]});
      pose.position.set(x,y,z);
      pose.scale.set(width,height,depth);
      pose.rotation.set(0,yaw,roll,'YXZ');
      pose.updateMatrix();
      batches.get(key).parts.push({matrix:pose.matrix.clone(),color});
    }
    const box=(finish,color,...args)=>part('box',finish,color,...args);
    const octagon=(finish,color,...args)=>part('octagon',finish,color,...args);
    const cyan=0x93f5e7, amber=0xf7b179, steel=0x354955, concreteGray=0x66727d;
    function object(name,geometry,finish,x,y,z) {
      const mesh=new THREE.Mesh(geometry,finish);
      mesh.name=name;
      mesh.position.set(x,y,z);
      mesh.receiveShadow=true;
      group.add(mesh);
      return mesh;
    }
    const slab=object('portfolio-sky-mall-deck',track(new THREE.BoxGeometry(44,1.04,34)),finishes.slab,0,25.48,48);
    slab.userData.portfolioAuditSolid=true;
    object('portfolio-sky-mall-paving',track(new THREE.BoxGeometry(43.2,.13,5.45)),finishes.paving,0,26.065,55.49);
    for (const x of [-20.2,20.2]) {
      object('portfolio-sky-mall-gallery-walk',track(new THREE.BoxGeometry(2.75,.13,20.49)),
        finishes.paving,x,26.065,42.52);
      box('paint',0x9f9b90,x-Math.sign(x)*1.32,26.143,42.52,.09,.024,20.24);
    }
    for (let z=41.35;z<52.5;z+=1.19) {
      box('paint',0xa8b1a8,0,26.014,z,3.2,.016,.43);
    }

    function label(id,x,y,z,width,height,title,caption,ink,heading=Math.PI) {
      const owned=new THREE.Group();
      owned.name='portfolio-sky-mall-sign-'+id;
      owned.position.set(x,y,z);
      owned.rotation.y=heading;
      const frame=new THREE.Mesh(track(new THREE.BoxGeometry(width+.16,height+.16,.14)),finishes.steel);
      owned.add(frame);
      let faceMaterial=finishes.emission;
      if (typeof document !== 'undefined') {
        const canvas=document.createElement('canvas');
        canvas.width=768; canvas.height=192;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#111b23';
        ctx.fillRect(0,0,768,192);
        for (let y=0;y<192;y+=4) {
          ctx.fillStyle='#31444c3d';
          ctx.fillRect(0,y,768,1);
        }
        ctx.strokeStyle=ink;
        ctx.lineWidth=3;
        ctx.strokeRect(13,12,742,168);
        ctx.textAlign='center';
        ctx.fillStyle=ink;
        const lines=title.split('\n');
        ctx.font=lines.length===1 ? '800 76px system-ui, sans-serif' : '800 61px system-ui, sans-serif';
        for (const [index,line] of lines.entries()) {
          ctx.fillText(line,384,lines.length===1 ? 101 : 66+index*58,685);
        }
        ctx.font='700 28px monospace';
        ctx.fillStyle='#e5edec';
        ctx.fillText(caption,384,lines.length===1 ? 149 : 161,685);
        const map=new THREE.CanvasTexture(canvas);
        map.encoding=THREE.sRGBEncoding;
        textures.add(map);
        faceMaterial=material('MeshBasicMaterial',{map,toneMapped:false});
      }
      const screen=new THREE.Mesh(track(new THREE.PlaneGeometry(width,height)),faceMaterial);
      screen.name='portfolio-sky-mall-label-'+id;
      screen.userData.portfolioAdFace=true;
      screen.userData.portfolioAdId='sky-mall-'+id;
      screen.position.z=.077;
      owned.add(screen);
      group.add(owned);
    }

    // Peripheral wind baffles and the shutters under the occupied upper deck.
    for (const {x,z,width,depth} of rails) {
      box('cement',concreteGray,x,26.17,z,width,.34,depth);
      box('steel',steel,x,26.83,z,width,.10,depth);
      box('steel',steel,x,27.34,z,width+.04,.11,depth+.04);
      const horizontal=width>depth;
      const span=Math.max(width,depth), count=Math.ceil(span/2.4);
      for (let i=0;i<=count;i++) {
        const along=(i/count-.5)*(span-.18);
        box('steel',0x2c363e,x+(horizontal?along:0),26.84,z+(horizontal?0:along),.125,1.09,.125);
      }
    }
    for (const x of [-21.4,21.4]) {
      box('steel',0x354958,x,23.95,48,.72,1.45,33.6);
      box('emission',cyan,x,24.07,48.3,.77,.085,31.8);
      for (const z of [34.5,42.8,51.1,59.4]) {
        box('cement',0x6d777a,x,23.85,z,1.42,1.88,2.2);
        box('steel',0x47535c,x,22.66,z,2.12,.64,2.8);
      }
    }
    for (const z of [33.5,39.4,45.3,51.2,57.1,63]) {
      box('cement',0x535e69,0,24.56,z,41.9,.84,.88);
      for (const x of [-16,-8,0,8,16]) {
        box('steel',0x243241,x,24.18,z,1.16,.18,1.11);
      }
    }
    for (const x of [-15.5,15.5]) {
      box('cement',0x4d5f66,x,23.72,48,3.3,1.84,4.4);
      box('steel',0x334958,x,23.55,47.8,2.4,1.08,7.2);
      box('emission',amber,x,23.08,47.8,2.05,.07,5.7);
    }

    // Paint traces the turning radius from each bridge to the cross deck.
    for (const x of [-14,14]) {
      for (let z=32.75;z<39;z+=2.8) box('paint',0xc5a67e,x,26.016,z,.11,.025,1.18);
      const side=Math.sign(x);
      for (const angle of [.19,.54,.91,1.29]) {
        const [turnX,turnZ]=turn(side,angle);
        box('paint',0xc5a67e,turnX,26.016,turnZ,.11,.025,1.3,-side*angle);
      }
    }
    for (const x of [-4,4]) box('paint',0xc5a67e,x,26.016,46.5,1.7,.025,.11);
    for (const x of [-17.5,-10.5,10.5,17.5]) {
      box('emission',0xf3a96e,x,26.018,31.56,.50,.028,.07);
    }

    // The island carries the former lift signal and a small upper-deck garden.
    octagon('cement',0x68757b,0,26.25,35.7,14.2,.50,8.72,Math.PI/8);
    octagon('steel',0x415258,0,26.54,35.7,13.85,.115,8.46,Math.PI/8);
    octagon('cement',0x596867,0,26.63,36.9,5.1,.25,4.04,Math.PI/8);
    for (const x of [-1.7,1.7]) {
      box('steel',0x657379,x,28.91,36.9,.47,4.46,.72,0,x*.15);
      box('emission',cyan,x,29.30,36.48,.065,3.55,.035,0,x*.15);
    }
    box('steel',0x3f4c57,0,30.78,36.9,3.45,.35,1.08);
    box('emission',amber,0,30.77,36.32,2.24,.125,.07);
    box('cement',0x646e72,0,27.43,32.44,15.35,.43,1.75);
    box('steel',0x3d4854,0,28.44,32.48,14.07,1.11,.29);
    label('arrival',0,28.45,32.18,13.84,1.33,'AERIE ARCADE','SKYWAY / UPPER DECK 02','#95f5e4');
    for (const x of [-4.9,4.9]) {
      octagon('cement',0x596d6c,x,26.79,37.54,1.67,.42,1.64);
      for (const dx of [-.34,0,.36]) {
        octagon('steel',0x426057,x+dx,27.07+dx*.32,37.56,.46,.68,.35,dx*2.4);
      }
    }

    // A shallow retail arcade sits behind the driving court.
    box('cement',0x596972,arcade.x,28.77,arcade.z,arcade.width,5.28,arcade.depth);
    box('cement',0x708188,0,32.28,61.05,36.45,.53,6.38);
    box('steel',0x3c505d,0,31.01,57.91,36.4,.36,1.59);
    box('emission',cyan,0,30.93,57.10,35.0,.056,.08);
    box('emission',0xa5c5ba,0,31.98,57.82,33.8,.075,.08);
    box('cement',0x7a8b8e,0,33.34,61.21,23.3,1.64,4.45);
    box('steel',0x42586c,0,34.34,61.4,23.6,.39,4.3);
    box('emission',0x92ecca,0,34.28,59.22,22.6,.045,.085);
    label('rooftop',0,33.52,58.72,16.28,1.68,'AERIE ARCADE','STORIES / ART / BOOKS','#98f9e3');
    for (const x of [-15.5,15.5]) {
      box('cement',0x6b797d,x,33.1,62.23,3.82,1.24,3.4);
      for (const dx of [-1.18,0,1.18]) {
        octagon('steel',0x4a5661,x+dx,34,62.23,.94,.56,.94);
        octagon('steel',0x323d49,x+dx,34.31,62.23,1.05,.08,1.05);
      }
    }
    for (const store of stores) {
      const {id,x,title,description,ink,color,base}=store;
      box('steel',base,x,27.88,57.83,11.28,3.32,.40);
      box('window',0x37454f,x+.75,27.99,57.60,7.95,2.23,.08);
      box('window',0x242b32,x-4.15,27.67,57.55,2.03,3.05,.15);
      box('emission',color,x-4.43,27.71,57.44,.11,.47,.03);
      box('emission',color,x+.83,28.89,57.54,7.75,.07,.035);
      for (const dx of [-2.01,.73,3.38]) {
        box('steel',steel,x+dx,27.96,57.52,.10,2.22,.12);
      }
      for (const dx of [-2.45,-.65,1.55,3.23]) {
        box('emission',color,x+dx,27.18,57.54,.53,.12,.024);
      }
      box('cement',base,x,26.225,57.43,11.63,.18,1.1);
      label(id,x,30.06,57.58,10.34,1.22,title,description,ink);
    }

    // The reading lounge has two bookshelves and a lamp-lit window seat.
    const lounge=stores[0].x;
    box('emission',0x554339,lounge+.74,27.99,57.548,7.84,2.15,.016);
    box('steel',0x4a3631,lounge-.6,27.96,57.49,5.08,2.05,.08);
    const spines=[0xad765a,0x627e78,0xcfad85,0x994b42,0x80766b,0x956c9a,0xb4b891];
    for (const [shelfIndex,y] of [27.17,28.01].entries()) {
      box('steel',0x816042,lounge-.58,y,57.39,5.02,.085,.12);
      for (let i=0;i<14;i++) {
        const x=lounge-2.83+i*.324+(i>=6 ? .20 : 0);
        const height=.31+((i*3+shelfIndex*2)%5)*.064;
        box('emission',spines[(i+shelfIndex*2)%spines.length],x,y+.052+height/2,57.391,
          i%4===0 ? .16 : .22,height,.055,0,i===7 ? .15 : 0);
      }
    }
    box('steel',0x8e6348,lounge+2.84,27.28,57.36,2.32,.39,.19);
    box('emission',0xb88967,lounge+2.72,27.52,57.3,1.96,.12,.16);
    box('steel',0x5e5440,lounge+3.38,28.06,57.46,.095,.96,.088);
    box('emission',amber,lounge+3.38,28.53,57.41,.62,.24,.11);
    box('steel',0x865649,lounge+.77,29.30,57.11,7.86,.16,.78);
    for (const x of [-2.75,.4,3.55]) {
      box('emission',0xff9c67,lounge+x,29.205,56.83,.77,.038,.20);
    }

    // An illuminated marquee and three film posters identify the story cinema.
    box('steel',0x395861,0,29.25,56.69,10.5,.25,1.5);
    box('emission',0x76d9d2,0,29.21,55.91,10.42,.078,.065);
    for (let i=0;i<12;i++) box('emission',0xf8c389,(i-5.5)*.84,29.102,56.24,.18,.048,.18);
    box('emission',0x263a42,.74,27.99,57.548,7.84,2.15,.016);
    for (const [x,tone] of [[-1.25,0xe58378],[.73,0x7dbeb8],[2.69,0xb2a0d1]]) {
      box('steel',0x161e2e,x,28.02,57.49,1.31,1.65,.087);
      box('emission',tone,x,28.15,57.435,1.17,1.24,.022);
      box('emission',0xe8e4d8,x,27.33,57.435,.91,.081,.018);
    }
    for (const [x,y,roll] of [[-1.49,28.28,.68],[-1.08,28.30,-.7],[-1.29,27.92,0]]) {
      box('steel',0x563649,x,y,57.413,.13,.55,.022,0,roll);
    }
    for (const [x,y,w,h] of [[.37,28.04,.28,.52],[.76,28.19,.29,.78],[1.01,28.08,.19,.65]]) {
      box('steel',0x355967,x,y,57.413,w,h,.023);
    }
    box('steel',0x59426e,2.69,28.17,57.412,.56,.56,.023,0,Math.PI/4);
    box('emission',0xe7cfe9,2.69,28.17,57.394,.28,.28,.016,0,Math.PI/4);

    // The render workshop's big preview monitor sits between two workstations.
    const workshop=stores[2].x;
    box('emission',0x393448,workshop+.74,27.99,57.548,7.84,2.15,.016);
    box('steel',0x565371,workshop+.72,28.03,57.40,2.72,1.64,.20);
    box('emission',0x233e4b,workshop+.60,28.05,57.289,2.28,1.32,.020);
    const preview=['  xxxx  ',' xxxxxx ',' xxoxox ',' xxxxxx ','  xxxx  ',' xxxxxx ',' xx  xx '];
    for (const [row,line] of preview.entries()) for (const [column,pixel] of [...line].entries()) {
      if (pixel===' ') continue;
      box('emission',pixel==='x' ? 0x96e9d9 : 0x34487a,workshop+.6+(column-3.5)*.16,
        28.56-row*.155,57.274,.149,.146,.013);
    }
    for (const [x,tone] of [[-1.77,0x9b8eaf],[3.28,0x789eb0]]) {
      box('steel',0x615a70,workshop+x,27.92,57.48,1.17,.83,.17);
      box('emission',tone,workshop+x,27.97,57.38,.91,.58,.023);
      for (const y of [27.82,27.96,28.1]) box('emission',0x4c526a,workshop+x-.08,y,57.364,.59,.027,.012);
      box('steel',0x686477,workshop+x,27.35,57.40,1.59,.13,.33);
    }
    for (const x of [-18.3,-6.1,6.1,18.3]) {
      box('cement',concreteGray,x,28.34,57.18,.49,4.56,.53);
      box('steel',0x38474d,x,26.44,57.16,.68,.48,.72);
      box('emission',amber,x,30.45,56.90,.28,.074,.04);
    }
    for (const x of [-17.4,-5.8,5.8,17.4]) {
      box('steel',0x3d4e58,x,26.40,53.69,2.08,.54,.51);
      box('steel',0x886851,x,26.69,53.69,2.18,.09,.62);
    }

    for (const [key,{shape,finish,parts}] of batches) {
      const mesh=new THREE.InstancedMesh(shapes[shape],finishes[finish],parts.length);
      mesh.name='portfolio-sky-mall-'+key;
      for (let i=0;i<parts.length;i++) {
        mesh.setMatrixAt(i,parts[i].matrix);
        mesh.setColorAt(i,new THREE.Color(parts[i].color).convertSRGBToLinear());
      }
      mesh.receiveShadow=finish!=='emission';
      group.add(mesh);
    }
    world.add(group);
    return {
      dispose() {
        world.remove(group);
        geometries.forEach(geometry=>geometry.dispose());
        materials.forEach(finish=>finish.dispose());
        textures.forEach(map=>map.dispose());
      }
    };
  }

  return {attach,colliders,deck,destination,drivePath};
});
