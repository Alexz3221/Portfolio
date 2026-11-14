/* Place the user-supplied 2024 U9 GLB in the hidden key-6 car slot.
 * Preserve its original mesh, proportions and materials while separating wheels.
 */
(function(root) {
  'use strict';

  const path='assets/vehicles/u9-xtreme/u9-source.glb';
  const wheelNames=['wheel-back-right','wheel-front-right','wheel-back-left','wheel-front-left'];
  const rideAxleY=1.05-.15-.42+9.81/(4*32);

  function wheelIndex(center) {
    return (center.x>=0?2:0)+(center.z>=0?1:0);
  }
  function centerOf(node) {
    return new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());
  }
  function prepare(source,spec) {
    source.updateMatrixWorld(true);
    const size=new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());
    if(size.x<=0||size.y<=0||size.z<=0)throw new Error('U9 source has invalid bounds');
    const wheelRoot=source.getObjectByName('Wheel1A_3D1');
    if(!wheelRoot)throw new Error('U9 source is missing its tire geometry');
    const tireMeshes=[];
    wheelRoot.traverse(node=>{if(node.isMesh)tireMeshes.push(node);});
    if(tireMeshes.length<4)throw new Error('U9 source has incomplete tire geometry');

    // Sketchfab's nested transforms make the car centimetres long in glTF
    // units. Uniform scaling preserves the downloaded model's proportions.
    source.scale.multiplyScalar(spec.length/size.z);
    source.updateMatrixWorld(true);

    const buckets=Array.from({length:4},()=>[]);
    const tireBounds=Array.from({length:4},()=>new THREE.Box3());
    tireMeshes.forEach(mesh=>{
      const i=wheelIndex(centerOf(mesh));
      buckets[i].push(mesh);
      tireBounds[i].expandByObject(mesh);
    });
    const rootNode=source.getObjectByName('RootNode');
    if(!rootNode)throw new Error('U9 source is missing its root node');
    const hubs=rootNode.children.filter(node=>node.name.startsWith('SM_Hub_L_'));
    if(hubs.length!==4)throw new Error('U9 source must have four separate wheel hubs');
    // Hubs, discs and the 22 tire pieces per corner all roll together. Brake
    // calipers remain fixed on the body.
    for(const node of rootNode.children) {
      if(!node.name.startsWith('SM_Hub_L_')&&!node.name.startsWith('SM_Disk_'))continue;
      const i=wheelIndex(centerOf(node));
      node.traverse(mesh=>{if(mesh.isMesh)buckets[i].push(mesh);});
    }
    if(buckets.some(parts=>parts.length<2))throw new Error('U9 wheel assembly is incomplete');
    const wheelCenters=tireBounds.map(box=>box.getCenter(new THREE.Vector3()));
    const axleCenter=wheelCenters.reduce((sum,point)=>sum.add(point),new THREE.Vector3()).multiplyScalar(.25);
    const wheelMeshes=new Set(buckets.flat());
    const body=new THREE.Group();
    const wheels=wheelNames.map(name=>{const wheel=new THREE.Group();wheel.name=name;return wheel;});
    const originals=new Set();

    function copyMesh(mesh,destination,center) {
      const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      geometry.translate(-center.x,-center.y,-center.z);
      const copy=new THREE.Mesh(geometry,mesh.material);
      copy.castShadow=copy.receiveShadow=true;
      destination.add(copy);
    }
    for(let i=0;i<4;i++) {
      buckets[i].forEach(mesh=>copyMesh(mesh,wheels[i],wheelCenters[i]));
    }
    source.traverse(mesh=>{
      if(!mesh.isMesh)return;
      originals.add(mesh.geometry);
      if(!wheelMeshes.has(mesh))copyMesh(mesh,body,
        new THREE.Vector3(axleCenter.x,axleCenter.y-rideAxleY,axleCenter.z));
    });
    originals.forEach(geometry=>geometry.dispose());
    return {body,wheels,brakeMaterials:[]};
  }

  function load(spec,success,failure) {
    if(!THREE.GLTFLoader){failure(new Error('Vehicle loader unavailable'));return;}
    new THREE.GLTFLoader().load(path,gltf=>{
      try{success(prepare(gltf.scene,spec));}catch(error){failure(error);}
    },undefined,failure);
  }
  root.DriveU9XtremeAsset={load,prepare,path};
})(typeof globalThis!=='undefined'?globalThis:this);
