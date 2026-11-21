const assert = require('node:assert/strict');
const test = require('node:test');
const THREE = require('three');
const ads = require('../js/portfolio-corporate-ads');
const placements = require('../js/portfolio-corporate-ad-placements');

test('corporate projections face both ways, stay in place and release their resources', async () => {
  const previous = globalThis.DrivePortfolioCorporateAdPlacements;
  globalThis.DrivePortfolioCorporateAdPlacements = placements;
  try {
    const world = new THREE.Group();
    const display = ads.attach(THREE,world);
    await display.ready;
    world.updateMatrixWorld(true);
    const faces = placements.map(({id})=>world.getObjectByName('portfolio-corporate-projection-'+id));
    assert.equal(faces.length,9);
    const ray = new THREE.Raycaster();
    const shown = [];
    for (const face of faces) {
      assert.ok(face?.material.depthTest);
      assert.equal(face.material.depthWrite,false);
      assert.equal(face.material.side,THREE.DoubleSide);
      const center=face.getWorldPosition(new THREE.Vector3());
      const facing=new THREE.Vector3(0,0,1).transformDirection(face.matrixWorld);
      for (const side of [-1,1]) {
        ray.set(center.clone().addScaledVector(facing,side*4),facing.clone().multiplyScalar(-side));
        assert.ok(ray.intersectObject(face).length>0);
      }
      face.material.uniforms.art.value.addEventListener('dispose',()=>shown.push(face.name));
    }
    const matrix=faces[0].matrixWorld.clone();
    assert.ok(world.getObjectByName('portfolio-corporate-emitters')?.isInstancedMesh);
    assert.ok(world.getObjectByName('portfolio-corporate-carrier-beams')?.isLineSegments);
    display.update(.5);
    assert.equal(faces[0].material.uniforms.clock.value,.5);
    assert.ok(faces[0].matrixWorld.equals(matrix));
    display.dispose();
    display.dispose();
    assert.equal(shown.length,9);
    assert.equal(world.children.length,0);

    const staticDisplay = ads.attach(THREE,world,{reducedMotion:true});
    const fixed = world.getObjectByName('portfolio-corporate-projection-'+placements[0].id);
    staticDisplay.update(.5);
    assert.equal(fixed.material.uniforms.clock.value,0);
    staticDisplay.dispose();
  } finally {
    if (previous===undefined) delete globalThis.DrivePortfolioCorporateAdPlacements;
    else globalThis.DrivePortfolioCorporateAdPlacements=previous;
  }
});

test('airborne displays share the campaign renderer and retain a deliberate art crop', () => {
  const clock = {value:2};
  const pane = ads.createCampaignDisplay(THREE,'farline',{displayAspect:5,artShare:.45,clock});
  const uniforms = pane.material.uniforms;
  assert.equal(uniforms.clock,clock);
  assert.equal(uniforms.artBay.value.z,.45);
  assert.equal(uniforms.motion.value,1);
  pane.update(.5);
  assert.equal(clock.value,2,'the owner of a shared clock advances it once');
  pane.dispose();

  const parked = ads.createCampaignDisplay(THREE,'farline',{displayAspect:5,airborne:true,reducedMotion:true});
  parked.update(.5);
  assert.equal(parked.material.uniforms.clock.value,0);
  assert.equal(parked.material.uniforms.motion.value,0);
  assert.equal(parked.material.uniforms.artBay.value.z,.34);
  parked.dispose();
});
