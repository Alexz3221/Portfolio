'use strict';

// Read-only CANNON sweep of every exported elevated graph junction. It checks
// the actual streamed road/connector bodies against the lane surface a car
// would follow, rather than comparing two source records by ID alone.
const fs = require('node:fs/promises');
const path = require('node:path');
const C = require('cannon');
const Imported = require('../js/imported-city');
const Physics = require('../js/physics');

const root = path.resolve(__dirname, '..');
const round = value => Number(value.toFixed(3));

async function main() {
  const map = await Imported.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () =>
      JSON.parse(await fs.readFile(path.join(root, url), 'utf8')) })
  });
  await map.ensureAll();
  const all = process.argv.includes('--all');
  const sites = new Map();
  for (const entry of map.loadedTiles.values())
    for (const site of entry.data?.elevatedMerges || []) sites.set(site.nodeId, site);

  // Keep all already loaded city tiles while moving the audit chassis from
  // site to site. The browser itself still streams around the player.
  const city = { ...map, ensureNear: () => Promise.resolve([]) };
  const physics = Physics.create({ map: 'city', city, distanceToRoad: map.distanceToRoad,
    roadHalfWidth: map.roadHalfWidth });
  physics.body.collisionResponse = false;
  let samples = 0, mismatches = 0, gaps = 0, obstacles = 0;
  const worst = [];
  const groups = new Map();
  if (all) {
    const cellSize = 120;
    for (const connector of map.laneConnectors) {
      if (connector.forbidden || !connector.samples?.length) continue;
      for (let i = 0; i < connector.samples.length; i += 3) {
        const sample = connector.samples[i];
        const ix = Math.floor(sample.x / cellSize), iz = Math.floor(sample.z / cellSize);
        const key = `${ix},${iz}`;
        if (!groups.has(key)) groups.set(key, {
          x: (ix + .5) * cellSize, z: (iz + .5) * cellSize, entries: [] });
        groups.get(key).entries.push({ connector, sample });
      }
    }
  } else {
    for (const site of sites.values()) {
      const connectors = map.nearbyLaneConnectors(site.x, site.z, 70)
        .filter(item => String(item.node_id) === site.nodeId);
      groups.set(site.nodeId, { x: site.x, z: site.z,
        entries: connectors.filter(item => !item.forbidden).flatMap(connector =>
          connector.samples.filter((_, i) => i % 2 === 0)
            .map(sample => ({ connector, sample }))) });
    }
  }
  try {
    let processed = 0;
    for (const group of groups.values()) {
      physics.reset(group.x, group.z);
      for (const { connector, sample } of group.entries) {
          const result = new C.RaycastResult();
          const hit = physics.world.raycastClosest(
            new C.Vec3(sample.x, sample.y + 1.4, sample.z),
            new C.Vec3(sample.x, sample.y - 1.4, sample.z), {}, result);
          samples++;
          const delta = hit ? result.hitPointWorld.y - sample.y : -Infinity;
          if (Math.abs(delta) <= .5) continue;
          mismatches++;
          if (delta < 0) gaps++; else obstacles++;
          worst.push({ node: connector.node_id, connector: connector.entity_id,
            x: round(sample.x), z: round(sample.z), laneY: round(sample.y),
            colliderY: hit ? round(result.hitPointWorld.y) : null,
            delta: Number.isFinite(delta) ? round(delta) : null,
            body: hit && result.body ? {
              x: round(result.body.position.x), y: round(result.body.position.y),
              z: round(result.body.position.z), shapes: result.body.shapes.length,
              type: result.shape?.type ?? null,
              source: result.body.citySource || null
            } : null });
      }
      processed++;
      if (all && processed % 250 === 0) console.error(`Audited ${processed}/${groups.size} city cells`);
    }
  } finally { physics.dispose(); }
  worst.sort((a, b) => Math.abs(b.delta ?? 3) - Math.abs(a.delta ?? 3));
  const bySource = {};
  for (const hit of worst) {
    const kind = hit.body?.source?.kind || 'unknown';
    bySource[kind] = (bySource[kind] || 0) + 1;
  }
  console.log(JSON.stringify({ sites: sites.size, cells: groups.size, samples, mismatches, gaps, obstacles,
    overOneMeter: worst.filter(hit => Math.abs(hit.delta ?? 0) > 1).length,
    affectedNodes: new Set(worst.map(hit => String(hit.node))).size, bySource,
    largest: worst.slice(0, 20) }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
