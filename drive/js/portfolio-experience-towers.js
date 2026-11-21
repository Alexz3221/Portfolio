(function(root,factory) {
  const towers=factory();
  if (typeof module==='object' && module.exports) module.exports=towers;
  else root.DrivePortfolioExperienceTowers=towers;
})(globalThis,function() {
  'use strict';

  const assetBase=typeof document!=='undefined' && document.currentScript?.src
    ? new URL('../assets/portfolio/',document.currentScript.src).href : 'assets/portfolio/';
  const west=-Math.PI/2;
  const clipped=[[-.74,-1],[-1,-.63],[-1,.63],[-.74,1],[.74,1],[1,.63],[1,-.63],[.74,-1]];
  const wedge=[[-.24,-1],[-1,-.32],[-1,.45],[-.46,1],[.43,1],[1,.52],[1,-.49],[.61,-1]];
  const kiln=Array.from({length:16},(_,i)=>[-Math.sin(i*Math.PI/8),-Math.cos(i*Math.PI/8)]);
  const plans=[
    {id:'spectrum',title:'SPECTRUM',caption:'BROADCAST & MODEL LAB',x:133.3,z:-30.4,heading:west,
      base:[0,0,16.8,15.2,0,12.7],tone:0x394954,trim:0x70818b,ink:0x8bf1fc,
      work:spectrum},
    {id:'rtx-raytheon',title:'RTX / RAYTHEON',caption:'SYSTEMS DEPOT',x:139,z:19,heading:west,
      base:[0,0,21.7,19.1,0,11.4],tone:0x48454b,trim:0x706769,ink:0xffb091,
      work:rtx},
    {id:'google',title:'GOOGLE',caption:'EVENT SYSTEMS / EVALUATION',x:83,z:15,heading:Math.PI,
      base:[0,0,30,21,0,8.9],tone:0x344452,trim:0x687b85,ink:0xb2eccd,
      work:google},
    {id:'coorstek',title:'COORSTEK',caption:'MATERIALS FOUNDRY',x:130,z:-60,heading:west,
      base:[1.55,0,11.8,25,0,10.6],tone:0x604940,trim:0x86745e,ink:0xffba74,
      work:coorstek},
    {id:'rocket-software',title:'ROCKET SOFTWARE',caption:'DATASET ARCHIVES',x:129,z:1.2,heading:west,
      base:[1,0,8.7,12.6,0,15.5],tone:0x464757,trim:0x676775,ink:0xcabbfc,
      work:rocket}
  ];

  // Coordinates are local to each parcel. Major portions generate matching
  // solid bounds for the sidewalk layout, car physics, and camera constraints.
  const volume=(site,x,z,width,depth,baseY,height)=>({x:site.x+x,z:site.z+z,width,depth,baseY,height});
  const parcels=plans.map(site=>volume(site,...site.base));
  const shapes=plans.map(site=>{
    const parts=[], bounds=[], panels=[];
    const palette={body:site.tone, steel:site.trim, lit:site.ink, soot:0x242b34};
    function block(name,x,z,width,depth,baseY,height,color=palette.body) {
      parts.push({kind:'box',name,x,z,y:baseY+height/2,width,depth,height,color,finish:'concrete'});
      bounds.push(volume(site,x,z,width,depth,baseY,height));
    }
    function tower(name,outline,rings,color=palette.body) {
      parts.push({kind:'loft',name,outline,rings,color});
      for(let i=1;i<rings.length;i++) {
        const a=rings[i-1],b=rings[i];
        const minX=Math.min(a[1]-a[3],b[1]-b[3]),maxX=Math.max(a[1]+a[3],b[1]+b[3]);
        const minZ=Math.min(a[2]-a[4],b[2]-b[4]),maxZ=Math.max(a[2]+a[4],b[2]+b[4]);
        bounds.push(volume(site,(minX+maxX)/2,(minZ+maxZ)/2,maxX-minX,maxZ-minZ,a[0],b[0]-a[0]));
      }
    }
    const fixture=(name,x,y,z,width,height,depth,color,finish='metal')=>
      parts.push({kind:'box',name,x,y,z,width,height,depth,color,finish});
    const brace=(name,from,to,width,height,color,finish='metal')=>
      parts.push({kind:'beam',name,from,to,width,height,color,finish});
    const display=(name,kind,x,y,z,width,height,heading,variant=0)=>
      panels.push({name,kind,x,y,z,width,height,heading,variant});
    block('podium',...site.base);
    site.work({block,tower,box:fixture,beam:brace,display,...palette});
    return {site,parts,bounds,panels};
  });
  const colliders=shapes.flatMap(({bounds})=>bounds);

  function spectrum({tower,box,beam,display,body,steel,lit,soot}) {
    const levels=[[12.7,0,0,7.52,6.95],[23,-.46,0,7.33,6.60],[43.8,.50,-.17,6.55,5.93],
      [58.1,1.53,.60,5.77,4.84],[67.8,2.44,.81,4.70,3.78],[74.4,3.03,.51,2.68,2.31]];
    tower('splayed broadcast shaft',clipped,levels,body);
    for (const [lower,upper] of [[0,1],[1,2],[2,3],[3,4],[4,5]]) {
      const [y1,x1,z1,rx1,rz1]=levels[lower],[y2,x2,z2,rx2,rz2]=levels[upper];
      for(const flank of [-1,1]) {
        beam('cast broadcasting ribs',[x1-rx1-.13,y1,z1+flank*rz1*.53],[x2-rx2-.13,y2,z2+flank*rz2*.53],
          .47,.39,steel);
        beam('signal status strips',[x1-rx1-.37,y1+.1,z1+flank*rz1*.53],
          [x2-rx2-.37,y2-.1,z2+flank*rz2*.53],.071,.083,flank>0?lit:0xa4adfd,'light');
      }
      for(let y=y1+3.19;y<y2-2.24;y+=4.84) {
        const t=(y-y1)/(y2-y1),x=x1+(x2-x1)*t, z=z1+(z2-z1)*t;
        const rx=rx1+(rx2-rx1)*t,rz=rz1+(rz2-rz1)*t;
        const mountX=x-rx-.21,mountZ=z-rz-.17,variant=Math.floor(y/4)%5;
        const h=3.60,w=rz*1.18;
        box('mounted video wall',mountX,y,z,.82,h+.22,w+.22,soot);
        display('broadcast monitor','video',mountX-.42,y,z,w,h,west,variant);
        box('side preview housing',x,y,mountZ,rx*.74+.20,h+.13,.63,soot);
        display('broadcast preview','video',x,y,mountZ-.324,rx*.74,h,Math.PI,(variant+2)%5);
      }
    }
    for(const [y,x,z,rx,rz] of levels.slice(0,5)) {
      tower('dish service collar',clipped,[[y+.12,x,z,rx+.34,rz+.31],[y+.67,x,z,rx+.34,rz+.31]],steel);
    }
    beam('crown transmission mast',[3.13,73.6,.51],[3.82,86.2,.16],.37,.35,steel);
    for (const y of [75.2,78.4,81.9,85.4]) {
      const x=3.13+(y-73.6)*.055;
      box('antenna comb',x,y,.45,3.41,.13,.23,steel);
      box('aerial beacon',x-1.73,y,.45,.08,.14,.18,lit,'light');
    }
    box('mast warning flash',3.82,86.19,.16,.40,.20,.34,0xff6c79,'light');
  }

  function rtx({block,tower,box,beam,display,body,steel,lit,soot}) {
    const levels=[[11.4,.18,0,10.12,8.66],[26.3,1.18,-.67,10.22,8.75],
      [43.3,2.43,-.44,9.18,7.79],[51.8,2.73,.20,8.45,7.22],
      [63.1,4.71,1.65,7.12,5.59],[76.3,6.42,2.27,4.63,4.51]];
    tower('angular systems core',wedge,levels,body);
    tower('raised assembly wedge',wedge,[[37.25,-4.56,-.73,4.93,4.9],[47.6,-2.74,-.28,5.11,4.31],
      [56.9,-.15,.89,4.42,3.13],[64.0,2.59,1.60,3.24,2.36]],0x545761);
    for (let i=1;i<levels.length;i++) {
      const [y1,x1,z1,rx1,rz1]=levels[i-1],[y2,x2,z2,rx2,rz2]=levels[i];
      for (const off of [-.26,.39]) {
        beam('external load ribs',[x1-rx1-.25,y1,z1+rz1*off],
          [x2-rx2-.25,y2,z2+rz2*off],.43,.47,0x98746b);
      }
      for (let y=y1+3;y<y2-1;y+=3.65) {
        const t=(y-y1)/(y2-y1),z=z1+(z2-z1)*t, face=x1-rx1+(x2-rx2-x1+rx1)*t;
        box('instrument window slot',face-.075,y,z,.16,.63,3.91,soot);
        box('validation lamp',face-.16,y+.08,z-.83,.041,.09,1.53,(i%2===0)?lit:0xb98774,'light');
      }
    }
    for(const [y,x,z,rx,rz] of levels.slice(1,-1)) {
      tower('angled transfer belt',wedge,[[y-.26,x,z,rx+.31,rz+.24],[y+.19,x,z,rx+.31,rz+.24]],steel);
    }
    beam('inspection crane',[6.31,75.9,2.27],[3.90,80.37,2.98],.31,.35,steel);
    box('crane crown beacon',3.89,80.4,3.02,.3,.41,.27,lit,'light');
    const wall=0x55574d,post=0x6a6b62;
    for (const side of [-1,1]) {
      const wallZ=side*6.61;
      block('compound front fortification',-12.15,wallZ,1.33,7.36,.0,3.39,wall);
      block('compound retaining wing',-10.22,side*10.27,4.63,1.05,.0,3.04,wall);
      block('gate piers',-12.11,side*2.85,1.36,.58,.0,4.84,post);
      box('parapet visor',-12.15,3.49,wallZ,1.61,.23,7.39,post);
      for (let i=0;i<5;i++) {
        const z=wallZ+(i-2)*1.33;
        box('armored wall ribs',-12.85,1.73,z,.15,2.96,.31,0x66665b,'concrete');
      }
      box('identification cabinet',-12.90,1.48,side*2.72,.22,.57,.34,soot);
      box('gate reader',-13.04,1.60,side*2.72,.035,.084,.19,lit,'light');
      box('gate accent paint',-12.84,3.10,side*4.35,.044,.14,1.89,0xa18a63);
    }
    block('gate overhead armor',-12.12,0,1.58,5.92,4.42,1.19,post);
    box('gate power rail',-12.91,4.51,0,.061,.071,4.95,lit,'light');
    display('compound gate identification','gate',-12.928,5.02,0,5.48,.80,west);
  }

  function google({block,box,beam,display,body,steel,lit,soot}) {
    const nodes=[
      [-7.65,1.10,12.90,16.9,8.9,20.4,0x435663],[7.45,-.22,11.04,14.8,8.9,16.4,body],
      [-7.19,1.37,11.73,13.2,29.3,15.8,0x405566],[6.36,1.58,12.53,14.3,25.3,20.4,0x3d5260],
      [-4.53,3.54,12.35,12.7,45.1,14.5,body],[4.73,3.32,10.85,11.1,46.2,14.5,0x40545e],
      [-1.25,4.23,14.23,10.44,60.7,10.3,0x4f6167],[2.2,4.63,8.82,7.39,71,6.9,body]
    ];
    for (const [i,[x,z,w,d,y,h,color]] of nodes.entries()) {
      block('staggered event node',x,z,w,d,y,h,color);
      const front=z-d/2-.077;
      box('node frame bottom',x,y+.58,front,w+.15,1.12,.32,steel);
      box('node frame top',x,y+h-.52,front,w+.24,.99,.37,steel);
      for (const side of [-1,1]) box('node frame sides',x+side*(w/2-.24),y+h/2,front,.48,h-.5,.31,steel);
      for (let level=y+2.3;level<y+h-1.27;level+=2.67) {
        for (let lane=0;lane<4;lane++) {
          const across=x+((lane+.5)/4-.5)*(w-1.09);
          box('event processing glass',across,level,front,w*.190,1.27,.133,(lane+i)%4===0?0x516d7c:soot);
          if ((lane+i+Math.floor(level))%3===0)
            box('event node activity',across,level-.28,front-.081,w*.096,.09,.058,
              [lit,0xf4b47d,0x9cbcf6,0xace3cc][(lane+i)%4],'light');
        }
        box('exhaust baffle',x+w/2+.04,level,z,.12,.56,d*.63,0x283a42);
      }
      box('node conduit punctuators',x,y+.22,front-.17,w*.35,.079,.044,
        [0xf5b88c,0xa6dbe7,0x99a8f9,lit][i%4],'light');
    }
    for (const [y,x,z,w,d] of [[20.1,.30,1.33,6.5,4.5],[39.7,.1,2.64,5.51,4.7],[56.5,1.9,3.38,5.6,4.2]]) {
      block('event conduit bridges',x,z,w,d,y,3.15,steel);
      box('bridge glazing',x,y+1.55,z-d/2-.048,w*.9,.95,.105,0x33464e);
      beam('bridge tracer',[x-w*.44,y+.52,z-d/2-.091],[x+w*.44,y+.52,z-d/2-.091],.071,.064,lit,'light');
    }
    box('roof exchange housing',1.81,78.62,4.63,6.6,1.38,5.41,steel);
    for(const x of [.31,2.2,4.15]) box('roof exchange pins',x,79.75,4.63,.11,1.51,.18,lit,'light');
    box('motto fascia',0,6.77,-10.53,26.75,1.91,.19,0x293b49);
    display('DON\'T BE EVIL','slogan',0,6.77,-10.634,26.2,1.76,Math.PI);
    for(const [x,y,z,w,h,heading] of [
      [-7.65,16.5,-7.62,7.83,5.32,Math.PI],[7.45,21.7,-7.89,8.73,5.52,Math.PI],
      [-7.19,36.8,-5.48,8.41,5.11,Math.PI],[6.36,37.4,-5.76,8.63,5.34,Math.PI],
      [13.11,22.0,-.22,8.49,5.26,Math.PI/2]
    ]) display('evaluation cloud plate','cloud',x,y,z,w,h,heading,Math.round(y)%3);
  }

  function coorstek({tower,box,beam,display,body,steel,lit,soot}) {
    // The pipes, tapering kilns, and thick tile joints distinguish production
    // floors from the glazed office buildings next door.
    const furnaces=[{x:1.72,z:-5.56,roof:74.2},{x:2.61,z:5.48,roof:61.4}];
    for (const [i,{x,z,roof}] of furnaces.entries()) {
      tower('segmented ceramic kilns',kiln,[[10.6,x,z,5.43,5.13],[25.9,x+.75,z,5.03,5.11],
        [43.5,x+1.10,z,4.72,4.45],[roof-8.6,x+1.3,z+.26,3.88,3.87],
        [roof,x+1.35,z+.55,2.65,2.82]],i===0?body:0x655348);
      for(const y of [13.3,19.9,27.4,36.4,45.2,53,61.4].filter(y=>y<roof-3)) {
        const taper=Math.max(3.34,5.82-(y-12)*.041);
        tower('kiln service clamps',kiln,[[y,x+.44,z,taper,taper],[y+.45,x+.44,z,taper,taper]],0x7a7164);
        for(const offset of [-1.82,0,1.82])
          box('inspection readouts',x+.44-taper-.025,y+.58,z+offset,.103,.22,1.25,offset===0?lit:0xf9a27a,'light');
      }
      const ventX=x+1.35;
      tower('exhaust crown',kiln,[[roof-.19,ventX,z+.55,2.72,2.89],[roof+.78,ventX,z+.55,2.83,2.98]],steel);
      tower('flue neck',kiln,[[roof+.76,ventX,z+.55,1.82,1.83],[roof+4.52,ventX+.18,z+.56,1.59,1.63]],soot);
      for(const zOffset of [-1.42,1.42]) {
        beam('furnace pipework',[x-3.3,8.8,z+zOffset],[x-3.3,21.25,z+zOffset],.34,.40,0x925f4d);
        beam('upper manifold elbow',[x-3.3,21.25,z+zOffset],[x-1.58,24.75,z+zOffset],.35,.42,0x925f4d);
      }
    }
    tower('elevated kiln link',clipped,[[34.6,2.48,0,4.23,5.97],[37.5,2.48,0,4.23,5.97]],steel);
    beam('kiln bridge guide',[2.48-4.25,35.47,-5.15],[2.48-4.25,35.47,5.15],.16,.12,lit,'light');
    box('materials telemetry cabinet',-4.47,5.67,0,.41,1.47,15.8,soot);
    display('process prediction board','materials',-4.685,5.67,0,15.5,1.33,west);
  }

  function rocket({block,box,beam,body,steel,lit,soot}) {
    const entries=[
      [2.43,1.38,12.54,11.71,15.5,13.34],
      [1.92,1.98,13.36,12.29,28.84,15.63],
      [3.22,2.45,12.93,11.07,44.47,16.82],
      [4.28,2.97,10.32,10.01,61.29,11.85],
      [5.02,3.02,7.67,6.98,73.14,8.52]
    ];
    for (const [index,[x,z,w,d,y,h]] of entries.entries()) {
      block('archive cassettes',x,z,w,d,y,h,(index%2)?0x4d4d63:body);
      const face=x-w/2;
      for(let level=y+1.59;level<y+h-.7;level+=2.33) {
        box('stacked archive intake',face-.095,level,z,.19,.95,d*.78,soot);
        for(let fin=0;fin<6;fin++)
          box('cassette shutters',face-.221,level,z+((fin+.5)/6-.5)*d*.78,.13,1.16,.12,steel);
        if(Math.floor(level*2)%4===0)
          box('archive queue lighting',face-.305,level-.245,z+d*.16,.044,.072,d*.35,lit,'light');
      }
      box('archive shelf rim',x,y+.17,z,w+.49,.48,d+.22,steel);
      box('shelf glass canopy',x,y+h-.15,z,w+.63,.42,d+.31,steel);
    }
    for (const side of [-1,1]) {
      const z=side*4.53;
      beam('archive buttress',[-2.73,2.8,z],[-3.24,16.2,z+.75],.49,.59,steel);
      beam('archive buttress',[-3.24,16.2,z+.75],[-4.84,33.28,z+1.19],.53,.64,steel);
      beam('archive buttress',[-4.84,33.28,z+1.19],[-2.39,47.7,z+1.91],.46,.56,steel);
      beam('transit guideway indicators',[-3.51,16.8,z+.75],[-5.10,32.94,z+1.19],.051,.057,lit,'light');
    }
    box('retention monitor crown',4.6,81.95,3.05,5.80,.65,4.62,steel);
    box('crown slot',1.65,82.04,3.05,.081,.15,3.43,lit,'light');
  }

  function loftGeometry(THREE,outline,rings) {
    const positions=[],uvs=[];
    const points=rings.map(([y,x,z,rx,rz])=>outline.map(([nx,nz])=>[x+nx*rx,y,z+nz*rz]));
    function face(a,b,c,uv=[0,0,0,1,1,1]) {
      positions.push(...a,...b,...c);
      uvs.push(...uv);
    }
    const count=outline.length;
    for (let section=1;section<points.length;section++) {
      const previous=points[section-1], next=points[section];
      for (let j=0;j<count;j++) {
        const k=(j+1)%count;
        const u=Math.hypot(previous[j][0]-previous[k][0],previous[j][2]-previous[k][2])/8;
        const v0=previous[j][1]/7,v1=next[j][1]/7;
        face(previous[j],previous[k],next[k],[0,v0,u,v0,u,v1]);
        face(previous[j],next[k],next[j],[0,v0,u,v1,0,v1]);
      }
    }
    for (let j=1;j<count-1;j++) {
      const low=points[0], high=points.at(-1);
      face(low[0],low[j+1],low[j]);
      face(high[0],high[j],high[j+1]);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.computeVertexNormals();
    return geometry;
  }

  function boardArtwork(ctx,kind,variant) {
    const width=ctx.canvas.width,height=ctx.canvas.height;
    const neon=['#89f1ff','#c7a5ff','#ff956c','#a7d6bf','#829dfa'][variant];
    ctx.fillStyle='#142433';
    ctx.fillRect(0,0,width,height);
    ctx.strokeStyle=neon;
    ctx.fillStyle=neon;
    ctx.lineWidth=2;
    ctx.strokeRect(7,7,width-14,height-14);
    if (kind==='video') {
      ctx.font='bold 21px monospace';
      ctx.fillText('SPECTRUM  /  LIVE '+(variant+1),21,36);
      ctx.strokeStyle='#7da6ca';
      ctx.strokeRect(21,54,286,147);
      const swatches=['#8fb8cd','#90ce8f','#8657a0','#c26870','#44819c','#3d475d','#cbb49a'];
      for (let i=0;i<swatches.length;i++) {
        ctx.fillStyle=swatches[(variant+i)%swatches.length];
        ctx.fillRect(23+40*i,56,40,113);
        ctx.fillStyle=swatches[(variant+i+3)%swatches.length];
        ctx.fillRect(23+40*i,170,40,29);
      }
      ctx.strokeStyle=neon;
      ctx.beginPath();
      for(let i=0;i<166;i++) {
        const x=332+i,y=136+Math.sin(i*.14+variant*1.7)*(13+.17*i)+Math.sin(i*.55)*8;
        if(i) ctx.lineTo(x,y);
        else ctx.moveTo(x,y);
      }
      ctx.stroke();
      ctx.fillStyle=neon;
      ctx.font='bold 15px monospace';
      ctx.fillText('ENCODE / PREVIEW',333,71);
      ctx.fillText('MODEL OUTPUT',333,195);
      ctx.fillText('STREAM  '+(variant+1)+'/05                       SIGNAL LOCKED',22,232);
      for (let y=11;y<height;y+=5) {
        ctx.fillStyle='#111b2a28';
        ctx.fillRect(11,y,width-22,1);
      }
    } else if (kind==='materials') {
      ctx.fillStyle='#fbd6ae';
      ctx.font='700 31px monospace';
      ctx.fillText('PROCESS MODEL',25,51);
      ctx.font='bold 21px monospace';
      ctx.fillText('PREDICTED / OBSERVED',25,89);
      ctx.fillText('BATCH CHARACTERISTICS',25,130);
      ctx.fillText('COORSTEK  /  SPARK',25,224);
      const palette=['#353745','#6e5271','#ac665e','#e7915e','#f4be75'];
      for(let y=0;y<7;y++) for(let x=0;x<8;x++) {
        ctx.fillStyle=palette[(x*x+5*y+Math.floor(x*y/2))%palette.length];
        ctx.fillRect(315+x*19,37+y*24,16,19);
      }
    } else if(kind==='cloud') {
      ctx.fillStyle='#152636';
      ctx.fillRect(0,0,width,height);
      ctx.strokeStyle=neon;
      ctx.lineWidth=9;
      ctx.beginPath();
      ctx.moveTo(160,173);
      ctx.bezierCurveTo(96,174,90,91,153,89);
      ctx.bezierCurveTo(170,31,254,39,274,82);
      ctx.bezierCurveTo(307,65,344,75,357,104);
      ctx.bezierCurveTo(410,107,410,173,352,174);
      ctx.closePath();
      ctx.stroke();
      for (let i=0;i<5;i++) {
        const x=173+i*41,y=132+(i%2)*12;
        ctx.fillStyle=neon;
        ctx.fillRect(x,y,12,12);
        ctx.lineWidth=2;
        if (i!==4) {
          ctx.beginPath();
          ctx.moveTo(x+12,y+6);
          ctx.lineTo(x+41,142+(1-i%2)*12);
          ctx.stroke();
        }
      }
      ctx.font='bold 19px monospace';
      ctx.fillText('EVENT CLOUD / EVALUATION',121,219);
    } else {
      const slogans=kind==='slogan' ? ["DON'T BE EVIL"] : ['RTX / RAYTHEON','SYSTEMS DEPOT  /  IDENTIFICATION REQUIRED'];
      ctx.fillStyle=kind==='slogan' ? '#d4ffe7' : '#f6c495';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.font=kind==='slogan'?'900 112px Arial, sans-serif':'900 59px Arial, sans-serif';
      ctx.fillText(slogans[0],width/2,kind==='slogan'?height*.51:height*.38,width-43);
      if (slogans[1]) {
        ctx.font='700 29px monospace';
        ctx.fillText(slogans[1],width/2,height*.72,width-43);
      }
    }
  }

  function attach(THREE,world) {
    const district=new THREE.Group();
    district.name='portfolio-experience-towers';
    const boxGeometry=new THREE.BoxGeometry(1,1,1);
    const geometries=new Set([boxGeometry]),materials=new Set(),textures=new Set();
    const surface=(type,properties)=>{
      const material=new THREE[type](properties);
      materials.add(material);
      return material;
    };
    const color=new THREE.Color();
    const concreteMap=typeof document==='undefined' ? null :
      new THREE.TextureLoader().load(assetBase+'concrete-bump.jpg');
    if (concreteMap) {
      concreteMap.wrapS=concreteMap.wrapT=THREE.RepeatWrapping;
      concreteMap.repeat.set(1.75,2.15);
      textures.add(concreteMap);
    }
    const finishes={
      concrete:surface('MeshStandardMaterial',{color:0xffffff,bumpMap:concreteMap,bumpScale:.10,roughness:.88}),
      metal:surface('MeshStandardMaterial',{color:0xffffff,metalness:.37,roughness:.63}),
      light:surface('MeshBasicMaterial',{color:0xffffff,toneMapped:false})
    };
    const media=new Map();
    const transform=new THREE.Object3D(), direction=new THREE.Vector3(), forward=new THREE.Vector3(0,0,1);
    function batch(group,pieces) {
      for (const [finish,material] of Object.entries(finishes)) {
        const matching=pieces.filter(p=>p.kind!=='loft'&&p.finish===finish);
        if (!matching.length) continue;
        const instances=new THREE.InstancedMesh(boxGeometry,material,matching.length);
        instances.name=group.name+'-'+finish;
        for (const [i,part] of matching.entries()) {
          if (part.kind==='beam') {
            const {from,to,width,height}=part;
            direction.set(to[0]-from[0],to[1]-from[1],to[2]-from[2]);
            transform.position.set((from[0]+to[0])/2,(from[1]+to[1])/2,(from[2]+to[2])/2);
            transform.scale.set(width,height,direction.length());
            transform.quaternion.setFromUnitVectors(forward,direction.normalize());
          } else {
            transform.position.set(part.x,part.y,part.z);
            transform.scale.set(part.width,part.height,part.depth);
            transform.quaternion.identity();
          }
          transform.updateMatrix();
          instances.setMatrixAt(i,transform.matrix);
          color.setHex(part.color);
          if (finish!=='light') color.convertSRGBToLinear();
          instances.setColorAt(i,color);
        }
        group.add(instances);
      }
    }
    for (const {site,parts,panels} of shapes) {
      const group=new THREE.Group();
      group.name='portfolio-experience-'+site.id;
      group.position.set(site.x,0,site.z);
      district.add(group);
      batch(group,parts);
      for(const {name,outline,rings,color:hex} of parts.filter(p=>p.kind==='loft')) {
        const geometry=loftGeometry(THREE,outline,rings);
        geometries.add(geometry);
        const material=surface('MeshStandardMaterial',{color:new THREE.Color(hex).convertSRGBToLinear(),roughness:.83,
          bumpMap:concreteMap,bumpScale:.10});
        const mesh=new THREE.Mesh(geometry,material);
        mesh.name=group.name+'-'+name;
        mesh.userData.portfolioAuditSolid=true;
        group.add(mesh);
      }
      for(const {name,kind,x,y,z,width,height,heading,variant} of panels) {
        const key=kind+variant;
        if(!media.has(key)) {
          const face=surface('MeshBasicMaterial',{color:0x59707f,toneMapped:false});
          if(typeof document!=='undefined') {
            const canvas=document.createElement('canvas');
            canvas.width=kind==='slogan'?1024:512;
            canvas.height=kind==='slogan'?160:256;
            boardArtwork(canvas.getContext('2d'),kind,variant);
            const map=new THREE.CanvasTexture(canvas);
            map.encoding=THREE.sRGBEncoding;
            map.anisotropy=4;
            textures.add(map);
            face.map=map;
            face.color.setHex(0xffffff);
          }
          media.set(key,face);
        }
        const shape=new THREE.PlaneGeometry(width,height);
        geometries.add(shape);
        const panel=new THREE.Mesh(shape,media.get(key));
        panel.name='portfolio-experience-'+name;
        panel.position.set(x,y,z);
        panel.rotation.y=heading;
        if (kind==='slogan' || kind==='gate' || kind==='materials')
          panel.userData={portfolioAdFace:true,portfolioAdId:'experience-'+kind};
        group.add(panel);
      }
      const front=new THREE.Group();
      front.name=group.name+'-entrance';
      const [x,z,w,d]=site.base;
      front.position.set(x+(site.heading===west?-w/2:0),0,z+(site.heading===west?0:-d/2));
      front.rotation.y=site.heading;
      group.add(front);
      entry(THREE,front,site,batch,surface,geometries,textures);
    }
    world.add(district);
    return {
      dispose() {
        world.remove(district);
        geometries.forEach(geometry=>geometry.dispose());
        materials.forEach(material=>material.dispose());
        textures.forEach(texture=>texture.dispose());
      }
    };
  }

  function entry(THREE,front,site,batch,surface,geometries,textures) {
    const {id,ink,trim,tone}=site;
    const width=id==='google'?16.5:id==='coorstek'?16:id==='rocket-software'?10.65:12.3;
    const pieces=[];
    const box=(name,x,y,z,width,height,depth,color,finish='metal')=>
      pieces.push({kind:'box',name,x,y,z,width,height,depth,color,finish});
    box('weather screen',0,2.51,.075,width,4.9,.15,trim,'concrete');
    box('inset lobby',0,1.67,.176,width-.63,3.12,.145,tone);
    box('awning',0,3.42,.38,width+.11,.27,.68,trim);
    box('entrance lamp',0,3.253,.47,width*.77,.049,.085,ink,'light');
    box('threshold',0,.146,.65,3.72,.12,1.14,trim,'concrete');
    for(const side of [-1,1]) {
      box('jambs',side*1.55,1.68,.49,.20,3.26,.52,trim);
      box('reinforced glass door',side*.70,1.47,.32,1.32,2.75,.18,0x263747);
      box('push bars',side*.71,1.13,.447,.58,.060,.092,0x8b9095);
      box('street-facing ribs',side*(width/2-.26),2.54,.38,.31,4.98,.49,trim,'concrete');
      const displayX=side*(width/4+.79);
      box('viewing bay',displayX,1.86,.29,width*.186,2.19,.195,0x263038);
      box('bay edge light',displayX,2.83,.421,width*.158,.042,.05,ink,'light');
      for(let i=0;i<4;i++) {
        if(id==='coorstek'){
          box('ceramic sample tiers',displayX,1.08+i*.36,.427,width*.162,.075,.217,(i%2)?0xaca091:0x887d70);
        } else {
          const y=1.18+i*.34;
          const span=width*.10*(.72+(i*3%5)*.089);
          box('sight glass terminals',displayX,y,.429,span,.086,.078,i%2?ink:trim,i%2?'light':'metal');
        }
      }
    }
    const titleY=id==='rtx-raytheon'?6.48:4.27;
    box('title cabinet',0,titleY,.19,width-.88,1.12,.25,0x1b2831);
    batch(front,pieces);
    const panel=new THREE.PlaneGeometry(width-1.02,1.01);
    geometries.add(panel);
    const finish=surface('MeshBasicMaterial',{color:0x23313c,toneMapped:false});
    if(typeof document!=='undefined') {
      const canvas=document.createElement('canvas');
      canvas.width=1024;canvas.height=172;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#1c252d';
      ctx.fillRect(0,0,1024,172);
      ctx.strokeStyle='#'+ink.toString(16).padStart(6,'0');
      ctx.lineWidth=3;
      ctx.strokeRect(13,10,998,151);
      ctx.fillStyle=ctx.strokeStyle;
      ctx.font='900 68px Arial, sans-serif';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillText(site.title,512,66,920);
      ctx.font='700 24px monospace';
      ctx.fillText(site.caption,512,124,920);
      const map=new THREE.CanvasTexture(canvas);
      map.encoding=THREE.sRGBEncoding;
      map.anisotropy=4;
      textures.add(map);
      finish.map=map;
      finish.color.setHex(0xffffff);
    }
    const sign=new THREE.Mesh(panel,finish);
    sign.name='portfolio-experience-site-sign';
    sign.userData={portfolioAdFace:true,portfolioAdId:'experience-site-'+id};
    sign.position.set(0,titleY,.321);
    front.add(sign);
  }

  return {attach,colliders,parcels};
});
