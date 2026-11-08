/* Authored Kenney CC0 meshes. See assets/vehicles/README.md for provenance. */
(function(root) {
  'use strict';
  const files = {comet:'sedan-sports', rally:'hatchback-sports', pickup:'truck-flat', hypercar:'race-future'};
  function prepare(source, spec) {
    const body = new THREE.Group();
    // The CC0 atlas uses fixed palette columns. Separate material response without
    // adding geometry or textures: painted metal, glazing and lamps should not
    // all look like the original matte plastic. One active vehicle stays small.
    const rearLamp = new THREE.MeshBasicMaterial({color:0xff354e});
    const frontLamp = new THREE.MeshBasicMaterial({color:0xfff4cf});
    const materials = new Map();
    function materialFor(kind, sourceMaterial) {
      if (kind === 'rear') return rearLamp;
      if (kind === 'front') return frontLamp;
      if (materials.has(kind)) return materials.get(kind);
      let material;
      if (kind === 'paint') material = new THREE.MeshPhysicalMaterial({color:spec.color || 0x6386d2, metalness:.32, roughness:.3, clearcoat:.8, clearcoatRoughness:.22});
      else if (kind === 'glass') material = new THREE.MeshPhysicalMaterial({color:0x263b49, metalness:.15, roughness:.18, clearcoat:1});
      else { material = sourceMaterial.clone(); material.roughness = .8; material.metalness = .08; }
      materials.set(kind,material); return material;
    }
    function paletteKind(uv, i) {
      const u=uv.getX(i), v=uv.getY(i);
      if (v>.75 && u<.15) return 'glass';
      if (v>.75 && u>.3 && u<.4) return 'rear';
      if (v>.75 && u>.18 && u<.25) return 'front';
      if (v>.25 && v<.5) return 'paint';
      if (u>.8 && v>.5 && v<.75) return 'paint';
      return 'trim';
    }
    function finishBody(geometry, sourceMaterial) {
      const uv=geometry.attributes.uv, index=geometry.index;
      if (!uv || !index) return new THREE.Mesh(geometry,sourceMaterial);
      const buckets=new Map();
      for(let i=0;i<index.count;i+=3) {
        const kind=paletteKind(uv,index.getX(i));
        if(!buckets.has(kind)) buckets.set(kind,[]);
        buckets.get(kind).push(index.getX(i),index.getX(i+1),index.getX(i+2));
      }
      const ordered=[], used=[]; geometry.clearGroups();
      buckets.forEach((indices,kind)=>{geometry.addGroup(ordered.length,indices.length,used.length);ordered.push(...indices);used.push(materialFor(kind,sourceMaterial));});
      geometry.setIndex(ordered);
      return new THREE.Mesh(geometry,used);
    }
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
      const copy = finishBody(geometry,mesh.material);
      copy.castShadow = copy.receiveShadow = true; body.add(copy);
    });
    // The future-racer has no authored lamp faces. Fit a small grid directly
    // to front/rear panels. Check all nine samples, including corners and edges,
    // before adding a lamp; a center hit alone can leave its ends floating.
    body.updateMatrixWorld(true);
    const panels=[...body.children], box=new THREE.Box3().setFromObject(body);
    function surfaceLamps(material, direction, name) {
      if(panels.some(mesh=>Array.isArray(mesh.material) && mesh.material.includes(material))) return;
      [-1,1].forEach(side=>{
        for(const [x,y] of [.32,.25,.18].flatMap(x=>[.55,.65,.8,.95,.45].map(y=>[x,y]))) {
          const vertices=[], normals=[];
          for(let row=0;row<3;row++) for(let col=0;col<3;col++) {
            const origin=new THREE.Vector3(side*spec.width*x+(col-1)*.075,y+(row-1)*.025,direction>0?box.max.z+1:box.min.z-1);
            const ray=new THREE.Raycaster(origin,new THREE.Vector3(0,0,-direction));
            const hit=ray.intersectObjects(panels,false)[0];
            if(!hit || hit.face.normal.z*direction<.4) continue;
            vertices.push(hit.point);normals.push(hit.face.normal);
          }
          if(vertices.length!==9) continue;
          // Keep the complete lens on a single planar panel; do not bridge
          // creases, recesses, or separate parts such as a wing and bumper.
          if(vertices.some((v,i)=>Math.abs(v.clone().sub(vertices[0]).dot(normals[0]))>.0001 || normals[i].dot(normals[0])<.999)) continue;
          const geometry=new THREE.BufferGeometry(), positions=[], indices=[];
          vertices.forEach(v=>positions.push(v.x,v.y,v.z+direction*.006));
          for(let row=0;row<2;row++) for(let col=0;col<2;col++) {
            const a=row*3+col;
            if(direction>0) indices.push(a,a+1,a+3,a+1,a+4,a+3);
            else indices.push(a,a+3,a+1,a+1,a+3,a+4);
          }
          geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
          const lamp=new THREE.Mesh(geometry,material);lamp.name=name;body.add(lamp);
          break;
        }
      });
    }
    surfaceLamps(rearLamp,-1,'surface-tail-lamp');
    surfaceLamps(frontLamp,1,'surface-head-lamp');
    // Copies own their geometry; materials and the shared atlas remain cached.
    const originals = new Set(); source.traverse(mesh=>{if(mesh.geometry) originals.add(mesh.geometry);});
    originals.forEach(geometry=>geometry.dispose());
    return {body,wheels,rearLamp};
  }
  function load(type, spec, success, failure) {
    if (!THREE.GLTFLoader) { failure(new Error('Vehicle loader unavailable')); return; }
    new THREE.GLTFLoader().load('assets/vehicles/' + files[type] + '.glb', gltf => {
      try { success(prepare(gltf.scene,spec)); } catch(error) { failure(error); }
    }, undefined, failure);
  }
  root.DriveVehicleAssets = {load,prepare,files};
})(typeof globalThis !== 'undefined' ? globalThis : this);
