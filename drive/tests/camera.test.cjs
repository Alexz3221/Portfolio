const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('three');

function harness() {
  class Element {
    constructor(dataset = {}) { this.style = {}; this.dataset = dataset; this.listeners = {}; this.classes = new Set(); this.attributes = {}; this.textContent = ''; this.value = ''; this.classList = {add: x => this.classes.add(x), remove: x => this.classes.delete(x), toggle: (x, on) => on ? this.classes.add(x) : this.classes.delete(x)}; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    setAttribute(name, value) { this.attributes[name] = value; }
    setPointerCapture() {}
    matches() { return false; }
  }
  const elements = new Map();
  const cars = ['comet','rally','pickup','hypercar'].map(car => new Element({car}));
  const controls = ['arrowleft','arrowright','arrowdown','arrowup',' '].map(key => new Element({key}));
  const document = {
    querySelector: id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    querySelectorAll: selector => selector === '[data-car]' ? cars : controls,
    addEventListener: (name, fn) => { document[name] = fn; }, hidden: false
  };
  const window = {THREE, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800, addEventListener: (name, fn) => { window[name] = fn; }};
  const fakeThree = {...THREE, WebGLRenderer: class {constructor(){this.shadowMap={};} setPixelRatio(){} setSize(){} render(){} }};
  const context = vm.createContext({window, document, THREE: fakeThree, DrivePhysics: require('../js/physics.js'), requestAnimationFrame() {}, console});
  const source = fs.readFileSync(require.resolve('../js/main.js'), 'utf8');
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.sim = {maps, physics: () => physics, samples: () => samples, world, vehicle, motion, carSpecs, carModels, keys, chooseMap, chooseCar, resetVehicle, updateVehicle, distanceToRoad, camera, updateCamera, setCameraMode, renderer, sky, orbit, canvas};})();'), context);
  return {sim: context.sim, document, window, cars, controls};
}

test('mouse drag orbits and recenters smoothly only after four idle seconds', () => {
  const {sim} = harness();
  const send = (name, extra = {}) => sim.canvas.listeners[name]({pointerType:'mouse', pointerId:7, button:0, clientX:100, clientY:100, preventDefault(){}, ...extra});
  const initial = sim.camera.position.clone();
  send('pointerdown'); send('pointermove', {clientX:200,clientY:130}); send('pointerup');
  const yaw = sim.orbit.yaw;
  assert.ok(Math.abs(yaw) > .5);
  for(let i=0;i<39;i++) sim.updateCamera(.1);
  assert.equal(sim.orbit.yaw,yaw);
  assert.ok(sim.camera.position.distanceTo(initial)>1);
  for(let i=0;i<31;i++) sim.updateCamera(.1);
  assert.ok(Math.abs(sim.orbit.yaw)<.001);
  assert.ok(Math.abs(sim.orbit.pitch)<.001);
});

test('touch swipes use scene look, and cancel/blur/reset clear drag state', () => {
  const {sim,window} = harness();
  const send = (name, extra = {}) => sim.canvas.listeners[name]({pointerType:'mouse', pointerId:7, button:0, clientX:100, clientY:100, preventDefault(){}, ...extra});
  send('pointerdown',{pointerType:'touch'}); assert.equal(sim.orbit.pointer,7);
  send('pointercancel'); assert.equal(sim.orbit.pointer,null);
  send('pointerdown'); send('pointercancel'); assert.equal(sim.orbit.pointer,null);
  send('pointerdown'); send('lostpointercapture'); assert.equal(sim.orbit.pointer,null);
  send('pointerdown'); window.blur(); assert.equal(sim.orbit.pointer,null);
  send('pointerdown'); send('pointermove',{clientX:300}); sim.resetVehicle();
  assert.equal(sim.orbit.yaw,0); assert.equal(sim.orbit.pointer,null);
  send('pointerdown'); send('pointermove',{clientX:300}); sim.setCameraMode();
  assert.equal(sim.orbit.yaw,0);
});

