(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./vendor/polygon-clipping-0.15.7.min.js'));
  } else if (root.polygonClipping) {
    root.DrivePortfolioStreets = factory(root.polygonClipping);
  }
})(globalThis, function (polygons) {
  'use strict';

  const surfaceY=.17, graniteY=.146, kerbY=.117, chamferWidth=.075, curbDepth=.30, walkWidth=2.35;
  const sidewalkSurfaces = new WeakMap();

  function streetFootprint(roads, areas, margin) {
    const junctions = new Map();
    const shapes = [];
    for (const {x1,z1,x2,z2,width} of roads) {
      const dx = x2-x1, dz = z2-z1;
      const length = Math.hypot(dx,dz);
      if (length < .01) continue;
      const radius = width/2 + margin;
      const ox = -dz/length*radius, oz = dx/length*radius;
      shapes.push([[
        [x1+ox,z1+oz], [x2+ox,z2+oz], [x2-ox,z2-oz], [x1-ox,z1-oz]
      ]]);
      for (const [x,z] of [[x1,z1],[x2,z2]]) {
        const key = x + ',' + z;
        const previous = junctions.get(key);
        if (!previous || previous.radius < radius) junctions.set(key,{x,z,radius});
      }
    }

    // The rounded caps fill the outside of bends and blend into connecting
    // streets. Unioning the caps and strips removes shared triangle faces.
    for (const {x,z,radius} of junctions.values()) {
      const ring = [];
      for (let step=0; step<32; step++) {
        const angle = step*Math.PI/16;
        ring.push([x+Math.cos(angle)*radius,z+Math.sin(angle)*radius]);
      }
      shapes.push([ring]);
    }
    for (const {x,z,w,d} of areas) {
      const a = w/2+margin, b = d/2+margin;
      shapes.push([[[x-a,z-b],[x+a,z-b],[x+a,z+b],[x-a,z+b]]]);
    }
    return shapes.length ? polygons.union(...shapes) : [];
  }

  function surface(THREE, world, area, y, material, name, metersPerTile) {
    if (!area.length) return null;
    const points = ring => ring.slice(0,-1).map(([x,z]) => new THREE.Vector2(x,-z));
    const shapes = area.map(([outline,...holes]) => {
      const shape = new THREE.Shape(points(outline));
      shape.holes = holes.map(hole => new THREE.Path(points(hole)));
      return shape;
    });
    const geometry = new THREE.ShapeGeometry(shapes);
    geometry.rotateX(-Math.PI/2);
    const uv = geometry.getAttribute('uv');
    const location = geometry.getAttribute('position');
    const scaleX = metersPerTile*(material.map?.repeat.x || 1);
    const scaleY = metersPerTile*(material.map?.repeat.y || 1);
    for (let index=0; index<uv.count; index++) {
      const x=location.getX(index), z=location.getZ(index);
      location.setY(index,typeof y==='function' ? y(x,z) : y);
      uv.setXY(index,x/scaleX,z/scaleY);
    }
    if (typeof y==='function') geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry,material);
    mesh.name = name;
    mesh.receiveShadow = true;
    world.add(mesh);
    return mesh;
  }

  function curbSides(THREE, world, area, y, material, name) {
    const positions=[];
    for (const polygon of area) for (const ring of polygon) {
      for (let i=0; i<ring.length-1; i++) {
        const [x,z]=ring[i], [nx,nz]=ring[i+1];
        positions.push(x,.002,z,nx,.002,nz,nx,y,nz, x,.002,z,nx,y,nz,x,y,z);
      }
    }
    if (!positions.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.computeVertexNormals();
    const edge = new THREE.Mesh(geometry,material);
    edge.name=name;
    edge.receiveShadow=true;
    world.add(edge);
  }

  function contains(area, x, z) {
    function inRing(ring) {
      let inside=false;
      for (let i=0, j=ring.length-1; i<ring.length; j=i++) {
        const [ax,az]=ring[j], [bx,bz]=ring[i];
        if ((az>z)!==(bz>z) && x < (bx-ax)*(z-az)/(bz-az)+ax) inside=!inside;
      }
      return inside;
    }
    return area.some(([outline,...holes])=>inRing(outline) && !holes.some(inRing));
  }

  function chamferHeight(area,x,z) {
    let closest=1;
    for (const polygon of area) for (const ring of polygon) for (let i=0;i<ring.length-1;i++) {
      const [ax,az]=ring[i], [bx,bz]=ring[i+1];
      const dx=bx-ax, dz=bz-az, length=dx*dx+dz*dz;
      if (length<.000001) continue;
      const along=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/length));
      const acrossX=x-(ax+along*dx), acrossZ=z-(az+along*dz);
      closest=Math.min(closest,acrossX*acrossX+acrossZ*acrossZ);
    }
    return kerbY+(graniteY-kerbY)*Math.min(1,Math.sqrt(closest)/chamferWidth);
  }

  function weatherMesh(THREE, mesh) {
    if(!mesh) return;
    const position=mesh.geometry.attributes.position;
    const colors=[];
    for(let i=0;i<position.count;i++) {
      const x=position.getX(i), z=position.getZ(i);
      const wear=.89+.07*Math.sin(x*.38+z*.14)+.06*Math.sin(x*.73-z*.09);
      colors.push(wear,wear,wear*.97);
    }
    mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  }

  function build(THREE, world, {roads, areas, asphalt, curb, premium=globalThis.DrivePortfolioArrivalSidewalks?.footprint()}) {
    const pavement = streetFootprint(roads,areas,0);
    if (!pavement.length) return;
    const chamfer = streetFootprint(roads,areas,chamferWidth);
    const granite = streetFootprint(roads,areas,curbDepth);
    const offset = streetFootprint(roads,areas,walkWidth);
    const exclusions = premium?.length ? [premium] : [];
    const sidewalk = polygons.difference(offset,granite,...exclusions);
    const apron = polygons.difference(granite,chamfer,...exclusions);
    const bevel = polygons.difference(chamfer,pavement,...exclusions);
    surface(THREE,world,pavement,.044,asphalt,'portfolio-streets',4);
    const slabs=curb.clone();
    slabs.color.multiplyScalar(1.42);
    slabs.roughness=.94;
    slabs.vertexColors=true;
    const cap=new THREE.MeshStandardMaterial({color:0x505963,roughness:.86});
    const wedge=new THREE.MeshStandardMaterial({color:0x6c747c,roughness:.82});
    const wall=new THREE.MeshStandardMaterial({color:0x262a2f,roughness:.94,side:THREE.DoubleSide});
    const innerWall=new THREE.MeshStandardMaterial({color:0x414a56,roughness:.88,side:THREE.DoubleSide});
    const slabMesh=surface(THREE,world,sidewalk,surfaceY,slabs,'portfolio-curbs',2.8);
    const lipMesh=surface(THREE,world,apron,graniteY,cap,'portfolio-granite-curb',1.8);
    const bevelMesh=surface(THREE,world,bevel,(x,z)=>chamferHeight(pavement,x,z),wedge,'portfolio-curb-bevel',1.8);
    weatherMesh(THREE,slabMesh);
    // The narrow granite strip sits below the slabs. Separate vertical faces
    // step down to it and to the road, including along the curves of a junction.
    curbSides(THREE,world,sidewalk,surfaceY,wall,'portfolio-sidewalk-faces');
    curbSides(THREE,world,bevel,kerbY,innerWall,'portfolio-curb-faces');
    if (slabMesh) sidewalkSurfaces.set(world,{pavement,sidewalk,apron,bevel,slabMesh,lipMesh,bevelMesh});
  }

  function activeSurfaces(world) {
    const active=sidewalkSurfaces.get(world);
    return active?.slabMesh.parent===world ? active : null;
  }

  function surfaceHeight(world,x,z) {
    const active=activeSurfaces(world);
    if (!active) return 0;
    if (contains(active.sidewalk,x,z)) return surfaceY;
    if (contains(active.apron,x,z)) return graniteY;
    return contains(active.bevel,x,z) ? chamferHeight(active.pavement,x,z) : 0;
  }

  function attachSidewalkPhysics(world, physics) {
    const active=activeSurfaces(world);
    if (!active || !physics?.addStaticSurface) return null;
    const tiles=new Map(), tileSize=32;
    for (const mesh of [active.slabMesh,active.lipMesh,active.bevelMesh]) {
      if (!mesh) continue;
      const {index,attributes:{position}}=mesh.geometry;
      for (let i=0;i<index.count;i+=3) {
        const a=index.getX(i), b=index.getX(i+1), c=index.getX(i+2);
        const x=Math.floor((position.getX(a)+position.getX(b)+position.getX(c))/3/tileSize)*tileSize;
        const z=Math.floor((position.getZ(a)+position.getZ(b)+position.getZ(c))/3/tileSize)*tileSize;
        const key=x+','+z;
        let tile=tiles.get(key);
        if (!tile) tiles.set(key,tile={x,z,vertices:[],indices:[]});
        for (const vertex of [a,b,c]) {
          tile.indices.push(tile.vertices.length/3);
          tile.vertices.push(position.getX(vertex)-x,position.getY(vertex),position.getZ(vertex)-z);
        }
      }
    }
    const bodies=[...tiles.values()].map(tile=>physics.addStaticSurface(tile)).filter(Boolean);
    return {dispose() { for(const body of bodies) physics.world.removeBody(body); }};
  }

  return {build,attachSidewalkPhysics,surfaceHeight};
});
