#!/usr/bin/env node
'use strict';

// Development-only synthetic CSLModernMap fixture. Remove generated data before
// publishing if it has not been replaced by the real city export.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { convert } = require('../../scripts/convert-cmm.cjs');

const out = path.resolve(process.argv[2] || path.join(__dirname, '../../data/imported-city'));
const rows = 12, cols = 12, cell = 50, seaLevel = 10;
const heights = [], waterDepths = [];
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  heights.push(seaLevel + Math.sin(c * 0.45) * 0.8 + Math.cos(r * 0.35) * 0.7);
  waterDepths.push(0);
}
function grid(values) {
  const raw = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => raw.writeFloatLE(v, i * 4));
  return { rows, cols, origin: [-300, -300], cell, axis: 'rows=north;columns=east',
    encoding: 'base64+zlib+float32-row-major', data: zlib.deflateSync(raw).toString('base64') };
}
const point = (x, y, z) => ({ x, y, z });
const road = (id, points, width = 14, mode = 'normal', level = 0) => ({
  id, kind: 'ROAD', mode, level, width, geometry: { points: points.map(p => point(...p)) },
});
const rect = (x, z, w, d) => ({ points: [
  { x: x - w / 2, z: z - d / 2 }, { x: x + w / 2, z: z - d / 2 },
  { x: x + w / 2, z: z + d / 2 }, { x: x - w / 2, z: z + d / 2 },
] });
const buildings = [];
let id = 1000;
for (let z = -200; z <= 200; z += 80) for (let x = -200; x <= 200; x += 80) {
  if (Math.abs(x) < 40 || Math.abs(z) < 40) continue;
  buildings.push({ id: id++, display_name: { text: `Synthetic tower ${id}` },
    role: x > 0 ? 'COMMERCIAL' : 'RESIDENTIAL', category: 'VALIDATION',
    base_elevation_m: 10, height_m: 15 + ((x + z + 400) % 100), footprint: rect(x, z, 28, 32) });
}
const doc = {
  schema_version: 'cmm-v1',
  metadata: { origin: { source_name: 'SYNTHETIC VALIDATION CITY' }, crs: 'world-meters-y-up; rows=north' },
  sea_level: seaLevel,
  terrain: { rows, cols, origin: [-300, -300], cell, height: grid(heights), water_depth: grid(waterDepths) },
  nodes: [],
  networks: [
    road(1, [[-280, 10, -100], [0, 11, -100], [280, 11.5, -100]]),
    road(2, [[-280, 10, 100], [0, 10.5, 100], [280, 10, 100]]),
    road(3, [[-100, 10, -280], [-100, 10.8, 0], [-100, 10, 280]]),
    road(4, [[100, 10, -280], [100, 10.4, 0], [100, 10, 280]]),
    road(5, [[-280, 19, -180], [0, 20, 0], [280, 19, 180]], 20, 'elevated', 1),
  ],
  buildings,
  districts: [{ id: 1, name: { text: 'Synthetic Downtown' }, kind: 'ADMINISTRATIVE_DISTRICT',
    boundary: { points: [[-240, -240], [240, -240], [240, 240], [-240, 240]] } }],
};

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synthetic-cmm-'));
  try {
    const input = path.join(dir, 'synthetic.cmm.gz');
    fs.writeFileSync(input, zlib.gzipSync(Buffer.from(JSON.stringify(doc))));
    const result = await convert({ input, out, tileSize: 200, terrainCell: 50, maxTerrainSamples: 10000 });
    console.log(`Synthetic browser fixture: ${out}`);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
