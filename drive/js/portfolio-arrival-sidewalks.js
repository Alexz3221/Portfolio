(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePortfolioArrivalSidewalks = api;
})(globalThis, function () {
  'use strict';

  const textureFile = typeof document !== 'undefined' && document.currentScript?.src
    ? new URL('../assets/portfolio/arrival-sidewalk.webp', document.currentScript.src).href
    : 'assets/portfolio/arrival-sidewalk.webp';
  const start = -118.7, end = -43.1;
  const height = .17, grade = .072, verge = 7.04;
  const crossing = -73.6;
  const curbWidth = .29;
  const easement = {
    '-1': [[-118.7,9.1],[-94,9.2],[-91,10.2],[-79,10.7],[-68,10.7],[-65,11.7],[-43.1,11.9]],
    '1': [[-118.7,8.72],[-96,8.72],[-91.2,13.64],[-82.2,13.64],[-76,12.2],[-69,12.2],[-65,11.1],[-43.1,11.45]]
  };
  const marketFrontage = [[-86.5,-11.95],[-62.2,-11.95],[-59,-10.39],[-56.5,-9.22],[-53.9,-7.84]];
  const marketStart=marketFrontage[0][0], marketEnd=marketFrontage.at(-1)[0];
  const marketWall=-5.92;

  function smooth(value) {
    const t = Math.max(0, Math.min(1, value));
    return t*t*(3-2*t);
  }

  function outline(z) {
    // Blend around the wider Projects approach where its rounded entrance
    // begins to overlap the 14 m street.
    return Math.max(verge, .04 + Math.sqrt(Math.max(0, 9.5**2-(z+38)**2)));
  }

  function along(points, distance) {
    for (let i=1; i<points.length; i++) {
      const [start,a] = points[i-1], [end,b] = points[i];
      if (distance<=end) return a+(b-a)*Math.max(0,(distance-start)/(end-start));
    }
    return points.at(-1)[1];
  }

  function top(z, distance) {
    const connection = Math.min(smooth((z-start)/3.2), smooth((end-z)/4.15));
    const cut = smooth((Math.abs(z-crossing)-1.48)/1.75);
    const landing = Math.max(cut, smooth((distance-curbWidth)/1.18));
    return grade+(height-grade)*connection*landing;
  }

  function marketTop(x) {
    const gradeChange=Math.min(smooth((x-marketStart)/2.5),smooth((marketEnd-x)/1.55));
    return grade+(height-grade)*gradeChange;
  }

  function surfaceHeight(x,z) {
    if (z>=start && z<=end && Math.abs(x)>=outline(z) && Math.abs(x)<=along(easement[Math.sign(x)],z))
      return top(z,Math.abs(x)-outline(z));
    if (x>=marketStart && x<=marketEnd && z>=along(marketFrontage,x) && z<=marketWall)
      return marketTop(x);
    return 0;
  }

  function footprint() {
    // Leave the surrounding network out of the lowered crossing, food apron,
    // and storefront pads, including the narrow joint next to the road.
    const arrival = [-1,1].map(side => {
      const stations=[...new Set(easement[side].map(([z])=>z).concat([-45,-44.5,-44.05,-43.6]))].sort((a,b)=>a-b);
      const inner=stations.map(z=>[side*(outline(z)-.075),z]);
      const outer=stations.map(z=>[side*along(easement[side],z),z]).reverse();
      return [inner.concat(outer)];
    });
    return arrival.concat([[marketFrontage.map(([x,z])=>[x,z-.035])
      .concat([[marketEnd,marketWall],[marketStart,marketWall]])]]);
  }

  function quads() { return {positions:[], colors:[], uvs:[]}; }

  function face(batch, points, tint, reverse = false) {
    const corners = reverse ? [0,2,1,0,3,2] : [0,1,2,0,2,3];
    for (const index of corners) {
      const [x,y,z]=points[index];
      batch.positions.push(x,y,z);
      batch.uvs.push(x/2.6,z/2.6);
      batch.colors.push(tint,tint,tint);
    }
  }

  function geometry(THREE, batch) {
    const mesh = new THREE.BufferGeometry();
    mesh.setAttribute('position', new THREE.Float32BufferAttribute(batch.positions,3));
    mesh.setAttribute('uv', new THREE.Float32BufferAttribute(batch.uvs,2));
    mesh.setAttribute('color', new THREE.Float32BufferAttribute(batch.colors,3));
    mesh.computeVertexNormals();
    return mesh;
  }

  function slab(C, body, top) {
    const count=top.length, center=[0,0,0];
    for (const [x,y,z] of top) {
      center[0]+=x/count;
      center[1]+=(y-.035)/(2*count);
      center[2]+=z/count;
    }
    const relative=([x,y,z])=>new C.Vec3(x-center[0],y-center[1],z-center[2]);
    const vertices=top.map(relative).concat(top.map(([x,,z])=>relative([x,-.035,z])));
    const upper=top.map((_,index)=>index);
    const lower=upper.map(index=>index+count).reverse();
    const faces=[upper,lower];
    for(let index=0;index<count;index++) {
      const next=(index+1)%count;
      faces.push([index,index+count,next+count,next]);
    }
    const offset=new C.Vec3(center[0]-body.position.x,center[1],center[2]-body.position.z);
    body.addShape(new C.ConvexPolyhedron(vertices,faces),offset);
  }

  function attach(THREE, world, physics) {
    const district = new THREE.Group();
    district.name = 'portfolio-arrival-sidewalks';
    world.add(district);
    const C = globalThis.CANNON;
    let removed = false;
    const collisions=[];
    const stone = new THREE.MeshStandardMaterial({color:0xaaa7a4,roughness:.89,vertexColors:true});
    if (typeof document !== 'undefined') {
      const texture = new THREE.TextureLoader().load(textureFile, ready => {
        if (removed) ready.dispose();
        else {
          stone.map = ready;
          stone.needsUpdate = true;
        }
      });
      texture.name = 'arrival-sidewalk-paving';
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.encoding = THREE.sRGBEncoding;
      texture.anisotropy = 4;
    }
    const curb = new THREE.MeshStandardMaterial({color:0x414955,roughness:.88,vertexColors:true});
    const bevel = new THREE.MeshStandardMaterial({color:0x697381,roughness:.79,vertexColors:true});
    const cracks = new THREE.MeshStandardMaterial({color:0x171a1e,roughness:1,vertexColors:true});
    const steel = new THREE.MeshStandardMaterial({color:0x41484d,metalness:.49,roughness:.69,vertexColors:true});
    const paint = new THREE.MeshStandardMaterial({color:0xc7c2ac,roughness:.88,vertexColors:true});
    const tactile = new THREE.MeshStandardMaterial({color:0x816843,roughness:.9,vertexColors:true});
    const marker = new THREE.MeshBasicMaterial({color:0xe2b382,vertexColors:true,toneMapped:false});
    const slabFaces=quads(), curbFaces=quads(), bevelFaces=quads(), jointFaces=quads();
    const steelFaces=quads(), paintFaces=quads(), tactileFaces=quads(), lightFaces=quads();

    function asphaltDetail(batch,x1,x2,z1,z2,y,tint) {
      face(batch, [[x1,y,z1],[x2,y,z1],[x2,y,z2],[x1,y,z2]], tint, true);
    }

    const at = value => () => value;
    const vergeSide = at(0), bevelDepth=at(.075), kerbBack=at(curbWidth);

    function stripCollision(stations, width, point, reverse) {
      if (!C || !physics?.world) return;
      const ordered=[...new Set(stations)].sort((a,b)=>a-b);
      for(let i=0;i<ordered.length-1;i++) {
        const a=ordered[i], b=ordered[i+1];
        const [x,,z]=point((a+b)/2,width((a+b)/2)/2,0);
        const body=new C.Body({mass:0,position:new C.Vec3(x,0,z)});
        const divide = [vergeSide,kerbBack,station=>Math.min(1.47,width(station)),width];
        for(let part=0;part<divide.length-1;part++) {
          const inner=divide[part], outer=divide[part+1];
          if (outer(a)-inner(a)<.012 || outer(b)-inner(b)<.012) continue;
          const top=[point(a,inner(a),0),point(a,outer(a),0),point(b,outer(b),0),point(b,inner(b),0)];
          if (reverse) top.reverse();
          const [p,q,r,s]=top;
          const n=new THREE.Vector3().fromArray(q).sub(new THREE.Vector3().fromArray(p))
            .cross(new THREE.Vector3().fromArray(r).sub(new THREE.Vector3().fromArray(p)));
          const bent=Math.abs(n.dot(new THREE.Vector3().fromArray(s).sub(new THREE.Vector3().fromArray(p))))>.00001;
          if (bent) {
            slab(C,body,[p,q,r]);
            slab(C,body,[p,r,s]);
          } else slab(C,body,top);
        }
        physics.world.addBody(body);
        collisions.push(body);
      }
    }

    function buildStrip(first,last,knots,width,point,reverse) {
      function patch(batch,a,b,measure1,measure2,tint,lift=0) {
        face(batch,[point(a,measure1(a),lift),point(a,measure2(a),lift),
          point(b,measure2(b),lift),point(b,measure1(b),lift)],tint,reverse);
      }
      const rampBack=station=>Math.min(1.47,width(station));
      const breaks = [first,last,...knots];
      for (let station=first; station<last; station+=.48) breaks.push(station);
      const cuts = [...new Set(breaks)].sort((a,b)=>a-b);
      for (let i=0; i<cuts.length-1; i++) {
        const a=cuts[i], b=cuts[i+1];
        const t = .74+.23*((i*67+(reverse?17:0)+596)%31)/30;
        const foot = station => { const [x,,z]=point(station,0,0); return [x,0,z]; };
        face(curbFaces,[foot(a),foot(b),point(b,0,-.031),point(a,0,-.031)],t,!reverse);
        face(bevelFaces,[point(a,0,-.031),point(a,.075,0),point(b,.075,0),point(b,0,-.031)],t+.055,reverse);
        patch(curbFaces,a,b,bevelDepth,kerbBack,t);
        patch(slabFaces,a,b,kerbBack,rampBack,.88+t*.11);
        patch(slabFaces,a,b,rampBack,width,.79+t*.17);
      }

      // The darker joints are wide enough to read in a moving camera and are
      // staggered behind the narrow stones that edge the road.
      for (let station=first+2.2; station<last-.35; station+=1.43) {
        patch(jointFaces,station-.016,station+.016,bevelDepth,kerbBack,.75,.003);
        patch(jointFaces,station-.012,station+.012,kerbBack,t=>Math.min(1.76,width(t)),.74,.004);
        if (station+.71<last && width(station+.7)>1.8)
          patch(jointFaces,station+.681,station+.708,t=>Math.min(1.8,width(t)),width,.73,.004);
      }
      for (let i=0; i<cuts.length-1; i++) {
        const a=cuts[i],b=cuts[i+1];
        patch(jointFaces,a,b,at(.30),at(.327),.85,.004);
        if (width(a)>1.76 || width(b)>1.76)
          patch(jointFaces,a,b,t=>Math.min(1.745,width(t)),t=>Math.min(1.773,width(t)),.77,.004);
      }
      return patch;
    }

    for (const side of [-1,1]) {
      const width = z => along(easement[side],z)-outline(z);
      const point = (z,depth,lift) => [side*(outline(z)+depth),top(z,depth)+lift,z];
      const crosswalkKnots = [crossing-3.23,crossing-1.48,crossing+1.48,crossing+3.23];
      const cuts = easement[side].map(([z])=>z).concat(crosswalkKnots);
      const patch = buildStrip(start,end,cuts,width,point,side>0);
      stripCollision(cuts.concat(start+1.6,start+3.2,crossing-2.3,crossing+2.3,
        end-4.15,end-2.4,-44.5,-44.05,-43.60),width,point,side>0);

      // Bolted tactile insert panels tell pedestrians where the lowered crossing starts.
      patch(tactileFaces,crossing-1.41,crossing+1.41,at(.35),at(.94),.86,.009);
      for (let z=crossing-1.32; z<crossing+1.4; z+=.17) {
        for (let d=.39; d<.91; d+=.13) patch(bevelFaces,z,z+.051,at(d),at(d+.054),.83,.013);
      }

      for (const z of [-109,-97,-83,-66,-51]) {
        const x=side*6.81;
        asphaltDetail(jointFaces,x-.177,x+.177,z-.46,z+.46,.055,.88);
        for (let offset=-.35; offset<.36; offset+=.11)
          asphaltDetail(steelFaces,x-.157,x+.157,z+offset,z+offset+.031,.059,.76);
      }
      for (const z of [-113,-106,-99,-92,-86,-80,-66,-58,-50]) {
        patch(steelFaces,z-.49,z+.49,at(.093),at(.222),.92,.006);
        patch(lightFaces,z-.43,z+.43,at(.121),at(.178),side>0?.85:.55,.009);
      }
    }

    // North Market's pavers reach the two shop doors and the vendor tables.
    // The curb turns with the side street so it stays outside the through lanes.
    const marketCurb=x=>along(marketFrontage,x);
    const marketWidth=x=>marketWall-marketCurb(x);
    const marketPoint=(x,depth,lift)=>[x,marketTop(x)+lift,marketCurb(x)+depth];
    const marketPatch=buildStrip(marketStart,marketEnd,marketFrontage.map(([x])=>x),marketWidth,marketPoint,false);
    stripCollision(marketFrontage.map(([x])=>x).concat(marketStart+1.25,marketStart+2.50,
      marketEnd-1.55,marketEnd-.775),marketWidth,marketPoint,false);
    for (const x of [-82.5,-76.2,-70,-63.1,-57.12]) {
      marketPatch(steelFaces,x-.58,x+.58,at(.095),at(.235),.75,.006);
      marketPatch(lightFaces,x-.47,x+.47,at(.125),at(.165),.46,.009);
    }
    for (const x of [-78.9,-65.6]) {
      marketPatch(jointFaces,x-.56,x+.56,at(.68),at(1.21),.83,.006);
      for(let slot=0;slot<7;slot++) {
        const leg=x-.46+slot*.137;
        marketPatch(steelFaces,leg,leg+.062,at(.73),at(1.16),.87,.009);
      }
    }

    // Neither lane is blocked at the pedestrian crossing. The short broken
    // stripe segments expose some road between the worn strips.
    for (let i=0;i<14;i++) {
      const x=-6.65+i*.975;
      const n=((i*7)%11)*.012;
      asphaltDetail(paintFaces,x,x+.5-n,crossing-1.27,crossing+1.27,.057,.68+n);
      asphaltDetail(paintFaces,x+.022,x+.47,crossing-1.46+n,crossing-1.27,.057,.49+n);
      asphaltDetail(paintFaces,x+.065,x+.445,crossing+1.27,crossing+1.47-n,.057,.62+n);
    }

    function add(name,batch,material) {
      const mesh = new THREE.Mesh(geometry(THREE,batch),material);
      mesh.name = name;
      mesh.receiveShadow = true;
      district.add(mesh);
    }
    add('arrival-sidewalk-stone',slabFaces,stone);
    add('arrival-sidewalk-curbs',curbFaces,curb);
    add('arrival-sidewalk-bevels',bevelFaces,bevel);
    add('arrival-sidewalk-joints',jointFaces,cracks);
    add('arrival-sidewalk-drainage',steelFaces,steel);
    add('arrival-pedestrian-crossing',paintFaces,paint);
    add('arrival-crossing-tactile-pads',tactileFaces,tactile);
    add('arrival-sidewalk-markers',lightFaces,marker);

    return {dispose() {
      removed = true;
      for (const body of collisions) physics.world.removeBody(body);
    }};
  }

  return {attach,surfaceHeight,footprint};
});
