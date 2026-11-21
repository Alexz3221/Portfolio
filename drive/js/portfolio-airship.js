(function(root) {
  'use strict';

  const radiusX=128, radiusZ=117, altitude=92, speed=.0105;
  const halfLength=17.5, halfBeam=5, halfHeight=5.8;

  function makeAdvert(THREE) {
    const canvas=document.createElement('canvas');
    canvas.width=1024;
    canvas.height=256;
    const ctx=canvas.getContext('2d');
    const gradient=ctx.createLinearGradient(0,0,1024,256);
    gradient.addColorStop(0,'#183541');
    gradient.addColorStop(.52,'#0c1b27');
    gradient.addColorStop(.53,'#362322');
    gradient.addColorStop(1,'#302321');
    ctx.fillStyle=gradient;
    ctx.fillRect(0,0,1024,256);
    ctx.strokeStyle='#74e6d8';
    ctx.lineWidth=7;
    ctx.strokeRect(8,9,1008,238);
    ctx.fillStyle='#ec9b65';
    ctx.fillRect(556,10,4,237);
    for (let y=23;y<244;y+=6) {
      ctx.fillStyle='#15131e66';
      ctx.fillRect(13,y,998,1);
    }
    ctx.font='900 86px system-ui, sans-serif';
    ctx.fillStyle='#b1fff3';
    ctx.fillText('FARLINE',41,129,480);
    ctx.fillStyle='#ffc58d';
    ctx.fillText('MORROW',585,129,400);
    ctx.font='600 31px ui-monospace, monospace';
    ctx.fillStyle='#b1fff3';
    ctx.fillText('NIGHT SERVICE',44,179);
    ctx.fillStyle='#ffc58d';
    ctx.fillText('POWER & LIGHT',588,179);
    for (let x=40;x<987;x+=29) {
      ctx.fillStyle=x<552?'#57acb0':'#da7945';
      ctx.fillRect(x,210,16,7);
    }
    const map=new THREE.CanvasTexture(canvas);
    map.encoding=THREE.sRGBEncoding;
    map.anisotropy=4;
    return map;
  }

  function adPanel(THREE, side) {
    const geometry=new THREE.PlaneGeometry(24.4,5.6,22,9);
    const positions=geometry.attributes.position;
    for (let i=0;i<positions.count;i++) {
      const z=-side*positions.getX(i), y=positions.getY(i)-1.0;
      const profile=Math.max(0,1-(z/halfLength)**2-(y/halfHeight)**2);
      const x=side*(halfBeam*Math.sqrt(profile)+.12);
      positions.setXYZ(i,x,y,z);
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  function attach(THREE, world, {reducedMotion} = {}) {
    const craft=new THREE.Group();
    craft.name='portfolio-ad-blimp';
    const shell=new THREE.MeshStandardMaterial({color:0x35484e,roughness:.51,metalness:.42,vertexColors:true});
    const hardware=new THREE.MeshStandardMaterial({color:0x494846,roughness:.63,metalness:.46});
    const plate=new THREE.MeshStandardMaterial({color:0x273238,roughness:.61,metalness:.16});
    const cyan=new THREE.MeshBasicMaterial({color:0x84eadb,toneMapped:false});
    const amber=new THREE.MeshBasicMaterial({color:0xfabb80,toneMapped:false});
    const red=new THREE.MeshBasicMaterial({color:0xfd684b,toneMapped:false});
    const sphere=new THREE.SphereGeometry(1,40,24);
    const skin=sphere.clone();
    const vertices=skin.attributes.position, colors=[];
    for (let i=0;i<vertices.count;i++) {
      const x=vertices.getX(i), y=vertices.getY(i), z=vertices.getZ(i);
      const strip=Math.cos(Math.atan2(y,x)*16);
      const band=Math.cos(z*20*Math.PI);
      const shade=.83+.125*strip-.19*(band>.94)+.11*Math.sin(x*18+y*23+z*45);
      colors.push(shade+.047,shade,shade-.022);
    }
    skin.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const box=new THREE.BoxGeometry(1,1,1);
    function part(geometry,material,x,y,z,w,h,d) {
      const mesh=new THREE.Mesh(geometry,material);
      mesh.position.set(x,y,z);
      mesh.scale.set(w,h,d);
      craft.add(mesh);
      return mesh;
    }
    part(skin,shell,0,0,0,halfBeam,halfHeight,halfLength);
    part(sphere,hardware,0,-5.35,2.5,1.63,1.6,5.5);
    part(sphere,plate,0,-6.25,2.75,1.46,1.05,4.6);
    part(box,cyan,0,-7.04,2.2,1.55,.12,5.1);

    if (typeof document!=='undefined') {
      const displays=new THREE.MeshBasicMaterial({map:makeAdvert(THREE),toneMapped:false});
      for (const side of [-1,1]) {
        part(adPanel(THREE,side),displays,0,0,0,1,1,1).name='portfolio-blimp-ad';
      }
    }
    for (const side of [-1,1]) {
      part(box,hardware,side*3.12,-3.9,-6.25,3.45,.36,1.34).rotation.z=-side*.34;
      part(sphere,hardware,side*4.65,-4.12,-6.16,.84,.94,2.29);
      part(sphere,plate,side*4.65,-4.12,-7.9,.64,.78,.75);
      part(box,amber,side*5.31,-4.18,-6.15,.13,.24,1.57);
      part(box,cyan,side*4.24,-3.91,3.0,.13,.18,7.2);
      part(box,hardware,side*2.9,0,-13.9,4.7,.22,2.85).rotation.y=side*.34;
      part(box,amber,side*4.61,0,-14.75,.14,.22,.75);
      for (let i=0;i<5;i++) part(box,cyan,side*1.34,-6.15,4.59-i*1.11,.115,.27,.78);
    }
    part(sphere,hardware,0,3.05,-13.81,.29,2.91,2.88).rotation.x=.33;
    part(sphere,hardware,0,-2.97,-13.81,.28,2.63,2.74).rotation.x=-.33;
    part(box,red,0,5.82,-14.65,.21,.28,.75);
    part(sphere,cyan,0,.01,17.51,.36,.36,.22);

    let phase=Math.PI*.34;
    function update(delta=0) {
      if(!reducedMotion) phase=(phase+delta*speed)%(2*Math.PI);
      craft.position.set(radiusX*Math.cos(phase),altitude+3*Math.sin(phase*3),radiusZ*Math.sin(phase));
      craft.rotation.set(.023*Math.sin(phase*3),Math.atan2(-radiusX*Math.sin(phase),radiusZ*Math.cos(phase)),.047,'YXZ');
    }
    update();
    world.add(craft);
    return {update};
  }

  root.DrivePortfolioAirship={attach};
})(globalThis);
