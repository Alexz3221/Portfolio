'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const THREE = require('three');
const Imported = require('../js/imported-city');

test('short sampled one-way curves near center 03 keep visible travel arrows', async () => {
  const root = path.resolve(__dirname, '..');
  const map = await Imported.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () =>
      JSON.parse(await fs.readFile(path.join(root, url), 'utf8')) })
  });
  const world = new THREE.Group();
  const visual = map.build(THREE, world);
  try {
    const x = 3840, z = -3328;
    // Build initializes at downtown; load this far district afterward.
    await map.ensureNear(x, z, 700);
    visual.update({ position: { x, y: map.terrainHeight(x, z) + 20, z } }, 0);
    const targetIds = ['5516868', '5516697', '5516806'];
    const arrows = new Map(targetIds.map(id => [id, []]));
    world.traverse(mesh => {
      if (mesh.name !== 'imported-city-direction-arrow') return;
      const position = mesh.geometry.attributes.position;
      (mesh.userData.arrows || []).forEach((record, index) => {
        if (!arrows.has(record.roadId)) return;
        const head = index * 9 + 6;
        arrows.get(record.roadId).push({ record,
          tipX: position.getX(head + 1), tipZ: position.getZ(head + 1),
          wingX: (position.getX(head) + position.getX(head + 2)) / 2,
          wingZ: (position.getZ(head) + position.getZ(head + 2)) / 2 });
      });
    });
    const segments = [...map.loadedTiles.values()].filter(tile => tile.state === 'loaded')
      .flatMap(tile => [...tile.data.roads, ...tile.data.highways]);
    for (const [id, markings] of arrows) {
      assert.ok(markings.length > 0, `${id} has an arrow despite sub-8m curve samples`);
      const road = segments.filter(segment => String(segment.id) === id);
      assert.ok(road.length >= 20, `${id} is a densely sampled real road`);
      for (const { record, tipX, tipZ, wingX, wingZ } of markings) {
        const nearest = road.map(segment => {
          const dx = segment.x2 - segment.x1, dz = segment.z2 - segment.z1;
          const length2 = dx * dx + dz * dz;
          const t = Math.max(0, Math.min(1,
            ((record.x - segment.x1) * dx + (record.z - segment.z1) * dz) / length2));
          return { segment, distance: Math.hypot(record.x - segment.x1 - t * dx,
            record.z - segment.z1 - t * dz) };
        }).sort((a, b) => a.distance - b.distance)[0].segment;
        const dot = (tipX - wingX) * (nearest.x2 - nearest.x1) +
          (tipZ - wingZ) * (nearest.z2 - nearest.z1);
        assert.ok(record.direction === 'Forward' ? dot > 0 : dot < 0,
          `${id} arrowhead follows exported ${record.direction} direction`);
      }
    }
  } finally {
    visual.dispose();
  }
});
