#!/usr/bin/env node
'use strict';

// Converts a CSLModernMap cmm-v1 gzip export into static, spatially bounded
// browser assets. Only one network/building/district object is held at a time.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { TextDecoder } = require('node:util');
const { once } = require('node:events');
const ImportedCity = require('../js/imported-city');
const { generateTravelCandidates } = require('./travel-candidates.cjs');

const RELEVANT_ROOT = new Set([
  'schema_version', 'metadata', 'sea_level', 'terrain',
  'networks', 'buildings', 'districts', 'traffic', 'extensions',
]);
const EDGE_LANES = 'extensions.cs2.lane_graph.edge_lanes';
const CONNECTORS = 'extensions.cs2.lane_graph.connectors';
const ITEM_ARRAYS = new Set(['networks', 'buildings', 'districts', 'traffic.segments', 'traffic.lights', EDGE_LANES, CONNECTORS]);
// Each lane record is stored as an array in the order declared here. Keeping
// the field names once in the manifest saves several MB on large cities.
const EDGE_LANE_FIELDS = [
  'entity_id', 'entity_version', 'edge_id', 'edge_version',
  'edge_start_node_id', 'edge_end_node_id',
  'start_lane_index', 'end_lane_index', 'start_path_index', 'end_path_index',
  'edge_delta', 'width_m', 'speed_limit_mps', 'car_flags',
  'twoway', 'forbidden', 'unsafe', 'public_only', 'curve',
];
const CONNECTOR_FIELDS = [
  'entity_id', 'entity_version', 'node_id', 'node_version',
  'from_edge_id', 'from_edge_version', 'from_lane_index', 'from_path_index',
  'to_edge_id', 'to_edge_version', 'to_lane_index', 'to_path_index',
  'path_methods', 'path_methods_bits', 'width_m', 'car_flags',
  'forbidden', 'unsafe', 'public_only', 'curve',
];

function parseTuple(value, length, label) {
  const parts = String(value).split(',').map(Number);
  if (parts.length !== length || parts.some(v => !Number.isFinite(v))) {
    throw new Error(`${label} needs ${length} comma-separated numbers`);
  }
  return parts;
}

function parseArgs(argv) {
  const args = { tileSize: 512, terrainCell: 32, maxTerrainSamples: 250000 };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help' || key === '-h') { args.help = true; continue; }
    if (!key.startsWith('--') || i + 1 >= argv.length) throw new Error(`Expected value for ${key}`);
    const value = argv[++i];
    if (key === '--input') args.input = value;
    else if (key === '--out') args.out = value;
    else if (key === '--center') args.center = parseTuple(value, 2, '--center');
    else if (key === '--radius') args.radius = Number(value);
    else if (key === '--bounds') args.bounds = parseTuple(value, 4, '--bounds');
    else if (key === '--tile-size') args.tileSize = Number(value);
    else if (key === '--terrain-cell') args.terrainCell = Number(value);
    else if (key === '--max-terrain-samples') args.maxTerrainSamples = Number(value);
    else if (key === '--stops-file') args.stopsFile = value;
    else throw new Error(`Unknown argument ${key}`);
  }
  if (args.help) return args;
  if (!args.input || !args.out) throw new Error('--input and --out are required');
  if ((args.center && !args.radius) || (args.radius && !args.center)) {
    throw new Error('--center and --radius must be used together');
  }
  if (args.center && args.bounds) throw new Error('Use --center/--radius or --bounds, not both');
  for (const key of ['tileSize', 'terrainCell', 'maxTerrainSamples']) {
    if (!Number.isFinite(args[key]) || args[key] <= 0) throw new Error(`${key} must be positive`);
  }
  if (args.radius && (!Number.isFinite(args.radius) || args.radius <= 0)) throw new Error('--radius must be positive');
  if (args.bounds && (args.bounds[0] >= args.bounds[2] || args.bounds[1] >= args.bounds[3])) {
    throw new Error('--bounds must be minX,minZ,maxX,maxZ');
  }
  return args;
}

function readStopsFile(file) {
  const source = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  if (source?.format !== 'drive-city-stops-v1' || source.coordinateSystem !== 'source-world-xz' || !Array.isArray(source.stops)) {
    throw new Error('Stops file needs drive-city-stops-v1 source-world-xz stops');
  }
  const ids = new Set();
  for (const stop of source.stops) {
    if (typeof stop?.id !== 'string' || !stop.id || ids.has(stop.id) ||
        !Number.isFinite(stop.x) || !Number.isFinite(stop.z)) {
      throw new Error('Stops file has duplicate or invalid id/x/z');
    }
    ids.add(stop.id);
  }
  return source;
}

function round(v, places = 3) {
  return Math.round(v * 10 ** places) / 10 ** places;
}

function trafficFlow(access) {
  if (!access) return 'unknown';
  const forward = access.forward === 'allowed';
  const backward = access.backward === 'allowed';
  if (forward && backward) return 'two-way';
  if (forward) return 'forward-only';
  if (backward) return 'backward-only';
  return 'unknown';
}

function pointXZ(point) {
  if (Array.isArray(point)) return [Number(point[0]), Number(point[1])];
  return [Number(point?.x), Number(point?.z)];
}

function textOf(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value.text === 'string') return value.text;
  return '';
}

