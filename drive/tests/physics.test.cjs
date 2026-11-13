const test=require('node:test');const assert=require('node:assert/strict');const P=require('../js/physics');
function run(p,n,input={}){let s;for(let i=0;i<n;i++)s=p.step(1/60,input);return s;}
test('four springs settle under gravity and reset removes all momentum',()=>{const p=P.create();const s=run(p,180);assert.equal(s.grounded,4);assert.ok(p.body.position.y>p.spec.radius+.42&&p.body.position.y<p.spec.radius+.56);assert.ok(Math.abs(p.body.velocity.y)<.01);p.body.angularVelocity.set(3,4,5);p.reset();assert.equal(p.body.velocity.length(),0);assert.equal(p.body.angularVelocity.length(),0);});
test('acceleration takes seconds, coasting preserves momentum, brakes stop and reverse works',()=>{const p=P.create();p.reset(-100,-100);run(p,120);run(p,180,{throttle:1});const speed=p.body.velocity.length();assert.ok(speed>17&&speed<22);run(p,60);const coast=p.body.velocity.length();assert.ok(coast>speed*.85&&coast<speed);run(p,180,{brake:true});assert.ok(p.body.velocity.length()<.2);run(p,120,{throttle:-1});assert.ok(p.body.velocity.z < -3);});
test('manual braking stops every car promptly from highway speed',()=>{
  for(const car of Object.keys(P.vehicles)){
    const p=P.create({map:'city',car});p.reset(80,-120);run(p,120);
    p.body.velocity.set(0,0,35);
    const start=p.body.position.z;
    let frames=0;
    while(frames<210&&p.body.velocity.length()>1){p.step(1/60,{brake:true});frames++;}
    assert.ok(p.body.velocity.length()<1,`${car} stopped in ${frames/60}s`);
    assert.ok(p.body.position.z-start<55,`${car} stopping distance ${p.body.position.z-start}m`);
  }
});
test('wheels keep rolling while coasting and turn the same way under airborne throttle',()=>{
  const p=P.create({map:'city'});p.reset(80,-120);run(p,120);
  p.body.velocity.set(0,0,15);p.syncRenderState();
  const before=p.car.wheelInfos.map(w=>w.rotation);
  run(p,60);
  p.car.wheelInfos.forEach((w,i)=>assert.ok(w.rotation<before[i]-20,`wheel ${i} rolled while coasting`));
  assert.ok(p.body.velocity.z>12&&p.body.velocity.z<15);
  p.reset(80,-120);p.body.position.set(80,20,-120);
  p.step(1/60,{throttle:1});
  p.car.wheelInfos.forEach((w,i)=>assert.ok(w.rotation<0,`wheel ${i} spins forward in air`));
});
test('ramp launches without teleporting and lands with gravity',()=>{const p=P.create();run(p,120);let launched=false,landed=false,maxY=0;for(let i=0;i<700;i++){const state=p.step(1/60,{throttle:p.body.position.z<30?1:0});maxY=Math.max(maxY,p.body.position.y);if(p.body.position.z>35&&!state.grounded)launched=true;if(launched&&p.body.position.z>50&&state.grounded)landed=true;assert.ok(Number.isFinite(p.body.position.y));}assert.ok(launched);assert.ok(maxY>5);assert.ok(landed);});
test('air controls apply torque and allow real full rotations',()=>{const p=P.create();p.body.position.set(0,100,0);let rotation=0,maxTilt=0;for(let i=0;i<180;i++){p.step(1/60,{throttle:1,steer:1});rotation+=p.body.angularVelocity.length()/60;maxTilt=Math.max(maxTilt,Math.abs(p.body.quaternion.x)+Math.abs(p.body.quaternion.z));}assert.ok(rotation>Math.PI*2);assert.ok(p.body.angularVelocity.length()>2);assert.ok(p.body.position.y<95);assert.ok(maxTilt>.25);});
test('trunk collision stops a car and does not tunnel at driving speed',()=>{const p=P.create();p.reset(-100,-80);p.addTree(-100,-65,.45,8);run(p,120);p.body.velocity.set(0,0,35);run(p,60);assert.ok(p.body.position.z < -65);assert.ok(p.body.velocity.z<5);});
test('terrain has actual elevation and physics is stable at different render rates',()=>{assert.ok(P.terrainHeight(37,32)>7);const results=[30,60,120].map(fps=>{const p=P.create();p.reset(-100,-100);for(let i=0;i<fps*5;i++)p.step(1/fps,{throttle:i>fps?1:0});return p.body.position.z;});assert.ok(Math.max(...results)-Math.min(...results)<1);});

