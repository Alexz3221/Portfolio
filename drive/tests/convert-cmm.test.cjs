'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { convert, trafficFlow, TerrainDecoder } = require('../scripts/convert-cmm.cjs');

test('traffic flow is independent of road class and follows native car access', () => {
  assert.equal(trafficFlow({forward:'allowed',backward:'forbidden'}), 'forward-only');
  assert.equal(trafficFlow({forward:'forbidden',backward:'allowed'}), 'backward-only');
  assert.equal(trafficFlow({forward:'allowed',backward:'allowed'}), 'two-way');
  assert.equal(trafficFlow(null), 'unknown');
});

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
    const laneFiles = manifest.laneGraph?.tiles.flatMap(tile =>
      [tile.edgeLanes?.file, tile.connectors?.file].filter(Boolean)) || [];
    for (const file of ['manifest.json', 'overview.json', 'terrain.json', ...manifest.tiles.map(t => t.file),
      ...laneFiles, ...(manifest.trafficLights ? [manifest.trafficLights.file] : [])]) {
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
  assert.equal(manifest.laneGraph, undefined, 'older CMM exports keep the existing manifest shape');
  assert.equal(manifest.trafficLights, undefined);
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
  assert.equal(overview.roads[0].trafficFlow, 'forward-only');
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
  assert.equal(right.trafficFlow, 'forward-only');
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

test('native lane curves stream into local-coordinate tiles with full indexes and flags', async () => {
  const source = fixture();
  const edge = {
    entity_id: 301, entity_version: 2, edge_id: 11, edge_version: 7,
    edge_start_node_id: 100, edge_end_node_id: 101,
    start_lane_index: 1, end_lane_index: 2,
    start_path_index: 1025, end_path_index: 2050,
    edge_delta: [0.2, 0.8], width_m: 3.5, speed_limit_mps: 16.667,
    car_flags: 17, twoway: false, forbidden: true, unsafe: false, public_only: true,
    curve: [[115, 5, 210], [119, 6, 210], [121, 7, 211], [125, 8, 211]],
  };
  const connector = {
    entity_id: 501, entity_version: 3, node_id: 101, node_version: 4,
    from_edge_id: 11, from_edge_version: 7,
    from_lane_index: 2, from_path_index: 2050,
    to_edge_id: 11, to_edge_version: 7,
    to_lane_index: 1, to_path_index: 1025,
    path_methods: 'Road', path_methods_bits: 1, width_m: null, car_flags: 8,
    forbidden: false, unsafe: true, public_only: false,
    curve: [[119, 8, 211], [120, 8, 211], [121, 8, 211], [122, 8, 211]],
  };
  source.extensions = { cs2: { lane_graph: {
    schema_version: 1,
    edge_lanes: [edge, { ...edge, entity_id: 302, curve: [[135, 5, 230], [136, 5, 230], [137, 5, 230], [138, 5, 230]] }],
    connectors: [connector],
    stats: { edge_lanes: 2, connectors: 1, unresolved_connectors: 9, invalid_curves: 0 },
  } } };
  const { manifest, summary, read } = await run(source, { bounds: [100, 200, 130, 220] });
  const graph = manifest.laneGraph;
  assert.equal(graph.format, 'drive-city-lane-graph-v1');
  assert.equal(graph.schemaVersion, 1);
  assert.equal(graph.coordinateSystem, 'browser-local-xyz');
  assert.deepEqual(graph.counts, {
    sourceEdgeLanes: 2, sourceConnectors: 1,
    selectedEdgeLanes: 1, selectedConnectors: 1,
  });
  assert.equal(graph.sourceStats.unresolved_connectors, 9);
  assert.deepEqual(graph.tiles.map(tile => [tile.ix, tile.iz]), [[-1, -1], [0, -1]]);
  assert.equal(summary.laneGraph.tiles, 2);
  const shift = manifest.verticalOriginWorld - 5;
  for (const tile of graph.tiles) {
    const edgeTile = read(tile.edgeLanes.file);
    const connectorTile = read(tile.connectors.file);
    assert.equal(edgeTile.items.length, 1);
    assert.equal(connectorTile.items.length, 1);
    const localEdge = Object.fromEntries(graph.edgeFields.map((field, i) => [field, edgeTile.items[0][i]]));
    const localConnector = Object.fromEntries(graph.connectorFields.map((field, i) => [field, connectorTile.items[0][i]]));
    assert.equal(localEdge.entity_id, 301);
    assert.equal(localEdge.edge_version, 7);
    assert.equal(localEdge.start_path_index, 1025);
    assert.equal(localEdge.end_path_index, 2050);
    assert.equal(localEdge.car_flags, 17);
    assert.equal(localEdge.forbidden, true);
    assert.equal(localEdge.public_only, true);
    assert.deepEqual(localEdge.edge_delta, [0.2, 0.8]);
    assert.deepEqual(localEdge.curve, [
      [-5, -shift, -10], [-1, 1 - shift, -10],
      [1, 2 - shift, -9], [5, 3 - shift, -9],
    ]);
    assert.equal(localConnector.from_path_index, 2050);
    assert.equal(localConnector.to_path_index, 1025);
    assert.equal(localConnector.path_methods_bits, 1);
    assert.equal(localConnector.unsafe, true);
    assert.equal(localConnector.width_m, null);
    assert.deepEqual(localConnector.curve[0], [-1, 3 - shift, -9]);
  }
});

test('connector copies follow the source lane across tile seams with both endpoint lanes present', async () => {
  const source = fixture();
  source.networks[0].geometry.points[1] = { x: 120, y: 15, z: 205 };
  source.networks.push({ id: 14, kind: 'ROAD', mode: 'GROUND', level: 'MAIN', width: 8,
    name: 'One Way Road', game_name: 'Merge Street', lane_summary: { car_lane_count: 1 },
    car_access: { forward: 'allowed', backward: 'forbidden' },
    geometry: { points: [{ x: 125, y: 15, z: 205 }, { x: 155, y: 15, z: 205 }] } });
  const from = { entity_id: 301, entity_version: 1, edge_id: 11, edge_version: 1,
    start_lane_index: 2, end_lane_index: 2, edge_delta: [0, 1], width_m: 3,
    curve: [[105, 5, 205], [110, 8, 205], [115, 12, 205], [120, 15, 205]] };
  const to = { entity_id: 302, entity_version: 1, edge_id: 14, edge_version: 1,
    start_lane_index: 2, end_lane_index: 2, edge_delta: [0, 1], width_m: 3,
    curve: [[125, 15, 205], [135, 15, 205], [145, 15, 205], [155, 15, 205]] };
  const connector = { entity_id: 501, entity_version: 1, node_id: 900, node_version: 1,
    from_edge_id: 11, from_lane_index: 2, to_edge_id: 14, to_lane_index: 2,
    path_methods: 'Road', path_methods_bits: 2, width_m: 3, forbidden: false,
    curve: [[120, 15, 205], [121, 15, 205], [124, 15, 205], [125, 15, 205]] };
  source.extensions = { cs2: { lane_graph: { schema_version: 1,
    edge_lanes: [from, to], connectors: [connector],
    stats: { edge_lanes: 2, connectors: 1, unresolved_connectors: 0, invalid_curves: 0 },
  } } };
  const { manifest, read } = await run(source, { bounds: [100, 200, 160, 220] });
  const graph = manifest.laneGraph;
  assert.equal(graph.counts.selectedEdgeLanes, 2);
  assert.equal(graph.counts.selectedConnectors, 1);
  const byTile = new Map(graph.tiles.map(tile => [`${tile.ix}_${tile.iz}`, tile]));
  const sourceTile = byTile.get('-1_-1');
  const connectorTile = byTile.get('0_-1');
  assert.ok(sourceTile?.connectors && connectorTile?.connectors,
    'the connector reaches the road tile before its own Bezier starts');
  assert.equal(sourceTile.connectors.count, 1);
  assert.equal(connectorTile.connectors.count, 1);
  for (const tile of [sourceTile, connectorTile]) {
    const lanes = read(tile.edgeLanes.file).items.map(row =>
      Object.fromEntries(graph.edgeFields.map((field, i) => [field, row[i]])));
    const connections = read(tile.connectors.file).items.map(row =>
      Object.fromEntries(graph.connectorFields.map((field, i) => [field, row[i]])));
    const sourceLane = lanes.find(lane => lane.edge_id === 11);
    const targetLane = lanes.find(lane => lane.edge_id === 14);
    assert.equal(lanes.length, 2, 'each local connector tile has exactly one copy of each endpoint lane');
    assert.deepEqual(sourceLane.curve[3], connections[0].curve[0]);
    assert.deepEqual(targetLane.curve[0], connections[0].curve[3]);
  }
  const sourceLane = read(sourceTile.edgeLanes.file).items.find(row => row[2] === 11);
  assert.ok(sourceLane.at(-1)[3][0] - 11 < 0,
    'an arrow eleven meters before the connector belongs to the source road tile');
});

test('unsupported native lane graph version fails conversion', async () => {
  const source = fixture();
  source.extensions = { cs2: { lane_graph: { schema_version: 2, edge_lanes: [], connectors: [] } } };
  await assert.rejects(run(source), /Unsupported CMM lane graph schema/);
});

test('source traffic lights preserve native node positions and active states', async () => {
  const source = fixture();
  source.traffic = { lights: [
    { node_id: 101, position: { x: 120, y: 7, z: 210 }, active: true, states: [] },
    { node_id: 102, position: { x: 125, y: 9, z: 215 }, active: false, states: [] },
    { node_id: 103, position: { x: 135, y: 5, z: 230 }, active: true, states: [] },
  ] };
  const { manifest, read } = await run(source, { bounds: [100, 200, 130, 220] });
  const descriptor = manifest.trafficLights;
  assert.deepEqual(descriptor, { file: 'traffic-lights.json', count: 2, sourceCount: 3 });
  const payload = read(descriptor.file);
  assert.equal(payload.format, 'drive-city-traffic-lights-v1');
  assert.equal(payload.coordinateSystem, 'browser-local-xyz');
  const shift = manifest.verticalOriginWorld - 5;
  assert.deepEqual(payload.lights, [
    { nodeId: 101, position: [0, 2 - shift, -10], active: true },
    { nodeId: 102, position: [5, 4 - shift, -5], active: false },
  ]);
});

test('invalid traffic light geometry fails conversion', async () => {
  const source = fixture();
  source.traffic = { lights: [{ node_id: 101, position: { x: 120, y: null, z: 210 }, active: true }] };
  await assert.rejects(run(source), /CMM traffic light has an invalid/);
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
