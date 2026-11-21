(function(root, factory) {
  const signText = typeof module === 'object' && module.exports
    ? require('./portfolio-sign-text') : root.DrivePortfolioSignText;
  const frontages=factory(signText);
  if (typeof module==='object' && module.exports) module.exports=frontages;
  else root.DrivePortfolioProjectsFrontages=frontages;
})(globalThis,function(signText) {
  'use strict';

  const south=Math.PI,east=Math.PI/2;
  const assetBase=typeof document!=='undefined' && document.currentScript?.src
    ? new URL('../assets/portfolio/',document.currentScript.src).href : 'assets/portfolio/';
  const doors=[
    {id:'car-go-vroom',x:-26.5,z:36,angle:east,treatment:garage},
    {id:'one-neuron-over',x:-11,z:76.5,angle:south,treatment:lab},
    {id:'edvise',x:-31.5,z:-19.5,angle:0,treatment:planning},
    {id:'neurips-privacy-challenge',x:11,z:80,angle:south,treatment:privacy},
    {id:'unnecessary-lore',x:58,z:77,angle:0,treatment:press}
  ];

  function garage({box,beam,tread,entry,label,light}) {
    const iron=0x353e43, rust=0x704733, gold=0xfac184, smoke=0x242d32;
    box('wall',0,2.70,.20,12.4,5.40,.33,smoke,'concrete');
    box('pit canopy',0,4.20,.72,11.9,.53,1.18,iron);
    box('trim',0,4.02,1.33,11.4,.10,.13,0x8b6651);
    box('top beam',0,5.22,.53,11.5,.47,.45,rust,'concrete');
    for (const x of [-5.41,.86,5.52]) {
      box('pit columns',x,1.99,.77,.32,3.94,.85,iron);
      box('bumper guards',x,.32,1.14,.42,.55,.23,rust);
    }
    for (const x of [-2.25,3.25]) {
      const width=x<0?5.62:3.70;
      box('pit recess',x,1.84,.48,width,3.38,.19,0x181e24);
      for (let row=0;row<12;row++)
        box('rolling shutters',x,2.72+(row+.5)*.075,.69,width-.27,.059,.13,row%3 ? 0x404b50 : iron);
      box('pit sill',x,.13,.77,width-.18,.14,.95,rust);
      for (const off of [-.40,.40])
        box('pit lamps',x+off,3.48,1.00,.52,.08,.25,gold,'light');
    }
    box('bay back wall',-2.25,1.18,.60,5.0,2.21,.13,0x1f252b);
    for (const x of [-4.34,-.14]) {
      box('hydraulic lift',x,1.26,.87,.20,2.3,.38,0x9b6943);
      beam('lift forks',[x,.40,1.04],[x+(x< -2?.69:-.69),.45,1.46],.12,.12,iron);
    }
    box('red toolbox',-.77,.43,.85,.92,.67,.43,0x813f37);
    for (const y of [.25,.46,.66]) box('drawer pull',-.77,y,1.08,.78,.04,.04,0x929491);
    box('equipment bulkhead',3.25,1.08,.60,3.31,2.03,.15,0x36444a,'concrete');
    for (let i=0;i<8;i++) box('vent fins',3.25,1.62+i*.076,.71,2.81,.034,.06,0x1b2229);
    tread(-2.25,4.0,.70,1.42,0x707474);
    tread(3.24,2.3,.70,1.42,0x535d60);
    for (const off of [-.50,.50]) light('pit guidance',off+3.24,.217,1.51,.04,.03,.54,gold);
    entry(3.25,.73,1.15,2.25,0x676d6b,gold);
    label(-.35,4.85,.79,9.2,.70,'CAR GO VROOM','CONCOURSE GARAGE  /  TEST & TUNE',gold,0x22282c);
    // A maintenance gantry frames the billboard without cutting across its face.
    box('mezzanine',0,6.38,-.09,11.48,2.38,1.07,iron,'concrete');
    box('mezzanine sill',0,5.62,.52,11.56,.19,.62,rust);
    for (let i=0;i<7;i++) {
      const x=(i-3)*1.47;
      box('mezzanine window bays',x,6.62,.479,1.31,1.16,.080,0x26272d);
      box('maintenance task lights',x,6.98,.525,1.02,.057,.034,i%3===0 ? 0xd59568 : gold,'light');
    }
    for (const x of [-5.52,5.52]) {
      box('lift tower',x,9.88,.06,.55,6.68,.95,iron);
      box('lift tower rail',x,9.96,.579,.23,5.91,.087,rust);
      beam('gantry anchors',[x,7.64,-1.95],[x,9.01,.55],.17,.24,0x816455);
      box('warning beacons',x,13.45,.22,.32,.20,.37,0xf0a065,'light');
    }
    box('bridge crane',0,13.03,.08,11.56,.53,1.01,rust,'concrete');
    box('crane reinforcement',0,12.68,.51,10.58,.15,.18,iron);
    box('crane trolley',-2.64,12.68,.05,1.12,.43,.67,0x805d45);
    beam('crane lifting cable',[-2.64,12.5,.51],[-2.64,12.10,.51],.045,.045,0x8c8f86);
  }

  function lab({box,beam,tread,entry,label}) {
    const stone=0x77858a, trim=0x44535e, glass=0x253d48, ice=0x9bf1ee;
    box('lab cladding',0,4.32,.13,11.45,8.48,.19,trim,'concrete');
    box('instrument recess',0,3.76,.27,8.05,5.72,.22,0x202c34);
    for (const x of [-4.85,4.85]) {
      box('cast shutters',x,3.54,.39,1.31,6.72,.54,stone,'concrete');
      beam('battered piers',[x,.19,.65],[x*.86,6.22,.81],.46,.54,0x869194,'concrete');
      box('thermal fins',x,7.19,.29,1.38,1.25,.45,trim);
      box('door beacons',x,2.40,.77,.044,2.45,.065,ice,'light');
    }
    box('observation chamber',.94,3.64,.42,4.32,2.48,.31,glass);
    box('chamber ceiling rail',.94,4.88,.74,4.2,.055,.12,ice,'light');
    for (let i=0;i<7;i++) {
      const x=-.55+i*.48;
      box('compute stacks',x,3.53,.64,.31,1.50,.28,0x292f36);
      for (let j=0;j<4;j++) if ((i+j)%3 !== 2)
        box('compute LEDs',x,3.02+j*.34,.792,.18,.038,.016,j%3===0 ? 0xd5c895 : ice,'light');
    }
    box('instrument glass sill',.94,2.49,.60,4.55,.14,.51,stone);
    for (const x of [-1.19,.83,3.09]) box('glass mullions',x,3.69,.70,.095,2.46,.29,trim);
    entry(-2.85,.69,1.78,2.92,trim,ice);
    tread(-2.85,2.7,.61,1.61,0x56656c);
    box('clamped cornice',0,6.16,.85,9.85,.48,1.28,stone,'concrete');
    label(0,5.62,.65,8.5,.82,'ONE NEURON OVER','MODEL LAB  /  EVALUATION FLOOR',ice,0x273740);
    for (const offset of [-.33,.33])
      beam('instrument cables',[-3.30+offset,7.12,.52],[2.65+offset,7.58,.52],.035,.037,ice,'light');
    box('cooling mezzanine',1.31,13.14,.31,7.59,9.38,1.62,trim,'concrete');
    box('insulated plinth',1.31,8.76,.75,8.13,.38,1.62,stone,'concrete');
    box('recessed heat exchanger',1.31,13.08,1.155,5.97,7.28,.125,0x23363d);
    for (let i=0;i<24;i++)
      box('heat exchanger fins',1.31,9.78+i*.279,1.30,5.72,.123,.24,i%5===0 ? stone : 0x51616a);
    for (const x of [-1.95,4.63]) {
      box('condenser duct',x,13.28,1.28,.53,7.85,.56,stone);
      box('duct status rail',x,13.55,1.58,.078,7.35,.061,ice,'light');
    }
    box('extractor head',1.31,18.22,.21,6.92,.67,1.49,stone,'concrete');
    beam('chiller feed',[-4.03,7.9,.67],[-4.03,16.3,.67],.56,.47,0x857364);
    beam('chiller return',[-3.22,9.05,.99],[-3.22,15.23,.99],.33,.46,0x52747a);
    beam('feed manifold',[-4.01,16.24,.67],[-1.90,16.24,.67],.48,.44,0x857364);
    for (const y of [9.39,12.21,15.04]) box('pipe brackets',-3.62,y,.54,1.53,.21,1.04,trim);
  }

  function planning({box,beam,tread,entry,label}) {
    const steel=0x355158, stone=0x69737a, ink=0x283b43, copper=0xe7ae82, mint=0xb2e9d5;
    box('tenant fit-out',0,3.09,.12,11.05,5.92,.22,0x455357,'concrete');
    for (const x of [-4.89,4.89]) {
      box('rib piers',x,2.63,.46,.46,4.98,.61,stone,'concrete');
      for (let i=0;i<6;i++) box('pier insets',x,1.02+i*.42,.803,.26,.09,.035,steel);
    }
    box('projecting portico',0,3.49,.92,10.78,.61,1.64,steel,'concrete');
    box('portico soffit',0,3.155,1.33,10.4,.075,.29,0xa99978);
    box('portico rail',0,3.16,1.54,9.48,.041,.057,copper,'light');
    for (const x of [-3.15,-.86]) {
      box('course chart recess',x,1.94,.34,2.18,2.31,.18,ink);
      box('chart sill',x,.72,.60,2.20,.16,.51,steel);
      for (let i=0;i<4;i++)
        box('chart legend',x-.61,.99+i*.18,.457,.22+.047*i,.047,.025,i===2?copper:mint,'light');
    }
    const diagram=[[-3.68,2.15],[-2.98,2.15],[-2.98,2.68],[-1.48,2.68],[-1.48,1.93],[-.42,1.93]];
    for (const [i,[x,y]] of diagram.entries()) {
      if (i!==diagram.length-1) {
        const [nextX,nextY]=diagram[i+1];
        beam('program paths',[x,y,.453],[nextX,nextY,.453],.039,.044,mint,'light');
      }
      box('course nodes',x,y,.48,.14,.14,.055,i%3?mint:copper,'light');
    }
    entry(2.96,.60,2.60,2.62,steel,mint);
    tread(2.96,3.5,.61,1.61,0x5b6b6e);
    label(0,3.49,1.76,8.7,.52,'EDVISE','COURSE PLANNING CENTER',mint,0x273d47);
    box('academic gallery',0,8.41,.38,10.45,8.59,1.12,steel,'concrete');
    for (const y of [5.91,8.65,11.39]) {
      box('gallery glazing',0,y,.988,9.26,2.04,.10,0x283a3e);
      box('sunshade slab',0,y+1.06,1.01,10.33,.22,.99,0x657471,'concrete');
      for (const x of [-4.57,-2.24,0,2.24,4.57]) box('gallery mullions',x,y,1.06,.082,2.07,.15,0x65807c);
    }
    for (const x of [-4.97,4.97]) box('gallery side fins',x,8.39,.78,.29,8.64,1.28,0x687874);
    for (const [from,to] of [[[-3.6,5.75],[-1.54,7.19]],[[-1.54,7.19],[-1.54,9.22]],
      [[-1.54,9.22],[1.71,10.37]],[[1.71,10.37],[3.75,11.36]]])
      beam('program direction inlays',[...from,1.69],[...to,1.69],.028,.034,mint,'light');
    for (const [x,y] of [[-3.6,5.75],[-1.54,7.19],[-1.54,9.22],[1.71,10.37],[3.75,11.36]])
      box('waypoint ribs',x,y,1.69,.145,.145,.075,copper,'light');
  }

  function privacy({box,beam,tread,entry,label}) {
    const metal=0x4b454f, oxide=0x654f49, dark=0x26212b, copper=0xffbc81;
    box('vestibule liner',0,3.57,.18,7.97,7.06,.28,dark,'concrete');
    box('security overhang',0,4.25,.69,7.86,.42,1.18,oxide,'concrete');
    for (const x of [-2.89,2.89]) {
      box('angled entrance shoulders',x,2.13,.58,1.74,4.0,.77,metal,'concrete');
      beam('security ribs',[x*1.16,.30,.95],[x*.78,3.84,1.02],.18,.22,0x93746c);
      box('column telltales',x,2.37,.986,.075,1.10,.061,copper,'light');
    }
    for (let i=0;i<10;i++)
      box('privacy louvers',(i-4.5)*.735,6.60,.53,.20,2.09,.57,i%3===2 ? oxide : metal);
    for (const y of [5.71,7.38]) box('louver frame',0,y,.55,7.68,.13,.40,oxide);
    entry(0,.80,2.18,2.93,metal,copper);
    box('secure reader',1.44,1.27,.91,.32,.42,.28,0x6b5760);
    box('secure status',1.44,1.32,1.064,.14,.07,.017,copper,'light');
    tread(0,3.62,.78,1.58,0x67606a);
    label(0,4.89,.75,7.65,.96,'NEURIPS PRIVACY','CHALLENGE  /  RESEARCH ACCESS',copper,0x362a33);
    box('secure core',0,11.39,-.18,8.06,8.18,1.53,dark,'concrete');
    box('secure floor break',0,9.66,.31,8.2,.24,.94,oxide,'concrete');
    for (const side of [-1,1]) {
      const x=side*3.41;
      beam('exterior security rib',[x,7.58,.78],[x*.83,14.80,1.24],.52,.55,metal,'concrete');
      beam('shield rails',[x*.53,8.48,.69],[x*.85,13.91,1.08],.11,.075,0x957065);
    }
    for (const y of [8.58,11.42,14.19]) {
      box('filtered observation slot',0,y,.665,4.71,.43,.14,0x36373d);
      for (const x of [-1.78,-.89,0,.89,1.78]) box('slot shutters',x,y,.795,.26,.66,.14,metal);
      box('shield telemetry',0,y-.24,.832,2.71,.037,.023,copper,'light');
    }
    box('set-back security crown',0,15.68,-.83,7.8,.39,2.24,0x554650,'concrete');
  }

  function press({box,beam,cylinder,tread,entry,label}) {
    const brick=0x624c45, steel=0x585a60, rust=0x8f654e, ink=0x292b36, coral=0xffaaac;
    box('presshouse masonry',0,2.99,.21,17.85,5.84,.36,brick,'concrete');
    box('drying canopy',0,4.00,.76,17.08,.26,1.29,0x755145);
    box('canopy light',0,3.86,1.23,16.17,.048,.069,coral,'light');
    for (const x of [-8.37,-3.77,2.37,7.94]) box('pressed steel columns',x,1.97,.61,.28,3.85,.51,steel);
    for (const x of [-6.2,.25,5.08]) {
      box('studio bay',x,2.02,.42,x<0?3.67:4.31,2.91,.25,ink);
      box('studio bay sill',x,.55,.69,x<0?3.90:4.52,.13,.48,rust);
    }
    for (const y of [1.05,1.58,2.10,2.62])
      cylinder('press rollers',-6.20,y,.73,3.18,.149,0x7e756b);
    for (const side of [-1,1]) box('roller brackets',-6.2+side*1.65,1.92,.77,.18,2.08,.32,steel);
    for (let i=0;i<6;i++)
      box('broadsheets',-.44+(i%2)*.9,.94+Math.floor(i/2)*.54,.59,.65,.44,.11,i%3===0?0xa8a498:0x854e52);
    for (const x of [-4.4,4.8]) beam('roof edge braces',[x,3.71,.55],[x,4.18,1.28],.13,.14,rust);
    entry(5.08,.70,1.85,2.86,steel,coral);
    tread(5.08,2.65,.60,1.46,0x69636a);
    label(-.45,4.89,.46,11.26,.95,'UNNECESSARY LORE','NORTH PRINTWORKS  /  EDITORIAL',coral,0x47343a);
    for (const x of [-7.7,6.4]) box('roof louvers',x,5.2,.44,1.23,.72,.25,steel,'concrete');
    box('editorial upper floor',0,7.33,-.35,18.13,3.08,1.47,brick,'concrete');
    box('continuous window sill',0,6.51,.60,18.18,.17,.43,rust);
    for (const x of [-6.82,-2.30,2.22,6.74]) {
      box('clerestory glass',x,7.54,.45,4.10,1.91,.115,0x2f3337);
      for (const side of [-1,1]) box('printer window mullions',x+side*1.06,7.54,.58,.068,1.91,.12,steel);
      box('working floor light',x,8.11,.59,3.70,.064,.028,0xe8bc91,'light');
      beam('sawtooth roof caps',[x-2.02,9.40,.53],[x+2.02,10.69,.53],.39,.38,rust,'concrete');
      box('clerestory posts',x+2.03,9.50,.51,.14,2.36,.48,steel);
      box('roof vent base',x+.74,10.48,-.613,1.27,.83,1.11,steel);
    }
  }

  function attach(THREE,world) {
    const root=new THREE.Group();
    root.name='portfolio-projects-frontages';
    const geometry={
      box:new THREE.BoxGeometry(1,1,1),
      cylinder:new THREE.CylinderGeometry(1,1,1,14)
    };
    let bump=null;
    if (typeof document!=='undefined') {
      bump=new THREE.TextureLoader().load(assetBase+'concrete-bump.jpg');
      bump.wrapS=bump.wrapT=THREE.RepeatWrapping;
      bump.repeat.set(4,3);
    }
    const finishes={
      metal:new THREE.MeshStandardMaterial({color:0xffffff,metalness:.48,roughness:.58}),
      concrete:new THREE.MeshStandardMaterial({color:0xffffff,bumpMap:bump,bumpScale:.065,roughness:.94}),
      light:new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false})
    };
    const labels=[];
    const pose=new THREE.Object3D(), tint=new THREE.Color();
    const forward=new THREE.Vector3(0,0,1), vector=new THREE.Vector3();

    for (const door of doors) {
      const frontage=new THREE.Group(), parts=new Map();
      frontage.name='portfolio-project-site-'+door.id;
      frontage.position.set(door.x,0,door.z);
      frontage.rotation.y=door.angle;
      const store=(name,shape,finish,color)=>{
        const key=shape+'-'+finish;
        if(!parts.has(key)) parts.set(key,{shape,finish,name,items:[]});
        pose.updateMatrix();
        parts.get(key).items.push({matrix:pose.matrix.clone(),color});
      };
      const box=(name,x,y,z,width,height,depth,color,finish='metal')=>{
        pose.position.set(x,y,z); pose.scale.set(width,height,depth); pose.rotation.set(0,0,0);
        store(name,'box',finish,color);
      };
      function beam(name,from,to,width,height,color,finish='metal') {
        vector.set(to[0]-from[0],to[1]-from[1],to[2]-from[2]);
        pose.position.set((from[0]+to[0])/2,(from[1]+to[1])/2,(from[2]+to[2])/2);
        pose.scale.set(width,height,vector.length());
        pose.quaternion.setFromUnitVectors(forward,vector.normalize());
        store(name,'box',finish,color);
      }
      function cylinder(name,x,y,z,length,radius,color) {
        pose.position.set(x,y,z); pose.rotation.set(0,0,Math.PI/2); pose.scale.set(radius,length,radius);
        store(name,'cylinder','metal',color);
      }
      function tread(x,width,near,far,color) {
        box('threshold paving',x,.164,(near+far)/2,width,.079,far-near,color,'concrete');
        for (const side of [-1,1]) box('threshold nosing',x+side*(width/2-.05),.164,(near+far)/2,.10,.079,far-near,0x899194);
      }
      function entry(x,z,width,height,frame,color) {
        box('entry recess',x,height*.50,z,width,height,.105,0x1b252d);
        for(const side of [-1,1]) {
          box('entry casings',x+side*(width/2+.035),height/2,z+.084,.145,height,.246,frame);
          box('entry glass',x+side*width*.237,height*.60,z+.066,width*.404,height*.66,.039,0x33464c);
          box('entry push bars',x+side*width*.235,height*.44,z+.132,width*.30,.049,.079,0x8d9491);
        }
        box('entry transom',x,height+.034,z+.098,width+.2,.137,.32,frame);
        box('entry light',x,height-.065,z+.14,width*.82,.049,.08,color,'light');
      }
      function label(x,y,z,width,height,title,caption,color,background) {
        const backing=new THREE.Mesh(geometry.box,new THREE.MeshStandardMaterial({color:background,metalness:.33,roughness:.62}));
        backing.name='portfolio-project-site-sign-housing';
        backing.position.set(x,y,z);
        backing.scale.set(width,height,.19);
        frontage.add(backing);
        const surface=new THREE.Mesh(new THREE.PlaneGeometry(width-.06,height-.035),
          new THREE.MeshBasicMaterial({color:background,toneMapped:false}));
        surface.name='portfolio-project-site-sign';
        surface.userData.portfolioAdFace=true;
        surface.userData.portfolioAdId='project-site-'+door.id;
        surface.position.set(x,y,z+.102);
        if (typeof document!=='undefined' && signText) {
          const {canvas,ctx:context}=signText.canvas(width-.06,height-.035,768,128);
          const css=value=>'#'+value.toString(16).padStart(6,'0');
          context.fillStyle=css(background);
          context.fillRect(0,0,768,128);
          context.strokeStyle=css(color);
          context.lineWidth=2;
          context.strokeRect(9,9,750,110);
          context.fillStyle=css(color);
          context.fillRect(22,30,4,65);
          context.fillRect(742,30,4,65);
          context.textAlign='center';
          context.textBaseline='middle';
          context.font='900 52px Arial, sans-serif';
          signText.text(context,title,384,52,701);
          context.font='600 23px monospace';
          signText.text(context,caption,384,97,692);
          const map=new THREE.CanvasTexture(canvas);
          map.encoding=THREE.sRGBEncoding;
          map.anisotropy=4;
          surface.material.map=map;
          surface.material.color.set(0xffffff);
        }
        frontage.add(surface);
        labels.push({backing,surface});
      }
      door.treatment({box,beam,cylinder,tread,entry,label,light:(...args)=>box(...args,'light')});
      for (const {shape,finish,name,items} of parts.values()) {
        const batch=new THREE.InstancedMesh(geometry[shape],finishes[finish],items.length);
        batch.name=frontage.name+' '+name;
        for (const [i,{matrix,color}] of items.entries()) {
          batch.setMatrixAt(i,matrix);
          batch.setColorAt(i,tint.setHex(color));
        }
        if (shape==='cylinder') batch.userData.portfolioAuditSolid=true;
        frontage.add(batch);
      }
      root.add(frontage);
    }
    world.add(root);
    return {
      dispose() {
        world.remove(root);
        for (const shape of Object.values(geometry)) shape.dispose();
        for (const material of Object.values(finishes)) material.dispose();
        if (bump) bump.dispose();
        for (const {backing,surface} of labels) {
          backing.material.dispose();
          surface.geometry.dispose();
          surface.material.map?.dispose();
          surface.material.dispose();
        }
      }
    };
  }

  return {attach};
});
