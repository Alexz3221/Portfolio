(function(root, factory) {
  const city = factory();
  if (typeof module === 'object' && module.exports) module.exports = city;
  else root.DrivePortfolioCity = city;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const concreteBump = typeof document !== 'undefined' && document.currentScript?.src
    ? new URL('../assets/portfolio/concrete-bump.jpg', document.currentScript.src).href : 'assets/portfolio/concrete-bump.jpg';
  const edge = 211, roadHalfWidth = 11;
  const spawn = {x:0, z:-103, heading:0};
  const routeSamples = [{x:spawn.x, y:0, z:spawn.z, tx:0, tz:1}];
  const north = Math.PI;
  const west = -Math.PI / 2;
  const east = Math.PI / 2;
  const stops = [
    {id:'about', title:'About', x:-5, z:-52, heading:0, color:'#fa7ca8'},
    {id:'projects', title:'Projects', x:0, z:43, heading:0, color:'#75f9ee'},
    {id:'experience', title:'Experience', x:112, z:25, heading:0, color:'#ffc082'},
    {id:'education', title:'Education', x:-108, z:34, heading:0, color:'#be9eff'},
    {id:'skills', title:'Skills', x:-52, z:79, heading:west, color:'#b8f19f'},
    {id:'contact', title:'Contact', x:63, z:-108, heading:east, color:'#ff7dc4'}
  ];
  const holoLocations = [
    [-7.2,6.15,-51,north,7.4], [0,11.8,45.2,north,29], [125,7.4,25,west,15],
    [-121,7.3,34,east,13], [-52,7.4,89,north,12], [63,7.3,-123,0,13]
  ];
  const holograms = stops.map((stop, i) => {
    const [x,y,z,heading,width] = holoLocations[i];
    return {id:stop.id,label:stop.title.toUpperCase(),x,y,z,heading,width,color:stop.color};
  });

  function road(x1, z1, x2, z2, width, roadClass = 'street') {
    return {x1, z1, x2, z2, width, roadClass, length:Math.hypot(x2-x1, z2-z1)};
  }

  // Enter through the transfer tunnel, then take the concourse directly to
  // Projects or turn into the market and maintenance streets from the plaza.
  const networkRoads = [
    road(0,-135,0,-38,14,'main'), road(0,-38,0,56,19,'main'),
    road(0,-4,-29,-4,15), road(-29,-4,-63,-20,16), road(-63,-20,-91,-20,16), road(-91,-20,-108,-2,17),
    road(0,8,28,8,15), road(28,8,60,-12,17), road(60,-12,91,-12,21), road(91,-12,112,5,18),
    road(-108,-91,-108,76,17), road(112,-100,112,75,19),
    road(-108,-91,-76,-111,16), road(-76,-111,-46,-128,17), road(-46,-128,15,-128,17),
    road(15,-128,43,-108,18), road(43,-108,89,-108,18), road(89,-108,112,-100,19),
    road(0,56,-28,79,17,'main'), road(-28,79,-83,79,17), road(-83,79,-108,76,17),
    road(0,56,31,81,17,'main'), road(31,81,82,92,19), road(82,92,112,75,18),
    road(-83,79,-67,106,16), road(-67,106,-33,123,16), road(-33,123,41,123,16), road(41,123,82,92,16),
    road(112,-54,65,-54,18), road(-108,-53,-140,-53,14), road(112,45,139,45,16)
  ];
  const plaza = {x:0,z:4,w:48,d:84};
  const playBay = {x:78,z:-53,w:40,d:38};
  const shops = {x:-75,z:-20,w:29,d:22};
  const pavedAreas = [plaza,playBay,shops];
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
    for (const area of pavedAreas) {
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
  function block(x,z,width,depth,height,style,baseY = 0,detail = false) {
    buildings.push({x,z,width,depth,height,style,baseY,detail});
  }
  function tower(x,z,width,depth,height,style,shape,detail = false) {
    if (shape === 'podium') {
      block(x,z,width,depth,6,style,0,detail);
      block(x,z,width*.68,depth*.72,height-6,style,6,detail);
    } else if (shape === 'steps') {
      const first = Math.round(height*.37), second = Math.round(height*.31);
      block(x,z,width,depth,first,style,0,detail);
      block(x-width*.09,z,width*.78,depth*.69,second,style,first,detail);
      block(x-width*.16,z,width*.5,depth*.5,height-first-second,style,first+second,detail);
    } else if (shape === 'twins') {
      block(x,z,width,depth,8,style,0,detail);
      block(x-width*.26,z,width*.4,depth*.8,height-8,style,8,detail);
      block(x+width*.26,z+depth*.09,width*.4,depth*.67,height*.76-8,style,8,detail);
    } else if (shape === 'cantilever') {
      block(x,z,width*.64,depth,height*.24,style,0,detail);
      block(x-width*.08,z,width,depth*.82,height*.52,style,height*.24,detail);
      block(x-width*.17,z,width*.65,depth*.62,height*.24,style,height*.76,detail);
    } else block(x,z,width,depth,height,style,0,detail);
  }

  // The layout uses distinct districts instead of a repeating perimeter grid.
  // Low storefronts frame the streets. Tall volumes frame the Projects tower.
  const frontages = [
    [-18,-103,18,26,43,3,'slab'], [17,-103,17,26,51,6,'slab'],
    [-23,-78,26,19,65,4,'steps'], [20,-79,20,23,77,0,'cantilever'],
    [-21,-52,19,25,45,1,'podium'], [24,-52,26,30,58,6,'steps'],
    [-46,-41,17,18,18,1,'podium'], [-75,-42,21,14,25,2,'steps'],
    [-68,2,24,16,9,1,'slab'], [-85,10,14,17,19,3,'cantilever'],
    [-87,37,16,22,38,2,'steps'], [-125,28,15,20,51,2,'podium'],
    [-52,31,19,26,49,2,'twins'], [-34,36,15,14,32,1,'podium'],
    [39,31,16,22,45,0,'cantilever'], [58,44,21,21,70,4,'steps'],
    [83,15,30,21,15,5,'slab'], [87,-89,18,12,18,5,'slab'],
    [139,19,22,20,23,3,'steps'], [130,-60,13,25,37,5,'twins'],
    [64,-133,25,20,27,6,'steps'], [46,-83,16,21,20,3,'cantilever'],
    [-87,115,15,12,23,2,'podium'], [-43,101,15,15,14,7,'cantilever'],
    [-15,101,14,23,36,7,'twins'], [15,102,20,21,47,0,'steps'],
    [56,135,16,14,19,7,'slab'], [91,110,25,19,39,4,'podium'],
    [-44,58,18,16,53,2,'steps'], [58,69,21,16,56,4,'twins'],
    [-11,83,12,13,81,4,'steps'], [11,88,13,16,65,0,'cantilever']
  ];
  for (const geometry of frontages) tower(...geometry,true);

  const rnd = randomFrom(0x23052d);
  function clearFootprint(x,z,w,d) {
    const nearStreet = networkRoads.some(street => distanceToCenter(x,z,street) < street.width/2 + Math.hypot(w,d)/2+3);
    const overlaps = buildings.some(b => Math.abs(x-b.x) < (w+b.width)/2+5 && Math.abs(z-b.z) < (d+b.depth)/2+5);
    const inPlaza = pavedAreas.some(area => Math.abs(x-area.x) < (w+area.w)/2+5 &&
      Math.abs(z-area.z) < (d+area.d)/2+5);
    return !nearStreet && !overlaps && !inPlaza;
  }
  // A sparse second row adds depth without pulling attention from signs and intersections.
  for (const z of [-180,-152,-122,-83,-40,21,63,133,166,189]) for (const x of [-184,-157,-130,-84,-48,-24,31,65,87,149,177]) {
    const w = 12+rnd()*16, d = 12+rnd()*19;
    const peripheral = Math.abs(x)>125 || Math.abs(z)>130;
    const h = (peripheral ? 24 : 13) + rnd()*(peripheral ? 57 : 18);
    const style = z>65 ? 7 : x>40 ? 5 : x<-32 ? 2 : 4;
    const shape = ['steps','podium','twins','slab'][Math.floor(rnd()*4)];
    if (peripheral && clearFootprint(x,z,w,d)) tower(x,z,w,d,h,style,shape);
  }

  // Narrow ribs and the hanging concourse frame are collision-backed.
  const entryRibs = [
    {z:-112,y:9.4}, {z:-97,y:11.5}, {z:-82,y:10.8}, {z:-68,y:10.05}
  ];
  for (const {z,y} of entryRibs) {
    for (const x of [-8.5,8.5]) block(x,z,1.05,1.05,y,3,0,true);
    block(0,z,18.25,1.25,.48,3,y,true);
  }
  const catwalks = [
    {z:-92, y:17.25, width:18.7, depth:2.4},
    {z:-63, y:18.3, width:23.2, depth:3.0}
  ];
  for (const span of catwalks) block(0,span.z,span.width,span.depth,.58,3,span.y,true);
  block(-16,48,4,7,15,4,0,true);
  block(16,48,4,7,15,4,0,true);
  block(0,51,36,6,2.2,4,16.4,true);

  const assetPlacements = [
    ...[-66,-37,9,32].flatMap(z => [-1,1].map(side => ({id:'streetlight',x:side*(z < -42 ? 9 : 23),z,y:.06,heading:side*Math.PI/2,height:6.7}))),
    {id:'ac-stacked',x:-31,z:-46,y:0,heading:east,height:2.5},
    {id:'ac-stacked',x:38,z:21,y:0,heading:west,height:2.4},
    {id:'ac-stacked',x:-68,z:2,y:9,heading:north,height:2.5},
    {id:'antenna',x:-12,z:83,y:81,heading:0,height:7.6},
    {id:'antenna',x:135,z:-66,y:8,heading:east,height:5},
    {id:'tv-tower',x:55,z:44,y:70,heading:0,height:10},
    {id:'terminal',x:-8.4,z:-48,y:.06,heading:east,height:2.3},
    {id:'terminal',x:20,z:23,y:.06,heading:west,height:2.8},
    {id:'terminal',x:-120,z:39,y:0,heading:east,height:2.3},
    {id:'tank',x:99,z:-64,y:0,heading:west,height:4.8},
    {id:'tank',x:102,z:-70,y:0,heading:west,height:4.4},
    {id:'platform',x:25,z:49,y:.07,heading:north,height:6},
    {id:'sushi-truck',x:-72,z:-30.5,y:.07,heading:east,height:3.4},
    {id:'signs',x:-70,z:2,y:9,heading:north,height:4.8},
    {id:'signs',x:26,z:-47,y:6,heading:west,height:5.7}
  ];

  const adPlacements = [
    {id:'entry-ribs',x:0,y:10.1,z:-94.5,heading:north,width:14,height:3.0,color:'#c4ecfd'},
    {id:'entry-east-low',x:8.32,y:4.0,z:-105,heading:west,width:8.0,height:3.2,color:'#ff6e82'},
    {id:'entry-east-high',x:8.30,y:9.15,z:-102,heading:west,width:12,height:4.8,color:'#fdcf6c'},
    {id:'entry-west-low',x:-8.82,y:4.4,z:-99,heading:east,width:11,height:3.4,color:'#b8f4fe'},
    {id:'entry-west-column',x:-8.81,y:10.6,z:-110,heading:east,width:3.8,height:8.3,color:'#ff71af'},
    {id:'arrival-crown',x:24,y:15,z:-67.12,heading:north,width:15,height:6.8,color:'#ff9a80'},
    {id:'arrival-server',x:-23,y:12.2,z:-87.60,heading:north,width:18,height:7,color:'#9cd8fc'},
    {id:'arrival-vert',x:-11.2,y:8.0,z:-62,heading:east,width:3.4,height:8.0,color:'#ff93c9'},
    {id:'arrival-bridge',x:0,y:16.95,z:-64.8,heading:north,width:15,height:3.3,color:'#e0fff0'},
    {id:'plaza-west',x:-40,y:13.1,z:14.5,heading:north,width:15,height:5.6,color:'#d7abff'},
    {id:'plaza-east',x:39.8,y:16.2,z:21.2,heading:north,width:13,height:7,color:'#83f5fb'},
    {id:'market-upper',x:-74,y:11.2,z:-34.6,heading:0,width:14,height:4.3,color:'#ff8ea7'},
    {id:'service-dock',x:122,y:9.1,z:15,heading:west,width:9.2,height:4.1,color:'#ffbb62'},
    {id:'campus-mast',x:-41,y:9.3,z:94,heading:north,width:11,height:4.1,color:'#c2f9bc'},
    {id:'plaza-tower-banner',x:40,y:29.3,z:21.4,heading:north,width:6.4,height:13.4,color:'#b9fcf1'}
  ];

  const highwaySegments = [
    {x:72,z:-63,width:8,length:15,topStart:.14,topEnd:2.8},
    {x:72,z:-54,width:8,length:3,topStart:2.8,topEnd:2.8}
  ];
  for (const ramp of highwaySegments) {
    ramp.pitch = -Math.atan2(ramp.topEnd-ramp.topStart,ramp.length);
    ramp.slopeLength = Math.hypot(ramp.length,ramp.topEnd-ramp.topStart);
    ramp.centerY = (ramp.topStart+ramp.topEnd)/2 - .25*Math.cos(ramp.pitch);
  }

  const facades = [
    {name:'curtain-wall',wall:0x425963, light:0x80f7eb, width:10.1,height:12.7,roughness:.27},
    {name:'brick-market',wall:0x684940,light:0xffab90,width:8.8,height:9.6,roughness:.83},
    {name:'balcony-block',wall:0x504555,light:0xeacaf4,width:11.4,height:12.3,roughness:.73},
    {name:'metal-ribs',wall:0x464452,light:0xdacff1,width:8.1,height:10.3,roughness:.46},
    {name:'server-tower',wall:0x263d4c,light:0x6ac7ea,width:10.3,height:15.5,roughness:.34},
    {name:'service-siding',wall:0x635048,light:0xffbd69,width:12.1,height:11.4,roughness:.61},
    {name:'ceramic-panels',wall:0x695f6d,light:0xff6788,width:8.9,height:10.7,roughness:.56},
    {name:'library-glass',wall:0x3e5047,light:0xd2eca3,width:11.5,height:9.9,roughness:.38}
  ];

  function repeatedTexture(THREE, pixels, size) {
    const texture = new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = texture.needsUpdate = true;
    return texture;
  }

  function facadeMaterial(THREE,style,grime) {
    const facade = facades[style];
    const size = 128, bytes = size*size*4;
    const diffuse = new Uint8Array(bytes), emission = new Uint8Array(bytes);
    const random = randomFrom(0x184b1a+style*911);
    const wall = new THREE.Color(facade.wall).convertSRGBToLinear();
    const light = new THREE.Color(facade.light).convertSRGBToLinear();
    const occupancy = Array.from({length:64},()=>random());
    for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
      const u=x/size,v=y/size,tileX=x%32,tileY=y%32,i=(y*size+x)*4;
      const occupied=occupancy[Math.floor(y/16)*8+Math.floor(x/16)];
      const grain=.75+.38*random(), corrosion=.90+.12*Math.sin(u*35+Math.cos(v*14)*.8);
      let shade=1, glow=0;
      switch (style) {
        case 0: { // Tall sections of tinted glass and narrow mullions.
          const mullion=x%16 < 2 || tileY<3;
          shade=mullion ? 1.23 : .29+(.38+u*.16)*(tileY/32);
          if (!mullion && occupied>.71) glow=(.26+.23*occupied)*(1-tileY/64);
          break;
        }
        case 1: { // Old masonry with deep openings and warm shop lamps.
          const row=Math.floor(y/4), brick=(x+(row%2)*6)%12;
          shade=y%4===0 || brick<1 ? .47 : .92+(row%3)*.12;
          if (tileX>=8 && tileX<24 && tileY>8 && tileY<25) {
            shade=tileX===16 || tileY===18 ? .42 : .25;
            if (occupied>.58 && tileX!==16 && tileY!==18) glow=.49+tileY*.012;
          }
          break;
        }
        case 2: { // Ribbed balcony slabs and deep, asymmetrical recesses.
          shade=tileY<4 ? 1.5 : tileY<10 ? .30 : .70;
          if (tileX>9 && tileX<27 && tileY>10 && tileY<21) {
            shade=tileX%4===0 ? .55 : .20;
            if (occupied>.63 && tileX%4!==0) glow=.34+(x%3)*.055;
          }
          break;
        }
        case 3: { // Continuous anodized vertical fins and occasional vents.
          shade=.42+(x%8)/8;
          if (y%48<6) shade*=.45;
          if (x%32===7 && y%48<5) glow=.76;
          break;
        }
        case 4: { // Tall server cassettes with instrument LEDs.
          shade=x%16<2 || y%24<2 ? 1.3 : y%4<2 ? .55 : .24;
          if (x%16===5 && y%12===4 && occupied>.23) glow=.93;
          if (x%32<3 && y%39>8 && y%39<34 && occupied>.47) glow=.28;
          break;
        }
        case 5: { // Greasy roller shutters, rivets, and amber vents.
          shade=.61+(y%5)*.14;
          if (tileX===1 || tileY===1) shade=.42;
          if (tileY>24 && tileX>5 && tileX<27) {
            shade=y%2===0 ? .30 : 1.13;
            if (y%2!==0 && occupied>.60) glow=.41;
          }
          break;
        }
        case 6: { // Glazed ceramic panels patched with dark security hardware.
          const seam=x%21<2 || y%16<2;
          shade=seam ? .31 : .72+(x%21)*.021;
          if (x%41<6) shade*=.33;
          if (x%41===5 && y%19>3 && y%19<16) glow=.67;
          break;
        }
        case 7: { // Heavy timber-colored posts and large library windows.
          const frame=tileX<5 || tileY<8 || tileY>26;
          shade=frame ? 1.25 : .22+(tileY%9)*.06;
          if (!frame && tileX%11!==0 && occupied>.54) glow=.45;
          break;
        }
      }
      diffuse.set([wall.r*shade*grain*corrosion*255,wall.g*shade*grain*255,wall.b*shade*grain*255,255],i);
      emission.set([light.r*glow*255,light.g*glow*255,light.b*glow*255,255],i);
    }
    const material = new THREE.MeshStandardMaterial({map:repeatedTexture(THREE,diffuse,size),
      emissiveMap:repeatedTexture(THREE,emission,size),emissive:0xffffff,emissiveIntensity:1.1,
      roughness:facade.roughness,metalness:.21,bumpMap:grime,bumpScale:.045});
    // Repeat material details in world metres so a small storefront and a tower
    // can share an instanced material without either one stretching its windows.
    material.onBeforeCompile = shader => {
      shader.uniforms.districtPeriod = {value:new THREE.Vector2(facade.width,facade.height)};
      shader.vertexShader = `varying vec2 districtUv; uniform vec2 districtPeriod;\n${shader.vertexShader}`
        .replace('#include <uv_vertex>',`#include <uv_vertex>
          vec3 partSize = vec3(1.0);
          #ifdef USE_INSTANCING
            partSize = vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
          #endif
          vec2 faceSize = abs(normal.y) > .5 ? partSize.xz : vec2(abs(normal.x) > .5 ? partSize.z : partSize.x,partSize.y);
          districtUv = uv * faceSize / districtPeriod;`);
      shader.fragmentShader = `varying vec2 districtUv;\n${shader.fragmentShader}`
        .replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace('vUv','districtUv'))
        .replace('#include <emissivemap_fragment>',THREE.ShaderChunk.emissivemap_fragment.replace('vUv','districtUv'))
        .replace('#include <bumpmap_pars_fragment>',THREE.ShaderChunk.bumpmap_pars_fragment.replace(/\bvUv\b/g,'(districtUv * 4.8)'));
    };
    return material;
  }

  function surfaceTexture(THREE,slabs) {
    const size=128, pixels=new Uint8Array(size*size*4), random=randomFrom(slabs ? 0x184d02 : 0x452992);
    for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
      const grain=random(), i=(y*size+x)*4;
      const seam=slabs && (y<3 || (x+(y>64 ? 24 : 0))%64<3 || (y>61 && y<65));
      const darkPatch=(Math.sin(y*.095+x*.053)+Math.sin(x*.27-y*.11))*.10;
      const value=255*Math.min(1,seam ? .32+grain*.1 : .77+grain*.19+darkPatch);
      pixels.set([value,value,value,255],i);
    }
    const map=repeatedTexture(THREE,pixels,size);
    map.repeat.set(slabs ? 5 : 3,slabs ? 8 : 12);
    return map;
  }

  function signTexture(THREE,head,caption,color) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return null;
    canvas.width = 768;
    canvas.height = 190;
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
    const x = 34, limit = w-68;
    let size = 61;
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${size}px ui-monospace, monospace`;
    while (size > 26 && ctx.measureText(head).width > limit) ctx.font = `800 ${--size}px ui-monospace, monospace`;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#effefa';
    ctx.fillText(head,x,h*.42);
    ctx.shadowBlur = 0;
    ctx.fillStyle = accent;
    ctx.font = '700 25px ui-monospace, monospace';
    ctx.fillText(caption,x,h*.71,limit);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function build(THREE,world,{wetReflections=false}={}) {
    const box = new THREE.BoxGeometry(1,1,1), transform = new THREE.Object3D();
    const surfaceColor = hex => new THREE.Color(hex).convertSRGBToLinear();
    const materials = {
      foundation:new THREE.MeshStandardMaterial({color:surfaceColor(0x191a24),roughness:.92}),
      asphalt:new THREE.MeshStandardMaterial({color:surfaceColor(0x272b35),map:surfaceTexture(THREE,false),roughness:.73,metalness:.09}),
      concrete:new THREE.MeshStandardMaterial({color:surfaceColor(0x50515a),map:surfaceTexture(THREE,true),roughness:.88}),
      metal:new THREE.MeshStandardMaterial({color:surfaceColor(0x494e62),roughness:.5,metalness:.42}),
      steel:new THREE.MeshStandardMaterial({color:surfaceColor(0x232a39),roughness:.56,metalness:.55}),
      copper:new THREE.MeshStandardMaterial({color:surfaceColor(0x685251),roughness:.52,metalness:.36}),
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

    // Low-intensity local spill still helps in devices without planar reflections.
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
          strengths.push(g.strength*(wetReflections ? .28 : 1));
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

    function sign(x,y,z,w,h,heading,head,caption,color) {
      const texture = signTexture(THREE,head,caption,color);
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
    for (const a of pavedAreas) instance('portfolio-plazas',materials.asphalt,a.x,.058,a.z,a.w,.022,a.d);
    function wayMarker(x,z,heading,color,span=1) {
      const sideX=Math.cos(heading),sideZ=-Math.sin(heading);
      for (const side of [-1,1]) instance('portfolio-wayfinding',materials.light,
        x+side*sideX*.46*span,.079,z+side*sideZ*.46*span,.115*span,.012,1.45*span,heading-side*.63,color);
    }
    // A pale lane runs straight from the gate to Projects. Colored forks lead
    // off that spine, so the main destination remains obvious at a glance.
    for (const z of [-114,-101,-86,-70,-56,-39,-24,-9,7,22,37,51]) wayMarker(0,z,0,0x88fff0,z>-38 ? 1.45 : 1.12);
    for (const [x,z,heading,color] of [
      [-22,-4,west,0xd2a4ff],[-38,-9,west-.43,0xd2a4ff],[-58,-18,west-.43,0xd2a4ff],[-78,-20,west,0xd2a4ff],
      [22,8,east,0xffb475],[38,2,east+.5,0xffb475],[53,-8,east+.5,0xffb475],[73,-12,east,0xffb475],
      [-15,68,west+.68,0xbceca9],[-35,79,west,0xbceca9],[-63,79,west,0xbceca9],
      [112,-93,north,0xfa79a0],[100,-103,west-.35,0xfa79a0],[83,-108,west,0xfa79a0]
    ]) wayMarker(x,z,heading,color,1.6);

    // The entry feels enclosed. Overhead utility hardware and wall-mounted
    // lights bracket the approach before the street opens into the square.
    for (const {z,y} of entryRibs) {
      instance('portfolio-entry-ribs',materials.steel,0,y+.45,z,17.9,.15,1.26);
      instance('portfolio-entry-gate-lamps',materials.light,0,y-.062,z,12.2,.10,.16,0,0xe9e2ff);
      for (const x of [-8.5,8.5]) {
        const accent=x<0 ? 0xff466a : 0xffac52;
        instance('portfolio-entry-signal',materials.light,x,5.0,z+1.30,.52,2.9,.095,0,accent);
        instance('portfolio-entry-ribs',materials.metal,x,2.6,z,1.35,.4,1.5);
        glow(x*.8,z+3,10,25,accent,.80);
      }
    }
    for (const x of [-7.3,7.3]) {
      for (const z of [-118,-112,-106,-100,-94,-88,-82,-76,-70,-64,-58,-52,-46]) {
        instance('portfolio-entry-lanterns',materials.light,x,.080,z,.14,.026,2.6,0,x<0 ? 0xee809e : 0xffc080);
      }
      instance('portfolio-entry-gantry',materials.copper,x,7.79,-91,.22,.24,47);
      glow(x*.7,-100,11,37,x<0 ? 0xff5578 : 0xd66f44,.86);
    }

    for (const x of [-21,21]) {
      const color=x<0 ? 0xcd83f2 : 0x5dd7e1;
      instance('portfolio-guidelights',materials.light,x,.079,15,.13,.021,57,0,color);
      glow(x,15,11,57,color,.41);
      for (const z of [-21,4,28,41]) {
        instance('portfolio-concourse-masts',materials.metal,x,3.3,z,.38,6.6,.38);
        instance('portfolio-concourse-lamps',materials.light,x-Math.sign(x),6.44,z,2.6,.16,.29,0,color);
        glow(x-Math.sign(x)*4,z,13,20,color,.52);
      }
    }

    const grime = typeof document === 'undefined' ? null : new THREE.TextureLoader().load(concreteBump);
    if (grime) grime.wrapS = grime.wrapT = THREE.RepeatWrapping;
    const facadeMaterials = facades.map((_,style) => facadeMaterial(THREE,style,grime));
    for (const [index,b] of buildings.entries()) {
      const {name,light:color}=facades[b.style];
      instance('portfolio-building-'+name,facadeMaterials[b.style],b.x,b.baseY+b.height/2,b.z,b.width,b.height,b.depth);
      const detailed = b.detail && b.width > 3;
      if (detailed && !b.baseY) {
        instance('portfolio-footings',materials.steel,b.x,1.1,b.z,b.width+.16,2.2,b.depth+.18);
        if (b.style===1 || b.style===2 || b.style===7) {
          for (const side of [-1,1]) {
            instance('portfolio-shop-awnings',b.style===1 ? materials.copper : materials.metal,b.x,3.3,b.z+side*(b.depth/2+.65),b.width*.89,.46,1.7);
            instance('portfolio-shop-light',materials.light,b.x,3.05,b.z+side*(b.depth/2+.92),b.width*.69,.10,.13,0,color);
          }
          for (let inset=-b.width*.40;inset<b.width*.42;inset+=Math.max(1.3,b.width/7))
            for (const side of [-1,1]) instance('portfolio-storefront-panels',materials.steel,b.x+inset,2.35,b.z+side*(b.depth/2+.14),.28,3.4,.39);
        } else if (b.style===3 || b.style===5 || b.style===6) {
          for (const side of [-1,1]) {
            for (const off of [-.30,.26]) instance('portfolio-conduit-bundles',materials.copper,b.x+b.width*off,b.height*.39,b.z+side*(b.depth/2+.20),.35,b.height*.73,.55);
            instance('portfolio-vent-rails',materials.metal,b.x,3.25,b.z+side*(b.depth/2+.40),b.width*.85,.43,.84);
          }
        }
      }
      if (b.height < 8) continue;
      const roof=b.baseY+b.height;
      instance('portfolio-roofs',materials.steel,b.x,roof-.28,b.z,b.width+.11,.56,b.depth+.11);
      // Give each district matching details and leave background silhouettes quiet.
      if (detailed && (index%3 === 0 || b.style===0 || b.style===4)) {
        for (const side of [-1,1]) {
          instance('portfolio-neon',materials.light,b.x,roof-.60,b.z+side*(b.depth/2+.03),b.width*.73,.105,.09,0,color);
          if (b.style===4 || (index%4===0 && b.style!==1))
            instance('portfolio-vertical-light',materials.light,b.x+side*(b.width/2+.03),roof-b.height*.34,b.z+side*b.depth*.24,.10,b.height*.66,.15,0,color);
        }
      }
      if (detailed && b.height > 15 && (b.style===0 || b.style===2 || b.style===5)) {
        const floors=b.style===5 ? 2 : 4;
        for (let level=1;level<=floors;level++) instance('portfolio-facade-bands',materials.metal,
          b.x,b.baseY+b.height*level/(floors+1),b.z,b.width+.29,.27,b.depth+.31);
        if (index%6===0) {
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

    for (const stop of stops) {
      const color=stop.color;
      const angle=stop.heading, sideX=Math.cos(angle), sideZ=-Math.sin(angle);
      for (const side of [-1,1]) {
        instance('portfolio-stop-bays',materials.light,stop.x+sideX*side*2.9,.081,stop.z+sideZ*side*2.9,.16,.016,9.0,angle,color);
        for (const offset of [-4.45,4.45]) instance('portfolio-stop-corners',materials.light,
          stop.x+sideX*side*2.5+Math.sin(angle)*offset,.082,stop.z+sideZ*side*2.5+Math.cos(angle)*offset,
          .8,.016,.13,angle,color);
      }
      glow(stop.x,stop.z,13,20,color,.64,angle);
    }
    for (const x of [-16,16]) {
      instance('portfolio-project-supports',materials.steel,x,7.5,45.7,3.5,15,.78);
      instance('portfolio-project-tower-light',materials.light,x,8,45.16,.20,14.5,.13,0,0x63eedb);
      for (const y of [3.1,7.7,12.2]) instance('portfolio-project-clamps',materials.copper,x,y,45.3,4.22,.58,1.02);
    }
    instance('portfolio-project-fascia',materials.steel,0,17.25,47.93,36,1.2,.33);
    instance('portfolio-project-fascia-light',materials.light,0,16.78,47.71,32.5,.13,.14,0,0xb7f8e8);
    glow(0,38,30,39,0x6af9e2,.78);

    for (const {z,y,width,depth} of catwalks) {
      const hue=z < -80 ? 0xe3ebff : 0xc7fff0;
      for (const side of [-1,1]) {
        const fasciaZ=z+side*(depth/2+.09);
        instance('portfolio-catwalk-fascia',materials.steel,0,y+.24,fasciaZ,width,.56,.16);
        instance('portfolio-catwalk-seams',materials.light,0,y+.08,fasciaZ+side*.10,width*.94,.08,.075,0,hue);
        instance('portfolio-catwalk-handrails',materials.metal,0,y+1.55,fasciaZ,width,.11,.11);
        for (let x=-width*.46;x<width*.49;x+=2.1) instance('portfolio-catwalk-handrails',materials.metal,x,y+1.10,fasciaZ,.095,.92,.095);
      }
    }

    const cables = [];
    function cable(ax,ay,az,bx,by,bz,sag) {
      const point=t=>[ax+(bx-ax)*t,ay+(by-ay)*t-4*sag*t*(1-t),az+(bz-az)*t];
      for (let i=0;i<10;i++) cables.push(...point(i/10),...point((i+1)/10));
    }
    for (const offset of [-.62,0,.58]) {
      cable(-9,7.75+offset,-109,9.4,8+offset,-82,1.05);
      cable(8.7,9+offset,-101,-10.8,10.2+offset,-78,.94);
      cable(-11,11.4+offset,-70,11.8,10.8+offset,-56,1.2);
      cable(-61,6.8+offset,-33,-87,6+offset,-7,1);
      cable(125,9.1+offset,-8,100,7.7+offset,11,.72);
    }
    const cableGeometry = new THREE.BufferGeometry();
    cableGeometry.setAttribute('position',new THREE.Float32BufferAttribute(cables,3));
    const cableMesh = new THREE.LineSegments(cableGeometry,new THREE.LineBasicMaterial({color:0x38344c}));
    cableMesh.name='portfolio-utility-cables';
    world.add(cableMesh);

    sign(80,7.2,-73,16,4,0,'BUMP TEST','PYLONS / JUMP RAMP',0xff976d);
    for (const x of [62,93]) instance('portfolio-stop-masts',materials.metal,x,3.3,-73,.42,6.6,.42);
    glow(81,-66,25,22,0xff976d,.86);
    const marquees = [
      [-23,5.7,-13,11,2.2,north,'NIGHT MARKET','EDUCATION',0xf7a2d4],
      [24,5.7,-4,11,2.2,north,'SERVICE DISTRICT','EXPERIENCE / TEST BAY',0xffbf79],
      [-82,4.4,-9.1,6.5,1.8,north,'MARKET','FOOD / REPAIRS',0xff90ae],
      [-30,3.8,75,7.5,2.1,east,'CAMPUS','SKILLS',0xc1eda9],
      [112,5.3,-95,10.2,2.1,0,'SOUTH STREET','CONTACT',0xfa93a7]
    ];
    for (const [x,y,z,w,h,facing,head,sub,color] of marquees) {
      sign(x,y,z,w,h,facing,head,sub,color);
      glow(x,z-4,w*1.2,28,color,.84);
    }

    // Low skyline silhouettes are punctuated by aerial lights outside the playable blocks.
    for (const side of [-1,1]) for (let i=0;i<9;i++) {
      const height=48+i%4*23, x=side*(220+i%3*16), z=-187+i*49;
      const style=(i+2)%5;
      instance('portfolio-distant-skyline-'+style,facadeMaterials[style],x,height*.5,z,17+(i%2)*12,height,25);
      if (i%3===1) instance('portfolio-neon',materials.light,x,height-.6,z-12.5,14,.1,.15,0,0x607cc0);
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
    playProps, holograms, adPlacements, assetPlacements, distanceToRoad, build};
});
