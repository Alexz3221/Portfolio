/* Garage model credits and licenses are listed in /drive/credits.html. */
(function(root) {
  'use strict';
  const files = {comet:'passenger/comet.glb',rally:'garage/rally.glb',pickup:'garage/pickup.glb',hypercar:'garage/delorean.glb'};
  const credits = {comet:'Comrade1280 · CC BY 4.0',rally:'tevy · CC0',pickup:'Quaternius · CC0',hypercar:'cadwalader · CC BY 4.0'};
  const wheelNames = ['wheel-back-right','wheel-front-right','wheel-back-left','wheel-front-left'];
  const rustReady = {value:0};
  let rustTexture;

  function rustDetail() {
    if (rustTexture) return rustTexture;
    rustTexture = new THREE.TextureLoader().load('assets/vehicles/garage/rust-detail.webp',()=>{
      rustReady.value = 1;
    },undefined,()=>{ /* Keep the procedural grain when the texture cannot load. */ });
    rustTexture.wrapS = rustTexture.wrapT = THREE.RepeatWrapping;
    rustTexture.anisotropy = 4;
    rustTexture.encoding = THREE.LinearEncoding;
    return rustTexture;
  }

  function reflections(material, intensity) {
    const lighting = root.DrivePortfolioCar?.studioReflection?.(THREE);
    if (lighting) {
      material.envMap = lighting;
      material.envMapIntensity = intensity;
    }
    material.needsUpdate = true;
  }

  function weatheredMetal(material, pickup) {
    const texture = typeof document !== 'undefined' ? rustDetail() : null;
    material.extensions = {...material.extensions,derivatives:true};
    material.customProgramCacheKey = () => pickup ? 'garage-pickup-weathered-metal' : 'garage-rally-weathered-metal';
    material.onBeforeCompile = shader => {
      shader.uniforms.garageRust = {value:texture};
      shader.uniforms.garageRustReady = rustReady;
      const inputs = `varying vec3 vehiclePoint; varying vec3 vehicleNormal;\n`;
      shader.vertexShader = inputs+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        // The fitted shell's vertices are in chassis metres, independent of UV islands and wheel pivots.
        vehiclePoint = position;
        vehicleNormal = normal;`);
      const noise = `
        uniform sampler2D garageRust;
        uniform float garageRustReady;
        float grainAt(vec3 p) {
          p = fract(p * vec3(.1031,.11369,.13787));
          p += dot(p,p.yxz + 19.19);
          return fract((p.x+p.y)*p.z);
        }
        float patina(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f*f*(3.-2.*f);
          return mix(
            mix(mix(grainAt(i),grainAt(i+vec3(1,0,0)),f.x),
                mix(grainAt(i+vec3(0,1,0)),grainAt(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(grainAt(i+vec3(0,0,1)),grainAt(i+vec3(1,0,1)),f.x),
                mix(grainAt(i+vec3(0,1,1)),grainAt(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
        float swatch(vec3 color, vec3 chip) {
          return 1.-smoothstep(.022,.075,length(color-chip));
        }
      `;
      shader.fragmentShader = inputs+noise+shader.fragmentShader;
      const atlas = pickup
        ? THREE.ShaderChunk.map_fragment.replace('diffuseColor *= texelColor;',`
          vehiclePalette = texelColor.rgb;
          diffuseColor *= texelColor;`)
        : '#include <map_fragment>';
      const panel = pickup ? `
        // Source atlas chips identify the stamped body panels, existing cage tubes and safety stripes.
        float enamel = smoothstep(.065,.21,vehiclePalette.b-vehiclePalette.r) * smoothstep(.09,.17,vehiclePalette.g);
        float cage = clamp(swatch(vehiclePalette,vec3(.342,.171,.012)) + swatch(vehiclePalette,vec3(.591,.376,.002))
                          + swatch(vehiclePalette,vec3(.402,.242,.037))*.75,0.,1.);
        float tape = swatch(vehiclePalette,vec3(.342,.058,.002));
        float chrome = smoothstep(.16,.47,value)*(1.-max(cage,tape));
        float steel = clamp(.29 + enamel*.55 + chrome*.45,0.,1.);
        float painted = max(enamel,chrome);
        vec3 brushed = mix(vec3(.022,.031,.039),vec3(.170,.217,.240),sqrt(value)*.92);
        diffuseColor.rgb = mix(diffuseColor.rgb,brushed,clamp(.55+painted*.42,0.,1.));
      ` : `
        float enamel=1., cage=0., tape=0.;
        float steel=.83, painted=1.;
      `;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',`
        vec3 vehiclePalette = diffuseColor.rgb;
        ${atlas}
        float value = clamp(dot(vehiclePalette,vec3(.2126,.7152,.0722)),0.,1.);
        ${panel}
        vec3 p = vehiclePoint;
        vec3 weights = abs(normalize(vehicleNormal));
        weights *= weights;
        weights *= weights;
        weights /= max(.01,weights.x+weights.y+weights.z);
        vec4 sampleRust =
            texture2D(garageRust,p.zy*.91+vec2(.37,.82))*weights.x
          + texture2D(garageRust,p.xz*.91+vec2(.05,.28))*weights.y
          + texture2D(garageRust,p.xy*.91+vec2(.65,.41))*weights.z;
        float broad = patina(p*vec3(2.7,2.2,2.0)+vec3(6.2,3.4,10.8));
        float fleck = patina(p*vec3(12.7,16.9,12.1)+vec3(1.2,4.5,6.3));
        float fine = patina(p*vec3(54.,105.,39.));
        float lower = 1.-smoothstep(.52,1.28,p.y);
        float extremity = smoothstep(1.2,2.72,abs(p.z));
        float outward = smoothstep(.57,1.13,abs(p.x));
        float rustDistribution = broad*.61 + fleck*.20 + fine*.13 + lower*.14 + extremity*.13 + outward*.03;
        float corrosion = smoothstep(${pickup ? '.57,.77' : '.81,1.02'},rustDistribution)
          * (1.-max(cage,tape)*.85) * (${pickup ? '.68+.32*painted' : '.64'});
        float scar = smoothstep(.53,.83,patina(p*vec3(19.,106.,3.8))) * (.075+.34*lower) * steel;
        vec3 oxide = mix(vec3(.047,.016,.008),vec3(.192,.071,.026),fleck*.68+fine*.32);
        oxide = mix(oxide,pow(sampleRust.rgb,vec3(2.2))*vec3(1.18,.92,.74),garageRustReady*.80);
        diffuseColor.rgb = mix(diffuseColor.rgb,oxide,corrosion);
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.29,.35,.36),scar*.52*(1.-corrosion));
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.016,.26,.32),cage*.91);
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.28,.51,.025),tape*.97);
        float rustRoughness = mix(.82,sampleRust.a,garageRustReady);
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        float cleanFinish = mix(roughnessFactor,.205+.18*fleck,steel);
        roughnessFactor = mix(cleanFinish,.67+.31*rustRoughness,corrosion);
        roughnessFactor = mix(roughnessFactor,.31,max(cage,tape));`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
        metalnessFactor = mix(mix(metalnessFactor,.84,steel),.078,corrosion);
        metalnessFactor = mix(metalnessFactor,.28,max(cage,tape));`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        float pitHeight = (mix(fine,sampleRust.r,garageRustReady) - .5) * corrosion + scar*.08;
        vec3 surfaceX = dFdx(-vViewPosition), surfaceY = dFdy(-vViewPosition);
        vec3 tangentX = cross(surfaceY,normal), tangentY = cross(normal,surfaceX);
        float surfaceArea = dot(surfaceX,tangentX);
        vec3 pit = sign(surfaceArea) * (dFdx(pitHeight)*tangentX + dFdy(pitHeight)*tangentY);
        normal = normalize(max(.000001,abs(surfaceArea))*normal-pit*.009);`);
      if (pickup) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          float outerStrip = smoothstep(.65,1.36,p.y);
          totalEmissiveRadiance += vec3(.012,.56,.73)*cage*(.53+.57*outerStrip);
          totalEmissiveRadiance += vec3(.47,.73,.027)*tape*.64;`);
      }
    };
  }

  function deloreanBrakeLenses(material) {
    // The original atlas also contains the side markers, headlamps and the plate.
    // Vary only the red cells on the rear of the chassis.
    material.customProgramCacheKey = () => 'garage-delorean-brake-atlas';
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying float lampChassisZ;\n'+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n lampChassisZ = position.z;');
      shader.fragmentShader = 'varying float lampChassisZ;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>', `
        #ifdef USE_EMISSIVEMAP
          vec3 authoredLight = emissiveMapTexelToLinear(texture2D(emissiveMap,vUv)).rgb;
          float redLensColumns = smoothstep(.107,.122,vUv.x)*(1.-smoothstep(.280,.293,vUv.x));
          float lensRows = smoothstep(.534,.551,vUv.y)*(1.-smoothstep(.719,.737,vUv.y));
          float rear = 1.-smoothstep(-2.05,-1.9,lampChassisZ);
          totalEmissiveRadiance = authoredLight * mix(vec3(1.),totalEmissiveRadiance,rear*redLensColumns*lensRows);
        #endif
      `);
    };
    material.emissiveIntensity = .22;
    material.needsUpdate = true;
  }

  function garageFinish(material, type) {
    const key = material.name;
    if (type==='rally') {
      if (/^(paint_body|livery_blue|rim_machined|mirror_glass|chrome)/.test(key)) {
        reflections(material,.97);
        material.metalness = .43;
        material.roughness = .28;
      }
      if (key==='paint_body') {
        material.color.setHex(0xb9c9ca).convertSRGBToLinear();
        weatheredMetal(material,false);
      }
      if (key.startsWith('livery_blue')) {
        material.color.setHex(0x087e94).convertSRGBToLinear();
        material.emissive.setHex(0x09657d).convertSRGBToLinear();
        material.emissiveIntensity=.26;
      }
      if (/^light_front/.test(key)) {
        material.emissive.setHex(0xb5edff).convertSRGBToLinear();
        material.emissiveIntensity = .63;
      }
    }
    if (type==='pickup' && key==='Headlights') {
      material.color.setHex(0xbef8e9).convertSRGBToLinear();
      material.emissive.setHex(0xbef8e9).convertSRGBToLinear();
      material.emissiveIntensity = .89;
    }
    if (type==='hypercar' && key==='DeLorean') {
      reflections(material,.76);
      material.metalness = .58;
      material.roughness = .36;
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
        if(type==='hypercar' && material.name==='Lighting__Vrm' && material.emissiveMap) brakeMaterials.add(material);
      }
    });
    materials.forEach(material=>{
      // Keep the source's body, glass, wheel and optics textures/materials.
      for(const texture of Object.values(material)) if(texture?.isTexture) texture.anisotropy=4;
      garageFinish(material,type);
    });
    if (type==='hypercar') brakeMaterials.forEach(deloreanBrakeLenses);
    // Pickup paint and wheels share a palette texture. Give only the shell
    // its own finish so the wheels retain their source rubber and rim colors.
    const pickupAtlas = type==='pickup' && [...materials].find(material=>material.name==='Atlas');
    const pickupShell = pickupAtlas ? pickupAtlas.clone() : null;
    if (pickupShell) {
      reflections(pickupShell,1.48);
      pickupShell.metalness = .57;
      pickupShell.roughness = .37;
      weatheredMetal(pickupShell,true);
    }
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
      const material = mesh.material === pickupAtlas ? pickupShell : mesh.material;
      const copy=new THREE.Mesh(geometry,material);
      copy.castShadow=copy.receiveShadow=true; body.add(copy);
    });
    const originals=new Set();source.traverse(mesh=>{if(mesh.geometry)originals.add(mesh.geometry);});
    originals.forEach(geometry=>geometry.dispose());
    return {body,wheels,brakeMaterials:[...brakeMaterials],rearLamp:[...brakeMaterials][0]};
  }
  function load(type,spec,success,failure) {
    if(!THREE.GLTFLoader){failure(new Error('Vehicle loader unavailable'));return;}
    const revision = type==='hypercar' ? '?v=3' : '';
    new THREE.GLTFLoader().load('assets/vehicles/'+files[type]+revision,gltf=>{
      try{success(prepare(gltf.scene,spec,type));}catch(error){failure(error);}
    },undefined,failure);
  }
  root.DriveVehicleAssets={load,prepare,files,credits};
})(typeof globalThis!=='undefined'?globalThis:this);
