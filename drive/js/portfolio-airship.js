(function(root) {
  'use strict';

  const turn = 2 * Math.PI;
  const speed = .0115;
  const flights = [
    {
      id:'farline', name:'portfolio-ad-blimp', phase:2.19, x:-2, z:-3, radiusX:117, radiusZ:119,
      altitude:103, drift:4.6, length:26.6, width:7.5, height:8.15,
      displayWidth:36.8, displayHeight:7.15, displayY:-1.48, displayZ:1.1,
      paint:0x92a3a4, hardware:0x556568, dark:0x28373d, light:0x86efe5, trim:0x518e90
    },
    {
      id:'morrow', name:'portfolio-morrow-blimp', phase:.84, x:1, z:1, radiusX:126, radiusZ:102,
      altitude:112, drift:4.5, length:24.3, width:9.25, height:6.85,
      displayWidth:33.6, displayHeight:6.08, displayY:-1.12, displayZ:1.7,
      paint:0xa3744f, hardware:0x5f453a, dark:0x392c2c, light:0xffbb80, trim:0xbd8255
    }
  ];

  // Sections share a longitudinal profile between the hull and its fitted display recess.
  function section(flight,z) {
    const u=z/flight.length;
    const circle=Math.sqrt(Math.max(0,1-u*u));
    const tanker=flight.id==='morrow';
    return {
      width:flight.width*circle*(tanker ? .94+.12*u+.15*(1-u*u) : 1+.085*u),
      height:flight.height*circle*(tanker ? .99+.11*u : 1+.032*u),
      y:tanker ? .48*(1-u*u) : .17*u
    };
  }

  function makeHull(THREE,flight) {
    const geometry=new THREE.SphereGeometry(1,48,28);
    const vertices=geometry.attributes.position, colors=[];
    for (let i=0;i<vertices.count;i++) {
      const x=vertices.getX(i), y=vertices.getY(i), u=vertices.getZ(i), z=u*flight.length;
      const shape=section(flight,z), ring=Math.hypot(x,y)||1;
      vertices.setXYZ(i,x/ring*shape.width,y/ring*shape.height+shape.y,z);
      const angle=Math.atan2(y,x);
      const seams=.09*Math.cos(angle*18)-.13*Math.pow(Math.max(0,Math.cos(u*27*Math.PI)),12);
      const weather=.043*Math.sin(x*18+y*24+u*37)+.039*Math.sin(x*34+y*36-u*37);
      const lowerStripe=flight.id==='morrow' && y<-.35 ? .23 : 0;
      const tone=.86+seams+weather-lowerStripe;
      colors.push(tone+.025,tone,tone-.024);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    return geometry;
  }

  function displaySurface(THREE,flight,side,width,height,offset) {
    const geometry=new THREE.PlaneGeometry(width,height,30,9);
    const vertices=geometry.attributes.position;
    for (let i=0;i<vertices.count;i++) {
      const z=flight.displayZ-side*vertices.getX(i), y=flight.displayY+vertices.getY(i);
      const profile=section(flight,z);
      const x=profile.width*Math.sqrt(Math.max(.01,1-((y-profile.y)/profile.height)**2));
      vertices.setXYZ(i,side*(x+offset),y,z);
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  function stabilizer(THREE,depth,height,thickness) {
    const outline=new THREE.Shape();
    outline.moveTo(-.63*depth,0);
    outline.lineTo(-.59*depth,height*.65);
    outline.lineTo(-.36*depth,height);
    outline.lineTo(-.12*depth,height*.92);
    outline.lineTo(.71*depth,0);
    const geometry=new THREE.ExtrudeGeometry(outline,{depth:thickness,bevelEnabled:false,steps:1});
    geometry.translate(0,0,-thickness/2);
    geometry.rotateY(-Math.PI/2);
    return geometry;
  }

  function buildCraft(THREE,flight,primitives,makeCampaign) {
    const craft=new THREE.Group();
    craft.name=flight.name;
    const {sphere,box,ring,lightRed,lightGreen}=primitives;
    const shell=new THREE.MeshStandardMaterial({
      color:flight.paint,roughness:.50,metalness:.29,vertexColors:true
    });
    const hardware=new THREE.MeshStandardMaterial({color:flight.hardware,roughness:.59,metalness:.47});
    const dark=new THREE.MeshStandardMaterial({color:flight.dark,roughness:.63,metalness:.37});
    const trim=new THREE.MeshStandardMaterial({color:flight.trim,roughness:.45,metalness:.52});
    const light=new THREE.MeshBasicMaterial({color:flight.light,toneMapped:false});
    const backing=new THREE.MeshBasicMaterial({color:flight.id==='farline' ? 0x121b21 : 0x211815});
    const batches=new Map();
    const scratch=new THREE.Object3D();
    function part(geometry,material,x,y,z,w,h,d,pitch=0,yaw=0,roll=0) {
      if (!batches.has(geometry)) batches.set(geometry,new Map());
      const materials=batches.get(geometry);
      if (!materials.has(material)) materials.set(material,[]);
      scratch.position.set(x,y,z);
      scratch.scale.set(w,h,d);
      scratch.rotation.set(pitch,yaw,roll);
      scratch.updateMatrix();
      materials.get(material).push(scratch.matrix.clone());
    }
    const hull=new THREE.Mesh(makeHull(THREE,flight),shell);
    hull.name='portfolio-blimp-envelope';
    craft.add(hull);

    const display=makeCampaign?.(flight.id,{
      displayAspect:flight.displayWidth/flight.displayHeight,artShare:.34,airborne:true
    });
    for (const side of [-1,1]) {
      const frame=new THREE.Mesh(displaySurface(THREE,flight,side,flight.displayWidth+1.31,flight.displayHeight+.86,.145),trim);
      const recess=new THREE.Mesh(displaySurface(THREE,flight,side,flight.displayWidth+.32,flight.displayHeight+.24,.21),backing);
      frame.name='portfolio-blimp-display-housing';
      craft.add(frame,recess);
      if (display) {
        const panel=new THREE.Mesh(displaySurface(THREE,flight,side,flight.displayWidth,flight.displayHeight,.275),display.material);
        panel.name='portfolio-blimp-ad';
        craft.add(panel);
      }
      for (const z of [-.42*flight.displayWidth,.42*flight.displayWidth]) {
        const profile=section(flight,z+flight.displayZ);
        for (const edge of [-1,1]) {
          const y=flight.displayY+edge*flight.displayHeight*.56;
          const x=profile.width*Math.sqrt(Math.max(0,1-((y-profile.y)/profile.height)**2));
          part(box,hardware,side*(x+.025),y,z+flight.displayZ,.49,.34,.82);
          if (edge<0) part(box,light,side*(x+.279),y,z+flight.displayZ,.026,.11,.56);
        }
      }
    }

    if (flight.id==='farline') {
      const tail=stabilizer(THREE,10.8,6.0,.52);
      part(tail,hardware,0,3.22,-21.9,1,1,1);
      part(tail,hardware,0,-3.26,-21.9,1,.83,1,0,0,Math.PI);
      part(box,lightRed,0,8.83,-25.6,.39,.30,.75);
      part(sphere,hardware,0,-7.75,3.81,2.30,2.10,8.5);
      part(sphere,dark,0,-9.08,4.41,2.10,1.53,7.19);
      part(box,light,0,-10.53,4.43,1.94,.13,6.8);
      for (const side of [-1,1]) {
        part(tail,hardware,side*2.64,-.23,-21.39,.77,.98,.80,0,0,-side*Math.PI/2);
        part(box,hardware,side*4.65,-6.09,-8.74,4.61,.60,2.29,0,0,-side*.29);
        part(sphere,dark,side*6.75,-6.40,-8.5,1.19,1.40,3.55);
        part(ring,trim,side*6.75,-6.40,-10.32,1.09,1.17,1.0);
        part(ring,light,side*6.75,-6.40,-10.73,.86,.94,.70);
        part(box,side<0 ? lightRed : lightGreen,side*8.25,-.23,-24.69,.37,.31,.79);
        for (let i=0;i<5;i++) part(box,light,side*1.93,-9.36,.93+1.38*i,.13,.37,1.03);
      }
    } else {
      const tail=stabilizer(THREE,9.1,5.3,.60);
      part(box,trim,0,1.94,-20.0,11.75,.64,4.2);
      part(sphere,dark,0,-6.80,1.13,4.49,1.48,8.9);
      part(box,trim,0,-8.0,1.89,4.83,.41,11.75);
      part(box,light,0,-8.25,2.43,3.28,.11,7.02);
      for (const side of [-1,1]) {
        part(tail,hardware,side*5.25,1.99,-20.9,1,1,1,0,0,-side*.115);
        part(box,side<0 ? lightRed : lightGreen,side*5.83,7.0,-24.10,.40,.29,.70);
        part(sphere,trim,side*5.14,-4.41,-5.99,2.35,2.57,9.33);
        part(sphere,dark,side*6.72,-5.65,-8.62,1.45,1.79,6.40);
        part(ring,dark,side*6.72,-5.65,-11.36,1.39,1.68,1.15);
        part(ring,light,side*6.72,-5.65,-11.77,1.11,1.38,.74);
        part(box,light,side*6.68,-7.04,-5.54,.28,.18,4.48);
        part(box,trim,side*2.28,-7.84,5.33,.29,.36,5.39);
        for (const z of [-1.53,2.28,6.11]) part(box,light,side*2.08,-8.20,z,.97,.13,.26);
      }
    }
    part(sphere,light,0,.16,flight.length+.04,.47,.47,.33);

    for (const [geometry,materials] of batches) {
      for (const [material,transforms] of materials) {
        const mesh=new THREE.InstancedMesh(geometry,material,transforms.length);
        mesh.name='portfolio-blimp-fittings';
        transforms.forEach((transform,i)=>mesh.setMatrixAt(i,transform));
        if (mesh.computeBoundingSphere) mesh.computeBoundingSphere();
        craft.add(mesh);
      }
    }
    return {craft,display};
  }

  function attach(THREE,world,{reducedMotion=false}={}) {
    const airspace=new THREE.Group();
    airspace.name='portfolio-airship-flight';
    const primitives={
      sphere:new THREE.SphereGeometry(1,20,12),box:new THREE.BoxGeometry(1,1,1),
      ring:new THREE.TorusGeometry(1,.16,7,24),
      lightRed:new THREE.MeshBasicMaterial({color:0xf98169,toneMapped:false}),
      lightGreen:new THREE.MeshBasicMaterial({color:0x91f5a5,toneMapped:false})
    };
    const clock={value:0};
    const makeCampaign=root.DrivePortfolioCorporateAds?.createCampaignDisplay;
    const pilots=flights.map(flight=>{
      const {craft,display}=buildCraft(THREE,flight,primitives,(id,options)=>makeCampaign?.(
        THREE,id,{...options,clock,reducedMotion}
      ));
      airspace.add(craft);
      return {flight,craft,display};
    });

    // Both vessels use the same clock so their separation is preserved at any frame rate.
    let progress=0, disposed=false;
    function update(delta=0) {
      if (disposed) return;
      if (!reducedMotion) {
        clock.value+=delta;
        progress=(progress+delta*speed)%turn;
      }
      for (const {flight,craft} of pilots) {
        const phase=flight.phase+progress, sin=Math.sin(phase), cos=Math.cos(phase);
        const altitude=flight.altitude+flight.drift*Math.cos(phase-.39)+1.34*Math.sin(phase*2);
        craft.position.set(flight.x+flight.radiusX*cos,altitude,flight.z+flight.radiusZ*sin);
        craft.rotation.set(.024*Math.sin(phase*2),Math.atan2(-flight.radiusX*sin,flight.radiusZ*cos),.032,'YXZ');
      }
    }
    update();
    world.add(airspace);
    return {
      update,
      ready:Promise.all(pilots.map(({display})=>display?.ready ?? false)),
      dispose() {
        if (disposed) return;
        disposed=true;
        world.remove(airspace);
        const geometries=new Set(), materials=new Set();
        const campaignMaterials=new Set(pilots.map(({display})=>display?.material));
        airspace.traverse(object=>{
          if (object.geometry) geometries.add(object.geometry);
          if (object.material && !campaignMaterials.has(object.material)) materials.add(object.material);
          if (object.isInstancedMesh) object.dispose?.();
        });
        geometries.forEach(geometry=>geometry.dispose());
        materials.forEach(material=>material.dispose());
        for (const {display} of pilots) display?.dispose();
        airspace.clear();
      }
    };
  }

  root.DrivePortfolioAirship={attach};
})(globalThis);
