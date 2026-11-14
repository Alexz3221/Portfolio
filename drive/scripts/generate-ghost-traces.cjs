/* Generate deterministic, non-colliding ghost laps from the course test driver.
 * Run from any directory: node drive/scripts/generate-ghost-traces.cjs
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('cannon');
const P = require('../js/physics');

const route = P.stuntRoute;
const routeLength = route.length;
assert.equal(routeLength, 427, 'retune speed zones when changing the stunt route');
const framesPerSecond = 60;
const sampleEvery = 2;
const dt = sampleEvery / framesPerSecond;
const output = {};
const round = (value, places = 3) => Math.round(value * 10 ** places) / 10 ** places;
const mph = metresPerSecond => metresPerSecond * 2.236936;

// Fast on the open ribbon, with advance braking for the bends and real hazards.
// The jump is deliberately held near 26 m/s; it cannot be treated like a turn.
function targetSpeedAt(index) {
  if (index >= 112 && index <= 151) return 8;   // alternating slalom gates
  if (index >= 267 && index <= 303) return 6;  // narrow balance bridge
  if (index >= 225 && index <= 244) return 26; // launch, gap and landing
  if (index >= 245 && index <= 264) return 20; // lower crossing
  if (index >= 82 && index <= 111) return 12;  // east turn into slalom
  if (index >= 152 && index <= 168) return 12; // top east turn
  if (index >= 198 && index <= 224) return 12; // turn into jump approach
  if (index >= 304 && index <= 323) return 11; // turn off balance
  if (index >= 348 && index <= 380) return 11; // west lower turn
  if (index >= 397) return 11;                 // return to start
  return 22;
}
function speedZone(index) {
  if ((index >= 10 && index <= 78) || (index >= 170 && index <= 195) ||
      (index >= 325 && index <= 345) || (index >= 382 && index <= 394)) return 'open';
  if (index >= 112 && index <= 151) return 'slalom';
  if (index >= 225 && index <= 244) return 'jump';
  if (index >= 280 && index <= 298) return 'balance';
  return 'other';
}

for (const car of Object.keys(P.vehicles)) {
  const physics = P.create({map: 'racetrack', car});
  // These three gates are part of the live course, but are authored by main.js.
  for (const [index, z] of [48, 72, 96].entries())
    physics.addObstacle(175 + (index % 2 ? 2.8 : -2.8), z, 3.1, .9, 1);
  const spawn = route[0];
  physics.reset(spawn.x, spawn.z, Math.atan2(spawn.tx, spawn.tz));

  let progress = 0;
  let lapTime = null;
  let maxError = 0, bridgeError = 0, minUp = 1;
  let upper = false, lower = false, balance = false, jump = false;
  const frames = [];
  const speeds = {open:[],slalom:[],jump:[],balance:[],other:[]};
  function record() {
    const p = physics.body.position;
    const q = physics.body.quaternion;
    frames.push([round(p.x), round(p.y), round(p.z), round(q.x, 4),
      round(q.y, 4), round(q.z, 4), round(q.w, 4), progress]);
  }
  record();

  for (let frame = 0; frame < 18000; frame++) {
    const pos = physics.body.position;
    let nearest = Infinity;
    let next = progress;
    for (let index = Math.max(0, progress - 2); index <= progress + 12 && index <= routeLength; index++) {
      const point = route[index % routeLength];
      const distance = Math.hypot(point.x - pos.x, point.z - pos.z,
        (point.y + 1 - pos.y) * .3);
      if (distance < nearest) { nearest = distance; next = index; }
    }
    progress = Math.max(progress, next);
    const point = route[progress % routeLength];
    let targetSpeed = targetSpeedAt(progress % routeLength);
    const speed = physics.body.velocity.length();
    speeds[speedZone(progress % routeLength)].push(mph(speed));
    const ahead = speed > 17 ? 3 : 2;
    const target = {...route[(progress + ahead) % routeLength]};
    // Steer through the opening at each alternating solid slalom gate.
    if (target.x === 175 && target.z > 28 && target.z < 115) {
      let offset = 0;
      for (const [index, z] of [48, 72, 96].entries())
        offset += (index % 2 ? -2.5 : 2.5) * Math.exp(-(((target.z - z) / 12) ** 2));
      target.x += offset;
      targetSpeed = Math.min(targetSpeed, 8);
    }
    const forward = physics.body.quaternion.vmult(new C.Vec3(0, 0, 1));
    let angle = Math.atan2(target.x - pos.x, target.z - pos.z) - Math.atan2(forward.x, forward.z);
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    const state = physics.step(1 / framesPerSecond, {
      throttle: Math.max(0, Math.min(.8, (targetSpeed - speed) * .45)),
      brake: speed > targetSpeed + 1,
      steer: Math.max(-1, Math.min(1, angle * 2.5))
    });
    const body = physics.body;
    const marker = route[progress % routeLength];
    const error = Math.hypot(marker.x - body.position.x, marker.z - body.position.z);
    if (frame > 120) {
      maxError = Math.max(maxError, error);
      minUp = Math.min(minUp, body.quaternion.vmult(new C.Vec3(0, 1, 0)).y);
      if (marker.kind === 'balance' && marker.width < 4) bridgeError = Math.max(bridgeError, Math.abs(body.position.x));
    }
    if (Math.abs(body.position.x) < 5 && Math.abs(body.position.z) < 5) {
      upper ||= body.position.y > 9;
      lower ||= body.position.y < 2;
    }
    balance ||= Math.abs(body.position.x) < 1 && body.position.z < -60 && body.position.z > -90 && body.position.y > 4;
    jump ||= body.position.z < 78 && body.position.z > 74 && !state.grounded;
    assert.ok(body.position.y > -.5, `${car} fell off at route index ${progress}`);
    if (progress >= routeLength && lapTime === null) lapTime = (frame + 1) / framesPerSecond;
    if ((frame + 1) % sampleEvery === 0) {
      record();
      if (lapTime !== null) break;
    }
  }

  assert.ok(lapTime !== null, `${car} did not complete a lap`);
  assert.equal(frames.at(-1)[7], routeLength, `${car} trace must finish the route`);
  assert.ok(upper && lower && balance && jump, `${car} missed a mandatory stunt`);
  assert.ok(maxError < 6, `${car} strayed too far from route (${maxError.toFixed(2)}m)`);
  assert.ok(bridgeError < 1.8, `${car} strayed from bridge (${bridgeError.toFixed(2)}m)`);
  assert.ok(minUp > .8, `${car} rolled over (up=${minUp.toFixed(2)})`);
  const duration = (frames.length - 1) * dt;
  output[car] = {dt, duration: round(duration, 6), lapTime: round(lapTime, 6), routeLength, frames};
  const summary = Object.entries(speeds).map(([zone, values]) => {
    const sorted = values.sort((a,b) => a-b);
    const average = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
    return `${zone} ${Math.round(sorted[0] || 0)}/${Math.round(average)}/${Math.round(sorted.at(-1) || 0)} mph min/avg/max`;
  }).join('; ');
  console.log(`${car}: ${frames.length} poses, lap ${lapTime.toFixed(2)}s, trace ${duration.toFixed(2)}s; ${summary}; error ${maxError.toFixed(2)}m, bridge ${bridgeError.toFixed(2)}m, up ${minUp.toFixed(2)}`);
  physics.dispose();
}

const target = path.join(__dirname, '..', 'js', 'ghost-traces.js');
const source = '/* Generated by scripts/generate-ghost-traces.cjs. Do not edit by hand. */\n' +
  '(function(root){root.DriveGhostTraces=' + JSON.stringify(output) +
  ';})(typeof globalThis!=="undefined"?globalThis:this);\n';
fs.writeFileSync(target, source);
console.log(`Wrote ${target} (${(Buffer.byteLength(source) / 1024).toFixed(1)} KiB)`);
