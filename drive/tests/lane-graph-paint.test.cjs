'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const Imported = require('../js/imported-city');

test('native lane connections paint only permitted turns, merges, and signaled stop lines', async () => {
  const base = 'data/lane-paint/';
  const edgeFields = ['entity_id', 'entity_version', 'edge_id', 'edge_version',
    'edge_start_node_id', 'edge_end_node_id', 'start_lane_index', 'end_lane_index',
    'start_path_index', 'end_path_index', 'edge_delta', 'width_m', 'speed_limit_mps',
    'car_flags', 'twoway', 'forbidden', 'unsafe', 'public_only', 'curve'];
  const connectorFields = ['entity_id', 'entity_version', 'node_id', 'node_version',
    'from_edge_id', 'from_edge_version', 'from_lane_index', 'from_path_index',
    'to_edge_id', 'to_edge_version', 'to_lane_index', 'to_path_index',
    'path_methods', 'path_methods_bits', 'width_m', 'car_flags',
    'forbidden', 'unsafe', 'public_only', 'curve'];
  const row = (fields, item) => fields.map(field => item[field] ?? null);
  const edge = (id, owner, start, end, curve) => row(edgeFields, {
    entity_id: id, entity_version: 1, edge_id: owner, edge_version: 1,
    edge_start_node_id: 1, edge_end_node_id: 5, start_lane_index: start,
    end_lane_index: end, start_path_index: 1, end_path_index: 1,
    edge_delta: [0, 1], width_m: 3, speed_limit_mps: 14, car_flags: 0,
    twoway: false, forbidden: false, unsafe: false, public_only: false, curve
  });
  const connector = (id, from, to, destination, forbidden = false) => row(connectorFields, {
    entity_id: id, entity_version: 1, node_id: 5, node_version: 1,
    from_edge_id: from, from_edge_version: 1, from_lane_index: 1,
    from_path_index: 1, to_edge_id: to, to_edge_version: 1,
    to_lane_index: 1, to_path_index: 1, path_methods: 'Road',
    path_methods_bits: 2, width_m: 3, car_flags: 0,
    forbidden, unsafe: false, public_only: false,
    curve: [[100, 0, from === 4 ? 114 : 100],
      [102, 0, from === 4 ? 112 : 100],
      [104, 0, destination[2]], destination]
  });
  const lanes = [
    edge(11, 1, 1, 1, [[10, 0, 100], [40, 0, 100], [70, 0, 100], [100, 0, 100]]),
    edge(12, 2, 1, 1, [[106, 0, 100], [135, 0, 100], [165, 0, 100], [200, 0, 100]]),
    edge(13, 3, 1, 1, [[105, 0, 96], [105, 0, 70], [105, 0, 40], [105, 0, 10]]),
    edge(14, 4, 1, 1, [[10, 0, 114], [40, 0, 114], [70, 0, 114], [100, 0, 114]]),
    edge(15, 5, 1, 1, [[105, 0, 104], [105, 0, 130], [105, 0, 160], [105, 0, 200]])
  ];
  const connections = [
    connector(21, 1, 2, [106, 0, 100]),
    connector(22, 1, 3, [105, 0, 96]),
    connector(23, 1, 5, [105, 0, 104], true),
    connector(24, 4, 2, [106, 0, 100]),
    connector(25, 4, 5, [105, 0, 104])
  ];
  const roads = [
    { type: 'road', id: '1', kind: 'ROAD', width: 8, points: [[10, 0, 100], [100, 0, 100]] },
    { type: 'road', id: '2', kind: 'ROAD', width: 8, points: [[106, 0, 100], [200, 0, 100]] },
    { type: 'road', id: '3', kind: 'ROAD', width: 8, points: [[105, 0, 96], [105, 0, 10]] },
    { type: 'road', id: '4', kind: 'ROAD', width: 8, points: [[10, 0, 114], [100, 0, 114]] },
    { type: 'road', id: '5', kind: 'ROAD', width: 8, points: [[105, 0, 104], [105, 0, 200]] }
  ];
  const manifest = { format: 'drive-city-v1', bounds: { minX: 0, maxX: 256, minZ: 0, maxZ: 256 },
    tileSize: 256, focus: [100, 100], terrain: { file: 'terrain.json' },
    trafficLights: { file: 'traffic-lights.json', count: 1 },
    laneGraph: { format: 'drive-city-lane-graph-v1', schemaVersion: 1,
      edgeFields, connectorFields,
      tiles: [{ ix: 0, iz: 0, edgeLanes: { file: 'lane-graph/edgeLanes/0_0.json', count: lanes.length },
        connectors: { file: 'lane-graph/connectors/0_0.json', count: connections.length } }] },
    tiles: [{ ix: 0, iz: 0, file: 'tiles/0_0.json', buildingCount: 0 }] };
  const files = new Map([
    [base + 'manifest.json', manifest],
    [base + 'overview.json', { format: 'drive-city-overview-v1', roads, districts: [], stops: [] }],
    [base + 'terrain.json', { format: 'drive-city-terrain-v1', rows: 4, cols: 4,
      origin: [0, 0], cell: 64, heights: Array(16).fill(0) }],
    [base + 'traffic-lights.json', { format: 'drive-city-traffic-lights-v1',
      lights: [{ nodeId: 5, position: [102, 0, 100], active: true }] }],
    [base + 'tiles/0_0.json', { format: 'drive-city-tile-v1', features: roads }],
    [base + 'lane-graph/edgeLanes/0_0.json', { format: 'drive-city-lane-tile-v1',
      kind: 'edgeLanes', ix: 0, iz: 0, items: lanes }],
    [base + 'lane-graph/connectors/0_0.json', { format: 'drive-city-lane-tile-v1',
      kind: 'connectors', ix: 0, iz: 0, items: connections }]
  ]);
  const map = await Imported.load(base + 'manifest.json', {
    fetch: async url => ({ ok: files.has(url), json: async () => files.get(url) })
  });
  const world = new THREE.Group(), visual = map.build(THREE, world);
  try {
    const arrow = world.getObjectByName('imported-city-turn-arrow');
    const records = arrow?.userData.turnArrows || [];
    const main = records.find(record => record.roadId === '1' && record.laneIndex === 1);
    assert.deepEqual(main?.turns, ['straight', 'right'],
      'an eastbound lane bending toward negative Z turns right on the city map');
    assert.deepEqual(main?.connectorIds.sort(), ['21', '22']);
    const other = records.find(record => record.roadId === '4' && record.laneIndex === 1);
    assert.deepEqual(other?.turns, ['left', 'straight'],
      'an eastbound lane bending toward positive Z turns left on the city map');
    const positions = arrow.geometry.attributes.position;
    const nearbyZ = record => {
      const values = [];
      for (let i = 0; i < positions.count; i++) {
        const px = positions.getX(i), pz = positions.getZ(i);
        if (Math.abs(px - record.x) < 2 && Math.abs(pz - record.z) < 3)
          values.push(pz);
      }
      return values;
    };
    assert.ok(Math.min(...nearbyZ(main)) < main.z - 1.1,
      'the right arrowhead is painted toward negative Z');
    assert.ok(Math.max(...nearbyZ(other)) > other.z + 1.1,
      'the left arrowhead is painted toward positive Z');
    assert.ok(world.getObjectByName('imported-city-merge-guide')?.geometry.attributes.position.count > 0);
    assert.ok(world.getObjectByName('imported-city-stop-line')?.geometry.attributes.position.count > 0);
    assert.equal(map.laneConnectors.length, 4, 'the forbidden turn has no driveable ribbon');
  } finally { visual.dispose(); }
});
