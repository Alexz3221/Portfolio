'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { convert, TerrainDecoder } = require('../scripts/convert-cmm.cjs');

function grid(values, rows = 4, cols = 4) {
  const raw = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => raw.writeFloatLE(v, i * 4));
  return {
    rows, cols, origin: [100, 200], cell: 10,
    axis: 'rows=north;columns=east', encoding: 'base64+zlib+float32-row-major',
    data: zlib.deflateSync(raw).toString('base64'),
  };
}

function fixture() {
  const heights = Array.from({ length: 16 }, (_, i) => i + 5);
  return {
    schema_version: 'cmm-v1',
    metadata: { origin: { source_name: 'Testopolis' }, crs: 'world-meters-y-up; rows=north' },
    sea_level: 5,
    terrain: { rows: 4, cols: 4, origin: [100, 200], cell: 10,
      height: grid(heights), water_depth: grid(Array.from({ length: 16 }, (_, i) => i % 3)) },
    nodes: Array.from({ length: 100 }, (_, i) => ({ id: i, position: { x: i, y: 5, z: 5 } })),
    networks: [
      { id: 11, kind: 'ROAD', mode: 'elevated', level: 'HIGHWAY', width: 12,
        name: 'Highway Oneway - 2 lanes', game_name: 'Aurora Parkway', lane_summary: { car_lane_count: 2 },
        car_access: { forward: 'allowed', backward: 'forbidden' },
        geometry: { points: [{ x: 105, y: 5, z: 205 }, { x: 135, y: 15, z: 205 }] } },
      { id: 12, kind: 'RAIL', width: 6,
        geometry: { points: [{ x: 105, y: 5, z: 215 }, { x: 135, y: 5, z: 215 }] } },
      { id: 13, kind: 'ROAD', mode: 'GROUND', level: 'SPECIAL', width: 60,
        name: 'Invisible Airplane Runway', car_access: { forward: 'forbidden', backward: 'forbidden' },
        geometry: { points: [{ x: 105, y: 5, z: 215 }, { x: 135, y: 5, z: 215 }] } },
    ],
    buildings: [
      { id: 21, display_name: { text: 'Night Owl' }, role: 'COMMERCIAL', category_name: 'SHOP',
        base_elevation_m: 7, height_m: 22,
        footprint: { points: [{ x: 127, z: 207 }, { x: 133, z: 207 }, { x: 133, z: 213 }, { x: 127, z: 213 }] } },
      { id: 22, name: 'Old Mill', height_m: 10,
        footprint: { points: [[107, 227], [113, 227], [113, 233], [107, 233]] } },
    ],
    districts: [
      { id: 30, name: { text: 'Midnight Ward' }, kind: 'ADMINISTRATIVE_DISTRICT',
        boundary: { points: [[100, 200], [140, 200], [140, 240], [100, 240]] } },
    ],
    traffic: { hugeIgnoredField: Array.from({ length: 100 }, (_, i) => `discard ${i}`) },
  };
}

