const test=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const P=require('../js/physics.js');
const path=new THREE.CatmullRomCurve3(P.mountainPoints.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
test('mountain shelf has a real 55 m inside wall and 60 m outside cliff',()=>{
  const p=P.create({map:'mountain'});
  for(let i=0;i<64;i++){
    const [x,z]=P.mountainPoints[i],r=Math.hypot(x,z/1.12);
    const center=p.terrainHeight(x,z);
    const inside=p.terrainHeight(x*(r-15)/r,z*(r-15)/r);
    const outside=p.terrainHeight(x*(r+15)/r,z*(r+15)/r);
    assert.ok(inside-center>53,'solid uphill wall');
    assert.ok(center-outside>58,'real terrain drop');
    for(const side of [-4,4]) assert.ok(Math.abs(p.terrainHeight(x*(r+side)/r,z*(r+side)/r)-center)<.15,'usable narrow shelf');
  }
});
test('all four cars drive a complete narrow mountain lap without teleportation',()=>{
  for(const car of Object.keys(P.vehicles)){
    const p=P.create({map:'mountain',car});
    const route=Array.from({length:480},(_,i)=>{const point=path.getPointAt(i/480);point.y=p.terrainHeight(point.x,point.z);return point;});
    const tangent=path.getTangentAt(0);p.reset(route[0].x,route[0].z,Math.atan2(tangent.x,tangent.z));
    let progress=0,maxError=0,airborne=0;
    for(let frame=0;frame<18000&&progress<480;frame++){
      const position=p.body.position;
      let nearest=position.distanceTo(route[progress%480]);
      for(let ahead=1;ahead<=12&&progress+ahead<=480;ahead++){
        const d=position.distanceTo(route[(progress+ahead)%480]);
        if(d<nearest){progress+=ahead;nearest=d;ahead=0;}
      }
      const target=route[(progress+3)%480],forward=new THREE.Vector3(0,0,1).applyQuaternion(p.body.quaternion);
      let angle=Math.atan2(target.x-position.x,target.z-position.z)-Math.atan2(forward.x,forward.z);
      angle=Math.atan2(Math.sin(angle),Math.cos(angle));
      const speed=p.body.velocity.length(),state=p.step(1/60,{throttle:Math.max(0,Math.min(.6,(6-speed)*.35)),brake:speed>8,steer:Math.max(-1,Math.min(1,angle*2.5))});
      if(frame>120){
        let error=Infinity;
        for(let ahead=-2;ahead<=2;ahead++){
          const a=route[(progress+ahead+480)%480],b=route[(progress+ahead+481)%480],dx=b.x-a.x,dz=b.z-a.z;
          const t=Math.max(0,Math.min(1,((position.x-a.x)*dx+(position.z-a.z)*dz)/(dx*dx+dz*dz)));
          error=Math.min(error,Math.hypot(position.x-a.x-dx*t,position.z-a.z-dz*t));
        }
        maxError=Math.max(maxError,error);if(!state.grounded)airborne++;
      }
    }
    assert.ok(progress>=480,car+' completes lap: '+progress);
    assert.ok(maxError<2.3,car+' body remains on 7 m asphalt: '+maxError);
    assert.ok(airborne<30,car+' maintains suspension contact: '+airborne);
  }
});
