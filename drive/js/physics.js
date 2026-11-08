/* Shared CANNON vehicle physics. Metres, seconds, kilograms. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('cannon'));
  else root.DrivePhysics = factory(root.CANNON);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(C) {
  'use strict';
  const terrainHeight = (x,z) => 7 * Math.exp(-((x-37)**2/420 + (z-32)**2/700)) + 4 * Math.exp(-((x+35)**2/380 + (z-65)**2/280));
  const ramp = {x:0,y:2.02,z:26,halfWidth:4,halfLength:10,angle:-.22};
  const vehicles = {
    comet: {mass:1200,width:2.25,length:5.2,wheelZ:1.7,radius:.52,maxSpeed:220/3.6,engine:2100,grip:3.2},
    rally: {mass:1350,width:2.35,length:4.85,wheelZ:1.55,radius:.58,maxSpeed:180/3.6,engine:2250,grip:3.6},
    pickup: {mass:1850,width:2.55,length:5.7,wheelZ:1.85,radius:.64,maxSpeed:155/3.6,engine:2800,grip:3.0}
  };
  function create(options={}) {
    const course = !options.map || options.map === 'course';
    const height = course ? terrainHeight : () => 0;
    let selectedCar=options.car || 'comet', spec=vehicles[selectedCar] || vehicles.comet;
    const world = new C.World(); world.gravity.set(0,-9.81,0);
    world.broadphase = new C.SAPBroadphase(world); world.solver.iterations=15;
    world.defaultContactMaterial.friction=.5; world.defaultContactMaterial.restitution=.08;
    if (course) {
    const data=[];
    for(let i=0;i<=160;i++){data[i]=[];for(let j=0;j<=160;j++)data[i][j]=terrainHeight(i*2-160,160-j*2);}
    const floor=new C.Body({mass:0}); floor.addShape(new C.Heightfield(data,{elementSize:2})); floor.position.set(-160,0,160); floor.quaternion.setFromEuler(-Math.PI/2,0,0); world.addBody(floor);
    } else {
      const floor=new C.Body({mass:0});floor.addShape(new C.Plane());floor.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(floor);
    }
    function box(x,y,z,hx,hy,hz,angle=0) {const body=new C.Body({mass:0});body.addShape(new C.Box(new C.Vec3(hx,hy,hz)));body.position.set(x,y,z);body.quaternion.setFromEuler(angle,0,0);world.addBody(body);return body;}
    if (course) box(ramp.x,ramp.y,ramp.z,ramp.halfWidth,.18,ramp.halfLength,ramp.angle);
    // Invisible perimeter only at the edge of the matching visible terrain.
    const edge=course?160:250;
    box(-edge,4,0,1,5,edge);box(edge,4,0,1,5,edge);box(0,4,-edge,edge,5,1);box(0,4,edge,edge,5,1);
    const body=new C.Body({mass:spec.mass,linearDamping:.015,angularDamping:.25});
    body.addShape(new C.Box(new C.Vec3(spec.width/2-.05,.47,spec.length/2-.15))); world.addBody(body);
    const car=new C.RaycastVehicle({chassisBody:body,indexRightAxis:0,indexUpAxis:1,indexForwardAxis:2});
    [-1,1].forEach(side=>[-spec.wheelZ,spec.wheelZ].forEach(z=>car.addWheel({radius:spec.radius,directionLocal:new C.Vec3(0,-1,0),axleLocal:new C.Vec3(-1,0,0),chassisConnectionPointLocal:new C.Vec3(side*(spec.width/2+.05),-.15,z),suspensionStiffness:32,suspensionRestLength:.42,frictionSlip:spec.grip,dampingRelaxation:3.5,dampingCompression:4.5,maxSuspensionForce:45000,rollInfluence:.15,maxSuspensionTravel:.3,customSlidingRotationalSpeed:-30,useCustomSlidingRotationalSpeed:true})));
    car.addToWorld(world);
    let accumulator=0,steer=0,grounded=0,airTime=0;
    function reset(x=0,z=-28,heading=0){body.position.set(x,height(x,z)+spec.radius+.6,z);body.quaternion.setFromEuler(0,heading,0);body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.wakeUp();accumulator=0;steer=0;grounded=0;airTime=0;car.wheelInfos.forEach(w=>{w.rotation=0;w.deltaRotation=0;});}
    function step(dt,input={}) {
      accumulator+=Math.min(Math.max(dt,0),.1);
      while(accumulator>=1/120){
        const forward=body.quaternion.vmult(new C.Vec3(0,0,1));const speed=body.velocity.dot(forward);
        grounded=car.wheelInfos.filter(w=>w.isInContact).length;
        steer+=( (input.steer||0)*.48/(1+Math.abs(speed)/18)-steer)*Math.min(1,7/120);
        const throttle=input.throttle||0;
        const opposing=throttle*speed < -.8;
        airTime=grounded?0:airTime+1/120;
        const offroad=!course && options.distanceToRoad && options.distanceToRoad(body.position.x,body.position.z)>7.3;
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

      return {speed:body.velocity.dot(body.quaternion.vmult(new C.Vec3(0,0,1))),grounded};
    }
    function addTree(x,z,r=.45,h=8){return box(x,height(x,z)+h/2,z,r,h/2,r);}
    reset();return {world,body,car,step,reset,addTree,terrainHeight:height,ramp,spec};
  }
  return {create,terrainHeight,ramp,vehicles};
});