test('wheels rest on the hill rather than the flat world origin',()=>{const p=P.create();p.reset(37,32);const s=run(p,120);assert.ok(p.body.position.y>7.8);assert.ok(s.grounded>=2);});

test('gentle neutral air assist damps rotation but does not snap upright',()=>{
  const rates=[false,true].map(antiFlip=>{const p=P.create({antiFlip});p.body.position.set(0,100,0);p.body.angularVelocity.set(2,0,1);run(p,60);assert.ok(Math.abs(p.body.quaternion.x)>.1);return p.body.angularVelocity.length();});
  assert.ok(rates[1]<rates[0]*.95);assert.ok(rates[1]>rates[0]*.5);
});
test('grounded anti-roll keeps a fast car on its wheels after a sideways impulse',()=>{
  const C=require('cannon');
  const outcomes=[false,true].map(antiFlip=>{
    const p=P.create({map:'city',antiFlip});p.reset(80,-120);run(p,120);
    p.body.velocity.set(0,0,25);
    p.body.angularVelocity.set(0,0,6);
    let maxTilt=0,leastContact=4;
    for(let i=0;i<90;i++){
      const state=p.step(1/60);
      const up=p.body.quaternion.vmult(new C.Vec3(0,1,0));
      maxTilt=Math.max(maxTilt,Math.acos(Math.max(-1,Math.min(1,up.y))));
      leastContact=Math.min(leastContact,state.grounded);
    }
    return {maxTilt,leastContact};
  });
  assert.ok(outcomes[0].maxTilt>Math.PI/2,'the impulse rolls an unstabilized car');
  assert.ok(outcomes[1].maxTilt<Math.PI/3,'assisted car stays short of a rollover');
  assert.ok(outcomes[1].maxTilt<outcomes[0].maxTilt*.4,'the assist materially reduces tilt');
  assert.ok(outcomes[1].leastContact>=2,'the assisted car retains tire contact');
});
test('all cars settle, accelerate, brake and reverse on the fixture and city',()=>{
  for(const map of ['course','city'])for(const car of Object.keys(P.vehicles)){
    const p=P.create({map,car});p.reset(map==='city'?-80:-100,map==='city'?-120:-100);let s=run(p,120);assert.equal(s.grounded,4,`${map}/${car} settled`);
    assert.equal(p.body.mass,P.vehicles[car].mass);assert.equal(p.car.wheelInfos[0].radius,P.vehicles[car].wheelLayout[0].radius);
    run(p,120,{throttle:1});assert.ok(p.body.velocity.z>8,`${map}/${car} accelerates`);
    run(p,180,{brake:true});assert.ok(p.body.velocity.length()<.2);
    run(p,120,{throttle:-1});assert.ok(p.body.velocity.z < -3);
  }
});
test('city extends past the old fixture boundary and keeps off-road resistance',()=>{
  const speeds=[false,true].map(dirt=>{const p=P.create({map:'city',distanceToRoad:()=>dirt?20:0});p.reset(320,-120);run(p,120);assert.ok(p.body.position.y>p.terrainHeight(p.body.position.x,p.body.position.z)+.7);p.body.velocity.set(0,0,20);run(p,60);assert.ok(p.body.position.x>319);return p.body.velocity.length();});assert.ok(speeds[1]<speeds[0]);
});

test('map sampler matches actual collider rays, including both triangles and boundaries',()=>{
  const C=require('cannon');
  for(const map of ['mountain']){
    const p=P.create({map});p.body.position.set(0,1000,0);
    const result=new C.RaycastResult();
    for(let i=0;i<100;i++){
      const x=-197.7+(i*71.137)%395,z=-197.3+(i*43.713)%395;
      result.reset();
      assert.ok(p.world.raycastClosest(new C.Vec3(x,250,z),new C.Vec3(x,-100,z),{},result));
      assert.ok(Math.abs(result.hitPointWorld.y-p.terrainHeight(x,z))<1e-8,`${map}: ray mismatch`);
    }
    for(const x of [-200,200])for(const z of [-200,200])assert.ok(Number.isFinite(p.terrainHeight(x,z)));
  }
  const city=P.create({map:'city'});
  const result=new C.RaycastResult();
  for(let z=-400;z<=400;z+=40){
    result.reset();
    assert.ok(city.world.raycastClosest(new C.Vec3(80,25,z),new C.Vec3(80,-10,z),{},result));
    assert.ok(Math.abs(result.hitPointWorld.y-city.terrainHeight(80,z))<1e-8,'city road is level and raycastable');
  }
  for(const x of [-400,400])for(const z of [-400,400])assert.equal(city.terrainHeight(x,z),0);
  assert.equal(P.scenicHeight('city',8,4),0);
  assert.equal(P.scenicHeight('city',380,-100),0);
});

