'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { deriveCenters } = require('../js/portfolio-ui');
const ImportedCity = require('../js/imported-city');

test('center travel uses named export clusters and snaps onto drivable streets', () => {
  const requested = [];
  const city = {
    detailBounds: { minX: -3000, maxX: 5000, minZ: -4000, maxZ: 6000 },
    manifest: {
      source: { cityName: "Obamna's America" },
      centerCandidates: [
        { id: 'center-4_-2', x: 2304, z: -768, score: 1100 },
        { id: 'center--5_6', x: -2304, z: 3328, score: 650 },
        { id: 'center-9_5', x: 9000, z: 2816, score: 640 },
        { id: 'center-7_2', x: 3840, z: 1280, score: 630 }
      ]
    },
    snapToRoad(x, z) {
      requested.push([x, z]);
      return { x: x + 6, y: 3, z: z - 4, heading: 1.2, roadId: 'street-1', distance: x === 3840 ? 410 : 8 };
    }
  };
  const centers = deriveCenters(city);
  assert.deepEqual(requested, [[2304, -768], [-2304, 3328], [3840, 1280]]);
  assert.deepEqual(centers.map(center => center.title), ['Downtown Core', 'Campus District']);
  assert.deepEqual([centers[0].x, centers[0].z, centers[0].heading, centers[0].roadId],
    [2310, -772, 1.2, 'street-1']);
  assert.equal(centers[0].score, 1100);
});

test('other city exports use neutral names and reject unsafe or absent road snaps', () => {
  const city = {
    bounds: { minX: -500, maxX: 500, minZ: -500, maxZ: 500 },
    manifest: { source: { cityName: 'Another City' },
      centerCandidates: [{ id: 'center-0_0', x: 0, z: 0 }, { id: 'center-1_0', x: 200, z: 0 }] },
    snapToRoad(x) { return x === 0 ? { x: 5, z: 0, heading: 0, distance: 5 } : null; }
  };
  assert.deepEqual(deriveCenters(city).map(center => center.title), ['City Center 01']);
  assert.deepEqual(deriveCenters({ ...city, snapToRoad: undefined }), []);
});

test('all seven exported Obamna centers land on ground city streets', () => {
  const base = path.join(__dirname, '..', 'data', 'imported-city');
  const read = name => JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));
  const manifest = read('manifest.json');
  const city = ImportedCity.create(manifest, read('overview.json'), read('terrain.json'));
  const centers = deriveCenters(city);
  assert.equal(manifest.centerCandidates.length, 7);
  assert.deepEqual(centers.map(center => center.title), [
    'Downtown Core', 'South Center', 'Terminus District', 'Southeast Center',
    'Southwest Center', 'Campus District', 'East Center'
  ]);
  for (const center of centers) {
    const street = city.networkRoads.find(road => road.id === center.roadId);
    assert.ok(street, `${center.title} has a source road`);
    assert.equal(street.mode, 'GROUND', `${center.title} is at street level`);
    assert.doesNotMatch(street.roadClass, /highway|motorway|freeway/i);
    assert.ok(center.distance <= 150, `${center.title} stays near its dense neighborhood`);
  }
});
