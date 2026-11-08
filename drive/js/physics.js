/* CANNON-backed test-course physics. Metres, seconds, kilograms. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('cannon'));
  else root.DrivePhysics = factory(root.CANNON);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(C) {
  'use strict';
  const terrainHeight = (x,z) => 7 * Math.exp(-((x-37)**2/420 + (z-32)**2/700)) + 4 * Math.exp(-((x+35)**2/380 + (z-65)**2/280));
  const ramp = {x:0,y:2.02,z:26,halfWidth:4,halfLength:10,angle:-.22};
  function create() {
    const world = new C.World(); world.gravity.set(0,-9.81,0);
    world.broadphase = new C.SAPBroadphase(world); world.solver.iterations=15;
    world.defaultContactMaterial.friction=.5; world.defaultContactMaterial.restitution=.08;
    const data=[];
    for(let i=0;i<=160;i++){data[i]=[];for(let j=0;j<=160;j++)data[i][j]=terrainHeight(i*2-160,160-j*2);}
    const floor=new C.Body({mass:0}); floor.addShape(new C.Heightfield(data,{elementSize:2})); floor.position.set(-160,0,160); floor.quaternion.setFromEuler(-Math.PI/2,0,0); world.addBody(floor);
    function box(x,y,z,hx,hy,hz,angle=0) {const body=new C.Body({mass:0});body.addShape(new C.Box(new C.Vec3(hx,hy,hz)));body.position.set(x,y,z);body.quaternion.setFromEuler(angle,0,0);world.addBody(body);return body;}
    box(ramp.x,ramp.y,ramp.z,ramp.halfWidth,.18,ramp.halfLength,ramp.angle);
    // Invisible perimeter only at the edge of the matching visible terrain.
    box(-160,4,0,1,5,160);box(160,4,0,1,5,160);box(0,4,-160,160,5,1);box(0,4,160,160,5,1);
    const body=new C.Body({mass:1200,linearDamping:.015,angularDamping:.25});
    body.addShape(new C.Box(new C.Vec3(1.08,.47,2.45))); world.addBody(body);
    const car=new C.RaycastVehicle({chassisBody:body,indexRightAxis:0,indexUpAxis:1,indexForwardAxis:2});
    [-1,1].forEach(side=>[-1.7,1.7].forEach(z=>car.addWheel({radius:.52,directionLocal:new C.Vec3(0,-1,0),axleLocal:new C.Vec3(-1,0,0),chassisConnectionPointLocal:new C.Vec3(side*1.16,-.15,z),suspensionStiffness:32,suspensionRestLength:.42,frictionSlip:3.2,dampingRelaxation:3.5,dampingCompression:4.5,maxSuspensionForce:45000,rollInfluence:.15,maxSuspensionTravel:.3,customSlidingRotationalSpeed:-30,useCustomSlidingRotationalSpeed:true})));
    car.addToWorld(world);
    let accumulator=0,steer=0,grounded=0;
    function reset(x=0,z=-28,heading=0){body.position.set(x,terrainHeight(x,z)+1.12,z);body.quaternion.setFromEuler(0,heading,0);body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.wakeUp();accumulator=0;steer=0;grounded=0;car.wheelInfos.forEach(w=>{w.rotation=0;w.deltaRotation=0;});}
    function step(dt,input={}) {
      accumulator+=Math.min(Math.max(dt,0),.1);
      while(accumulator>=1/120){
        const forward=body.quaternion.vmult(new C.Vec3(0,0,1));const speed=body.velocity.dot(forward);
        grounded=car.wheelInfos.filter(w=>w.isInContact).length;
        steer+=( (input.steer||0)*.48/(1+Math.abs(speed)/18)-steer)*Math.min(1,7/120);
        const throttle=input.throttle||0;
        const opposing=throttle*speed < -.8;
        const limit=throttle<0?12:61;
        const engine=!input.brake&&!opposing ? -throttle*2100*Math.max(0,1-(Math.abs(speed)/limit)**2):0;
        car.wheelInfos.forEach((w,i)=>{car.setSteeringValue(w.chassisConnectionPointLocal.z>0?steer:0,i);car.applyEngineForce(engine,i);car.setBrake(input.brake?24:opposing?18:grounded?1.4:0,i);});
        // Air drag, unlike the old exponential speed clamp, allows long coasting.
        const v=body.velocity;const drag=.42*v.length();body.force.x-=v.x*drag;body.force.y-=v.y*drag;body.force.z-=v.z*drag;
        // Air control is torque, never an orientation snap. Existing touch buttons work too.
        if(!grounded){const torque=body.quaternion.vmult(new C.Vec3(throttle*2300,0,-(input.steer||0)*1600));body.torque.vadd(torque,body.torque);}
        world.step(1/120);accumulator-=1/120;
      }
      grounded=car.wheelInfos.filter(w=>w.isInContact).length;

      return {speed:body.velocity.dot(body.quaternion.vmult(new C.Vec3(0,0,1))),grounded};
    }
    function addTree(x,z,r=.45,h=8){return box(x,terrainHeight(x,z)+h/2,z,r,h/2,r);}
    reset();return {world,body,car,step,reset,addTree,terrainHeight,ramp};
  }
  return {create,terrainHeight,ramp};
});
