const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('three');

function harness(assetLoader, importer, u9Asset) {
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
  const window = {THREE, DriveImportedCity: importer, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800, addEventListener: (name, fn) => { window[name] = fn; }};
  const fakeThree = {...THREE, WebGLRenderer: class {constructor(){this.shadowMap={};} setPixelRatio(){} setSize(){} render(){} }};
  const context = vm.createContext({window, document, THREE: fakeThree, DriveVehicleAssets: assetLoader, DriveU9XtremeAsset: u9Asset, DrivePhysics: require('../js/physics.js'), requestAnimationFrame() {}, console});
  const source = fs.readFileSync(require.resolve('../js/main.js'), 'utf8');
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.sim = {physics: () => physics, maps, samples: () => samples, world, vehicle, vehicleFrame, motion, carSpecs, carModels, keys, chooseMap, chooseCar, resetVehicle, recoverVehicleInPlace, jumpToStop, updateVehicle, distanceToRoad, camera, updateCamera, setCameraMode, renderer, sky, animate};})();'), context);
  context.sim.chooseMap('city');
  return {sim: context.sim, document, window, cars, controls};
}

test('browser adopts a loaded imported district while keeping other routes playable',async()=>{
  const fallback=require('../js/city');
  const imported={...fallback,edge:520,bounds:{minX:-500,maxX:500,minZ:-500,maxZ:500},
    terrain:{elementSize:880,originX:-440,maxZ:440,data:[[-50,-50],[-50,-50]]}};
  const {sim}=harness(undefined,{load:()=>Promise.resolve(imported)});
  assert.equal(sim.physics().edge,fallback.edge,'built-in district starts immediately');
  await new Promise(setImmediate);
  assert.equal(sim.physics().edge,520,'imported city replaces the fallback');
  assert.equal(sim.samples().length,imported.routeSamples.length);
  sim.chooseMap('mountain');
  assert.equal(sim.physics().edge,200);
  sim.chooseMap('city');
  assert.equal(sim.physics().edge,520,'imported district survives route switches');
  const p=sim.physics(),spawnX=sim.samples()[0].point.x;
  p.body.position.x=spawnX+5;p.body.position.y=-49;p.syncRenderState();
  sim.updateVehicle(0);
  assert.equal(p.body.position.x,spawnX+5,'normal driving below world y=-30 does not reset');
  p.body.position.y=-81;p.syncRenderState();sim.updateVehicle(0);
  assert.equal(p.body.position.x,spawnX,'falling 30m below local terrain still resets');
});

test('imported city display keeps physical left turns on the big map’s left side', async () => {
  const fallback = require('../js/city');
  let streamedCamera = null;
  const landmark = new THREE.Group(); landmark.position.set(0, 0, 20);
  const imported = {...fallback, edge:520,
    terrain:{elementSize:880,originX:-440,maxZ:440,data:[[-50,-50],[-50,-50]]},
    build(_three, world) { world.add(landmark); return {
      update(camera) { streamedCamera = {...camera.position}; }, dispose() {}}; }};
  const {sim} = harness(undefined, {load:() => Promise.resolve(imported)});
  await new Promise(setImmediate);
  assert.equal(sim.world.scale.z, -1, 'the imported city is reflected for Three.js');
  assert.equal(sim.vehicleFrame.scale.z, -1, 'the visible car shares the city frame');
  const physics = sim.physics();
  physics.reset(0, 0, 0);
  sim.updateVehicle(0);
  sim.vehicleFrame.updateMatrixWorld(true);
  sim.world.updateMatrixWorld(true);
  assert.ok(landmark.getWorldPosition(new THREE.Vector3()).z < -19.9,
    'city landmarks use the reflected display frame');
  const visibleCar = sim.vehicle.getWorldPosition(new THREE.Vector3());
  const visibleForward = sim.vehicle.localToWorld(new THREE.Vector3(0, 0, 1)).sub(visibleCar);
  assert.ok(visibleForward.z < -.9, 'the car faces along the reflected road');
  sim.updateCamera(1);
  assert.ok(sim.camera.position.z > -sim.vehicle.position.z + 2,
    'the chase camera stays behind the visible northbound car');
  sim.animate();
  assert.ok(streamedCamera && Math.abs(streamedCamera.z + sim.camera.position.z) < .001,
    'tile streaming reads the raw physics position behind the reflected camera');
  sim.setCameraMode(); sim.setCameraMode(); sim.updateCamera(1);
  assert.ok(sim.camera.position.z < -sim.vehicle.position.z,
    'the hood camera remains ahead of the visible car');
  sim.setCameraMode();
  sim.jumpToStop({x:30, z:40, heading:0});
  assert.ok(Math.abs(physics.body.position.z - 40) < .001 &&
    Math.abs(sim.vehicle.getWorldPosition(new THREE.Vector3()).z + 40) < .001,
    'fast travel keeps the map marker and visible car on the same raw road');
  sim.recoverVehicleInPlace();
  assert.ok(Math.abs(physics.body.position.z - 40) < .001 &&
    Math.abs(sim.camera.position.z + sim.vehicle.position.z) > 2,
    'F recovery stays in place with a chase camera in the reflected frame');
  physics.reset(0, 0, 0); sim.updateVehicle(0);
  sim.keys.add('w'); sim.keys.add('a');
  for (let i = 0; i < 180; i++) sim.updateVehicle(1 / 60);
  assert.ok(physics.body.position.x < -5,
    'pressing left moves west on the unchanged big-map coordinate frame');
  sim.chooseMap('mountain');
  assert.equal(sim.world.scale.z, 1, 'other route scenery keeps its prior frame');
  assert.equal(sim.vehicleFrame.scale.z, 1, 'other route cars keep their prior frame');
});