test('city ground stays flat and every car keeps suspension contact',()=>{
  const p=P.create({map:'city'});
  for(let x=-400;x<=400;x+=40)for(let z=-400;z<=400;z+=40)assert.equal(p.terrainHeight(x,z),0);
  for(const car of Object.keys(P.vehicles)){
    const v=P.create({map:'city',car});v.reset(80,-120);run(v,120);
    let groundedFrames=0;
    for(let i=0;i<240;i++){
      const state=v.step(1/60,{throttle:1});groundedFrames+=state.grounded>=2;
      assert.ok(v.body.position.y>.4,`city/${car} above surface`);
    }
    assert.ok(groundedFrames>230,`city/${car} sustained contact`);
  }
});

test('city towers and elevated road have physical collision surfaces',()=>{
  const C=require('cannon'), city=require('../js/city');
  const p=P.create({map:'city'});p.body.position.set(0,1000,0);
  const ray=(x,z,start,end)=>{
    const result=new C.RaycastResult();
    assert.ok(p.world.raycastClosest(new C.Vec3(x,start,z),new C.Vec3(x,end,z),{},result));
    return result.hitPointWorld.y;
  };
  const building=city.buildings.find(b=>b.height>20);
  assert.ok(building,'a substantial tower is present');
  assert.ok(Math.abs(ray(building.x,building.z,building.height+20,building.height-10)-building.height)<.01,'tower roof is solid');
  const elevated=city.highwaySegments.find(s=>s.topStart>=8&&s.topEnd>=8);
  assert.ok(elevated,'city has an elevated highway section');
  const top=(elevated.topStart+elevated.topEnd)/2;
  assert.ok(Math.abs(ray(elevated.x,elevated.z,top+10,1)-top)<.1,'highway top is driveable');
});

test('imported terrain, graded streets, towers, and diagonal bridge agree with collider rays',()=>{
  const C=require('cannon');
  const street={x1:-3,y1:1.5,z1:3,x2:3,y2:3,z2:3,width:4};
  const bridge={x1:-2,z1:-2,x2:2,z2:2,width:3,topStart:4,topEnd:6};
  const tower={x:-2,z:-2,width:2,depth:2,height:8,baseY:3};
  const terrain={elementSize:2,originX:-4,maxZ:4,data:Array.from({length:5},(_,i)=>Array.from({length:5},(_,j)=>i*.5+j*.25-4))};
  const city={edge:30,terrain,roadHalfWidth:2,buildings:[tower],roadSegments:[street],highwaySegments:[bridge],guardrails:[],supports:[],
    nearbyBuildings:()=>[tower],nearbyRoads:()=>[street],nearbyHighways:()=>[bridge],onTileChanged:()=>()=>{},ensureNear:()=>Promise.resolve([])};
  const p=P.create({map:'city',city});p.body.position.set(100,100,100);
  const ray=(x,z,start,end)=>{const hit=new C.RaycastResult();assert.ok(p.world.raycastClosest(new C.Vec3(x,start,z),new C.Vec3(x,end,z),{},hit));return hit.hitPointWorld.y;};
  assert.ok(Math.abs(p.terrainHeight(0,0)+2.5)<1e-8);
  assert.ok(Math.abs(ray(.3,.4,3,-10)-p.terrainHeight(.3,.4))<1e-6,'terrain heightfield is solid');
  assert.ok(Math.abs(ray(0,3,8,1)-2.25)<.02,'graded street surface is solid');
  assert.ok(Math.abs(ray(-2,-2,20,9)-11)<.02,'tower respects source base elevation');
  assert.ok(Math.abs(ray(0,0,12,3)-5)<.02,'diagonal bridge follows source heading and elevation');
  let warnings=0;const originalError=console.error;
  try {
    console.error=()=>{warnings++;};
    p.reset(.3,-3.3);
    let grounded=0;for(let i=0;i<120;i++)grounded=Math.max(grounded,p.step(1/60).grounded);
    assert.ok(grounded>=2,'wheels settle on negative imported terrain');
  } finally {console.error=originalError;}
  assert.equal(warnings,0,'negative heights never invert CANNON terrain pillars');
});

