'use strict';

// Pick street-level road middles that fill the gaps between the dense city
// centers. This runs during conversion so a new save gets fresh destinations.
function generateTravelCandidates(city, limit = 17, readTile = null) {
  if (!city?.networkRoads?.length || !city?.manifest?.tiles?.length ||
      typeof city.terrainHeight !== 'function' || typeof city.snapToRoad !== 'function') return [];
  const tileSize = Number(city.tileSize) || 512;
  const tiles = new Map(city.manifest.tiles.map(tile => [`${tile.ix}_${tile.iz}`, tile]));
  const maxBuildings = Math.max(0, ...city.manifest.tiles.map(tile => Number(tile.buildingCount) || 0));
  const minBuildings = Math.max(3, Math.floor(maxBuildings * .05));
  const bestByTile = new Map();
  const bounds = city.detailBounds || city.bounds;
  for (const road of city.networkRoads) {
    if (road.mode !== 'GROUND' || /highway|motorway|freeway|express/i.test(String(road.roadClass || '')))
      continue;
    const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
    const length = Math.hypot(dx, dz);
    if (length < 8 || length > 150 || Math.abs((road.y2 - road.y1) / length) > .12 ||
        road.width < 5 || road.width > 28) continue;
    const x = (road.x1 + road.x2) / 2, z = (road.z1 + road.z2) / 2;
    if (!bounds || x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ)
      continue;
    const ix = Math.floor(x / tileSize), iz = Math.floor(z / tileSize);
    const tile = tiles.get(`${ix}_${iz}`);
    if (!tile || (Number(tile.buildingCount) || 0) < minBuildings) continue;
    const roadY = (road.y1 + road.y2) / 2;
    const clearance = roadY - city.terrainHeight(x, z);
    if (clearance < -.25 || clearance > .5) continue;
    const distance = Math.hypot(x - (ix + .5) * tileSize, z - (iz + .5) * tileSize);
    const quality = distance * .01 + Math.abs(clearance) * 20 +
      Math.abs((road.y2 - road.y1) / length) * 15 - length * .01;
    const key = `${ix}_${iz}`;
    if (!bestByTile.has(key) || quality < bestByTile.get(key).quality)
      bestByTile.set(key, { ix, iz, x, z, roadId: String(road.id), roadName: road.name || '',
        buildings: Number(tile.buildingCount) || 0, quality });
  }
  const placed = (city.manifest.centerCandidates || []).filter(center =>
    Number.isFinite(Number(center.x)) && Number.isFinite(Number(center.z)))
    .map(center => ({ x: Number(center.x), z: Number(center.z) }));
  const candidates = [...bestByTile.values()];
  const chosen = [];
  const minSpacing = Math.max(600, tileSize * 1.75);
  const detailCache = new Map();
  const detailRoadAt = (candidate, x, z) => {
    if (typeof readTile !== 'function') return null;
    const key = `${candidate.ix}_${candidate.iz}`;
    if (!detailCache.has(key)) detailCache.set(key, readTile(tiles.get(key)));
    const features = detailCache.get(key)?.features || [];
    let best = null;
    for (const feature of features) {
      if (feature?.type !== 'road' || String(feature.id) !== candidate.roadId ||
          feature.mode !== 'GROUND') continue;
      for (let i = 1; i < (feature.points || []).length; i++) {
        const a = feature.points[i - 1], b = feature.points[i];
        const dx = b[0] - a[0], dz = b[2] - a[2], length2 = dx * dx + dz * dz;
        if (length2 < .01) continue;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / length2));
        const distance = Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t);
        if (!best || distance < best.distance)
          best = { distance, y: a[1] + (b[1] - a[1]) * t, width: feature.width };
      }
    }
    return best;
  };
  while (chosen.length < limit) {
    const ranked = candidates.map(candidate => {
      const nearest = placed.length ? Math.min(...placed.map(center =>
        Math.hypot(candidate.x - center.x, candidate.z - center.z))) : 0;
      const density = .7 + .3 * Math.min(1, candidate.buildings / Math.max(1, maxBuildings * .52));
      return { candidate, nearest, score: placed.length ? nearest * density : candidate.buildings };
    }).filter(item => !placed.length || item.nearest >= minSpacing)
      .sort((a, b) => b.score - a.score || b.candidate.buildings - a.candidate.buildings ||
        a.candidate.iz - b.candidate.iz || a.candidate.ix - b.candidate.ix);
    if (!ranked.length) break;
    const pick = ranked[0].candidate;
    candidates.splice(candidates.indexOf(pick), 1);
    const street = city.snapToRoad(pick.x, pick.z);
    const clearance = street && street.y - city.terrainHeight(street.x, street.z);
    if (!street || String(street.roadId) !== pick.roadId || street.distance > 1 ||
        !Number.isFinite(clearance) || clearance < -.25 || clearance > .5) continue;
    if (typeof readTile === 'function') {
      const detail = detailRoadAt(pick, street.x, street.z);
      const detailClearance = detail && detail.y - city.terrainHeight(street.x, street.z);
      if (!detail || detail.distance > Math.min(5, detail.width / 2 - 2) ||
          Math.abs(detail.y - street.y) > .35 ||
          detailClearance < -.25 || detailClearance > .65) continue;
    }
    const x = Number(street.x.toFixed(3)), z = Number(street.z.toFixed(3));
    chosen.push({ id: `travel-${pick.ix}_${pick.iz}`, ix: pick.ix, iz: pick.iz,
      x, z, roadId: pick.roadId, roadName: pick.roadName,
      score: Number(ranked[0].score.toFixed(2)) });
    placed.push({ x, z });
  }
  return chosen;
}

module.exports = { generateTravelCandidates };
