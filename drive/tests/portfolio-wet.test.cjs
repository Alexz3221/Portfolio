const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const wet = require('../js/portfolio-wet');

test('wet roads capture the current camera while moving and reuse the mirror when idle', () => {
  const texture = new THREE.Texture();
  const three = {...THREE, TextureLoader: class { load() { return texture; } }};
  const world = new THREE.Group();
  const road = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial());
  road.name = 'portfolio-streets';
  world.add(road);
  const scene = new THREE.Scene();
  const sky = new THREE.Object3D();
  sky.position.set(4, 5, 6);
  scene.add(world, sky);

  let target = null;
  const captures = [];
  const renderer = {
    capabilities: {getMaxAnisotropy: () => 4},
    shadowMap: {autoUpdate: true},
    state: {buffers: {depth: {setMask() {}}}},
    toneMapping: THREE.ACESFilmicToneMapping,
    getRenderTarget: () => target,
    setRenderTarget(next) { target = next; },
    render(_scene, mirror) {
      assert.equal(road.visible, false);
      assert.ok(target);
      captures.push({position: mirror.position.clone(), direction: mirror.getWorldDirection(new THREE.Vector3()),
        width: target.width, height: target.height});
    }
  };
  const camera = new THREE.PerspectiveCamera(70, 1.5, .1, 400);
  camera.position.set(0, 4, -60);
  camera.lookAt(0, 3, -50);
  const reflection = wet.create(three, renderer, scene, world, sky);
  reflection.update(camera, .016);
  assert.equal(captures.length, 1);
  assert.ok(Math.abs(captures[0].position.y + 3.904) < 1e-6);
  assert.equal(target, null);
  assert.equal(road.visible, true);
  assert.equal(renderer.shadowMap.autoUpdate, true);
  assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
  assert.deepEqual(sky.position.toArray(), [4, 5, 6]);

  reflection.update(camera, .016);
  assert.equal(captures.length, 1);
  camera.position.x += .3;
  reflection.update(camera, .008);
  assert.equal(captures.length, 2);
  assert.equal(captures[1].position.x, .3);
  camera.lookAt(12, 3, -50);
  reflection.update(camera, .008);
  assert.equal(captures.length, 3);
  assert.ok(captures[2].direction.distanceTo(captures[1].direction) > .1);
  camera.aspect = .5;
  camera.updateProjectionMatrix();
  reflection.update(camera, .008);
  assert.equal(captures.length, 4);
  assert.ok(captures[3].height > captures[3].width);

  camera.position.y = .07;
  reflection.update(camera, .008);
  assert.equal(captures.length, 4);
  camera.position.y = 4;
  reflection.update(camera, .008);
  assert.equal(captures.length, 5);
  reflection.dispose();
});
