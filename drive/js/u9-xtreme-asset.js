/* Adapt the user-supplied 2024 U9 GLB into the hidden Xtreme game car.
 * Source credit and CC BY-NC-SA 4.0 terms are recorded in the vehicle credits.
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
  function addPart(group,geometry,material,x,y,z) {
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);
    return mesh;
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

    // Sketchfab's nested source transforms make the whole car only centimetres
    // long in glTF units. Fit the body to BYD's Xtreme dimensions, and fit tire
    // height from the actual tire meshes rather than the decorative wheel hubs.
    const rawTires=Array.from({length:4},()=>new THREE.Box3());
    tireMeshes.forEach(mesh=>rawTires[wheelIndex(centerOf(mesh))].expandByObject(mesh));
    if(rawTires.some(box=>box.isEmpty()))throw new Error('U9 source is missing a wheel');
    const sourceRadius=rawTires.reduce((sum,box)=>sum+box.getSize(new THREE.Vector3()).y/2,0)/4;
    const radius=spec.radius||spec.wheelLayout[0].radius;
    source.scale.set(spec.width/size.x,radius/sourceRadius,spec.length/size.z);
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
    const materials=new Set(), originals=new Set();

    function copyMesh(mesh,destination,center,scale) {
      const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      geometry.translate(-center.x,-center.y,-center.z);
      if(scale)geometry.scale(scale.x,scale.y,scale.z);
      const copy=new THREE.Mesh(geometry,mesh.material);
      copy.castShadow=copy.receiveShadow=true;
      destination.add(copy);
      materials.add(mesh.material);
    }
    for(let i=0;i<4;i++) {
      const tireSize=tireBounds[i].getSize(new THREE.Vector3());
      const targetRadius=spec.wheelLayout[i].radius;
      const wheelScale=new THREE.Vector3(.325/tireSize.x,2*targetRadius/tireSize.y,2*targetRadius/tireSize.z);
      buckets[i].forEach(mesh=>copyMesh(mesh,wheels[i],wheelCenters[i],wheelScale));
    }
    source.traverse(mesh=>{
      if(!mesh.isMesh)return;
      originals.add(mesh.geometry);
      // The cockpit is hidden behind opaque glass; omit its 24k triangles.
      if(!wheelMeshes.has(mesh)&&!mesh.name.startsWith('SM_Interior_'))copyMesh(mesh,body,
        new THREE.Vector3(axleCenter.x,axleCenter.y-rideAxleY,axleCenter.z));
    });
    originals.forEach(geometry=>geometry.dispose());

    // Keep the car low without shrinking its full-sized tires. The rear wing
    // fills the remaining height in the optional carbon-aero body specification.
    const bodyTop=new THREE.Box3().setFromObject(body).max.y;
    const roofTarget=spec.height-.07;
    const compress=Math.min(1,(roofTarget-rideAxleY)/(bodyTop-rideAxleY));
    if(Number.isFinite(compress)&&compress>0)body.traverse(mesh=>{
      if(!mesh.isMesh)return;
      mesh.geometry.translate(0,-rideAxleY,0);
      mesh.geometry.scale(1,compress,1);
      mesh.geometry.translate(0,rideAxleY,0);
    });
    materials.forEach(material=>{
      if(material.name?.includes('Carpaint')){
        material.color.setHex(0x323941);material.metalness=.62;material.roughness=.29;
      }
      if(material.name?.includes('Glass')){
        material.transparent=false;material.opacity=1;material.depthWrite=true;
        material.color.setHex(0x172b34);material.roughness=.22;material.transmission=0;
      }
      for(const texture of Object.values(material))if(texture?.isTexture)texture.anisotropy=4;
    });

    const carbon=new THREE.MeshStandardMaterial({name:'XtremeCarbonAero',color:0x11171c,metalness:.28,roughness:.55});
    const edge=new THREE.MeshStandardMaterial({name:'XtremeAeroEdge',color:0x38444a,metalness:.65,roughness:.32});
    const rearLamp=new THREE.MeshBasicMaterial({name:'XtremeBrakeBar',color:0xff354e});
    const halfW=spec.width/2,halfL=spec.length/2;
    addPart(body,new THREE.BoxGeometry(spec.width*.94,.045,.24),carbon,0,.27,halfL-.11);
    addPart(body,new THREE.BoxGeometry(spec.width*.68,.025,.06),edge,0,.30,halfL-.03);
    for(const side of [-1,1]) {
      const canard=addPart(body,new THREE.BoxGeometry(.22,.03,.34),carbon,side*(halfW-.17),.39,halfL-.45);
      canard.rotation.y=side*.22;
      addPart(body,new THREE.BoxGeometry(.045,.35,.11),carbon,side*(halfW-.27),spec.height-.29,-halfL+.37);
      addPart(body,new THREE.BoxGeometry(.035,.20,.30),carbon,side*(halfW-.05),spec.height-.15,-halfL+.32);
    }
    addPart(body,new THREE.BoxGeometry(spec.width*.94,.055,.38),carbon,0,spec.height-.047,-halfL+.35);
    addPart(body,new THREE.BoxGeometry(spec.width*.84,.012,.30),edge,0,spec.height-.013,-halfL+.35);
    addPart(body,new THREE.BoxGeometry(spec.width*.77,.045,.025),rearLamp,0,.83,-halfL+.14);
    return {body,wheels,brakeMaterials:[],rearLamp};
  }

  function load(spec,success,failure) {
    if(!THREE.GLTFLoader){failure(new Error('Vehicle loader unavailable'));return;}
    new THREE.GLTFLoader().load(path,gltf=>{
      try{success(prepare(gltf.scene,spec));}catch(error){failure(error);}
    },undefined,failure);
  }
  root.DriveU9XtremeAsset={load,prepare,path};
})(typeof globalThis!=='undefined'?globalThis:this);
