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
    assert.equal(placements.length,21);
    assert.equal(new Set(placements.map(({id})=>id)).size,21);
    const ray = new THREE.Raycaster();
    const shown = [];
    for (const face of faces) {
      assert.ok(face?.material.depthTest);
      assert.equal(face.material.depthWrite,false);
      assert.equal(face.material.side,THREE.DoubleSide);
      assert.equal(face.material.uniforms.sky.value,0);
      const center=face.getWorldPosition(new THREE.Vector3());
      const facing=new THREE.Vector3(0,0,1).transformDirection(face.matrixWorld);
      for (const side of [-1,1]) {
        ray.set(center.clone().addScaledVector(facing,side*4),facing.clone().multiplyScalar(-side));
        assert.ok(ray.intersectObject(face).length>0);
      }
      face.material.uniforms.art.value.addEventListener('dispose',()=>shown.push(face.name));
    }
    const matrix=faces[0].matrixWorld.clone();
    const hardware=['portfolio-corporate-emitters','portfolio-corporate-edge-lights']
      .map(name=>world.getObjectByName(name));
    const releasedHardware=[];
    for (const batch of hardware) {
      assert.ok(batch?.isInstancedMesh);
      batch.addEventListener('dispose',()=>releasedHardware.push(batch.name));
    }
    assert.ok(world.getObjectByName('portfolio-corporate-carrier-beams')?.isLineSegments);
    display.update(.5);
    assert.equal(faces[0].material.uniforms.clock.value,.5);
    assert.ok(faces[0].matrixWorld.equals(matrix));
    display.dispose();
    display.dispose();
    assert.equal(shown.length,faces.length);
    assert.equal(releasedHardware.length,hardware.length);
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

test('sky campaigns reuse artwork with a denser optical pane and stable scene placement', async () => {
  const previous=globalThis.DrivePortfolioSkyCampaignPlacements;
  globalThis.DrivePortfolioSkyCampaignPlacements=[{
    id:'sky-lumen',campaign:'lumen',sky:true,x:24,y:73,z:-81,width:56,height:20,heading:.38,tilt:.64
  }];
  try {
    const world=new THREE.Group();
    const display=ads.attach(THREE,world);
    assert.deepEqual(await display.ready,[false]); // Node uses the browser-free fallback image.
    const face=world.getObjectByName('portfolio-corporate-projection-sky-lumen');
    const {art,sky,clock,artBay}=face.material.uniforms;
    assert.equal(sky.value,1);
    assert.equal(art.value.name,'portfolio-corporate-art-lumen');
    assert.equal(artBay.value.z,.44);
    assert.equal(face.material.side,THREE.DoubleSide);
    assert.equal(face.material.depthWrite,false);
    assert.equal(face.userData.portfolioAdId,'corporate-sky-lumen');
    assert.equal(face.userData.portfolioSkyProjection,true);
    assert.equal(face.userData.portfolioAdFace,true);
    assert.equal(world.getObjectByName('portfolio-corporate-emitters'),undefined);
    world.updateMatrixWorld(true);
    const normal=new THREE.Vector3(0,0,1).transformDirection(face.matrixWorld);
    const expected=new THREE.Vector3(0,-Math.sin(.64),Math.cos(.64)).applyAxisAngle(new THREE.Vector3(0,1,0),.38);
    assert.ok(normal.distanceTo(expected)<1e-8);
    const center=face.getWorldPosition(new THREE.Vector3());
    for (const side of [-1,1]) {
      const ray=new THREE.Raycaster(center.clone().addScaledVector(normal,side*6),normal.clone().multiplyScalar(-side));
      assert.ok(ray.intersectObject(face).length>0);
    }
    const matrix=face.matrixWorld.clone();
    display.update(.5);
    assert.equal(clock.value,.5);
    assert.ok(face.matrixWorld.equals(matrix));
    display.dispose();
    assert.equal(world.children.length,0);

    const parked=ads.attach(THREE,world,{reducedMotion:true});
    parked.update(.5);
    const fixed=world.getObjectByName('portfolio-corporate-projection-sky-lumen').material.uniforms;
    assert.equal(fixed.clock.value,0);
    assert.equal(fixed.motion.value,0);
    parked.dispose();
  } finally {
    if (previous===undefined) delete globalThis.DrivePortfolioSkyCampaignPlacements;
    else globalThis.DrivePortfolioSkyCampaignPlacements=previous;
  }
});
