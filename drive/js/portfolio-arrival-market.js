(function(root, factory) {
  const arrival = factory();
  if (typeof module === 'object' && module.exports) module.exports = arrival;
  else root.DrivePortfolioArrivalMarket = arrival;
})(globalThis, function() {
  'use strict';

  function texture(THREE,width,height,draw) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'),width,height);
    const map = new THREE.CanvasTexture(canvas);
    map.encoding = THREE.sRGBEncoding;
    map.anisotropy = 4;
    return map;
  }

  function canopyTexture(THREE) {
    return texture(THREE,256,256,(ctx,w,h)=>{
      ctx.fillStyle = '#964a39';
      ctx.fillRect(0,0,w,h);
      for (const x of [5,36,117,198,234]) {
        ctx.fillStyle = '#da9d69';
        ctx.fillRect(x,0,x===117 ? 20 : 13,h);
      }
      let seed=759;
      for (let i=0;i<1900;i++) {
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        const x=seed%256, y=(seed>>>11)%256;
        ctx.fillStyle=i%3 ? 'rgba(34,15,17,.13)' : 'rgba(255,213,172,.19)';
        ctx.fillRect(x,y,i%2+1,i%5 ? 1 : 4);
      }
      for (const y of [5,250]) {
        ctx.fillStyle = '#d1a78a';
        for (let x=3;x<w;x+=5) ctx.fillRect(x,y,3,1);
      }
    });
  }

  function labelTexture(THREE,kind) {
    const blade = kind==='blade', menu = kind==='menu';
    return texture(THREE,blade ? 256 : 512,blade ? 256 : 256,(ctx,w,h)=>{
      ctx.fillStyle = blade ? '#462334' : '#2e2429';
      ctx.fillRect(0,0,w,h);
      ctx.lineWidth = blade ? 6 : 4;
      ctx.strokeStyle = '#ffc990';
      ctx.strokeRect(10,10,w-20,h-20);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffdcaa';
      if (blade) {
        ctx.font = '900 54px system-ui, sans-serif';
        ctx.fillText('HOT',w*.50,84);
        ctx.fillText('DUMPLINGS',w*.50,137,w-34);
        ctx.fillStyle = '#ff9779';
        ctx.font = '700 40px ui-monospace, monospace';
        ctx.fillText('OPEN',w*.50,214);
      } else if (menu) {
        ctx.font = '900 61px system-ui, sans-serif';
        ctx.fillText('LUCKY STEAM',w*.50,81,w-48);
        ctx.fillStyle = '#ff9a77';
        ctx.fillRect(34,105,w-68,3);
        ctx.font = '700 29px ui-monospace, monospace';
        ctx.fillStyle = '#fff1cc';
        ctx.fillText('PORK & GINGER',w*.50,151);
        ctx.fillText('MUSHROOM & CHIVE',w*.50,193);
        ctx.font = '700 18px ui-monospace, monospace';
        ctx.fillText('CHILI CRISP · JASMINE TEA',w*.50,223);
      } else {
        ctx.font = '900 64px system-ui, sans-serif';
        ctx.fillText('TEA / CITRUS',w*.50,143,w-48);
      }
    });
  }

  function geometryForAwning(THREE) {
    const roof = new THREE.PlaneGeometry(4.88,2.44,16,6);
    const vertices = roof.attributes.position;
    for (let i=0;i<vertices.count;i++) {
      const s = vertices.getY(i);
      const x = vertices.getX(i);
      const sag = Math.cos(x*1.25)*.048;
      vertices.setXYZ(i,x,2.96+s*.212-sag,-s);
    }
    roof.computeVertexNormals();
    return roof;
  }

  function addSteam(THREE,stall) {
    const points = [], phases = [];
    for (const x of [.29,.87,1.46]) for (let i=0;i<7;i++) {
      points.push(x+(i%3-1)*.045,1.19+(i%2)*.036,.46+i*.018);
      phases.push(i*.147+x*.16);
    }
    const cloud = new THREE.BufferGeometry();
    cloud.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    cloud.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));
    const material = new THREE.ShaderMaterial({
      uniforms:{age:{value:0}},transparent:true,depthWrite:false,
      vertexShader:`
        attribute float phase;
        uniform float age;
        varying float strength;
        void main() {
          float life = fract(phase + age * .29);
          vec3 p = position;
          p.x += sin(life * 6.28 + phase * 8.) * life * .23;
          p.y += life * .98;
          p.z += life * .36;
          vec4 eye = modelViewMatrix * vec4(p,1.);
          gl_Position = projectionMatrix * eye;
          gl_PointSize = clamp((83. + life * 170.) / max(3.,-eye.z),2.,85.);
          strength = smoothstep(0.,.18,life) * (1.-smoothstep(.28,1.,life)) * .20;
        }`,
      fragmentShader:`
        varying float strength;
        void main() {
          float radial = 1.-smoothstep(.03,.50,length(gl_PointCoord-.50));
          gl_FragColor = vec4(.84,.75,.66,radial*radial*strength);
        }`
    });
    const steam = new THREE.Points(cloud,material);
    steam.name = 'portfolio-arrival-steam';
    steam.frustumCulled = false;
    stall.add(steam);
    return material.uniforms.age;
  }

  function addCounterSpill(THREE,stall) {
    const geometry = new THREE.PlaneGeometry(4.75,2.65);
    geometry.rotateX(-Math.PI/2);
    const material = new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`
        varying vec2 corner;
        void main() {
          corner = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
        }`,
      fragmentShader:`
        varying vec2 corner;
        void main() {
          float glow = 1. - smoothstep(.07,.99,length((corner-.5)*2.));
          gl_FragColor = vec4(.71,.41,.21,.32*glow*glow);
        }`
    });
    const spill = new THREE.Mesh(geometry,material);
    spill.position.set(0,.014,.55);
    stall.add(spill);
  }

  function attach(THREE,world,{reducedMotion=false}={}) {
    const root = new THREE.Group();
    root.name = 'portfolio-arrival-market';
    const pavement = (x,z)=>globalThis.DrivePortfolioArrivalSidewalks?.surfaceHeight(x,z) ?? .17;
    const stall = new THREE.Group();
    stall.name = 'portfolio-arrival-dumplings';
    stall.position.set(11.10,pavement(11.10,-86.05),-86.05);
    stall.rotation.y = -Math.PI/2-.30;
    root.add(stall);
    const cart = new THREE.Group();
    cart.name = 'portfolio-arrival-tea-cart';
    cart.position.set(11.94,pavement(11.94,-89.36),-89.36);
    cart.rotation.y = -Math.PI/2;
    root.add(cart);

    const cube = new THREE.BoxGeometry(1,1,1);
    const cylinder = new THREE.CylinderGeometry(.5,.5,1,14);
    const bead = new THREE.SphereGeometry(.5,8,5);
    const thread = new THREE.TorusGeometry(.5,.063,6,18);
    thread.rotateX(Math.PI/2);
    const materials = {
      solid:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.76,metalness:.11}),
      steel:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.43,metalness:.38}),
      light:new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false})
    };
    const shapes = {cube,cylinder,bead,thread};
    const batches = new Map();
    const transform = new THREE.Object3D();
    root.updateMatrixWorld(true);

    function part(group,name,shape,x,y,z,w,h,d,tint,rx=0,ry=0,rz=0) {
      const key = name+'-'+shape;
      if (!batches.has(key)) batches.set(key,{name,shape,list:[]});
      transform.position.set(x,y,z);
      transform.rotation.set(rx,ry,rz);
      transform.scale.set(w,h,d);
      transform.updateMatrix();
      batches.get(key).list.push({
        matrix:transform.matrix.clone().premultiply(group.matrixWorld),
        tint:new THREE.Color(tint).convertSRGBToLinear()
      });
    }
    const stand = (x,y,z,w,h,d,c)=>part(stall,'solid','cube',x,y,z,w,h,d,c);
    const metal = (x,y,z,w,h,d,c)=>part(stall,'steel','cube',x,y,z,w,h,d,c);
    const light = (x,y,z,w,h,d,c)=>part(stall,'light','cube',x,y,z,w,h,d,c);
    const cartBoard = (x,y,z,w,h,d,c)=>part(cart,'solid','cube',x,y,z,w,h,d,c);

    // The cook's opening is clear through the canopy frame. Waste and storage
    // sit under the ledge, leaving a standing strip in front of the counter.
    stand(0,.51,.74,4.39,1.02,.64,0x51383a);
    stand(0,1.036,.73,4.55,.128,.81,0x8e7260);
    for (let i=0;i<9;i++) stand(-1.98+i*.50,.55,1.07,.037,.81,.035,0x845752);
    stand(0,.16,1.05,4.42,.17,.081,0x867064);
    metal(0,.93,1.052,4.47,.07,.078,0x5e6264);
    stand(0,1.92,-1.01,4.20,1.38,.11,0x493437);
    for (let i=0;i<7;i++) stand(-1.76+i*.58,1.91,-.94,.033,1.31,.026,0x86675b);
    for (const x of [-2.27,2.27]) for (const z of [-1.06,1.07]) {
      const y=z<0 ? 3.07 : 2.67;
      metal(x,y*.48,z,.098,y*.96,.098,0x6e6c67);
      metal(x,.068,z,.22,.135,.21,0x777568);
    }
    metal(0,2.70,1.08,4.70,.17,.13,0x693b39);
    metal(0,3.08,-1.055,4.69,.079,.10,0x6e6c67);
    light(-.91,2.62,.88,1.65,.063,.081,0xffc991);
    light(.92,2.62,.88,1.65,.063,.081,0xffc991);
    const canopy = new THREE.Mesh(geometryForAwning(THREE),new THREE.MeshStandardMaterial({
      color:0xe7b8a4,map:canopyTexture(THREE),roughness:.91,side:THREE.DoubleSide
    }));
    canopy.name = 'portfolio-arrival-market-canopy';
    stall.add(canopy);
    for (let i=0;i<14;i++) stand(-2.24+i*.345,2.67,1.207,.305,.19+(i%2)*.034,.042,i%4===0?0xaf7252:0x884a3d);

    // Three sizes of real stacking bamboo baskets and small plated dumplings.
    for (const [i,x] of [.29,.87,1.46].entries()) {
      const size=.46+i*.028;
      part(stall,'solid','cylinder',x,1.157,.57,size,.185,size,0x8e6241);
      part(stall,'solid','thread',x,1.235,.57,size,.34,size,0xc39960);
      part(stall,'solid','thread',x,1.112,.57,size*.97,.26,size*.97,0xb0854d);
      for (let k=0;k<4;k++) {
        const r=.109;
        const angle=k*Math.PI/2+i*.27;
        part(stall,'solid','bead',x+Math.cos(angle)*r,1.248+(k%2)*.018,.57+Math.sin(angle)*r,
          .141,.108,.111,k%2 ? 0xfad1a9 : 0xe9be96,0,angle);
      }
    }
    for (const [i,x] of [-1.43,-1.20,-.96,-.73].entries()) {
      part(stall,'solid','cylinder',x,1.19,.63,.173,.263,.175,[0xa84f46,0xd0984d,0x72683b,0x99796e][i]);
      part(stall,'steel','cylinder',x,1.343,.63,.18,.045,.18,0xb19a86);
      stand(x,1.217,.721,.114,.085,.011,0xdfb28e);
    }
    part(stall,'steel','cylinder',-1.87,1.269,-.20,.39,.39,.39,0x8c7e68);
    part(stall,'steel','cylinder',-1.87,1.477,-.20,.28,.065,.28,0xb89c84);
    for (const [i,x] of [-1.54,-.95].entries()) {
      stand(x,1.35,-.765,.45,.312,.27,i%2 ? 0x526a5a : 0x6c5260);
      stand(x,1.367,-.61,.30,.095,.015,0xd1b49a);
    }
    for (const x of [-1.32,.16]) {
      part(stall,'steel','cylinder',x,.277,1.504,.20,.522,.20,0x534a4b);
      part(stall,'steel','cylinder',x,.083,1.504,.364,.135,.364,0x534a4b);
      part(stall,'solid','cylinder',x,.559,1.504,.43,.105,.43,0x955849);
    }
    stand(2.1,.215,1.36,.46,.40,.51,0x65604e);
    stand(2.1,.423,1.36,.44,.054,.51,0x786b55);
    for (const x of [1.98,2.2]) stand(x,.45,1.36,.038,.021,.47,0x988069);

    const panelGeometry=cube.clone();
    panelGeometry.clearGroups();
    panelGeometry.addGroup(0,24,0);
    panelGeometry.addGroup(24,12,1);
    const cabinet = new THREE.MeshStandardMaterial({color:0x59373b,roughness:.60,metalness:.24});
    function sign(group,id,kind,x,y,z,w,h,d,yaw=0,audit=true) {
      const plate = new THREE.Mesh(panelGeometry,[cabinet,new THREE.MeshBasicMaterial({
        color:0xffffff,map:labelTexture(THREE,kind),toneMapped:false
      })]);
      plate.name = 'portfolio-arrival-market-'+id;
      plate.position.set(x,y,z);
      plate.scale.set(w,h,d);
      plate.rotation.y = yaw;
      if (audit) {
        plate.userData.portfolioAdFace = true;
        plate.userData.portfolioAdId = 'arrival-'+id;
      }
      group.add(plate);
    }
    sign(stall,'menu','menu',.85,2.04,-.856,2.27,1.09,.12);
    metal(-2.29,2.29,1.86,.105,.095,1.66,0x746153);
    sign(stall,'blade','blade',-2.38,2.26,2.75,1.08,1.05,.118,-Math.PI/2);
    light(-2.46,1.727,2.75,.06,.047,.94,0xffbd86);

    cartBoard(0,.665,0,.80,.74,1.06,0x4c6a60);
    cartBoard(0,1.061,0,.90,.085,1.15,0x7d6c5a);
    cartBoard(0,.26,0,.72,.095,1.11,0x746455);
    cartBoard(0,1.145,-.12,.72,.14,.60,0x826d55);
    for (const x of [-.40,.40]) part(cart,'steel','cylinder',x,.214,.15,.42,.12,.42,0x42464c,0,0,Math.PI/2);
    for (let i=0;i<9;i++) part(cart,'solid','bead',(i%3-1)*.216,1.255,-.28+Math.floor(i/3)*.166,
      .156,.149,.150,i%3 ? 0xd09d52 : 0xbb7655);
    part(cart,'steel','cylinder',.24,1.237,.353,.196,.36,.196,0xb1a194);
    part(cart,'steel','cylinder',.24,1.435,.353,.153,.045,.153,0x5e6265);
    sign(cart,'tea-sign','tea',0,.774,.572,.682,.347,.067,0,false);

    for (const [key,{name,shape,list}] of batches) {
      const mesh = new THREE.InstancedMesh(shapes[shape],materials[name],list.length);
      mesh.name = 'portfolio-arrival-market-'+key;
      for (const [index,{matrix,tint}] of list.entries()) {
        mesh.setMatrixAt(index,matrix);
        mesh.setColorAt(index,tint);
      }
      mesh.instanceMatrix.needsUpdate = true;
      root.add(mesh);
    }
    const age = addSteam(THREE,stall);
    addCounterSpill(THREE,stall);
    world.add(root);
    let disposed=false;
    return {
      update(delta) { if (!disposed && !reducedMotion) age.value += delta; },
      dispose() {
        if (disposed) return;
        disposed=true;
        world.remove(root);
        const geometries = new Set(), used = new Set(), maps = new Set();
        root.traverse(object=>{
          if (object.geometry) geometries.add(object.geometry);
          if (object.material) for (const material of [].concat(object.material)) {
            used.add(material);
            if (material.map) maps.add(material.map);
          }
        });
        for (const map of maps) map.dispose();
        for (const material of used) material.dispose();
        for (const geometry of geometries) geometry.dispose();
      }
    };
  }

  return {attach};
});
