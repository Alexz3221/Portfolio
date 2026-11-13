#!/usr/bin/env node
'use strict';

// Audits the actual tiled browser graph, including records copied at tile seams.
const fs = require('node:fs');
const path = require('node:path');

function read(root, file) { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function laneKey(edge, lane) { return `${edge}:${lane}`; }

function audit(root) {
  const manifest = read(root, 'manifest.json');
  const graph = manifest.laneGraph;
  if (graph?.format !== 'drive-city-lane-graph-v1' || graph.schemaVersion !== 1)
    throw new Error('The city has no supported lane graph');
  const overview = read(root, manifest.overview?.file || 'overview.json');
  const roads = new Set(overview.roads.map(road => String(road.id)));
  const lanes = new Map(), connectors = new Map(), local = new Map();
  const errors = [], failures = message => { if (errors.length < 12) errors.push(message); };
  const copies = { edgeLanes: 0, connectors: 0 };
  for (const tile of graph.tiles) for (const kind of ['edgeLanes', 'connectors']) {
    const descriptor = tile[kind];
    if (!descriptor) continue;
    const payload = read(root, descriptor.file);
    if (payload.format !== 'drive-city-lane-tile-v1' || payload.kind !== kind ||
        payload.ix !== tile.ix || payload.iz !== tile.iz ||
        !Array.isArray(payload.items) || payload.items.length !== descriptor.count)
      failures(`Invalid ${kind} tile ${tile.ix},${tile.iz}`);
    const fields = kind === 'edgeLanes' ? graph.edgeFields : graph.connectorFields;
    const index = kind === 'edgeLanes' ? lanes : connectors;
    const tileKey = `${tile.ix},${tile.iz}`;
    if (!local.has(tileKey)) local.set(tileKey, { edgeLanes: [], connectors: [] });
    for (const row of payload.items || []) {
      copies[kind]++;
      if (!Array.isArray(row) || row.length !== fields.length) {
        failures(`Malformed ${kind} row in ${tile.ix},${tile.iz}`); continue;
      }
      const item = Object.fromEntries(fields.map((field, i) => [field, row[i]]));
      local.get(tileKey)[kind].push(item);
      const curve = item.curve;
      if (!Array.isArray(curve) || curve.length !== 4 ||
          curve.some(point => !Array.isArray(point) || point.length !== 3 ||
            point.some(value => !Number.isFinite(value)))) {
        failures(`Invalid ${kind} curve ${item.entity_id}`); continue;
      }
      const id = `${item.entity_id}:${item.entity_version}`;
      if (index.has(id)) {
        if (JSON.stringify(index.get(id)) !== JSON.stringify(item))
          failures(`Different tile copies of ${kind} ${id}`);
      } else index.set(id, item);
    }
  }
  const endLanes = new Map(), startLanes = new Map();
  function add(index, key, item) {
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(item);
  }
  let roadLanes = 0;
  for (const lane of lanes.values()) {
    if (roads.has(String(lane.edge_id))) roadLanes++;
    add(endLanes, laneKey(lane.edge_id, lane.end_lane_index), lane);
    add(startLanes, laneKey(lane.edge_id, lane.start_lane_index), lane);
  }
  let forbidden = 0, largestEndpointGap = 0, levelErrors = 0;
  const approachRoads = new Set();
  for (const connector of connectors.values()) {
    if (connector.forbidden) forbidden++;
    const sources = endLanes.get(laneKey(connector.from_edge_id, connector.from_lane_index)) || [];
    const targets = startLanes.get(laneKey(connector.to_edge_id, connector.to_lane_index)) || [];
    const fromGap = Math.min(Infinity, ...sources.map(lane => distance(lane.curve[3], connector.curve[0])));
    const toGap = Math.min(Infinity, ...targets.map(lane => distance(lane.curve[0], connector.curve[3])));
    if (!Number.isFinite(fromGap) || !Number.isFinite(toGap)) {
      failures(`Connector ${connector.entity_id} has a dangling lane endpoint`); continue;
    }
    largestEndpointGap = Math.max(largestEndpointGap, fromGap, toGap);
    if (fromGap > .25 || toGap > .25) failures(`Connector ${connector.entity_id} has an endpoint gap`);
    if (Math.abs(connector.curve[0][1] - connector.curve[3][1]) > 15) levelErrors++;
    approachRoads.add(String(connector.from_edge_id));
  }
  if (lanes.size !== graph.counts.selectedEdgeLanes ||
      connectors.size !== graph.counts.selectedConnectors)
    failures('Unique entity totals differ from converter counts');
  let localDanglingCopies = 0;
  for (const [tileKey, data] of local) {
    if (!data.connectors.length) continue;
    const ends = new Map(), starts = new Map();
    for (const lane of data.edgeLanes) {
      add(ends, laneKey(lane.edge_id, lane.end_lane_index), lane);
      add(starts, laneKey(lane.edge_id, lane.start_lane_index), lane);
    }
    for (const connector of data.connectors) {
      const from = ends.get(laneKey(connector.from_edge_id, connector.from_lane_index)) || [];
      const to = starts.get(laneKey(connector.to_edge_id, connector.to_lane_index)) || [];
      if (Math.min(Infinity, ...from.map(lane => distance(lane.curve[3], connector.curve[0]))) > .25 ||
          Math.min(Infinity, ...to.map(lane => distance(lane.curve[0], connector.curve[3]))) > .25) {
        localDanglingCopies++;
        if (localDanglingCopies <= 3)
          failures(`Connector ${connector.entity_id} lacks local lane copies in ${tileKey}`);
      }
    }
  }
  const centers = (manifest.centerCandidates || []).map(center => {
    const tile = graph.tiles.find(item => item.ix === center.ix && item.iz === center.iz);
    return { id: center.id, edgeLanes: tile?.edgeLanes?.count || 0,
      connectors: tile?.connectors?.count || 0 };
  });
  for (const center of centers) if (!center.edgeLanes || !center.connectors)
    failures(`${center.id} has no local lane graph`);
  return { lanes: lanes.size, connectors: connectors.size, copies, roadLanes,
    approachRoads: approachRoads.size, overviewRoads: roads.size, forbidden,
    localDanglingCopies, largestEndpointGap: Math.round(largestEndpointGap * 1000) / 1000,
    levelErrors, centers, errors };
}

if (require.main === module) {
  const root = process.argv[2];
  if (!root || process.argv.length !== 3) {
    console.error('Usage: node scripts/audit-lane-city.cjs <imported-city-directory>');
    process.exitCode = 2;
  } else {
    try {
      const result = audit(root);
      console.log(JSON.stringify(result, null, 2));
      if (result.errors.length) process.exitCode = 1;
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}

module.exports = { audit };