test('hood look stays anchored to car and returns to forward view', () => {
  const {sim} = harness();
  sim.setCameraMode();sim.setCameraMode();sim.updateCamera(.1);
  const origin=sim.camera.position.clone(), rotation=sim.camera.quaternion.clone();
  sim.canvas.listeners.pointerdown({pointerType:'mouse',pointerId:1,button:0,clientX:0,clientY:0,preventDefault(){}});
  sim.canvas.listeners.pointermove({pointerId:1,clientX:120,clientY:40,preventDefault(){}});
  sim.updateCamera(.1);
  assert.ok(sim.camera.position.distanceTo(origin)<.001);
  assert.ok(sim.camera.quaternion.angleTo(rotation)>.1);
  sim.canvas.listeners.pointerup({pointerId:1});
  for(let i=0;i<100;i++) sim.updateCamera(.1);
  assert.ok(sim.camera.quaternion.angleTo(rotation)<.001);
});

test('all maps have bounded tiled textures and switching disposes them', () => {
  const {sim}=harness();
  for(const id of Object.keys(sim.maps)) {
    sim.chooseMap(id);
    const textures=new Set();
    sim.world.traverse(mesh=>{if(mesh.material?.map){
      textures.add(mesh.material.map);
      assert.ok(mesh.geometry.attributes.uv);
      assert.equal(mesh.material.map.image.width,128);
      assert.equal(mesh.material.map.wrapS,THREE.RepeatWrapping);
    }});
    assert.ok(textures.size>=3);
    let disposed=0; textures.forEach(t=>t.addEventListener('dispose',()=>disposed++));
    sim.chooseMap(id==='mountain'?'lakeside':'mountain');
    assert.equal(disposed,textures.size);
  }
});


test('sky follows distant cameras and cannot cross the far clipping plane', () => {
  const {sim} = harness();
  for (const map of ['lakeside','desert','alpine','mountain','racetrack']) {
    sim.chooseMap(map);
    for (const [x,z] of [[0,200],[158,-65],[250,250],[-250,-250]]) {
      sim.vehicle.position.set(x,0,z);sim.updateCamera(1);
      assert.ok(sim.sky.position.distanceTo(sim.camera.position)<1e-8);
      const positions=sim.sky.geometry.attributes.position;
      for(let i=0;i<positions.count;i++) {
        const vertex=new THREE.Vector3().fromBufferAttribute(positions,i);
        assert.ok(vertex.length()<sim.camera.far);
      }
    }
  }
});

test('scenic maps have distinct terrain detail and bounded instanced roadside scenery', () => {
  const {sim}=harness(), signatures=new Set();
  for (const map of ['lakeside','desert','alpine','mountain','racetrack']) {
    sim.chooseMap(map);
    const ground=sim.world.children[0];
    assert.equal(ground.material.bumpMap,ground.material.map);
    signatures.add(Buffer.from(ground.material.map.image.data).toString('base64'));
    const detail=sim.world.getObjectByName('roadside-detail');
    assert.ok(detail.isInstancedMesh && detail.count>100 && detail.count<=360);
    const textures=new Set();sim.world.traverse(mesh=>{if(mesh.material)Object.values(mesh.material).forEach(value=>{if(value?.isTexture)textures.add(value);});});
    let disposed=0;textures.forEach(t=>t.addEventListener('dispose',()=>disposed++));
    sim.chooseMap('mountain');assert.equal(disposed,textures.size);
  }
  assert.equal(signatures.size,5);
});

