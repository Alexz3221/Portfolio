'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const THREE = require('three');
const Imported = require('../js/imported-city');

function cubic(curve, t) {
  const u = 1 - t;
  return [0, 1, 2].map(i => u ** 3 * curve[0][i] + 3 * u * u * t * curve[1][i] +
    3 * u * t * t * curve[2][i] + t ** 3 * curve[3][i]);
}

function pointAlong(curve, meters, fromEnd) {
  const samples = 100, lengths = [0];
  let previous = curve[0];
  for (let i = 1; i <= samples; i++) {
    const current = cubic(curve, i / samples);
    lengths.push(lengths[i - 1] + Math.hypot(current[0] - previous[0], current[2] - previous[2]));
    previous = current;
  }
  const target = fromEnd ? lengths[samples] - meters : meters;
  let i = 1;
  while (i < samples && lengths[i] < target) i++;
  const fraction = (target - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
  return cubic(curve, (i - 1 + fraction) / samples);
}

function coveredByLaneMesh(world, x, y, z) {
  let covered = false;
  world.traverse(object => {
    if (covered || object.name !== 'imported-city-lane-connector') return;
    const positions = object.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 3) {
      const ax = positions.getX(i), az = positions.getZ(i);
      const bx = positions.getX(i + 1), bz = positions.getZ(i + 1);
      const cx = positions.getX(i + 2), cz = positions.getZ(i + 2);
      const area = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(area) < 1e-6) continue;
      const wa = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / area;
      const wb = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / area;
      const wc = 1 - wa - wb;
      if (wa < -.002 || wb < -.002 || wc < -.002) continue;
      const surfaceY = wa * positions.getY(i) + wb * positions.getY(i + 1) +
        wc * positions.getY(i + 2);
      if (Math.abs(surfaceY - y) < 1.2) { covered = true; return; }
    }
  });
  return covered;
}

function roadDeckAt(map, roadId, x, z) {
  let nearest = null;
  for (const road of map.nearbyRoads(x, z, 35)) {
    if (String(road.id) !== String(roadId)) continue;
    const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
    const t = Math.max(0, Math.min(1,
      ((x - road.x1) * dx + (z - road.z1) * dz) / (dx * dx + dz * dz || 1)));
    const distance = Math.hypot(x - road.x1 - dx * t, z - road.z1 - dz * t);
    if (!nearest || distance < nearest.distance)
      nearest = { distance, y: road.y1 + (road.y2 - road.y1) * t };
  }
  assert.ok(nearest, `road ${roadId} is available near the graph lane`);
  return Math.max(nearest.y, map.terrainHeight(x, z)) + .1;
}

async function loadCity() {
  const root = path.resolve(__dirname, '..');
  return Imported.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () =>
      JSON.parse(await fs.readFile(path.join(root, url), 'utf8')) })
  });
}

test('the native 2+1 highway merge has lane pavement through both approach and exit mouths', async () => {
  const map = await loadCity();
  const world = new THREE.Group(), visual = map.build(THREE, world);
  try {
    const x = 4525, z = -3656;
    await map.ensureNear(x, z, 280);
    visual.update({ position: { x, y: map.terrainHeight(x, z) + 15, z } }, 0);
    const ids = new Set([4386732, 4386494, 4387223]);
    const connectors = map.nearbyLaneConnectors(x, z, 60)
      .filter(item => ids.has(item.entity_id));
    assert.equal(connectors.length, 3, 'two Fairview lanes and one Belmont lane reach this node');
    const tiles = [...map.loadedTiles.values()].filter(tile => tile.state === 'loaded')
      .map(tile => tile.data);
    const edgeLanes = tiles.flatMap(tile => tile.edgeLanes);
    for (const connector of connectors) {
      const nearest = (candidates, endpoint, atEnd) => candidates.sort((a, b) =>
        Math.hypot(...a.curve[atEnd ? 3 : 0].map((v, i) => v - endpoint[i])) -
        Math.hypot(...b.curve[atEnd ? 3 : 0].map((v, i) => v - endpoint[i])))[0];
      const source = nearest(edgeLanes.filter(lane =>
        lane.edge_id === connector.from_edge_id &&
        lane.end_lane_index === connector.from_lane_index), connector.curve[0], true);
      const target = nearest(edgeLanes.filter(lane =>
        lane.edge_id === connector.to_edge_id &&
        lane.start_lane_index === connector.to_lane_index), connector.curve[3], false);
      assert.ok(source && target, `connector ${connector.entity_id} has native endpoint lanes`);
      for (const [label, edgeId, point] of [
        ['approach', connector.from_edge_id, pointAlong(source.curve, 8, true)],
        ['exit', connector.to_edge_id, pointAlong(target.curve, 8, false)]
      ]) {
        const y = roadDeckAt(map, edgeId, point[0], point[2]);
        assert.ok(coveredByLaneMesh(world, point[0], y, point[2]),
          `${label} of connector ${connector.entity_id} stays under lane-centered asphalt`);
      }
    }
  } finally { visual.dispose(); }
});

test('Orchard and Seabreeze merge paint follows lane boundaries after convergence', async () => {
  const map = await loadCity();
  const world = new THREE.Group(), visual = map.build(THREE, world);
  try {
    const x = 4409, z = -3569;
    await map.ensureNear(x, z, 260);
    visual.update({ position: { x, y: map.terrainHeight(x, z) + 15, z } }, 0);
    const byId = new Map(map.nearbyLaneConnectors(x, z, 75)
      .filter(connector => connector.node_id === 5010219)
      .map(connector => [connector.entity_id, connector]));
    assert.deepEqual([...byId.keys()].sort(), [4388401, 4388402, 4388408]);
    const vertices = [];
    world.traverse(object => {
      if (object.name !== 'imported-city-merge-guide') return;
      const attribute = object.geometry.attributes.position;
      for (let i = 0; i < attribute.count; i++)
        vertices.push([attribute.getX(i), attribute.getZ(i)]);
    });
    const midpoint = (a, b, t) => {
      const pa = cubic(byId.get(a).curve, t), pb = cubic(byId.get(b).curve, t);
      return [(pa[0] + pb[0]) / 2, (pa[2] + pb[2]) / 2];
    };
    const nearest = point => Math.min(Infinity, ...vertices.map(vertex =>
      Math.hypot(vertex[0] - point[0], vertex[1] - point[1])));
    assert.ok(nearest(midpoint(4388401, 4388408, .5)) < 1.2,
      'through lanes 2 and 3 have a boundary stripe, rather than centerline dashes');
    assert.ok(nearest(midpoint(4388408, 4388402, .75)) < 1.2,
      'the ramp boundary appears after Seabreeze has joined Orchard');
    assert.ok(nearest(midpoint(4388408, 4388402, .05)) > .8,
      'the ramp boundary does not paint across the open gap before the roads meet');
  } finally { visual.dispose(); }
});
