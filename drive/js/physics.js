/* Shared CANNON vehicle physics. Metres, seconds, kilograms. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('cannon'), require('./city'));
  else root.DrivePhysics = factory(root.CANNON, root.DriveCity);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(C, City) {
  'use strict';
  const terrainHeight = (x,z) => 7 * Math.exp(-((x-37)**2/420 + (z-32)**2/700)) + 4 * Math.exp(-((x+35)**2/380 + (z-65)**2/280));
  // One ordered physical ribbon. No ground-level shortcut exists beneath a
  // stunt: the recovery floor is eight metres below the road.
  const stuntBumps = [], overpasses = [];
  const stuntRoute=[];
  function routeLine(a,b) {
    const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);
    for(let i=0;i<n;i++){const t=i/n;stuntRoute.push({x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t});}
  }
  function routeTurn(a,c,b) {
    const n=20;
    for(let i=0;i<n;i++){const t=i/n,u=1-t;stuntRoute.push({x:u*u*a[0]+2*u*t*c[0]+t*t*b[0],z:u*u*a[1]+2*u*t*c[1]+t*t*b[1]});}
  }
  routeLine([-145,0],[145,0]);routeTurn([145,0],[175,0],[175,30]);
  routeLine([175,30],[175,110]);routeTurn([175,110],[175,140],[145,140]);
  routeLine([145,140],[30,140]);routeTurn([30,140],[0,140],[0,110]);
  // Explicit stations make the launch and landing edges exact.
  for(const [a,b] of [[110,100],[100,80],[80,72],[72,55],[55,20],[20,-25],[-25,-45],[-45,-55],[-55,-95],[-95,-105],[-105,-110]])routeLine([0,a],[0,b]);
  routeTurn([0,-110],[0,-140],[-30,-140]);routeLine([-30,-140],[-145,-140]);
  routeTurn([-145,-140],[-175,-140],[-175,-110]);routeLine([-175,-110],[-175,-30]);
  routeTurn([-175,-30],[-175,0],[-145,0]);
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  function stuntProfile(x,z) {
    let y=0,width=12.4,kind='road';
    if(Math.abs(z)<.001) {y=9*(1-smooth((Math.abs(x)-85)/60));kind='overpass';}
    if(Math.abs(x)<.001) {
      if(z>=80&&z<=110){const d=110-z;y=d<=10?.006*d*d:.6+.12*(d-10);kind='launch';}
      if(z<80&&z>72){y=2;kind='gap';}
      if(z<=72&&z>=55){y=2*(z-55)/17;kind='landing';}
      if(z<=-25&&z>=-110){y=4*Math.min(smooth((-z-25)/20),smooth((110+z)/15));kind='balance';
        width=12.4-8.8*Math.min(smooth((-z-45)/10),smooth((105+z)/10));}
    }
    return {y,width,kind};
  }
  stuntRoute.forEach((p,i)=>{
    Object.assign(p,stuntProfile(p.x,p.z));
    const a=stuntRoute[(i+stuntRoute.length-1)%stuntRoute.length],b=stuntRoute[(i+1)%stuntRoute.length];
    const d=Math.hypot(b.x-a.x,b.z-a.z);p.tx=(b.x-a.x)/d;p.tz=(b.z-a.z)/d;
    // Exact tangent at curve/grade boundaries keeps every solid top planar.
    if(p.z===0&&Math.abs(p.x)===145){p.tx=1;p.tz=0;}
    if(p.x===0&&Math.abs(p.z)===110){p.tx=0;p.tz=-1;}
  });
  const stuntFeatures={jump:{x:0,launchZ:80,landingZ:72,gap:8,launchY:3,landingY:2,recommendedSpeed:[23,28]},balance:{x:0,z0:-55,z1:-95,width:3.6,height:4},overpass:{z:0,height:9,underpassX:0},floor:-8};
  // The mountain has a collidable ledge, the stunt route has a lowered recovery floor, and the city is level.
  function scenicHeight(map,x,z) {
    if (map === 'mountain') {
      // A narrow contour ledge cut into a massif, not a painted road on a hill.
      // The inside climbs 55 m; the outside drops 60 m over six horizontal metres.
      // Keep the shelf wider than the asphalt to accommodate the 2 m collision grid.
      const angle=Math.atan2(z/1.12,x), radius=Math.hypot(x,z/1.12);
      const offset=radius-mountainRadius(angle);
      const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
      return 100+Math.min(1,radius/80)*(27*Math.sin(angle)+5*Math.sin(2*angle))
        +55*smooth((-offset-6.5)/6)-60*smooth((offset-6.5)/6);
    }
    if (map === 'racetrack') return stuntFeatures.floor;
    return 0;
  }
  function mountainRadius(angle) { return 130+12*Math.sin(3*angle)+6*Math.cos(5*angle); }
  const mountainPoints=Array.from({length:64},(_,i)=>{
    const angle=-Math.PI/2+i*2*Math.PI/64,r=mountainRadius(angle);
    return [r*Math.cos(angle),r*Math.sin(angle)*1.12];
  });
  const ramp = {x:0,y:2.02,z:26,halfWidth:4,halfLength:10,angle:-.22};
  const vehicles = {
    hypercar: {mass:1450,width:2.25995204,length:5.0,wheelX:0.87605771,wheelZ:1.56672884,radius:0.3937529,maxSpeed:329.6/3.6,engine:3465,grip:3.5,height:1.328707,wheelLayout:[{"x":-0.86507881,"y":0.01215544,"z":-1.56672923,"radius":0.40465421},{"x":-0.88703661,"y":-0.01215544,"z":1.56672833,"radius":0.38285158},{"x":0.86507944,"y":0.01215544,"z":-1.56672844,"radius":0.40465421},{"x":0.88703598,"y":-0.01215544,"z":1.56672935,"radius":0.38285158}]},
    comet: {mass:1200,width:2.31127653,length:5.2,wheelX:0.8130705,wheelZ:1.4797948,radius:0.36840471,maxSpeed:226.6/3.6,engine:2205,grip:3.2,height:1.56735953,wheelLayout:[{"x":-0.81307043,"y":7e-08,"z":-1.47979502,"radius":0.36840471},{"x":-0.81307057,"y":-7e-08,"z":1.47979505,"radius":0.36840471},{"x":0.81307029,"y":7e-08,"z":-1.47979458,"radius":0.36840471},{"x":0.81307072,"y":-7e-08,"z":1.47979455,"radius":0.36840471}]},
    rally: {mass:1350,width:2.13494821,length:4.85,wheelX:0.8529574,wheelZ:1.47341964,radius:0.36773579,maxSpeed:185.4/3.6,engine:2362.5,grip:3.6,height:1.65786409,wheelLayout:[{"x":-0.85295744,"y":1.1e-07,"z":-1.47341981,"radius":0.3677358},{"x":-0.85295736,"y":-1.2e-07,"z":1.47341924,"radius":0.3677358},{"x":0.85295703,"y":7e-08,"z":-1.47341947,"radius":0.36773579},{"x":0.85295776,"y":-6e-08,"z":1.47342004,"radius":0.36773579}]},
    pickup: {mass:1850,width:2.27514223,length:5.7,wheelX:0.80256749,wheelZ:1.75742617,radius:0.41361299,maxSpeed:159.65/3.6,engine:2940,grip:3.0,height:1.86798263,wheelLayout:[{"x":-0.80256749,"y":-0.0,"z":-1.75742617,"radius":0.41361299},{"x":-0.80256749,"y":0.0,"z":1.75742617,"radius":0.41361299},{"x":0.80256749,"y":-0.0,"z":-1.75742617,"radius":0.41361299},{"x":0.80256749,"y":0.0,"z":1.75742617,"radius":0.41361299}]}
  };
  function create(options={}) {
    const course = !options.map || options.map === 'course';
    const isCity = options.map === 'city';
    const cityMap=options.city || City;
    const cityTerrain=isCity && cityMap.terrain?.data?.length>1 ? cityMap.terrain : null;
    const edge=isCity?cityMap.edge:course?160:200, cells=isCity?0:edge;
    const floorOffset=options.map==='racetrack'?stuntFeatures.floor:0;
    const analyticHeight=course?terrainHeight:(x,z)=>scenicHeight(options.map,x,z)-floorOffset;
    const data=cityTerrain?.data || (isCity?null:Array.from({length:cells+1},(_,i)=>Array.from({length:cells+1},(_,j)=>analyticHeight(i*2-edge,edge-j*2))));
    // CANNON's Heightfield pillar bottom is fixed at local -1. When source
    // elevations dip below that, its generated convex triangles invert. Shift
    // collider samples up and the whole body back down; world heights stay exact.
    let terrainMin=Infinity;
    if(cityTerrain)for(const column of data)for(const value of column)terrainMin=Math.min(terrainMin,value);
    const terrainShift=cityTerrain?Math.max(0,1-terrainMin):0;
    const collisionData=terrainShift?data.map(column=>column.map(value=>value+terrainShift)):data;
    // CANNON 0.6.2 getHeightAt is only an average. Match its actual triangles.
    function height(x,z) {
      if(isCity&&!cityTerrain)return 0;
      const nx=data.length-1,nz=data[0].length-1;
      const u=Math.max(0,Math.min(nx,cityTerrain?(x-cityTerrain.originX)/cityTerrain.elementSize:(x+edge)/2));
      const v=Math.max(0,Math.min(nz,cityTerrain?(cityTerrain.maxZ-z)/cityTerrain.elementSize:(edge-z)/2));
      const i=Math.min(nx-1,Math.floor(u)),j=Math.min(nz-1,Math.floor(v)),a=u-i,b=v-j;
      if(a+b<=1) return floorOffset+data[i][j]*(1-a-b)+data[i+1][j]*a+data[i][j+1]*b;
      return floorOffset+data[i+1][j+1]*(a+b-1)+data[i][j+1]*(1-a)+data[i+1][j]*(1-b);
    }
    let selectedCar=options.car || 'comet', spec=vehicles[selectedCar] || vehicles.comet;
    const world = new C.World(); world.gravity.set(0,-9.81,0);
    world.broadphase = new C.SAPBroadphase(world); world.solver.iterations=15;
    world.defaultContactMaterial.friction=.5; world.defaultContactMaterial.restitution=.08;
    // Chassis scraping is separate from tire traction (RaycastVehicle.frictionSlip).
    // Low friction lets glancing contacts slide; zero restitution avoids a kick
    // at a landing or triangle seam. Normal impulses still stop solid impacts.
    const chassisMaterial=new C.Material('chassis'), terrainMaterial=new C.Material('terrain');
    world.addContactMaterial(new C.ContactMaterial(chassisMaterial,terrainMaterial,{friction:.01,restitution:0}));
    const floor=new C.Body({mass:0,material:terrainMaterial});
    if(cityTerrain) { floor.addShape(new C.Heightfield(collisionData,{elementSize:cityTerrain.elementSize})); floor.position.set(cityTerrain.originX,-terrainShift,cityTerrain.maxZ); }
    else if(isCity) { floor.addShape(new C.Plane()); floor.position.set(0,0,0); }
    else { floor.addShape(new C.Heightfield(data,{elementSize:2})); floor.position.set(-edge,floorOffset,edge); }
    floor.quaternion.setFromEuler(-Math.PI/2,0,0); world.addBody(floor);
    function box(x,y,z,hx,hy,hz,angle=0,yaw=0) {
      const body=new C.Body({mass:0,material:terrainMaterial});
      body.addShape(new C.Box(new C.Vec3(hx,hy,hz)));
      body.position.set(x,y,z);
      const tilt=new C.Quaternion(), turn=new C.Quaternion();
      tilt.setFromAxisAngle(new C.Vec3(1,0,0),angle);
      turn.setFromAxisAngle(new C.Vec3(0,1,0),yaw);
      turn.mult(tilt,body.quaternion);
      world.addBody(body);
      return body;
    }
    if (course) box(ramp.x,ramp.y,ramp.z,ramp.halfWidth,.18,ramp.halfLength,ramp.angle);
    const streamingCity=isCity && cityMap!==City && typeof cityMap.nearbyBuildings==='function';
    const activeCity={buildings:new Map(),roads:new Map(),highways:new Map(),connectors:new Map(),approaches:new Map(),junctions:new Map(),guardrails:new Map(),supports:new Map()};
    let lastCityX=Infinity,lastCityZ=Infinity;
    let lastCityGeometryVersion=cityMap.collisionGeometryVersion || 0;
    function roadBox(segment) {
      if(Number.isFinite(segment.renderedCarriageMin)&&
          Number.isFinite(segment.renderedCarriageMax)) {
        const x1=segment.x1??segment.x,z1=segment.z1??segment.z-segment.length/2;
        const x2=segment.x2??segment.x,z2=segment.z2??segment.z+segment.length/2;
        const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz)||1;
        const normal=[dz/length,-dx/length];
        const first=segment.startMiter||normal,last=segment.endMiter||normal;
        const offset=(segment.renderedCarriageMin+segment.renderedCarriageMax)/2;
        const width=segment.renderedCarriageMax-segment.renderedCarriageMin;
        if(width<.1)return null;
        return roadBox({...segment,
          renderedCarriageMin:undefined,renderedCarriageMax:undefined,
          x1:x1+first[0]*offset,z1:z1+first[1]*offset,
          x2:x2+last[0]*offset,z2:z2+last[1]*offset,width});
      }
      // The visual road mesh cuts bridge decks back at graph-covered merges.
      // Use those same intervals for collision so a removed deck cannot remain
      // as an invisible slab across the native lane connectors underneath.
      const renderedIntervals=segment.renderedVisibleIntervals ?? segment.visibleIntervals;
      if(Array.isArray(renderedIntervals)) {
        const intervals=renderedIntervals.filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b-a>1e-5);
        if(!intervals.length)return null;
        if(intervals.length!==1||intervals[0][0]>1e-5||intervals[0][1]<1-1e-5) {
          const x1=segment.x1??segment.x,z1=segment.z1??segment.z-segment.length/2;
          const x2=segment.x2??segment.x,z2=segment.z2??segment.z+segment.length/2;
          const y1=segment.topStart??segment.y1??0,y2=segment.topEnd??segment.y2??0;
          const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz)||1;
          const normal=[dz/length,-dx/length];
          const first=segment.startMiter||normal,last=segment.endMiter||normal;
          const miterAt=t=>[first[0]*(1-t)+last[0]*t,
            first[1]*(1-t)+last[1]*t];
          const pieces=intervals.map(([a,b])=>roadBox({
            ...segment,visibleIntervals:null,renderedVisibleIntervals:null,
            x1:x1+dx*a,z1:z1+dz*a,x2:x1+dx*b,z2:z1+dz*b,
            topStart:y1+(y2-y1)*a,topEnd:y1+(y2-y1)*b,
            // The rendered strip interpolates its endpoint miters at every
            // cut. A perpendicular here moves a curved road's physical edge
            // sideways, sometimes by nearly a metre at merge cutbacks.
            startMiter:a>1e-5?miterAt(a):segment.startMiter,
            endMiter:b<1-1e-5?miterAt(b):segment.endMiter
          })).filter(Boolean);
          return pieces.length===1?pieces[0]:pieces;
        }
      }
      const x1=segment.x1??segment.x, x2=segment.x2??segment.x;
      const z1=segment.z1??segment.z-segment.length/2, z2=segment.z2??segment.z+segment.length/2;
      const topStart=segment.topStart??segment.y1??0,topEnd=segment.topEnd??segment.y2??0;
      const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz);
      if(length<.01)return null;
      if(Array.isArray(segment.startMiter)&&Array.isArray(segment.endMiter)) {
        const half=segment.width/2;
        const corners=[
          [x1-segment.startMiter[0]*half,z1-segment.startMiter[1]*half,topStart],
          [x1+segment.startMiter[0]*half,z1+segment.startMiter[1]*half,topStart],
          [x2+segment.endMiter[0]*half,z2+segment.endMiter[1]*half,topEnd],
          [x2-segment.endMiter[0]*half,z2-segment.endMiter[1]*half,topEnd]
        ];
        const turns=corners.map((point,i)=>{
          const next=corners[(i+1)%4],after=corners[(i+2)%4];
          return (next[0]-point[0])*(after[1]-next[1])-
            (next[1]-point[1])*(after[0]-next[0]);
        });
        if(corners.every(point=>point.every(Number.isFinite))&&turns.every(turn=>turn>1e-5)) {
          // A graded road with different end miters has a twisted top quad.
          // CANNON convex hull faces must be planar, so use the same diagonal
          // as the rendered deck and extrude each surface triangle separately.
          const center=new C.Vec3((x1+x2)/2,(topStart+topEnd)/2-.25,(z1+z2)/2);
          const body=new C.Body({mass:0,material:terrainMaterial});
          for(const indices of [[0,1,3],[1,2,3]]) {
            const triangle=indices.map(index=>corners[index]);
            const origin=new C.Vec3(
              triangle.reduce((sum,p)=>sum+p[0],0)/3,
              triangle.reduce((sum,p)=>sum+p[2],0)/3-.25,
              triangle.reduce((sum,p)=>sum+p[1],0)/3);
            const vertices=[];
            for(const lower of [true,false])for(const [x,z,y] of triangle)
              vertices.push(new C.Vec3(x-origin.x,y-(lower?.5:0)-origin.y,z-origin.z));
            const faces=[[0,1,2],[5,4,3],[0,3,4,1],[1,4,5,2],[2,5,3,0]];
            body.addShape(new C.ConvexPolyhedron(vertices,faces),origin.vsub(center));
          }
          body.position.copy(center);world.addBody(body);
          return body;
        }
      }
      const pitch=-Math.atan2(topEnd-topStart,length),yaw=Math.atan2(dx,dz);
      const slopeLength=Math.hypot(length,topEnd-topStart);
      const centerY=(topStart+topEnd)/2-.25/Math.cos(pitch);
      return box((x1+x2)/2,centerY,(z1+z2)/2,segment.width/2,.25,slopeLength/2,pitch,yaw);
    }
    function connectorBody(connector) {
      const samples=connector.samples;
      if(!Array.isArray(samples)||samples.length<2)return null;
      const origin=samples[Math.floor(samples.length/2)];
      const body=new C.Body({mass:0,material:terrainMaterial});
      body.position.set(origin.x,origin.y-.12,origin.z);
      const width=Math.max(1.5,Math.min(9,Number(connector.width_m)||3))+.32;
      for(let i=0;i<samples.length-1;i++) {
        const a=samples[i],b=samples[i+1];
        if(connector.renderedOnly&&!a.collisionRenderedToNext)continue;
        // The terrain heightfield already supports ground-level connectors.
        // Add an authored slab only where the game road rises above it.
        if(Math.max(a.sourceY-height(a.x,a.z),b.sourceY-height(b.x,b.z))<.22)continue;
        const dx=b.x-a.x,dz=b.z-a.z,dy=b.y-a.y,length=Math.hypot(dx,dz);
        if(length<.05)continue;
        const extra=a.collisionWidthToNext;
        const chordNormal=[dz/length,-dx/length];
        const normal=(s)=>Number.isFinite(s.nx)&&Number.isFinite(s.nz)
          ?[s.nx,s.nz]:chordNormal;
        const startNormal=normal(a),endNormal=normal(b);
        const edgeSkew=Math.max(
          Math.hypot(startNormal[0]-chordNormal[0],startNormal[1]-chordNormal[1]),
          Math.hypot(endNormal[0]-chordNormal[0],endNormal[1]-chordNormal[1]))*width/2;
        if(extra?.[0]>1e-5||extra?.[1]>1e-5||edgeSkew>.25) {
          // A chord-aligned box can extend well past a sharply curved lane or
          // miss its outer edge. Match the renderer's two mitered triangles on
          // those segments and on graph shoulders; retain cheap boxes on the
          // nearly straight spans.
          const edge=(s,side,added)=>{
            const [nx,nz]=normal(s),radius=width/2+added;
            const x=s.x+nx*radius*side,z=s.z+nz*radius*side;
            const terrain=cityMap.terrainHeight?.(x,z)??height(x,z);
            return [x,Math.max(s.y,terrain+.095),z];
          };
          const startPlus=edge(a,1,extra?.[0]||0),endPlus=edge(b,1,extra?.[1]||0);
          const endMinus=edge(b,-1,extra?.[1]||0),startMinus=edge(a,-1,extra?.[0]||0);
          for(const corners of [[startPlus,endMinus,endPlus],
            [startPlus,startMinus,endMinus]]) {
            const triangle=corners.slice();
            const cross=(triangle[1][0]-triangle[0][0])*(triangle[2][2]-triangle[0][2])-
              (triangle[1][2]-triangle[0][2])*(triangle[2][0]-triangle[0][0]);
            if(Math.abs(cross)<1e-6)continue;
            if(cross<0)[triangle[1],triangle[2]]=[triangle[2],triangle[1]];
            const center=new C.Vec3(
              triangle.reduce((sum,p)=>sum+p[0],0)/3,
              triangle.reduce((sum,p)=>sum+p[1],0)/3-.12,
              triangle.reduce((sum,p)=>sum+p[2],0)/3);
            const vertices=[];
            for(const lower of [true,false])for(const [x,y,z] of triangle)
              vertices.push(new C.Vec3(x-center.x,y-(lower?.24:0)-center.y,z-center.z));
            const faces=[[0,1,2],[5,4,3],[0,3,4,1],[1,4,5,2],[2,5,3,0]];
            body.addShape(new C.ConvexPolyhedron(vertices,faces),center.vsub(body.position));
          }
          continue;
        }
        const pitch=-Math.atan2(dy,length),yaw=Math.atan2(dx,dz);
        const tilt=new C.Quaternion(),turn=new C.Quaternion(),orientation=new C.Quaternion();
        tilt.setFromAxisAngle(new C.Vec3(1,0,0),pitch);
        turn.setFromAxisAngle(new C.Vec3(0,1,0),yaw);
        turn.mult(tilt,orientation);
        const center=new C.Vec3((a.x+b.x)/2,(a.y+b.y)/2-.12,(a.z+b.z)/2);
        body.addShape(new C.Box(new C.Vec3(width/2,.12,Math.hypot(length,dy)/2+.22)),
          center.vsub(body.position),orientation);
      }
      if(!body.shapes.length)return null;
      world.addBody(body);
      // cannon.js computes compound AABBs by rotating each shape offset by
      // that shape's own orientation. The offset actually lives in body space.
      // On a curved lane this can exclude the tail boxes from broadphase and
      // raycasts, leaving physical holes even though every box exists. These
      // city road bodies are static, so calculate their true union once.
      const lower=new C.Vec3(Infinity,Infinity,Infinity);
      const upper=new C.Vec3(-Infinity,-Infinity,-Infinity);
      const shapeLower=new C.Vec3(),shapeUpper=new C.Vec3();
      for(let i=0;i<body.shapes.length;i++) {
        const offset=body.quaternion.vmult(body.shapeOffsets[i],new C.Vec3());
        offset.vadd(body.position,offset);
        const orientation=body.quaternion.mult(body.shapeOrientations[i],new C.Quaternion());
        body.shapes[i].calculateWorldAABB(offset,orientation,shapeLower,shapeUpper);
        lower.x=Math.min(lower.x,shapeLower.x);lower.y=Math.min(lower.y,shapeLower.y);lower.z=Math.min(lower.z,shapeLower.z);
        upper.x=Math.max(upper.x,shapeUpper.x);upper.y=Math.max(upper.y,shapeUpper.y);upper.z=Math.max(upper.z,shapeUpper.z);
      }
      body.aabb.lowerBound.copy(lower);body.aabb.upperBound.copy(upper);
      body.aabbNeedsUpdate=false;
      return body;
    }
    function approachBody(approach) {
      const samples=approach.samples;
      if(approach.edge_id==null||!Array.isArray(samples)||samples.length<3)
        return connectorBody(approach);
      const touchesVisibleRoad=(sample)=>{
        if(!Number.isFinite(sample.sourceY)||Math.abs(sample.y-sample.sourceY-.08)>.03)return false;
        const roads=[
          ...(cityMap.nearbyRoads?.(sample.x,sample.z,8)||[]),
          ...(cityMap.nearbyHighways?.(sample.x,sample.z,8)||[])
        ];
        return roads.some(road=>{
          if(String(road.id)!==String(approach.edge_id))return false;
          const dx=road.x2-road.x1,dz=road.z2-road.z1,len2=dx*dx+dz*dz;
          if(len2<.01)return false;
          const t=Math.max(0,Math.min(1,((sample.x-road.x1)*dx+(sample.z-road.z1)*dz)/len2));
          if(!(road.visibleIntervals||[[0,1]]).some(([a,b])=>t>=a-.001&&t<=b+.001))return false;
          const lateral=Math.hypot(sample.x-road.x1-dx*t,sample.z-road.z1-dz*t);
          if(lateral>road.width/2+.3)return false;
          const deck=road.y1+(road.y2-road.y1)*t;
          return deck-height(sample.x,sample.z)>.2&&Math.abs(deck-sample.sourceY)<.2;
        });
      };
      const correction=new Array(samples.length).fill(0);
      for(let i=0;i<samples.length;i++)if(touchesVisibleRoad(samples[i])) {
        const sample=samples[i];let contact=-Infinity;
        world.raycastAll(new C.Vec3(sample.x,sample.y+.5,sample.z),
          new C.Vec3(sample.x,sample.y-.5,sample.z),{},hit=>{
            if((hit.body?.citySource?.kind==='road'||
                hit.body?.citySource?.kind==='highway')&&
                String(hit.body.citySource.id)===String(approach.edge_id))
              contact=Math.max(contact,hit.hitPointWorld.y);
          });
        const delta=sample.y-contact;
        if(Number.isFinite(delta)&&delta>0&&delta<.25)correction[i]=delta;
      }
      if(!correction.some(Boolean))return connectorBody(approach);
      // Match the physical ribbon to the existing road collider only where
      // they overlap. The renderer lifts lane paint above asphalt, and a
      // graded mitered deck can sit slightly below its source centerline.
      // Leaving both full-height colliders creates a short tire-contact step.
      return connectorBody({...approach,samples:samples.map((sample,i)=>
        correction[i]?{...sample,y:sample.y-correction[i]}:sample)});
    }
    function junctionBody(surface) {
      if(!surface.vertices?.length||!surface.indices?.length)return null;
      const body=new C.Body({mass:0,material:terrainMaterial});
      const mesh=new C.Trimesh(surface.vertices,surface.indices);
      // cannon.js 0.6.2 removes an octree child whenever that child has no
      // direct triangles, even if grandchildren hold hundreds of them. Its
      // constructor can therefore lose most faces of a dense junction mesh.
      // Rebuild the tree and retain every branch with data at any depth.
      const tree=mesh.tree;
      tree.reset();tree.aabb.copy(mesh.aabb);
      const a=new C.Vec3(),b=new C.Vec3(),c=new C.Vec3(),bounds=new C.AABB();
      for(let i=0;i<surface.indices.length/3;i++) {
        mesh.getTriangleVertices(i,a,b,c);
        bounds.setFromPoints([a,b,c]);
        tree.insert(bounds,i);
      }
      const keep=node=>{
        node.children=node.children.filter(keep);
        return node.data.length>0||node.children.length>0;
      };
      keep(tree);
      body.addShape(mesh);
      body.position.set(surface.x,0,surface.z);
      body.computeAABB();
      world.addBody(body);
      return body;
    }
    function buildingBody(building) {
      // A mesh-backed special building has a broad lot/parent record and a
      // narrower visible proxy. The parent must not block the street around it.
      if (building.skipCollider) return null;
      const footprint=building.footprint;
      if(!Array.isArray(footprint)||footprint.length<3)
        return box(building.x,(building.baseY||0)+building.height/2,building.z,
          building.width/2,building.height/2,building.depth/2);
      // The imported footprints are rotated polygons. An axis-aligned box can
      // fill the street beside a diagonal building even though nothing is drawn
      // there. Use the same outline for the static collision volume.
      const n=footprint.length, halfHeight=building.height/2;
      let area=0;
      for(let i=0;i<n;i++) {
        const a=footprint[i],b=footprint[(i+1)%n];
        area+=a[0]*b[1]-b[0]*a[1];
      }
      if(Math.abs(area)<.01)
        return box(building.x,(building.baseY||0)+halfHeight,building.z,
          building.width/2,halfHeight,building.depth/2);
      const vertices=[];
      for(const y of [-halfHeight,halfHeight])for(const [x,z] of footprint)
        vertices.push(new C.Vec3(x-building.x,y,z-building.z));
      const faces=[
        Array.from({length:n},(_,i)=>i),
        Array.from({length:n},(_,i)=>2*n-1-i)
      ];
      for(let i=0;i<n;i++)faces.push([i,n+i,n+(i+1)%n,(i+1)%n]);
      if(area<0)for(const face of faces)face.reverse();
      const body=new C.Body({mass:0,material:terrainMaterial});
      body.addShape(new C.ConvexPolyhedron(vertices,faces));
      body.position.set(building.x,(building.baseY||0)+halfHeight,building.z);
      world.addBody(body);
      return body;
    }
    function updateLocalColliders(active,nearby,createBody,kind) {
      const wanted=new Set(nearby);
      for(const [item,body] of active) if(!wanted.has(item)) {
        for(const part of Array.isArray(body)?body:[body])world.removeBody(part);
        active.delete(item);
      }
      for(const item of wanted) if(!active.has(item)) {
        const body=createBody(item);
        if(body) {
          for(const part of Array.isArray(body)?body:[body])
            part.citySource={kind,id:item.entity_id??item.id??item.roadId??null};
          active.set(item,body);
        }
      }
    }
    function nearbyItems(query,items,x,z,radius) {
      if(typeof query==='function')return query(x,z,radius);
      return items.filter(item=>{
        const span=item.length||Math.hypot((item.x2??item.x)-(item.x1??item.x),(item.z2??item.z)-(item.z1??item.z));
        return Math.hypot((item.x??(item.x1+item.x2)/2)-x,(item.z??(item.z1+item.z2)/2)-z)<radius+span/2;
      });
    }
    function refreshCityColliders(x,z,force=false,requestTiles=true) {
      const geometryVersion=cityMap.collisionGeometryVersion || 0;
      const geometryChanged=geometryVersion!==lastCityGeometryVersion;
      if(!streamingCity || !force && !geometryChanged && Math.hypot(x-lastCityX,z-lastCityZ)<20)return;
      lastCityX=x;lastCityZ=z;
      if(geometryChanged) {
        for(const active of [activeCity.roads,activeCity.highways,
          activeCity.approaches,activeCity.junctions]) {
          for(const body of active.values())
            for(const part of Array.isArray(body)?body:[body])world.removeBody(part);
          active.clear();
        }
        lastCityGeometryVersion=geometryVersion;
      }
      const radius=140;
      if(requestTiles) {
        const pending=cityMap.ensureNear?.(x,z,Math.max(280,cityMap.tileSize*1.05||0));
        pending?.catch?.(error=>console.warn('City tile could not load:',error));
      }
      updateLocalColliders(activeCity.buildings,cityMap.nearbyBuildings(x,z,radius),buildingBody,'building');
      updateLocalColliders(activeCity.highways,nearbyItems(cityMap.nearbyHighways?.bind(cityMap),cityMap.highwaySegments,x,z,radius),roadBox,'highway');
      if(typeof cityMap.nearbyLaneConnectors==='function')
        updateLocalColliders(activeCity.connectors,cityMap.nearbyLaneConnectors(x,z,radius),connectorBody,'connector');
      if(typeof cityMap.nearbyLaneApproaches==='function')
        updateLocalColliders(activeCity.approaches,cityMap.nearbyLaneApproaches(x,z,radius),approachBody,'approach');
      if(typeof cityMap.nearbyJunctionSurfaces==='function')
        updateLocalColliders(activeCity.junctions,cityMap.nearbyJunctionSurfaces(x,z,90),junctionBody,'junction');
      if(cityTerrain && typeof cityMap.nearbyRoads==='function') {
        const raised=cityMap.nearbyRoads(x,z,radius).filter(s=>
          !/tunnel|underground/i.test(String(s.mode||''))&&
          Math.max((s.y1||0)-height(s.x1,s.z1),(s.y2||0)-height(s.x2,s.z2))>.15);
        updateLocalColliders(activeCity.roads,raised,roadBox,'road');
      }
      updateLocalColliders(activeCity.guardrails,nearbyItems(cityMap.nearbyGuardrails?.bind(cityMap),cityMap.guardrails||[],x,z,radius),r=>
        box(r.x,r.y,r.z,r.width/2,r.height/2,r.length/2,r.pitch||0,r.yaw||0),'guardrail');
      updateLocalColliders(activeCity.supports,nearbyItems(cityMap.nearbySupports?.bind(cityMap),cityMap.supports||[],x,z,radius),s=>
        box(s.x,s.y,s.z,s.width/2,s.height/2,s.depth/2),'support');
    }
    if (isCity && !streamingCity) {
      for (const building of cityMap.buildings) box(building.x,(building.baseY||0)+building.height/2,building.z,building.width/2,building.height/2,building.depth/2);
      for (const segment of cityMap.highwaySegments) roadBox(segment);
      for (const rail of cityMap.guardrails || []) box(rail.x,rail.y,rail.z,rail.width/2,rail.height/2,rail.length/2,rail.pitch||0,rail.yaw||0);
      for (const support of cityMap.supports || []) box(support.x,support.y,support.z,support.width/2,support.height/2,support.depth/2);
    }
    // Every route slab uses the exact same vertices for rendering and collision.
    const bridges=[],stuntSlabs=[];
    if(options.map==='racetrack') for(let i=0;i<stuntRoute.length;i++) {
      const a=stuntRoute[i];let j=i+1,b=stuntRoute[j%stuntRoute.length];
      // Coalesce flat/constant-grade straight pieces. Curves, width tapers and
      // grade changes retain their authored samples; the public route is unchanged.
      while(j+1<stuntRoute.length){
        const c=stuntRoute[j+1],ab=Math.hypot(b.x-a.x,b.z-a.z),bc=Math.hypot(c.x-b.x,c.z-b.z);
        if(a.kind==='gap'||b.kind!==c.kind||Math.abs(a.tx-b.tx)>1e-8||Math.abs(a.tz-b.tz)>1e-8||Math.abs(b.tx-c.tx)>1e-8||Math.abs(b.tz-c.tz)>1e-8||Math.abs((b.y-a.y)/ab-(c.y-b.y)/bc)>1e-8||Math.abs((b.width-a.width)/ab-(c.width-b.width)/bc)>1e-8)break;
        b=c;j++;
      }
      const startIndex=i;i=j-1;
      if(Math.abs(a.x)<.001&&Math.abs(b.x)<.001&&a.z<=80&&b.z>=72)continue;
      const vertices=[];
      for(const bottom of [true,false])for(const [p,side] of [[a,-1],[b,-1],[b,1],[a,1]])
        vertices.push(new C.Vec3(p.x-p.tz*p.width/2*side,p.y-(bottom?.6:0),p.z+p.tx*p.width/2*side));
      const faces=[[0,1,2,3],[7,6,5,4],[4,5,1,0],[5,6,2,1],[6,7,3,2],[7,4,0,3]];
      const body=new C.Body({mass:0,material:terrainMaterial});
      // Center local geometry to keep broadphase bounds tight.
      const center=new C.Vec3((a.x+b.x)/2,(a.y+b.y)/2-.3,(a.z+b.z)/2);
      vertices.forEach(v=>v.vsub(center,v));
      body.addShape(new C.ConvexPolyhedron(vertices,faces));body.position.copy(center);world.addBody(body);
      stuntSlabs.push({index:startIndex,endIndex:j,a,b,vertices,faces,body});
    }
    const stuntSupports=[];
    if(options.map==='racetrack')for(const [x,z,top] of [[-65,0,9],[65,0,9],[0,-65,4],[0,-85,4]]){
      const h=top-.6-stuntFeatures.floor, support={x,z,y:stuntFeatures.floor+h/2,hx:.6,hy:h/2,hz:.6};
      support.body=box(x,support.y,z,support.hx,support.hy,support.hz);stuntSupports.push(support);
    }
    function roadHeight(x,z) {
      if(isCity) {
        const ground=height(x,z);
        if(typeof cityMap.nearbyRoads!=='function')return ground;
        let best=Infinity,top=ground;
        for(const road of cityMap.nearbyRoads(x,z,40)) {
          const dx=road.x2-road.x1,dz=road.z2-road.z1,length2=dx*dx+dz*dz;
          const t=Math.max(0,Math.min(1,((x-road.x1)*dx+(z-road.z1)*dz)/(length2||1)));
          const distance=Math.hypot(x-road.x1-dx*t,z-road.z1-dz*t);
          if(distance<best && distance<=road.width/2+1) {best=distance;top=Math.max(ground,road.y1+(road.y2-road.y1)*t);}
        }
        return top;
      }
      if(options.map!=='racetrack')return height(x,z);
      // Reset only onto a physical road, never into the recovery floor.
      let best=Infinity,y=height(x,z),width=0;
      for(const slab of stuntSlabs){const a=slab.a,b=slab.b,dx=b.x-a.x,dz=b.z-a.z;
        const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
        const d=Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
        if(d<best){best=d;y=a.y+(b.y-a.y)*t;width=(a.width+(b.width-a.width)*t)/2;}}
      return best<=width?y:height(x,z);
    }
    const obstacles = [];
    function addObstacle(x,z,hx=1.25,hy=.85,hz=1.25) {
      const obstacle={x,z,hx,hy,hz,y:roadHeight(x,z)+hy};
      obstacles.push(obstacle);box(x,obstacle.y,z,hx,hy,hz);return obstacle;
    }
    // Invisible perimeter only at the edge of the matching visible terrain.
    let wallBottom=-1,wallTop=options.map === 'mountain'?119:course?9:69;
    if(cityTerrain) {
      let minY=Infinity,maxY=-Infinity;
      for(const column of data)for(const y of column){minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
      wallBottom=minY-20;wallTop=maxY+40;
    }
    const wallCenter=(wallBottom+wallTop)/2,wallHalf=(wallTop-wallBottom)/2;
    box(-edge,wallCenter,0,1,wallHalf,edge);box(edge,wallCenter,0,1,wallHalf,edge);box(0,wallCenter,-edge,edge,wallHalf,1);box(0,wallCenter,edge,edge,wallHalf,1);
    const body=new C.Body({mass:spec.mass,material:chassisMaterial,linearDamping:.015,angularDamping:.25});
    // Bevel the low bumper/side edges instead of a full-length square belly.
    // The old bottom corners caught shallow grades before the wheels could
    // compress, turning forward momentum into a large pitch impulse. Keep the
    // upper footprint solid, with a modest skid-like approach/departure bevel.
    const hx=spec.width/2-.05,hz=spec.length/2-.15,vertices=[];
    for(const [x,y,z] of [[hx-.12,-.47,hz-.5],[hx,-.10,hz],[hx,.47,hz]]) {
      vertices.push(new C.Vec3(-x,y,-z),new C.Vec3(x,y,-z),new C.Vec3(x,y,z),new C.Vec3(-x,y,z));
    }
    const faces=[[3,2,1,0],[8,9,10,11]];
    for(let ring=0;ring<2;ring++)for(let i=0;i<4;i++) {
      const a=ring*4+i,b=ring*4+(i+1)%4;faces.push([a,b,b+4,a+4]);
    }
    // Reverse to outward winding (bottom faces down, top faces up).
    faces.forEach(face=>face.reverse());
    body.addShape(new C.ConvexPolyhedron(vertices,faces)); world.addBody(body);
    const car=new C.RaycastVehicle({chassisBody:body,indexRightAxis:0,indexUpAxis:1,indexForwardAxis:2});
    spec.wheelLayout.forEach(wheel=>car.addWheel({radius:wheel.radius,directionLocal:new C.Vec3(0,-1,0),axleLocal:new C.Vec3(-1,0,0),chassisConnectionPointLocal:new C.Vec3(wheel.x,-.15+wheel.y,wheel.z),suspensionStiffness:32,suspensionRestLength:.42,frictionSlip:spec.grip,dampingRelaxation:3.5,dampingCompression:4.5,maxSuspensionForce:45000,rollInfluence:.15,maxSuspensionTravel:.3,customSlidingRotationalSpeed:30,useCustomSlidingRotationalSpeed:true}));
    car.addToWorld(world);
    let accumulator=0,steer=0,grounded=0,airTime=0;
    const previousPosition=new C.Vec3(), previousQuaternion=new C.Quaternion();
    const renderPosition=new C.Vec3(),renderQuaternion=new C.Quaternion();
    const previousWheels=car.wheelInfos.map(()=>({})),renderWheels=car.wheelInfos.map(()=>({}));
    function snapshot() {
      previousPosition.copy(body.position); previousQuaternion.copy(body.quaternion);
      car.wheelInfos.forEach((w,i)=>{for(const key of ['suspensionLength','steering','rotation'])previousWheels[i][key]=w[key];});
    }
    function interpolate(alpha) {
      previousPosition.lerp(body.position,alpha,renderPosition);
      // Normalized shortest-arc lerp is sufficient over a single 120 Hz step.
      const q=body.quaternion,p=previousQuaternion;
      const sign=p.x*q.x+p.y*q.y+p.z*q.z+p.w*q.w<0?-1:1;
      for(const key of ['x','y','z','w'])renderQuaternion[key]=p[key]+(sign*q[key]-p[key])*alpha;
      renderQuaternion.normalize();
      car.wheelInfos.forEach((w,i)=>{for(const key of ['suspensionLength','steering','rotation'])renderWheels[i][key]=previousWheels[i][key]+(w[key]-previousWheels[i][key])*alpha;});
    }
    function syncRenderState(){snapshot();interpolate(1);}
    const citySpawn=streamingCity && cityMap.routeSamples?.[0];
    function reset(x=citySpawn?.x??0,z=citySpawn?.z??-28,heading=citySpawn?Math.atan2(citySpawn.tx,citySpawn.tz):0){refreshCityColliders(x,z,true);body.position.set(x,roadHeight(x,z)+spec.radius+.6,z);body.quaternion.setFromEuler(0,heading,0);body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.wakeUp();accumulator=0;steer=0;grounded=0;airTime=0;car.wheelInfos.forEach(w=>{w.rotation=0;w.deltaRotation=0;w.suspensionLength=w.suspensionRestLength;w.steering=0;});syncRenderState();}
    function step(dt,input={}) {
      accumulator+=Math.min(Math.max(dt,0),.1);
      while(accumulator>=1/120){
        snapshot();
        refreshCityColliders(body.position.x,body.position.z);
        const forward=body.quaternion.vmult(new C.Vec3(0,0,1));const speed=body.velocity.dot(forward);
        grounded=car.wheelInfos.filter(w=>w.isInContact).length;
        steer+=( (input.steer||0)*.48/(1+Math.abs(speed)/18)-steer)*Math.min(1,7/120);
        const throttle=input.throttle||0;
        const opposing=throttle*speed < -.8;
        airTime=grounded?0:airTime+1/120;
        const offroad=!course && options.distanceToRoad && options.distanceToRoad(body.position.x,body.position.z)>(options.roadHalfWidth || 6.2)+1.1;
        const surface=offroad?(selectedCar==='rally'?.78:.6):1;
        const limit=throttle<0?12:spec.maxSpeed*surface;
        const engine=!input.brake&&!opposing ? -throttle*spec.engine*Math.max(0,1-(Math.abs(speed)/limit)**2):0;
        const brakeForce=input.brake?spec.mass*.028:opposing?spec.mass*.02:0;
        car.wheelInfos.forEach((w,i)=>{w.frictionSlip=spec.grip*(offroad?.75:1);car.setSteeringValue(w.chassisConnectionPointLocal.z>0?steer:0,i);car.applyEngineForce(engine,i);car.setBrake(brakeForce,i);});
        // Keep light rolling resistance separate from wheel braking so coasting wheels keep turning.
        const v=body.velocity;const drag=.42*v.length()+(offroad?spec.mass*.10:0);
        const horizontalSpeed=Math.hypot(v.x,v.z);
        const rolling=grounded&&!throttle&&!input.brake&&horizontalSpeed>.001
          ? spec.mass*Math.min(.45/horizontalSpeed,120):0;
        body.force.x-=v.x*(drag+rolling);body.force.y-=v.y*drag;body.force.z-=v.z*(drag+rolling);
        if(options.antiFlip!==false) {
          const up=body.quaternion.vmult(new C.Vec3(0,1,0));
          // Resist a developing rollover while the tires still have support.
          // A short, low hop keeps a little damping after contact is lost;
          // elevated ramps and fully airborne stunts keep their own motion.
          let support=0;
          if(grounded>=2) support=1;
          else if(grounded===1) support=.8;
          else if(isCity && airTime<.22 && body.position.y-height(body.position.x,body.position.z)<spec.radius+1.7) support=.4;
          if(support && up.y>.25) {
            const inverse=body.quaternion.conjugate();
            const localUp=inverse.vmult(new C.Vec3(0,1,0));
            const localRate=inverse.vmult(body.angularVelocity);
            const pace=Math.min(1.4,Math.max(.65,horizontalSpeed/20));
            const rollTorque=Math.max(-14000,Math.min(14000,
              -(localUp.x*8200+localRate.z*3400)*pace*support));
            body.torque.vadd(body.quaternion.vmult(new C.Vec3(0,0,rollTorque)),body.torque);
          }
        }
        // Air control is torque, never an orientation snap. Existing touch buttons work too.
        if(!grounded){
          // Carrying throttle off a ramp used to immediately pitch the nose down.
          // Briefly blend in air controls, then retain enough authority for full flips.
          const blend=Math.min(1,Math.max(0,(airTime-.15)/.35));
          const localRate=body.quaternion.conjugate().vmult(body.angularVelocity);
          const clamp=(n,cap)=>Math.max(-cap,Math.min(cap,n));
          const assist=options.antiFlip===false?0:1;
          const torque=body.quaternion.vmult(new C.Vec3(
            throttle*2300*blend-assist*clamp(localRate.x*450,650),0,
            -(input.steer||0)*1600*blend-assist*clamp(localRate.z*350,500)));
          body.torque.vadd(torque,body.torque);
        }
        world.step(1/120);accumulator-=1/120;
      }
      grounded=car.wheelInfos.filter(w=>w.isInContact).length;
      interpolate(accumulator*120);

      return {speed:body.velocity.dot(body.quaternion.vmult(new C.Vec3(0,0,1))),grounded};
    }
    function addTree(x,z,r=.45,h=8){return box(x,height(x,z)+h/2,z,r,h/2,r);}
    const watchTiles=cityMap.onTileChanged || cityMap.onTileLoaded;
    const stopTileListener=streamingCity && watchTiles?.call(cityMap,()=>refreshCityColliders(body.position.x,body.position.z,true,false));
    function dispose(){if(typeof stopTileListener==='function')stopTileListener();}
    reset();return {world,body,car,step,reset,dispose,addTree,edge,obstacles,addObstacle,bridges,stuntSlabs,stuntSupports,roadHeight,terrainHeight:height,ramp,spec,renderPosition,renderQuaternion,renderWheels,syncRenderState};
  }
  return {create,terrainHeight,scenicHeight,ramp,vehicles,mountainPoints,stuntBumps,overpasses,stuntRoute,stuntFeatures,stuntProfile,city:City};
});
