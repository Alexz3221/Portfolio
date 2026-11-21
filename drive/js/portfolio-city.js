(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./portfolio-exchange'),require('./portfolio-underwriting'),require('./portfolio-sublight'),
      require('./portfolio-sky-mall'));
  } else {
    root.DrivePortfolioCity = factory(root.DrivePortfolioExchange,root.DrivePortfolioUnderwriting,root.DrivePortfolioSublight,
      root.DrivePortfolioSkyMall);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(exchange,underwriting,sublight,mall) {
  'use strict';

  const driveBase = typeof document !== 'undefined' && document.currentScript?.src
    ? new URL('../', document.currentScript.src).href : '';
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
    {id:'contact', title:'Interests', x:63, z:-108, heading:east, color:'#ff7dc4'}
  ];
  const holoLocations = [
    [-7.2,6.15,-51,north,7.4], [0,14.6,47.68,north,29], [125,7.4,25,west,15],
    [-116.75,7.3,34,east,13], [-42.8,7.4,89,north,12], [63,7.3,-121.65,0,13]
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
  const skyway = {
    west:{id:'skyway-west',title:'Skyway West',x:-108,z:-27.5,heading:east},
    east:{id:'skyway-east',title:'Skyway East',x:112,z:-27.5,heading:west},
    width:9.2,
    levels:[[-104,.06],[-98,.44],[-91,1.45],[-76,4.9],[-60,8.6],[-49,10.85],[-43,11.5],
      [-16,11.5],[16,11.5],[51,11.5],[58,10.8],[71,8.2],[89,4.1],[101,1.35],[107,.40],[112,.06]]
  };
  const mallDeck = mall.deck;
  const splitX=16.4;
  const branchWidth=9.2;
  const branchStations = [
    [skyway.west.z+skyway.width/2,splitX,11.5],[-20,splitX,11.65],[-16,17.15,12.41],[-10,18.3,14.2],
    [-3,18.5,16.5],[4.5,17.9,18.98],[12,16.7,21.46],[20,15,24.07],
    [24,14.3,25.29],[27,14,25.84],[29,14,mallDeck.y],[mallDeck.minZ,14,mallDeck.y]
  ];
  const branchRoutes = [-1,1].map(side=>{
    const stations=branchStations.map(([z,x,y])=>({x:side*x,y,z}));
    const normals=stations.slice(1).map((to,index)=>{
      const from=stations[index], dx=to.x-from.x, dz=to.z-from.z;
      const length=Math.hypot(dx,dz);
      return [dz/length,-dx/length];
    });
    const miters=stations.map((_,index)=>{
      const a=normals[Math.max(index-1,0)], b=normals[Math.min(index,normals.length-1)];
      const scale=1+a[0]*b[0]+a[1]*b[1];
      return [(a[0]+b[0])/scale,(a[1]+b[1])/scale];
    });
    return stations.slice(1).map((to,index)=>{
      const from=stations[index];
      return {...road(from.x,from.z,to.x,to.z,branchWidth),id:side<0 ? 'mall-west' : 'mall-east',
        x:(from.x+to.x)/2,z:(from.z+to.z)/2,topStart:from.y,topEnd:to.y,
        startMiter:miters[index],endMiter:miters[index+1],mode:'SKY MALL'};
    });
  });
  const branchSegments = branchRoutes.flat();
  const mapBranches = branchRoutes.flatMap(segments=>{
    const {x1,z1}=segments[0];
    return [{...road(x1,skyway.west.z,x1,z1,branchWidth),mode:'SKY MALL'},...segments];
  });
  const mallLoop = mall.drivePath.slice(1).map(([x,z],i)=>({
    ...road(...mall.drivePath[i],x,z,branchWidth),topStart:mallDeck.y,topEnd:mallDeck.y,mode:'SKY MALL'
  }));
  const skywayRoad = road(skyway.levels[0][0],skyway.west.z,skyway.levels.at(-1)[0],skyway.east.z,skyway.width);
  skyway.entrances = [skyway.west,skyway.east];
  skyway.overviewRoads = [{...skywayRoad,mode:'ELEVATED'},...mapBranches,...mallLoop];
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
    let nearest = distanceToCenter(x,z,skywayRoad) + roadHalfWidth - skywayRoad.width/2;
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
    const volume = {x,z,width,depth,height,style,baseY,detail};
    buildings.push(volume);
    return volume;
  }
  function collisionBlock(...dimensions) {
    block(...dimensions).collisionOnly = true;
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
  const arrivalFrontages = [
    {id:'power-exchange',x:-18,z:-103,width:18,depth:26,style:3,side:-1},
    {id:'glazed-sweep',x:17,z:-103,width:17,depth:26,style:6,side:1},
    {id:'terrace-court',x:-23,z:-78,width:26,depth:19,style:4,side:-1},
    {id:'split-lobby',x:20,z:-79,width:12.8,depth:23,style:0,side:1},
    {id:'brick-spine',x:-21,z:-52,width:19,depth:25,style:1,side:-1},
    {id:'exchange-canopy',x:24,z:-52,width:26,depth:30,style:6,side:1}
  ].map(frontage=>({...frontage,podiumHeight:8.8}));
  for (const a of arrivalFrontages) {
    block(a.x,a.z,a.width,a.depth,a.podiumHeight,a.style,0,true).arrivalPodium=a.id;
  }

  // Ribbed structural shoulder, a hollow housing court, and two brick wings.
  const arrivalRectangles = [
    [-18,-103,18,26,9.1,3,8.8],[-19.25,-102.85,15.5,23.5,12.2,5,17.9],
    [-20.3,-102.6,12.6,19.0,12.4,3,30.1],[-21.0,-103.5,8.4,13.2,3.5,5,42.5],
    [-24.3,-78,23.4,19,4.6,2,8.8],[-25.4,-83.35,19.9,8.3,19.1,2,13.4],
    [-23.6,-72.85,17.0,8.3,14.2,4,13.4],[-26.8,-82.85,16.5,7.1,16.5,2,32.5],
    [-25.3,-73.2,13.1,6.7,19.2,3,27.6],[-27.8,-81.85,14.0,7.0,15.3,1,49],
    [-31.8,-78,5.3,12.65,12.5,3,13.4],[-30.0,-77.6,6.3,7.55,3.4,4,27.95],
    [-21.8,-52,16.15,22.7,8.7,1,8.8],[-23.1,-57.2,12.9,11.7,13.6,1,17.5],
    [-21.8,-45.9,13.7,9.8,9.4,2,17.5],[-24.0,-57.8,10.6,9.8,13.5,1,31.1],
    [-22.7,-45.6,11.2,7.8,8.6,1,26.9]
  ];
  arrivalRectangles.forEach((bounds,index)=> {
    block(...bounds,true).arrivalStructure=index<4 ? 'power-exchange' : index<12 ? 'terrace-court' : 'brick-spine';
  });

  // The camera and vehicle share these conservative hulls for the shaped wings.
  const arrivalColliders = [
    [17.4,-103,17.15,25.7,12.2,6,8.8],[18.05,-102.3,15.2,21.8,16,6,21],
    [18.6,-103.1,11.7,17.2,16.6,6,37],
    [21.8,-84.7,16.3,10.4,13.78,4,8.8],[23.7,-85.6,16,9.4,18.36,4,22.58],
    [25.9,-86.0,12.6,8.5,17.82,4,40.94],
    [22.8,-74.0,16.9,10.3,16.28,0,8.8],[24.65,-73.8,16.7,10.8,19.34,0,25.08],
    [27.35,-72.55,14.9,10.55,30.73,0,44.42],
    [24.6,-52.1,26.7,29.0,8.6,0,8.8],[25.9,-51.8,23.6,25.2,16.1,0,17.4],
    [26.9,-51.0,21.6,22.1,26.6,0,33.5]
  ];
  for (const bounds of arrivalColliders) collisionBlock(...bounds);
  const transferPassage = {from:[-19,26.7,-80.1],to:[19,26.7,-74.5],width:4.9,height:4.05};
  collisionBlock(0,-77.3,38.9,10.8,4.85,4,26.2);

  const frontages = [
    [-46,-41,17,18,18,1,'podium'], [-75,-42,21,14,25,2,'steps'],
    [-68,2,24,16,9,1,'slab'], [-85,10,14,17,19,3,'cantilever'],
    [-87,37,16,22,38,2,'steps'], [-125,28,15,20,51,2,'podium'],
    [-52,31,19,26,49,2,'twins'], [-34,36,15,14,32,1,'podium'],
    [39,31,16,22,45,0,'cantilever'], [58,44,21,21,70,4,'steps'],
    [83,15,30,21,8.85,5,'slab'], [87,-89,18,12,18,5,'slab'],
    [139,19,22,20,23,3,'steps'], [130,-60,13,25,37,5,'twins'],
    [64,-133,25,20,27,6,'steps'], [46,-83,16,21,20,3,'cantilever'],
    [-87,115,15,12,23,2,'podium'], [-43,101,15,15,14,7,'cantilever'],
    [-15,101,14,23,36,7,'twins'], [15,102,20,21,47,0,'steps'],
    [56,135,16,14,19,7,'slab'], [91,110,25,19,39,4,'podium'],
    [-44,58,18,16,53,2,'steps'], [58,69,21,16,56,4,'twins'],
    [-11,83,12,13,81,4,'steps'], [11,88,13,16,65,0,'cantilever']
  ];
  for (const geometry of frontages) tower(...geometry,true);

  // The transfer buildings have open slots where the road passes through them.
  // Each distinct volume doubles as collision, including the open portal walls.
  const portals = [
    {x:-31.5,z:skyway.west.z,w:11.5,d:16,h:66,style:2,color:0xffae77},
    {x:36.5,z:skyway.east.z,w:17.5,d:18,h:91,style:4,color:0x86ece8}
  ];
  for (const {x,z,w,d,h,style} of portals) {
    block(x,z,w,d,9.5,style,0,true);
    const opening = skyway.width+1.8, wing = (d-opening)/2;
    for (const side of [-1,1]) block(x,z+side*(opening+wing)/2,w,wing,13,style,9.5);
    const upperBlock = x < 0 ? block : collisionBlock;
    upperBlock(x,z,w,d,h*.37,style,22.5,true);
    upperBlock(x-1.4,z+.9,w*.76,d*.74,h*.23,style,22.5+h*.37,true);
    upperBlock(x+1.2,z-1.1,w*.46,d*.46,h*.17,style,22.5+h*.60,true);
  }

  const marketTerrace = {x:-61.2,z:14.5,width:13,depth:8.3};
  block(marketTerrace.x,marketTerrace.z,13,8.3,17,2,0,true);
  collisionBlock(-64.45,14.5,6.15,8.3,43,1,17,true);
  block(-57.25,14.5,4.45,8.3,58,2,17,true);
  block(-60.5,14.5,13,8.3,2.5,3,42,true);
  // The west bend needs its own silhouette even with the rest of the market
  // behind the driver. These stepped setbacks climb alongside the approach.
  block(-92.5,-43.5,11.2,14,16,1,0,true);
  collisionBlock(-94.0,-44.0,8.5,10.8,17,2,16,true);
  collisionBlock(-95.2,-46.0,6.1,8.8,18,2,33,true);
  collisionBlock(-96.0,-47.4,4.7,5.3,11,3,51,true);

  const campus = {southX:-63.5,northX:-55.8,south:62.4,north:94.5};
  block(campus.southX,campus.south,15,13,22,7,0,true);
  collisionBlock(campus.southX,campus.south,15,13,9,7,22);
  collisionBlock(campus.southX-.9,campus.south,10.8,10,39,7,31);
  block(campus.northX,campus.north,13,12,23,4,0,true);
  collisionBlock(campus.northX,campus.north,13,12,22,4,23);
  collisionBlock(campus.northX+1.8,campus.north,10.5,11,33,7,45);

  const relayTower = {x:133.3,z:-30.4};
  block(relayTower.x,relayTower.z,16.8,15.2,12.8,5,0,true);
  collisionBlock(relayTower.x,relayTower.z,10.6,10.6,43,4,12.8);
  collisionBlock(relayTower.x,relayTower.z,6.8,6.8,20,4,55.8);
  block(129.0,1.2,13.5,12,22,5,0,true);
  block(130.3,2.7,11,9.6,34,0,22,true);
  block(131.8,-14.3,6.8,29.0,3.45,0,28.9,true);
  collisionBlock(83.7,14.8,31.6,22.4,6.95,0,8.85);
  collisionBlock(86.1,16.4,20.8,14,13.1,0,15.8);
  collisionBlock(-69.6,1.8,21.2,12.8,5,1,9);
  collisionBlock(-70.0,2.5,16.0,10.6,11.8,1,14);

  const recordsVault = {x:17,z:-103};
  const transitWings = [
    {id:'split-lobby-south',x:21.8,z:-84.7},
    {id:'split-lobby-north',x:22.7,z:-74.3}
  ];
  // Each contour is [height, X radius, Z radius, X setback, Z setback].
  const shapedTowers = [
    {id:'exchange-canopy',x:24.25,z:-52,style:0,power:2.2,yaw:.055,accent:0x84ffe3,ribStride:2,skin:0x405456,
      contours:[[8.79,12.45,14.18],[10.82,12.71,14.09,.18,-.14],[13.7,12.14,13.65,.32,.05],
        [17.5,10.38,12.14,1.3,.18],[22.8,9.55,11.32,1.93,.58],[28,9.36,11.39,2.12,.83],
        [33.4,10.35,11.59,2.42,1.11],[39.4,9.74,11.26,2.83,1.07],[47.7,8.7,10.44,2.96,1.1],
        [54.2,7.72,9.0,3.03,1.27],[60.1,5.07,6.4,3.42,1.68]],
      ledges:[[10.71,.76,.98],[14.1,.53,.83],[18.23,.50,.66],[30.7,.59,1.18],[39.22,.46,.56],[48.0,.39,.75]]},
    {id:'market-lantern-hall',x:-69.75,z:1.9,style:1,power:4.35,yaw:-.02,accent:0xffaa82,ribStride:4,
      contours:[[8.95,9.72,6.08],[10.35,10.56,6.48,-.2],[13.4,10.05,6.12,-.42,.06],[14.9,8.13,5.47,-.4,.6],
        [17.8,7.51,5.20,-.35,.85],[22.4,7.08,4.88,-.35,.93],[25.8,5.02,3.89,-.12,1.00]],
      ledges:[[10.32,.54,.82],[15.1,.58,1.24],[20.5,.34,.50],[24.71,.36,.68]]},
    {id:'service-overlook',x:83,z:15,style:0,power:3.55,yaw:.11,accent:0x8beded,ribStride:2,
      contours:[[8.81,14.47,10.15],[10.4,15.80,11.1,.51,-.30],[13.8,14.95,10.54,.85,-.2],
        [15,12.58,8.95,1.55,.52],[17.3,9.80,6.72,2.85,1.43],[21,8.59,6.07,3.41,1.7],
        [25,7.88,5.73,3.61,1.98],[28.9,5.14,4.21,4.08,2.22]],
      ledges:[[10.38,.45,1.10],[14.5,.58,1.36],[18,.52,.90],[23.5,.42,.54],[26.9,.35,.68]]},
    {id:'morrow-spindle',x:36.5,z:-27.5,style:4,power:2.7,yaw:.12,accent:0x83ebe0,ribStride:4,
      contours:[[27.1,8.7,9.0],[30,9.45,9.4,-.35],[43,9.1,9.0,-.6],[57,8.05,8.65,-1.5,.35],
        [69,7.2,7.6,-1.35,.83],[81,5.85,6.35,-.2,1.1],[89,3.8,4.6,1.2,1.65],[94,2.45,2.6,1.66,1.45]],
      ledges:[[30, .60,1.1],[44,.50,.47],[58,.51,1.12],[70,.46,.66],[82,.39,.87],[90,.30,.66]]},
    {id:'campus-library',x:campus.southX,z:campus.south,style:7,power:4.1,yaw:.0,accent:0xd4eca2,ribStride:4,
      contours:[[21.96,7.2,6.4],[25,7.6,6.45,.25,.04],[33,6.5,5.85,-.50,-.26],[38,5.2,4.65,-1.15,-.5],
        [52,4.6,4.2,-1.13,-.5],[58,4.63,4.55,-1.01,-.6],[60,5.7,5.4,-.61,-.45],
        [65,5.7,5.35,-.48,-.45],[70,4.5,4.25,-.4,-.6]],
      ledges:[[24,.65,.62],[32.2,.63,1.1],[38,.49,1.32],[48,.40,.41],[60,.52,.78],[65.2,.48,.77],[70,.58,.46]]},
    {id:'north-campus-observatory',x:campus.northX,z:campus.north,style:4,power:2.35,yaw:-.12,accent:0x9faedc,ribStride:4,
      contours:[[22.98,6.35,5.9],[28,6.63,5.6],[35,6.29,5.73,.35,.05],[42,6.01,5.55,.70,.42],
        [49,5.43,5.6,.94,.6],[52,4.27,4.7,1.5,.6],[63,3.7,4.8,1.66,.4],[70,4.38,5.02,1.73,.3],
        [75,4.1,4.65,1.8,.29],[78,3.0,3.25,1.85,.2]],
      ledges:[[23.4,.58,.72],[30,.53,.94],[41,.52,.55],[49,.53,.89],[63.3,.49,.54],[70,.69,1.32],[75,.44,.83]]},
    {id:'market-west-ribbon',x:-64.45,z:14.5,style:1,power:3.1,yaw:.02,accent:0xffad86,ribStride:8,
      contours:[[16.95,3.05,4.08],[21,3.27,4.35,-.12],[36,3.0,4.16,-.19,.12],
        [44,2.9,4.05,-.19,.45],[50,2.42,3.65,-.43,.60],[57,2.43,3.68,-.43,.6],[60,1.9,2.85,-.58,.68]],
      ledges:[[18,.54,.63],[30.2,.38,.81],[42.8,.56,.55],[52,.43,.55],[59.6,.32,.46]]},
    {id:'western-terrace',x:-92.5,z:-43.5,style:2,power:3.55,yaw:-.07,accent:0xffa789,ribStride:8,
      contours:[[15.94,5.47,6.58],[19.5,5.19,6.36,-.36,-.45],[27,4.64,5.65,-.80,-.8],
        [32,4.19,5.19,-1.25,-1.03],[33,3.64,4.85,-1.65,-1.3],[42,3.38,4.39,-2.39,-2.35],
        [50,2.95,3.46,-2.90,-2.7],[54,2.6,3.1,-3.50,-2.98],[61.7,1.80,2.48,-3.8,-3.42]],
      ledges:[[16.4,.60,1.06],[22.3,.53,.72],[27.6,.39,1.12],[33,.66,1.34],[38.2,.37,.81],
        [45.7,.55,1.22],[51.7,.58,.94],[59.7,.45,.65]]},
    {id:'service-relay-core',x:relayTower.x,z:relayTower.z,style:5,power:2,yaw:.0,accent:0xa6e7dc,ribStride:4,
      contours:[[12.74,5.33,5.32],[21.5,4.62,5.15],[29,4.29,4.7],[41,3.9,4.6],
        [52,3.55,4.09],[56.42,3.5,4.0],[62,3.0,3.8],[67,3.40,3.7],[75.8,1.58,1.68]],
      ledges:[[13,.61,.64],[26.8,.43,.85],[42.3,.42,.73],[52.65,.55,.77],[61.5,.39,.92],[72,.31,.89]]}
  ];

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
  block(-18.7,48,3.35,7,15,4,0,true);
  block(18.7,48,3.35,7,15,4,0,true);
  block(0,51,36,6,13.5,4,8.5,true);
  collisionBlock((mallDeck.minX+mallDeck.maxX)/2,(mallDeck.minZ+mallDeck.maxZ)/2,
    mallDeck.maxX-mallDeck.minX,mallDeck.maxZ-mallDeck.minZ,1.15,4,mallDeck.y-1.15);
  for (const {x,z,width,depth,baseY,height} of mall.colliders)
    collisionBlock(x,z,width,depth,height,4,baseY);

  const assetPlacements = [
    ...[-66,-37,9,32].flatMap(z => [-1,1].map(side => ({id:'streetlight',x:side*(z < -42 ? 9 : 23),z,y:.06,heading:side*Math.PI/2,height:6.7}))),
    {id:'ac-stacked',x:-31,z:-46,y:0,heading:east,height:2.5},
    {id:'ac-stacked',x:38,z:21,y:0,heading:west,height:2.4},
    {id:'ac-stacked',x:-58,z:5.6,y:9.25,heading:north,height:2.5},
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
    {id:'signs',x:-70,z:-5.78,y:9.25,heading:north,height:4.8},
    {id:'signs',x:26,z:-47,y:6,heading:west,height:5.7}
  ];

  const adPlacements = [
    {id:'entry-ribs',x:0,y:10.1,z:-94.5,heading:north,width:14,height:3.0,color:'#c4ecfd'},
    {id:'entry-east-low',x:8.15,y:4.85,z:-105,heading:west,width:8.0,height:3.2,color:'#ff6e82'},
    {id:'entry-east-high',x:8.15,y:10.55,z:-104.5,heading:west,width:12,height:4.8,color:'#fdcf6c'},
    {id:'entry-west-low',x:-8.67,y:4.95,z:-104.5,heading:east,width:9.2,height:3.4,color:'#b8f4fe'},
    {id:'entry-west-column',x:-8.64,y:11.30,z:-108.15,heading:east,width:3.8,height:8.3,color:'#ff71af'},
    {id:'arrival-crown',x:13.25,y:15,z:-79,heading:west,width:12,height:6.8,color:'#ff9a80'},
    {id:'arrival-server',x:-23,y:12.2,z:-87.86,heading:north,width:18,height:7,color:'#9cd8fc'},
    {id:'arrival-vert',x:-11.2,y:8.0,z:-62,heading:east,width:3.4,height:8.0,color:'#ff93c9'},
    {id:'arrival-bridge',x:0,y:16.95,z:-64.8,heading:north,width:15,height:3.3,color:'#e0fff0'},
    {id:'plaza-west',x:-40,y:13.1,z:14.5,heading:north,width:15,height:5.6,color:'#d7abff'},
    {id:'plaza-east',x:39.8,y:16.2,z:21.2,heading:north,width:13,height:7,color:'#83f5fb'},
    {id:'market-upper',x:-74,y:11.2,z:-34.6,heading:0,width:14,height:4.3,color:'#ff8ea7'},
    {id:'service-dock',x:122,y:9.1,z:15,heading:west,width:9.2,height:4.1,color:'#ffbb62'},
    {id:'campus-mast',x:-41,y:9.3,z:94,heading:north,width:11,height:4.1,color:'#c2f9bc'},
    {id:'plaza-tower-banner',x:40,y:29.3,z:21.4,heading:north,width:6.4,height:13.4,color:'#b9fcf1'}
  ];

  const testRamp = [
    {x:72,z:-63,width:8,length:15,topStart:.14,topEnd:2.8},
    {x:72,z:-54,width:8,length:3,topStart:2.8,topEnd:2.8}
  ];
  for (const ramp of testRamp) {
    ramp.pitch = -Math.atan2(ramp.topEnd-ramp.topStart,ramp.length);
    ramp.slopeLength = Math.hypot(ramp.length,ramp.topEnd-ramp.topStart);
    ramp.centerY = (ramp.topStart+ramp.topEnd)/2 - .25*Math.cos(ramp.pitch);
  }

  const skywaySegments = skyway.levels.slice(1).map(([x2,topEnd],index) => {
    const [x1,topStart] = skyway.levels[index];
    const z=skyway.west.z, length=x2-x1;
    const pitch=-Math.atan2(topEnd-topStart,length);
    return {x1,x2,z1:z,z2:z,x:(x1+x2)/2,z,topStart,topEnd,width:skyway.width,length,pitch,yaw:east,
      slopeLength:Math.hypot(length,topEnd-topStart),centerY:(topStart+topEnd)/2-.25/Math.cos(pitch)};
  });
  const highwaySegments = [...testRamp,...skywaySegments,...branchSegments];
  const junctions=[-splitX,splitX].map(x=>[x-branchWidth/2,x+branchWidth/2]);
  function guardrail(from,to,tint,inset) {
    const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2];
    return {x:(from[0]+to[0])/2,y:(from[1]+to[1])/2,z:(from[2]+to[2])/2,
      width:.24,height:.92,length:Math.hypot(dx,dy,dz)+.05,
      pitch:-Math.atan2(dy,Math.hypot(dx,dz)),yaw:Math.atan2(dx,dz),tint,inset};
  }
  const guardrails = skywaySegments.filter(s=>Math.min(s.topStart,s.topEnd)>=.40).flatMap(segment=>
    [-1,1].flatMap(side=>{
      let spans=[[segment.x1,segment.x2]];
      if(side>0) for(const [openingStart,openingEnd] of junctions) {
        spans=spans.flatMap(([left,right])=>[
          [left,Math.min(right,openingStart)],[Math.max(left,openingEnd),right]
        ].filter(([start,end])=>end-start>.01));
      }
      const point=x=>[x,segment.topStart+(segment.topEnd-segment.topStart)*(x-segment.x1)/segment.length+
        .44/Math.cos(segment.pitch),segment.z+side*(segment.width/2-.12)];
      return spans.map(([start,end])=>guardrail(point(start),point(end),side<0 ? 0x9ef5eb : 0xffba82,side*.12));
    }));
  function branchEdge(segment,end,offset,drop=0) {
    const [nx,nz]=end ? segment.endMiter : segment.startMiter;
    return end ? [segment.x2+nx*offset,segment.topEnd-drop,segment.z2+nz*offset] :
      [segment.x1+nx*offset,segment.topStart-drop,segment.z1+nz*offset];
  }
  for(const segment of branchSegments) for(const side of [-1,1]) {
    const offset=side*(branchWidth/2-.12);
    guardrails.push(guardrail(branchEdge(segment,false,offset,-.44),branchEdge(segment,true,offset,-.44),0xffbe6d,-side*.12));
  }
  const supports = [[-80,-30.8,3.25],[-50,-31.8,10.25],[-14,-28,11.12],[14,-28,11.12],
    [56,-27.5,10.6],[75,-27.5,6.34],[92,-27.5,3.0]].map(([x,z,height]) =>
    ({x,z,y:height/2,width:1.58,depth:1.72,height}));
  const walkObstacles = [
    ...supports.map(({x,z,width:w,depth:d})=>({x,z,w,d})),
    ...testRamp.map(({x,z,width:w,length:d})=>({x,z,w,d})),
    ...skywaySegments.filter(segment=>Math.min(segment.topStart,segment.topEnd)<2.2 &&
      Math.max(segment.topStart,segment.topEnd)<4.2).map(({x,z,length:w,width:d})=>({x,z,w,d}))
  ];

  function constrainCamera(focus,eye) {
    const dx=eye.x-focus.x, dy=eye.y-focus.y, dz=eye.z-focus.z;
    const distance=Math.hypot(dx,dy,dz);
    if (distance<.52) return 1;
    const pad=.15;
    let nearest=1;
    function clip(minX,maxX,minY,maxY,minZ,maxZ,slope=0,originX=focus.x,rayX=dx,originZ=focus.z,rayZ=dz) {
      let entry=0,exit=nearest;
      const relativeY=focus.y-slope*originX, relativeDy=dy-slope*rayX;
      for (const [origin,delta,low,high] of [[originX,rayX,minX,maxX],[relativeY,relativeDy,minY,maxY],[originZ,rayZ,minZ,maxZ]]) {
        if (Math.abs(delta)<1e-6) {
          if (origin<low || origin>high) return;
          continue;
        }
        const first=(low-origin)/delta,last=(high-origin)/delta;
        entry=Math.max(entry,Math.min(first,last));
        exit=Math.min(exit,Math.max(first,last));
        if (exit<entry) return;
      }
      // A wide orbit can start against a wall. Prefer escape in that case.
      if (entry>1e-4) nearest=entry;
    }
    for (const {x,z,width,depth,baseY,height} of buildings) {
      const minX=x-width/2-pad,maxX=x+width/2+pad,minZ=z-depth/2-pad,maxZ=z+depth/2+pad;
      if (Math.max(focus.x,eye.x)<minX || Math.min(focus.x,eye.x)>maxX ||
          Math.max(focus.z,eye.z)<minZ || Math.min(focus.z,eye.z)>maxZ) continue;
      clip(minX,maxX,baseY-pad,baseY+height+pad,minZ,maxZ);
    }
    for (const {x1,x2,z,width,length,topStart,topEnd} of skywaySegments) {
      const slope=(topEnd-topStart)/length;
      const level=topStart-slope*x1;
      const trim=Math.min(topStart,topEnd)>3.5 ? 1.16 : .51;
      clip(x1-pad,x2+pad,level-trim-pad,level+pad,z-width/2-pad,z+width/2+pad,slope);
    }
    for (const s of branchSegments) {
      if (Math.max(focus.x,eye.x)<Math.min(s.x1,s.x2)-5 || Math.min(focus.x,eye.x)>Math.max(s.x1,s.x2)+5 ||
          Math.max(focus.z,eye.z)<s.z1-1 || Math.min(focus.z,eye.z)>s.z2+1) continue;
      const tx=(s.x2-s.x1)/s.length,tz=(s.z2-s.z1)/s.length;
      const fx=focus.x-s.x1,fz=focus.z-s.z1;
      const slope=(s.topEnd-s.topStart)/s.length;
      const projection=miter=>(miter[0]*tx+miter[1]*tz)*s.width/2;
      const start=Math.abs(projection(s.startMiter)),end=Math.abs(projection(s.endMiter));
      clip(-start-pad,s.length+end+pad,s.topStart-1.15-pad,s.topStart+pad,
        -s.width/2-pad,s.width/2+pad,slope,fx*tx+fz*tz,dx*tx+dz*tz,fx*tz-fz*tx,dx*tz-dz*tx);
    }
    return nearest===1 ? 1 : Math.max(.04,nearest-.45/distance);
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

  function tileWallMaterial(THREE,material,facade,surface,upperCladding) {
    if (!facade && !surface) return material;
    material.customProgramCacheKey = () => `wall:${Boolean(facade)}:${Boolean(surface)}:${Boolean(upperCladding)}`;
    material.onBeforeCompile = shader => {
      const point = 'districtPoint.xy';
      const facadeUv = `(${point} / districtPeriod)`;
      let uniforms = '';
      if (facade) {
        uniforms += 'uniform vec2 districtPeriod; uniform vec3 districtRoof;\n';
        shader.uniforms.districtPeriod = {value:new THREE.Vector2(facade.width,facade.height)};
        shader.uniforms.districtRoof = {value:new THREE.Color(facade.wall).convertSRGBToLinear().multiplyScalar(.39)};
      }
      if (surface) {
        uniforms += 'uniform sampler2D districtSurface; uniform vec2 districtSurfacePeriod;\n'
          + 'uniform vec4 districtSurfaceMix; uniform float districtSurfaceReady;\n';
        shader.uniforms.districtSurface = {value:surface.texture};
        shader.uniforms.districtSurfacePeriod = {value:new THREE.Vector2(surface.width,surface.height)};
        shader.uniforms.districtSurfaceMix = {value:new THREE.Vector4(surface.opacity,surface.fadeStart,surface.fadeEnd,surface.tint)};
        shader.uniforms.districtSurfaceReady = surface.ready;
      }
      if (upperCladding) {
        uniforms += 'uniform sampler2D masonryColor; uniform vec2 masonryPeriod;\n'
          + 'uniform vec2 masonryTone; uniform float masonryReady;\n';
        shader.uniforms.masonryColor = {value:upperCladding.texture};
        shader.uniforms.masonryPeriod = {value:new THREE.Vector2(upperCladding.width,upperCladding.height)};
        shader.uniforms.masonryTone = {value:new THREE.Vector2(upperCladding.opacity,upperCladding.tint)};
        shader.uniforms.masonryReady = upperCladding.ready;
      }
      shader.vertexShader = `varying vec4 districtPoint;\n${shader.vertexShader}`
        .replace('#include <uv_vertex>',`#include <uv_vertex>
          vec3 partSize = vec3(1.0);
          float baseHeight = modelMatrix[3].y;
          #ifdef USE_INSTANCING
            partSize = vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
            baseHeight += instanceMatrix[3].y;
          #endif
          bool isWall = abs(normal.y) < .5;
          vec2 faceSize = isWall ? vec2(abs(normal.x) > .5 ? partSize.z : partSize.x,partSize.y) : partSize.xz;
          districtPoint = vec4(uv * faceSize, baseHeight + position.y * partSize.y, isWall ? 1.0 : 0.0);`);
      shader.fragmentShader = `varying vec4 districtPoint;\n${uniforms}${shader.fragmentShader}`;
      if (facade) {
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <map_fragment>',`${THREE.ShaderChunk.map_fragment.replace('vUv',facadeUv)}
            diffuseColor.rgb = mix(districtRoof, diffuseColor.rgb, districtPoint.w);`)
          .replace('#include <emissivemap_fragment>',`${THREE.ShaderChunk.emissivemap_fragment.replace('vUv',facadeUv)}
            totalEmissiveRadiance *= districtPoint.w;`)
          .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
            roughnessFactor = mix(.92, roughnessFactor, districtPoint.w);`)
          .replace('#include <bumpmap_pars_fragment>',THREE.ShaderChunk.bumpmap_pars_fragment.replace(/\bvUv\b/g,`(${facadeUv} * 4.8)`))
          .replace('#include <normal_fragment_maps>',THREE.ShaderChunk.normal_fragment_maps
            .replace('dHdxy_fwd()', 'dHdxy_fwd() * districtPoint.w'));
      }
      if (upperCladding) {
        // Emissive alpha encodes wall material behind lit and unlit window bays.
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float masonryMask = texture2D(emissiveMap, ${facadeUv}).a * districtPoint.w;
          vec3 masonry = sRGBToLinear(texture2D(masonryColor, ${point} / masonryPeriod)).rgb;
          float finishBlend = smoothstep(5.5,12.0,districtPoint.z) * masonryMask * masonryTone.x * masonryReady;
          diffuseColor.rgb = mix(diffuseColor.rgb,masonry*masonryTone.y,finishBlend);`);
      }
      if (surface) {
        // Blend the cladding into the wall color before lighting.
        // Upper windows keep their own independent emissive pattern.
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          vec3 cladding = sRGBToLinear(texture2D(districtSurface, ${point} / districtSurfacePeriod)).rgb;
          float heightBlend = 1.0 - smoothstep(districtSurfaceMix.y,districtSurfaceMix.z,districtPoint.z);
          float claddingBlend = districtSurfaceMix.x * districtSurfaceReady * districtPoint.w * heightBlend;
          diffuseColor.rgb = mix(diffuseColor.rgb,cladding * districtSurfaceMix.w,claddingBlend);`);
      }
    };
    return material;
  }

  function facadeMaterial(THREE,style,grime,surface,upperCladding) {
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
      let shade=1, glow=0, masonry=1;
      switch (style) {
        case 0: { // Tall sections of tinted glass and narrow mullions.
          const mullion=x%16 < 2 || tileY<3;
          masonry=mullion ? 1 : 0;
          shade=mullion ? 1.23 : .29+(.38+u*.16)*(tileY/32);
          if (!mullion && occupied>.71) glow=(.26+.23*occupied)*(1-tileY/64);
          break;
        }
        case 1: { // Old masonry with deep openings and warm shop lamps.
          const row=Math.floor(y/4), brick=(x+(row%2)*6)%12;
          shade=y%4===0 || brick<1 ? .47 : .92+(row%3)*.12;
          if (tileX>=8 && tileX<24 && tileY>8 && tileY<25) {
            masonry=0;
            shade=tileX===16 || tileY===18 ? .42 : .25;
            if (occupied>.58 && tileX!==16 && tileY!==18) glow=.49+tileY*.012;
          }
          break;
        }
        case 2: { // Ribbed balcony slabs and deep, asymmetrical recesses.
          shade=tileY<4 ? 1.5 : tileY<10 ? .30 : .70;
          if (tileX>9 && tileX<27 && tileY>10 && tileY<21) {
            masonry=0;
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
          masonry=x%16<2 || y%24<2 ? 1 : 0;
          if (x%16===5 && y%12===4 && occupied>.23) glow=.93;
          if (x%32<3 && y%39>8 && y%39<34 && occupied>.47) glow=.28;
          break;
        }
        case 5: { // Greasy roller shutters, rivets, and amber vents.
          shade=.61+(y%5)*.14;
          if (tileX===1 || tileY===1) shade=.42;
          if (tileY>24 && tileX>5 && tileX<27) {
            masonry=0;
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
          masonry=frame ? 1 : 0;
          shade=frame ? 1.25 : .22+(tileY%9)*.06;
          if (!frame && tileX%11!==0 && occupied>.54) glow=.45;
          break;
        }
      }
      diffuse.set([wall.r*shade*grain*corrosion*255,wall.g*shade*grain*255,wall.b*shade*grain*255,255],i);
      emission.set([light.r*glow*255,light.g*glow*255,light.b*glow*255,masonry*255],i);
    }
    const material = new THREE.MeshStandardMaterial({map:repeatedTexture(THREE,diffuse,size),
      emissiveMap:repeatedTexture(THREE,emission,size),emissive:0xffffff,emissiveIntensity:1.1,
      roughness:facade.roughness,metalness:.21,bumpMap:grime,bumpScale:.045});
    // Repeat every tile in world metres so one material fits buildings of different sizes.
    return tileWallMaterial(THREE,material,facade,surface,upperCladding);
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

  const contourSides = 32;
  function contourPoint(tower, [y, radiusX, radiusZ, shiftX=0, shiftZ=0], sector) {
    const angle=sector/contourSides*2*Math.PI;
    const c=Math.cos(angle),s=Math.sin(angle),round=2/tower.power;
    const profileX=Math.sign(c)*Math.abs(c)**round,profileZ=Math.sign(s)*Math.abs(s)**round;
    const px=profileX*radiusX,pz=profileZ*radiusZ;
    const yawCos=Math.cos(tower.yaw), yawSin=Math.sin(tower.yaw);
    return [tower.x+shiftX+px*yawCos+pz*yawSin,y,tower.z+shiftZ-px*yawSin+pz*yawCos];
  }

  function contourAt(tower, y, extend=0) {
    const rings=tower.contours;
    let next=rings.findIndex(([height])=>height>=y);
    if (next<0) next=rings.length-1;
    const a=rings[Math.max(0,next-1)], b=rings[next];
    const mix=a===b ? 0 : Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0])));
    const value=i=>(a[i]||0)+((b[i]||0)-(a[i]||0))*mix;
    return [y,value(1)+extend,value(2)+extend,value(3),value(4)];
  }

  function contourGeometry(THREE,tower,sections,uPeriod,vPeriod,closed) {
    const positions=[], uv=[], indices=[], seams=[];
    // Use one circumference for every level. Recomputing it at each setback
    // shears window columns as the wall tapers.
    const reference=tower.contours[0];
    const arc=[0];
    let prior=contourPoint(tower,reference,0);
    for (let i=1;i<=contourSides;i++) {
      const next=contourPoint(tower,reference,i);
      arc.push(arc[i-1]+Math.hypot(next[0]-prior[0],next[2]-prior[2]));
      prior=next;
    }
    const circumference=arc.at(-1);
    const tiles=Math.max(1,Math.round(circumference/uPeriod));
    function append(point,u,v) {
      const index=positions.length/3;
      positions.push(...point);
      uv.push(u,v);
      return index;
    }
    function cap(ring,upper) {
      const [y,,,x=0,z=0]=ring;
      const middle=append([tower.x+x,y,tower.z+z],.5,.5);
      for (let i=0;i<contourSides;i++) {
        const a=append(contourPoint(tower,ring,i),0,0);
        const b=append(contourPoint(tower,ring,i+1),1,1);
        indices.push(middle,upper ? b : a,upper ? a : b);
      }
    }
    for (const section of sections) {
      let previousStart=-1;
      for (const ring of section) {
        const start=positions.length/3;
        for (let i=0;i<=contourSides;i++) {
          const point=contourPoint(tower,ring,i);
          append(point,arc[i]*tiles/circumference,ring[0]/vPeriod);
          if (i<contourSides && previousStart>=0) {
            const a=previousStart+i, b=start+i;
            indices.push(a,b,a+1,b,b+1,a+1);
          }
        }
        seams.push([start,start+contourSides]);
        previousStart=start;
      }
      if (closed) {
        cap(section[0],false);
        cap(section.at(-1),true);
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const normal=geometry.attributes.normal;
    const blend=new THREE.Vector3(), other=new THREE.Vector3();
    for (const [a,b] of seams) {
      blend.fromBufferAttribute(normal,a).add(other.fromBufferAttribute(normal,b)).normalize();
      normal.setXYZ(a,blend.x,blend.y,blend.z);
      normal.setXYZ(b,blend.x,blend.y,blend.z);
    }
    return geometry;
  }

  function addArrivalDetails(materials,instance,beam,glass,litGlass) {
    // Raking buttresses wrap both side returns and hold the exchange shoulder.
    for (const z of [-114.75,-103.75,-100.1,-94.65,-91.45]) {
      beam('portfolio-power-exchange-buttresses',materials.steel,[-8.94,8.91,z],[-9.32,16.7,z],.78,.71);
      beam('portfolio-power-exchange-buttresses',materials.steel,[-9.32,16.7,z],[-11.04,30.18,z],.68,.54);
      instance('portfolio-power-exchange-couplings',materials.copper,-8.90,12.32,z,.46,.77,1.14);
      instance('portfolio-power-exchange-buttress-markers',materials.light,-8.65,12.30,z,.056,.16,.53,0,0xfeb087);
    }
    for (const side of [-1,1]) {
      const z=-103+side*12.90;
      for (const x of [-26.0,-21.9,-17.1,-12.2]) beam('portfolio-power-exchange-buttresses',materials.steel,
        [x,9.0,z],[x-.68,26.1,z-side*1.62],.68,.47);
      for (const y of [9.82,16.92,23.6]) instance('portfolio-power-exchange-couplings',materials.copper,-18.8,y,z,15.4,.37,.51);
    }

    // Real balcony decks partly surround the exposed west housing court.
    for (const [x,z,y,w,d,accent] of [
      [-13.21,-77.9,13.01,6.31,16.2,0xffb87d],[-15.91,-82.05,21.4,3.5,8.05,0xffc18e],
      [-15.47,-73.1,25.9,3.39,7.0,0xa0d8ef],[-18.16,-82.6,32.7,4.14,8.1,0xeea47d],
      [-13.42,-49.7,9.16,5.54,14.2,0xcde88b],[-16.24,-56.9,17.64,4.30,10.65,0xffab84],
      [-14.88,-45.8,19.02,4.22,8.65,0xd99581],[-17.21,-45.9,27.12,4.50,9.2,0xffa884],
      [-18.62,-57.25,31.28,5.59,11.65,0xeac89f]
    ]) {
      const roadX=x+w/2-.16;
      instance('portfolio-arrival-terrace-decks',materials.steel,x,y,z,w,.39,d);
      instance('portfolio-arrival-terrace-fascia',materials.copper,roadX,y,z,.24,.44,d+.13);
      instance('portfolio-arrival-terrace-lights',materials.light,roadX+.14,y-.09,z,.055,.084,d*.69,0,accent);
      instance('portfolio-arrival-terrace-fascia',materials.copper,roadX,y+1.1,z,.119,.126,d);
      for (let rail=-d/2+.17;rail<d/2;rail+=1.7) instance('portfolio-arrival-terrace-fascia',materials.copper,
        roadX,y+.62,z+rail,.10,1.0,.10);
      for (const end of [-1,1]) instance('portfolio-arrival-terrace-fascia',materials.copper,x,y+1.1,z+end*d/2,w,.126,.136);
      if (w>4.5) {
        instance('portfolio-arrival-terrace-equipment',materials.steel,roadX-.91,y+.50,z+d*.33,.85,.59,1.68);
        instance('portfolio-arrival-terrace-equipment',materials.steel,roadX-.74,y+.48,z-d*.31,.53,.56,.76);
      }
    }

    for (const volume of buildings) {
      const {arrivalStructure:id,x,z,width,depth,baseY,height} = volume;
      if (!id || height<6.7) continue;
      const housing=id!=='power-exchange';
      const storyStep=housing ? 3.05 : 4.35;
      for (let y=baseY+2.0,story=0;y<baseY+height-1.25;y+=storyStep,story++) {
        for (const alongZ of [true,false]) for (const side of [-1,1]) {
          const span=alongZ ? depth : width;
          const count=Math.max(2,Math.floor(span/(housing ? 3.05 : 4.25)));
          const spacing=span/(count+1);
          for (let k=1;k<=count;k++) {
            if ((k+story*3+Math.round(width)+side)%7===3) continue;
            const along=-span/2+k*spacing;
            const wx=x+(alongZ ? side*(width/2+.115) : along);
            const wz=z+(alongZ ? along : side*(depth/2+.115));
            if (id==='power-exchange' && wx>-9.4 && wz>-111.45 && wz<-104.6 && y<16.4) continue;
            if (id==='terrace-court' && !alongZ && wz<-87.38 && y<16.25) continue;
            const yaw=alongZ ? Math.PI/2 : 0;
            const w=spacing*(housing ? .73 : .64),h=housing ? 1.23 : 2.23;
            const material=(k*3+story+side)%5<1 ? litGlass : glass;
            instance(material===glass ? 'portfolio-court-windows' : 'portfolio-court-windows-lit',material,wx,y,wz,w,h,.18,yaw);
            instance('portfolio-court-window-reveals',materials.steel,wx,y-h*.58,wz,w+.31,.17,.44,yaw);
            instance('portfolio-court-window-reveals',materials.steel,wx,y+h*.56,wz,w+.23,.12,.26,yaw);
            if (housing) instance('portfolio-court-window-reveals',materials.steel,wx,y,wz,.062,h+.068,.19,yaw);
          }
        }
      }
    }

    // Connect both older catwalks to their updated wall envelopes.
    for (const [x,z,y,w] of [[-10.53,-92,17.44,2.88],[11.10,-92,17.44,3.68],[-13.34,-63,18.54,3.8],[13.89,-63,18.54,5.04]]) {
      instance('portfolio-catwalk-landings',materials.steel,x,y,z,w,.46,2.12);
      for (const side of [-1,1]) instance('portfolio-catwalk-landing-edges',materials.copper,x,y+.68,z+side*1.01,w,.137,.13);
    }
  }

  function addTransferPassage(materials,instance,beam,glass) {
    const {from,to,width,height}=transferPassage;
    const [fx,y,fz]=from,[tx,,tz]=to;
    const dx=tx-fx,dz=tz-fz,length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);
    const px=dz/length,pz=-dx/length;
    const locate=(t,side,dy)=>[fx+dx*t+px*side,y+dy,fz+dz*t+pz*side];
    const [x,,z]=locate(.5,0,0);
    instance('portfolio-high-transfer-deck',materials.steel,x,y-.20,z,width,.60,length,yaw);
    instance('portfolio-high-transfer-roof',materials.underside,x,y+height+.16,z,width+.61,.54,length,yaw);
    for (const side of [-1,1]) {
      const outer=side*(width/2-.09);
      for (const rise of [.29,height-.22]) beam('portfolio-high-transfer-girder',materials.copper,
        locate(0,outer,rise),locate(1,outer,rise),.39,.36);
      beam('portfolio-high-transfer-girder',materials.steel,
        locate(.012,outer*.85,-.59),locate(.986,outer*.85,-.59),.39,.56);
      beam('portfolio-high-transfer-lighting',materials.light,
        locate(.045,outer*1.04,.09),locate(.955,outer*1.04,.09),.079,.089,side<0 ? 0xffb36d : 0x8cffe7);
      for (let i=0;i<10;i++) {
        const a=(i+.08)/10,b=(i+.94)/10;
        const [gx,gy,gz]=locate((a+b)/2,outer*.94,1.91);
        instance('portfolio-high-transfer-glazing',glass,gx,gy,gz,.19,2.76,length*(b-a),yaw);
        beam('portfolio-high-transfer-girder',materials.metal,locate(a,outer,.39),locate(a,outer,height-.27),.24,.34);
        const climb=i%2===0;
        beam('portfolio-high-transfer-girder',materials.metal,
          locate(a,outer*1.018,climb ? .45 : height-.23),locate(b,outer*1.018,climb ? height-.23 : .45),.28,.28);
        if (i%3!==2) beam('portfolio-high-transfer-lighting',materials.light,locate(a,outer*.91,height-.56),
          locate(b,outer*.91,height-.56),.071,.082,0xa2ebd2);
      }
    }
    for (const t of [.04,.15,.29,.45,.61,.77,.91,.98]) {
      beam('portfolio-high-transfer-girder',materials.metal,
        locate(t,-width/2,-.52),locate(t,width/2,-.52),.23,.29);
    }
    for (const t of [0,1]) {
      const [lx,ly,lz]=locate(t,0,0);
      instance('portfolio-high-transfer-sockets',materials.steel,lx,ly+1.98,lz,width+1.40,height+.72,2.7,yaw);
      instance('portfolio-high-transfer-lighting',materials.light,lx,ly+height*.72,lz+2.35,.10,.105,width*1.09,0,0xffc397);
    }
  }

  function addSculptedTowers(THREE,world,facadeMaterials,materials,instance,beam,grime) {
    const ledgeMaterial=new THREE.MeshStandardMaterial({color:0x283139,metalness:.36,roughness:.58});
    const curtainMaterials=new Map();
    function curtain(style) {
      if (!curtainMaterials.has(style)) {
        const source=facadeMaterials[style];
        curtainMaterials.set(style,new THREE.MeshStandardMaterial({map:source.map,emissiveMap:source.emissiveMap,
          emissive:0xc9d9e8,emissiveIntensity:.80,roughness:source.roughness,metalness:.24}));
      }
      return curtainMaterials.get(style);
    }
    function shell(tower,name,sections,material,closed) {
      const {width,height}=facades[tower.style];
      const mesh=new THREE.Mesh(contourGeometry(THREE,tower,sections,width,height,closed),material);
      mesh.name='portfolio-'+tower.id+'-'+name;
      mesh.userData.portfolioAuditSolid = true;
      world.add(mesh);
    }

    instance('portfolio-transfer-round-base',materials.steel,36.5,24.82,-27.5,17.5,4.64,18);
    underwriting?.attach(THREE,world,{tower:recordsVault,materials,instance,beam});
    sublight?.attach(THREE,world,{towers:transitWings,materials,instance,beam,grime});
    for (const tower of shapedTowers) {
      if (tower.id==='exchange-canopy' && exchange) {
        exchange.attach(THREE,world,{tower,materials,instance,beam,grime,
          point:(y,sector,extend=0)=>contourPoint(tower,contourAt(tower,y,extend),sector),
          shell:(profile,name,belts,material,group)=>{
            const plates=belts.map(([y,h,reach])=>[contourAt(profile,y-h/2,reach*.91),contourAt(profile,y+h/2,reach)]);
            const mesh=new THREE.Mesh(contourGeometry(THREE,profile,plates,1,1,true),material);
            mesh.name='portfolio-'+profile.id+'-'+name;
            mesh.userData.portfolioAuditSolid=true;
            group.add(mesh);
          }
        });
        continue;
      }
      const finish=tower.skin ? new THREE.MeshStandardMaterial({color:tower.skin,bumpMap:grime,bumpScale:.088,
        roughness:.75,metalness:.13}) : curtain(tower.style);
      shell(tower,'facade',[tower.contours],finish,false);
      const top=tower.contours.at(-1)[0];
      const racks=[...tower.ledges,[top+.17,.34,.24]];
      const plates=racks.map(([height,thickness,extend])=>[
        contourAt(tower,height-thickness/2,extend*.84),contourAt(tower,height+thickness/2,extend)
      ]);
      shell(tower,'terraces',plates,ledgeMaterial,true);

      const minY=tower.contours[0][0];
      for (let sector=0;sector<contourSides;sector+=tower.ribStride) {
        for (let i=1;i<tower.contours.length;i++) {
          const [lower]=tower.contours[i-1], [upper]=tower.contours[i];
          const start=Math.max(lower,minY+.34), end=Math.min(upper,top-.06);
          if (end-start<.30) continue;
          beam('portfolio-architecture-frames',materials.metal,
            contourPoint(tower,contourAt(tower,start,.09),sector),contourPoint(tower,contourAt(tower,end,.09),sector),.28,.24);
        }
      }
      for (const [height,thickness,extend] of tower.ledges) {
        if (extend<.75) continue;
        const trim=contourAt(tower,height+thickness/2+.04,extend*.90);
        const lighting=contourAt(tower,height-.12,extend+.06);
        for (let i=0;i<contourSides;i+=2) {
          const a=contourPoint(tower,trim,i), b=contourPoint(tower,trim,i+2);
          beam('portfolio-architecture-rails',materials.metal,[a[0],a[1]+.84,a[2]],[b[0],b[1]+.84,b[2]],.095,.099);
          instance('portfolio-architecture-rails',materials.metal,a[0],a[1]+.37,a[2],.085,.83,.085);
          if (i%8<4) beam('portfolio-architecture-ledge-lights',materials.light,
            contourPoint(tower,lighting,i),contourPoint(tower,lighting,i+2),.085,.11,tower.accent);
        }
      }
      const [,rx,rz,xShift=0,zShift=0]=tower.contours.at(-1);
      const x=tower.x+xShift, z=tower.z+zShift;
      if (tower.id!=='service-relay-core') {
        instance('portfolio-architecture-roof-plant',materials.steel,x,top+.97,z,rx*.93,1.5,rz*.94,tower.yaw);
        instance('portfolio-architecture-roof-plant',materials.metal,x-rx*.42,top+2.4,z+.37,.54,4.4,.58);
        instance('portfolio-architecture-roof-markers',materials.light,x-rx*.42,top+4.63,z+.37,.23,.13,.23,0,0xf77d60);
      }
    }
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
      underside:new THREE.MeshStandardMaterial({color:surfaceColor(0x48505c),roughness:.73,emissive:0x1b2432,emissiveIntensity:.22}),
      paint:new THREE.MeshBasicMaterial({color:surfaceColor(0x667a89),toneMapped:false}),
      light:new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false})
    };
    const batches = new Map();
    function instance(name,material,x,y,z,w,h,d,yaw=0,color=null,pitch=0) {
      if (!batches.has(name)) batches.set(name,{material,list:[]});
      batches.get(name).list.push({x,y,z,w,h,d,yaw,color,pitch});
    }
    function beam(name,material,from,to,width,height,color=null) {
      const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2];
      instance(name,material,(from[0]+to[0])/2,(from[1]+to[1])/2,(from[2]+to[2])/2,
        width,height,Math.hypot(dx,dy,dz),Math.atan2(dx,dz),color,-Math.atan2(dy,Math.hypot(dx,dz)));
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
          strengths.push(g.strength*(wetReflections ? .61 : 1));
        }
      }
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      geometry.setAttribute('strength',new THREE.Float32BufferAttribute(strengths,1));
      const material = new THREE.ShaderMaterial({
        vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
        vertexShader:`attribute float strength; varying vec2 vUv; varying vec3 tint; varying float power;
          void main(){vUv=uv; tint=color; power=strength; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`varying vec2 vUv; varying vec3 tint; varying float power;
          void main(){vec2 p=abs(vUv-.5)*2.; float edge=(1.-smoothstep(.1,1.,p.x))*(1.-smoothstep(.16,1.,p.y));
          gl_FragColor=vec4(tint,edge*power*.43);}`
      });
      const reflection = new THREE.Mesh(geometry,material);
      reflection.name = 'portfolio-pavement-reflections';
      world.add(reflection);
    }

    function sign(x,y,z,w,h,heading,head,caption,color,{poleSpan=0,bracket=false}={}) {
      const texture = signTexture(THREE,head,caption,color);
      const panel = new THREE.MeshBasicMaterial({map:texture,color:texture ? 0xffffff : color, toneMapped:false});
      const depth=Math.min(.48,.22+h*.059);
      const housing=new THREE.BoxGeometry(w,h,depth);
      housing.clearGroups();
      housing.addGroup(0,24,0);
      housing.addGroup(24,12,1);
      const mesh = new THREE.Mesh(housing,[materials.steel,panel]);
      mesh.name = 'portfolio-sign';
      mesh.userData.portfolioAdFace = true;
      mesh.userData.portfolioAdId = head.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'@'+x+','+z;
      mesh.position.set(x,y,z);
      mesh.rotation.y = heading;
      world.add(mesh);
      for (const direction of [-1,1]) instance('portfolio-sign-lips',materials.metal,
        x,y+direction*(h/2+.026),z,w+.18,.105,depth+.11,heading);
      if (poleSpan) {
        const rightX=Math.cos(heading),rightZ=-Math.sin(heading),height=y-h/2+.2;
        for (const side of [-1,1]) instance('portfolio-sign-poles',materials.metal,
          x+rightX*side*poleSpan/2,height/2,z+rightZ*side*poleSpan/2,.24,height,.24);
        instance('portfolio-sign-lips',materials.metal,x,height-.14,z,poleSpan+.25,.26,.24,heading);
      }
      if (bracket) instance('portfolio-sign-lips',materials.metal,
        x-Math.sin(heading)*depth*.75,y-h*.34,z-Math.cos(heading)*depth*.75,w*.84,.23,depth*1.28,heading);
      return mesh;
    }

    instance('portfolio-foundation',materials.foundation,0,.004,0,edge*2,.008,edge*2);
    const streets=globalThis.DrivePortfolioStreets;
    if (streets) streets.build(THREE,world,{roads:networkRoads,areas:pavedAreas,asphalt:materials.asphalt,curb:materials.concrete,
      buildings,obstacles:walkObstacles,publicSpaces:globalThis.DrivePortfolioPublicSpaces?.footprints,cacheLayout:true});
    for (const street of networkRoads) {
      const angle = Math.atan2(street.x2-street.x1,street.z2-street.z1);
      const x=(street.x1+street.x2)/2, z=(street.z1+street.z2)/2;
      if (!streets) {
        instance('portfolio-curbs',materials.concrete,x,.016,z,street.width+2,.026,street.length+2,angle);
        instance('portfolio-streets',materials.asphalt,x,.035,z,street.width,.018,street.length+1,angle);
      }
      const dx=Math.sin(angle), dz=Math.cos(angle);
      for (let along=-street.length/2+9; along<street.length/2-9; along+=11) {
        const px=x+dx*along, pz=z+dz*along;
        if (Math.abs(px-plaza.x)<plaza.w/2 && Math.abs(pz-plaza.z)<plaza.d/2) continue;
        if (networkRoads.some(other=>other!==street&&distanceToCenter(px,pz,other)<other.width/2+2)) continue;
        instance('portfolio-lanes',materials.paint,px,.05,pz,.14,.01,3.5,angle);
      }
    }
    if (!streets) for (const a of pavedAreas) instance('portfolio-plazas',materials.asphalt,a.x,.058,a.z,a.w,.022,a.d);
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

    const loader = typeof document === 'undefined' ? null : new THREE.TextureLoader();
    const wallTextures = [];
    let disposed = false;
    function loadWallTexture(file,{width,height,opacity,fadeStart=3.5,fadeEnd=7.5,tint}) {
      if (!loader) return null;
      const ready = {value:0};
      const texture = loader.load(driveBase+'assets/portfolio-type/'+file,loaded => {
        if (disposed) loaded.dispose();
        else ready.value = 1;
      });
      texture.name = file;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
      wallTextures.push(texture);
      return {texture,ready,width,height,opacity,fadeStart,fadeEnd,tint};
    }
    const grime = loader?.load(driveBase+'assets/portfolio/concrete-bump.jpg') || null;
    if (grime) grime.wrapS = grime.wrapT = THREE.RepeatWrapping;
    const boardConcrete = loadWallTexture('board-concrete.webp',{width:2.8,height:2.3,opacity:.88,tint:.66});
    const servicePanels = loadWallTexture('service-panels.webp',{
      width:4.8,height:3.7,opacity:.81,fadeStart:7.5,fadeEnd:15,tint:.74
    });
    const marketTile = loadWallTexture('market-tile.webp',{width:1.85,height:1.15,opacity:.89,tint:.68});
    const concreteFooting = tileWallMaterial(THREE,
      new THREE.MeshStandardMaterial({color:surfaceColor(0x44434a),roughness:.91}),null,boardConcrete);
    const marketFooting = tileWallMaterial(THREE,
      new THREE.MeshStandardMaterial({color:surfaceColor(0x554947),roughness:.68}),null,marketTile);
    const facadeMaterials = facades.map((_,style) => facadeMaterial(THREE,style,grime,
      style===3 || style===5 ? servicePanels : null));
    const brick = loadWallTexture('terrace-brick.webp',{width:2.65,height:2.2,opacity:.76,tint:.8});
    const stone = loadWallTexture('cast-stone.webp',{width:4.2,height:3.7,opacity:.68,tint:.41});
    const titanium = loadWallTexture('ribbed-titanium.webp',{width:3.6,height:5.0,opacity:.74,tint:1.0});
    const upperCladding = [null,brick,stone,titanium,null,titanium,stone,stone];
    const cladFacadeMaterials = upperCladding.map((finish,style) => finish &&
      facadeMaterial(THREE,style,grime,style===3 || style===5 ? servicePanels : null,finish));
    const arrivalFinishes=[titanium,brick,stone,servicePanels,stone,titanium,boardConcrete];
    const arrivalWallColors=[0x424b50,0x4c3533,0x505357,0x383743,0x494e54,0x343b41,0x524947];
    const quietArrivalMaterials=arrivalWallColors.map((color,style)=>tileWallMaterial(THREE,
      new THREE.MeshStandardMaterial({color:surfaceColor(color),roughness:.86,metalness:.1}),null,arrivalFinishes[style]));
    for (const [index,b] of buildings.entries()) {
      if (b.collisionOnly) continue;
      const {name,light:color}=facades[b.style];
      const arrival = Math.abs(b.x)<28 && b.z<-36;
      const finish = !arrival && b.detail && cladFacadeMaterials[b.style];
      const quietArrival=b.arrivalPodium || b.arrivalStructure;
      const placement=b.arrivalPodium ? 'portfolio-arrival-podium-'+b.arrivalPodium :
        b.arrivalStructure ? 'portfolio-arrival-upper-'+name : 'portfolio-building-'+name+(finish ? '-clad' : '');
      instance(placement,quietArrival ? quietArrivalMaterials[b.style] : finish || facadeMaterials[b.style],
        b.x,b.baseY+b.height/2,b.z,b.width,b.height,b.depth);
      const detailed = !quietArrival && b.detail && b.width > 3;
      if (detailed && !b.baseY) {
        const tiledMarket = b.style===1 || (b.style===2 && b.x<0 && b.z<55);
        const footingName = tiledMarket ? 'portfolio-market-tile-footings' : 'portfolio-board-concrete-footings';
        instance(footingName,tiledMarket ? marketFooting : concreteFooting,b.x,1.1,b.z,b.width+.16,2.2,b.depth+.18);
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
      instance('portfolio-roofs',materials.steel,b.x,roof+.115,b.z,b.width+.11,.29,b.depth+.11);
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

    const arrivalGlass=new THREE.MeshStandardMaterial({color:surfaceColor(0x709093),roughness:.41,metalness:.23,
      emissive:0x42676a,emissiveIntensity:.29});
    const occupiedGlass=new THREE.MeshStandardMaterial({color:surfaceColor(0x9a897e),roughness:.47,
      emissive:0xb49a83,emissiveIntensity:.28});
    addArrivalDetails(materials,instance,beam,arrivalGlass,occupiedGlass);
    addTransferPassage(materials,instance,beam,arrivalGlass);
    addSculptedTowers(THREE,world,facadeMaterials,materials,instance,beam,grime);

    for (const segment of testRamp) {
      instance('portfolio-ramp',materials.metal,segment.x,segment.centerY,segment.z,segment.width,.5,segment.slopeLength,0,null,segment.pitch);
      for (const side of [-1,1]) {
        instance('portfolio-neon',materials.light,segment.x+side*(segment.width*.5-.09),
          (segment.topStart+segment.topEnd)/2+.03,segment.z,.15,.05,segment.slopeLength,0,0xff9858,segment.pitch);
      }
    }

    // The through road changes grade beside the market and service streets,
    // holds level through the transfer towers, then drops back to the ring road.
    const skywayAsphalt=materials.asphalt.clone();
    for (const segment of skywaySegments) {
      const {x,z,width,pitch,yaw,slopeLength,centerY,topStart,topEnd}=segment;
      const top=(topStart+topEnd)/2;
      instance('portfolio-skyway-deck',skywayAsphalt,x,centerY,z,width,.5,slopeLength+.035,yaw,null,pitch);
      if (Math.min(topStart,topEnd)>3.5) {
        instance('portfolio-skyway-underframe',materials.underside,x,top-.75,z,width*.94,.78,slopeLength+.045,yaw,null,pitch);
        for (const side of [-1,1]) instance('portfolio-skyway-fascia',materials.metal,x,top-.28,z+side*(width/2+.11),.21,.79,slopeLength+.04,yaw,null,pitch);
        for (let u=2.3;u<segment.length-1;u+=4.6) {
          const xx=segment.x1+u, yy=topStart+(topEnd-topStart)*u/segment.length-1.17;
          instance('portfolio-skyway-underframe-ribs',materials.metal,xx,yy,z,.21,.13,width*.92,0,null,0);
          for (const side of [-1,1]) instance('portfolio-skyway-underside-lamps',materials.light,
            xx,yy-.091,z+width*side*.34,1.22,.075,.135,0,side<0 ? 0xf9a683 : 0xb0fae9,-pitch);
        }
      }
      for (let u=2.4;u<segment.length-1;u+=6.0) instance('portfolio-skyway-markings',materials.paint,
        segment.x1+u,topStart+(topEnd-topStart)*u/segment.length+.021,z,.13,.014,2.25,yaw,null,pitch);
    }
    const deckPositions=[],deckUvs=[],undersidePositions=[];
    for (const route of branchRoutes) for (const [index,segment] of route.entries()) {
      const {width,topStart,topEnd,x1,x2,z1,z2,length}=segment;
      const points=[
        branchEdge(segment,false,-width/2),branchEdge(segment,false,width/2),
        branchEdge(segment,true,width/2),branchEdge(segment,true,-width/2)
      ];
      for(const corner of [0,3,1,1,3,2]) {
        const [x,y,z]=points[corner];
        deckPositions.push(x,y,z);
        deckUvs.push(x/8,z/8);
      }
      for(const corner of [0,1,3,1,2,3]) {
        const [x,y,z]=points[corner];
        undersidePositions.push(x,y-1.05,z);
      }
      for (const side of [-1,1]) {
        const offset=side*(width/2-.05);
        beam('portfolio-sky-mall-fascia',materials.steel,
          branchEdge(segment,false,offset,.47),branchEdge(segment,true,offset,.47),.13,.95);
        beam('portfolio-sky-mall-fascia-light',materials.light,
          branchEdge(segment,false,side*(width/2+.04),.59),branchEdge(segment,true,side*(width/2+.04),.59),.042,.061,0xffb468);
        if (index%2===1) beam('portfolio-sky-mall-cross-braces',materials.metal,
          branchEdge(segment,false,offset,.96),branchEdge(segment,true,-offset,1.03),.19,.24);
      }
      const yaw=Math.atan2(x2-x1,z2-z1),pitch=-Math.atan2(topEnd-topStart,length);
      instance('portfolio-skyway-markings',materials.paint,segment.x,(topStart+topEnd)/2+.022,segment.z,
        .14,.018,Math.min(2.15,length*.67),yaw,null,pitch);
    }
    for(const [name,positions,material] of [
      ['portfolio-sky-mall-approach-decks',deckPositions,skywayAsphalt],
      ['portfolio-sky-mall-approach-underside',undersidePositions,materials.underside]
    ]) {
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      if (positions===deckPositions) geometry.setAttribute('uv',new THREE.Float32BufferAttribute(deckUvs,2));
      geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,material);
      mesh.name=name;
      world.add(mesh);
    }
    for (const rail of guardrails) {
      const {x,y,z,width,height,length,yaw,pitch,tint,inset}=rail;
      instance('portfolio-skyway-rails',materials.steel,x,y,z,width,height,length,yaw,null,pitch);
      instance('portfolio-skyway-edge-lights',materials.light,x+Math.cos(yaw)*inset,y-.30,z-Math.sin(yaw)*inset,
        .045,.053,length,yaw,tint,pitch);
      instance('portfolio-skyway-rail-cap',materials.metal,x,y+.41,z,width+.05,.11,length,yaw,null,pitch);
    }
    for (const support of supports) {
      const {x,y,z,width,height,depth}=support;
      instance('portfolio-skyway-piers',materials.steel,x,y,z,width,height,depth);
      instance('portfolio-skyway-pier-caps',materials.metal,x,height-.20,z,1.75,.44,2.4);
      beam('portfolio-skyway-braces',materials.metal,[x,height-1.9,z],[x,height,skyway.west.z],.57,.52);
      if (height>6) instance('portfolio-skyway-pier-lights',materials.light,x,1.58,z-.872,.128,2.4,.053,0,0xf98865);
    }
    const skywayZ=skyway.west.z;
    for (const side of [-1,1]) {
      const x=side*splitX;
      sign(x,16.35,-18.55,5.3,1.13,side*east,'AERIE ARCADE','SKY MALL',0xffcc86,{bracket:true});
      for (const offset of [-.43,.43]) beam('portfolio-sky-mall-turn-marks',materials.light,
        [x+offset,11.533,-25.05],[x,11.533,-24.42],.14,.015,0xffc37d);
      instance('portfolio-sky-mall-turn-marks',materials.light,x,11.533,-25.23,.135,.015,1.38,0,0xffc37d);
    }
    sign(0,12.0,skywayZ-4.91,9.4,1.27,north,'SKYWAY','UPPER LEVEL',0xa1eadf,{bracket:true});
    sign(-100,4.55,skywayZ-7.0,5.6,1.72,west,'SKYWAY WEST','SERVICE DISTRICT',0xffbf81,{poleSpan:3.4});
    sign(104,4.55,skywayZ+7.0,5.6,1.72,east,'SKYWAY EAST','NIGHT MARKET',0x88f1e8,{poleSpan:3.4});
    for (const {x,z,w,color} of portals) {
      for (const side of [-1,1]) {
        const mouthX=x+side*(w/2+.065);
        for (const frameSide of [-1,1]) {
          instance('portfolio-skyway-portal-rims',materials.metal,mouthX,16.3,z+frameSide*5.19,.48,10.3,.41);
          instance('portfolio-skyway-portal-lights',materials.light,mouthX+side*.275,16.3,z+frameSide*5.19,.06,9.2,.10,0,color);
        }
        instance('portfolio-skyway-portal-rims',materials.metal,mouthX,21.40,z,.50,.43,10.8);
        instance('portfolio-skyway-portal-lights',materials.light,mouthX+side*.28,21.33,z,.065,.075,10.3,0,color);
        const signHeading=side*east;
        sign(mouthX+side*.34,23.95,z,8.9,1.88,signHeading,x<0 ? 'CANOPY WORKS' : 'MORROW TRANSFER','SKYWAY',color,{bracket:true});
      }
      for (let dx=-w/2+1.2;dx<w/2;dx+=4.8) instance('portfolio-skyway-tunnel-lamps',materials.light,x+dx,22.36,z,.26,.09,9.38,0,color);
    }

    // Exterior floors and diagonal fins give the portal towers distinct profiles
    // above the openings, and keep floors legible from the plaza below.
    for (const {x,z,w,d,h,color} of portals) {
      const front=z+d/2+.13;
      for (const side of [-1,1]) {
        const startX=x+side*(w/2-.38);
        const tipX=x+side*w*.19;
        beam('portfolio-transfer-rakers',materials.metal,[startX,23.2,front],[tipX,h-1,front-3.22],.59,.73);
        beam('portfolio-transfer-raker-lights',materials.light,[startX,23.2,front+.46],[tipX,h-1,front-2.78],.12,.15,color);
      }
      for (let y=29;y<45;y+=4.25) instance('portfolio-transfer-gallery',materials.steel,x,y,front,w*.93,.31,1.14);
      for (const y of [27,41,54]) instance('portfolio-transfer-air-slots',materials.light,x,y,front+.31,w*.70,.22,.10,0,color);
      const mastX=x+1.2, mastZ=z-1.1;
      const roof=22.5+h*.77;
      instance('portfolio-transfer-masts',materials.metal,mastX,roof+3.1,mastZ,.36,6.2,.36);
      instance('portfolio-transfer-mast-lights',materials.light,mastX,roof+6.21,mastZ,.20,.25,.20,0,0xff6049);
    }

    const marketFront=marketTerrace.z-marketTerrace.depth/2-.28;
    for (const [x,w,first,last] of [[-64.45,6.35,17,61],[-57.25,4.65,19,74]]) {
      for (let y=first;y<last;y+=4.35) {
        instance('portfolio-market-terrace-balconies',materials.steel,x,y,marketFront-.55,w,.27,1.72);
        instance('portfolio-market-terrace-railing',materials.metal,x,y+.61,marketFront-1.34,w,.9,.13);
        instance('portfolio-market-terrace-lights',materials.light,x-w*.27,y+.62,marketFront-1.43,.79,.106,.042,0,y%3>1.4 ? 0xf38d97 : 0xfeb582);
      }
    }
    beam('portfolio-market-terrace-frame',materials.copper,[-68,59,marketFront-1.30],[-55.2,75.0,marketFront-1.30],.44,.45);
    beam('portfolio-market-terrace-lights',materials.light,[-68,59,marketFront-1.58],[-55.2,75.0,marketFront-1.58],.11,.105,0xff9c82);

    for (const [x1,x2,y,width,style,accent] of [
      [campus.southX,campus.northX,24.1,8.4,7,0xbbe9a7],
      [campus.southX-.65,campus.northX+1.5,53.4,6.4,4,0xa9e7d8]
    ]) {
      const dx=x2-x1,dz=campus.north-campus.south,length=Math.hypot(dx,dz);
      const yaw=Math.atan2(dx,dz),x=(x1+x2)/2,z=(campus.north+campus.south)/2;
      instance('portfolio-campus-bridge-'+style,facadeMaterials[style],x,y+1.8,z,width,3.6,length,yaw);
      instance('portfolio-campus-bridge-underside',materials.underside,x,y-.18,z,width+.15,.39,length,yaw);
      for (const side of [-1,1]) {
        const offset=side*(width/2+.16), px=offset*dz/length, pz=-offset*dx/length;
        for (const rise of [.4,3.0]) instance('portfolio-campus-clamps',materials.copper,x+px,y+rise,z+pz,.28,.21,length,yaw);
        instance('portfolio-campus-bridge-lights',materials.light,x+px*1.05,y+.51,z+pz*1.05,.08,.079,length,yaw,accent);
        instance('portfolio-campus-bridge-lights',materials.light,x+px*.79,y-.383,z+pz*.79,.10,.075,length*.74,yaw,accent);
        for (let t=.19;t<.78;t+=.135) {
          const bx=x1+px+t*dx,bz=campus.south+pz+t*dz;
          beam('portfolio-campus-diagonals',materials.metal,[bx,y+.27,bz],[bx+dx*.10,y+3.02,bz+dz*.10],.26,.36);
        }
      }
    }
    for (const side of [-1,1]) instance('portfolio-service-bridge-lights',materials.light,
      131.8+side*3.44,32.3,-14.3,.095,.9,27.8,0,0x8ce9da);
    const relayAssembly = new THREE.Group();
    relayAssembly.name='portfolio-service-beacon';
    relayAssembly.position.set(relayTower.x,0,relayTower.z);
    world.add(relayAssembly);
    const relayBands = [
      {y:16.4,top:6.35,bottom:7.85,h:6.6}, {y:35.2,top:5.8,bottom:6.8,h:4.5},
      {y:56.1,top:6.95,bottom:5.5,h:4.2}, {y:67.7,top:5.1,bottom:6.85,h:4.65},
      {y:73.2,top:2.55,bottom:5.05,h:3.3}
    ];
    for (const {y,top,bottom,h} of relayBands) {
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,12),materials.steel);
      housing.position.y=y;
      relayAssembly.add(housing);
      const beacon = new THREE.Mesh(new THREE.TorusGeometry(top+.055,.105,6,24),new THREE.MeshBasicMaterial({color:0xbfead6,toneMapped:false}));
      beacon.rotation.x=Math.PI/2;
      beacon.position.y=y+h/2;
      relayAssembly.add(beacon);
    }
    instance('portfolio-transfer-masts',materials.metal,relayTower.x,80.5,relayTower.z,.39,9.9,.38);
    instance('portfolio-transfer-mast-lights',materials.light,relayTower.x,85.45,relayTower.z,.30,.27,.30,0,0xff674e);

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
    for (const x of [-18.7,18.7]) {
      instance('portfolio-project-supports',materials.steel,x,7.5,45.7,3.15,15,.78);
      instance('portfolio-project-tower-light',materials.light,x,8,45.16,.20,14.5,.13,0,0x63eedb);
      for (const y of [3.1,7.7,12.2]) instance('portfolio-project-clamps',materials.copper,x,y,45.3,3.75,.58,1.02);
    }
    instance('portfolio-project-fascia',materials.steel,0,22.32,47.93,36,.67,.33);
    instance('portfolio-project-fascia-light',materials.light,0,22.16,47.71,32.5,.13,.14,0,0xb7f8e8);
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

    sign(80,7.2,-73,16,4,0,'BUMP TEST','PYLONS / JUMP RAMP',0xff976d,{bracket:true});
    instance('portfolio-sign-lips',materials.metal,77.5,5.98,-73.40,31.5,.32,.52);
    for (const x of [62,93]) instance('portfolio-stop-masts',materials.metal,x,3.3,-73,.42,6.6,.42);
    glow(81,-66,25,22,0xff976d,.86);
    const marquees = [
      [-23,5.7,-13,11,2.2,north,'NIGHT MARKET','EDUCATION',0xf7a2d4,8.5],
      [24,5.7,-4,11,2.2,north,'SERVICE DISTRICT','EXPERIENCE / TEST BAY',0xffbf79,8.5],
      [-82,4.4,-9.1,6.5,1.8,north,'MARKET','FOOD / REPAIRS',0xff90ae,5.6],
      [-30,3.8,66.5,7.5,2.1,east,'CAMPUS','SKILLS',0xc1eda9,5.6],
      [112,5.3,-95,10.2,2.1,0,'SOUTH STREET','INTERESTS',0xfa93a7,21.4]
    ];
    for (const [x,y,z,w,h,facing,head,sub,color,poleSpan] of marquees) {
      sign(x,y,z,w,h,facing,head,sub,color,{poleSpan});
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
    lights();
    const buffer = new Float32Array(150*6), rainGeometry = new THREE.BufferGeometry();
    const droplets = [], random = randomFrom(0x49b981);
    for (let i=0;i<150;i++) droplets.push({x:(random()-.5)*86,z:(random()-.5)*86,y:random()*31,speed:18+random()*13});
    rainGeometry.setAttribute('position',new THREE.BufferAttribute(buffer,3));
    const rain = new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:0x91bbdc,transparent:true,opacity:.25,depthWrite:false}));
    rain.frustumCulled=false;
    rain.name='portfolio-rain';
    world.add(rain);
    function update(camera,dt) {
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
    function dispose() {
      disposed = true;
      for (const texture of wallTextures) texture.dispose();
    }
    return {update,dispose};
  }

  const skyMall = {deck:mallDeck,loop:mallLoop,branches:branchRoutes,destination:mall.destination};
  return {edge, roadHalfWidth, spawn, routeSamples, stops, buildings, arrivalFrontages, entryRibs, networkRoads, highwaySegments, guardrails, supports, skyway, skyMall, constrainCamera,
    playProps, holograms, adPlacements, assetPlacements, distanceToRoad, build};
});