test('scenic roads climb and descend on the matching collider without floating scenery', () => {
  const {sim}=harness();
  for (const map of ['lakeside','desert','alpine','mountain','racetrack']) {
    sim.chooseMap(map);
    const physics=sim.physics(), samples=sim.samples();
    const heights=samples.map(s=>s.point.y);
    assert.ok(Math.max(...heights)-Math.min(...heights)>(map==='racetrack'?.45:4), map+' meaningful elevation');
    let uphill=0, downhill=0, turns=0;
    samples.forEach((s,i)=>{
      const next=samples[(i+1)%samples.length];
      if(next.point.y>s.point.y+.005) uphill++;
      if(next.point.y<s.point.y-.005) downhill++;
      if(s.tangent.angleTo(next.tangent)>.01) turns++;
    });
    assert.ok(uphill>(map==='racetrack'?8:50) && downhill>(map==='racetrack'?8:50) && turns>50,map+' hills and bends');
    const road=sim.world.children.filter(o=>o.name==='road-ribbon');
    assert.equal(road.length,5);
    road.forEach(mesh=>{
      assert.ok(mesh.material.polygonOffset);
      const positions=mesh.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        const x=positions.getX(i), y=positions.getY(i), z=positions.getZ(i);
        assert.ok(Math.abs(y-physics.terrainHeight(x,z)-mesh.userData.surfaceOffset)<.00002);
      }
      const indices=mesh.geometry.index;
      for(let i=0;i<indices.count;i+=3){
        let x=0,y=0,z=0;
        for(let k=0;k<3;k++){ const v=indices.getX(i+k); x+=positions.getX(v)/3;y+=positions.getY(v)/3;z+=positions.getZ(v)/3; }
        assert.ok(y-physics.terrainHeight(x,z)>.003,map+' road triangles clear terrain');
      }
    });
    const ground=sim.world.getObjectByName('terrain');
    assert.equal(ground.geometry.attributes.position.count,(physics.edge+1)**2);
    for(let i=0;i<120;i++) sim.updateVehicle(1/60);
    assert.ok(Number.isFinite(sim.vehicle.position.y));
    sim.resetVehicle();
    assert.ok(Math.abs(sim.vehicle.position.y-(physics.body.position.y-1.05))<.001);
  }
});

test('each scenic loop can be driven through its hills and curves with suspension contact', () => {
  const {sim}=harness();
  for(const map of ['lakeside','desert','alpine']) {
    sim.chooseMap(map);
    const p=sim.physics(), route=sim.samples();
    let progress=0, maxError=0, airborne=0;
    for(let frame=0; frame<24000 && progress<480; frame++) {
      const position=p.body.position;
      // A slow look-ahead driver follows the actual road, without teleportation.
      let nearest=position.distanceTo(route[progress%480].point);
      for(let ahead=1;ahead<=12 && progress+ahead<=480;ahead++){
        const distance=position.distanceTo(route[(progress+ahead)%480].point);
        if(distance<nearest){progress+=ahead;nearest=distance;ahead=0;}
      }
      const target=route[(progress+3)%480].point;
      const forward=new THREE.Vector3(0,0,1).applyQuaternion(p.body.quaternion);
      let angle=Math.atan2(target.x-position.x,target.z-position.z)-Math.atan2(forward.x,forward.z);
      angle=Math.atan2(Math.sin(angle),Math.cos(angle));
      const speed=p.body.velocity.length();
      const state=p.step(1/60,{throttle:Math.max(0,Math.min(.6,(6-speed)*.35)),brake:speed>8,steer:Math.max(-1,Math.min(1,angle*2.5))});
      if(frame>120) {
        maxError=Math.max(maxError,sim.distanceToRoad(position.x,position.z));
        if(!state.grounded) airborne++;
      }
    }
    assert.ok(progress>=480,map+' completes lap: '+progress);
    assert.ok(maxError<6.2,map+' remains on asphalt: '+maxError);
    assert.ok(airborne<30,map+' sustained contact: '+airborne);
  }
});


