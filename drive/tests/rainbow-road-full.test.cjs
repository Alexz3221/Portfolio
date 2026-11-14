const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ThreeBase = require('three');
const Cannon = require('cannon');
const physics = require('../js/physics');
const imported = require('../js/imported-courses');

test('full Rainbow Road uses native collision on every modeled road section', async () => {
  const fakeThree = {...ThreeBase};
  fakeThree.TextureLoader = class {
    setCrossOrigin(){return this;}
    setRequestHeader(){return this;}
    load(_url,done){queueMicrotask(()=>done(new ThreeBase.Texture()));return new ThreeBase.Texture();}
  };
  const context = vm.createContext({THREE:fakeThree,console,TextDecoder,TextEncoder,Blob,
    self:{URL},URL,setTimeout,clearTimeout});
  vm.runInContext(fs.readFileSync(require.resolve('../js/vendor/GLTFLoader.js'),'utf8'),context);
  fakeThree.GLTFLoader.prototype.load = function(path,done,_progress,error) {
    const bytes = fs.readFileSync(require.resolve('../' + path));
    this.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',done,error);
  };
  globalThis.THREE = fakeThree;

  const course = imported.getCourse('rainbowroad');
  const sim = physics.create({map:'racetrack',courseId:'rainbowroad',course,car:'comet'});
  const loaded = await imported.load('rainbowroad');
  assert.ok(loaded.collisionMeshes.length>=9,'all road eras contribute native triangles');
  const initialBodies = new Set(sim.world.bodies);
  assert.equal(sim.addCourseCollisionMeshes(loaded.collisionMeshes),true);
  const nativeBodies = new Set(sim.world.bodies.filter(body=>!initialBodies.has(body)));
  assert.ok(nativeBodies.size>=9,'the source road chunks enter the physical world');
  sim.reset();
  for(let frame=0;frame<240;frame++)sim.step(1/120);
  assert.ok(sim.car.wheelInfos.every(wheel=>wheel.isInContact),
    'the native checker approach supports all four wheels after loading');

  function nativeAt(x,y,z) {
    const hits=[];
    sim.world.raycastAll(new Cannon.Vec3(x,y+3,z),new Cannon.Vec3(x,y-3,z),{},hit=>{
      if(nativeBodies.has(hit.body))hits.push(hit.hitPointWorld.y);
    });
    return hits.some(roadY=>Math.abs(roadY-y)<.6);
  }
  for(const [name,x,y,z] of [
    ['SFC checker',188,68.96,-26],
    ['MK8 loop',210.3,69.47,-54.5],
    ['MK7 climb',241.2,105.3,-69.5],
    ['DS3DS span',140,63.76,-102.3],
    ['Wii climb',-45,116.2,-78.8],
    ['DS spiral',-101.7,37.6,41.6],
    ['GCN bends',-24.45,38.39,50.88],
    ['GBA hairpin',77.75,64,64.11],
    ['N64 loop',66.81,70.46,-73.38]
  ]) assert.ok(nativeAt(x*course.scale/2.5,y*course.scale/2.5,
    z*course.scale/2.5),`${name} has source road collision`);

  for(const transfer of course.transfers) {
    const from=course.route.findIndex(point=>Math.hypot(point.x-transfer.from.x,
      point.y-transfer.from.y,point.z-transfer.from.z)<.01);
    const to=course.route.findIndex((point,index)=>index>from&&Math.hypot(
      point.x-transfer.to.x,point.y-transfer.to.y,point.z-transfer.to.z)<.01);
    assert.ok(from>=0&&to>from);
    const trace=course.ghostTraces.comet;
    const startFrame=trace.frames.findIndex(frame=>frame[7]>=from);
    const endFrame=trace.frames.findIndex(frame=>frame[7]>=to);
    const halfway=trace.frames[Math.floor((startFrame+endFrame)/2)];
    const at=Math.floor(halfway[7]),blend=halfway[7]-at;
    const roadY=course.route[at].y+(course.route[at+1].y-course.route[at].y)*blend;
    assert.ok(halfway[1]-1-roadY>transfer.arc*.95,
      'the ghost rises through the same guided flight arc as the player');
    assert.ok(sim.courseSlabs.every(slab=>slab.index<from||slab.index>=to),
      'the air gap stays open between native roads');
    const heading=transfer.takeoffHeading;
    sim.reset(transfer.from.x,transfer.from.z,heading);
    sim.body.position.y=transfer.from.y+1.1;
    sim.body.velocity.set(Math.sin(heading)*12,0,Math.cos(heading)*12);
    for(let frame=0;frame<Math.ceil(transfer.duration*120)+4;frame++)sim.step(1/120);
    assert.ok(Math.hypot(sim.body.position.x-transfer.to.x,
      sim.body.position.z-transfer.to.z)<2,'the guided flight reaches its native landing');
    assert.ok(Math.abs(sim.body.position.y-transfer.to.y-1.1)<2,
      'the flight hands the car back at road height');
  }

  const guided=course.guidedSections[0],ghost=course.ghostTraces.comet;
  let guidedDistance=0;
  for(let index=guided.fromIndex;index<guided.toIndex;index++) {
    const a=course.route[index],b=course.route[index+1];
    guidedDistance+=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
  }
  const ghostTimeAt=index=>ghost.frames.findIndex(frame=>frame[7]>=index)*ghost.dt;
  const guidedGhostPace=guidedDistance/
    (ghostTimeAt(guided.toIndex)-ghostTimeAt(guided.fromIndex));
  assert.ok(Math.abs(guidedGhostPace-guided.speed)<.2,
    'the course ghost matches the assisted MK7 pace');

  // Enter the steep MK7 section on wheels, then drive back out onto DS3DS.
  const route=course.route, entry=route[34];
  sim.reset(entry.x,entry.z,Math.atan2(entry.tx,entry.tz));
  sim.body.position.y=entry.y+1.1;
  sim.body.velocity.set(entry.tx*10,0,entry.tz*10);
  let progress=34,timedProgress=34,entered=false,exited=false,minFallMargin=Infinity;
  for(let frame=0;frame<2400&&progress<101;frame++) {
    const pos=sim.body.position;
    let nearest=Infinity,next=progress;
    for(let index=Math.max(34,progress-2);index<=Math.min(101,progress+12);index++) {
      const point=route[index];
      const distance=Math.hypot(point.x-pos.x,point.z-pos.z,(point.y+1-pos.y)*.3);
      if(distance<nearest){nearest=distance;next=index;}
    }
    progress=Math.max(progress,next);
    const target=route[Math.min(101,progress+3)];
    const forward=sim.body.quaternion.vmult(new Cannon.Vec3(0,0,1));
    const desired=Math.atan2(target.x-pos.x,target.z-pos.z);
    const heading=Math.atan2(forward.x,forward.z);
    const error=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
    const speed=sim.body.velocity.length();
    const state=sim.step(1/60,{throttle:speed<12?1:0,brake:speed>16,
      steer:Math.max(-1,Math.min(1,error*2.4))});
    if(state.guided)entered=true;
    else if(entered)exited=true;

    // Match the timed-run progress window and fall rule used by main.js.
    let best=Infinity,candidate=timedProgress;
    const advance=Math.max(3,Math.ceil(sim.body.velocity.length()/60/2)+2);
    for(let index=Math.max(0,timedProgress-2);index<=Math.min(route.length,timedProgress+advance);index++) {
      const point=route[index%route.length];
      const distance=Math.hypot(point.x-sim.body.position.x,point.z-sim.body.position.z,
        (point.y+1-sim.body.position.y)*.3);
      if(distance<best){best=distance;candidate=index;}
    }
    if(best<course.width/2+2&&sim.body.velocity.length()>.5)
      timedProgress=Math.max(timedProgress,candidate);
    minFallMargin=Math.min(minFallMargin,
      sim.body.position.y-(route[timedProgress].y-8));
  }
  assert.ok(entered&&exited,'the car enters and leaves MK7 anti-gravity assist');
  assert.ok(progress>=101&&timedProgress>=101,
    'the car and timed run progress across the DS3DS join');
  assert.ok(minFallMargin>0,'the MK7 descent never cancels the timed run');
});
