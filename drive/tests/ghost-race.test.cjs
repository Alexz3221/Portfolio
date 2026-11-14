const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const C = require('cannon');
const P = require('../js/physics');
const THREE = require('three');
const PersonalBest = require('../js/personal-best');

const traceContext = vm.createContext({});
vm.runInContext(fs.readFileSync(require.resolve('../js/ghost-traces.js'), 'utf8'), traceContext);
const ghostTraces = traceContext.DriveGhostTraces;

// Reuse the browserless WebGL harness, with the actual generated ghost laps and
// the new controls initialized to the values supplied by index.html.
const harnessSource = fs.readFileSync(require.resolve('./camera.test.cjs'), 'utf8').split("test('mouse drag")[0];
const configuredSource = harnessSource
  .replace('function harness() {', 'function harness(storage = null, assetLoader = undefined) {')
  .replace('const fakeThree = {...THREE', 'window.localStorage = storage; const fakeThree = {...THREE')
  .replace('requestAnimationFrame() {}, console',
    'requestAnimationFrame() {}, DriveGhostTraces: ghostTraces, DrivePersonalBest: PersonalBest, DriveVehicleAssets: assetLoader, console')
  .replace("const source = fs.readFileSync(require.resolve('../js/main.js'), 'utf8');",
    "document.querySelector('#ghostEnabled').checked = true; document.querySelector('#ghostSource').value = 'course'; document.querySelector('#ghostCar').value = 'match'; document.querySelector('#ghostPace').value = 'standard'; const source = fs.readFileSync(require.resolve('../js/main.js'), 'utf8');")
  .replace('renderer, sky, orbit, canvas};})();',
    'renderer, sky, orbit, canvas, ghost, ghostFrame, ghostVehicle, updateGhostRun};})();');
assert.notEqual(configuredSource, harnessSource);
const context = vm.createContext({require, __dirname, console, ghostTraces, PersonalBest});
vm.runInContext(configuredSource + ';globalThis.makeGhostHarness=harness;', context);

function placeAtStartLine(sim, along, lateral = 0, forwardSpeed = 4) {
  const start = P.stuntRoute[0], body = sim.physics().body;
  body.position.set(start.x + start.tx * along - start.tz * lateral,
    start.y + 1, start.z + start.tz * along + start.tx * lateral);
  body.velocity.set(start.tx * forwardSpeed, 0, start.tz * forwardSpeed);
  sim.updateGhostRun(1 / 60);
}
function startLap(sim) {
  placeAtStartLine(sim, 0);
  assert.equal(sim.ghost.running, false, 'waiting before the painted line');
  placeAtStartLine(sim, 2);
  assert.equal(sim.ghost.running, true, 'forward crossing starts the lap');
  assert.equal(sim.ghost.elapsed, 0, 'time begins at the line');
}
function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), values
  };
}

test('ghost car and pace are independent of the player car, and playback has no collider', () => {
  const {sim, document} = context.makeGhostHarness();
  sim.chooseMap('racetrack');
  const panel = document.querySelector('#ghostPanel');
  const car = document.querySelector('#ghostCar');
  const pace = document.querySelector('#ghostPace');
  const start = document.querySelector('#ghostStartButton');
  assert.equal(panel.hidden, false);
  assert.equal(start.disabled, false);
  car.value = 'rally'; car.listeners.change();
  pace.value = 'quick'; pace.listeners.change();
  const count = sim.physics().world.bodies.length;
  start.listeners.click();
  assert.equal(sim.ghost.car, 'rally');
  assert.equal(sim.ghost.rate, 1.12);
  assert.equal(sim.ghost.running, false);
  assert.equal(sim.ghost.armed, true);
  assert.equal(document.querySelector('#ghostHud').hidden, false);
  assert.equal(sim.physics().world.bodies.length, count);
  startLap(sim);
  const startPosition = sim.ghostVehicle.position.clone();
  sim.updateGhostRun(3);
  assert.ok(sim.ghostVehicle.position.distanceTo(startPosition) > 2);
  assert.equal(document.querySelector('#ghostTimeValue').textContent, '0:03.0');
  assert.equal(sim.physics().world.bodies.length, count);
});

