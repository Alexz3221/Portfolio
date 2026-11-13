'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const Imported = require('../js/imported-city');

const root = path.resolve(__dirname, '..');
const nearest = (x, z, segment) => {
  const dx = segment.x2 - segment.x1, dz = segment.z2 - segment.z1;
  const t = Math.max(0, Math.min(1,
    ((x - segment.x1) * dx + (z - segment.z1) * dz) / (dx * dx + dz * dz || 1)));
  return { distance: Math.hypot(x - segment.x1 - dx * t, z - segment.z1 - dz * t),
    y: segment.y1 + (segment.y2 - segment.y1) * t };
};

async function checkSupports(reverseTiles) {
  const map = await Imported.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () => {
      const data = JSON.parse(await fs.readFile(path.join(root, url), 'utf8'));
      if (reverseTiles && url.endsWith('manifest.json')) data.tiles.reverse();
      return data;
    } })
  });
  await map.ensureAll();
  assert.ok(map.supports.length > 400, 'elevated roads retain visible supports');

  for (const support of map.supports) {
    const low = support.y - support.height / 2;
    const high = support.y + support.height / 2;
    for (const road of [
      ...map.nearbyRoads(support.x, support.z, 3),
      ...map.nearbyHighways(support.x, support.z, 3)
    ]) {
      const hit = nearest(support.x, support.z, road);
      const obstructs = hit.distance < road.width / 2 - 1.5 &&
        hit.y >= low - .5 && hit.y <= high - 1.5;
      assert.ok(!obstructs,
        `support (${support.x.toFixed(1)}, ${support.z.toFixed(1)}) blocks road ${road.id}`);
    }
    for (const lane of [
      ...map.nearbyLaneConnectors(support.x, support.z, 3),
      ...map.nearbyLaneApproaches(support.x, support.z, 3)
    ]) {
      if (lane.forbidden || lane.path_methods_bits != null &&
          !(Number(lane.path_methods_bits) & 2)) continue;
      const samples = lane.samples || [];
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1], b = samples[i];
        const hit = nearest(support.x, support.z, {
          x1: a.x, y1: a.y, z1: a.z, x2: b.x, y2: b.y, z2: b.z
        });
        const obstructs = hit.distance < (Number(lane.width_m) || 3) / 2 - .25 &&
          hit.y >= low - .5 && hit.y <= high - 1.5;
        assert.ok(!obstructs,
          `support (${support.x.toFixed(1)}, ${support.z.toFixed(1)}) blocks lane ${lane.entity_id}`);
      }
    }
  }
}

test('bridge supports leave roads and permitted lanes clear in either tile load order', async () => {
  await checkSupports(false);
  await checkSupports(true);
});
