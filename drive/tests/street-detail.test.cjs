'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const Imported = require('../js/imported-city');

test('source lane offsets make marked carriageways, curbs, sidewalks, and street trees', async () => {
  const base = 'data/street-detail/';
  const laneDetails = [-4.5, -1.5, 1.5, 4.5].map((position, index) => ({
    position, width: 3, direction: index < 2 ? 'Forward' : 'Backward', index, speed: 22
  }));
  const road = { type: 'road', id: 'boulevard', kind: 'ROAD', mode: 'GROUND',
    roadClass: 'arterial', width: 24, lanes: { car_lane_count: 4, direction: 0 }, laneDetails,
    points: [[10, 0, 0], [190, 0, 0]] };
  const manifest = { format: 'drive-city-v1', bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 },
    tileSize: 200, focus: [100, 0], terrain: { file: 'terrain.json' },
    tiles: [{ ix: 0, iz: 0, file: 'tiles/0_0.json', buildingCount: 0 }] };
  const joiningRoads = [-100, 100].map((z, index) => ({
    id: 'branch-' + index, kind: 'ROAD', mode: 'GROUND', roadClass: 'street', width: 12,
    points: [[190, 0, 0], [190, 0, z]]
  }));
  const overview = { format: 'drive-city-overview-v1', roads: [road, ...joiningRoads], districts: [], stops: [] };
  const terrain = { format: 'drive-city-terrain-v1', rows: 5, cols: 5,
    origin: [-200, -200], cell: 100, heights: Array(25).fill(0) };
  const files = new Map([[base + 'manifest.json', manifest], [base + 'overview.json', overview],
    [base + 'terrain.json', terrain], [base + 'tiles/0_0.json', { format: 'drive-city-tile-v1', features: [road] }]]);
  const map = await Imported.load(base + 'manifest.json', {
    fetch: async (url) => ({ ok: files.has(url), json: async () => files.get(url) })
  });
  assert.deepEqual(map.roadSegments[0].laneDetails.map((lane) => lane.position), [-4.5, -1.5, 1.5, 4.5]);
  const world = new THREE.Group(), visual = map.build(THREE, world);
  const asphalt = world.getObjectByName('imported-city-road');
  const sidewalk = world.getObjectByName('imported-city-sidewalk');
  const curb = world.getObjectByName('imported-city-curb');
  const white = world.getObjectByName('imported-city-white-marking');
  const yellow = world.getObjectByName('imported-city-yellow-marking');
  const crossing = world.getObjectByName('imported-city-crosswalk');
  const trees = world.getObjectByName('imported-city-tree-canopy');
  assert.ok(asphalt && sidewalk && curb && white && yellow && crossing && trees);
  assert.ok(trees.count >= 4, 'tree instances line both sidewalks');
  assert.equal(sidewalk.geometry.attributes.uv.count, sidewalk.geometry.attributes.position.count);
  const extent = (mesh) => {
    const points = mesh.geometry.attributes.position;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < points.count; i++) {
      min = Math.min(min, points.getZ(i)); max = Math.max(max, points.getZ(i));
    }
    return [min, max];
  };
  const pavement = extent(asphalt), walks = extent(sidewalk), median = extent(yellow);
  assert.ok(pavement[0] > -7 && pavement[1] < 7, 'asphalt follows source vehicle lane extents');
  assert.ok(walks[0] < -11.5 && walks[1] > 11.5, 'sidewalk fills the source road width');
  assert.ok(median[0] > -.3 && median[1] < .3, 'opposing directions get a yellow median');
  visual.dispose();
});
