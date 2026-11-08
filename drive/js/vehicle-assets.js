/* Comrade1280's Generic passenger car pack, CC BY 4.0. See /drive/credits.html. */
(function(root) {
  'use strict';
  const files = {comet:'comet',rally:'rally',pickup:'pickup',hypercar:'hypercar'};
  const wheelNames = ['wheel-back-right','wheel-front-right','wheel-back-left','wheel-front-left'];
  function prepare(source, spec) {
    source.updateMatrixWorld(true);
    const wheelNodes=wheelNames.map(name=>{
      const node=source.getObjectByName(name);
      if(!node) throw new Error('Vehicle asset is missing '+name);
      return node;
    });
    const centers=wheelNodes.map(node=>new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3()));
    const axleCenter=centers.reduce((v,p)=>v.add(p),new THREE.Vector3()).multiplyScalar(.25);
    const body=new THREE.Group(), brakeMaterials=new Set();
    const materials=new Set();
    source.traverse(mesh=>{
      if(!mesh.isMesh) return;
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]) {
        materials.add(material);
        // Source interiors are sparse. Opaque smoked glazing hides open shells
        // and avoids transparent sorting artifacts on low-end mobile GPUs.
        if(material.name.startsWith('Glass')){
          material.transparent=false;material.opacity=1;material.depthWrite=true;
          material.color.setHex(0x172731);material.roughness=.22;material.metalness=.15;
        }
        if(material.name.startsWith('BrakeLens')) {
          material.emissive.setHex(0xff3020); material.emissiveIntensity=.22;
          brakeMaterials.add(material);
        }
      }
    });
    materials.forEach(material=>{
      // Keep the source's body, glass, wheel and optics textures/materials.
      for(const texture of Object.values(material)) if(texture?.isTexture) texture.anisotropy=4;
    });
    const wheels=wheelNodes.map((node,i)=>{
      const wheel=new THREE.Group();
      node.traverse(mesh=>{
        if(!mesh.isMesh) return;
        const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        geometry.translate(-centers[i].x,-centers[i].y,-centers[i].z);
        const copy=new THREE.Mesh(geometry,mesh.material);
        copy.castShadow=copy.receiveShadow=true; wheel.add(copy);
      });
      return wheel;
    });
    // Static suspension compression is gravity / (4 * spring stiffness).
    // Align the authored wheel arches with physical wheel centers at ride height.
    const archHeight=1.05-.15-.42+9.81/(4*32);
    source.traverse(mesh=>{
      if(!mesh.isMesh) return;
      for(let parent=mesh;parent;parent=parent.parent) if(wheelNodes.includes(parent)) return;
      const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      geometry.translate(-axleCenter.x,archHeight-axleCenter.y,-axleCenter.z);
      const copy=new THREE.Mesh(geometry,mesh.material);
      copy.castShadow=copy.receiveShadow=true; body.add(copy);
    });
    const originals=new Set();source.traverse(mesh=>{if(mesh.geometry)originals.add(mesh.geometry);});
    originals.forEach(geometry=>geometry.dispose());
    return {body,wheels,brakeMaterials:[...brakeMaterials],rearLamp:[...brakeMaterials][0]};
  }
  function load(type,spec,success,failure) {
    if(!THREE.GLTFLoader){failure(new Error('Vehicle loader unavailable'));return;}
    new THREE.GLTFLoader().load('assets/vehicles/passenger/'+files[type]+'.glb',gltf=>{
      try{success(prepare(gltf.scene,spec));}catch(error){failure(error);}
    },undefined,failure);
  }
  root.DriveVehicleAssets={load,prepare,files};
})(typeof globalThis!=='undefined'?globalThis:this);
