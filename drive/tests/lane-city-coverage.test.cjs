'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const THREE = require('three');
const Imported = require('../js/imported-city');

test('all seven city centers stream finite lane-junction surfaces within a bounded tile set', async () => {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'data/imported-city/manifest.json')));
  assert.equal(manifest.laneGraph?.format, 'drive-city-lane-graph-v1');
  assert.equal(manifest.centerCandidates.length, 7);
  const map = await Imported.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () =>
      JSON.parse(await fs.readFile(path.join(root, url))) })
  });
  const world = new THREE.Group();
  const visual = map.build(THREE, world);
  try {
    for (const center of manifest.centerCandidates) {
      await map.ensureNear(center.x, center.z, 700);
      visual.update({ position: { x: center.x,
        y: map.terrainHeight(center.x, center.z) + 20, z: center.z } }, 0);
      const loaded = [...map.loadedTiles.values()].filter(tile => tile.state === 'loaded');
      assert.ok(loaded.length > 0 && loaded.length <= 16,
        `${center.id} keeps a bounded set of city tiles`);
      assert.ok(loaded.some(tile => tile.descriptor.ix === center.ix &&
        tile.descriptor.iz === center.iz), `${center.id} loaded its own tile`);
      assert.ok(loaded.some(tile => tile.data.edgeLanes?.length &&
        tile.data.connectors?.length), `${center.id} has source lane paths`);
      const surfaces = [];
      world.traverse(object => {
        if (object.name === 'imported-city-lane-connector' && object.isMesh &&
            object.parent?.visible !== false) surfaces.push(object);
      });
      assert.ok(surfaces.length > 0, `${center.id} rendered source connector pavement`);
      let vertices = 0;
      for (const surface of surfaces) {
        const position = surface.geometry.attributes.position;
        vertices += position.count;
        for (let i = 0; i < position.count; i++)
          assert.ok(Number.isFinite(position.getX(i)) &&
            Number.isFinite(position.getY(i)) && Number.isFinite(position.getZ(i)),
          `${center.id} connector pavement has finite vertices`);
      }
      assert.ok(vertices > 60 && vertices < 1_000_000,
        `${center.id} has visible connector geometry without an unbounded batch`);
    }
  } finally {
    visual.dispose();
  }
});
