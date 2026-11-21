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

  function adTexture(THREE, design) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
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
    let size = 78;
    do { ctx.font = '900 ' + size-- + 'px system-ui, sans-serif'; } while (size > 28 && ctx.measureText(design.name).width > 302);
    ctx.fillText(design.name, 26, 144, 306);
    ctx.font = '700 20px monospace';
    ctx.fillStyle = '#edf5ff';
    ctx.fillText(design.message, 32, 180, 282);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function haloTexture(THREE) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const halo = ctx.createRadialGradient(32,32,0,32,32,32);
    halo.addColorStop(0,'rgba(255,255,255,.7)');
    halo.addColorStop(.34,'rgba(255,255,255,.37)');
    halo.addColorStop(.65,'rgba(255,255,255,.08)');
    halo.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(canvas);
  }

  function addAdverts(THREE, world, adverts) {
    if (!adverts.length || typeof document === 'undefined') return;
    const shell = new THREE.MeshStandardMaterial({color:0x212634, metalness:.66, roughness:.43});
    const box = new THREE.BoxGeometry(1, 1, 1);
    const plane = new THREE.PlaneGeometry(1, 1);
    const glow = haloTexture(THREE);
    const screens = businesses.map(design => new THREE.MeshBasicMaterial({map:adTexture(THREE, design), toneMapped:false, fog:true}));
    const glows = businesses.map(design => new THREE.SpriteMaterial({map:glow, color:design.color, opacity:.26,
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false}));
    for (const [index, {x,y,z,width,heading,height}] of adverts.entries()) {
      const mount = new THREE.Group();
      mount.name = 'portfolio-street-ad';
      mount.position.set(x,y,z);
      mount.rotation.y = heading;
      const backing = new THREE.Mesh(box, shell);
      const h = height || width * .5;
      backing.scale.set(width+.22, h+.22, .35);
      mount.add(backing);
      const sign = new THREE.Mesh(plane, screens[index % screens.length]);
      sign.scale.set(width, h, 1);
      sign.position.z = .18;
      mount.add(sign);
      const halo = new THREE.Sprite(glows[index % glows.length]);
      halo.position.z = .27;
      halo.scale.set(width * 1.46, h * 1.8, 1);
      mount.add(halo);
      world.add(mount);
    }
  }

  function create(THREE, world, signs, {reducedMotion = false, adverts = []} = {}) {
    addAdverts(THREE, world, adverts);
    const clock = {value:0};
    const pictures = [];
    let disposed = false;
    const entries = signs.map((sign, index) => {
      const {id, x, y, z, heading, width, color, label} = sign;
      const hero = id === 'projects';
      const tint = new THREE.Color(color).convertSRGBToLinear();
      const group = new THREE.Group();
      group.name = 'portfolio-hologram-' + id;
      group.position.set(x, y, z);
      group.rotation.y = heading;
      world.add(group);

      const letters = new THREE.Group();
      letters.position.y = hero ? width * .175 : 0;
      letters.position.z = .15;
      group.add(letters);

      const border = new THREE.LineBasicMaterial({color:tint, toneMapped:false, transparent:true, opacity:.72});
      const extentX = width * .56, extentY = hero ? width * .105 : width * .105 + .36;
      const ticks = [];
      for (const xx of [-extentX, extentX]) for (const yy of [-extentY, extentY]) {
        const sx = -Math.sign(xx), sy = -Math.sign(yy);
        ticks.push(xx + sx * 1.1, yy, -.25, xx, yy, -.25, xx, yy, -.25, xx, yy + sy * .56, -.25);
      }
      const frame = new THREE.BufferGeometry();
      frame.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
      letters.add(new THREE.LineSegments(frame, border));

      if (hero) {
        const image = new THREE.TextureLoader().load('assets/portfolio-type/district-display.webp', asset => {
          if (disposed) asset.dispose();
          else artwork.uniforms.ready.value = 1;
        });
        pictures.push(image);
        const artwork = new THREE.ShaderMaterial({
          toneMapped:false,
          uniforms:{picture:{value:image}, tick:clock, ready:{value:0}},
          vertexShader:`varying vec2 texcoord; void main(){ texcoord=uv;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
          fragmentShader:`varying vec2 texcoord; uniform float tick, ready; uniform sampler2D picture;
            void main(){
              vec2 p=texcoord;
              float offset=sin(p.y*300.+tick*1.65)*.0011;
              p=vec2(p.x+offset, (p.y-.5)*.69+.5);
              vec3 art=texture2D(picture,p).rgb;
              vec3 grain=vec3(.036,.054,.078)*(1.+.24*sin(texcoord.y*220.+tick*.6));
              vec3 rgb=mix(grain,pow(art,vec3(2.05))*.82,ready);
              float scan=.89+.11*sin(texcoord.y*820.);
              float edge=smoothstep(.0,.06,texcoord.x)*smoothstep(.0,.06,1.-texcoord.x);
              gl_FragColor=vec4(rgb*scan*mix(.54,1.,edge),1.);
              #include <encodings_fragment>
            }`
        });
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.04, width * .36), artwork);
        screen.name = 'portfolio-district-display';
        screen.position.set(0, -width * .055, -.68);
        group.add(screen);
        const glowImage = haloTexture(THREE);
        pictures.push(glowImage);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({map:glowImage, color:0xff4155, opacity:.32,
          transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false}));
        halo.position.copy(screen.position);
        halo.position.z += .1;
        halo.scale.set(width * 1.7, width * .66, 1);
        group.add(halo);
      }

      const front = new THREE.ShaderMaterial({
        uniforms:{tick:clock, color:{value:tint}}, toneMapped:false,
        vertexShader:`varying vec3 letter; void main(){letter=position;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`varying vec3 letter; uniform vec3 color; uniform float tick;
          void main(){
            float line=.90+.10*sin(letter.y*245.);
            float pulse=.80+.20*pow(.5+.5*sin(letter.y*14.-tick*1.4),5.);
            gl_FragColor=vec4(mix(color,vec3(.83,.94,.98),.32)*line*pulse,1.);
            #include <encodings_fragment>
          }`
      });
      const side = new THREE.MeshBasicMaterial({color:tint.clone().multiplyScalar(.36), toneMapped:false});
      const wire = new THREE.MeshBasicMaterial({color:tint, toneMapped:false, transparent:true, opacity:.21, depthWrite:false});
      font(THREE).then(face => {
        if (disposed) { front.dispose(); side.dispose(); wire.dispose(); return; }
        const geometry = new THREE.TextGeometry(label.toUpperCase(), {font:face, size:1, height:.125,
          curveSegments:5, bevelEnabled:true, bevelThickness:.011, bevelSize:.012, bevelSegments:1});
        geometry.computeBoundingBox();
        const scale = width / Math.max(.1, geometry.boundingBox.max.x - geometry.boundingBox.min.x);
        geometry.center();
        const text = new THREE.Mesh(geometry, [front, side]);
        text.scale.setScalar(scale);
        letters.add(text);
        const echo = new THREE.Mesh(geometry, wire);
        echo.position.set(.10, -.04, -scale * .17);
        echo.scale.copy(text.scale);
        letters.add(echo);
      }).catch(error => {
        front.dispose(); side.dispose(); wire.dispose();
        if (!disposed) console.warn('Could not build portfolio sign:', error);
      });
      return {letters, base:letters.position.y, phase:index * .86};
    });

    function update(delta) {
      if (reducedMotion) return;
      clock.value += delta;
      for (const {letters, base, phase} of entries) {
        letters.position.y = base + .12 * Math.sin(clock.value * .83 + phase);
      }
    }

    function dispose() {
      disposed = true;
      pictures.forEach(image => image.dispose());
    }
    return {update, dispose};
  }

  return {create};
});
