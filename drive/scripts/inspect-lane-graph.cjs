#!/usr/bin/env node
'use strict';

// Checks a lane-graph CMM export without keeping its terrain, buildings,
// network geometry, or complete lane records in memory.
const fs = require('node:fs');
const zlib = require('node:zlib');
const { TextDecoder } = require('node:util');
const { CmmReader } = require('./convert-cmm.cjs');

const EDGE_LANES = 'extensions.cs2.lane_graph.edge_lanes';
const CONNECTORS = 'extensions.cs2.lane_graph.connectors';
const ROOTS = new Set(['schema_version', 'nodes', 'networks', 'extensions']);
const ARRAYS = new Set(['nodes', 'networks', EDGE_LANES, CONNECTORS]);
const MAX_SAMPLES = 8;

function idOf(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? String(number) : null;
}

function sourceIdOf(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? String(number) : null;
}

function laneIndex(value) {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function validCurve(curve) {
  return Array.isArray(curve) && curve.length === 4 && curve.every(point =>
    Array.isArray(point) && point.length === 3 && point.every(Number.isFinite));
}

class LaneGraphInspector {
  constructor() {
    this.sourceSchema = null;
    this.graphSchema = null;
    this.networkIds = new Set();
    this.nodeIds = new Set();
    this.edgeVersions = new Map();
    this.edgeEntities = new Set();
    this.connectorEntities = new Set();
    this.edgeLanes = [];
    this.connectors = [];
    this.stats = {};
    this.errors = [];
    this.errorCount = 0;
  }

  error(message) {
    this.errorCount++;
    if (this.errors.length < MAX_SAMPLES) this.errors.push(message);
  }

  scalar(path, value) {
    if (path === 'schema_version') this.sourceSchema = value;
    else if (path === 'extensions.cs2.lane_graph.schema_version') this.graphSchema = value;
    else if (path.startsWith('extensions.cs2.lane_graph.stats.'))
      this.stats[path.slice('extensions.cs2.lane_graph.stats.'.length)] = value;
  }

  item(kind, record) {
    if (kind === 'nodes' || kind === 'networks') {
      // CMM assigns negative IDs to derived geometry nodes/networks. Native
      // Unity entity IDs in lane_graph remain nonnegative.
      const id = sourceIdOf(record?.id);
      if (id === null) this.error(`${kind} has an invalid id`);
      else (kind === 'nodes' ? this.nodeIds : this.networkIds).add(id);
      return;
    }
    const entity = idOf(record?.entity_id), version = idOf(record?.entity_version);
    if (entity === null || version === null || !validCurve(record?.curve)) {
      this.error(`${kind} has an invalid entity or Bezier curve`);
      return;
    }
    const key = `${entity}:${version}`;
    const identities = kind === EDGE_LANES ? this.edgeEntities : this.connectorEntities;
    if (identities.has(key)) this.error(`${kind} has duplicate entity ${key}`);
    identities.add(key);
    if (kind === EDGE_LANES) {
      const edge = idOf(record.edge_id), edgeVersion = idOf(record.edge_version);
      if (edge === null || edgeVersion === null || !laneIndex(record.start_lane_index) ||
          !laneIndex(record.end_lane_index) ||
          !Array.isArray(record.edge_delta) || record.edge_delta.length !== 2 ||
          !record.edge_delta.every(Number.isFinite) ||
          (record.width_m !== null && (!Number.isFinite(record.width_m) || record.width_m <= 0))) {
        this.error(`edge lane ${key} has an invalid owner, index, delta, or width`);
        return;
      }
      if (this.edgeVersions.has(edge) && this.edgeVersions.get(edge) !== edgeVersion)
        this.error(`road ${edge} has conflicting entity versions`);
      this.edgeVersions.set(edge, edgeVersion);
      this.edgeLanes.push({ key, edge, start: record.start_lane_index,
        end: record.end_lane_index });
    } else if (kind === CONNECTORS) {
      const node = idOf(record.node_id), from = idOf(record.from_edge_id);
      const to = idOf(record.to_edge_id);
      const fromVersion = idOf(record.from_edge_version);
      const toVersion = idOf(record.to_edge_version);
      if (node === null || from === null || to === null ||
          fromVersion === null || toVersion === null ||
          !laneIndex(record.from_lane_index) || !laneIndex(record.to_lane_index) ||
          typeof record.forbidden !== 'boolean' || typeof record.unsafe !== 'boolean') {
        this.error(`connector ${key} has an invalid node, edge, lane, or flag`);
        return;
      }
      this.connectors.push({ key, node, from, to, fromVersion, toVersion,
        fromLane: record.from_lane_index, toLane: record.to_lane_index,
        forbidden: record.forbidden });
    }
  }

  finish() {
    if (this.sourceSchema !== 'cmm-v1') this.error(`source schema is ${this.sourceSchema || '(missing)'}`);
    if (this.graphSchema !== 1) this.error(`lane graph schema is ${this.graphSchema ?? '(missing)'}`);
    if (!this.networkIds.size || !this.nodeIds.size) this.error('missing source networks or nodes');
    if (!this.edgeLanes.length || !this.connectors.length) this.error('missing edge lanes or connectors');
    if (this.stats.edge_lanes !== this.edgeEntities.size)
      this.error(`edge lane count ${this.edgeEntities.size} differs from export stats ${this.stats.edge_lanes}`);
    if (this.stats.connectors !== this.connectorEntities.size)
      this.error(`connector count ${this.connectorEntities.size} differs from export stats ${this.stats.connectors}`);

    const laneEndpoints = new Set();
    for (const lane of this.edgeLanes) {
      if (!this.networkIds.has(lane.edge)) this.error(`edge lane ${lane.key} references absent road ${lane.edge}`);
      laneEndpoints.add(`${lane.edge}:${lane.start}`);
      laneEndpoints.add(`${lane.edge}:${lane.end}`);
    }
    let unmatchedLaneRefs = 0, forbiddenConnectors = 0;
    const unmatchedSamples = [];
    for (const connector of this.connectors) {
      if (!this.nodeIds.has(connector.node))
        this.error(`connector ${connector.key} references absent node ${connector.node}`);
      if (!this.networkIds.has(connector.from) || !this.networkIds.has(connector.to))
        this.error(`connector ${connector.key} references absent road ${connector.from} or ${connector.to}`);
      if (this.edgeVersions.has(connector.from) &&
          this.edgeVersions.get(connector.from) !== connector.fromVersion)
        this.error(`connector ${connector.key} has a stale source road version`);
      if (this.edgeVersions.has(connector.to) &&
          this.edgeVersions.get(connector.to) !== connector.toVersion)
        this.error(`connector ${connector.key} has a stale target road version`);
      if (connector.forbidden) forbiddenConnectors++;
      for (const [edge, lane] of [[connector.from, connector.fromLane], [connector.to, connector.toLane]]) {
        if (laneEndpoints.has(`${edge}:${lane}`)) continue;
        unmatchedLaneRefs++;
        if (unmatchedSamples.length < MAX_SAMPLES) unmatchedSamples.push(`${connector.key} -> ${edge}:${lane}`);
      }
    }
    return {
      sourceSchema: this.sourceSchema, graphSchema: this.graphSchema,
      networks: this.networkIds.size, nodes: this.nodeIds.size,
      edgeLanes: this.edgeEntities.size, connectors: this.connectorEntities.size,
      forbiddenConnectors, unmatchedLaneRefs,
      unresolvedInExporter: this.stats.unresolved_connectors ?? null,
      invalidCurvesInExporter: this.stats.invalid_curves ?? null,
      errorCount: this.errorCount, errors: this.errors, unmatchedSamples,
    };
  }
}

async function inspect(input) {
  const inspector = new LaneGraphInspector();
  const reader = new CmmReader({
    scalar: (path, value) => inspector.scalar(path, value),
    item: (kind, record) => inspector.item(kind, record),
  }, { relevantRoot: ROOTS, itemArrays: ARRAYS });
  const decoder = new TextDecoder('utf8', { fatal: true });
  for await (const bytes of fs.createReadStream(input).pipe(zlib.createGunzip())) {
    await reader.write(decoder.decode(bytes, { stream: true }));
  }
  await reader.write(decoder.decode());
  reader.finish();
  return inspector.finish();
}

if (require.main === module) {
  const input = process.argv[2];
  if (!input || process.argv.length !== 3) {
    console.error('Usage: node scripts/inspect-lane-graph.cjs <city.cmm.gz>');
    process.exitCode = 2;
  } else {
    inspect(input).then(summary => {
      console.log(JSON.stringify(summary, null, 2));
      if (summary.errorCount) process.exitCode = 1;
    }).catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}

module.exports = { inspect, LaneGraphInspector };