test('all three maps have distinct drivable, finite closed routes and safe spawns', () => {
  const {sim} = harness();
  const shapes = new Set();
  for (const id of Object.keys(sim.maps).filter(id => id !== 'course')) {
    sim.chooseMap(id);
    const points = sim.samples();
    assert.equal(points.length, id==='racetrack'?require('../js/physics').stuntRoute.length:480);
    shapes.add(JSON.stringify(points.map(s => s.point.toArray())));
    assert.equal(sim.motion.speed, 0);
    assert.ok(sim.distanceToRoad(sim.vehicle.position.x, sim.vehicle.position.z) < .001);
    for (const {point, tangent} of points) {
      assert.ok(point.toArray().every(Number.isFinite));
      const bound=id==='city'?require('../js/city').edge:210;
      assert.ok(Math.abs(point.x) < bound && Math.abs(point.z) < bound);
      assert.ok(Math.abs(tangent.length() - 1) < .00001);
    }
    sim.world.traverse(mesh => {
      if (mesh.geometry) assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));
    });
  }
  assert.equal(shapes.size, 3);
});

test('map switching disposes old GPU resources and does not accumulate scenery', () => {
  const {sim} = harness();
  const counts = {};
  let disposed = false;
  sim.world.children[0].geometry.addEventListener('dispose', () => { disposed = true; });
  for (let i = 0; i < 12; i++) {
    const id = Object.keys(sim.maps).filter(id => id !== 'course')[i % 3]; sim.chooseMap(id);
    counts[id] ??= sim.world.children.length;
    assert.equal(sim.world.children.length, counts[id]);
  }
  assert.ok(disposed);
});

test('each physics car uses mph HUD, accelerates, brakes and switches safely', () => {
  const {sim, document} = harness();
  for (const [car, expected] of [['comet',141],['rally',115],['pickup',99],['hypercar',205]]) {
    sim.chooseCar(car); sim.resetVehicle();
    assert.equal(sim.physics().body.mass, require('../js/physics').vehicles[car].mass);
    assert.equal(document.querySelector('#topSpeedValue').textContent, `${expected} mph target top speed`);
    for(let i=0;i<120;i++)sim.updateVehicle(1/60);
    sim.keys.add('w');for(let i=0;i<90;i++)sim.updateVehicle(1/60);
    assert.ok(sim.motion.speed>5);
    assert.equal(Number(document.querySelector('#speedValue').textContent),Math.round(sim.physics().body.velocity.length()*2.236936));
    sim.keys.clear();sim.keys.add(' ');for(let i=0;i<180;i++)sim.updateVehicle(1/60);
    assert.ok(Math.abs(sim.motion.speed)<.2);
  }
  sim.keys.add('w');sim.chooseCar('comet');assert.equal(sim.keys.size,0);assert.equal(sim.physics().body.velocity.length(),0);
});

