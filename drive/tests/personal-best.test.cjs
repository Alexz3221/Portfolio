const test = require('node:test');
const assert = require('node:assert/strict');
const PersonalBest = require('../js/personal-best');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values
  };
}
function recordLap(manager, car, seconds, routeLength = 427) {
  manager.start(car);
  for (let tick = 0; tick <= seconds * 60; tick++) {
    const time = Math.min(seconds, tick / 60), angle = time / 20;
    manager.record(time,
      {x: time * 4, y: 1 + Math.sin(time), z: time * -2},
      {x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2)},
      routeLength * time / seconds);
  }
  return manager.finish(seconds);
}

test('records a compact fixed-rate lap and reloads the fastest car replay', () => {
  const storage = memoryStorage();
  const manager = PersonalBest.create({storage});
  const result = recordLap(manager, 'rally', 10);
  assert.equal(result.improved, true);
  assert.equal(result.saved, true);
  assert.equal(result.best.car, 'rally');
  assert.equal(result.best.lapTime, 10);
  assert.equal(result.best.dt, .05);
  assert.equal(result.best.routeLength, 427);
  assert.equal(result.best.frames.length, 201);
  assert.equal(result.best.frames.at(-1)[7], 427);
  assert.ok(storage.values.get(PersonalBest.KEY).length < 15000);
  assert.equal(PersonalBest.create({storage}).best.car, 'rally');

  assert.equal(recordLap(manager, 'comet', 12).improved, false);
  assert.equal(manager.best.car, 'rally');
  assert.equal(recordLap(manager, 'comet', 8).improved, true);
  assert.equal(PersonalBest.create({storage}).best.car, 'comet');
  assert.equal(PersonalBest.create({storage}).best.lapTime, 8);
});

test('records the exact finish pose between sample times', () => {
  const manager = PersonalBest.create({storage: memoryStorage()});
  manager.start('pickup');
  manager.record(0, {x: 0, y: 1, z: 0}, {x: 0, y: 0, z: 0, w: 1}, 0);
  manager.record(.12, {x: 3.25, y: 2, z: -1}, {x: 0, y: 0, z: 0, w: 1}, 427);
  const {best} = manager.finish(.12);
  assert.equal(best.frames.at(-1)[0], 3.25);
  assert.equal(best.frames.at(-1)[7], 427);
  assert.equal(best.duration, .15);
  assert.equal(best.lapTime, .12);
});

test('ignores corrupt saved replays and continues when storage is blocked', () => {
  const storage = {
    getItem() { return '{"frames": "bad"}'; },
    setItem() { throw new Error('quota'); }
  };
  const manager = PersonalBest.create({storage});
  assert.equal(manager.best, null);
  const result = recordLap(manager, 'comet', 2);
  assert.equal(result.improved, true);
  assert.equal(result.saved, false);
  assert.ok(manager.best);
  manager.start('rally');
  manager.record(0, {x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 0, w: 1}, 0);
  manager.cancel();
  assert.equal(manager.finish(1).improved, false);
  assert.equal(manager.best.car, 'comet');
});
