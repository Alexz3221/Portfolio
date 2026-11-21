/* Garage model credits and licenses are listed in /drive/credits.html. */
(function(root) {
  'use strict';
  const files = {comet:'passenger/comet.glb',rally:'garage/rally.glb',pickup:'garage/pickup.glb',hypercar:'garage/delorean.glb'};
  const credits = {comet:'Comrade1280 · CC BY 4.0',rally:'tevy · CC0',pickup:'Quaternius · CC0',hypercar:'JandroS · CC BY 4.0'};
  const wheelNames = ['wheel-back-right','wheel-front-right','wheel-back-left','wheel-front-left'];
  function garageFinish(material, type) {
    const key = material.name;
    const reflective = (type==='rally' && /^(paint_body|livery_blue|rim_machined|mirror_glass|chrome)/.test(key))
      || (type==='pickup' && key==='Atlas');
    if (reflective) {
      const lighting = root.DrivePortfolioCar?.studioReflection?.(THREE);
      if (lighting) {
        material.envMap = lighting;
        material.envMapIntensity = type==='rally' ? .86 : .66;
      }
      material.metalness = key==='Atlas' ? .31 : .44;
      material.roughness = key==='Atlas' ? .51 : .28;
      material.needsUpdate = true;
    }
    if (type==='rally' && key==='paint_body') material.color.setHex(0xc2d8eb).convertSRGBToLinear();
    if (type==='rally' && key.startsWith('livery_blue')) material.color.setHex(0x087baa).convertSRGBToLinear();
    if (type==='rally' && /^light_front/.test(key)) {
      material.emissive.setHex(0xb5edff).convertSRGBToLinear();
      material.emissiveIntensity = .63;
    }
    if (type==='pickup' && key==='Atlas') {
      material.onBeforeCompile = shader => {
        const atlas = THREE.ShaderChunk.map_fragment.replace('diffuseColor *= texelColor;', `
          // Pick out the blue body enamel without replacing the yellow cage,
          // safety stripes, trim or shading in the original palette.
          float enamel = smoothstep(.025,.094,texelColor.b-texelColor.r)
            * smoothstep(.075,.20,texelColor.g);
          float value = dot(texelColor.rgb, vec3(.2126,.7152,.0722));
          texelColor.rgb = mix(texelColor.rgb,vec3(1.16,.58,1.72)*value,enamel*.91);
          diffuseColor *= texelColor;`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',atlas);
      };
    }
    if (type==='pickup' && key==='Headlights') {
      material.emissive.setHex(0xffbf78).convertSRGBToLinear();
      material.emissiveIntensity = .78;
    }
  }
  function prepare(source, spec, type) {
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
      garageFinish(material,type);
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
    const revision = type==='hypercar' ? '?v=2' : '';
    new THREE.GLTFLoader().load('assets/vehicles/'+files[type]+revision,gltf=>{
      try{success(prepare(gltf.scene,spec,type));}catch(error){failure(error);}
    },undefined,failure);
  }
  root.DriveVehicleAssets={load,prepare,files,credits};
})(typeof globalThis!=='undefined'?globalThis:this);