test('steering pivots independently of wheel roll and reset clears held controls', () => {
  const {sim, controls, window, document, cars} = harness();
  for(let i=0;i<120;i++)sim.updateVehicle(1/60);
  sim.keys.add('w'); sim.keys.add('a'); for(let i=0;i<90;i++)sim.updateVehicle(1/60);
  const wheels = sim.carModels.comet.wheels;
  assert.ok(sim.physics().body.velocity.length()>5);
  assert.ok(wheels.filter(w => w.front).every(w => w.pivot.rotation.y > 0 && w.wheel.rotation.x > 0));
  assert.ok(wheels.filter(w => !w.front).every(w => w.pivot.rotation.y === 0));
  const rolling = wheels.map(w => w.wheel.rotation.x);
  sim.keys.clear(); for(let i=0;i<30;i++)sim.updateVehicle(1/60);
  assert.ok(wheels.every((w,i) => w.wheel.rotation.x > rolling[i]), 'wheels keep rolling while coasting');
  controls[3].listeners.pointerdown({preventDefault(){}, pointerId:1});
  window.blur(); assert.equal(sim.keys.size, 0); assert.ok(controls.every(c => !c.classes.has('pressed')));
  controls[3].listeners.pointerdown({preventDefault(){}, pointerId:1});
  document.hidden = true; document.visibilitychange(); assert.equal(sim.keys.size, 0);
  sim.keys.add('w'); sim.chooseMap('city'); assert.equal(sim.keys.size, 0); assert.equal(sim.motion.speed,0);
  sim.chooseCar('rally'); assert.equal(cars[1].attributes['aria-pressed'],'true'); assert.equal(cars[0].attributes['aria-pressed'],'false');
});

test('keyboard native controls retain Space and select arrow-key behavior', () => {
  const {sim, window} = harness();
  const event = (key, selector) => ({key, repeat:false, target:{matches:s => s.includes(selector)}, preventDefault(){throw new Error('Native control was intercepted');}});
  window.keydown(event('ArrowUp','select'));
  window.keydown(event(' ','button'));
  assert.equal(sim.keys.size,0);
});

test('F rights the car at its current location while R returns to the route start', () => {
  const {sim, window} = harness();
  const body = sim.physics().body;
  const spawn = sim.samples()[0].point;
  body.position.x += 17;
  body.position.z += 6;
  body.position.y += 9;
  body.quaternion.setFromEuler(Math.PI, .4, 0);
  body.velocity.set(12, -3, 4);
  body.angularVelocity.set(1, 2, 3);
  const before = {x: body.position.x, y: body.position.y, z: body.position.z};
  sim.keys.add('w');
  window.keydown({key:'f', target:{matches:()=>false}, repeat:false});
  assert.ok(Math.abs(body.position.x - before.x) < .001);
  assert.ok(Math.abs(body.position.z - before.z) < .001);
  assert.ok(body.position.y >= before.y, 'in-place recovery preserves elevated position');
  assert.ok(new THREE.Vector3(0, 1, 0).applyQuaternion(body.quaternion).y > .99);
  assert.equal(body.velocity.length(), 0);
  assert.equal(body.angularVelocity.length(), 0);
  assert.equal(sim.keys.size, 0);
  window.keydown({key:'r', target:{matches:()=>false}, repeat:false});
  assert.ok(Math.abs(body.position.x - spawn.x) < .001);
  assert.ok(Math.abs(body.position.z - spawn.z) < .001);
});


test('hood camera stays on the car at high speed rather than trailing behind', () => {
  const {sim} = harness();
  sim.setCameraMode(); sim.setCameraMode();
  for (const car of Object.keys(sim.carSpecs)) {
    sim.chooseCar(car);
    sim.motion.speed = sim.carSpecs[car].maxSpeed;
    sim.keys.add('w'); sim.keys.add('a');
    for (let i = 0; i < 60; i++) { sim.updateVehicle(1/60); sim.updateCamera(1/60); }
    const offset = sim.camera.position.clone().sub(sim.vehicle.position);
    const forward = new THREE.Vector3(0,0,1).applyQuaternion(sim.vehicle.quaternion);
    assert.ok(Math.abs(offset.dot(forward) - sim.carSpecs[car].length * .4) < .00001);
    assert.ok(sim.camera.position.toArray().every(Number.isFinite));
  }
});

 test('all cars integrate with circuit controls, reset and map switching', () => {
  const {sim,document}=harness();sim.chooseMap('racetrack');sim.chooseCar('pickup');assert.equal(sim.carModels.comet.group.visible,false);assert.equal(sim.carModels.pickup.group.visible,true);
  const spawn=sim.samples()[0].point;
  sim.keys.add('w');for(let i=0;i<240;i++)sim.updateVehicle(1/60);assert.ok(sim.vehicle.position.clone().sub(spawn).dot(sim.samples()[0].tangent)>10);assert.ok(sim.vehicle.position.toArray().every(Number.isFinite));
  sim.resetVehicle();assert.equal(sim.keys.size,0);assert.ok(Math.abs(sim.vehicle.position.z-spawn.z)<.01);
  sim.chooseMap('city');assert.equal(document.querySelector('.garage').style.display,'');sim.chooseCar('pickup');assert.equal(sim.carModels.pickup.group.visible,true);
  sim.chooseMap('racetrack');assert.equal(document.querySelector('.garage').style.display,'');assert.equal(sim.carModels.pickup.group.visible,true);
});


