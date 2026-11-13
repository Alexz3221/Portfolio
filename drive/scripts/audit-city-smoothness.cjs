'use strict';

// Read-only audit of the imported save and its generated road colliders.
const fs = require('node:fs/promises');
const path = require('node:path');
const Imported = require('../js/imported-city');

const root = path.resolve(__dirname, '..');
const round = (value, digits = 2) => Number(value.toFixed(digits));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const cubic = (points, t) => {
  const u = 1 - t;
  return [0, 1, 2].map(i => u ** 3 * points[0][i] +
    3 * u * u * t * points[1][i] + 3 * u * t * t * points[2][i] +
    t ** 3 * points[3][i]);
};
const nearest = (x, z, road) => {
  const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
  const t = Math.max(0, Math.min(1,
    ((x - road.x1) * dx + (z - road.z1) * dz) / (dx * dx + dz * dz || 1)));
  return { distance: Math.hypot(x - road.x1 - dx * t, z - road.z1 - dz * t),
    y: road.y1 + (road.y2 - road.y1) * t, t };
};

async function main() {
  const map = await Imported.load('data/imported-city/manifest.json', {
    fetch: async url => ({ ok: true, json: async () =>
      JSON.parse(await fs.readFile(path.join(root, url), 'utf8')) })
  });
  await map.ensureAll();
  const tiles = [...map.loadedTiles.values()].filter(entry => entry.state === 'loaded');
  const sourceGrades = [], gradeChanges = [], laneSpikes = [];
  const seenLanes = new Set(), seenConnectors = new Set(), connectors = [];
  let sourceSegments = 0, sourceRoads = 0;
  let railMetersRemoved = 0;
  for (const entry of tiles) {
    const tile = entry.data;
    railMetersRemoved += tile.guardrailClipStats?.removedMeters || 0;
    const raw = JSON.parse(await fs.readFile(path.join(root, 'data/imported-city', entry.descriptor.file), 'utf8'));
    for (const road of raw.features.filter(feature =>
      feature?.type === 'road' && Array.isArray(feature.points))) {
      sourceRoads++;
      let prior = null;
      for (let i = 1; i < road.points.length; i++) {
        const a = road.points[i - 1], b = road.points[i], span = distance(a, b);
        if (span < .5) continue;
        const grade = (b[1] - a[1]) / span;
        if (span >= 2) {
          sourceSegments++;
          if (Math.abs(grade) > .35) sourceGrades.push({
            id: road.id, mode: road.mode, name: road.name, kind: road.kind,
            roadClass: road.roadClass, grade: round(grade, 3),
            length: round(span, 1), x: round((a[0] + b[0]) / 2, 1),
            z: round((a[2] + b[2]) / 2, 1),
            from: a.map(value => round(value, 2)),
            to: b.map(value => round(value, 2)),
            sourcePoints: road.points.length <= 12 ? road.points.map(point =>
              point.map(value => round(value, 2))) : undefined });
          if (prior && Math.abs(prior.grade - grade) > .3)
            gradeChanges.push({ id: road.id, mode: road.mode,
              change: round(Math.abs(prior.grade - grade), 3),
              from: round(prior.grade, 3), to: round(grade, 3),
              x: round(a[0], 1), z: round(a[2], 1) });
          prior = { grade };
        }
      }
    }
    for (const lane of tile.edgeLanes || []) {
      if (seenLanes.has(lane.entity_id)) continue;
      seenLanes.add(lane.entity_id);
      const points = Array.from({ length: 17 }, (_, i) => cubic(lane.curve, i / 16));
      let xy = 0;
      for (let i = 1; i < points.length; i++) xy += distance(points[i - 1], points[i]);
      const rise = Math.abs(points[16][1] - points[0][1]);
      let worst = rise / Math.max(xy, .001);
      for (let i = 0; i < 12; i++) {
        const span = points.slice(i, i + 5).reduce((sum, point, j, list) =>
          sum + (j ? distance(point, list[j - 1]) : 0), 0);
        const change = Math.abs(points[i + 4][1] - points[i][1]);
        if (span < 2 && change > .75) worst = Math.max(worst, change / Math.max(span, .001));
      }
      if (worst > .6 && (rise > 1 || xy > 2)) laneSpikes.push({
        lane: lane.entity_id, road: lane.edge_id, xy: round(xy, 2),
        rise: round(rise, 2), grade: round(worst, 2),
        x: round((points[0][0] + points[16][0]) / 2, 1),
        z: round((points[0][2] + points[16][2]) / 2, 1) });
    }
    for (const connector of tile.ownedConnectors || [])
      if (!seenConnectors.has(connector.entity_id)) {
        seenConnectors.add(connector.entity_id);
        connectors.push(connector);
      }
  }

  const mismatch = [], hiddenSourceMismatch = [];
  for (const connector of connectors) {
    const samples = connector.samples || [];
    if (samples.length < 2) continue;
    for (const [label, roadId, sample] of [
      ['start', connector.from_edge_id, samples[0]],
      ['end', connector.to_edge_id, samples[samples.length - 1]]
    ]) {
      const candidates = [
        ...map.nearbyRoads(sample.x, sample.z, 25),
        ...map.nearbyHighways(sample.x, sample.z, 25)
      ].filter(road => String(road.id) === String(roadId))
        .map(road => ({ road, ...nearest(sample.x, sample.z, road) }))
        .sort((a, b) => a.distance - b.distance);
      const match = candidates[0];
      if (!match || match.distance > match.road.width / 2 + 3) continue;
      const deck = Math.max(match.y, map.terrainHeight(sample.x, sample.z)) + .08;
      const delta = sample.y - deck;
      if (Math.abs(delta) > 1) {
        const record = {
          connector: connector.entity_id, node: connector.node_id,
          from: connector.from_edge_id, to: connector.to_edge_id,
          road: roadId, mode: match.road.mode, mouth: label,
          delta: round(delta, 2), x: round(sample.x, 1), z: round(sample.z, 1)
        };
        if ((match.road.visibleIntervals || [[0, 1]]).some(([a, b]) =>
            match.t >= a - .001 && match.t <= b + .001)) mismatch.push(record);
        else hiddenSourceMismatch.push(record);
      }
    }
  }

  const railRoadHits = [], railLaneHits = [];
  for (const rail of map.guardrails) {
    const horizontal = Math.cos(rail.pitch || 0);
    const ux = Math.sin(rail.yaw || 0) * horizontal;
    const uz = Math.cos(rail.yaw || 0) * horizontal;
    const roadCandidates = [
      ...map.nearbyRoads(rail.x, rail.z, rail.length / 2 + 8),
      ...map.nearbyHighways(rail.x, rail.z, rail.length / 2 + 8)
    ].filter(road => String(road.id) !== String(rail.roadId));
    const laneCandidates = [
      ...map.nearbyLaneConnectors(rail.x, rail.z, rail.length / 2 + 8),
      ...map.nearbyLaneApproaches(rail.x, rail.z, rail.length / 2 + 8)
    ];
    const steps = Math.max(1, Math.ceil(rail.length / 1.5));
    let roadHit = null, laneHit = null;
    for (let i = 0; i <= steps && (!roadHit || !laneHit); i++) {
      const along = (i / steps - .5) * rail.length;
      const x = rail.x + ux * along, z = rail.z + uz * along;
      const baseY = rail.y - Math.sin(rail.pitch || 0) * along - rail.height / 2;
      if (!roadHit) for (const road of roadCandidates) {
        const hit = nearest(x, z, road);
        if (hit.distance < road.width / 2 - 1 &&
            Math.abs(baseY - hit.y) < 1.8) {
          roadHit = { rail: rail.roadId, road: road.id,
            x: round(x, 1), z: round(z, 1),
            d: round(hit.distance, 2), dy: round(baseY - hit.y, 2) };
          break;
        }
      }
      if (!laneHit) for (const lane of laneCandidates) {
        const samples = lane.samples || [];
        for (const sample of samples) if (Math.hypot(x - sample.x, z - sample.z) < 1.2 &&
            Math.abs(baseY - sample.y) < 1.8) {
          laneHit = { rail: rail.roadId, lane: lane.entity_id,
            x: round(x, 1), z: round(z, 1),
            d: round(Math.hypot(x - sample.x, z - sample.z), 2),
            dy: round(baseY - sample.y, 2) };
          break;
        }
        if (laneHit) break;
      }
    }
    if (roadHit) railRoadHits.push(roadHit);
    if (laneHit) railLaneHits.push(laneHit);
  }

  const supportRoadHits = new Map(), supportLaneHits = [];
  for (let supportIndex = 0; supportIndex < map.supports.length; supportIndex++) {
    const support = map.supports[supportIndex];
    const low = support.y - support.height / 2;
    const high = support.y + support.height / 2;
    const nearby = [
      ...map.nearbyRoads(support.x, support.z, 3),
      ...map.nearbyHighways(support.x, support.z, 3)
    ];
    for (const road of nearby) {
      const hit = nearest(support.x, support.z, road);
      if (hit.distance > road.width / 2 - 1.5 ||
          hit.y < low - .5 || hit.y > high - 1.5) continue;
      const key = `${supportIndex}:${road.id}`;
      const prior = supportRoadHits.get(key);
      if (prior && prior.roadOffset <= hit.distance) continue;
      supportRoadHits.set(key, { support: supportIndex,
        x: round(support.x, 1), z: round(support.z, 1),
        road: road.id, roadY: round(hit.y, 1), supportLow: round(low, 1),
        supportHigh: round(high, 1), roadOffset: round(hit.distance, 1),
        roadHalfWidth: round(road.width / 2, 1) });
    }
    const lanes = [
      ...map.nearbyLaneConnectors(support.x, support.z, 3),
      ...map.nearbyLaneApproaches(support.x, support.z, 3)
    ];
    for (const lane of lanes) {
      if (lane.forbidden || lane.path_methods_bits != null &&
          !(Number(lane.path_methods_bits) & 2)) continue;
      const samples = lane.samples || [];
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1], b = samples[i];
        const hit = nearest(support.x, support.z, {
          x1: a.x, y1: a.y, z1: a.z, x2: b.x, y2: b.y, z2: b.z
        });
        if (hit.distance > (Number(lane.width_m) || 3) / 2 - .25 ||
            hit.y < low - .5 || hit.y > high - 1.5) continue;
        supportLaneHits.push({ support: supportIndex, lane: lane.entity_id,
          x: round(support.x, 1), z: round(support.z, 1),
          roadY: round(hit.y, 1), low: round(low, 1), high: round(high, 1),
          offset: round(hit.distance, 1) });
        break;
      }
    }
  }

  const renderedApproachesById = new Map(map.laneApproaches.map(lane =>
    [lane.entity_id, lane]));
  for (const spike of laneSpikes) {
    const approach = renderedApproachesById.get(spike.lane);
    spike.renderedApproach = !!approach;
    if (approach) {
      let maxGrade = 0;
      for (let i = 1; i < approach.samples.length; i++) {
        const a = approach.samples[i - 1], b = approach.samples[i];
        const span = Math.hypot(b.x - a.x, b.z - a.z);
        if (span > .1) maxGrade = Math.max(maxGrade, Math.abs(b.y - a.y) / span);
      }
      spike.renderedGrade = round(maxGrade, 3);
    }
  }
  for (const steep of sourceGrades) {
    const roads = [
      ...map.nearbyRoads(steep.x, steep.z, 30),
      ...map.nearbyHighways(steep.x, steep.z, 30)
    ].filter(road => String(road.id) === String(steep.id));
    const match = roads.map(road => ({ road, ...nearest(steep.x, steep.z, road) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (!match) continue;
    const road = match.road;
    steep.visibleAtMidpoint = (road.visibleIntervals || [[0, 1]])
      .some(([a, b]) => match.t >= a && match.t <= b);
    const span = Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
    steep.renderedSurfaceGrade = round((
      Math.max(road.y2, map.terrainHeight(road.x2, road.z2)) -
      Math.max(road.y1, map.terrainHeight(road.x1, road.z1))) / Math.max(span, .001), 3);
  }

  const report = {
    tiles: tiles.length, sourceRoads, sourceSegments,
    steepSourceSegments: sourceGrades.length,
    sourceSegmentsOver60Percent: sourceGrades.filter(item => Math.abs(item.grade) > .6).length,
    largestSourceGrades: sourceGrades.sort((a, b) =>
      Math.abs(b.grade) - Math.abs(a.grade)).slice(0, 15),
    abruptSourceGradeChanges: gradeChanges.length,
    largestGradeChanges: gradeChanges.sort((a, b) => b.change - a.change).slice(0, 12),
    nativeEdgeLanes: seenLanes.size,
    nativeLaneSpikes: laneSpikes.length,
    renderedSpikeApproaches: laneSpikes.filter(lane => lane.renderedApproach).length,
    largestNativeSpikes: laneSpikes.sort((a, b) => b.grade - a.grade).slice(0, 15),
    renderedConnectors: connectors.length,
    connectorMouthMismatchesOver1m: mismatch.length,
    connectorMouthMismatchesOver2m: mismatch.filter(item => Math.abs(item.delta) > 2).length,
    largestMouthMismatches: mismatch.sort((a, b) =>
      Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 15),
    hiddenSourceMouthMismatchesOver1m: hiddenSourceMismatch.length,
    hiddenSourceMouthExamples: hiddenSourceMismatch.sort((a, b) =>
      Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8),
    generatedRails: map.guardrails.length,
    railMetersRemovedByClipping: round(railMetersRemoved, 1),
    remainingRailRoadHits: railRoadHits.length,
    railRoadExamples: railRoadHits.slice(0, 15),
    remainingRailLaneHits: railLaneHits.length,
    railLaneExamples: railLaneHits.slice(0, 15),
    generatedSupports: map.supports.length,
    supportRoadHits: supportRoadHits.size,
    supportLaneHits: supportLaneHits.length,
    supportLaneExamples: supportLaneHits.slice(0, 12),
    obstructedSupports: new Set([...supportRoadHits.values()].map(hit => hit.support)).size,
    obstructedRoads: new Set([...supportRoadHits.values()].map(hit => hit.road)).size,
    supportRoadExamples: [...supportRoadHits.values()]
      .sort((a, b) => a.roadOffset / a.roadHalfWidth - b.roadOffset / b.roadHalfWidth)
      .slice(0, 20)
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
