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
    matches(selector) { return this.tagName ? selector.split(',').map(s => s.trim()).includes(this.tagName) : false; }
    focus() { document.activeElement = this; }
    blur() { if (document.activeElement === this) document.activeElement = document.body; }
  }
  const elements = new Map();
  const cars = ['comet','rally','pickup','hypercar'].map(car => new Element({car}));
  const controls = ['arrowleft','arrowright','arrowdown','arrowup',' '].map(key => new Element({key}));
  const document = {
    querySelector: id => { if (!elements.has(id)) elements.set(id, Object.assign(new Element(), {tagName: id === '#mapSelect' ? 'select' : 'div'})); return elements.get(id); },
    querySelectorAll: selector => selector === '[data-car]' ? cars : controls,
    addEventListener: (name, fn) => { document[name] = fn; }, hidden: false
  };
  document.body = new Element(); document.activeElement = document.body;
  const window = {THREE, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800, addEventListener: (name, fn) => { window[name] = fn; }};
  const fakeThree = {...THREE, WebGLRenderer: class {constructor(){this.shadowMap={};} setPixelRatio(){} setSize(){} render(){} }};
  const context = vm.createContext({window, document, THREE: fakeThree, DriveVehicleAssets: assetLoader, DrivePhysics: require('../js/physics.js'), requestAnimationFrame() {}, console});
  const source = fs.readFileSync(require.resolve('../js/main.js'), 'utf8');
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.sim = {physics: () => physics, maps, samples: () => samples, world, vehicle, motion, carSpecs, carModels, keys, chooseMap, chooseCar, resetVehicle, updateVehicle, distanceToRoad, camera, updateCamera, setCameraMode, renderer, sky};})();'), context);
  context.sim.chooseMap('lakeside');
  return {sim: context.sim, document, window, cars, controls};
}


test('committing the route selector returns driving input without changing cars', () => {
  const {sim,document,window,controls} = harness();
  const selector=document.querySelector('#mapSelect');
  for(const car of ['comet','rally','pickup','hypercar']) {
    sim.chooseCar(car);
    for(const map of ['mountain','racetrack','lakeside','desert','alpine']) {
      selector.focus(); selector.value=map;
      selector.listeners.change({target:selector});
      assert.notEqual(document.activeElement,selector,car+'/'+map+' releases dropdown focus');
      const originalPhysics=sim.physics();
      for(let i=0;i<90;i++)sim.updateVehicle(1/60);
      window.keydown({key:'w',target:document.activeElement,repeat:false,preventDefault(){}});
      assert.ok(sim.keys.has('w'),car+'/'+map+' accepts throttle');
      for(let i=0;i<60;i++)sim.updateVehicle(1/60);
      assert.ok(sim.motion.speed>2,car+'/'+map+' moves without changing cars');
      assert.equal(sim.physics(),originalPhysics);
      window.keyup({key:'w'});
      // A fresh touch pedal also works after each route change.
      sim.resetVehicle();
      controls[3].listeners.pointerdown({preventDefault(){},pointerId:42,pointerType:'touch'});
      assert.ok(sim.keys.has('arrowup'));
      controls[3].listeners.pointercancel({pointerId:42});
      assert.equal(sim.keys.size,0);
    }
  }
});

test('uncommitted native select keyboard controls are not intercepted', () => {
  const {sim,document,window}=harness(), selector=document.querySelector('#mapSelect');
  selector.focus();
  window.keydown({key:'ArrowDown',target:selector,preventDefault(){throw new Error('native select intercepted');}});
  assert.equal(sim.keys.size,0);
});

test('performance tuning is a small 5 percent force and 3 percent target-speed increase', () => {
  const specs=require('../js/physics').vehicles;
  for(const [car,engine,kph] of [['comet',2100,220],['rally',2250,180],['pickup',2800,155],['hypercar',3300,320]]) {
    assert.ok(Math.abs(specs[car].engine/engine-1.05)<1e-12);
    assert.ok(Math.abs(specs[car].maxSpeed/(kph/3.6)-1.03)<1e-12);
  }
});