test('committing ghost controls returns keyboard focus to driving', () => {
  const {sim, document, window} = context.makeGhostHarness();
  sim.chooseMap('racetrack');
  let focused = null;
  sim.canvas.focus = () => { focused = sim.canvas; };
  for (const [selector, value] of [['#ghostEnabled', true], ['#ghostSource', 'course'], ['#ghostCar', 'rally'], ['#ghostPace', 'quick']]) {
    const control = document.querySelector(selector);
    focused = control;
    control.blur = () => { focused = null; };
    if (selector === '#ghostEnabled') control.checked = value;
    else control.value = value;
    if (selector === '#ghostCar') {
      control.matches = query => query === 'select, input, textarea';
      window.keydown({target: control, key: 'ArrowDown', preventDefault() { throw new Error('Native select key intercepted'); }});
      assert.equal(sim.keys.has('arrowdown'), false);
      assert.equal(focused, control);
    }
    control.listeners.change({target: control});
    assert.equal(focused, sim.canvas, selector + ' should return focus to the driving canvas');
  }
  window.keydown({target: sim.canvas, key: 'w', preventDefault() {}});
  assert.equal(sim.keys.has('w'), true);
  const start = document.querySelector('#ghostStartButton');
  focused = start;
  start.listeners.click();
  assert.equal(focused, sim.canvas);
});

test('a late car model upgrades the ghost without changing the player asset', () => {
  const pending = new Map();
  const assetLoader = {load(type, _spec, success) { pending.set(type, success); }};
  const {sim, document} = context.makeGhostHarness(null, assetLoader);
  sim.chooseMap('racetrack');
  assert.equal(sim.carModels.comet.assetState, 'loading');
  assert.ok(sim.ghost.model, 'procedural ghost appears while the model loads');

  const material = new THREE.MeshStandardMaterial({color: 0x5577aa});
  material.name = 'Body';
  const body = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.9, .5, 4.5), material);
  mesh.name = 'imported-body'; body.add(mesh);
  const wheels = Array.from({length: 4}, (_, index) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .25, 8), material);
    wheel.name = 'imported-wheel-' + index;
    return wheel;
  });
  pending.get('comet')({body, wheels, brakeMaterials:[], rearLamp:material});
  const playerMesh = sim.carModels.comet.group.getObjectByName('imported-body');
  const ghostMesh = sim.ghost.model.group.getObjectByName('imported-body');
  assert.ok(playerMesh && ghostMesh, 'both cars show the imported model');
  assert.equal(playerMesh.geometry, ghostMesh.geometry, 'the clone safely shares geometry');
  assert.notEqual(playerMesh.material, ghostMesh.material, 'ghost tint uses its own material');
  assert.equal(playerMesh.material.transparent, false);
  assert.equal(playerMesh.material.opacity, 1);
  assert.equal(playerMesh.material.color.getHex(), 0x5577aa);
  assert.equal(ghostMesh.material.transparent, true);
  let disposedGeometry = 0, disposedMaterial = 0;
  playerMesh.geometry.addEventListener('dispose', () => disposedGeometry++);
  playerMesh.material.addEventListener('dispose', () => disposedMaterial++);
  const car = document.querySelector('#ghostCar');
  car.value = 'rally'; car.listeners.change({target: car});
  assert.equal(disposedGeometry, 0, 'switching ghosts retains the cached player geometry');
  assert.equal(disposedMaterial, 0, 'switching ghosts retains the cached player material');
});

test('match my car follows garage changes, while reset and map changes stop a run', () => {
  const {sim, document} = context.makeGhostHarness();
  sim.chooseMap('racetrack');
  const start = document.querySelector('#ghostStartButton');
  start.listeners.click();
  assert.equal(sim.ghost.car, 'comet');
  assert.equal(sim.ghost.running, false);
  assert.equal(sim.ghost.armed, true);
  sim.chooseCar('pickup');
  assert.equal(sim.ghost.car, 'pickup');
  assert.equal(sim.ghost.running, false);
  assert.equal(document.querySelector('#ghostHud').hidden, false);
  startLap(sim);
  start.listeners.click();
  assert.equal(sim.ghost.running, false);
  assert.equal(sim.ghost.armed, true);
  startLap(sim);
  sim.resetVehicle();
  assert.equal(sim.ghost.running, false);
  assert.equal(sim.ghost.armed, true);
  sim.chooseMap('city');
  assert.equal(document.querySelector('#ghostPanel').hidden, true);
  assert.equal(sim.ghostFrame.visible, false);
  sim.chooseMap('racetrack');
  assert.equal(document.querySelector('#ghostPanel').hidden, false);
  assert.equal(sim.ghost.car, 'pickup');
});

test('a lower crossing cannot skip the route and falling ends the challenge', () => {
  const {sim, document} = context.makeGhostHarness();
  sim.chooseMap('racetrack');
  document.querySelector('#ghostStartButton').listeners.click();
  sim.physics().body.position.set(0, 0, 0);
  sim.updateGhostRun(.1);
  assert.equal(sim.ghost.running, false, 'lower crossing does not start a lap');
  startLap(sim);
  sim.physics().body.position.set(0, 0, 0);
  sim.updateGhostRun(.1);
  assert.equal(sim.ghost.progress, 0);
  sim.physics().body.position.y = -4;
  sim.updateGhostRun(.1);
  assert.equal(sim.ghost.running, false);
  assert.match(document.querySelector('#ghostStatus').textContent, /fell off the course/);
});

