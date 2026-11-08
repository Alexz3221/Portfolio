/* Authored Kenney CC0 meshes. See assets/vehicles/README.md for provenance. */
(function(root) {
  'use strict';
  const files = {comet:'sedan-sports', rally:'hatchback-sports', pickup:'truck-flat', hypercar:'race-future'};
  function prepare(source, spec) {
    const body = new THREE.Group();
    source.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(source);
    const size = bounds.getSize(new THREE.Vector3());
    const sx = spec.width / size.x, sz = spec.length / size.z, sy = sx;
    const front = source.getObjectByName('wheel-front-left');
    const back = source.getObjectByName('wheel-back-left');
    if (!front || !back) throw new Error('Vehicle asset is missing wheel nodes');
    const axleCenter = (front.position.z + back.position.z) / 2;
    const wheelNames = ['wheel-back-right','wheel-front-right','wheel-back-left','wheel-front-left'];
    const wheels = wheelNames.map(name => {
      const node = source.getObjectByName(name);
      if (!node) throw new Error('Vehicle asset is missing ' + name);
      const wheel = new THREE.Group();
      // Bake the node transform into geometry, then recenter the complete wheel.
      const box = new THREE.Box3().setFromObject(node), center = box.getCenter(new THREE.Vector3()), extents = box.getSize(new THREE.Vector3());
      node.traverse(mesh => {
        if (!mesh.isMesh) return;
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        geometry.translate(-center.x,-center.y,-center.z);
        geometry.scale(.35/extents.x, spec.wheelRadius*2/extents.y, spec.wheelRadius*2/extents.z);
        const copy = new THREE.Mesh(geometry, mesh.material);
        copy.castShadow = copy.receiveShadow = true; wheel.add(copy);
      });
      return wheel;
    });
    source.traverse(mesh => {
      if (!mesh.isMesh || wheelNames.some(name => {let n=mesh; while(n){if(n.name===name)return true;n=n.parent;}return false;})) return;
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      geometry.translate(0, -front.position.y, -axleCenter);
      geometry.scale(sx,sy,sz); geometry.translate(0,.48,0);
      const copy = new THREE.Mesh(geometry,mesh.material);
      copy.castShadow = copy.receiveShadow = true; body.add(copy);
    });
    // Copies own their geometry; materials and the shared atlas remain cached.
    const originals = new Set(); source.traverse(mesh=>{if(mesh.geometry) originals.add(mesh.geometry);});
    originals.forEach(geometry=>geometry.dispose());
    return {body,wheels};
  }
  function load(type, spec, success, failure) {
    if (!THREE.GLTFLoader) { failure(new Error('Vehicle loader unavailable')); return; }
    new THREE.GLTFLoader().load('assets/vehicles/' + files[type] + '.glb', gltf => {
      try { success(prepare(gltf.scene,spec)); } catch(error) { failure(error); }
    }, undefined, failure);
  }
  root.DriveVehicleAssets = {load,prepare,files};
})(typeof globalThis !== 'undefined' ? globalThis : this);
