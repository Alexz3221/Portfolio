(function(root, factory) {
  const signText = typeof module === 'object' && module.exports
    ? require('./portfolio-sign-text') : root.DrivePortfolioSignText;
  const storefronts = factory(signText);
  if (typeof module === 'object' && module.exports) module.exports = storefronts;
  else root.DrivePortfolioStorefronts = storefronts;
})(globalThis, function(signText) {
  'use strict';

  const east = Math.PI / 2, west = -east, north = Math.PI;
  const fasciaFace = [3.8,.398], bladeFace = [.81,.43], noticeFace = [.72,.43];
  const shopTypes = {
    food:     {frame:0x754840,panel:0xff9562,interior:'#c98865'},
    store:    {frame:0x304d4d,panel:0x71ffdb,interior:'#7ca8a6'},
    pharmacy: {frame:0x40395c,panel:0xcdaaff,interior:'#b5acf2'},
    workshop: {frame:0x424959,panel:0xffbd75,interior:'#747782'},
    media:    {frame:0x644759,panel:0xff80b0,interior:'#956385'}
  };
  // The origin of each frontage sits flush with its existing building wall.
  const shops = [
    [-8.89,-106.0,east,5.45,'NIGHT SHIFT','COFFEE / NOODLES','food'],
    [8.40,-106.4,west,5.05,'AFTER HOURS','CORNER STORE','store'],
    [-8.89,-93.8,east,4.85,'KEY CUT','LOCKS / ACCESS','workshop'],
    [8.40,-93.7,west,4.70,'TIDE RX','PHARMACY','pharmacy'],
    [-9.89,-78.0,east,5.30,'NEON WASH','LAUNDRY / 24H','store'],
    [13.53,-76.4,west,6.30,'MORROW SERVICE','METERS / MAINTENANCE','workshop'],
    [-11.40,-55.0,east,5.75,'SPOOL','RECORDS / TAPES','media'],
    [10.89,-50.2,west,5.50,'PUBLIC TERMINAL','ACCESS CARDS','store'],
    [-46.7,-31.88,0,6.10,'THIRD RAIL','SPARES & REPAIR','workshop'],
    [-80.1,-34.89,0,6.25,'MOON CANTEEN','STEAMED BUNS / TEA','food'],
    [-69.6,-34.89,0,5.35,'ALLEY 9','MARKET GOODS','store'],
    [-73.65,-6.11,north,6.55,'MIDNIGHT BOWL','NOODLES / 24H','food'],
    [-63.67,-6.11,north,5.70,'AFTERIMAGE','USED DISPLAYS','media'],
    [-34,28.89,north,6.35,'CORNER PRESS','INDEPENDENT PRINT','media'],
    [39,19.88,north,6.20,'LUMA SUPPLY','BATTERIES / FILTERS','store'],
    [33.78,28.0,west,5.60,'LITTLE HOURS','ESPRESSO & TEA','food'],
    [-40.2,93.37,north,6.10,'CHANNEL 9','STUDIOS / WORKSHOPS','media']
  ];
  const fixtures = [
    // Configuration is x, z, and outward wall heading.
    [-8.89,-115.5,east], [8.40,-98.8,west], [-9.89,-74.2,east], [13.53,-82.9,west],
    [-11.40,-59.4,east], [10.89,-45.0,west], [-74.8,-34.89,0], [-61,-6.11,north],
    [-56.7,-6.11,north], [-38.9,28.89,north], [34.9,19.88,north], [125.5,-50.4,west],
    [125.5,-69.7,west], [96.10,-89,east]
  ];
  const waste = [
    [-8.14,-110.0,east], [7.62,-109.0,west], [-8.16,-101.7,east], [7.65,-91.0,west],
    [-8.28,-72.2,east], [9.65,-61.8,west], [-10.4,-48.0,east], [10.3,-43.2,west],
    [-63.8,-32.1,0], [-80.3,-11.0,north], [-83.5,-10.4,north], [-70.1,-10.85,north],
    [-64.8,-11.0,north], [-53.5,-26.4,0], [-35.3,27.2,north],
    [24.5,23.6,west], [25.2,33.7,west],
    [98.8,-83.3,0], [-119.04,34.7,east], [-45.1,91.7,north]
  ];
  const vendorTables = [
    [-77.7,-8.87,north,0x9c625b], [-59.0,-7.75,north,0x50837d], [-85.1,-33.5,0,0x876678]
  ];

  function makeAtlas(THREE) {
    if (typeof document === 'undefined' || !signText) return null;
    const size = 1024, tileWidth = 256, tileHeight = 128, gutter = 4, uvInset = 1;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#111620';
    ctx.fillRect(0,0,size,size);

    function tile(index, paint, {top=0,width=tileWidth-gutter*2,height=tileHeight-gutter*2}={}) {
      const x = (index % 4) * tileWidth + gutter;
      const y = Math.floor(index / 4) * tileHeight + gutter + top;
      ctx.save();
      ctx.translate(x,y);
      ctx.beginPath();
      ctx.rect(0,0,width,height);
      ctx.clip();
      paint(width,height);
      ctx.restore();
      return [(x+uvInset)/size, 1-(y+height-uvInset)/size,
        (x+width-uvInset)/size, 1-(y+uvInset)/size];
    }

    function textTile([faceWidth,faceHeight],paint) {
      return (w,h) => {
        // The whole tile includes the texels trimmed by the quad's UVs.
        const face = signText.canvas(faceWidth*w/(w-2*uvInset),faceHeight*h/(h-2*uvInset),w,h);
        paint(face.ctx,w,h);
        ctx.drawImage(face.canvas,0,0,w,h);
      };
    }

    function signPainter(name, subtitle, color, large) {
      return textTile(large ? bladeFace : fasciaFace,(ctx,w,h) => {
        ctx.fillStyle = '#151922';
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = color;
        ctx.fillRect(5,6,2,h-12);
        ctx.fillRect(w-7,6,2,h-12);
        ctx.font = `900 ${large ? 27 : 20}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        signText.text(ctx,name,w/2,h*.34,w-29);
        ctx.fillStyle = '#edebe0';
        ctx.font = `600 ${large ? 11 : 10}px monospace`;
        signText.text(ctx,subtitle,w/2,h*.75,w-34);
        ctx.globalAlpha = .15;
        ctx.fillStyle = '#0b1118';
        for (let y=2; y<h; y+=4) ctx.fillRect(0,y,w,1);
      });
    }
    const signs = shops.map(([, , , ,name,subtitle,type],index) => {
      const color = '#' + shopTypes[type].panel.toString(16);
      return {
        fascia:tile(index,signPainter(name,subtitle,color,false),{height:38}),
        blade:tile(index,signPainter(name,subtitle,color,true),{top:50,width:124,height:63})
      };
    });
    const rooms = Object.fromEntries(Object.entries(shopTypes).map(([type,style],index) =>
      [type,tile(shops.length+index,(w,h) => {
        const lamp = ctx.createLinearGradient(0,0,0,h);
        lamp.addColorStop(0,style.interior);
        lamp.addColorStop(.92,'#242631');
        ctx.fillStyle = lamp;
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = '#dad5be';
        ctx.fillRect(22,8,w-44,4);
        ctx.fillStyle = '#45434a';
        ctx.fillRect(0,22,w,3);

        if (type === 'food') {
          ctx.fillStyle = '#d3a478';
          ctx.fillRect(25,30,w-50,25);
          ctx.fillStyle = '#433842';
          ctx.fillRect(2,73,w-4,45);
          ctx.fillStyle = '#f2b981';
          ctx.fillRect(2,69,w-4,5);
          for (let x=42;x<w-38;x+=41) {
            ctx.fillStyle = '#5b4243';
            ctx.fillRect(x,35,23,3);
            ctx.fillRect(x,42,19,2);
            ctx.fillStyle = '#e4d0ac';
            ctx.fillRect(x-9,63,13,5);
          }
        } else {
          const packaging = ['#a9807c','#b4b595','#7e9d9f','#a5a2b6','#c5c1ad'];
          for (let row=0;row<3;row++) {
            const shelf = 45+row*29;
            ctx.fillStyle = '#4d4b53';
            ctx.fillRect(14,shelf,w-28,4);
            for (let col=0;col<11;col++) {
              const x=21+col*19+(row%2)*4, ht=9+(col*11+row*3+index)%10;
              ctx.fillStyle = packaging[(col+row*2+index)%packaging.length];
              ctx.fillRect(x,shelf-ht,type==='workshop' ? 15 : 12,ht);
              ctx.fillStyle = '#e0ccbd';
              ctx.fillRect(x+2,shelf-ht+3,5,2);
            }
          }
        }
      })]));
    const notices = tile(shops.length+Object.keys(shopTypes).length,textTile(noticeFace,(ctx,w,h) => {
      ctx.fillStyle = '#865967';
      ctx.fillRect(3,0,75,h);
      ctx.fillStyle = '#628481';
      ctx.fillRect(86,4,76,h-4);
      ctx.fillStyle = '#b68456';
      ctx.fillRect(171,0,w-171,h-3);
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.fillStyle = '#ddd3b4';
      signText.text(ctx,'LATE',12,23,62);
      signText.text(ctx,'SHIFT',12,43,62);
      signText.text(ctx,'LOST',94,23,62);
      signText.text(ctx,'CAT',94,43,62);
      signText.text(ctx,'NIGHT',177,24,62);
      signText.text(ctx,'BUS',177,43,62);
      ctx.fillStyle = '#dfd8be';
      for (const x of [12,94,177]) for (let y=58;y<103;y+=8) ctx.fillRect(x,y,52-(y%7)*2,2);
    }));
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = 'Portfolio City storefront and notice atlas';
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 4;
    return {signs,rooms,notices,texture};
  }

  function attach(THREE, world) {
    const root = new THREE.Group();
    root.name = 'portfolio-storefronts';
    world.add(root);
    const atlas = makeAtlas(THREE);
    const materials = {
      solid:new THREE.MeshStandardMaterial({color:0xffffff,metalness:.23,roughness:.65}),
      glow:new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),
      debris:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.94})
    };
    const geometry = {
      box:new THREE.BoxGeometry(1,1,1),
      tube:new THREE.CylinderGeometry(.5,.5,1,8),
      sack:new THREE.IcosahedronGeometry(.5,1)
    };
    const batches = new Map();
    const text = {xyz:[],uv:[]};
    const line = new THREE.Vector3(), midpoint = new THREE.Vector3(), upward = new THREE.Vector3(0,1,0);
    const transform = new THREE.Object3D(), yawRotation = new THREE.Quaternion(), localRotation = new THREE.Quaternion();

    function frontage(x,z,yaw,landing=0) {
      const cosine = Math.cos(yaw), sine = Math.sin(yaw);
      const gx=x+landing*sine,gz=z+landing*cosine;
      const elevation=Math.max(
        globalThis.DrivePortfolioArrivalSidewalks?.surfaceHeight(gx,gz) ?? 0,
        globalThis.DrivePortfolioStreets?.surfaceHeight(world,gx,gz) ?? 0
      );
      yawRotation.setFromAxisAngle(upward,yaw);
      function batch(kind,material,lx,y,lz,w,h,d,color,rotation=0,tilt=0) {
        const key = kind+'-'+material;
        if (!batches.has(key)) batches.set(key, {kind,material,parts:[]});
        transform.position.set(x+lx*cosine+lz*sine,elevation+y,z-lx*sine+lz*cosine);
        transform.scale.set(w,h,d);
        transform.rotation.set(tilt,rotation,0);
        transform.quaternion.premultiply(yawRotation);
        transform.updateMatrix();
        batches.get(key).parts.push({matrix:transform.matrix.clone(),color});
      }
      function cube(lx,y,lz,w,h,d,color,rotation=0,tilt=0) {
        batch('box','solid',lx,y,lz,w,h,d,color,rotation,tilt);
      }
      function light(lx,y,lz,w,h,d,color) {
        batch('box','glow',lx,y,lz,w,h,d,color);
      }
      function sack(lx,y,lz,w,h,d,color,rotation) {
        batch('sack','debris',lx,y,lz,w,h,d,color,rotation);
      }
      function pipe(ax,ay,az,bx,by,bz,radius,color) {
        line.set((bx-ax)*cosine+(bz-az)*sine,by-ay,-(bx-ax)*sine+(bz-az)*cosine);
        const length = line.length();
        localRotation.setFromUnitVectors(upward,line.normalize());
        midpoint.set(x+(ax+bx)*.5*cosine+(az+bz)*.5*sine,elevation+(ay+by)*.5,z-(ax+bx)*.5*sine+(az+bz)*.5*cosine);
        transform.position.copy(midpoint);
        transform.quaternion.copy(localRotation);
        transform.scale.set(radius*2,length,radius*2);
        transform.updateMatrix();
        const key = 'tube-solid';
        if (!batches.has(key)) batches.set(key,{kind:'tube',material:'solid',parts:[]});
        batches.get(key).parts.push({matrix:transform.matrix.clone(),color});
      }
      function display(lx,y,lz,w,h,[u0,v0,u1,v1],perpendicular=0) {
        for (const [du,dv] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]) {
          const a = (du-.5)*w;
          const xx = lx+(perpendicular ? 0 : a), zz = lz-perpendicular*a;
          text.xyz.push(x+xx*cosine+zz*sine,elevation+y+(dv-.5)*h,z-xx*sine+zz*cosine);
          text.uv.push(du ? u1:u0,dv ? v1:v0);
        }
      }
      return {cube,light,sack,pipe,display};
    }

    for (const [index,[x,z,yaw,w, , ,type]] of shops.entries()) {
      const surface = frontage(x,z,yaw,.51);
      const {cube,light,display} = surface;
      const style = shopTypes[type];
      const left = index % 2 ? -1 : 1;
      const edge = w*.5;
      const doorX = left*(edge-.67), windowX = -.57*left, windowWidth = w-1.62;
      cube(0,1.32,.105,w,2.56,.21,style.frame);
      cube(0,.060,.49,w+.37,.099,.98,0x514e57);
      for (let joint=-edge+.32;joint<edge;joint+=1.16) cube(joint,.112,.50,.020,.006,.95,0x312f39);
      cube(0,.155,.30,w+.07,.12,.48,0x575359);
      cube(0,2.70,.31,w+.16,.48,.57,style.frame);
      cube(0,2.95,.30,w+.19,.11,.61,0x282a35);
      cube(0,2.70,.611,3.96,.445,.084,0x252832);
      cube(0,2.474,.638,3.93,.046,.095,style.frame);
      cube(0,2.928,.638,3.93,.046,.095,style.frame);
      cube(0,2.41,.36,w-.24,.08,.37,0x252730);
      light(-left*.12,2.37,.54,w*.78,.027,.041,style.panel);
      cube(doorX,1.15,.29,1.19,2.08,.24,0x202631);
      cube(doorX,1.46,.416,.84,1.14,.026,0x41505c);
      cube(doorX+left*.38,.99,.47,.065,.25,.08,0xaca49b);
      light(doorX-left*.38,1.96,.44,.13,.045,.05,style.panel);
      cube(windowX,1.39,.29,windowWidth,1.54,.24,0x222831);
      cube(windowX,1.35,.418,windowWidth-.15,1.40,.018,0x634d55);
      cube(windowX,1.00,.48,windowWidth-.12,.052,.049,0x272733);
      cube(windowX,1.43,.48,.053,1.46,.051,0x272733);
      cube(windowX,.60,.47,windowWidth+.08,.14,.36,style.frame);
      for (const xx of [-edge,edge]) cube(xx,1.31,.28,.114,2.44,.37,style.frame);
      if (type==='food') {
        cube(windowX,2.31,.60,windowWidth+.20,.12,.76,style.frame,0,.11);
        for (let stripe=0;stripe<5;stripe++) {
          const xx = windowX+windowWidth*(stripe/5-.40);
          cube(xx,2.25,.96,windowWidth*.12,.085,.042,0xbd7b69);
        }
        light(windowX,2.24,.75,windowWidth-.40,.026,.075,0xffad77);
      } else if (type==='workshop') {
        cube(windowX,1.84,.471,windowWidth-.16,.49,.05,0x4a4b53);
        for (let yy=1.69;yy<2.04;yy+=.11)
          cube(windowX,yy,.505,windowWidth-.23,.028,.058,0x323640);
      } else if (type==='store' || type==='pharmacy') {
        cube(doorX,2.22,.59,.78,.24,.42,style.frame);
        light(doorX,2.185,.67,.55,.028,.23,style.panel);
      }
      if (atlas) {
        display(0,2.70,.655,...fasciaFace,atlas.signs[index].fascia);
        display(windowX,1.36,.431,windowWidth-.20,1.36,atlas.rooms[type]);
        if (index % 3 === 0 || type==='media') {
          for (const y of [1.98,2.51]) cube(edge-.05,y,.37,.092,.062,.72,0x343844);
          cube(edge-.05,2.22,.86,.18,.57,.92,style.frame);
          display(edge+.043,2.22,.86,...bladeFace,atlas.signs[index].blade,1);
          display(edge-.143,2.22,.86,...bladeFace,atlas.signs[index].blade,-1);
          light(edge-.06,1.925,.83,.151,.038,.72,style.panel);
        }
      }
    }

    for (const [index,[x,z,yaw]] of fixtures.entries()) {
      const {cube,pipe,display,light} = frontage(x,z,yaw,.36);
      const rust = index%2 ? 0x78615a : 0x5e6770;
      // Both pipe runs return into wall glands. The exposed clamps extend
      // back into the stone, including at facades with a shallow setback.
      pipe(-.48,.17,.29,-.48,3.20,.29,.082,rust);
      pipe(-.48,3.20,.29,.59,3.20,.29,.083,rust);
      pipe(.59,3.20,.29,.59,3.78,.29,.083,rust);
      for (const [u,y] of [[-.48,.17],[.59,3.78]]) {
        pipe(u,y,.31,u,y,-.19,.081,rust);
        cube(u,y,-.075,.25,.27,.24,0x4a4b50);
        pipe(u,y,.24,u,y,.38,.093,0x45474c);
      }
      for (const y of [.62,1.31,2.21,3.19]) {
        cube(-.48,y,.29,.241,.083,.24,0x363840);
        cube(-.48,y,.073,.12,.102,.53,0x42464b);
      }
      cube(.23,2.04,.014,1.16,.75,.44,0x454a4c);
      cube(.23,2.04,.27,1.08,.67,.45,0x606161);
      cube(.23,2.04,.507,.95,.53,.027,0x2f343d);
      for (let y=1.82;y<2.29;y+=.092) cube(.23,y,.540,.88,.036,.052,0x70716f);
      cube(.68,1.36,.19,.31,.40,.28,0x4d4f58);
      light(.71,1.43,.342,.047,.04,.02,index%3 ? 0x91d7b3 : 0xffae71);
      if (atlas && index%2===0) display(-.93,1.44,.119,...noticeFace,atlas.notices);
    }

    for (const [x,z,yaw,color] of vendorTables) {
      const {cube,light} = frontage(x,z,yaw);
      cube(0,.96,0,2.32,.16,.96,0x70626b);
      cube(0,.65,.40,2.17,.54,.15,color);
      for (const offset of [-1.01,1.01]) {
        cube(offset,1.09,-.36,.094,2.04,.12,0x59545b);
        cube(offset,.50,.36,.10,.80,.10,0x59545b);
      }
      cube(0,2.12,.04,2.42,.11,1.24,color,0,.09);
      light(0,2.046,.52,2.13,.03,.067,0xffbb85);
      for (let pack=0;pack<4;pack++) {
        const along = pack*.49-.75;
        cube(along,1.105,-.07,.43,.14,.54,0x59565a,0,.09);
        for (let row=0;row<3;row++) cube(along,1.18,row*.13-.24,.37,.05,.076,
          [0xb88d70,0xa89662,0x789876,0xa86556][pack],0,.09);
      }
      cube(-.63,.255,-.23,.48,.42,.51,0x777061,0);
      cube(.28,.20,-.23,.67,.30,.55,0x524b50,0);
    }

    for (const [index,[x,z,yaw]] of waste.entries()) {
      const {cube,sack,pipe} = frontage(x,z,yaw);
      const size = .34+(index%3)*.05;
      for (const [offset,db,scale,angle] of [[-.23,.08,1,.5],[.16,-.19,.82,-.7],[.39,.26,.62,.3]]) {
        sack(offset,size*scale*.48,db,size*1.3*scale,size*scale,size*1.12*scale,index%2 ? 0x353738 : 0x262d34,angle);
        sack(offset,size*scale*.98,db-.018,.10*scale,.09*scale,.07*scale,0x4e4a49,angle);
      }
      if (index % 3 === 0) {
        cube(-.78,.31,-.12,.61,.60,.55,0x4b5557,.06);
        cube(-.78,.64,-.11,.67,.09,.62,0x575b57,.06);
        cube(-.78,.39,.17,.18,.050,.029,0xa2a294,.06);
      } else {
        cube(-.66,.18,-.16,.47,.34,.42,0x8a725c,.25);
        cube(-.66,.352,-.16,.035,.012,.40,0xb9a287,.25);
      }
      cube(.32,.009,.53,.22,.007,.14,0x9b8c73,index*.47);
      cube(-.35,.014,.43,.17,.014,.09,0x526467,-index*.65);
      pipe(.51,.038,.35,.60,.043,.35,.041,index%2 ? 0x805a55 : 0x5b696e);
    }

    for (const [key,{kind,material,parts}] of batches) {
      const mesh = new THREE.InstancedMesh(geometry[kind],materials[material],parts.length);
      mesh.name = 'portfolio-storefront-'+key;
      for (const [i,{matrix,color}] of parts.entries()) {
        mesh.setMatrixAt(i,matrix);
        mesh.setColorAt(i,new THREE.Color(color).convertSRGBToLinear());
      }
      root.add(mesh);
    }
    if (atlas) {
      const displays = new THREE.BufferGeometry();
      displays.setAttribute('position',new THREE.Float32BufferAttribute(text.xyz,3));
      displays.setAttribute('uv',new THREE.Float32BufferAttribute(text.uv,2));
      const panels = new THREE.Mesh(displays,new THREE.MeshBasicMaterial({map:atlas.texture,toneMapped:false}));
      panels.name = 'portfolio-storefront-signs-and-windows';
      root.add(panels);
    }
    return root;
  }

  return {attach};
});