test('streamed city colliders follow tile load and unload without retaining distant towers',()=>{
  const C=require('cannon');
  const first={x:0,z:0,width:8,depth:8,height:12},second={x:300,z:0,width:8,depth:8,height:15};
  const buildings=[first,second];let changed=null,loads=0;
  const city={edge:500,roadHalfWidth:8,buildings,roadSegments:[],highwaySegments:[],guardrails:[],supports:[],
    nearbyBuildings:(x,z,r)=>buildings.filter(b=>Math.hypot(b.x-x,b.z-z)<r),
    onTileChanged(fn){changed=fn;return()=>{changed=null;};},ensureNear(){loads++;return Promise.resolve([]);}};
  const p=P.create({map:'city',city});
  assert.ok(loads>0,'first district is requested');
  const startingBodies=p.world.bodies.length;
  p.reset(300,0);
  assert.equal(p.world.bodies.length,startingBodies,'distant tower collider is replaced');
  const roof=new C.RaycastResult();
  p.world.raycastClosest(new C.Vec3(300,30,0),new C.Vec3(300,5,0),{},roof);
  assert.ok(Math.abs(roof.hitPointWorld.y-15)<.01,'new district tower is solid');
  buildings.splice(buildings.indexOf(second),1);
  changed({type:'unload'});
  assert.equal(p.world.bodies.length,startingBodies-1,'unloaded tower collider is removed while parked');
  p.dispose();
  assert.equal(changed,null,'tile listener is released with physics world');
});

test('trimmed highway decks leave a physical opening for a lane-graph merge',()=>{
  const C=require('cannon');
  const bridge={x1:0,y1:5,z1:0,x2:0,y2:5,z2:100,width:12,
    topStart:5,topEnd:5,visibleIntervals:[[0,.35],[.65,1]]};
  const highways=[bridge];let changed=null;
  const city={edge:150,roadHalfWidth:6,buildings:[],roadSegments:[],highwaySegments:highways,
    guardrails:[],supports:[],nearbyBuildings:()=>[],nearbyRoads:()=>[],
    nearbyHighways:()=>highways,onTileChanged(fn){changed=fn;return()=>{changed=null;}},
    ensureNear:()=>Promise.resolve([])};
  const p=P.create({map:'city',city});
  const surface=(z)=>{
    const hit=new C.RaycastResult();
    assert.ok(p.world.raycastClosest(new C.Vec3(0,12,z),new C.Vec3(0,-2,z),{},hit));
    return hit.hitPointWorld.y;
  };
  assert.ok(Math.abs(surface(20)-5)<.02,'approach keeps its bridge collider');
  assert.ok(Math.abs(surface(50))<.02,'removed merge deck has no invisible slab');
  assert.ok(Math.abs(surface(80)-5)<.02,'exit keeps its bridge collider');
  const approach={width_m:3,samples:[
    {x:0,y:5.08,z:35,sourceY:5},{x:0,y:5.08,z:50,sourceY:5},
    {x:0,y:5.08,z:65,sourceY:5}]};
  const approaches=[approach];
  city.nearbyLaneApproaches=()=>approaches;
  changed({type:'load'});
  assert.ok(Math.abs(surface(50)-5.08)<.02,
    'a native lane approach supports the car in the trimmed deck opening');
  approaches.length=0;
  highways.length=0;
  changed({type:'unload'});
  assert.ok(Math.abs(surface(20))<.02,'both collider pieces unload together');
  p.dispose();
});

test('imported building collision follows its rotated footprint instead of blocking the street beside it',()=>{
  const C=require('cannon');
  const diamond={x:0,z:0,width:10,depth:10,height:10,baseY:0,
    footprint:[[0,-5],[5,0],[0,5],[-5,0]]};
  const city={edge:100,buildings:[diamond],roadSegments:[],highwaySegments:[],guardrails:[],supports:[],
    nearbyBuildings:()=>[diamond],nearbyRoads:()=>[],nearbyHighways:()=>[],
    onTileChanged:()=>()=>{},ensureNear:()=>Promise.resolve([])};
  const p=P.create({map:'city',city});
  function roof(x,z){const hit=new C.RaycastResult();
    assert.ok(p.world.raycastClosest(new C.Vec3(x,20,z),new C.Vec3(x,-2,z),{},hit));
    return hit.hitPointWorld.y;
  }
  assert.ok(Math.abs(roof(0,0)-10)<.01,'tower is solid inside its footprint');
  assert.ok(Math.abs(roof(4.5,4.5))<.01,'empty axis-aligned corner stays open to drive through');
  p.dispose();
});