test('fourth garage option selects Hypercar using button and key 4',()=>{
  const {sim,window,cars,document}=harness();
  cars[3].listeners.click();assert.equal(cars[3].attributes['aria-pressed'],'true');
  assert.equal(document.querySelector('#topSpeedValue').textContent,'205 mph target top speed');
  sim.chooseCar('comet');window.keydown({key:'4',target:{matches:()=>false},repeat:false});
  assert.equal(sim.physics().body.mass,1450);assert.equal(cars[3].attributes['aria-pressed'],'true');
});

test('key 6 selects the U9 Xtreme without adding a garage option',()=>{
  const {sim,window,cars,document}=harness();
  window.keydown({key:'6',target:{matches:()=>false},repeat:false});
  assert.equal(sim.physics().spec,require('../js/physics').vehicles.u9xtreme);
  assert.equal(sim.carModels.u9xtreme.group.visible,true);
  assert.equal(sim.physics().body.mass,2480);
  assert.equal(document.querySelector('#topSpeedValue').textContent,'313 mph target top speed · 3,019 PS');
  assert.match(document.querySelector('#modelStatus').textContent,/U9 Xtreme/);
  assert.equal(cars.length,4);
  assert.ok(cars.every(button=>button.dataset.car!=='u9xtreme'));
  assert.doesNotMatch(fs.readFileSync(require.resolve('../index.html'),'utf8'),/data-car="u9xtreme"/);
  window.keydown({key:'1',target:{matches:()=>false},repeat:false});
  assert.equal(sim.carModels.u9xtreme.group.visible,false);
});

test('key 6 loads the supplied U9 GLB once and swaps out the fallback visual',()=>{
  let pending, calls=0;
  const asset={load(spec,success,failure){calls++;pending={spec,success,failure};}};
  const {sim,window,document}=harness(undefined,undefined,asset);
  window.keydown({key:'6',target:{matches:()=>false},repeat:false});
  assert.equal(calls,1);
  assert.equal(pending.spec,sim.carSpecs.u9xtreme);
  assert.equal(sim.carModels.u9xtreme.assetState,'loading');
  assert.match(document.querySelector('#modelStatus').textContent,/Loading U9 Xtreme/);
  const imported={body:new THREE.Group(),wheels:Array.from({length:4},()=>new THREE.Group()),rearLamp:new THREE.MeshBasicMaterial({color:0xff354e})};
  pending.success(imported);
  assert.equal(sim.carModels.u9xtreme.assetState,'ready');
  assert.ok(sim.carModels.u9xtreme.group.children.includes(imported.body));
  assert.equal(sim.carModels.u9xtreme.wheels[0].wheel.children[0],imported.wheels[0]);
  assert.match(document.querySelector('#modelStatus').textContent,/Ddiaz Design/);
  sim.chooseCar('comet');sim.chooseCar('u9xtreme');
  assert.equal(calls,1);
});


test('lazy models cache once, late completion never changes selection, and failures retain fallback',()=>{
  const pending={},calls={};
  const {sim,document}=harness({load(type,spec,success,failure){calls[type]=(calls[type]||0)+1;pending[type]={success,failure};}});
  assert.equal(calls.comet,1);assert.equal(calls.hypercar,undefined);
  sim.chooseCar('hypercar');sim.chooseCar('rally');
  const imported=()=>({body:new THREE.Mesh(new THREE.BoxGeometry(2,1,5),new THREE.MeshBasicMaterial()),wheels:Array.from({length:4},()=>new THREE.Group())});
  pending.hypercar.success(imported());assert.equal(sim.carModels.hypercar.group.visible,false);
  pending.rally.failure(new Error('test network failure'));
  assert.equal(sim.carModels.rally.assetState,'failed');assert.ok(sim.carModels.rally.group.children.length>4);
  assert.match(document.querySelector('#modelStatus').textContent,/fallback/);
  sim.chooseCar('hypercar');assert.equal(calls.hypercar,1);assert.equal(sim.carModels.hypercar.group.visible,true);
  assert.equal(document.querySelector('#modelStatus').textContent,'Comrade1280 · CC BY 4.0 model');
  sim.chooseMap('city');sim.chooseMap('mountain');assert.equal(calls.hypercar,1);
});
