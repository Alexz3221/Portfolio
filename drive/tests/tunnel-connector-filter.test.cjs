'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const Imported = require('../js/imported-city');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFile(path.join(root, file), 'utf8').then(JSON.parse);

test('underground Bayview lanes do not become phantom surface connectors', async () => {
  const raw = await read('data/imported-city/lane-graph/connectors/1_-4.json');
  const rawIds = new Set(raw.items.map(item => item[0]));
  for (const id of [4003919, 4004018, 4000030])
    assert.ok(rawIds.has(id), `tunnel connector ${id} is in the real export`);

  const map = await Imported.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () => read(url) })
  });
  await map.ensureNear(817, -1567, 150);
  const near = map.nearbyLaneConnectors(817, -1567, 180);
  for (const id of [4003919, 4004018, 4000030])
    assert.ok(!near.some(connector => connector.entity_id === id),
      `tunnel connector ${id} is not painted on terrain`);
  assert.ok(near.some(connector => connector.entity_id === 4003534),
    'nearby ground Bayview lanes remain driveable');

  await map.ensureAll();
  const overview = await read('data/imported-city/overview.json');
  const tunnelIds = new Set(overview.roads.filter(road =>
    /tunnel|underground/i.test(road.mode || '')).map(road => String(road.id)));
  assert.ok(tunnelIds.has('5264105') && tunnelIds.has('5264146'));
  assert.ok(map.laneConnectors.length > 19000, 'the surface graph remains populated');
  assert.equal(map.laneConnectors.filter(connector =>
    tunnelIds.has(String(connector.from_edge_id)) ||
    tunnelIds.has(String(connector.to_edge_id))).length, 0,
  'no tunnel edge leaks into the rendered or physical citywide graph');
});