test('mesh-backed special building lot does not create an invisible enclosing wall',()=>{
  const C=require('cannon');
  const parent={x:0,z:0,width:20,depth:20,height:12,baseY:0,skipCollider:true,
    footprint:[[-10,-10],[10,-10],[10,10],[-10,10]]};
  const proxy={x:0,z:0,width:4,depth:4,height:12,baseY:0,
    footprint:[[-2,-2],[2,-2],[2,2],[-2,2]]};
  const city={edge:100,buildings:[parent,proxy],roadSegments:[],highwaySegments:[],guardrails:[],supports:[],
    nearbyBuildings:()=>[parent,proxy],nearbyRoads:()=>[],nearbyHighways:()=>[],
    onTileChanged:()=>()=>{},ensureNear:()=>Promise.resolve([])};
  const p=P.create({map:'city',city});
  function roof(x,z){const hit=new C.RaycastResult();
    assert.ok(p.world.raycastClosest(new C.Vec3(x,20,z),new C.Vec3(x,-2,z),{},hit));
    return hit.hitPointWorld.y;
  }
  assert.ok(Math.abs(roof(0,0)-12)<.01,'visible proxy remains solid');
  assert.ok(Math.abs(roof(8,8))<.01,'empty parent lot remains driveable');
  p.dispose();
});

test('buried tunnel geometry cannot create an invisible road slab',()=>{
  const C=require('cannon');
  const tunnel={x1:-10,z1:0,y1:3,x2:10,z2:0,y2:3,width:8,mode:'TUNNEL'};
  const terrain={elementSize:10,originX:-20,maxZ:20,
    data:Array.from({length:5},()=>Array(5).fill(0))};
  const city={edge:30,terrain,buildings:[],roadSegments:[tunnel],highwaySegments:[],guardrails:[],supports:[],
    nearbyBuildings:()=>[],nearbyRoads:()=>[tunnel],nearbyHighways:()=>[],
    onTileChanged:()=>()=>{},ensureNear:()=>Promise.resolve([])};
  const p=P.create({map:'city',city});
  const hit=new C.RaycastResult();
  assert.ok(p.world.raycastClosest(new C.Vec3(0,10,0),new C.Vec3(0,-2,0),{},hit));
  assert.ok(Math.abs(hit.hitPointWorld.y)<.01,'only the terrain surface is collidable');
  p.dispose();
});

test('a car climbs the city highway ramp and continues on its raised deck',()=>{
  const city=require('../js/city');
  const p=P.create({map:'city',distanceToRoad:city.distanceToRoad,roadHalfWidth:city.roadHalfWidth});
  p.reset(0,-414,0);
  let grounded=0;
  for(let frame=0;frame<1200;frame++){
    const state=p.step(1/120,{throttle:1});
    if(frame>240 && state.grounded>=2) grounded++;
  }
  assert.ok(p.body.position.z>-210,'car reaches the raised middle span');
  assert.ok(p.body.position.y>10,'car stays on the highway above the lower street');
  assert.ok(grounded>800,'tires retain contact through the climb and deck');
});

test('render interpolation advances between fixed steps without changing physics',()=>{
  const p=P.create();p.body.position.set(0,100,0);p.body.velocity.set(0,0,12);p.syncRenderState();
  p.step(1/120);const before=p.renderPosition.z,bodyZ=p.body.position.z;
  p.step(1/240);assert.equal(p.body.position.z,bodyZ);
  assert.ok(p.renderPosition.z>before&&p.renderPosition.z<bodyZ);
  const n=Math.hypot(p.renderQuaternion.x,p.renderQuaternion.y,p.renderQuaternion.z,p.renderQuaternion.w);
  assert.ok(Math.abs(n-1)<1e-12);
  p.renderWheels.forEach(w=>Object.values(w).forEach(value=>assert.ok(Number.isFinite(value))));
  p.reset(30,40);assert.equal(p.renderPosition.x,30);assert.equal(p.renderPosition.z,40);
  assert.equal(p.renderPosition.y,p.body.position.y);
});
