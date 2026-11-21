(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePortfolioCorporateAds = api;
})(globalThis, function () {
  'use strict';

  const assetBase = typeof document !== 'undefined' && document.currentScript?.src
    ? new URL('../assets/portfolio-ads/', document.currentScript.src).href
    : 'assets/portfolio-ads/';
  const campaigns = {
    farline: {brand:'FARLINE', unit:'NIGHT SHIFT TRANSIT', line:['Get your time', 'back.'], cta:'UPGRADE YOUR RIDE', color:'#83f4de', glyph:0},
    relay: {brand:'RELAY', unit:'CONSUMER CREDIT', line:['Start living', 'today.'], cta:'CHECK YOUR CREDIT', color:'#ff8ab7', glyph:1, poster:true},
    morrow: {brand:'MORROW', unit:'PRIORITY GRID', line:['Come home', 'to light.'], cta:'GET PRIORITY POWER', color:'#ffc080', glyph:2},
    sublight: {brand:'SUBLIGHT', unit:'WORKER CLEARANCE', line:['Go where you', 'belong.'], cta:'BUY EXPRESS CLEARANCE', color:'#ff887a', glyph:3, poster:true},
    ion: {brand:'ION', unit:'ESSENTIALS PLAN', line:['A better life,', 'delivered.'], cta:'SUBSCRIBE', color:'#bbf2a2', glyph:4},
    oxide: {brand:'OXIDE', unit:'VEHICLE RECERTIFICATION', line:['Feel new', 'again.'], cta:'BOOK A RECERTIFICATION', color:'#c6a0ff', glyph:5},
    afterimage: {brand:'AFTERIMAGE', unit:'EMPLOYER REST SYSTEMS', line:['Wake up like', 'yourself.'], cta:'BUY A REST PASS', color:'#e2b4fb', glyph:6, poster:true},
    zenith: {brand:'ZENITH', unit:'MEMBER UNDERWRITING', line:['Breathe a little', 'easier.'], cta:'UPGRADE YOUR COVER', color:'#f4d894', glyph:7},
    meridian: {brand:'MERIDIAN', unit:'OCCUPATIONAL RECOVERY', line:['Get back to the', 'life you love.'], cta:'BOOK PRIORITY RECOVERY', color:'#a8f3fb', glyph:8}
  };

  function drawGlyph(ctx, x, y, scale, glyph) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(scale,scale);
    ctx.lineWidth = .069;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'bevel';
    ctx.beginPath();
    const symbols = [
      [[-.39,-.24],[.32,-.24],[.32,.28],[.08,.28],[-.33,.03],[.47,.03]],
      [[-.4,.29],[-.25,-.32],[-.04,.28],[.17,-.32],[.37,.29]],
      [[-.33,.26],[-.33,-.13],[0,-.34],[.33,-.13],[.33,.26],[0,.06],[-.33,.26]],
      [[-.40,-.28],[.31,-.28],[-.21,.28],[.40,.28]],
      [[-.34,-.30],[.36,-.30],[.36,.30],[-.34,.30],[-.34,-.30],[.18,.30]],
      [[-.37,0],[0,-.36],[.37,0],[0,.36],[-.37,0],[.37,0]],
      [[-.31,.29],[-.31,-.31],[.08,-.31],[.36,-.03],[.36,.29],[-.03,.29],[-.31,.05],[.16,.05]],
      [[-.38,.29],[0,-.35],[.38,.29],[-.14,.29],[.03,.02],[.20,.29]],
      [[-.34,.29],[-.34,-.29],[.34,.29],[.34,-.29],[-.34,.29]]
    ];
    for (const [index,[u,v]] of symbols[glyph].entries()) {
      if (index===0) ctx.moveTo(u,v);
      else ctx.lineTo(u,v);
    }
    ctx.stroke();
    ctx.restore();
  }

  function artworkLayout(displayAspect, campaign, artShare, airborne) {
    const wide=displayAspect>1.25;
    const share=artShare>0 ? Math.min(.48,artShare) : airborne ? .34 : campaign.poster ? .47 : 0;
    const poster=wide && share>0;
    const w=wide ? 1024 : 512, h=wide ? 512 : 1024;
    const scaleX=displayAspect*h/w;
    const edge=.048*w, gap=.043*w;
    const artY=(poster ? .052 : wide ? .078 : .137)*h;
    const artH=(poster ? .896 : wide ? .844 : .590)*h;
    const artW=poster ? share*w : wide ? Math.min(.37*w,artH*.94/scaleX) : w-2*edge;
    const artRight=wide && campaign.glyph%3===1;
    const artX=artRight ? w-edge-artW : edge;
    const copyX=wide && !artRight ? edge+artW+gap : edge;
    const copyW=w-2*edge-(wide ? artW+gap : 0);
    return {w,h,wide,poster,scaleX,gap,artX,artY,artW,artH,copyX,copyW,airborne:wide && airborne};
  }

  function printArtwork(canvas, campaign, layout, image) {
    const ctx=canvas.getContext('2d');
    const {w,h,wide,poster,scaleX,gap,artX,artY,artW,artH,copyX,copyW,airborne}=layout;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#0c223b42';
    ctx.fillRect(0,0,w,h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(artX,artY,artW,artH);
    ctx.clip();
    if (image) {
      // Fit the image in display proportions, despite the mip-friendly canvas aspect.
      const scale=Math.max(artW*scaleX/image.width,artH/image.height);
      const sw=image.width*scale/scaleX, sh=image.height*scale;
      ctx.drawImage(image,artX+(artW-sw)*.5,artY+(artH-sh)*(poster ? .34 : .45),sw,sh);
    } else {
      const centerX=artX+artW*.5, centerY=artY+artH*.5;
      const hue = ctx.createRadialGradient(centerX,centerY,.07*artW,centerX,centerY,.99*artW);
      hue.addColorStop(0,campaign.color+'78');
      hue.addColorStop(1,'#0b1922');
      ctx.fillStyle = hue;
      ctx.fillRect(artX,artY,artW,artH);
      ctx.strokeStyle=campaign.color;
      drawGlyph(ctx,centerX,centerY,artW*.62,campaign.glyph);
    }
    const bottom=artY+artH;
    const glaze=ctx.createLinearGradient(0,artY,0,bottom);
    glaze.addColorStop(0,'#08131d30');
    glaze.addColorStop(.68,'#08131d00');
    glaze.addColorStop(1,'#08131d56');
    ctx.fillStyle=glaze;
    ctx.fillRect(artX,artY,artW,artH);
    ctx.restore();

    function type(value,x,y,size,weight,spec,maxWidth) {
      ctx.save();
      ctx.translate(x,y);
      ctx.scale(1/scaleX,1);
      ctx.font=weight+' '+size+'px '+spec;
      ctx.textBaseline='middle';
      ctx.fillText(value,0,0,maxWidth*scaleX);
      ctx.restore();
    }

    const sans='system-ui, sans-serif', mono='ui-monospace, monospace';
    const wordY=wide ? .156*h : .061*h;
    const unitY=wide ? (airborne ? .265 : .290)*h : .118*h;
    const glyphW=Math.min(copyW*.14,.112*h/scaleX);
    const textX=copyX+glyphW+gap*.55;
    ctx.fillStyle=campaign.color;
    ctx.strokeStyle=campaign.color;
    drawGlyph(ctx,copyX+glyphW*.48,wordY,glyphW,campaign.glyph);
    type(campaign.brand,textX,wordY,wide?70:61,900,sans,copyX+copyW-textX);
    ctx.fillRect(copyX,(airborne ? .216 : wide ? .242 : .099)*h,copyW,3);
    type(campaign.unit,copyX,unitY,wide?25:24,700,mono,copyW);

    if (!wide) ctx.fillRect(copyX,.744*h,copyW,3);
    ctx.fillStyle='#e8f6f4';
    const headlineSize=airborne ? 145 : wide ? 78 : 66;
    type(campaign.line[0],copyX,(airborne ? .467 : wide ? .517 : .799)*h,headlineSize,850,sans,copyW);
    type(campaign.line[1],copyX,(airborne ? .710 : wide ? .685 : .861)*h,headlineSize,850,sans,copyW);

    const ctaY=(airborne ? .924 : wide ? .890 : .947)*h, ctaH=airborne ? 44 : wide ? 53 : 58;
    const ctaW=Math.min(copyW, (wide ? 52 : 46)+campaign.cta.length*(wide?15.5:15)/scaleX);
    ctx.fillStyle=campaign.color+'33';
    ctx.fillRect(copyX,ctaY-ctaH*.5,ctaW,ctaH);
    ctx.strokeStyle=campaign.color;
    ctx.lineWidth=2;
    ctx.strokeRect(copyX+1,ctaY-ctaH*.5,ctaW-2,ctaH);
    ctx.fillStyle=campaign.color;
    type(campaign.cta,copyX+15/scaleX,ctaY,wide?24:23,800,mono,ctaW-49/scaleX);
    ctx.beginPath();
    ctx.moveTo(copyX+ctaW-24/scaleX,ctaY-7);
    ctx.lineTo(copyX+ctaW-15/scaleX,ctaY);
    ctx.lineTo(copyX+ctaW-24/scaleX,ctaY+7);
    ctx.stroke();
  }

  function projectionMaterial(THREE, map, clock, color, phase, layout, reducedMotion) {
    const uniforms=THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
    const {w,h,artX,artY,artW,artH}=layout;
    const artBay=new THREE.Vector4(artX/w,1-(artY+artH)/h,artW/w,artH/h);
    Object.assign(uniforms,{
      art:{value:map},clock,accent:{value:color},phase:{value:phase},
      artBay:{value:artBay},motion:{value:reducedMotion ? 0 : 1}
    });
    return new THREE.ShaderMaterial({
      uniforms, transparent:true, depthWrite:false, fog:true, side:THREE.DoubleSide,
      toneMapped:false, extensions:{derivatives:true},
      vertexShader:`
        varying vec2 panel;
        #include <fog_pars_vertex>
        void main() {
          panel=uv;
          vec4 mvPosition=modelViewMatrix*vec4(position,1.);
          gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`
        varying vec2 panel;
        uniform sampler2D art;
        uniform vec3 accent;
        uniform vec4 artBay;
        uniform float clock, phase, motion;
        #include <fog_pars_fragment>
        void main() {
          vec2 p=vec2(gl_FrontFacing ? panel.x : 1.-panel.x,panel.y);
          vec4 artwork=texture2D(art,p);
          vec2 photo=(p-artBay.xy)/artBay.zw;
          float inside=min(min(photo.x,1.-photo.x),min(photo.y,1.-photo.y));
          // Ease the image under its fixed crop. The atlas outside this
          // region, including the type, never gets a time-dependent sample.
          float photoMask=smoothstep(.0,.014+fwidth(inside),inside)*motion;
          if (motion>0.) {
            float time=clock*.148+phase*6.283185;
            float crop=.891+.022*cos(time*.83);
            vec2 drift=vec2(.024*sin(time*.74),.026*cos(time*.93));
            vec2 framed=clamp(.5+(photo-.5)*crop+drift,.005,.995);
            artwork=mix(artwork,texture2D(art,artBay.xy+framed*artBay.zw),photoMask);
          }
          vec3 ink=pow(artwork.rgb,vec3(2.2));
          float outputLight=max(ink.r,max(ink.g,ink.b));
          float edge=min(min(p.x,1.-p.x),min(p.y,1.-p.y));
          float edgeAA=max(fwidth(edge),.001);
          float envelope=smoothstep(.002,.011+edgeAA,edge);
          float margin=smoothstep(.008,.015,edge)*(1.-smoothstep(.016,.024+edgeAA,edge));
          float row=p.y*156.;
          float stripes=.972+.028*cos(row*6.283185)*(1.-smoothstep(.04,.33,fwidth(row)));
          float pass=fract(clock*.105+phase);
          float sweep=(1.-smoothstep(.0,.125,abs(p.y-pass)))*smoothstep(0.,.14,pass)*smoothstep(0.,.14,1.-pass);
          float sparkle=(.019+.034*sweep*photoMask)*smoothstep(.025,.28,outputLight);
          vec3 color=ink*stripes*1.06+accent*(.013+sparkle+.26*margin);
          float alpha=.11+artwork.a*mix(.46,.88,smoothstep(.018,.44,outputLight));
          gl_FragColor=vec4(color,envelope*max(alpha,.56*margin));
          #include <encodings_fragment>
          #include <fog_fragment>
        }`
    });
  }

  function curvedGlass(THREE,width,height) {
    const glass=new THREE.PlaneGeometry(width,height,14,1);
    const position=glass.attributes.position;
    for (let i=0;i<position.count;i++) {
      const span=position.getX(i)/(width*.5);
      position.setZ(i,.14*(1-span*span));
    }
    glass.computeBoundingSphere();
    return glass;
  }

  function createCampaignDisplay(THREE,id,{displayAspect=2.6,clock,artShare,airborne=false,reducedMotion=false}={}) {
    const campaign=campaigns[id];
    if (!campaign) return null;
    const time=clock || {value:0};
    const layout=artworkLayout(displayAspect,campaign,artShare,airborne);
    const color=new THREE.Color(campaign.color).convertSRGBToLinear();
    const canvas=typeof document==='undefined' ? null : document.createElement('canvas');
    if (canvas) {
      canvas.width=layout.w;
      canvas.height=layout.h;
      printArtwork(canvas,campaign,layout);
    }
    const map=canvas ? new THREE.CanvasTexture(canvas) :
      new THREE.DataTexture(new Uint8Array([13,23,32,255]),1,1);
    map.name='portfolio-corporate-art-'+id;
    map.encoding=THREE.sRGBEncoding;
    map.anisotropy=4;
    map.needsUpdate=true;

    let disposed=false;
    const ready=canvas ? new Promise(resolve=>{
      new THREE.ImageLoader().load(assetBase+id+'.webp?v=2',image=>{
        if (!disposed) {
          printArtwork(canvas,campaign,layout,image);
          map.needsUpdate=true;
        }
        resolve(!disposed);
      },undefined,()=>resolve(false));
    }) : Promise.resolve(false);
    const material=projectionMaterial(THREE,map,time,color,campaign.glyph*.113,layout,reducedMotion);

    return {
      material,ready,
      update(delta) {
        if (!disposed && !clock && !reducedMotion && Number.isFinite(delta) && delta>0) time.value+=delta;
      },
      dispose() {
        if (disposed) return;
        disposed=true;
        map.dispose();
        material.dispose();
      }
    };
  }

  function attach(THREE,world,{reducedMotion=false}={}) {
    const placements=globalThis.DrivePortfolioCorporateAdPlacements || [];
    const group=new THREE.Group();
    group.name='portfolio-corporate-ads';
    const clock={value:0};
    const displays=[];
    const supports=[], lamps=[], rays=[], rayColors=[];
    const pose=new THREE.Object3D(), desk=new THREE.Object3D();
    let disposed=false;

    function part(list, reference, color, x,y,z,w,h,d) {
      pose.position.set(x,y,z);
      pose.scale.set(w,h,d);
      pose.updateMatrix();
      list.push({matrix:pose.matrix.clone().premultiply(reference.matrix),color});
    }

    for (const {id,x,y,z,width,height,heading,mount,artShare} of placements) {
      const campaignDisplay=createCampaignDisplay(THREE,id,{displayAspect:width/height,clock,artShare,reducedMotion});
      if (!campaignDisplay) continue;
      displays.push(campaignDisplay);
      const accent=campaignDisplay.material.uniforms.accent.value;
      const structure=new THREE.Group();
      structure.name='portfolio-corporate-ad-'+id;
      structure.position.set(x,y,z);
      structure.rotation.y=heading;
      structure.updateMatrix();
      group.add(structure);

      const display=new THREE.Mesh(curvedGlass(THREE,width,height),campaignDisplay.material);
      display.name='portfolio-corporate-projection-'+id;
      display.userData.portfolioAdFace=true;
      display.userData.portfolioAdId='corporate-'+id;
      structure.add(display);

      const borderX=width*.5+.13, borderY=height*.5+.13;
      const edgeWidth=Math.min(.92,width*.12), edgeHeight=Math.min(1.4,height*.10);
      for (const side of [-1,1]) for (const end of [-1,1]) {
        part(supports,structure,0x385154,side*(borderX-edgeWidth*.5),end*borderY,0,edgeWidth,.068,.13);
        part(supports,structure,0x385154,side*borderX,end*(borderY-edgeHeight*.5),0,.066,edgeHeight,.13);
        part(lamps,structure,accent,side*(borderX-.31*edgeWidth),end*(borderY+.045),0,edgeWidth*.55,.035,.15);
        part(lamps,structure,accent,side*(borderX+.043),end*(borderY-.28*edgeHeight),0,.034,edgeHeight*.48,.15);
      }

      if (!mount) continue;
      desk.position.set(mount.x,mount.y,mount.z);
      desk.rotation.y=mount.heading ?? heading;
      desk.updateMatrix();
      part(supports,desk,0x34434a,0,0,0,1.46,.48,.57);
      part(supports,desk,0x4e514c,0,-.267,0,1.57,.14,.65);
      part(supports,desk,0x3d4a4c,0,-.065,-.391,1.15,.25,.19);
      for(const side of [-1,1]) {
        part(supports,desk,0x526369,side*.65,0,0,.23,.56,.61);
        part(supports,desk,0x24333a,side*.68,-.375,0,.22,.19,.27);
        part(lamps,desk,accent,0,.13,side*.303,1.00,.041,.025);
      }
      const nearestEdge=(mount.y>y ? 1 : -1)*height*.5;
      for (const offset of [-.43,-.19,.19,.43]) {
        const start=new THREE.Vector3(offset,mount.y>y ? -.26 : .25,0).applyMatrix4(desk.matrix);
        const end=new THREE.Vector3(offset*width,nearestEdge,.07).applyMatrix4(structure.matrix);
        const falloff=1/Math.sqrt(1+.048*start.distanceTo(end));
        rays.push(start,end);
        rayColors.push(accent.r*falloff,accent.g*falloff,accent.b*falloff,
          accent.r*.47*falloff,accent.g*.47*falloff,accent.b*.47*falloff);
      }
    }

    const box=new THREE.BoxGeometry(1,1,1);
    function batch(parts, material, name) {
      const mesh=new THREE.InstancedMesh(box,material,parts.length);
      mesh.name=name;
      for (const [i,{matrix,color}] of parts.entries()) {
        mesh.setMatrixAt(i,matrix);
        mesh.setColorAt(i,color.isColor ? color : new THREE.Color(color).convertSRGBToLinear());
      }
      mesh.instanceMatrix.needsUpdate=true;
      group.add(mesh);
    }
    if (supports.length) {
      batch(supports,new THREE.MeshStandardMaterial({color:0xffffff,metalness:.49,roughness:.57}),'portfolio-corporate-emitters');
      batch(lamps,new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),'portfolio-corporate-edge-lights');
    } else box.dispose();
    if (rays.length) {
      const lines=new THREE.BufferGeometry().setFromPoints(rays);
      lines.setAttribute('color',new THREE.Float32BufferAttribute(rayColors,3));
      const glow=new THREE.LineSegments(lines,new THREE.LineBasicMaterial({
        vertexColors:true,transparent:true,opacity:.36,depthWrite:false,toneMapped:false
      }));
      glow.name='portfolio-corporate-carrier-beams';
      group.add(glow);
    }
    world.add(group);

    return {
      ready:Promise.all(displays.map(display=>display.ready)),
      update(delta) {
        if (!disposed && !reducedMotion && Number.isFinite(delta) && delta>0) clock.value+=delta;
      },
      dispose() {
        if (disposed) return;
        disposed=true;
        world.remove(group);
        const geometries=new Set(), materials=new Set();
        group.traverse(object=>{
          if (object.geometry) geometries.add(object.geometry);
          if (object.material) materials.add(object.material);
        });
        for (const display of displays) {
          materials.delete(display.material);
          display.dispose();
        }
        for (const geometry of geometries) geometry.dispose();
        for (const material of materials) material.dispose();
        group.clear();
      }
    };
  }

  return {attach,createCampaignDisplay};
});
