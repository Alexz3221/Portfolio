/* Lightweight, original U9 Xtreme-inspired bodywork. +Z is forward. */
(function(root) {
  'use strict';

  function build(THREE, spec) {
    const group = new THREE.Group();
    group.name = 'U9 Xtreme inspired model';
    const body = new THREE.Group();
    body.name = 'low bodywork';
    // The authored proportions use convenient coordinates; compress their Y
    // span to the real car height without shrinking the physical wheels.
    body.position.y = .20;
    body.scale.y = Math.min(1, ((spec.height || 1.35) - body.position.y) / 1.79);
    body.scale.z = .96;
    group.add(body);
    const width = spec.width, length = spec.length;
    const paint = new THREE.MeshStandardMaterial({color:0x24282f, metalness:.7, roughness:.25});
    const highlight = new THREE.MeshStandardMaterial({color:0x394047, metalness:.75, roughness:.25});
    const carbon = new THREE.MeshStandardMaterial({color:0x10161c, metalness:.22, roughness:.7});
    const glass = new THREE.MeshStandardMaterial({color:0x122633, metalness:.35, roughness:.19});
    const accent = new THREE.MeshStandardMaterial({color:0xb2c4c7, metalness:.75, roughness:.26});
    const headlight = new THREE.MeshBasicMaterial({color:0xe8f6ff});
    const rearLamp = new THREE.MeshBasicMaterial({color:0xff354e});
    const tyre = new THREE.MeshStandardMaterial({color:0x101113, metalness:0, roughness:.95});
    const rim = new THREE.MeshStandardMaterial({color:0x60696e, metalness:.85, roughness:.32});

    function mesh(geometry, material, parent=body) {
      const object = new THREE.Mesh(geometry, material);
      object.castShadow = true;
      object.receiveShadow = true;
      parent.add(object);
      return object;
    }
    function box(material, x, y, z, sx, sy, sz, parent=body) {
      const object = mesh(new THREE.BoxGeometry(sx, sy, sz), material, parent);
      object.position.set(x, y, z);
      return object;
    }
    // Each ring is a six-point cross section: lower corners, shoulders, roof.
    function shell(rings, material) {
      const points=[];
      const vertex=(ring,index)=>{
        const [z,lower,shoulder,roof,bottomY,shoulderY,roofY]=ring;
        const coords=[[-lower,bottomY],[lower,bottomY],[shoulder,shoulderY],
          [roof,roofY],[-roof,roofY],[-shoulder,shoulderY]];
        return [coords[index][0],coords[index][1],z];
      };
      const triangle=(a,b,c)=>points.push(...a,...b,...c);
      for(let station=0;station<rings.length-1;station++) {
        for(let edge=0;edge<6;edge++) {
          const next=(edge+1)%6;
          const a=vertex(rings[station],edge), b=vertex(rings[station],next);
          const c=vertex(rings[station+1],next), d=vertex(rings[station+1],edge);
          triangle(a,b,c); triangle(a,c,d);
        }
      }
      for(let edge=1;edge<5;edge++) {
        triangle(vertex(rings[0],0),vertex(rings[0],edge+1),vertex(rings[0],edge));
        triangle(vertex(rings[rings.length-1],0),vertex(rings[rings.length-1],edge),vertex(rings[rings.length-1],edge+1));
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
      geometry.computeVertexNormals();
      return mesh(geometry,material);
    }

    // Low faceted tub, wedge nose, and a separate dark canopy.
    shell([
      [-length*.48,width*.31,width*.42,width*.26,.68,1.06,1.20],
      [-length*.31,width*.34,width*.48,width*.30,.67,1.12,1.28],
      [0,width*.33,width*.47,width*.29,.67,1.08,1.30],
      [length*.30,width*.33,width*.46,width*.26,.69,1.04,1.17],
      [length*.49,width*.27,width*.39,width*.17,.70,.94,1.02]
    ],paint);
    shell([
      [-length*.28,width*.26,width*.28,width*.12,1.20,1.30,1.33],
      [-length*.15,width*.30,width*.28,width*.18,1.20,1.57,1.68],
      [length*.04,width*.30,width*.27,width*.17,1.20,1.58,1.70],
      [length*.23,width*.25,width*.21,width*.08,1.17,1.30,1.34]
    ],glass);
    // A narrow roof spine and angled side sills give the body readable edges.
    box(highlight,0,1.71,-length*.045,width*.05,.025,length*.20);
    for(const side of [-1,1]) {
      box(carbon,side*width*.45,.77,0,width*.085,.13,length*.72);
      box(highlight,side*width*.39,1.13,length*.36,width*.13,.08,length*.23);
      box(highlight,side*width*.41,1.14,-length*.34,width*.12,.08,length*.22);
      box(carbon,side*width*.42,1.05,-length*.03,width*.09,.06,length*.22);
      // Two slim lamps on each side, with a dark separator between them.
      for(let lamp=0;lamp<2;lamp++)
        box(headlight,side*(width*.28+lamp*width*.072),1.03,length*.488,
          width*.058,.035,.025);
      box(carbon,side*width*.44,.79,length*.49,width*.09,.085,.14);
      // Rear aero endplate and supports.
      box(carbon,side*width*.35,1.43,-length*.42,.065,.53,.085);
      box(carbon,side*width*.465,1.65,-length*.45,.045,.27,.42);
      // Vertical diffuser fins under the tail.
      box(carbon,side*width*.30,.66,-length*.485,.04,.17,.19);
    }
    // Front splitter, sculpted hood channel, tall rear wing, and tail bar.
    box(carbon,0,.66,length*.495,width*.93,.065,.31);
    box(carbon,0,.90,length*.495,width*.49,.16,.08);
    box(carbon,0,1.20,length*.355,width*.38,.035,length*.22);
    box(carbon,0,1.69,-length*.45,width*.96,.09,.42);
    box(highlight,0,1.73,-length*.45,width*.90,.018,.30);
    box(rearLamp,0,1.07,-length*.49,width*.83,.055,.025);
    for(const side of [-1,1])
      box(rearLamp,side*width*.43,1.06,-length*.49,width*.07,.11,.025);
    box(carbon,0,.79,-length*.50,width*.78,.20,.16);
    box(accent,0,.66,-length*.495,width*.38,.025,.04);

    // Wheel order matches the four RaycastVehicle wheelLayout entries.
    const wheels=spec.wheelLayout.map((axle,index)=>{
      const radius=axle.radius;
      const pivot=new THREE.Group();
      pivot.name='u9-wheel-pivot-'+index;
      pivot.position.set(axle.x,radius+.08,axle.z);
      group.add(pivot);
      const wheel=new THREE.Group();
      pivot.add(wheel);
      const tireBody=mesh(new THREE.CylinderGeometry(radius,radius,.31,20),tyre,wheel);
      tireBody.geometry.rotateZ(Math.PI/2);
      const inner=mesh(new THREE.CylinderGeometry(radius*.66,radius*.66,.325,16),rim,wheel);
      inner.geometry.rotateZ(Math.PI/2);
      // Visible outer wheel face, five spokes, and a small center lock.
      const outer=axle.x>0?.12:-.12;
      const face=mesh(new THREE.CylinderGeometry(radius*.55,radius*.55,.018,16),carbon,wheel);
      face.geometry.rotateZ(Math.PI/2);
      face.position.x=outer;
      for(let spoke=0;spoke<5;spoke++) {
        const bar=box(rim,outer+(axle.x>0?.015:-.015),0,0,.025,radius*.95,.055,wheel);
        bar.rotation.x=spoke*Math.PI*2/5;
      }
      const center=mesh(new THREE.CylinderGeometry(radius*.14,radius*.14,.04,12),accent,wheel);
      center.geometry.rotateZ(Math.PI/2);
      center.position.x=outer+(axle.x>0?.032:-.032);
      return {pivot,wheel,front:axle.z>0};
    });
    group.visible=false;
    return {group,wheels,rearLamp};
  }

  root.DriveU9XtremeModel={build};
})(typeof globalThis!=='undefined'?globalThis:this);
