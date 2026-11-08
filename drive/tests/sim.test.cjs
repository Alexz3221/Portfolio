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
  const cars = ['comet','rally','pickup'].map(car => new Element({car}));
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
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.sim = {maps, samples: () => samples, world, vehicle, motion, carSpecs, carModels, keys, chooseMap, chooseCar, resetVehicle, updateVehicle, distanceToRoad, camera, updateCamera, setCameraMode, renderer, sky};})();'), context);
  context.sim.chooseMap('lakeside');
  return {sim: context.sim, document, window, cars, controls};
}

test('all three maps have distinct drivable, finite closed routes and safe spawns', () => {
  const {sim} = harness();
  const shapes = new Set();
  for (const id of Object.keys(sim.maps).filter(id => id !== 'course')) {
    sim.chooseMap(id);
    const points = sim.samples();
    assert.equal(points.length, 480);
    shapes.add(JSON.stringify(points.map(s => s.point.toArray())));
    assert.equal(sim.motion.speed, 0);
    assert.ok(sim.distanceToRoad(sim.vehicle.position.x, sim.vehicle.position.z) < .001);
    for (const {point, tangent} of points) {
      assert.ok(point.toArray().every(Number.isFinite));
      assert.ok(Math.abs(point.x) < 210 && Math.abs(point.z) < 210);
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

test('each car reaches its advertised road cap; reverse, braking, dirt and switching stay bounded', () => {
  const {sim, document} = harness();
  for (const [car, expected] of [['comet',220],['rally',180],['pickup',155]]) {
    sim.chooseCar(car); sim.resetVehicle(); sim.keys.add('w');
    // Hold the car at a road point between steps to isolate the acceleration model from steering.
    for (let i = 0; i < 1200; i++) {sim.vehicle.position.copy(sim.samples()[0].point); sim.updateVehicle(1/60);}
    assert.ok(Math.abs(sim.motion.speed * 3.6 - expected) < .001);
    assert.equal(document.querySelector('#topSpeedValue').textContent, `${expected} km/h top speed`);
    sim.keys.clear(); sim.keys.add(' ');
    for (let i = 0; i < 120; i++) sim.updateVehicle(1/60);
    assert.ok(Math.abs(sim.motion.speed) < .1);
    sim.resetVehicle(); sim.keys.add('s');
    for (let i = 0; i < 1200; i++) {sim.vehicle.position.copy(sim.samples()[0].point); sim.updateVehicle(1/60);}
    assert.ok(Math.abs(sim.motion.speed + sim.carSpecs[car].maxSpeed * .45) < .001);
    sim.vehicle.position.set(200, 0, 200); sim.motion.speed = sim.carSpecs[car].maxSpeed; sim.updateVehicle(1/60);
    assert.ok(Math.abs(sim.motion.speed) <= sim.carSpecs[car].maxSpeed * (car === 'rally' ? .78 : .6));
  }
  sim.chooseCar('comet'); sim.motion.speed = sim.carSpecs.comet.maxSpeed; sim.chooseCar('pickup');
  assert.ok(sim.motion.speed <= sim.carSpecs.pickup.maxSpeed);
});

test('steering pivots independently of wheel roll and reset clears held controls', () => {
  const {sim, controls, window, document, cars} = harness();
  sim.keys.add('w'); sim.keys.add('a'); sim.motion.speed = 10; sim.updateVehicle(.05);
  const wheels = sim.carModels.comet.wheels;
  assert.ok(wheels.filter(w => w.front).every(w => w.pivot.rotation.y > 0 && w.wheel.rotation.x > 0));
  assert.ok(wheels.filter(w => !w.front).every(w => w.pivot.rotation.y === 0));
  controls[3].listeners.pointerdown({preventDefault(){}, pointerId:1});
  window.blur(); assert.equal(sim.keys.size, 0); assert.ok(controls.every(c => !c.classes.has('pressed')));
  controls[3].listeners.pointerdown({preventDefault(){}, pointerId:1});
  document.hidden = true; document.visibilitychange(); assert.equal(sim.keys.size, 0);
  sim.keys.add('w'); sim.chooseMap('desert'); assert.equal(sim.keys.size, 0); assert.equal(sim.motion.speed,0);
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
    const forward = new THREE.Vector3(Math.sin(sim.motion.heading), 0, Math.cos(sim.motion.heading));
    assert.ok(Math.abs(offset.dot(forward) - sim.carSpecs[car].length * .4) < .00001);
    assert.ok(sim.camera.position.toArray().every(Number.isFinite));
  }
});

 test('physics course integrates with controls, car lock, reset and map switching', () => {
  const {sim,document}=harness();sim.chooseMap('course');sim.chooseCar('pickup');assert.equal(sim.carModels.comet.group.visible,true);assert.equal(sim.carModels.pickup.group.visible,false);
  sim.keys.add('w');for(let i=0;i<240;i++)sim.updateVehicle(1/60);assert.ok(sim.vehicle.position.z>-20);assert.ok(sim.vehicle.position.toArray().every(Number.isFinite));
  sim.resetVehicle();assert.equal(sim.keys.size,0);assert.ok(Math.abs(sim.vehicle.position.z+28)<.01);
  sim.chooseMap('alpine');assert.equal(document.querySelector('.garage').style.display,'');sim.chooseCar('pickup');assert.equal(sim.carModels.pickup.group.visible,true);
  sim.chooseMap('course');assert.equal(document.querySelector('.garage').style.display,'none');
});
