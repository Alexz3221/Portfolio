(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePortfolioAssets = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';

  const heights = {
    'ac-stacked': 2.4, antenna: 7, platform: 9, signs: 4,
    streetlight: 6, 'sushi-truck': 3.4, tank: 3, terminal: 2.2, 'tv-tower': 5,
    'fire-escape': 5.8, 'street-coupe': 1.69, 'street-shuttle': 1.07
  };
  const parkedVehicles = [
    {id:'street-coupe', x:-84.7, z:-29.7, heading:Math.PI/2},
    {id:'street-shuttle', x:-69.3, z:-13.12, heading:-Math.PI/2},
    {id:'street-shuttle', x:119.9, z:-78, heading:0},
    {id:'street-coupe', x:104, z:16.5, heading:0},
    {id:'street-coupe', x:-78.8, z:72.1, heading:Math.PI/2}
  ].map(placement => ({...placement, parked:true, y:.044}));

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

  function attach(THREE, world, placements = [], {Cannon, physics} = {}) {
    const root = new THREE.Group();
    root.name = 'portfolio-imported-assets';
    const templates = new Set();
    const parkedBodies = [];
    let disposed = false;
    const byId = new Map();
    for (const placement of [...placements, ...parkedVehicles]) {
      const {id} = placement;
      if (!Object.prototype.hasOwnProperty.call(heights, id)) continue;
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(placement);
    }

    async function addAssets(loader, id, items) {
      try {
        const revision = id === 'street-coupe' ? '?v=2' : '';
        const {scene: model} = await loader.loadAsync('assets/portfolio/' + id + '.glb' + revision);
        if (disposed) {
          disposeModels([model]);
          return 0;
        }
        templates.add(model);
        const box = new THREE.Box3().setFromObject(model);
        const height = box.max.y - box.min.y;
        if (!Number.isFinite(height) || height <= 0) return 0;
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.position.y += height / 2;
        lightPanels(model);
        for (const {x, y = 0, z, heading = 0, height: meters = heights[id], parked, seat} of items) {
          const origin = seat ? Math.max(y,globalThis.DrivePortfolioStreets?.surfaceHeight(world,x,z) || 0,
            globalThis.DrivePortfolioArrivalSidewalks?.surfaceHeight(x,z) || 0) : y;
          const instance = new THREE.Group();
          instance.name = 'portfolio-prop-' + id;
          instance.position.set(x, origin, z);
          instance.rotation.y = heading;
          instance.scale.setScalar(meters / height);
          instance.add(model.clone(true));
          root.add(instance);
          if (parked && Cannon && physics) {
            const scale = meters / height;
            const half = new Cannon.Vec3(size.x*scale*.45, meters*.40, size.z*scale*.47);
            const body = new Cannon.Body({mass:0, position:new Cannon.Vec3(x,origin+half.y,z)});
            body.addShape(new Cannon.Box(half));
            body.quaternion.setFromAxisAngle(new Cannon.Vec3(0,1,0),heading);
            physics.world.addBody(body);
            parkedBodies.push(body);
          }
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
      for (const body of parkedBodies) physics.world.removeBody(body);
      disposeModels(templates);
      templates.clear();
      root.clear();
    }};
  }

  return {attach};
});
