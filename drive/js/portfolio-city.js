(function(root, factory) {
  const city = factory();
  if (typeof module === 'object' && module.exports) module.exports = city;
  else root.DrivePortfolioCity = city;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const edge = 211, roadHalfWidth = 11;
  const spawn = {x:0, z:-64, heading:0};
  const routeSamples = [{x:spawn.x, y:0, z:spawn.z, tx:0, tz:1}];
  const north = Math.PI;
  const west = -Math.PI / 2;
  const east = Math.PI / 2;
  const stops = [
    {id:'about', title:'About', x:0, z:-29, heading:0, color:'#fa7ca8'},
    {id:'projects', title:'Projects', x:0, z:51, heading:0, color:'#75f9ee'},
    {id:'experience', title:'Experience', x:112, z:25, heading:0, color:'#ffc082'},
    {id:'education', title:'Education', x:-108, z:34, heading:0, color:'#be9eff'},
    {id:'skills', title:'Skills', x:-54, z:107, heading:west, color:'#b8f19f'},
    {id:'contact', title:'Contact', x:63, z:-108, heading:east, color:'#ff7dc4'}
  ];

  function road(x1, z1, x2, z2, width, roadClass = 'street') {
    return {x1, z1, x2, z2, width, roadClass, length:Math.hypot(x2-x1, z2-z1)};
  }

  // The center plaza joins a clear perimeter route, with different bays on each side.
  const networkRoads = [
    road(0,-174,0,167,24,'main'), road(-175,0,175,0,24,'main'),
    road(-108,-108,-108,107,22), road(112,-108,112,107,22),
    road(-108,-108,112,-108,22), road(-108,107,112,107,22),
    road(-108,107,-158,157,20), road(-158,157,0,157,20),
    road(112,107,153,156,20), road(153,156,175,156,20),
    road(-108,-108,-152,-152,20), road(-152,-152,-152,-176,20),
    road(112,-108,154,-150,20), road(154,-150,173,-150,20),
    road(112,-54,68,-54,20), road(-108,-52,-146,-52,17),
    road(-63,107,-63,154,17), road(59,107,59,145,17)
  ];
  const plaza = {x:0,z:14,w:78,d:92};
  const playBay = {x:78,z:-53,w:40,d:38};
  const playProps = [
    {x:80,z:-49}, {x:86,z:-49}, {x:92,z:-49}, {x:83,z:-44},
    {x:89,z:-44}, {x:81,z:-63}, {x:88,z:-63}, {x:93,z:-65}
  ];

  function distanceToCenter(x,z,street) {
    const dx = street.x2-street.x1, dz = street.z2-street.z1;
    const t = Math.max(0, Math.min(1, ((x-street.x1)*dx + (z-street.z1)*dz)/(street.length*street.length)));
    return Math.hypot(x-street.x1-dx*t,z-street.z1-dz*t);
  }

  function distanceToRoad(x,z) {
    for (const area of [plaza,playBay]) {
      if (Math.abs(x-area.x) <= area.w/2 && Math.abs(z-area.z) <= area.d/2) return 0;
    }
    let nearest = Infinity;
    for (const street of networkRoads)
      nearest = Math.min(nearest,distanceToCenter(x,z,street) + roadHalfWidth - street.width/2);
    return Math.max(0,nearest);
  }

  function randomFrom(seed) {
    return () => {
      seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
      return seed/4294967296;
    };
  }

  // Footprints double as Cannon collision boxes. Upper levels sit on a shared podium.
  const buildings = [];
  function block(x,z,width,depth,height,style,baseY = 0) {
    buildings.push({x,z,width,depth,height,style,baseY});
  }
  function tower(x,z,width,depth,height,style,shape) {
    if (shape === 'podium') {
      block(x,z,width,depth,7,style);
      block(x,z,width*.68,depth*.72,height-7,style,7);
    } else if (shape === 'steps') {
      const first = Math.round(height*.37), second = Math.round(height*.31);
      block(x,z,width,depth,first,style);
      block(x-width*.09,z,width*.78,depth*.69,second,style,first);
      block(x-width*.16,z,width*.5,depth*.5,height-first-second,style,first+second);
    } else if (shape === 'twins') {
      block(x,z,width,depth,8,style);
      block(x-width*.26,z,width*.4,depth*.8,height-8,style,8);
      block(x+width*.26,z+depth*.09,width*.4,depth*.67,height*.76-8,style,8);
    } else block(x,z,width,depth,height,style);
  }

  // Each quadrant reads differently from behind the car. Tall shapes sit behind the lit storefronts.
  const frontages = [
    [-32,-58,24,35,20,1,'steps'], [30,-58,20,35,16,2,'podium'],
    [-52,-36,22,30,16,1,'podium'], [96,-21,18,12,29,0,'steps'],
    [-50,29,19,29,26,3,'steps'], [49,27,16,24,25,0,'podium'],
    [-54,64,30,28,41,4,'twins'], [54,63,29,26,44,2,'steps'],
    [-30,85,24,18,49,3,'steps'], [31,83,26,18,37,0,'twins'],
    [-130,43,19,39,22,3,'podium'], [136,27,23,39,26,2,'twins'],
    [-52,86,17,13,23,4,'podium'], [64,-130,29,20,29,1,'steps'],
    [-20,78,13,21,43,1,'podium'], [19,76,12,20,39,0,'podium']
  ];
  for (const geometry of frontages) tower(...geometry);

  const rnd = randomFrom(0x23052d);
  function clearFootprint(x,z,w,d) {
    const nearStreet = networkRoads.some(street => distanceToCenter(x,z,street) < street.width/2 + Math.hypot(w,d)/2+3);
    const overlaps = buildings.some(b => Math.abs(x-b.x) < (w+b.width)/2+5 && Math.abs(z-b.z) < (d+b.depth)/2+5);
    const inPlaza = [plaza,playBay].some(area => Math.abs(x-area.x) < (w+area.w)/2+5 &&
      Math.abs(z-area.z) < (d+area.d)/2+5);
    return !nearStreet && !overlaps && !inPlaza;
  }
  for (const z of [-180,-144,-124,-79,-43,39,70,130,172,194]) for (const x of [-185,-153,-83,-48,-23,25,51,82,142,178]) {
    const w = 12+rnd()*16, d = 12+rnd()*19;
    const peripheral = Math.abs(x)>120 || Math.abs(z)>120;
    const h = (peripheral ? 23 : 34) + rnd()*(peripheral ? 67 : 39);
    const style = Math.floor(rnd()*5), shape = ['steps','podium','twins','slab'][Math.floor(rnd()*4)];
    if (clearFootprint(x,z,w,d)) tower(x,z,w,d,h,style,shape);
  }

  // Two columns of the project marquee carry a high deck. Cars pass below it on the boulevard.
  block(-17,55,4,7,13,0);
  block(17,55,4,7,13,0);
  block(0,57,38,7,5,0,13);

  const highwaySegments = [
    {x:72,z:-63,width:8,length:15,topStart:.14,topEnd:2.8},
    {x:72,z:-54,width:8,length:3,topStart:2.8,topEnd:2.8}
  ];
  for (const ramp of highwaySegments) {
    ramp.pitch = -Math.atan2(ramp.topEnd-ramp.topStart,ramp.length);
    ramp.slopeLength = Math.hypot(ramp.length,ramp.topEnd-ramp.topStart);
    ramp.centerY = (ramp.topStart+ramp.topEnd)/2 - .25*Math.cos(ramp.pitch);
  }

  const palettes = [
    {wall:0x35405f, light:0x77effe}, {wall:0x432945, light:0xff6796},
    {wall:0x43333e, light:0xffbd7c}, {wall:0x373055, light:0xb99bff},
    {wall:0x263e4d, light:0xb7eda3}
  ];

  function facadeTexture(THREE,style) {
    const side = 32, pixels = new Uint8Array(side*side*4), random = randomFrom(0x184b1a+style*911);
    const wall = new THREE.Color(palettes[style].wall).convertSRGBToLinear();
    const lamp = new THREE.Color(palettes[style].light);
    const cells = Array.from({length:64},()=>random());
    for (let y=0; y<side; y++) for (let x=0; x<side; x++) {
      const i = (y*side+x)*4;
      const cell = cells[Math.floor(y/4)*8+Math.floor(x/4)];
      const frame = y%4>=2 || x%4===0;
      const lit = !frame && cell > .79;
      const shade = frame ? .42 : lit ? .22+cell*.31 : .58+cell*.23;
      const color = lit ? lamp : wall;
      pixels.set([color.r*shade*255,color.g*shade*255,color.b*shade*255,255],i);
    }
    const texture = new THREE.DataTexture(pixels,side,side,THREE.RGBAFormat);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  function signTexture(THREE,head,caption,color,display = false) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return null;
    canvas.width = 768;
    canvas.height = display ? 306 : 190;
    const {width:w,height:h} = canvas;
    const accent = new THREE.Color(color).getStyle();
    const gradient = ctx.createLinearGradient(w*.1,0,w*.9,h);
    gradient.addColorStop(0,'#0a1725');
    gradient.addColorStop(.65,'#13162d');
    gradient.addColorStop(1,'#162e35');
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,w,h);
    ctx.globalAlpha = .13;
    ctx.fillStyle = accent;
    for (let y=5; y<h; y+=5) ctx.fillRect(0,y,w,1);
    for (let x=24; x<w; x+=31) ctx.fillRect(x,0,1,h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(6,6,w-12,h-12);
    if (display) {
      ctx.lineWidth = 3;
      ctx.strokeRect(w-226,42,183,h-85);
      ctx.globalAlpha = .2; ctx.fillStyle = accent;
      ctx.fillRect(w-222,46,175,h-93);
      const mx = x => w-135+x*.42, my = z => h/2+z*.42;
      ctx.lineCap = 'round';
      for (const street of networkRoads) {
        ctx.globalAlpha = street.roadClass === 'main' ? .8 : .45;
        ctx.lineWidth = street.roadClass === 'main' ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(mx(street.x1),my(street.z1)); ctx.lineTo(mx(street.x2),my(street.z2)); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const stop of stops) {
        ctx.fillStyle = stop.color;
        ctx.beginPath(); ctx.arc(mx(stop.x),my(stop.z),4.4,0,2*Math.PI); ctx.fill();
      }
    }
    const x = display ? 42 : 34;
    const limit = display ? w-270 : w-68;
    let size = display ? 83 : 55;
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${size}px ui-monospace, monospace`;
    while (size > 26 && ctx.measureText(head).width > limit) ctx.font = `800 ${--size}px ui-monospace, monospace`;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#effefa';
    ctx.fillText(head,x,display ? h*.42 : h*.43);
    ctx.shadowBlur = 0;
    ctx.fillStyle = accent;
    ctx.font = '700 25px ui-monospace, monospace';
    ctx.fillText(caption,x,h*.71,limit);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function build(THREE,world) {
    const box = new THREE.BoxGeometry(1,1,1), transform = new THREE.Object3D();
    const surfaceColor = hex => new THREE.Color(hex).convertSRGBToLinear();
    const materials = {
      foundation:new THREE.MeshStandardMaterial({color:surfaceColor(0x171424),roughness:.9}),
      asphalt:new THREE.MeshStandardMaterial({color:surfaceColor(0x161a2a),roughness:.7,metalness:.08}),
      concrete:new THREE.MeshStandardMaterial({color:surfaceColor(0x2c2d3b),roughness:.85}),
      metal:new THREE.MeshStandardMaterial({color:surfaceColor(0x343c56),roughness:.62,metalness:.35}),
      paint:new THREE.MeshBasicMaterial({color:surfaceColor(0x667a89),toneMapped:false}),
      light:new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false})
    };
    const batches = new Map();
    function instance(name,material,x,y,z,w,h,d,yaw=0,color=null,pitch=0) {
      if (!batches.has(name)) batches.set(name,{material,list:[]});
      batches.get(name).list.push({x,y,z,w,h,d,yaw,color,pitch});
    }
    function flush() {
      for (const [name,{material,list}] of batches) {
        const mesh = new THREE.InstancedMesh(box,material,list.length);
        mesh.name = name;
        for (const [i,b] of list.entries()) {
          transform.position.set(b.x,b.y,b.z);
          transform.scale.set(b.w,b.h,b.d);
          transform.rotation.set(b.pitch,b.yaw,0,'YXZ');
          transform.updateMatrix();
          mesh.setMatrixAt(i,transform.matrix);
          if (b.color !== null) mesh.setColorAt(i,new THREE.Color(b.color));
        }
        mesh.instanceMatrix.needsUpdate = true;
        world.add(mesh);
      }
    }

    // Road glow is projected into local pavement. No second full scene render is needed.
    const glows = [];
    function glow(x,z,w,length,color,strength=1,yaw=0) {
      glows.push({x,z,w,length,color,strength,yaw});
    }
    function lights() {
      const geometry = new THREE.BufferGeometry();
      const positions=[], colors=[], uvs=[], strengths=[];
      for (const g of glows) {
        const cos=Math.cos(g.yaw), sin=Math.sin(g.yaw), color=new THREE.Color(g.color);
        for (const [u,v] of [[0,0],[0,1],[1,0],[1,0],[0,1],[1,1]]) {
          const x=(u-.5)*g.w,z=(v-.5)*g.length;
          positions.push(g.x+x*cos+z*sin,.093,g.z+z*cos-x*sin);
          colors.push(color.r,color.g,color.b);
          uvs.push(u,v);
          strengths.push(g.strength);
        }
      }
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      geometry.setAttribute('strength',new THREE.Float32BufferAttribute(strengths,1));
      const material = new THREE.ShaderMaterial({
        vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
        uniforms:{uTime:{value:0}},
        vertexShader:`attribute float strength; varying vec2 vUv; varying vec3 tint; varying float power;
          void main(){vUv=uv; tint=color; power=strength; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`varying vec2 vUv; varying vec3 tint; varying float power; uniform float uTime;
          void main(){vec2 p=abs(vUv-.5)*2.; float edge=(1.-smoothstep(.1,1.,p.x))*(1.-smoothstep(.16,1.,p.y));
          float smear=sin(vUv.x*68.+sin(vUv.y*13.)*.8)*.19 + sin(vUv.x*159.)*.16 + .57;
          float ripple=.68+.32*sin(vUv.y*66.+vUv.x*51.+uTime*1.1);
          gl_FragColor=vec4(tint,edge*power*(.105+smear*ripple*.55));}`
      });
      const reflection = new THREE.Mesh(geometry,material);
      reflection.name = 'portfolio-pavement-reflections';
      world.add(reflection);
      return material;
    }

    function sign(x,y,z,w,h,heading,head,caption,color,display=false) {
      const texture = signTexture(THREE,head,caption,color,display);
      const material = new THREE.MeshBasicMaterial({map:texture,color:texture ? 0xffffff : color, toneMapped:false, fog:false});
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);
      mesh.name = 'portfolio-sign';
      mesh.position.set(x,y,z);
      mesh.rotation.y = heading;
      world.add(mesh);
      return mesh;
    }

    instance('portfolio-foundation',materials.foundation,0,.004,0,edge*2,.008,edge*2);
    for (const street of networkRoads) {
      const angle = Math.atan2(street.x2-street.x1,street.z2-street.z1);
      const x=(street.x1+street.x2)/2, z=(street.z1+street.z2)/2;
      instance('portfolio-curbs',materials.concrete,x,.016,z,street.width+2,.026,street.length+2,angle);
      instance('portfolio-streets',materials.asphalt,x,.035,z,street.width,.018,street.length+1,angle);
      const dx=Math.sin(angle), dz=Math.cos(angle);
      for (let along=-street.length/2+9; along<street.length/2-9; along+=11) {
        const px=x+dx*along, pz=z+dz*along;
        if (Math.abs(px-plaza.x)<plaza.w/2 && Math.abs(pz-plaza.z)<plaza.d/2) continue;
        if (networkRoads.some(other=>other!==street&&distanceToCenter(px,pz,other)<other.width/2+2)) continue;
        instance('portfolio-lanes',materials.paint,px,.05,pz,.14,.01,3.5,angle);
      }
    }
    for (const a of [plaza,playBay]) instance('portfolio-plazas',materials.asphalt,a.x,.058,a.z,a.w,.022,a.d);
    for (const x of [-36,36]) {
      const color=x<0 ? 0xf879b1 : 0x6af8e7;
      instance('portfolio-guidelights',materials.light,x,.077,14,.20,.035,88,0,color);
      glow(x,14,13,86,color,.54);
      for (const z of [-22,2,26,50]) {
        instance('portfolio-masts',materials.metal,x,4.3,z,.36,8.6,.36);
        instance('portfolio-guidelights',materials.light,x,8.55,z,3.5,.17,.24,0,color);
        glow(x-Math.sign(x)*3,z,10,19,color,.62);
      }
    }
    for (const x of [-11,11]) {
      const accent=x<0 ? 0xed4e9d : 0x29e8df;
      for (const z of [-72,-64,-56,-48,-40,-32,-22,-10,2,14,26,38,50,62]) {
        instance('portfolio-guide-dashes',materials.light,x,.076,z,.16,.016,3.5,0,accent);
        if (z < -30 && z % 16 === 0) glow(x*.83,z-7,5,23,accent,1.23);
      }
      glow(x*.55,-69,12,33,accent,.72);
      const mastX=Math.sign(x)*16;
      instance('portfolio-masts',materials.metal,mastX,3.5,-56,.32,7,.32);
      instance('portfolio-neon',materials.light,mastX,5,-56,.4,4.4,.17,x<0 ? east : west,accent);
    }

    const facades = palettes.map((palette,id) => {
      const texture = facadeTexture(THREE,id);
      return new THREE.MeshStandardMaterial({map:texture,emissive:palette.light,emissiveMap:texture,emissiveIntensity:.34,
        roughness:.42,metalness:.24});
    });
    for (const [index,b] of buildings.entries()) {
      const color=palettes[b.style].light;
      instance('portfolio-building-'+b.style,facades[b.style],b.x,b.baseY+b.height/2,b.z,b.width,b.height,b.depth);
      if (b.height < 8) continue;
      const roof=b.baseY+b.height;
      instance('portfolio-roofs',materials.metal,b.x,roof-.28,b.z,b.width+.11,.56,b.depth+.11);
      // Outlines, vertical fins, and dark bands break up the lit windows.
      if (index%3 !== 1) {
        for (const side of [-1,1]) {
          instance('portfolio-neon',materials.light,b.x,roof-.37,b.z+side*b.depth/2,b.width,.12,.085,0,color);
          if (index%4===0) instance('portfolio-neon',materials.light,b.x+side*b.width/2,roof-b.height*.34,b.z,.10,b.height*.66,.15,0,color);
        }
      }
      if (b.height > 17) {
        instance('portfolio-facade-bands',materials.metal,b.x,b.baseY+b.height*.33,b.z,b.width+.18,.32,b.depth+.18);
        if (index%5===0) {
          instance('portfolio-masts',materials.metal,b.x,roof+3,b.z,.22,6,.22);
          instance('portfolio-neon',materials.light,b.x,roof+6.08,b.z,.76,.20,.78,0,0xed4f98);
        }
      }
    }

    for (const segment of highwaySegments) {
      instance('portfolio-ramp',materials.metal,segment.x,segment.centerY,segment.z,segment.width,.5,segment.slopeLength,0,null,segment.pitch);
      for (const side of [-1,1]) {
        instance('portfolio-neon',materials.light,segment.x+side*(segment.width*.5-.09),
          (segment.topStart+segment.topEnd)/2+.03,segment.z,.15,.05,segment.slopeLength,0,0xff9858,segment.pitch);
      }
    }

    const docks = [
      {x:-16,z:-29,heading:north,label:'ABOUT',caption:'ALEX ZHOU'},
      {x:0,z:52.9,heading:north,label:'PROJECTS',caption:'DRIVE UP TO EXPLORE',large:true},
      {x:126,z:26,heading:west,label:'EXPERIENCE',caption:'WORK HISTORY'},
      {x:-122,z:35,heading:east,label:'EDUCATION',caption:'CU BOULDER'},
      {x:-54,z:119,heading:north,label:'SKILLS',caption:'TOOLS AND LANGUAGES'},
      {x:62,z:-121,heading:0,label:'CONTACT',caption:'LINKEDIN / GITHUB'}
    ];
    for (const [i,dock] of docks.entries()) {
      const stop=stops[i], color=stop.color;
      const angle=stop.heading, sideX=Math.cos(angle), sideZ=-Math.sin(angle);
      for (const side of [-1,1]) {
        instance('portfolio-stop-bays',materials.light,stop.x+sideX*side*4,.081,stop.z+sideZ*side*4,.22,.016,10.3,angle,color);
      }
      glow(stop.x,stop.z,11,23,color,.83,angle);
      if (dock.large) {
        sign(dock.x,16.8,dock.z,37,14,dock.heading,dock.label,dock.caption,color,true);
        sign(dock.x,16.8,61.1,37,14,0,dock.label,dock.caption,color,true);
        for (const x of [-17,17]) instance('portfolio-neon',materials.light,x,9.8,51.48,.25,18,.13,0,color);
        glow(0,33,38,41,color,1.15);
      } else {
        instance('portfolio-stop-masts',materials.metal,dock.x,3.9,dock.z,.43,7.8,.43);
        const fx=Math.sin(dock.heading), fz=Math.cos(dock.heading);
        sign(dock.x+fx*.3,7.6,dock.z+fz*.3,12.8,3.2,dock.heading,dock.label,dock.caption,color);
        sign(dock.x-fx*.3,7.6,dock.z-fz*.3,12.8,3.2,dock.heading+Math.PI,dock.label,dock.caption,color);
        glow((stop.x+dock.x)/2,(stop.z+dock.z)/2,11,21,color,.58,angle);
      }
    }

    sign(80,7.2,-73,16,4,0,'BUMP TEST','PYLONS / JUMP RAMP',0xff976d);
    for (const x of [62,93]) instance('portfolio-stop-masts',materials.metal,x,3.3,-73,.42,6.6,.42);
    glow(81,-66,25,22,0xff976d,.86);
    const marquees = [
      [-30,9,-40,16,4,0,'NIGHT MARKET','WEST LOOP',0xf879a4],
      [30,12,-40,14,4,0,'SERVICE BAY','EAST LOOP',0x6be1ff],
      [-43,13,13,18,5,north,'THE WORKSHOP','PORTFOLIO DISTRICT',0xe899ff],
      [44,15,17,17,5,north,'RELAY','PORTFOLIO DISTRICT',0x74e9dc],
      [-63,23,81,20,5,north,'WEST LOOP','SCHOOL / SKILLS',0xb9ec8e],
      [68,27,83,23,5,north,'EAST LOOP','EXPERIENCE / CONTACT',0xffa778]
    ];
    for (const [x,y,z,w,h,facing,head,sub,color] of marquees) {
      sign(x,y,z,w,h,facing,head,sub,color);
      glow(x,z-4,w*1.2,28,color,.84);
    }

    // Low skyline silhouettes are punctuated by aerial lights outside the playable blocks.
    for (const side of [-1,1]) for (let i=0;i<9;i++) {
      const height=48+i%4*23, x=side*(220+i%3*16), z=-187+i*49;
      const style=(i+2)%5;
      instance('portfolio-distant-skyline-'+style,facades[style],x,height*.5,z,17+(i%2)*12,height,25);
      instance('portfolio-neon',materials.light,x,height-.6,z-12.5,14,.18,.15,0,i%3===0 ? 0xf16b9d : 0x608ed2);
    }
    flush();
    const reflection = lights();
    const buffer = new Float32Array(150*6), rainGeometry = new THREE.BufferGeometry();
    const droplets = [], random = randomFrom(0x49b981);
    for (let i=0;i<150;i++) droplets.push({x:(random()-.5)*86,z:(random()-.5)*86,y:random()*31,speed:18+random()*13});
    rainGeometry.setAttribute('position',new THREE.BufferAttribute(buffer,3));
    const rain = new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:0x91bbdc,transparent:true,opacity:.25,depthWrite:false}));
    rain.frustumCulled=false;
    rain.name='portfolio-rain';
    world.add(rain);
    function update(camera,dt) {
      reflection.uniforms.uTime.value += dt;
      if (!camera) return;
      rain.position.set(camera.position.x,0,camera.position.z);
      for (const [i,drop] of droplets.entries()) {
        drop.y -= drop.speed*dt;
        if (drop.y < -2) drop.y += 33;
        const offset=i*6;
        buffer[offset]=drop.x; buffer[offset+1]=drop.y; buffer[offset+2]=drop.z;
        buffer[offset+3]=drop.x+.23; buffer[offset+4]=drop.y+.73; buffer[offset+5]=drop.z-.08;
      }
      rainGeometry.attributes.position.needsUpdate=true;
    }
    update({position:spawn},0);
    return {update};
  }

  return {edge, roadHalfWidth, spawn, routeSamples, stops, buildings, networkRoads, highwaySegments,
    playProps, distanceToRoad, build};
});
