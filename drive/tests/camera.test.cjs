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
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.sim = {maps, samples: () => samples, world, vehicle, motion, carSpecs, carModels, keys, chooseMap, chooseCar, resetVehicle, updateVehicle, distanceToRoad, camera, updateCamera, setCameraMode, renderer, sky, orbit, canvas};})();'), context);
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

test('touch is not captured by mouse look, and cancel/blur/reset clear drag state', () => {
  const {sim,window} = harness();
  const send = (name, extra = {}) => sim.canvas.listeners[name]({pointerType:'mouse', pointerId:7, button:0, clientX:100, clientY:100, preventDefault(){}, ...extra});
  send('pointerdown',{pointerType:'touch'}); assert.equal(sim.orbit.pointer,null);
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
  sim.canvas.listeners.pointermove({pointerId:1,clientX:120,clientY:40});
  sim.updateCamera(.1);
  assert.ok(sim.camera.position.distanceTo(origin)<.001);
  assert.ok(sim.camera.quaternion.angleTo(rotation)>.1);
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
    sim.chooseMap(id==='course'?'lakeside':'course');
    assert.equal(disposed,textures.size);
  }
});
