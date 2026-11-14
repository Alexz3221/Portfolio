const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const C = require('cannon');
const P = require('../js/physics');

const traceContext = vm.createContext({});
vm.runInContext(fs.readFileSync(require.resolve('../js/ghost-traces.js'), 'utf8'), traceContext);
const ghostTraces = traceContext.DriveGhostTraces;

// Reuse the browserless WebGL harness, with the actual generated ghost laps and
// the new controls initialized to the values supplied by index.html.
const harnessSource = fs.readFileSync(require.resolve('./camera.test.cjs'), 'utf8').split("test('mouse drag")[0];
const configuredSource = harnessSource
  .replace('requestAnimationFrame() {}, console', 'requestAnimationFrame() {}, DriveGhostTraces: ghostTraces, console')
  .replace("const source = fs.readFileSync(require.resolve('../js/main.js'), 'utf8');",
    "document.querySelector('#ghostEnabled').checked = true; document.querySelector('#ghostCar').value = 'match'; document.querySelector('#ghostPace').value = 'standard'; const source = fs.readFileSync(require.resolve('../js/main.js'), 'utf8');")
  .replace('renderer, sky, orbit, canvas};})();',
    'renderer, sky, orbit, canvas, ghost, ghostFrame, ghostVehicle, updateGhostRun};})();');
assert.notEqual(configuredSource, harnessSource);
const context = vm.createContext({require, __dirname, console, ghostTraces});
vm.runInContext(configuredSource + ';globalThis.makeGhostHarness=harness;', context);

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
  assert.equal(sim.ghost.running, true);
  assert.equal(document.querySelector('#ghostHud').hidden, false);
  assert.equal(sim.physics().world.bodies.length, count);
  const startPosition = sim.ghostVehicle.position.clone();
  sim.updateGhostRun(3);
  assert.ok(sim.ghostVehicle.position.distanceTo(startPosition) > 2);
  assert.equal(document.querySelector('#ghostTimeValue').textContent, '0:03.0');
  assert.equal(sim.physics().world.bodies.length, count);
});

test('match my car follows garage changes, while reset and map changes stop a run', () => {
  const {sim, document} = context.makeGhostHarness();
  sim.chooseMap('racetrack');
  const start = document.querySelector('#ghostStartButton');
  start.listeners.click();
  assert.equal(sim.ghost.car, 'comet');
  sim.chooseCar('pickup');
  assert.equal(sim.ghost.car, 'pickup');
  assert.equal(sim.ghost.running, false);
  assert.equal(document.querySelector('#ghostHud').hidden, true);
  start.listeners.click();
  assert.equal(sim.ghost.running, true);
  sim.resetVehicle();
  assert.equal(sim.ghost.running, false);
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
  assert.equal(sim.ghost.progress, 0);
  sim.physics().body.position.y = -4;
  sim.updateGhostRun(.1);
  assert.equal(sim.ghost.running, false);
  assert.match(document.querySelector('#ghostStatus').textContent, /fell off the course/);
});

test('a complete physical lap finishes the ghost challenge and reports the result', () => {
  const {sim, document} = context.makeGhostHarness();
  sim.chooseMap('racetrack');
  document.querySelector('#ghostStartButton').listeners.click();
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
  assert.match(document.querySelector('#ghostStatus').textContent, /^Finished in .* the ghost by /);
  assert.equal(document.querySelector('#ghostStartButton').textContent, 'RACE AGAIN');
});