test('touch look and independent drive fingers coexist, cancel safely, and recenter after release', () => {
  const {sim,controls,window,document}=harness();
  const throttle=controls.find(c=>c.dataset.key==='arrowup'), steer=controls.find(c=>c.dataset.key==='arrowleft'), brake=controls.find(c=>c.dataset.key===' ');
  const event=(id,extra={})=>({pointerType:'touch',pointerId:id,button:0,clientX:100,clientY:100,preventDefault(){this.prevented=true;},...extra});
  throttle.listeners.pointerdown(event(1));steer.listeners.pointerdown(event(2));brake.listeners.pointerdown(event(3));
  const start=event(4);sim.canvas.listeners.pointerdown(start);assert.ok(start.prevented);
  sim.canvas.listeners.pointermove(event(4,{clientX:180,clientY:140}));
  assert.ok(Math.abs(sim.orbit.yaw)>.4); assert.ok(sim.orbit.pitch>.1);
  assert.ok(sim.keys.has('arrowup')&&sim.keys.has('arrowleft')&&sim.keys.has(' '));
  const yaw=sim.orbit.yaw;
  for(let i=0;i<60;i++) sim.updateCamera(.1);
  assert.equal(sim.orbit.yaw,yaw,'holding camera keeps look steady');
  sim.canvas.listeners.pointerdown(event(5));
  sim.canvas.listeners.pointermove(event(5,{clientX:600}));
  sim.canvas.listeners.pointerup(event(5));
  assert.equal(sim.orbit.pointer,4,'second scene finger cannot steal or release look');assert.equal(sim.orbit.yaw,yaw);
  brake.listeners.pointerup(event(3)); assert.ok(!sim.keys.has(' '));assert.ok(sim.keys.has('arrowup'));
  sim.canvas.listeners.pointerup(event(4));
  for(let i=0;i<39;i++) sim.updateCamera(.1);
  assert.equal(sim.orbit.yaw,yaw);
  for(let i=0;i<31;i++) sim.updateCamera(.1);
  assert.ok(Math.abs(sim.orbit.yaw)<.001);
  steer.listeners.pointercancel(event(2));assert.ok(!sim.keys.has('arrowleft'));assert.ok(sim.keys.has('arrowup'));
  document.hidden=true;document.visibilitychange();assert.equal(sim.keys.size,0);
  assert.ok(controls.every(c=>!c.classes.has('pressed')));
  throttle.listeners.pointerdown(event(6));sim.canvas.listeners.pointerdown(event(7));window.blur();
  assert.equal(sim.keys.size,0);assert.equal(sim.orbit.pointer,null);
});

test('releasing one input does not release another finger or keyboard on the same control', () => {
  const {sim,controls,window}=harness();
  const pedal=controls.find(c=>c.dataset.key==='arrowup');
  const event=id=>({pointerType:'touch',pointerId:id,preventDefault(){}});
  pedal.listeners.pointerdown(event(1));pedal.listeners.pointerdown(event(2));
  pedal.listeners.pointerup(event(1));assert.ok(sim.keys.has('arrowup'));assert.ok(pedal.classes.has('pressed'));
  pedal.listeners.lostpointercapture(event(1));assert.ok(sim.keys.has('arrowup'));
  window.keydown({key:'ArrowUp',target:{matches:()=>false},preventDefault(){}});
  pedal.listeners.pointercancel(event(2));assert.ok(sim.keys.has('arrowup'),'keyboard remains held');
  pedal.listeners.pointerdown(event(3));window.keyup({key:'ArrowUp'});assert.ok(sim.keys.has('arrowup'),'touch remains held');
  pedal.listeners.pointerup(event(3));assert.ok(!sim.keys.has('arrowup'));
  pedal.listeners.pointerdown(event(4));sim.resetVehicle();assert.equal(sim.keys.size,0);
  pedal.listeners.pointerup(event(4));assert.equal(sim.keys.size,0);
  pedal.listeners.pointerdown(event(5));sim.chooseCar('rally');assert.equal(sim.keys.size,0);
});