function clipSegment(a, b, box) {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  let t0 = 0, t1 = 1;
  for (const [p, q] of [
    [-dx, a[0] - box.minX], [dx, box.maxX - a[0]],
    [-dz, a[2] - box.minZ], [dz, box.maxZ - a[2]],
  ]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  const at = t => [round(a[0] + dx * t), round(a[1] + (b[1] - a[1]) * t), round(a[2] + dz * t)];
  return [at(t0), at(t1)];
}

function simplifyLine(points, tolerance = 8) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1; keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const p = points[a], q = points[b];
    const dx = q[0] - p[0], dz = q[2] - p[2], len2 = dx * dx + dz * dz;
    let furthest = -1, max = tolerance * tolerance;
    for (let i = a + 1; i < b; i++) {
      const t = len2 ? Math.max(0, Math.min(1, ((points[i][0] - p[0]) * dx + (points[i][2] - p[2]) * dz) / len2)) : 0;
      const x = p[0] + dx * t, z = p[2] + dz * t;
      const d = (points[i][0] - x) ** 2 + (points[i][2] - z) ** 2;
      if (d > max) { max = d; furthest = i; }
    }
    if (furthest >= 0) { keep[furthest] = 1; stack.push([a, furthest], [furthest, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

// Small streaming JSON reader. It assembles only individual selected array items;
// terrain base64 is delivered in chunks to a zlib decoder, and all other large
// top-level arrays are scanned without constructing their values.
class CmmReader {
  constructor(handlers, options = {}) {
    this.handlers = handlers;
    this.relevantRoot = options.relevantRoot || RELEVANT_ROOT;
    this.itemArrays = options.itemArrays || ITEM_ARRAYS;
    this.stack = [];
    this.mode = 'normal';
    this.token = '';
    this.stringPath = null;
    this.stringIsKey = false;
    this.stringData = false;
    this.escape = false;
    this.rootSeen = false;
  }

  valuePath(parent) {
    if (!parent) return '';
    if (parent.path === null) return null;
    if (parent.type === 'object') {
      if (parent.path === '' && !this.relevantRoot.has(parent.key)) return null;
      return parent.path ? `${parent.path}.${parent.key}` : parent.key;
    }
    return `${parent.path}[${parent.index}]`;
  }

  begin(type) {
    const parent = this.stack.at(-1);
    if (parent && parent.expect !== 'value') throw new Error('Malformed JSON: unexpected value');
    const itemRoot = parent?.type === 'array' && this.itemArrays.has(parent.path);
    const build = !!(parent?.build || itemRoot);
    const value = build ? (type === 'object' ? {} : []) : undefined;
    if (parent?.build) this.attach(parent, value);
    const ctx = {
      type, path: this.valuePath(parent), build, itemRoot,
      value, expect: type === 'object' ? 'key' : 'value',
      key: null, index: 0,
    };
    this.stack.push(ctx);
    if (!parent) this.rootSeen = true;
  }

  attach(parent, value) {
    if (parent.type === 'object') parent.value[parent.key] = value;
    else parent.value.push(value);
  }

  finishValue(parent) {
    if (!parent) return;
    parent.expect = 'comma';
    if (parent.type === 'array') parent.index++;
    else parent.key = null;
  }

  endContainer(type) {
    const ctx = this.stack.pop();
    if (!ctx || ctx.type !== type || !['key', 'value', 'comma'].includes(ctx.expect)) {
      throw new Error('Malformed JSON: mismatched container');
    }
    if (ctx.itemRoot) this.handlers.item(ctx.path.split('[')[0], ctx.value);
    this.finishValue(this.stack.at(-1));
  }

  scalar(value) {
    const parent = this.stack.at(-1);
    if (!parent || parent.expect !== 'value') throw new Error('Malformed JSON: unexpected scalar');
    const valuePath = this.valuePath(parent);
    if (parent.build) this.attach(parent, value);
    else if (valuePath !== null) this.handlers.scalar(valuePath, value);
    this.finishValue(parent);
  }

  closeString() {
    if (this.stringIsKey) {
      const ctx = this.stack.at(-1);
      ctx.key = this.token ? JSON.parse(`"${this.token}"`) : '';
      ctx.expect = 'colon';
    } else {
      const value = this.token ? JSON.parse(`"${this.token}"`) : '';
      this.scalar(value);
    }
    this.token = '';
    this.mode = 'normal';
    this.stringPath = null;
  }

  async closeDataString() {
    if (this.token) await this.handlers.dataChunk(this.token);
    await this.handlers.dataEnd(this.stringPath);
    this.finishValue(this.stack.at(-1));
    this.token = '';
    this.mode = 'normal';
    this.stringPath = null;
    this.stringData = false;
  }

  async write(input) {
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (this.mode === 'string') {
        if (this.escape) {
          if (this.stringData) throw new Error('Escaped terrain base64 is unsupported');
          this.token += ch; this.escape = false; continue;
        }
        if (ch === '\\') { if (this.stringData) throw new Error('Escaped terrain base64 is unsupported'); this.token += ch; this.escape = true; continue; }
        if (ch === '"') {
          if (this.stringData) await this.closeDataString();
          else this.closeString();
          continue;
        }
        if (this.stringData) {
          this.token += ch;
          if (this.token.length >= 16384) { await this.handlers.dataChunk(this.token); this.token = ''; }
        } else if (this.stringIsKey || this.stringPath !== null || this.stack.at(-1)?.build) {
          this.token += ch;
        }
        continue;
      }
      if (this.mode === 'primitive') {
        if (!/[\s,\]}]/.test(ch)) { this.token += ch; continue; }
        const raw = this.token;
        const value = raw === 'true' ? true : raw === 'false' ? false : raw === 'null' ? null : Number(raw);
        if (value === undefined || (typeof value === 'number' && !Number.isFinite(value))) throw new Error(`Invalid JSON value ${raw}`);
        this.mode = 'normal'; this.token = '';
        this.scalar(value);
        i--; continue;
      }
      if (/\s/.test(ch)) continue;
      if (ch === '{') { this.begin('object'); continue; }
      if (ch === '[') { this.begin('array'); continue; }
      if (ch === '}') { this.endContainer('object'); continue; }
      if (ch === ']') { this.endContainer('array'); continue; }
      if (ch === ':') {
        const ctx = this.stack.at(-1);
        if (ctx?.type !== 'object' || ctx.expect !== 'colon') throw new Error('Malformed JSON: unexpected colon');
        ctx.expect = 'value'; continue;
      }
      if (ch === ',') {
        const ctx = this.stack.at(-1);
        if (!ctx || ctx.expect !== 'comma') throw new Error('Malformed JSON: unexpected comma');
        ctx.expect = ctx.type === 'object' ? 'key' : 'value'; continue;
      }
      if (ch === '"') {
        const ctx = this.stack.at(-1);
        this.stringIsKey = ctx?.type === 'object' && ctx.expect === 'key';
        if (!this.stringIsKey && ctx?.expect !== 'value') throw new Error('Malformed JSON: unexpected string');
        this.stringPath = this.stringIsKey ? null : this.valuePath(ctx);
        this.stringData = this.stringPath === 'terrain.height.data' || this.stringPath === 'terrain.water_depth.data';
        if (this.stringData) await this.handlers.dataStart(this.stringPath);
        this.token = ''; this.escape = false; this.mode = 'string'; continue;
      }
      if (/[-0-9tfn]/.test(ch)) { this.mode = 'primitive'; this.token = ch; continue; }
      throw new Error(`Malformed JSON: unexpected ${ch}`);
    }
  }

  finish() {
    if (this.mode !== 'normal' || this.stack.length || !this.rootSeen) throw new Error('Truncated CMM JSON');
  }
}

class TerrainDecoder {
  constructor(kind, meta, target) {
    this.kind = kind;
    this.meta = meta;
    this.target = target;
    this.base64 = '';
    this.inflater = zlib.createInflate();
    this.error = null;
    this.bytes = 0;
    this.carry = Buffer.alloc(0);
    this.sourceIndex = 0;
    this.output = new Array(target.rows * target.cols).fill(0);
    this.rowMap = new Int32Array(meta.rows).fill(-1);
    this.colMap = new Int32Array(meta.cols).fill(-1);
    for (let r = 0; r < target.rows; r++) {
      const src = Math.min(meta.rows - 1, target.srcRowStart + r * target.stride + Math.floor(target.stride / 2));
      this.rowMap[src] = r;
    }
    for (let c = 0; c < target.cols; c++) {
      const src = Math.min(meta.cols - 1, target.srcColStart + c * target.stride + Math.floor(target.stride / 2));
      this.colMap[src] = c;
    }
    this.inflater.on('data', chunk => this.consume(chunk));
    this.inflater.on('error', error => { this.error = error; });
  }

  consume(chunk) {
    if (this.carry.length) { chunk = Buffer.concat([this.carry, chunk]); this.carry = Buffer.alloc(0); }
    const limit = chunk.length - chunk.length % 4;
    for (let offset = 0; offset < limit; offset += 4) {
      const r = Math.floor(this.sourceIndex / this.meta.cols);
      const c = this.sourceIndex - r * this.meta.cols;
      const outR = this.rowMap[r], outC = this.colMap[c];
      if (outR >= 0 && outC >= 0) {
        const value = chunk.readFloatLE(offset);
        if (!Number.isFinite(value)) throw new Error(`Non-finite ${this.kind} terrain sample`);
        this.output[outR * this.target.cols + outC] = this.kind === 'height'
          ? round(value - this.target.seaLevel, 2) : round(Math.max(0, value), 2);
      }
      this.sourceIndex++;
    }
    if (limit < chunk.length) this.carry = chunk.subarray(limit);
    this.bytes += limit;
  }

  async push(chars) {
    this.base64 += chars;
    const usable = this.base64.length - this.base64.length % 4;
    if (!usable) return;
    const bytes = Buffer.from(this.base64.slice(0, usable), 'base64');
    this.base64 = this.base64.slice(usable);
    if (!this.inflater.write(bytes)) {
      // events.once removes its temporary error listener after either event.
      await once(this.inflater, 'drain');
    }
    if (this.error) throw this.error;
  }

  async finish() {
    if (this.base64) {
      this.inflater.write(Buffer.from(this.base64, 'base64'));
      this.base64 = '';
    }
    const ended = once(this.inflater, 'end');
    this.inflater.end();
    await ended;
    if (this.error) throw this.error;
    if (this.carry.length || this.sourceIndex !== this.meta.rows * this.meta.cols) {
      throw new Error(`${this.kind} terrain grid has ${this.sourceIndex} samples; expected ${this.meta.rows * this.meta.cols}`);
    }
    return this.output;
  }
}

class CityConverter {
  constructor(args) {
    this.args = args;
    this.meta = { origin: [] };
    this.tiles = new Map();
    this.openTiles = new Map();
    this.laneTiles = new Map();
    this.openLaneTiles = new Map();
    this.edgeLaneStarts = new Map();
    this.edgeLaneEnds = new Map();
    this.pendingConnectors = [];
    this.laneGraphSeen = false;
    this.laneGraphSchema = null;
    this.laneGraphStats = {};
    this.laneGraphCounts = { sourceEdgeLanes: 0, sourceConnectors: 0, selectedEdgeLanes: 0, selectedConnectors: 0 };
    this.counts = { networks: 0, roads: 0, buildings: 0, districts: 0, roadParts: 0 };
    this.trafficLanes = new Map();
    this.trafficLights = [];
    this.trafficLightSourceCount = 0;
    this.meshBackedParentIds = new Set();
    this.overviewRoads = 0;
    this.overviewDistricts = [];
    this.seaLevel = 0;
    this.terrainData = {};
    this.initialized = false;
  }

  scalar(pathName, value) {
    if (pathName === 'schema_version') this.schema = value;
    else if (pathName === 'metadata.origin.source_name') this.cityName = value;
    else if (pathName === 'sea_level') this.seaLevel = value;
    else if (pathName === 'terrain.rows') this.meta.rows = value;
    else if (pathName === 'terrain.cols') this.meta.cols = value;
    else if (pathName === 'terrain.cell') this.meta.cell = value;
    else if (pathName === 'terrain.origin[0]') this.meta.origin[0] = value;
    else if (pathName === 'terrain.origin[1]') this.meta.origin[1] = value;
    else if (pathName === 'terrain.height.encoding') this.meta.heightEncoding = value;
    else if (pathName === 'terrain.water_depth.encoding') this.meta.waterEncoding = value;
    else if (pathName === 'extensions.cs2.lane_graph.schema_version') {
      this.laneGraphSeen = true;
      this.laneGraphSchema = value;
    } else if (pathName.startsWith('extensions.cs2.lane_graph.stats.')) {
      this.laneGraphSeen = true;
      this.laneGraphStats[pathName.slice('extensions.cs2.lane_graph.stats.'.length)] = value;
    }
  }

  init() {
    if (this.initialized) return;
    if (this.schema !== 'cmm-v1') throw new Error(`Unsupported CSLModernMap schema ${this.schema || '(missing)'}`);
    const m = this.meta;
    if (!Number.isInteger(m.rows) || !Number.isInteger(m.cols) || m.rows <= 0 || m.cols <= 0 ||
        !Number.isFinite(m.cell) || m.cell <= 0 || m.origin.length !== 2 || m.origin.some(x => !Number.isFinite(x))) {
      throw new Error('Missing or invalid CMM terrain grid');
    }
    if (m.heightEncoding !== 'base64+zlib+float32-row-major') {
      throw new Error('Unsupported CMM terrain encoding');
    }
    const full = { minX: m.origin[0], minZ: m.origin[1], maxX: m.origin[0] + m.cols * m.cell, maxZ: m.origin[1] + m.rows * m.cell };
    let selected = { ...full };
    if (this.args.bounds) {
      const [minX, minZ, maxX, maxZ] = this.args.bounds;
      selected = { minX, minZ, maxX, maxZ };
    } else if (this.args.center) {
      const [x, z] = this.args.center, radius = this.args.radius;
      selected = { minX: x - radius, minZ: z - radius, maxX: x + radius, maxZ: z + radius };
    }
    selected = {
      minX: Math.max(full.minX, selected.minX), minZ: Math.max(full.minZ, selected.minZ),
      maxX: Math.min(full.maxX, selected.maxX), maxZ: Math.min(full.maxZ, selected.maxZ),
    };
    if (selected.minX >= selected.maxX || selected.minZ >= selected.maxZ) throw new Error('Requested district is outside terrain');
    this.originWorld = [(full.minX + full.maxX) / 2, this.seaLevel, (full.minZ + full.maxZ) / 2];
    this.fullWorld = full;
    this.selectedWorld = selected;
    this.bounds = this.localBox(selected);
    this.fullBounds = this.localBox(full);
    const srcColStart = Math.max(0, Math.floor((selected.minX - full.minX) / m.cell));
    const srcRowStart = Math.max(0, Math.floor((selected.minZ - full.minZ) / m.cell));
    const srcCols = Math.min(m.cols, Math.ceil((selected.maxX - full.minX) / m.cell)) - srcColStart;
    const srcRows = Math.min(m.rows, Math.ceil((selected.maxZ - full.minZ) / m.cell)) - srcRowStart;
    const minStride = Math.max(1, Math.ceil(this.args.terrainCell / m.cell));
    const maxStride = Math.ceil(Math.sqrt(srcCols * srcRows / this.args.maxTerrainSamples));
    const stride = Math.max(minStride, maxStride);
    this.target = {
      rows: Math.ceil(srcRows / stride), cols: Math.ceil(srcCols / stride),
      origin: [round(full.minX + srcColStart * m.cell - this.originWorld[0]), round(full.minZ + srcRowStart * m.cell - this.originWorld[2])],
      cell: round(m.cell * stride, 4), srcColStart, srcRowStart, stride, seaLevel: this.seaLevel,
    };
    this.minTileX = Math.floor(this.bounds.minX / this.args.tileSize);
    this.maxTileX = Math.floor((this.bounds.maxX - 1e-6) / this.args.tileSize);
    this.minTileZ = Math.floor(this.bounds.minZ / this.args.tileSize);
    this.maxTileZ = Math.floor((this.bounds.maxZ - 1e-6) / this.args.tileSize);
    fs.mkdirSync(path.join(this.args.out, 'tiles'), { recursive: true });
    this.overviewFile = path.join(this.args.out, 'overview.json');
    this.overviewFd = fs.openSync(this.overviewFile, 'w');
    fs.writeSync(this.overviewFd, '{"format":"drive-city-overview-v1","roads":[');
    this.initialized = true;
  }

  localBox(box) {
    return {
      minX: round(box.minX - this.originWorld[0]), minZ: round(box.minZ - this.originWorld[2]),
      maxX: round(box.maxX - this.originWorld[0]), maxZ: round(box.maxZ - this.originWorld[2]),
    };
  }

  async dataStart(pathName) {
    this.init();
    const kind = pathName === 'terrain.height.data' ? 'height' : 'water_depth';
    if (kind === 'water_depth' && this.meta.waterEncoding !== 'base64+zlib+float32-row-major') {
      throw new Error('Unsupported CMM water terrain encoding');
    }
    this.decoder = new TerrainDecoder(kind, this.meta, this.target);
  }
  async dataChunk(chars) { await this.decoder.push(chars); }
  async dataEnd(pathName) {
    const kind = pathName === 'terrain.height.data' ? 'height' : 'water_depth';
    this.terrainData[kind] = await this.decoder.finish();
    this.decoder = null;
  }

  tile(ix, iz) {
    const key = `${ix}_${iz}`;
    let tile = this.tiles.get(key);
    if (!tile) {
      const file = `tiles/${key}.json`;
      tile = { ix, iz, file, roadCount: 0, buildingCount: 0, heightScore: 0, centerScore: 0, featureCount: 0 };
      this.tiles.set(key, tile);
      fs.writeFileSync(path.join(this.args.out, file), JSON.stringify({ format: 'drive-city-tile-v1', ix, iz }).slice(0, -1) + ',"features":[');
    }
    return tile;
  }

  tileFd(tile) {
    const key = `${tile.ix}_${tile.iz}`;
    if (tile.fd !== undefined) {
      this.openTiles.delete(key);
      this.openTiles.set(key, tile);
      return tile.fd;
    }
    if (this.openTiles.size >= 64) {
      const [oldKey, oldTile] = this.openTiles.entries().next().value;
      fs.closeSync(oldTile.fd);
      oldTile.fd = undefined;
      this.openTiles.delete(oldKey);
    }
    tile.fd = fs.openSync(path.join(this.args.out, tile.file), 'a');
    this.openTiles.set(key, tile);
    return tile.fd;
  }

  writeFeature(tile, feature) {
    fs.writeSync(this.tileFd(tile), (tile.featureCount ? ',' : '') + JSON.stringify(feature));
    tile.featureCount++;
    if (feature.type === 'road') { tile.roadCount++; this.counts.roadParts++; }
    else {
      tile.buildingCount++;
      tile.heightScore += Math.min(feature.height, 300) / 20;
      // Count the detailed structure once: mesh-backed parent lots are broad
      // placeholders, not another occupied tower at the same position.
      if (feature.geometrySource !== 'cs2:structure-container') {
        tile.centerScore += Math.min(feature.height, 250) / 15 +
          (feature.height > 40 ? 4 : 0) +
          (/COMMERCIAL|OFFICE/.test(feature.role) ? 3 : 0) +
          (feature.growthKind === 'placed' ? 4 : 0);
      }
    }
  }

  pointLocal(p) {
    return [round(Number(p.x) - this.originWorld[0]), round(Number(p.y) - this.seaLevel), round(Number(p.z) - this.originWorld[2])];
  }

  laneTile(ix, iz, kind) {
    const key = `${ix}_${iz}`;
    let tile = this.laneTiles.get(key);
    if (!tile) {
      tile = { ix, iz };
      this.laneTiles.set(key, tile);
    }
    if (!tile[kind]) {
      const file = `lane-graph/${kind}/${key}.json`;
      const part = { file, count: 0, ix, iz, kind };
      tile[kind] = part;
      fs.mkdirSync(path.dirname(path.join(this.args.out, file)), { recursive: true });
      fs.writeFileSync(path.join(this.args.out, file),
        JSON.stringify({ format: 'drive-city-lane-tile-v1', ix, iz, kind }).slice(0, -1) + ',"items":[');
    }
    return tile[kind];
  }

  laneTileFd(tile) {
    const key = `${tile.kind}/${tile.ix}_${tile.iz}`;
    if (tile.fd !== undefined) {
      this.openLaneTiles.delete(key);
      this.openLaneTiles.set(key, tile);
      return tile.fd;
    }
    if (this.openLaneTiles.size >= 32) {
      const [oldKey, oldTile] = this.openLaneTiles.entries().next().value;
      fs.closeSync(oldTile.fd);
      oldTile.fd = undefined;
      this.openLaneTiles.delete(oldKey);
    }
    tile.fd = fs.openSync(path.join(this.args.out, tile.file), 'a');
    this.openLaneTiles.set(key, tile);
    return tile.fd;
  }

  laneCurveTiles(curve) {
    const minX = Math.min(...curve.map(p => p[0])), maxX = Math.max(...curve.map(p => p[0]));
    const minZ = Math.min(...curve.map(p => p[2])), maxZ = Math.max(...curve.map(p => p[2]));
    if (maxX < this.bounds.minX || minX > this.bounds.maxX ||
        maxZ < this.bounds.minZ || minZ > this.bounds.maxZ) return [];
    const minIX = Math.max(this.minTileX, Math.floor(minX / this.args.tileSize));
    const maxIX = Math.min(this.maxTileX, Math.floor(maxX / this.args.tileSize));
    const minIZ = Math.max(this.minTileZ, Math.floor(minZ / this.args.tileSize));
    const maxIZ = Math.min(this.maxTileZ, Math.floor(maxZ / this.args.tileSize));
    if (minIX > maxIX || minIZ > maxIZ) return [];
    const span = (maxIX - minIX + 1) * (maxIZ - minIZ + 1);
    if (span > 4096) throw new Error('A lane graph Bezier spans too many tiles');
    const result = [];
    for (let ix = minIX; ix <= maxIX; ix++) for (let iz = minIZ; iz <= maxIZ; iz++)
      result.push([ix, iz]);
    return result;
  }

  writeLaneItem(ix, iz, kind, item) {
    const tile = this.laneTile(ix, iz, kind);
    if (!tile.entities) tile.entities = new Set();
    const identity = `${item[0]}:${item[1]}`;
    if (tile.entities.has(identity)) return;
    fs.writeSync(this.laneTileFd(tile), (tile.count ? ',' : '') + JSON.stringify(item));
    tile.count++;
    tile.entities.add(identity);
  }

  indexEdgeLane(index, edge, lane, entry) {
    const key = `${edge}:${lane}`;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(entry);
  }

  matchingEdgeLane(index, edge, lane, endpoint) {
    const choices = index.get(`${edge}:${lane}`) || [];
    let selected = null, best = Infinity;
    for (const choice of choices) {
      const point = choice.curve[index === this.edgeLaneEnds ? 3 : 0];
      const gap = Math.hypot(point[0] - endpoint[0], point[1] - endpoint[1], point[2] - endpoint[2]);
      if (gap < best) { selected = choice; best = gap; }
    }
    return best <= .25 ? selected : null;
  }

  laneItem(pathName, record) {
    this.init();
    this.laneGraphSeen = true;
    const isEdge = pathName === EDGE_LANES;
    const kind = isEdge ? 'edgeLanes' : 'connectors';
    const sourceCount = isEdge ? 'sourceEdgeLanes' : 'sourceConnectors';
    const selectedCount = isEdge ? 'selectedEdgeLanes' : 'selectedConnectors';
    const fields = isEdge ? EDGE_LANE_FIELDS : CONNECTOR_FIELDS;
    this.laneGraphCounts[sourceCount]++;
    if (!Array.isArray(record?.curve) || record.curve.length !== 4 ||
        record.curve.some(p => !Array.isArray(p) || p.length !== 3 || p.some(v => !Number.isFinite(v)))) {
      throw new Error(`${pathName} has an invalid Bezier curve`);
    }
    const curve = record.curve.map(([x, y, z]) => [
      round(x - this.originWorld[0]), round(y - this.seaLevel), round(z - this.originWorld[2]),
    ]);
    const tiles = this.laneCurveTiles(curve);
    if (!tiles.length) return;
    // The entire Bezier is copied into every tile touched by its control hull.
    // A renderer can deduplicate by entity_id + entity_version at tile seams.
    const item = fields.map(field => field === 'curve' ? curve : record[field] ?? null);
    this.laneGraphCounts[selectedCount]++;
    if (isEdge) {
      const entry = { item, curve, tiles };
      this.indexEdgeLane(this.edgeLaneStarts, record.edge_id, record.start_lane_index, entry);
      this.indexEdgeLane(this.edgeLaneEnds, record.edge_id, record.end_lane_index, entry);
      for (const [ix, iz] of tiles) this.writeLaneItem(ix, iz, kind, item);
    } else {
      // Resolve the two endpoint lanes after parsing. The format normally
      // emits edge lanes first, but postprocessing also handles reversed order.
      this.pendingConnectors.push({ item, curve, tiles });
    }
  }

  writeConnectorsWithLocalLanes() {
    for (const { item, curve, tiles } of this.pendingConnectors) {
      const connector = Object.fromEntries(CONNECTOR_FIELDS.map((field, i) => [field, item[i]]));
      const source = this.matchingEdgeLane(this.edgeLaneEnds,
        connector.from_edge_id, connector.from_lane_index, curve[0]);
      const target = this.matchingEdgeLane(this.edgeLaneStarts,
        connector.to_edge_id, connector.to_lane_index, curve[3]);
      const destinations = new Map(tiles.map(([ix, iz]) => [`${ix}_${iz}`, [ix, iz]]));
      // The arrow sits before the connector, sometimes across a tile seam.
      // Its source lane's Bezier hull contains every possible paint point.
      for (const [ix, iz] of source?.tiles || []) {
        if (this.tiles.get(`${ix}_${iz}`)?.roadCount)
          destinations.set(`${ix}_${iz}`, [ix, iz]);
      }
      for (const [ix, iz] of destinations.values()) {
        this.writeLaneItem(ix, iz, 'connectors', item);
        if (source) this.writeLaneItem(ix, iz, 'edgeLanes', source.item);
        if (target) this.writeLaneItem(ix, iz, 'edgeLanes', target.item);
      }
    }
    this.pendingConnectors = [];
  }

  road(network) {
    this.counts.networks++;
    if (network.kind !== 'ROAD') return;
    const access = network.car_access;
    if (access && access.forward !== 'allowed' && access.backward !== 'allowed') return;
    const source = network.geometry?.points;
    if (!Array.isArray(source) || source.length < 2) return;
    const points = source.map(p => this.pointLocal(p));
    if (points.some(p => p.some(v => !Number.isFinite(v)))) return;
    const id = String(network.id);
    const width = Number(network.width);
    const roadClass = network.level === 'HIGHWAY' ? 'highway'
      : network.level === 'MAIN' ? 'arterial'
      : network.level === 'SPECIAL' ? 'special' : 'street';
    const common = {
      id, kind: network.kind, mode: network.mode || 'normal', level: network.level ?? null,
      roadClass, trafficFlow: trafficFlow(access),
      width: Number.isFinite(width) && width > 0 ? round(width, 2) : 8,
    };
    if (network.lane_summary) common.lanes = network.lane_summary;
    common.name = textOf(network.game_name) || textOf(network.display_name) || textOf(network.name);
    if (network.name) common.prefab = textOf(network.name);
    if (access) common.carAccess = access;
    if (network.car_speed) common.carSpeed = network.car_speed;
    const overview = { ...common, points: simplifyLine(points) };
    fs.writeSync(this.overviewFd, (this.overviewRoads++ ? ',' : '') + JSON.stringify(overview));
    this.counts.roads++;

    const perTile = new Map();
    for (let i = 1; i < points.length; i++) {
      const pair = clipSegment(points[i - 1], points[i], this.bounds);
      if (!pair) continue;
      const minIX = Math.max(this.minTileX, Math.floor(Math.min(pair[0][0], pair[1][0]) / this.args.tileSize));
      const maxIX = Math.min(this.maxTileX, Math.floor(Math.max(pair[0][0], pair[1][0]) / this.args.tileSize));
      const minIZ = Math.max(this.minTileZ, Math.floor(Math.min(pair[0][2], pair[1][2]) / this.args.tileSize));
      const maxIZ = Math.min(this.maxTileZ, Math.floor(Math.max(pair[0][2], pair[1][2]) / this.args.tileSize));
      if ((maxIX - minIX + 1) * (maxIZ - minIZ + 1) > 4096) throw new Error(`Road ${id} spans too many tiles`);
      for (let ix = minIX; ix <= maxIX; ix++) for (let iz = minIZ; iz <= maxIZ; iz++) {
        const box = {
          minX: Math.max(this.bounds.minX, ix * this.args.tileSize), maxX: Math.min(this.bounds.maxX, (ix + 1) * this.args.tileSize),
          minZ: Math.max(this.bounds.minZ, iz * this.args.tileSize), maxZ: Math.min(this.bounds.maxZ, (iz + 1) * this.args.tileSize),
        };
        const clipped = clipSegment(pair[0], pair[1], box);
        if (!clipped) continue;
        const key = `${ix}_${iz}`;
        let lines = perTile.get(key);
        if (!lines) { lines = []; perTile.set(key, lines); }
        const last = lines.at(-1);
        if (last && last.at(-1).every((v, k) => Math.abs(v - clipped[0][k]) < 0.02)) last.push(clipped[1]);
        else lines.push(clipped);
      }
    }
    for (const [key, lines] of perTile) {
      const [ix, iz] = key.split('_').map(Number);
      const tile = this.tile(ix, iz);
      lines.forEach((line, part) => this.writeFeature(tile, { type: 'road', ...common, part, points: line }));
    }
  }

  terrainHeight(x, z) {
    const t = this.target, values = this.terrainData.height;
    if (!values) return 0;
    const c = Math.max(0, Math.min(t.cols - 1, Math.round((x - t.origin[0]) / t.cell - 0.5)));
    const r = Math.max(0, Math.min(t.rows - 1, Math.round((z - t.origin[1]) / t.cell - 0.5)));
    return values[r * t.cols + c];
  }

  building(building) {
    const raw = building.footprint?.points;
    if (!Array.isArray(raw) || raw.length < 3) return;
    const footprint = raw.map(pointXZ).map(([x, z]) => [round(x - this.originWorld[0]), round(z - this.originWorld[2])]);
    if (footprint.some(p => p.some(v => !Number.isFinite(v)))) return;
    const cx = footprint.reduce((v, p) => v + p[0], 0) / footprint.length;
    const cz = footprint.reduce((v, p) => v + p[1], 0) / footprint.length;
    if (cx < this.bounds.minX || cx >= this.bounds.maxX || cz < this.bounds.minZ || cz >= this.bounds.maxZ) return;
    const ix = Math.floor(cx / this.args.tileSize);
    const iz = Math.floor(cz / this.args.tileSize);
    const sourceBase = building.base_elevation_m == null ? NaN : Number(building.base_elevation_m);
    const sourceHeight = Number(building.height_m);
    const feature = {
      type: 'building', id: String(building.id), footprint,
      baseY: Number.isFinite(sourceBase) ? round(sourceBase - this.seaLevel, 2) : this.terrainHeight(cx, cz),
      height: Number.isFinite(sourceHeight) && sourceHeight > 0 ? round(sourceHeight, 2) : 12,
      role: textOf(building.role),
      category: textOf(building.category_name) || textOf(building.category_id) || textOf(building.category),
      name: textOf(building.display_name) || textOf(building.name),
      prefab: textOf(building.name) || textOf(building.source_raw),
      parentBuildingId: building.parent_building_id == null ? null : String(building.parent_building_id),
      geometrySource: textOf(building.geometry_source),
      growthKind: textOf(building.growth_kind),
    };
    if (feature.parentBuildingId && /\bmesh\s+\d+\b/i.test(feature.prefab)) {
      this.meshBackedParentIds.add(feature.parentBuildingId);
    }
    this.writeFeature(this.tile(ix, iz), feature);
    this.counts.buildings++;
  }

  trafficSegment(segment) {
    if (segment?.segment_id == null || !Array.isArray(segment.lanes)) return;
    const lanes = segment.lanes.filter(lane => lane?.lane_type === 'Vehicle').map(lane => {
      const position = Number(lane.position), width = Number(lane.width);
      if (!Number.isFinite(position) || !Number.isFinite(width) || width <= 0) return null;
      const detail = { position: round(position, 3), width: round(width, 3),
        direction: lane.direction === 'Backward' ? 'Backward' : 'Forward' };
      if (Number.isInteger(lane.lane_index)) detail.index = lane.lane_index;
      if (Number.isFinite(Number(lane.speed_limit_mps))) detail.speed = round(Number(lane.speed_limit_mps), 3);
      return detail;
    }).filter(Boolean);
    if (lanes.length) this.trafficLanes.set(String(segment.segment_id), lanes);
  }

  trafficLight(light) {
    this.init();
    this.trafficLightSourceCount++;
    const nodeId = light?.node_id;
    const position = light?.position;
    if (!Number.isSafeInteger(nodeId) || nodeId < 0 ||
        !position || ![position.x, position.y, position.z].every(Number.isFinite) ||
        typeof light.active !== 'boolean') {
      throw new Error('CMM traffic light has an invalid node, position, or active state');
    }
    const local = this.pointLocal(position);
    if (local[0] < this.bounds.minX || local[0] >= this.bounds.maxX ||
        local[2] < this.bounds.minZ || local[2] >= this.bounds.maxZ) return;
    this.trafficLights.push({ nodeId, position: local, active: light.active });
  }

  district(district) {
    const raw = district.boundary?.points;
    if (!Array.isArray(raw) || raw.length < 3) return;
    const polygon = raw.map(pointXZ).map(([x, z]) => [round(x - this.originWorld[0]), round(z - this.originWorld[2])]);
    if (polygon.some(p => p.some(v => !Number.isFinite(v)))) return;
    this.overviewDistricts.push({ id: String(district.id), name: textOf(district.name), kind: district.kind || '', polygon });
    this.counts.districts++;
  }

  item(kind, value) {
    if (kind === 'networks') this.road(value);
    else if (kind === 'buildings') this.building(value);
    else if (kind === 'districts') this.district(value);
    else if (kind === 'traffic.segments') this.trafficSegment(value);
    else if (kind === 'traffic.lights') this.trafficLight(value);
    else if (kind === EDGE_LANES || kind === CONNECTORS) this.laneItem(kind, value);
  }

  finalizeLaneGraph(verticalOffset) {
    if (!this.laneGraphSeen) return null;
    if (this.laneGraphSchema !== 1) {
      throw new Error(`Unsupported CMM lane graph schema ${this.laneGraphSchema ?? '(missing)'}`);
    }
    for (const [stat, count] of [
      ['edge_lanes', this.laneGraphCounts.sourceEdgeLanes],
      ['connectors', this.laneGraphCounts.sourceConnectors],
    ]) {
      if (this.laneGraphStats[stat] !== undefined && this.laneGraphStats[stat] !== count) {
        throw new Error(`Lane graph ${stat} count differs from export stats`);
      }
    }
    this.writeConnectorsWithLocalLanes();
    const tiles = [...this.laneTiles.values()].sort((a, b) => a.iz - b.iz || a.ix - b.ix);
    for (const tile of tiles) for (const kind of ['edgeLanes', 'connectors']) {
      const part = tile[kind];
      if (!part) continue;
      const file = path.join(this.args.out, part.file);
      if (part.fd === undefined) fs.appendFileSync(file, ']}');
      else { fs.writeSync(part.fd, ']}'); fs.closeSync(part.fd); part.fd = undefined; }
      const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const item of payload.items) {
        for (const point of item.at(-1)) point[1] = round(point[1] - verticalOffset);
      }
      fs.writeFileSync(file, JSON.stringify(payload));
    }
    this.openLaneTiles.clear();
    return {
      format: 'drive-city-lane-graph-v1', schemaVersion: 1,
      coordinateSystem: 'browser-local-xyz',
      edgeFields: EDGE_LANE_FIELDS, connectorFields: CONNECTOR_FIELDS,
      counts: this.laneGraphCounts, sourceStats: this.laneGraphStats,
      tiles: tiles.map(tile => ({
        ix: tile.ix, iz: tile.iz,
        ...(tile.edgeLanes && { edgeLanes: { file: tile.edgeLanes.file, count: tile.edgeLanes.count } }),
        ...(tile.connectors && { connectors: { file: tile.connectors.file, count: tile.connectors.count } }),
      })),
    };
  }

  finalize() {
    if (!this.initialized || !this.terrainData.height || !this.terrainData.water_depth) throw new Error('CMM export is missing terrain height or water grid');
    for (const tile of this.tiles.values()) {
      if (tile.fd === undefined) fs.appendFileSync(path.join(this.args.out, tile.file), ']}');
      else { fs.writeSync(tile.fd, ']}'); fs.closeSync(tile.fd); tile.fd = undefined; }
    }
    this.openTiles.clear();
    const tiles = [...this.tiles.values()].sort((a, b) => a.iz - b.iz || a.ix - b.ix);
    const tileScore = tile => tile.buildingCount + tile.heightScore + tile.roadCount * 0.5;
    const neighborhoodScore = tile => {
      let total = tileScore(tile);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const neighbor = this.tiles.get(`${tile.ix + dx}_${tile.iz + dz}`);
        if (neighbor) total += tileScore(neighbor) * (dx && dz ? 0.15 : 0.25);
      }
      return total;
    };
    const densest = [...tiles].sort((a, b) => neighborhoodScore(b) - neighborhoodScore(a))[0];
    const featuredDistrict = densest ? {
      ix: densest.ix, iz: densest.iz,
      center: [round((densest.ix + 0.5) * this.args.tileSize), round((densest.iz + 0.5) * this.args.tileSize)],
      score: round(neighborhoodScore(densest), 2),
      method: 'building-height-and-road-density-3x3',
    } : null;
    const centerScore = tile => tile.centerScore + tile.roadCount * 0.4;
    const centerNeighborhood = tile => {
      let total = centerScore(tile);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const neighbor = this.tiles.get(`${tile.ix + dx}_${tile.iz + dz}`);
        if (neighbor) total += centerScore(neighbor) * (dx && dz ? 0.12 : 0.2);
      }
      return total;
    };
    const rankedCenters = tiles.map(tile => ({ tile, score: centerNeighborhood(tile) }))
      .sort((a, b) => b.score - a.score);
    const minCenterScore = Math.max(80, (rankedCenters[0]?.score || 0) * 0.45);
    const centerCandidates = [];
    for (const entry of rankedCenters) {
      if (entry.score < minCenterScore || centerCandidates.length >= 10) break;
      const tile = entry.tile;
      if (centerCandidates.some(center => Math.hypot(center.ix - tile.ix, center.iz - tile.iz) < 3.5)) continue;
      centerCandidates.push({ id: `center-${tile.ix}_${tile.iz}`, ix: tile.ix, iz: tile.iz,
        x: round((tile.ix + 0.5) * this.args.tileSize),
        z: round((tile.iz + 0.5) * this.args.tileSize),
        score: round(entry.score, 2) });
    }
    const authored = this.args.authoredStops;
    if (authored?.cityName && authored.cityName !== this.cityName) {
      throw new Error(`Stops file names ${authored.cityName}, but export is ${this.cityName}`);
    }
    const stops = (authored?.stops || []).map(stop => {
      const x = round(stop.x - this.originWorld[0]), z = round(stop.z - this.originWorld[2]);
      if (x < this.bounds.minX || x > this.bounds.maxX || z < this.bounds.minZ || z > this.bounds.maxZ) {
        throw new Error(`Stop ${stop.id} is outside selected city bounds`);
      }
      const result = { id: stop.id, x, z };
      if (typeof stop.landmarkId === 'string') result.landmarkId = stop.landmarkId;
      if (typeof stop.landmark === 'string') result.landmark = stop.landmark;
      if (typeof stop.roadId === 'string') result.roadId = stop.roadId;
      return result;
    });
    fs.writeSync(this.overviewFd, '],"districts":' + JSON.stringify(this.overviewDistricts) + ',"stops":' + JSON.stringify(stops) + '}');
    fs.closeSync(this.overviewFd);

    const focus = featuredDistrict?.center || [round((this.bounds.minX + this.bounds.maxX) / 2), round((this.bounds.minZ + this.bounds.maxZ) / 2)];
    const verticalOffset = this.terrainHeight(focus[0], focus[1]);
    const verticalOriginWorld = round(this.seaLevel + verticalOffset, 2);
    this.originWorld[1] = verticalOriginWorld;
    for (let i = 0; i < this.terrainData.height.length; i++) {
      this.terrainData.height[i] = round(this.terrainData.height[i] - verticalOffset, 2);
    }
    const overview = JSON.parse(fs.readFileSync(this.overviewFile, 'utf8'));
    for (const road of overview.roads) {
      for (const point of road.points) point[1] = round(point[1] - verticalOffset);
      if (this.trafficLanes.has(road.id)) road.laneDetails = this.trafficLanes.get(road.id);
    }
    fs.writeFileSync(this.overviewFile, JSON.stringify(overview));
    for (const tile of tiles) {
      const file = path.join(this.args.out, tile.file);
      const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const feature of payload.features) {
        if (feature.type === 'road') {
          for (const point of feature.points) point[1] = round(point[1] - verticalOffset);
          if (this.trafficLanes.has(feature.id)) feature.laneDetails = this.trafficLanes.get(feature.id);
        } else if (feature.type === 'building') {
          feature.baseY = round(feature.baseY - verticalOffset, 2);
        }
      }
      fs.writeFileSync(file, JSON.stringify(payload));
    }
    const laneGraph = this.finalizeLaneGraph(verticalOffset);
    let trafficLights = null;
    if (this.trafficLightSourceCount) {
      for (const light of this.trafficLights) light.position[1] = round(light.position[1] - verticalOffset);
      const file = 'traffic-lights.json';
      fs.writeFileSync(path.join(this.args.out, file), JSON.stringify({
        format: 'drive-city-traffic-lights-v1', coordinateSystem: 'browser-local-xyz',
        lights: this.trafficLights,
      }));
      trafficLights = { file, count: this.trafficLights.length, sourceCount: this.trafficLightSourceCount };
    }
    const terrain = {
      format: 'drive-city-terrain-v1', rows: this.target.rows, cols: this.target.cols,
      origin: this.target.origin, cell: this.target.cell,
      heights: this.terrainData.height, waterDepths: this.terrainData.water_depth,
    };
    fs.writeFileSync(path.join(this.args.out, 'terrain.json'), JSON.stringify(terrain));
    const manifest = {
      format: 'drive-city-v1', source: { schema: this.schema, cityName: this.cityName || '', seaLevel: this.seaLevel },
      originWorld: this.originWorld.map(x => round(x)), bounds: this.bounds, worldBounds: this.fullBounds,
      verticalOriginWorld,
      meshBackedParentIds: [...this.meshBackedParentIds].sort((a, b) => Number(a) - Number(b)),
      tileSize: this.args.tileSize, tiles: tiles.map(({ ix, iz, file, roadCount, buildingCount }) => ({ ix, iz, file, roadCount, buildingCount })),
      overview: 'overview.json',
      terrain: { file: 'terrain.json', rows: terrain.rows, cols: terrain.cols, origin: terrain.origin, cell: terrain.cell, sourceRows: this.meta.rows, sourceCols: this.meta.cols, sourceCell: this.meta.cell },
      focus,
      featuredDistrict,
      centerCandidates,
    };
    manifest.travelCandidates = generateTravelCandidates(ImportedCity.create(manifest, overview, terrain), 17,
      tile => JSON.parse(fs.readFileSync(path.join(this.args.out, tile.file), 'utf8')));
    if (laneGraph) manifest.laneGraph = laneGraph;
    if (trafficLights) manifest.trafficLights = trafficLights;
    fs.writeFileSync(path.join(this.args.out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    const laneFiles = laneGraph?.tiles.flatMap(tile => [tile.edgeLanes?.file, tile.connectors?.file].filter(Boolean)) || [];
    const files = ['manifest.json', 'overview.json', 'terrain.json', ...tiles.map(t => t.file), ...laneFiles,
      ...(trafficLights ? [trafficLights.file] : [])];
    const bytes = files.reduce((sum, file) => sum + fs.statSync(path.join(this.args.out, file)).size, 0);
    const summary = { counts: this.counts, tiles: tiles.length, terrainSamples: terrain.rows * terrain.cols, bytes, featuredDistrict };
    if (laneGraph) summary.laneGraph = { ...this.laneGraphCounts, tiles: laneGraph.tiles.length };
    return summary;
  }
}

