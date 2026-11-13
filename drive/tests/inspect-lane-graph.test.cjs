'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { inspect } = require('../scripts/inspect-lane-graph.cjs');

const curve = [[0, 0, 0], [2, 0, 0], [8, 0, 4], [10, 0, 4]];

function fixture() {
  return {
    schema_version: 'cmm-v1',
    terrain: { height: { data: 'A'.repeat(1024 * 1024) } },
    nodes: [{ id: 1 }], networks: [{ id: 10 }, { id: 11 }],
    extensions: { cs2: { lane_graph: {
      schema_version: 1,
      edge_lanes: [
        { entity_id: 20, entity_version: 1, edge_id: 10, edge_version: 1,
          start_lane_index: 2, end_lane_index: 2, edge_delta: [0, 1],
          width_m: 3.5, curve },
        { entity_id: 21, entity_version: 1, edge_id: 11, edge_version: 1,
          start_lane_index: 3, end_lane_index: 3, edge_delta: [0, 1],
          width_m: 3.5, curve },
      ],
      connectors: [{ entity_id: 30, entity_version: 1, node_id: 1,
        from_edge_id: 10, from_edge_version: 1, from_lane_index: 2,
        to_edge_id: 11, to_edge_version: 1,
        to_lane_index: 3, forbidden: false, unsafe: false, curve }],
      stats: { edge_lanes: 2, connectors: 1, unresolved_connectors: 0, invalid_curves: 0 },
    } } },
  };
}

async function withGzip(document, run) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'lane-graph-test-'));
  const file = path.join(folder, 'city.cmm.gz');
  try {
    await fs.writeFile(file, zlib.gzipSync(JSON.stringify(document)));
    return await run(file);
  } finally {
    await fs.rm(file, { force: true });
    await fs.rmdir(folder);
  }
}

test('lane graph inspection streams a CMM export and resolves connector lanes', async () => {
  const summary = await withGzip(fixture(), inspect);
  assert.equal(summary.errorCount, 0);
  assert.equal(summary.networks, 2);
  assert.equal(summary.edgeLanes, 2);
  assert.equal(summary.connectors, 1);
  assert.equal(summary.unmatchedLaneRefs, 0);
});

test('lane graph inspection reports dangling edges and unmatched lane indexes', async () => {
  const document = fixture();
  const connector = document.extensions.cs2.lane_graph.connectors[0];
  connector.to_edge_id = 99;
  connector.to_lane_index = 8;
  const summary = await withGzip(document, inspect);
  assert.equal(summary.errorCount, 1);
  assert.match(summary.errors[0], /absent road/);
  assert.equal(summary.unmatchedLaneRefs, 1);
});

test('derived CMM nodes and roads may have negative source IDs', async () => {
  const document = fixture();
  document.nodes.push({ id: -1 });
  document.networks.push({ id: -2 });
  const summary = await withGzip(document, inspect);
  assert.equal(summary.errorCount, 0);
  assert.equal(summary.nodes, 2);
  assert.equal(summary.networks, 3);

  document.extensions.cs2.lane_graph.connectors[0].from_edge_id = -2;
  const negativeNativeRef = await withGzip(document, inspect);
  assert.ok(negativeNativeRef.errorCount > 0,
    'game entity references must remain nonnegative even when derived source IDs are signed');
});

test('lane graph inspection identifies an older export without connector data', async () => {
  const document = fixture();
  delete document.extensions;
  const summary = await withGzip(document, inspect);
  assert.ok(summary.errorCount >= 2);
  assert.match(summary.errors.join(' '), /lane graph schema/);
});
