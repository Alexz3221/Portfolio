(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePortfolioPlay = api;
})(globalThis, function () {
  'use strict';

  function create(C, THREE, scene, physics, positions) {
    const width = .84, height = 1.05;
    const shape = new C.Box(new C.Vec3(width / 2, height / 2, width / 2));
    const shell = new THREE.BoxGeometry(width, height, width);
    const strip = new THREE.BoxGeometry(width + .012, .11, width + .012);
    const paint = new THREE.MeshStandardMaterial({color: 0x28313c, roughness: .55, metalness: .28});
    const tint = new THREE.Color(0xff8a61), flash = new THREE.Color(0xffefc4);
    const bays = new THREE.Group();
    bays.name = 'portfolio-test-bay-pylons';
    scene.add(bays);

    physics.world.allowSleep = true;
    physics.body.allowSleep = false;
    const pylons = positions.map(({x, z}) => {
      const body = new C.Body({mass: 36, shape, linearDamping: .2, angularDamping: .26,
        sleepSpeedLimit: .25, sleepTimeLimit: .8});
      physics.world.addBody(body);
      const mesh = new THREE.Group();
      const lamp = new THREE.MeshBasicMaterial({color: tint});
      mesh.add(new THREE.Mesh(shell, paint));
      for (const offset of [-.35, .27]) {
        const band = new THREE.Mesh(strip, lamp);
        band.position.y = offset;
        mesh.add(band);
      }
      bays.add(mesh);
      const home = new C.Vec3(x, physics.terrainHeight(x, z) + height / 2 + .015, z);
      const pylon = {body, mesh, home, lamp, energy: 0};
      body.addEventListener('collide', event => {
        if (event.body === physics.body && Math.abs(event.contact.getImpactVelocityAlongNormal()) > 1.5) pylon.energy = 1;
      });
      return pylon;
    });

    function update(delta) {
      for (const pylon of pylons) {
        const {body, mesh, lamp} = pylon;
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
        pylon.energy = Math.max(0, pylon.energy - delta * 3);
        lamp.color.copy(tint).lerp(flash, pylon.energy);
      }
    }

    function reset() {
      for (const pylon of pylons) {
        const {body, home} = pylon;
        body.position.copy(home);
        body.quaternion.set(0, 0, 0, 1);
        body.velocity.setZero();
        body.angularVelocity.setZero();
        body.force.setZero();
        body.torque.setZero();
        body.aabbNeedsUpdate = true;
        body.wakeUp();
        pylon.energy = 0;
      }
      update(0);
    }

    reset();
    return {update, reset, dispose() { for (const pylon of pylons) physics.world.removeBody(pylon.body); }};
  }

  return {create};
});
