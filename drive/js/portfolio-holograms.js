(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePortfolioHolograms = api;
})(globalThis, function () {
  'use strict';

  let fontRequest;
  function font(THREE) {
    fontRequest ||= fetch('assets/portfolio-type/display.json').then(response => {
      if (!response.ok) throw new Error('Portfolio sign font is unavailable');
      return response.json();
    }).then(data => new THREE.Font(data)).catch(error => { fontRequest = null; throw error; });
    return fontRequest;
  }

  const businesses = [
    {name:'MORROW GRID', message:'POWER AFTER HOURS', color:'#ff785c', dark:'#310e18', mark:'grid'},
    {name:'FARLINE', message:'NIGHT SERVICE', color:'#7ef6ed', dark:'#0a262a', mark:'rail'},
    {name:'RELAY BANK', message:'WINDOW 04 / OPEN', color:'#f3bc74', dark:'#302219', mark:'grid'},
    {name:'OXIDE', message:'REPAIR TERMINAL', color:'#d1a2ff', dark:'#261435', mark:'rail'},
    {name:'ION MARKET', message:'FOOD / PARTS / GOODS', color:'#ff8fc3', dark:'#321124', mark:'grid'},
    {name:'SUBLIGHT', message:'VEHICLE SYSTEMS', color:'#95bcff', dark:'#131936', mark:'rail'}
  ];

  function adTexture(THREE, design, width, height) {
    const signs = globalThis.DrivePortfolioSignText;
    const {canvas,ctx} = signs.canvas(width,height,512,256);
    const fill = ctx.createLinearGradient(20, 15, 450, 256);
    fill.addColorStop(0, design.dark);
    fill.addColorStop(1, '#080914');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = design.color;
    ctx.globalAlpha = .23;
    ctx.lineWidth = 1;
    for (let y = 7; y < 256; y += 5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 488, 232);
    ctx.strokeRect(344, 28, 140, 198);
    ctx.fillStyle = design.color;
    ctx.globalAlpha = .8;
    for (let i = 0; i < 8; i++) {
      const x = 364 + (i % 4) * 27, y = 57 + Math.floor(i / 4) * 49;
      if (design.mark === 'grid') {
        ctx.beginPath();
        ctx.moveTo(x + 11, y); ctx.lineTo(x + 22, y + 17); ctx.lineTo(x + 8, y + 28); ctx.lineTo(x, y + 15); ctx.fill();
      } else {
        ctx.fillRect(x, y, 16, 3); ctx.fillRect(x + 8, y + 3, 8, 32);
      }
    }
    for (let i = 0; i < 12; i++) ctx.fillRect(360 + i * 10, 175, i % 3 === 0 ? 6 : 3, i % 2 ? 24 : 36);
    ctx.globalAlpha = 1;
    ctx.fillStyle = design.color;
    ctx.fillRect(31, 43, 282, 4);
    ctx.fillRect(31, 199, 282, 4);
    ctx.font = '900 65px system-ui, sans-serif';
    signs.text(ctx,design.name,26,144,306);
    ctx.font = '700 24px monospace';
    ctx.fillStyle = '#edf5ff';
    signs.text(ctx,design.message,32,180,282);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 4;
    return texture;
  }

  function block(THREE, group, geometry, material, x, y, z, width, height, depth) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    group.add(mesh);
    return mesh;
  }

  function displayGeometry(THREE) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.clearGroups();
    geometry.addGroup(0, 24, 0);
    geometry.addGroup(24, 12, 1);
    return geometry;
  }

  function addAdverts(THREE, world, adverts, box, cabinet, shell) {
    if (!adverts.length) return;
    const screens = new Map();
    const brackets = new THREE.InstancedMesh(box, shell, adverts.length * 2);
    brackets.name = 'portfolio-ad-brackets';
    const transform = new THREE.Object3D();
    for (const [index, {id,x,y,z,width,heading,height}] of adverts.entries()) {
      const mount = new THREE.Group();
      mount.name = 'portfolio-street-ad';
      mount.position.set(x,y,z);
      mount.rotation.y = heading;
      const h = height || width * .5;
      const design = businesses[index % businesses.length];
      const key = design.name + '-' + ((width+.18)/(h+.18)).toFixed(2);
      if (!screens.has(key)) screens.set(key,new THREE.MeshBasicMaterial({
        map:typeof document === 'undefined' ? null : adTexture(THREE,design,width+.18,h+.18),toneMapped:false
      }));
      const display = block(THREE, mount, cabinet, [shell,screens.get(key)], 0,0,0,width+.18,h+.18,.52);
      display.name = 'portfolio-ad-display';
      display.userData.portfolioAdFace = true;
      display.userData.portfolioAdId = id;
      // Bridge cabinets hang from the catwalk above. Wall cabinets sit on two rear brackets.
      const suspension = id === 'entry-ribs' ? 6.2 : id === 'arrival-bridge' ? 1.7 : 0;
      for (const [sideIndex, side] of [-1,1].entries()) {
        const offset = side * width * .38;
        const zOffset = suspension ? -1.06 : -.52;
        transform.position.set(x+offset*Math.cos(heading)+zOffset*Math.sin(heading),
          y+(suspension ? h/2+suspension/2-.16 : 0),
          z-offset*Math.sin(heading)+zOffset*Math.cos(heading));
        transform.rotation.y = heading;
        transform.scale.set(suspension ? .16 : .45, suspension || h*.76, suspension ? 2.1 : 1.14);
        transform.updateMatrix();
        brackets.setMatrixAt(index*2+sideIndex, transform.matrix);
      }
      world.add(mount);
    }
    world.add(brackets);
  }

  function addBackdrop(THREE, group, box, cabinet, shell, accent, loadTexture) {
    const image = loadTexture();
    image.repeat.set(1, .66);
    image.offset.set(0, .17);
    const art = new THREE.MeshBasicMaterial({map:image, color:0xe7e3e8, toneMapped:false});
    const screen = block(THREE, group, cabinet, [shell, art], 0,-.60,0,32,10.5,.68);
    screen.name = 'portfolio-district-display';
    screen.userData.portfolioAdFace = true;
    screen.userData.portfolioAdId = 'projects';
    for (const x of [-16.18,16.18]) {
      block(THREE, group, box, shell, x,-.60,-.05,.45,10.95,.89);
      block(THREE, group, box, accent, x,-.60,.405,.07,9.95,.08);
    }
    for (const y of [-5.95,4.77]) block(THREE, group, box, shell, 0,y,-.05,32.7,.25,.9);
  }

  function create(THREE, world, signs, {adverts = []} = {}) {
    const box = new THREE.BoxGeometry(1,1,1);
    const cabinet = displayGeometry(THREE);
    const shell = new THREE.MeshStandardMaterial({color:0x212634, metalness:.53, roughness:.46});
    addAdverts(THREE, world, adverts, box, cabinet, shell);
    const lettering = [];
    let disposed = false;
    function loadArtwork() {
      const image = new THREE.TextureLoader().load('assets/portfolio-type/district-display.webp', asset => {
        if (disposed) asset.dispose();
      });
      image.encoding = THREE.sRGBEncoding;
      image.anisotropy = 4;
      return image;
    }

    for (const {id,x,y,z,heading,width,color,label} of signs) {
      const projects = id === 'projects';
      const tint = new THREE.Color(color);
      const group = new THREE.Group();
      group.name = 'portfolio-hologram-' + id;
      group.position.set(x, y, z);
      group.rotation.y = heading;
      world.add(group);

      const face = new THREE.MeshBasicMaterial({color:tint, toneMapped:false});
      const lip = new THREE.MeshStandardMaterial({
        color:tint.clone().multiplyScalar(.44), emissive:tint, emissiveIntensity:.14, metalness:.32, roughness:.52
      });
      const labelY = projects ? 6.0 : 0;
      const railWidth = width + (projects ? 2.4 : .72);
      const rearZ = projects ? -6.7 : -.22;
      block(THREE, group, box, shell, 0,labelY,.02,railWidth,projects ? .90 : .50,.51);
      if (projects) {
        addBackdrop(THREE, group, box, cabinet, shell, face, loadArtwork);
        block(THREE, group, box, shell, 0,labelY,rearZ+.20,railWidth,.90,.45);
      } else {
        const postX = width*.52;
        const supports = id === 'about' ? [postX] : [-postX,postX];
        for (const post of supports) {
          block(THREE, group, box, shell, post,-y/2,.03,.32,y,.44);
          block(THREE, group, box, shell, post,-y+.16,.03,.58,.32,.72);
        }
        block(THREE, group, box, face, 0,-.34,.03,railWidth,.055,.42);
      }

      lettering.push(font(THREE).then(typeface => {
        if (disposed) { lip.dispose(); return; }
        const geometry = new THREE.TextGeometry(label.toUpperCase(), {font:typeface, size:1, height:.09,
          curveSegments:4, bevelEnabled:true, bevelThickness:.01, bevelSize:.011, bevelSegments:1});
        geometry.computeBoundingBox();
        const scale = width / Math.max(.1, geometry.boundingBox.max.x - geometry.boundingBox.min.x);
        const height = scale * (geometry.boundingBox.max.y - geometry.boundingBox.min.y);
        geometry.center();
        if (!projects) {
          // The opaque spine keeps the oppositely oriented words from showing
          // through each other's letter gaps as the driver circles the sign.
          block(THREE, group, box, shell, 0,labelY,.027,width+.48,height+.25,.49);
        }
        const letterDepth = .055 * scale;
        for (const side of [1,-1]) {
          const text = new THREE.Mesh(geometry, [face,lip]);
          text.name = side > 0 ? 'portfolio-sign-lettering-front' : 'portfolio-sign-lettering-rear';
          text.userData.portfolioAdFace = true;
          text.userData.portfolioAdId = id + (side > 0 ? '-label' : '-rear');
          text.position.set(0,labelY,side > 0 ? .28+letterDepth : rearZ-letterDepth);
          text.rotation.y = side > 0 ? 0 : Math.PI;
          text.scale.setScalar(scale);
          group.add(text);
        }
      }).catch(error => {
        lip.dispose();
        if (!disposed) console.warn('Could not build portfolio sign:', error);
      }));
    }
    return {ready:Promise.all(lettering), dispose() { disposed = true; }};
  }

  return {create};
});