test('a lap finishes only at a forward line crossing after route completion', () => {
  const {sim, document} = context.makeGhostHarness();
  sim.chooseMap('racetrack');
  startLap(sim);
  placeAtStartLine(sim, 0);
  placeAtStartLine(sim, 2);
  assert.equal(sim.ghost.running, true, 'early second crossing cannot finish');
  sim.ghost.progress = P.stuntRoute.length - 4;
  placeAtStartLine(sim, 0);
  assert.equal(sim.ghost.running, true, 'near the line is not a finish');
  placeAtStartLine(sim, 2, 0, -4);
  assert.equal(sim.ghost.running, true, 'reverse crossing cannot finish');
  placeAtStartLine(sim, 0);
  placeAtStartLine(sim, 2);
  assert.equal(sim.ghost.running, false);
  assert.equal(sim.ghost.progress, P.stuntRoute.length);
  assert.match(document.querySelector('#ghostStatus').textContent, /beat the ghost|behind the ghost/);
});

test('a complete physical lap finishes the ghost challenge and reports the result', () => {
  const storage = memoryStorage();
  const {sim, document} = context.makeGhostHarness(storage);
  sim.chooseMap('racetrack');
  startLap(sim);
  const physics = sim.physics(), route = P.stuntRoute, count = route.length;
  let controllerProgress = 0;
  for (let frame = 0; frame < 18000 && sim.ghost.running; frame++) {
    const pos = physics.body.position;
    let nearest = Infinity, next = controllerProgress;
    for (let index = Math.max(0, controllerProgress - 2); index <= Math.min(count, controllerProgress + 12); index++) {
      const point = route[index % count];
      const distance = Math.hypot(point.x - pos.x, point.z - pos.z, (point.y + 1 - pos.y) * .3);
      if (distance < nearest) { nearest = distance; next = index; }
    }
    controllerProgress = Math.max(controllerProgress, next);
    const point = route[controllerProgress % count];
    let targetSpeed = 9;
    if (point.x === 0 && point.z > 55) targetSpeed = 26;
    if (point.x === 0 && point.z <= 55 && point.z > -15) targetSpeed = 8;
    if (point.kind === 'balance') targetSpeed = 6;
    const speed = physics.body.velocity.length();
    const target = {...route[(controllerProgress + (speed > 17 ? 3 : 2)) % count]};
    if (target.x === 175 && target.z > 28 && target.z < 115) {
      for (const [index, z] of [48, 72, 96].entries())
        target.x += (index % 2 ? -2.5 : 2.5) * Math.exp(-(((target.z - z) / 12) ** 2));
      targetSpeed = 7;
    }
    const forward = physics.body.quaternion.vmult(new C.Vec3(0, 0, 1));
    let angle = Math.atan2(target.x - pos.x, target.z - pos.z) - Math.atan2(forward.x, forward.z);
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    physics.step(1 / 60, {
      throttle: Math.max(0, Math.min(.8, (targetSpeed - speed) * .45)),
      brake: speed > targetSpeed + 1,
      steer: Math.max(-1, Math.min(1, angle * 2.5))
    });
    sim.updateGhostRun(1 / 60);
  }
  assert.equal(sim.ghost.running, false);
  assert.equal(sim.ghost.progress, count);
  assert.match(document.querySelector('#ghostStatus').textContent, /New personal best!/);
  assert.equal(document.querySelector('#ghostStartButton').textContent, 'RESET TO START');
  assert.ok(storage.values.get(PersonalBest.KEY), 'best lap persisted in browser storage');
  assert.equal(JSON.parse(storage.values.get(PersonalBest.KEY)).car, 'comet');
  const source = document.querySelector('#ghostSource');
  source.value = 'best'; source.listeners.change({target: source});
  assert.equal(sim.ghost.trace.car, 'comet');
  assert.equal(sim.ghost.trace.routeLength, count);
  assert.equal(sim.ghost.rate, 1, 'best lap replays at its recorded speed');
  const next = context.makeGhostHarness(storage);
  next.sim.chooseMap('racetrack');
  const savedSource = next.document.querySelector('#ghostSource');
  savedSource.value = 'best'; savedSource.listeners.change({target: savedSource});
  assert.equal(next.sim.ghost.trace.car, 'comet', 'saved best replay loads in a new session');
});