async function run(inputObject, options = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-cmm-'));
  const input = path.join(temp, 'city.cmm.gz');
  const out = path.join(temp, 'converted');
  fs.writeFileSync(input, zlib.gzipSync(Buffer.from(JSON.stringify(inputObject))));
  try {
    const { stopsData, ...converterOptions } = options;
    if (stopsData) {
      converterOptions.stopsFile = path.join(temp, 'stops.json');
      fs.writeFileSync(converterOptions.stopsFile, JSON.stringify(stopsData));
    }
    const summary = await convert({ input, out, tileSize: 20, terrainCell: 10, maxTerrainSamples: 1000, ...converterOptions });
    const files = new Map();
    const readNow = file => JSON.parse(fs.readFileSync(path.join(out, file), 'utf8'));
    const manifest = readNow('manifest.json');
    for (const file of ['manifest.json', 'overview.json', 'terrain.json', ...manifest.tiles.map(t => t.file)]) {
      files.set(file, readNow(file));
    }
    const read = file => files.get(file);
    return { summary, manifest, overview: read('overview.json'), terrain: read('terrain.json'), read };
  } finally {
    // All paths are created under this explicit temporary directory.
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

test('whole-city conversion preserves road height, tile seams, footprints, terrain, and districts', async () => {
  const { summary, manifest, overview, terrain, read } = await run(fixture());
  assert.equal(manifest.format, 'drive-city-v1');
  assert.equal(manifest.source.cityName, 'Testopolis');
  const shift = manifest.verticalOriginWorld - 5;
  assert.deepEqual(manifest.originWorld, [120, manifest.verticalOriginWorld, 220]);
  assert.deepEqual(manifest.bounds, { minX: -20, minZ: -20, maxX: 20, maxZ: 20 });
  assert.deepEqual(terrain.origin, [-20, -20]);
  assert.equal(terrain.cell, 10);
  assert.deepEqual(terrain.heights, Array.from({ length: 16 }, (_, i) => i - shift));
  assert.equal(terrain.waterDepths[6], 0);
  assert.equal(terrain.heights[4], 4 - shift, 'second row increases toward +Z');
  assert.equal(overview.roads.length, 1, 'rail and car-forbidden runway are omitted from roads');
  assert.equal(overview.roads[0].roadClass, 'highway');
  assert.equal(overview.roads[0].name, 'Aurora Parkway');
  assert.equal(overview.roads[0].lanes.car_lane_count, 2);
  assert.equal(overview.districts[0].name, 'Midnight Ward');
  assert.deepEqual(overview.districts[0].polygon[0], [-20, -20]);
  const left = read('tiles/-1_-1.json').features.find(f => f.type === 'road');
  const right = read('tiles/0_-1.json').features.find(f => f.type === 'road');
  assert.deepEqual(left.points.at(-1), [0, 5 - shift, -15]);
  assert.deepEqual(right.points[0], [0, 5 - shift, -15], 'Y is interpolated across tile seam');
  assert.equal(right.mode, 'elevated');
  assert.equal(right.width, 12);
  assert.equal(right.level, 'HIGHWAY');
  assert.equal(right.roadClass, 'highway');
  const shop = read('tiles/0_-1.json').features.find(f => f.type === 'building');
  assert.deepEqual(shop.footprint, [[7, -13], [13, -13], [13, -7], [7, -7]]);
  assert.equal(shop.baseY, 2 - shift);
  assert.equal(shop.height, 22);
  assert.equal(shop.category, 'SHOP');
  assert.equal(shop.name, 'Night Owl');
  assert.equal(summary.tiles, manifest.tiles.length);
  assert.equal(summary.counts.buildings, 2);
  assert.ok(summary.bytes > 0);
});

test('district selection clips road geometry while retaining full-city overview', async () => {
  const { manifest, overview, terrain, read } = await run(fixture(), { bounds: [120, 200, 140, 220] });
  const shift = manifest.verticalOriginWorld - 5;
  assert.deepEqual(manifest.bounds, { minX: 0, minZ: -20, maxX: 20, maxZ: 0 });
  assert.equal(terrain.rows, 2);
  assert.equal(terrain.cols, 2);
  assert.equal(overview.roads[0].points[0][0], -15, 'overview keeps source-wide roads');
  assert.deepEqual(read('tiles/0_-1.json').features.find(f => f.type === 'road').points, [[0, 5 - shift, -15], [15, 10 - shift, -15]]);
  assert.deepEqual(manifest.tiles.map(t => [t.ix, t.iz]), [[0, -1]]);
});

test('traffic lane positions and mesh-backed landmark identity survive conversion', async () => {
  const source = fixture();
  source.traffic = { segments: [{ segment_id: 11, lanes: [
    { lane_index: 2, lane_type: 'Vehicle', position: -2, width: 3.5, direction: 'Forward', speed_limit_mps: 22.222 },
    { lane_index: 3, lane_type: 'Vehicle', position: 2, width: 3.5, direction: 'Backward', speed_limit_mps: 22.222 },
    { lane_index: 4, lane_type: 'Pedestrian', position: 5, width: 2, direction: 'Forward' },
  ] }] };
  source.buildings[0].name = 'NightOwl Landmark';
  source.buildings[0].geometry_source = 'cs2:structure-container';
  source.buildings.push({ id: 23, name: 'NightOwl Landmark mesh 0', parent_building_id: 21,
    geometry_source: 'cs2:mesh-bounds', role: 'COMMERCIAL', category_name: 'SHOP',
    base_elevation_m: 7, height_m: 22,
    footprint: { points: [{ x: 127, z: 207 }, { x: 133, z: 207 }, { x: 133, z: 213 }, { x: 127, z: 213 }] } });
  const { manifest, overview, read } = await run(source);
  const lanes = [
    { position: -2, width: 3.5, direction: 'Forward', index: 2, speed: 22.222 },
    { position: 2, width: 3.5, direction: 'Backward', index: 3, speed: 22.222 },
  ];
  assert.deepEqual(overview.roads[0].laneDetails, lanes);
  const features = read('tiles/0_-1.json').features;
  assert.deepEqual(features.find(feature => feature.type === 'road').laneDetails, lanes);
  assert.deepEqual(manifest.meshBackedParentIds, ['21']);
  const parent = features.find(feature => feature.id === '21');
  const proxy = features.find(feature => feature.id === '23');
  assert.equal(parent.prefab, 'NightOwl Landmark');
  assert.equal(parent.geometrySource, 'cs2:structure-container');
  assert.equal(proxy.parentBuildingId, '21');
  assert.equal(proxy.prefab, 'NightOwl Landmark mesh 0');
});

test('city center candidates favor real dense structures over parent lot containers', async () => {
  const source = fixture();
  source.buildings = Array.from({ length: 12 }, (_, i) => ({
    ...source.buildings[0], id: 1000 + i, height_m: 120,
    geometry_source: 'cs2:structure-container'
  }));
  const containers = await run(source);
  assert.deepEqual(containers.manifest.centerCandidates, []);
  source.buildings.forEach(building => { building.geometry_source = 'cs2:mesh-bounds'; });
  const actual = await run(source);
  assert.equal(actual.manifest.centerCandidates.length, 1);
  assert.deepEqual(actual.manifest.centerCandidates[0].id, 'center-0_-1');
  assert.deepEqual([actual.manifest.centerCandidates[0].x, actual.manifest.centerCandidates[0].z], [10, -10]);
  assert.ok(actual.manifest.centerCandidates[0].score >= 80);
});

test('authored portfolio stops use source world coordinates and preserve landmark references', async () => {
  const { overview } = await run(fixture(), { stopsData: {
    format: 'drive-city-stops-v1', coordinateSystem: 'source-world-xz', cityName: 'Testopolis',
    stops: [{ id: 'education', x: 125, z: 205, landmarkId: '21', landmark: 'Night Owl', roadId: '11' }],
  } });
  assert.deepEqual(overview.stops, [{ id: 'education', x: 5, z: -15,
    landmarkId: '21', landmark: 'Night Owl', roadId: '11' }]);
});

test('invalid schema fails before producing browser assets', async () => {
  await assert.rejects(run({ ...fixture(), schema_version: 'cmm-v2' }), /Unsupported CSLModernMap schema/);
});

test('large terrain strings cross gzip chunks and are sampled under the configured cap', async () => {
  const source = fixture();
  const rows = 128, cols = 128;
  const values = Array.from({ length: rows * cols }, (_, i) => 5 + Math.sin(i * 0.13) * 20);
  source.terrain = {
    rows, cols, origin: [100, 200], cell: 10,
    height: grid(values, rows, cols),
    water_depth: grid(values.map((_, i) => i % 11 === 0 ? 1.25 : 0), rows, cols),
  };
  const { terrain, summary, manifest } = await run(source, { terrainCell: 40, maxTerrainSamples: 1024 });
  assert.equal(terrain.rows, 32);
  assert.equal(terrain.cols, 32);
  assert.equal(terrain.cell, 40);
  assert.equal(terrain.heights.length, 1024);
  assert.equal(summary.terrainSamples, 1024);
  assert.ok(Math.abs(terrain.heights[0] + manifest.verticalOriginWorld - values[2 * cols + 2]) < .011);
});

test('terrain backpressure does not accumulate temporary error listeners', async () => {
  const decoder = new TerrainDecoder('height', { rows: 1, cols: 1 },
    { rows: 1, cols: 1, srcRowStart: 0, srcColStart: 0, stride: 1, seaLevel: 0 });
  decoder.inflater.write = function () { setImmediate(() => this.emit('drain')); return false; };
  for (let i = 0; i < 30; i++) {
    await decoder.push('AAAA');
    assert.equal(decoder.inflater.listenerCount('error'), 1);
  }
  decoder.sourceIndex = 1;
  decoder.inflater.end = function () { setImmediate(() => this.emit('end')); };
  await decoder.finish();
  assert.equal(decoder.inflater.listenerCount('error'), 1);
  decoder.inflater.destroy();
});
