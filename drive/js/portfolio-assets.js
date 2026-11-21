(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePortfolioAssets = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';

  const heights = {
    'ac-stacked': 2.4, antenna: 7, platform: 9, signs: 4,
    streetlight: 6, 'sushi-truck': 3.4, tank: 3, terminal: 2.2, 'tv-tower': 5
  };

  function disposeModels(models) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    for (const model of models) model.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of [].concat(object.material || [])) materials.add(material);
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
    for (const geometry of geometries) geometry.dispose();
    for (const texture of textures) texture.dispose();
  }

  function lightPanels(model) {
    const materials = new Set();
    model.traverse(object => {
      for (const material of [].concat(object.material || [])) materials.add(material);
    });
    for (const material of materials) {
      if (!material.emissive) continue;
      if (material.name === 'Texture_Signs' && material.map) {
        material.emissive.setHex(0xffffff);
        material.emissiveMap = material.map;
        material.emissiveIntensity = .62;
      } else if (/^(?:Light|Lights|Screen)$/.test(material.name)) {
        material.emissive.copy(material.color);
        material.emissiveIntensity = .8;
      }
    }
  }

  function attach(THREE, world, placements = []) {
    const root = new THREE.Group();
    root.name = 'portfolio-imported-assets';
    const templates = new Set();
    let disposed = false;
    const byId = new Map();
    for (const placement of placements) {
      const {id} = placement;
      if (!Object.prototype.hasOwnProperty.call(heights, id)) continue;
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(placement);
    }

    async function addAssets(loader, id, items) {
      try {
        const {scene: model} = await loader.loadAsync('assets/portfolio/' + id + '.glb');
        if (disposed) {
          disposeModels([model]);
          return 0;
        }
        templates.add(model);
        const box = new THREE.Box3().setFromObject(model);
        const height = box.max.y - box.min.y;
        if (!Number.isFinite(height) || height <= 0) return 0;
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.position.y += height / 2;
        lightPanels(model);
        for (const {x, y = 0, z, heading = 0, height: meters = heights[id]} of items) {
          const instance = new THREE.Group();
          instance.name = 'portfolio-prop-' + id;
          instance.position.set(x, y, z);
          instance.rotation.y = heading;
          instance.scale.setScalar(meters / height);
          instance.add(model.clone(true));
          root.add(instance);
        }
        return items.length;
      } catch (error) {
        if (!disposed) console.warn('Portfolio prop could not load:', id, error);
        return 0;
      }
    }

    world.add(root);
    const loader = THREE.GLTFLoader && new THREE.GLTFLoader();
    const ready = loader
      ? Promise.all(Array.from(byId, ([id, items]) => addAssets(loader, id, items)))
          .then(counts => counts.reduce((total, count) => total + count, 0))
      : Promise.resolve(0);
    return {ready, dispose() {
      if (disposed) return;
      disposed = true;
      root.parent?.remove(root);
      disposeModels(templates);
      templates.clear();
      root.clear();
    }};
  }

  return {attach};
});
