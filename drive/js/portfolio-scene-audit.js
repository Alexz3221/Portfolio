(function(root, factory) {
  const audit = factory();
  if (typeof module === 'object' && module.exports) module.exports = audit;
  else root.DrivePortfolioSceneAudit = audit;
})(globalThis, function() {
  'use strict';

  const contactTolerance = .012;
  const drivableDecks = new Set([
    'portfolio-ramp','portfolio-skyway-deck','portfolio-skyway-underframe','portfolio-skyway-fascia'
  ]);

  function box(THREE, center, axes, half) {
    const reach = new THREE.Vector3();
    for (const [i,axis] of axes.entries()) {
      reach.x += Math.abs(axis.x)*half[i];
      reach.y += Math.abs(axis.y)*half[i];
      reach.z += Math.abs(axis.z)*half[i];
    }
    return {center,axes,half,bounds:new THREE.Box3(center.clone().sub(reach),center.clone().add(reach))};
  }

  function basis(THREE, matrix) {
    const axes = [0,1,2].map(index => new THREE.Vector3().setFromMatrixColumn(matrix,index));
    const scale = axes.map(axis=>axis.length());
    if (scale.some(length=>length<1e-6)) return null;
    axes.forEach((axis,index)=>axis.divideScalar(scale[index]));
    return {axes,scale};
  }

  function transformBounds(THREE, bounds, matrix, frame) {
    const center = bounds.getCenter(new THREE.Vector3()).applyMatrix4(matrix);
    const size = bounds.getSize(new THREE.Vector3()).toArray();
    return box(THREE,center,frame.axes,frame.scale.map((factor,i)=>factor*size[i]*.5));
  }

  // Oriented boxes use face and edge cross-product axes so a diagonal beam
  // near a corner is checked at its actual rotation.
  function overlaps(a,b,delta,cross) {
    if (!a.bounds.intersectsBox(b.bounds)) return false;
    delta.subVectors(b.center,a.center);
    function separates(axis) {
      let span = 0;
      for (let i=0;i<3;i++)
        span += Math.abs(axis.dot(a.axes[i]))*a.half[i] + Math.abs(axis.dot(b.axes[i]))*b.half[i];
      return Math.abs(axis.dot(delta)) >= span-contactTolerance;
    }
    for (const axis of a.axes) if (separates(axis)) return false;
    for (const axis of b.axes) if (separates(axis)) return false;
    for (const u of a.axes) for (const v of b.axes) {
      cross.crossVectors(u,v);
      if (cross.lengthSq()>1e-7 && separates(cross.normalize())) return false;
    }
    return true;
  }

  function displayVolume(THREE, bounds, matrix, frame) {
    const [width,height] = bounds.getSize(new THREE.Vector3()).toArray();
    // Allow the mounted frame to meet the screen perimeter. Inspect the
    // readable face itself and the first 0.65 m immediately in front of it.
    const center = bounds.getCenter(new THREE.Vector3());
    center.z = bounds.max.z + .30/frame.scale[2];
    center.applyMatrix4(matrix);
    return box(THREE,center,frame.axes,[width*frame.scale[0]*.46,height*frame.scale[1]*.45,.35]);
  }

  function corridors(THREE, city) {
    const lanes = (city.networkRoads || []).map((road,index)=>({...road,id:'street-'+(index+1),topStart:0,topEnd:0}));
    for (const [index,segment] of (city.highwaySegments || []).entries()) {
      const {x,z,length,width,topStart,topEnd} = segment;
      lanes.push({
        id:Number.isFinite(segment.x1) ? 'skyway-'+(index+1) : 'test-ramp-'+(index+1),
        x1:segment.x1 ?? x,z1:segment.z1 ?? z-length/2,
        x2:segment.x2 ?? x,z2:segment.z2 ?? z+length/2,width,topStart,topEnd
      });
    }
    const up = new THREE.Vector3(0,1,0);
    return lanes.map(({id,x1,z1,x2,z2,topStart,topEnd,width})=>{
      const tangent = new THREE.Vector3(x2-x1,topEnd-topStart,z2-z1);
      const length = tangent.length();
      tangent.divideScalar(length);
      const right = new THREE.Vector3().crossVectors(up,tangent).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent,right);
      const center = new THREE.Vector3((x1+x2)*.5,(topStart+topEnd)*.5,(z1+z2)*.5);
      center.addScaledVector(normal,1.42);
      return {id,volume:box(THREE,center,[right,normal,tangent],
        [Math.min(1.68,width*.5),1.23,Math.max(.1,length*.5-.08)])};
    });
  }

  function sceneSolids(THREE, world) {
    const signs = [], solids = [];
    const instance = new THREE.Matrix4(), matrix = new THREE.Matrix4();
    world.updateMatrixWorld(true);
    world.traverseVisible(object=>{
      const {geometry} = object;
      if (!object.isMesh || !geometry) return;
      const {portfolioAdFace, portfolioAdId, portfolioAuditSolid} = object.userData;
      if (!portfolioAdFace && !portfolioAuditSolid && geometry.type !== 'BoxGeometry') return;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const bounds = geometry.boundingBox;
      if (bounds.isEmpty()) return;
      for (let index=0;index<(object.isInstancedMesh ? object.count : 1);index++) {
        matrix.copy(object.matrixWorld);
        if (object.isInstancedMesh) {
          object.getMatrixAt(index,instance);
          matrix.multiply(instance);
        }
        const frame = basis(THREE,matrix);
        if (!frame) continue;
        const owner = object.parent === world ? null : object.parent;
        if (portfolioAdFace) signs.push({id:portfolioAdId || object.name,object,owner,volume:displayVolume(THREE,bounds,matrix,frame)});
        const fallback = owner?.name ? owner.name+' part' : geometry.type;
        solids.push({
          object,owner,volume:transformBounds(THREE,bounds,matrix,frame),
          name:(object.name || fallback)+(object.isInstancedMesh ? '#' + index : '')
        });
      }
    });
    return {signs,solids};
  }

  function run(THREE, world, city) {
    const {signs,solids} = sceneSolids(THREE,world);
    const delta = new THREE.Vector3(), cross = new THREE.Vector3();
    const at = volume=>volume.center.toArray().map(value=>Math.round(value*100)/100);
    const intersects = (volume,obstacle)=>overlaps(volume,obstacle.volume,delta,cross);
    const finding = (id,obstacle)=>({target:id,obstacle:obstacle.name,at:at(obstacle.volume)});
    const signHits = [];
    for (const sign of signs) for (const obstacle of solids) {
      if (obstacle.object === sign.object || sign.owner && obstacle.owner === sign.owner) continue;
      if (intersects(sign.volume,obstacle)) signHits.push(finding(sign.id,obstacle));
    }
    const routeHits = [];
    const lanes = corridors(THREE,city);
    for (const lane of lanes) for (const obstacle of solids) {
      if (drivableDecks.has(obstacle.object.name)) continue;
      const {min,max} = obstacle.volume.bounds;
      if (max.y-min.y < .38) continue;
      if (intersects(lane.volume,obstacle)) routeHits.push(finding(lane.id,obstacle));
    }
    return {checked:{signs:signs.length,corridors:lanes.length},signs:signHits,corridors:routeHits};
  }

  return {run};
});
