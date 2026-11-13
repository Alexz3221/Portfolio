'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const THREE = require('three');
const C = require('cannon');
const Imported = require('../js/imported-city');
const Physics = require('../js/physics');

const dataRoot = path.join(__dirname, '../data/imported-city');
const fetchLocal = async (url) => {
  const file = path.join(dataRoot, url.replace(/^data\/imported-city\//, ''));
  return { ok: fs.existsSync(file), json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
};
async function loadAt(x, z) {
  const map = await Imported.load('data/imported-city/manifest.json', {fetch: fetchLocal});
  await map.ensureNear(x, z, 40);
  const world = new THREE.Group(), visual = map.build(THREE, world);
  const tile = world.children.flatMap((root) => root.children)
    .find((group) => group.name === 'imported-city-tile' &&
      group.userData.tile.ix === Math.floor(x / map.tileSize) &&
      group.userData.tile.iz === Math.floor(z / map.tileSize));
  assert.ok(tile, 'target district tile is rendered');
  return {map, visual, tile};
}
function topAt(mesh, x, z) {
  if (!mesh) return -Infinity;
  const p = mesh.geometry.attributes.position;
  let highest = -Infinity;
  for (let i = 0; i < p.count; i += 3) {
    const ax = p.getX(i), az = p.getZ(i), bx = p.getX(i + 1), bz = p.getZ(i + 1);
    const cx = p.getX(i + 2), cz = p.getZ(i + 2);
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-7) continue;
    const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
    const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
    if (u < -1e-4 || v < -1e-4 || u + v > 1.0001) continue;
    const y = u * p.getY(i) + v * p.getY(i + 1) + (1 - u - v) * p.getY(i + 2);
    highest = Math.max(highest, y);
  }
  return highest;
}
function rayHeight(physics, x, z, startY) {
  const result = new C.RaycastResult();
  assert.ok(physics.world.raycastClosest(new C.Vec3(x, startY, z),
    new C.Vec3(x, startY - 100, z), {}, result));
  return result.hitPointWorld.y;
}

test('real curved ramp is a continuous deck across all 46 exported samples', async () => {
  const {map, visual, tile} = await loadAt(1485, -700);
  const raw = JSON.parse(fs.readFileSync(path.join(dataRoot, 'tiles/2_-2.json'), 'utf8'));
  const feature = raw.features.find((item) => item.type === 'road' && item.id === '5338503');
  assert.equal(feature.points.length, 47);
  assert.equal(map.highwaySegments.filter((road) => road.id === feature.id).length, 46,
    'every source-elevated sample remains on one deck through the low ramp');
  const deck = tile.getObjectByName('imported-city-highway');
  assert.ok(deck);
  const physics = Physics.create({map:'city', city:map});
  physics.reset(1485, -700);
  const miteredDecks = physics.world.bodies.filter((body) => body.shapes.length === 2 &&
    body.shapes.every((shape) => shape instanceof C.ConvexPolyhedron));
  assert.ok(miteredDecks.length > 0, 'curved deck has split triangular collision prisms');
  for (const body of miteredDecks) for (const shape of body.shapes) {
    for (let i = 0; i < shape.faces.length; i++) {
      const normal = shape.faceNormals[i], face = shape.faces[i];
      const first = shape.vertices[face[0]];
      assert.ok(normal.dot(first) >= -1e-6, 'collision face points outward from its prism');
      for (const index of face.slice(1)) {
        const vertex = shape.vertices[index];
        const planeDistance = normal.x * (vertex.x - first.x) +
          normal.y * (vertex.y - first.y) + normal.z * (vertex.z - first.z);
        assert.ok(Math.abs(planeDistance) < 1e-5, 'collision face is planar');
      }
    }
  }
  physics.body.position.set(0, 10000, 0);
  for (let i = 1; i < feature.points.length - 1; i += 2) {
    const [x, , z] = feature.points[i];
    const a = feature.points[i - 1], b = feature.points[i + 1];
    const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
    const nx = dz / length, nz = -dx / length;
    for (const offset of [-feature.width * .32, 0, feature.width * .32]) {
      const px = x + nx * offset, pz = z + nz * offset;
      const surface = topAt(deck, px, pz);
      assert.ok(Number.isFinite(surface), `deck covers curved ramp sample ${i} at offset ${offset}`);
      assert.ok(surface >= map.terrainHeight(px, pz) + .025,
        `deck remains visible above terrain at sample ${i}`);
      if (i % 4 === 1) {
        const collider = rayHeight(physics, px, pz, surface + 5);
        assert.ok(Math.abs(collider - surface) < .4,
          `collider follows curved ramp at sample ${i}, offset ${offset}: ${collider} vs ${surface}`);
      }
    }
  }
  physics.dispose();
  visual.dispose();
});

test('real low-to-raised transition keeps physical road and starts rails after clearance', async () => {
  const {map, visual, tile} = await loadAt(2925, -332);
  const roads = map.highwaySegments.filter((road) => road.id === '4572509');
  assert.equal(roads.length, 3, 'all three source samples stay on the elevated road chain');
  const deck = tile.getObjectByName('imported-city-highway');
  assert.ok(deck);
  const low = roads[0], start = [low.x1, low.z1];
  assert.ok(Number.isFinite(topAt(deck, start[0], start[1])), 'the low approach has deck pavement');
  const rails = map.guardrails.filter((rail) => rail.roadId === '4572509');
  assert.ok(rails.length >= 2, 'raised span has barriers');
  assert.ok(rails.every((rail) => Math.hypot(rail.x - start[0], rail.z - start[1]) > 5),
    'barriers do not protrude onto the low approach');
  const physics = Physics.create({map:'city', city:map});
  const high = roads.find((road) => Math.min(
    road.y1 - map.terrainHeight(road.x1, road.z1),
    road.y2 - map.terrainHeight(road.x2, road.z2)) > 3);
  assert.ok(high, 'the real road includes a raised section');
  const x = (high.x1 + high.x2) / 2, z = (high.z1 + high.z2) / 2;
  physics.reset(x, z);
  physics.body.position.set(0, 10000, 0);
  const collider = rayHeight(physics, x, z, high.y1 + 15);
  const rendered = topAt(deck, x, z);
  assert.ok(Math.abs(collider - rendered) < .2,
    `collider ${collider} follows rendered raised deck ${rendered}`);
  const source = JSON.parse(fs.readFileSync(path.join(dataRoot, 'tiles/5_-1.json'), 'utf8'))
    .features.find((item) => item.type === 'road' && item.id === '4572509');
  for (let i = 1; i < source.points.length - 1; i++) {
    const point = source.points[i], before = source.points[i - 1], after = source.points[i + 1];
    const dx = after[0] - before[0], dz = after[2] - before[2], length = Math.hypot(dx, dz);
    for (const offset of [-source.width * .32, 0, source.width * .32]) {
      const sx = point[0] + dz / length * offset;
      const sz = point[2] - dx / length * offset;
      const surface = topAt(deck, sx, sz);
      assert.ok(Number.isFinite(surface), `deck spans ramp seam ${i} at offset ${offset}`);
      const collision = rayHeight(physics, sx, sz, surface + 5);
      assert.ok(Math.abs(collision - surface) < .4,
        `collider spans ramp seam ${i} at offset ${offset}: ${collision} vs ${surface}`);
    }
  }
  physics.dispose(); visual.dispose();
});

test('barriers stop before a real three-way elevated highway merge', async () => {
  const node = {x:1424.372, y:10.995, z:-357.102};
  const {map, visual, tile} = await loadAt(node.x, node.z);
  const ids = new Set(['530539', '530905', '530915']);
  const arms = map.highwaySegments.filter((road) => ids.has(road.id) &&
    Math.min(Math.hypot(road.x1 - node.x, road.z1 - node.z),
      Math.hypot(road.x2 - node.x, road.z2 - node.z)) < .1);
  assert.equal(arms.length, 3, 'all three source roads meet at the same grade');
  for (const road of arms) {
    const length = Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
    const atStart = Math.hypot(road.x1 - node.x, road.z1 - node.z) < .1;
    const setback = atStart ? road.railStart * length : (1 - road.railEnd) * length;
    assert.ok(road.railEnd <= road.railStart || setback >= Math.min(5.9, length - .1),
      `barrier on road ${road.id} stops before the merge`);
  }
  for (const road of map.highwaySegments.filter((item) => ids.has(item.id))) {
    if (road.railEnd <= road.railStart) continue;
    const near = Math.min(Math.hypot(road.x1 - node.x, road.z1 - node.z),
      Math.hypot(road.x2 - node.x, road.z2 - node.z));
    if (near > 7) continue;
    for (const t of [road.railStart, road.railEnd]) {
      const x = road.x1 + (road.x2 - road.x1) * t;
      const z = road.z1 + (road.z2 - road.z1) * t;
      assert.ok(Math.hypot(x - node.x, z - node.z) >= 5.8,
        `barrier on ${road.id} stays out of the merge, including short curve samples`);
    }
  }
  assert.ok(tile.getObjectByName('imported-city-guardrail'), 'raised approaches retain barriers');
  visual.dispose();
});
