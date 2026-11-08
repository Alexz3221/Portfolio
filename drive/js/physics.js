/* Shared CANNON vehicle physics. Metres, seconds, kilograms. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('cannon'));
  else root.DrivePhysics = factory(root.CANNON);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(C) {
  'use strict';
  const terrainHeight = (x,z) => 7 * Math.exp(-((x-37)**2/420 + (z-32)**2/700)) + 4 * Math.exp(-((x+35)**2/380 + (z-65)**2/280));
  // Broad waves keep road grades manageable without flattening suspension physics.
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
    if (map === 'racetrack') {
      // Broad low-speed-drivable rollers and a larger launch crest on the long
      // western straight. These are the collision surface, not decorative ramps.
      const lane=Math.exp(-((x+164)**2)/380);
      return lane*(1.0*Math.exp(-((z+75)**2)/120)
        +1.6*Math.exp(-((z+30)**2)/100)
        +2.8*Math.exp(-((z-22)**2)/125));
    }
    if (map === 'lakeside') {
      const t=Math.max(0,Math.min(1,(Math.hypot(x-8,z-4)-40)/32));
      return t*t*(3-2*t)*(4.5+2.5*Math.sin(x/65)+2*Math.sin(z/58));
    }
    if (map === 'desert') return 7+4*Math.sin(x/90)+3*Math.sin(z/66);
    if (map === 'alpine') return 12.5+7.5*Math.sin(x/90)+5*Math.sin(z/75);
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
    const edge=course?160:(options.map === 'mountain' || options.map === 'racetrack')?200:250, cells=edge;
    const analyticHeight=course?terrainHeight:(x,z)=>scenicHeight(options.map,x,z);
    const data=Array.from({length:cells+1},(_,i)=>Array.from({length:cells+1},(_,j)=>analyticHeight(i*2-edge,edge-j*2)));
    // CANNON 0.6.2 getHeightAt is only an average. Match its actual triangles.
    function height(x,z) {
      const u=Math.max(0,Math.min(cells,(x+edge)/2)), v=Math.max(0,Math.min(cells,(edge-z)/2));
      const i=Math.min(cells-1,Math.floor(u)),j=Math.min(cells-1,Math.floor(v)),a=u-i,b=v-j;
      if(a+b<=1) return data[i][j]*(1-a-b)+data[i+1][j]*a+data[i][j+1]*b;
      return data[i+1][j+1]*(a+b-1)+data[i][j+1]*(1-a)+data[i+1][j]*(1-b);
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
    const floor=new C.Body({mass:0,material:terrainMaterial}); floor.addShape(new C.Heightfield(data,{elementSize:2})); floor.position.set(-edge,0,edge); floor.quaternion.setFromEuler(-Math.PI/2,0,0); world.addBody(floor);
    function box(x,y,z,hx,hy,hz,angle=0) {const body=new C.Body({mass:0,material:terrainMaterial});body.addShape(new C.Box(new C.Vec3(hx,hy,hz)));body.position.set(x,y,z);body.quaternion.setFromEuler(angle,0,0);world.addBody(body);return body;}
    if (course) box(ramp.x,ramp.y,ramp.z,ramp.halfWidth,.18,ramp.halfLength,ramp.angle);
    const obstacles = [];
    function addObstacle(x,z,hx=1.25,hy=.85,hz=1.25) {
      const obstacle={x,z,hx,hy,hz,y:height(x,z)+hy};
      obstacles.push(obstacle);box(x,obstacle.y,z,hx,hy,hz);return obstacle;
    }
    // Invisible perimeter only at the edge of the matching visible terrain.
    const wallHeight=options.map === 'mountain'?60:course?5:35;
    box(-edge,wallHeight-1,0,1,wallHeight,edge);box(edge,wallHeight-1,0,1,wallHeight,edge);box(0,wallHeight-1,-edge,edge,wallHeight,1);box(0,wallHeight-1,edge,edge,wallHeight,1);
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
    spec.wheelLayout.forEach(wheel=>car.addWheel({radius:wheel.radius,directionLocal:new C.Vec3(0,-1,0),axleLocal:new C.Vec3(-1,0,0),chassisConnectionPointLocal:new C.Vec3(wheel.x,-.15+wheel.y,wheel.z),suspensionStiffness:32,suspensionRestLength:.42,frictionSlip:spec.grip,dampingRelaxation:3.5,dampingCompression:4.5,maxSuspensionForce:45000,rollInfluence:.15,maxSuspensionTravel:.3,customSlidingRotationalSpeed:-30,useCustomSlidingRotationalSpeed:true}));
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
    function reset(x=0,z=-28,heading=0){body.position.set(x,height(x,z)+spec.radius+.6,z);body.quaternion.setFromEuler(0,heading,0);body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.wakeUp();accumulator=0;steer=0;grounded=0;airTime=0;car.wheelInfos.forEach(w=>{w.rotation=0;w.deltaRotation=0;w.suspensionLength=w.suspensionRestLength;w.steering=0;});syncRenderState();}
    function step(dt,input={}) {
      accumulator+=Math.min(Math.max(dt,0),.1);
      while(accumulator>=1/120){
        snapshot();
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
        car.wheelInfos.forEach((w,i)=>{w.frictionSlip=spec.grip*(offroad?.75:1);car.setSteeringValue(w.chassisConnectionPointLocal.z>0?steer:0,i);car.applyEngineForce(engine,i);car.setBrake(input.brake?24:opposing?18:grounded?1.4:0,i);});
        // Air drag, unlike the old exponential speed clamp, allows long coasting.
        const v=body.velocity;const drag=.42*v.length()+(offroad?spec.mass*.10:0);body.force.x-=v.x*drag;body.force.y-=v.y*drag;body.force.z-=v.z*drag;
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
    reset();return {world,body,car,step,reset,addTree,edge,obstacles,addObstacle,terrainHeight:height,ramp,spec,renderPosition,renderQuaternion,renderWheels,syncRenderState};
  }
  return {create,terrainHeight,scenicHeight,ramp,vehicles,mountainPoints};
});