test('long-press suppression is scoped to canvas and touch controls',()=>{
  const {sim,controls}=harness();
  for(const element of [sim.canvas,...controls]) for(const name of ['contextmenu','selectstart']){
    let prevented=false;element.listeners[name]({preventDefault(){prevented=true;}});assert.ok(prevented);
  }
  const css=fs.readFileSync(require.resolve('../css/style.css'),'utf8');
  assert.match(css,/#drive-scene,\.touch-controls,\.touch-controls button\{[^}]*user-select:none/);
  assert.match(css,/-webkit-touch-callout:none/);
});

test('chase and wide cameras center the car body at every heading, including orbit',()=>{
  const {sim}=harness();
  for(const map of ['mountain','racetrack','alpine']) {
    sim.chooseMap(map);
    for(const mode of [0,1]) {
      if(mode)sim.setCameraMode();
      for(const heading of [0,Math.PI/2,Math.PI]) {
        sim.motion.heading=heading;sim.orbit.yaw=.7;sim.orbit.pitch=.2;
        sim.updateCamera(.1);
        const center=sim.vehicle.position.clone().add(new THREE.Vector3(0,1.2,0));
        const axis=new THREE.Vector3();sim.camera.getWorldDirection(axis);
        assert.ok(axis.dot(center.sub(sim.camera.position).normalize())>.999999);
      }
    }
    sim.setCameraMode();sim.setCameraMode();
  }
});

test('replacement maps have collidable elevation, solid obstacles and bounded terrain cost',()=>{
  const {sim}=harness();
  assert.deepEqual(Object.keys(sim.maps).sort(),['alpine','desert','lakeside','mountain','racetrack']);
  sim.chooseMap('mountain');
  assert.ok(Math.max(...sim.samples().map(s=>s.point.y))-Math.min(...sim.samples().map(s=>s.point.y))>47);
  assert.equal(sim.world.getObjectByName('terrain').geometry.attributes.position.count,201*201);
  sim.chooseMap('racetrack');
  const p=sim.physics();
  assert.equal(p.obstacles.length,6);
  assert.equal(sim.world.children.filter(o=>o.name==='solid-obstacle').length,6);
  for(const o of p.obstacles) {
    assert.ok(sim.distanceToRoad(o.x,o.z)<3.9);
    const C=require('cannon'), result=new C.RaycastResult();
    const hit=p.world.raycastClosest(new C.Vec3(o.x,20,o.z),new C.Vec3(o.x,-10,o.z),{},result);
    assert.ok(hit);
    assert.ok(Math.abs(result.hitPointWorld.y-(o.y+o.hy))<.001,'ray hits obstacle top, not ground');
  }
  assert.ok(p.terrainHeight(-164,22)>2.5);
});

test('every car completes both replacement routes with sustained suspension contact', () => {
  const {sim}=harness();
  for(const map of ['mountain','racetrack']) for(const car of ['comet','rally','pickup','hypercar']) {
    sim.chooseMap(map);sim.chooseCar(car);sim.resetVehicle();
    const p=sim.physics(), route=sim.samples();
    let progress=0, maxError=0, airborne=0;
    for(let frame=0; frame<24000 && progress<480; frame++) {
      const position=p.body.position;
      // A slow look-ahead driver follows the actual road, without teleportation.
      let nearest=position.distanceTo(route[progress%480].point);
      for(let ahead=1;ahead<=12 && progress+ahead<=480;ahead++){
        const distance=position.distanceTo(route[(progress+ahead)%480].point);
        if(distance<nearest){progress+=ahead;nearest=distance;ahead=0;}
      }
      const target=route[(progress+3)%480].point;
      const forward=new THREE.Vector3(0,0,1).applyQuaternion(p.body.quaternion);
      let angle=Math.atan2(target.x-position.x,target.z-position.z)-Math.atan2(forward.x,forward.z);
      angle=Math.atan2(Math.sin(angle),Math.cos(angle));
      const speed=p.body.velocity.length();
      const state=p.step(1/60,{throttle:Math.max(0,Math.min(.6,(6-speed)*.35)),brake:speed>8,steer:Math.max(-1,Math.min(1,angle*2.5))});
      if(frame>120) {
        maxError=Math.max(maxError,sim.distanceToRoad(position.x,position.z));
        if(!state.grounded) airborne++;
      }
    }
    assert.ok(progress>=480,map+'/'+car+' completes lap: '+progress);
    assert.ok(maxError<6.2,map+'/'+car+' remains on asphalt: '+maxError);
    assert.ok(airborne<30,map+'/'+car+' sustained contact: '+airborne);
  }
});


test('solid obstacle collision stops every car at ordinary driving speed',()=>{
  const P=require('../js/physics');
  for(const car of Object.keys(P.vehicles)) {
    const p=P.create({map:'racetrack',car});
    p.reset(-50,-80);p.addObstacle(-50,-65);
    for(let i=0;i<120;i++)p.step(1/60);
    p.body.velocity.set(0,0,20);
    for(let i=0;i<90;i++)p.step(1/60);
    assert.ok(p.body.position.z<-65,car+' stopped before block');
    assert.ok(p.body.velocity.z<5,car+' slowed by physical collision');
  }
});
