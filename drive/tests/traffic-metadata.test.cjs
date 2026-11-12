'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dataRoot = path.join(__dirname, '..', 'data', 'imported-city');
const read = file => JSON.parse(fs.readFileSync(path.join(dataRoot, file), 'utf8'));
const flowFromAccess = access => {
  const forward = access?.forward === 'allowed';
  const backward = access?.backward === 'allowed';
  return forward && backward ? 'two-way' : forward ? 'forward-only' :
    backward ? 'backward-only' : 'unknown';
};

test('converted city labels one-way and two-way traffic independently of road class', () => {
  const overview = read('overview.json');
  const manifest = read('manifest.json');
  const counts = { 'forward-only': 0, 'backward-only': 0, 'two-way': 0, unknown: 0 };
  const flowById = new Map();
  for (const road of overview.roads) {
    assert.equal(road.trafficFlow, flowFromAccess(road.carAccess), `overview road ${road.id}`);
    assert.ok(['street', 'arterial', 'highway', 'special'].includes(road.roadClass));
    assert.ok(road.laneDetails?.length > 0 && road.laneDetails.every(lane =>
      Number.isFinite(lane.speed) && lane.speed > 0), `lane limits for ${road.id}`);
    counts[road.trafficFlow]++;
    flowById.set(road.id, road.trafficFlow);
  }
  assert.equal(counts['forward-only'], 1975);
  assert.equal(counts['two-way'], 2283);
  assert.equal(counts['backward-only'], 0);
  assert.equal(counts.unknown, 0);
  let tileRoads = 0;
  for (const tile of manifest.tiles) for (const feature of read(tile.file).features) {
    if (feature.type !== 'road') continue;
    assert.equal(feature.trafficFlow, flowById.get(feature.id), `tile ${tile.file} road ${feature.id}`);
    tileRoads++;
  }
  assert.ok(tileRoads > overview.roads.length, 'every clipped road part retains traffic flow');
});
