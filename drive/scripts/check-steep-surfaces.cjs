'use strict';

// Read-only CANNON sweep of the six steepest source road segments.
const fs = require('node:fs/promises');
const path = require('node:path');
const C = require('cannon');
const Imported = require('../js/imported-city');
const Physics = require('../js/physics');

const root = path.resolve(__dirname, '..');
const ids = ['3375460', '531087', '5339578', '5264023', '3375220', '530495'];
const round = n => Number(n.toFixed(3));

async function main() {
  const map = await Imported.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () =>
      JSON.parse(await fs.readFile(path.join(root, url), 'utf8')) })
  });
  await map.ensureAll();
  const city = { ...map, ensureNear: () => Promise.resolve([]) };
  const physics = Physics.create({ map: 'city', city,
    distanceToRoad: map.distanceToRoad, roadHalfWidth: map.roadHalfWidth });
  physics.body.collisionResponse = false;
  const results = [];
  try {
    for (const id of ids) {
      const road = [...map.roadSegments, ...map.highwaySegments]
        .filter(item => String(item.id) === id)
        .sort((a, b) => {
          const grade = item => Math.abs((item.y2 - item.y1) /
            Math.max(.001, Math.hypot(item.x2 - item.x1, item.z2 - item.z1)));
          return grade(b) - grade(a);
        })[0];
      if (!road) continue;
      const midX = (road.x1 + road.x2) / 2, midZ = (road.z1 + road.z2) / 2;
      physics.reset(midX, midZ);
      const span = Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
      const count = Math.max(2, Math.ceil(span / .5));
      const samples = [];
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        if (!(road.visibleIntervals || [[0, 1]])
          .some(([a, b]) => t >= a + .001 && t <= b - .001)) continue;
        const x = road.x1 + (road.x2 - road.x1) * t;
        const z = road.z1 + (road.z2 - road.z1) * t;
        const expected = Math.max(road.y1 + (road.y2 - road.y1) * t,
          map.terrainHeight(x, z)) + (road.mode === 'ELEVATED' ? .06 : 0);
        const ray = new C.RaycastResult();
        const hit = physics.world.raycastClosest(new C.Vec3(x, expected + 1.5, z),
          new C.Vec3(x, expected - 2, z), {}, ray);
        samples.push({ t: round(t), x: round(x), z: round(z),
          expected: round(expected), physical: hit ? round(ray.hitPointWorld.y) : null,
          source: hit ? ray.body?.citySource || null : null });
      }
      const gaps = samples.filter(sample => sample.physical === null);
      const mismatches = samples.filter(sample => sample.physical !== null &&
        Math.abs(sample.physical - sample.expected) > .35);
      const steps = [];
      for (let i = 1; i < samples.length; i++) {
        if (samples[i].physical === null || samples[i - 1].physical === null) continue;
        const dx = Math.hypot(samples[i].x - samples[i - 1].x,
          samples[i].z - samples[i - 1].z);
        steps.push({ grade: (samples[i].physical - samples[i - 1].physical) / Math.max(.001, dx),
          from: samples[i - 1], to: samples[i] });
      }
      results.push({ id, mode: road.mode,
        grade: round((road.y2 - road.y1) / span), span: round(span),
        visibleIntervals: road.visibleIntervals || [[0, 1]],
        samples: samples.length, gaps: gaps.length, mismatches: mismatches.length,
        maxAbsDelta: round(Math.max(0, ...mismatches.map(sample =>
          Math.abs(sample.physical - sample.expected)))),
        worstStepGrade: round(Math.max(0, ...steps.map(item => Math.abs(item.grade)))),
        worstStep: steps.sort((a, b) => Math.abs(b.grade) - Math.abs(a.grade))[0] || null,
        examples: [...gaps, ...mismatches].slice(0, 4) });
    }
  } finally { physics.dispose(); }
  console.log(JSON.stringify(results, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
