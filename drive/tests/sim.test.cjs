const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('three');

function harness(assetLoader) {
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
  const context = vm.createContext({window, document, THREE: fakeThree, DriveVehicleAssets: assetLoader, DrivePhysics: require('../js/physics.js'), requestAnimationFrame() {}, console});
  const source = fs.readFileSync(require.resolve('../js/main.js'), 'utf8');
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.sim = {physics: () => physics, maps, samples: () => samples, world, vehicle, motion, carSpecs, carModels, keys, chooseMap, chooseCar, resetVehicle, updateVehicle, distanceToRoad, camera, updateCamera, setCameraMode, renderer, sky};})();'), context);
  context.sim.chooseMap('city');
  return {sim: context.sim, document, window, cars, controls};
}

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