async function convert(args) {
  const input = path.resolve(args.input), out = path.resolve(args.out);
  if (!fs.existsSync(input)) throw new Error(`Input does not exist: ${input}`);
  const authoredStops = args.stopsFile ? readStopsFile(args.stopsFile) : null;
  fs.mkdirSync(out, { recursive: true });
  if (fs.readdirSync(out).length) throw new Error(`Output directory must be empty: ${out}`);
  const converter = new CityConverter({ ...args, out, authoredStops });
  const reader = new CmmReader({
    scalar: (p, v) => converter.scalar(p, v),
    item: (k, v) => converter.item(k, v),
    dataStart: p => converter.dataStart(p),
    dataChunk: s => converter.dataChunk(s),
    dataEnd: p => converter.dataEnd(p),
  });
  const source = fs.createReadStream(input).pipe(zlib.createGunzip());
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for await (const bytes of source) await reader.write(decoder.decode(bytes, { stream: true }));
  await reader.write(decoder.decode());
  reader.finish();
  return converter.finalize();
}

if (require.main === module) {
  (async () => {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log('Usage: node scripts/convert-cmm.cjs --input city.cmm.gz --out data/imported-city [--center x,z --radius m | --bounds minX,minZ,maxX,maxZ] [--tile-size 512] [--terrain-cell 32] [--max-terrain-samples 250000] [--stops-file stops.json]');
      return;
    }
    const result = await convert(args);
    console.log(JSON.stringify(result, null, 2));
  })().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
}

module.exports = { parseArgs, convert, clipSegment, simplifyLine, trafficFlow, CmmReader, TerrainDecoder };
