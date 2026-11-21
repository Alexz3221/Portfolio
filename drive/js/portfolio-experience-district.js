(function(root,factory) {
  const signText = typeof module === 'object' && module.exports
    ? require('./portfolio-sign-text') : root.DrivePortfolioSignText;
  const district=factory(signText);
  if (typeof module==='object' && module.exports) module.exports=district;
  else root.DrivePortfolioExperienceDistrict=district;
})(globalThis,function(signText) {
  'use strict';

  const cold=0x9bc8cf, dark=0x263642, edge=0x50616a, concrete=0x626b6d, oxidized=0x765847, copper=0xc18c59;
  const gateway={z:35.2,west:100.5,east:123.6};

  function attach(THREE,world,city,physics) {
    const group=new THREE.Group();
    group.name='portfolio-experience-district';
    const geometries=[], textures=[], labels=[], bodies=[];
    const parts={
      box:new THREE.BoxGeometry(1,1,1),
      cylinder:new THREE.CylinderGeometry(.5,.5,1,10)
    };
    geometries.push(...Object.values(parts));
    const sidewalks=globalThis.DrivePortfolioStreets;
    function level(x,z) { return sidewalks?.surfaceHeight(world,x,z) ?? 0; }
    function paved(x,z,w,d) {
      return [-1,1].every(side=>[-1,1].every(end=>level(x+side*w/2,z+end*d/2)>=.14));
    }
    const texture=world.getObjectByName('portfolio-curbs')?.material?.map || null;
    const finishes={
      concrete:new THREE.MeshStandardMaterial({color:0xffffff,map:texture,roughness:.92}),
      iron:new THREE.MeshStandardMaterial({color:0xffffff,metalness:.40,roughness:.69}),
      shine:new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false})
    };
    const Cannon=globalThis.CANNON;
    const ringX=city.stops.find(stop=>stop.id==='experience')?.x ?? 112;
    const pose=new THREE.Object3D(), origin=new THREE.Vector3(), end=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);
    function body(x,y,z,w,h,d) {
      if (!Cannon || !physics?.world) return;
      const collider=new Cannon.Body({mass:0,position:new Cannon.Vec3(x,y,z)});
      collider.addShape(new Cannon.Box(new Cannon.Vec3(w/2,h/2,d/2)));
      physics.world.addBody(collider);
      bodies.push(collider);
    }

    function section(name) {
      const owner=new THREE.Group();
      owner.name='portfolio-service-'+name;
      group.add(owner);
      const batches=new Map();
      function collect(shape,finish,color) {
        const key=shape+'-'+finish;
        if (!batches.has(key)) batches.set(key,{shape,finish,items:[]});
        pose.updateMatrix();
        batches.get(key).items.push({matrix:pose.matrix.clone(),color});
      }
      function part(shape,finish,color,x,y,z,w,h,d,roll=0) {
        pose.position.set(x,y,z);
        pose.scale.set(w,h,d);
        pose.rotation.set(0,0,roll);
        collect(shape,finish,color);
      }
      const box=(finish,color,...args)=>part('box',finish,color,...args);
      const light=(color,...args)=>box('shine',color,...args);
      function pipe(finish,color,from,to,diameter) {
        origin.fromArray(from);
        end.fromArray(to);
        pose.position.copy(origin).lerp(end,.5);
        end.sub(origin);
        pose.scale.set(diameter,end.length(),diameter);
        pose.quaternion.setFromUnitVectors(up,end.normalize());
        collect('cylinder',finish,color);
      }
      function render() {
        for (const [key,{shape,finish,items}] of batches) {
          const mesh=new THREE.InstancedMesh(parts[shape],finishes[finish],items.length);
          mesh.name=owner.name+'-'+key;
          for (const [index,{matrix,color}] of items.entries()) {
            mesh.setMatrixAt(index,matrix);
            mesh.setColorAt(index,new THREE.Color(color).convertSRGBToLinear());
          }
          mesh.receiveShadow=finish!=='shine';
          owner.add(mesh);
        }
      }
      return {owner,box,pipe,light,render};
    }

    function screenMaterial(faceWidth,faceHeight,width,height,draw) {
      if (typeof document==='undefined' || !signText) return finishes.shine;
      const {canvas,ctx}=signText.canvas(faceWidth,faceHeight,width,height);
      ctx.fillStyle='#18252f';
      ctx.fillRect(0,0,width,height);
      draw(ctx,width,height);
      const map=new THREE.CanvasTexture(canvas);
      map.encoding=THREE.sRGBEncoding;
      textures.push(map);
      const material=new THREE.MeshBasicMaterial({map,toneMapped:false});
      labels.push(material);
      return material;
    }

    function screen(owner,id,finish,{x,y,z,w,h,heading}) {
      const geometry=new THREE.PlaneGeometry(w,h);
      geometries.push(geometry);
      const sign=new THREE.Mesh(geometry,finish);
      sign.name='portfolio-service-display-'+id;
      sign.position.set(x,y,z);
      sign.rotation.y=heading;
      sign.userData.portfolioAdFace=true;
      sign.userData.portfolioAdId='service-'+id;
      owner.add(sign);
    }

    const {z,west,east}=gateway;
    if ([west,east].every(x=>paved(x,z,1.4,2.1))) {
      const {owner,box,light,pipe,render}=section('east-ring-gantry');
      const x=(west+east)/2;
      const span=east-west;
      for (const [i,pierX] of [west,east].entries()) {
        const y=level(pierX,z);
        const side=i===0 ? -1 : 1;
        box('concrete',concrete,pierX,y+.23,z,1.43,.45,2.1);
        box('iron',oxidized,pierX,3.47,z,1.02,6.52,1.28);
        box('iron',dark,pierX,4.79,z,.80,3.1,1.37);
        box('iron',dark,pierX,6.78,z,1.14,.57,1.58);
        box('iron',edge,pierX,3.36,z-.635,1.08,.21,.10);
        box('iron',edge,pierX,1.13,z,.84,1.42,1.42);
        light(cold,pierX,4.63,z-.691,.105,2.47,.045);
        light(cold,pierX,4.63,z+.691,.105,2.47,.045);
        pipe('iron',copper,[pierX+side*.61,.48,z-.28],[pierX+side*.61,5.79,z-.28],.12);
        pipe('iron',oxidized,[pierX+side*.65,.51,z+.24],[pierX+side*.65,3.92,z+.24],.11);
        box('iron',oxidized,pierX,7.10,z,1.47,.27,1.7);
        body(pierX,(y+7.11)/2,z,1.16,7.11-y,1.66);
      }
      // Clean cladding and cool signal strips sit over the old rusted beam.
      box('iron',oxidized,x,6.85,z,span+1.39,.52,1.48);
      box('iron',dark,x,7.25,z,span+1.22,.48,1.15);
      light(cold,x,7.12,z-.599,span-1.2,.052,.062);
      light(cold,x,7.12,z+.599,span-1.2,.052,.062);
      box('iron',edge,x,8.11,z,14.3,1.28,.54);
      box('iron',dark,x,8.11,z,14.06,1.13,.68);
      for (const off of [-9.8,9.8]) {
        box('iron',dark,x+off,7.66,z,2.86,.71,.72);
        light(copper,x+off,7.60,z-.385,1.59,.065,.056);
        light(copper,x+off,7.60,z+.385,1.59,.065,.056);
      }
      const width=13.76, height=1.037;
      const face=screenMaterial(width,height,1024,148,(ctx,w,h)=>{
        ctx.fillStyle='#899a9d';
        ctx.fillRect(0,10,w,4);
        ctx.fillRect(0,h-14,w,4);
        ctx.textAlign='center';
        ctx.fillStyle='#beedf2';
        ctx.font='800 69px system-ui,sans-serif';
        signText.text(ctx,'SERVICE DISTRICT',w/2,86,935);
        ctx.fillStyle='#e9b782';
        ctx.font='700 27px monospace';
        signText.text(ctx,'EAST RING / EXPERIENCE',w/2,122,935);
      });
      screen(owner,'gantry-north',face,{x,y:8.11,z:z-.357,w:width,h:height,heading:Math.PI});
      screen(owner,'gantry-south',face,{x,y:8.11,z:z+.357,w:width,h:height,heading:0});
      render();
    }

    const tenants=globalThis.DrivePortfolioDistricts?.sites?.filter(site=>site.sectionId==='experience') || [];
    const directoryX=94.55,directoryZ=34.25;
    if (tenants.length && paved(directoryX,directoryZ,.9,3.75)) {
      const {owner,box,light,render}=section('company-directory');
      const base=level(directoryX,directoryZ);
      box('concrete',concrete,directoryX,base+.17,directoryZ,1.08,.34,3.82);
      box('iron',oxidized,directoryX,base+1.53,directoryZ,.62,2.81,3.24);
      box('iron',dark,directoryX+.31,base+1.78,directoryZ,.12,2.36,3.20);
      light(cold,directoryX+.38,base+3.06,directoryZ,.08,.045,3.16);
      const width=2.95, height=2.13;
      const face=screenMaterial(width,height,528,384,(ctx,w)=>{
        ctx.fillStyle='#bde7ed';
        ctx.font='800 39px system-ui,sans-serif';
        signText.text(ctx,'TOWER DIRECTORY',25,56,w-48);
        ctx.strokeStyle='#7a929c';
        ctx.beginPath();
        ctx.moveTo(25,74); ctx.lineTo(w-25,74); ctx.stroke();
        for (const [i,tenant] of tenants.entries()) {
          const row=113+i*51;
          ctx.fillStyle='#dfe7e8';
          ctx.font='700 32px system-ui,sans-serif';
          signText.text(ctx,tenant.title,48,row,w-78);
          ctx.fillStyle='#d8a574';
          ctx.fillRect(27,row-19,7,14);
        }
      });
      screen(owner,'directory',face,{x:directoryX+.379,y:base+1.78,z:directoryZ,w:width,h:height,heading:Math.PI/2});
      body(directoryX,base+1.42,directoryZ,.87,2.84,3.42);
      render();
    }

    const {box,pipe,light,render}=section('utility-court');
    const rx=90.9,rz=41.2;
    if (paved(rx,rz,3.4,6.55)) {
      const y=level(rx,rz);
      box('concrete',concrete,rx,y+.14,rz,3.42,.28,6.49);
      box('iron',oxidized,rx,y+.75,rz+.55,2.32,1.14,4.32);
      box('iron',dark,rx+.66,y+.84,rz+.55,1.11,.83,3.9);
      for (let i=0;i<10;i++) box('iron',edge,rx+1.24,y+.86,rz-1.12+i*.365,.063,.57,.103);
      for (const off of [-1,0,1]) {
        const x=rx+off*.68;
        const height=y+(off+2)*.13+1.64;
        pipe('iron',oxidized,[x,y+.57,rz-1.57],[x,height,rz-1.57],.25);
        pipe('iron',copper,[x,height,rz-1.57],[x,height,rz+1.86],.21);
        pipe('iron',edge,[x,height,rz+1.86],[x,y+1.08,rz+1.86],.25);
        pipe('iron',edge,[x-.14,height,rz-.72],[x+.14,height,rz-.72],.3);
      }
      box('iron',dark,rx+1.29,y+.92,rz-2.17,.60,1.35,1.12);
      light(copper,rx+1.618,y+1.13,rz-2.17,.038,.07,.42);
      light(cold,rx+1.618,y+1.37,rz-2.17,.038,.183,.46);
      body(rx,y+.72,rz,3.27,1.44,5.75);
    }
    for (const bench of [[95.9,45.4],[97.5,32.4]]) {
      const [x,z]=bench;
      if (!paved(x,z,2.68,1.02)) continue;
      const y=level(x,z);
      for (const side of [-1,1]) box('concrete',concrete,x+side*.92,y+.23,z,.26,.46,.63);
      box('iron',oxidized,x,y+.48,z,2.56,.18,.72);
      box('iron',dark,x,y+.70,z-.30,2.56,.30,.13);
      body(x,y+.37,z,2.57,.74,.78);
    }
    render();

    const bands=section('paving-bands');
    // Inlaid inspection channels follow viable pavement on the east ring.
    for (const x of [101.12,122.44]) {
      for (let z=-66;z<44;z+=5) {
        if (!paved(x,z,.66,2.72)) continue;
        const y=level(x,z);
        bands.box('iron',dark,x,y+.019,z,.64,.026,2.63);
        bands.box('iron',oxidized,x-.23,y+.035,z,.09,.027,2.55);
        const inner=x<ringX ? .23 : -.23;
        bands.light(cold,x+inner,y+.037,z,.057,.025,2.28);
        for (const end of [-1,1]) bands.box('iron',edge,x,y+.039,z+end*1.239,.57,.044,.11);
      }
    }
    bands.render();
    world.add(group);
    return {dispose() {
      world.remove(group);
      geometries.forEach(geometry=>geometry.dispose());
      textures.forEach(map=>map.dispose());
      Object.values(finishes).forEach(material=>material.dispose());
      labels.forEach(material=>material.dispose());
      for (const collider of bodies) physics.world.removeBody(collider);
    }};
  }

  return {attach};
});
