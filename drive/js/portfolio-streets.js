(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./vendor/polygon-clipping-0.15.7.min.js'));
  } else if (root.polygonClipping) {
    root.DrivePortfolioStreets = factory(root.polygonClipping);
  }
})(globalThis, function (polygons) {
  'use strict';

  const surfaceY=.17, graniteY=.146, kerbY=.117, chamferWidth=.075, curbDepth=.30, walkWidth=4.0;
  const sidewalkSurfaces = new WeakMap();
  const empty=[];
  let cachedLayout;

  function streetFootprint(roads, areas, margin, roundSteps=32, cornerAllowance=0) {
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
        const junction = junctions.get(key);
        if (junction) {
          junction.radius=Math.max(junction.radius,radius);
          junction.branches++;
        } else junctions.set(key,{x,z,radius,branches:1});
      }
    }

    // The rounded caps fill the outside of bends and blend into connecting
    // streets. Unioning the caps and strips removes shared triangle faces.
    for (const {x,z,radius,branches} of junctions.values()) {
      let throughWidth=0;
      if (cornerAllowance) for (const {x1,z1,x2,z2,width} of roads) {
        const dx=x2-x1, dz=z2-z1, length=Math.hypot(dx,dz);
        if (length<.01) continue;
        const along=((x-x1)*dx+(z-z1)*dz)/length;
        if (along>.1 && along<length-.1 && Math.abs((x-x1)*dz-(z-z1)*dx)/length<.1)
          throughWidth=Math.max(throughWidth,width);
      }
      const roundedRadius=branches>=3 || throughWidth ? Math.max(radius,throughWidth/2+margin)+cornerAllowance : radius;
      const ring = [];
      for (let step=0; step<roundSteps; step++) {
        const angle = step*2*Math.PI/roundSteps;
        ring.push([x+Math.cos(angle)*roundedRadius,z+Math.sin(angle)*roundedRadius]);
      }
      shapes.push([ring]);
    }
    for (const {x,z,w,d,curbReturn} of areas) {
      const a = w/2+margin, b = d/2+margin;
      shapes.push([[[x-a,z-b],[x+a,z-b],[x+a,z+b],[x-a,z+b]]]);
      if (curbReturn && margin<walkWidth) {
        const edge=curbReturn(margin);
        const [ax,az]=edge[0], [bx,bz]=edge.at(-1);
        // Close the patch inside the street so the union leaves one edge.
        shapes.push([[...edge,[bx+.08,bz],[bx+.08,az-1],[ax,az-.08]]]);
      }
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

  function curbSides(THREE, world, area, y, material, name, covered) {
    const positions=[];
    for (const polygon of area) for (const ring of polygon) {
      for (let i=0; i<ring.length-1; i++) {
        const [x,z]=ring[i], [nx,nz]=ring[i+1];
        const length=Math.hypot(nx-x,nz-z);
        if (length<.00001) continue;
        // Premium walks meet the slab across this border. Leave the top seam
        // intact and omit the artificial vertical face between the surfaces.
        if (covered?.length) {
          const midX=(x+nx)*.5, midZ=(z+nz)*.5;
          const ox=(nz-z)/length*.012, oz=(x-nx)/length*.012;
          if (contains(covered,midX+ox,midZ+oz) || contains(covered,midX-ox,midZ-oz)) continue;
        }
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
    return area.some(([outline,...holes])=>inRing(outline,x,z) && !holes.some(hole=>inRing(hole,x,z)));
  }

  function inRing(ring,x,z) {
    let inside=false;
    for (let i=0, j=ring.length-1; i<ring.length; j=i++) {
      const [ax,az]=ring[j], [bx,bz]=ring[i];
      if ((az>z)!==(bz>z) && x < (bx-ax)*(z-az)/(bz-az)+ax) inside=!inside;
    }
    return inside;
  }

  function bounds(ring) {
    const box={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
    for (const [x,z] of ring) {
      box.minX=Math.min(box.minX,x);
      box.maxX=Math.max(box.maxX,x);
      box.minZ=Math.min(box.minZ,z);
      box.maxZ=Math.max(box.maxZ,z);
    }
    return box;
  }

  function ringArea(ring) {
    let area=0;
    for (let i=1;i<ring.length;i++) area+=ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1];
    return Math.abs(area)*.5;
  }

  function boxArea({minX,maxX,minZ,maxZ}) {
    return [[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]]];
  }

  function expand({minX,maxX,minZ,maxZ},distance) {
    return {minX:minX-distance,maxX:maxX+distance,minZ:minZ-distance,maxZ:maxZ+distance};
  }

  function footprint({x,z,width,depth}) {
    return {minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2};
  }

  function buildingWalks(network, road, routingRoad, premium, buildings, obstacles, publicSpaces) {
    const ground=buildings.filter(building=>building.baseY===0);
    const destinations=ground.filter(({width,depth,height,collisionOnly})=>
      !collisionOnly && width>=4.5 && depth>=4.5 && height>=6);
    if (!destinations.length) return {area:network,access:[],paths:[]};

    const decks=Object.values(publicSpaces || {});
    // Continue underneath the beveled edges until the higher deck takes over.
    const deckSlabs=decks.map(box=>boxArea(expand(box,-.34)));
    const blocks=[...ground.map(footprint),...obstacles.map(({x,z,w,d})=>footprint({x,z,width:w,depth:d}))];
    const spacing=1.55, pathWidth=2.6, lotWidth=3.4;
    const obstruction=pathWidth/2+.10;
    // Start one search from the existing walks and public decks. The shared
    // search lets a row of buildings use the same passage back to the street.
    const limits=bounds([
      ...network.flatMap(([outline])=>outline),
      ...blocks.flatMap(box=>boxArea(box)[0]),
      ...decks.flatMap(box=>boxArea(box)[0])
    ]);
    const originX=Math.floor((limits.minX-5)/spacing)*spacing;
    const originZ=Math.floor((limits.minZ-5)/spacing)*spacing;
    const columns=Math.ceil((limits.maxX+5-originX)/spacing)+1;
    const rows=Math.ceil((limits.maxZ+5-originZ)/spacing)+1;
    const size=columns*rows;
    const closed=new Uint8Array(size), distance=new Uint32Array(size);
    const previous=new Int32Array(size).fill(-1), queue=new Int32Array(size);
    const xAt=column=>originX+column*spacing, zAt=row=>originZ+row*spacing;
    const pointAt=index=>({x:xAt(index%columns),z:zAt(Math.floor(index/columns))});
    const insideBox=({minX,maxX,minZ,maxZ},x,z)=>x>minX && x<maxX && z>minZ && z<maxZ;
    function scan({minX,maxX,minZ,maxZ},visit) {
      const lastColumn=Math.min(columns-1,Math.floor((maxX-originX)/spacing));
      const lastRow=Math.min(rows-1,Math.floor((maxZ-originZ)/spacing));
      for (let row=Math.max(0,Math.ceil((minZ-originZ)/spacing));row<=lastRow;row++) {
        for (let column=Math.max(0,Math.ceil((minX-originX)/spacing));column<=lastColumn;column++) {
          visit(row*columns+column,xAt(column),zAt(row));
        }
      }
    }
    function cover(area,visit) {
      for (const [outline,...holes] of area) {
        scan(bounds(outline),(index,x,z)=>{
          if (inRing(outline,x,z) && !holes.some(hole=>inRing(hole,x,z))) visit(index);
        });
      }
    }
    cover(routingRoad,index=>{closed[index]=1;});
    for (const block of blocks) scan(expand(block,obstruction),index=>{closed[index]=1;});
    let count=0;
    function seed(index) {
      if (closed[index] || previous[index]>=0) return;
      previous[index]=index;
      queue[count++]=index;
    }
    cover(network,seed);
    cover(premium || [],seed);
    for (const box of decks) scan(box,seed);

    // Diagonals keep paths short, but the two adjacent cells must also clear
    // the obstacles so a diagonal cannot cut through a building corner.
    const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    for (let read=0;read<count;read++) {
      const source=queue[read], column=source%columns, row=Math.floor(source/columns);
      for (const [dx,dz] of directions) {
        if (column+dx<0 || column+dx>=columns || row+dz<0 || row+dz>=rows) continue;
        const next=source+dz*columns+dx;
        if (previous[next]>=0 || closed[next] || closed[source+dx] || closed[source+dz*columns]) continue;
        previous[next]=source;
        distance[next]=distance[source]+1;
        queue[count++]=next;
      }
    }

    const lotAreas=[], connectors=[], access=[];
    const laid=new Uint8Array(size);
    function addPath(from,to) {
      if (from===to) return;
      const a=pointAt(from), b=pointAt(to);
      connectors.push({x1:a.x,z1:a.z,x2:b.x,z2:b.z,width:pathWidth});
    }
    for (const building of destinations) {
      const box=footprint(building), apron=expand(box,lotWidth);
      let anchor=-1, nearest=Infinity;
      scan(expand(box,lotWidth-.10),(index,x,z)=>{
        if (previous[index]<0 || distance[index]>=nearest || insideBox(box,x,z)) return;
        anchor=index;
        nearest=distance[index];
      });
      if (anchor<0) continue;
      const accessPoint=pointAt(anchor);
      const {x,z}=accessPoint;
      const surface=decks.some(box=>insideBox(box,x,z)) ? 'public' :
        contains(premium || [],x,z) ? 'arrival' : 'network';
      access.push({building,x,z,surface});
      lotAreas.push(boxArea(apron));
      let start=anchor, next=anchor, direction=0;
      while (!laid[next] && previous[next]!==next) {
        laid[next]=1;
        const following=previous[next];
        if (next!==start && direction!==following-next) {
          addPath(start,next);
          start=next;
        }
        direction=following-next;
        next=following;
      }
      addPath(start,next);
    }

    if (!lotAreas.length) return {area:network,access,paths:connectors};
    const links=streetFootprint(connectors,[],0,12,.42);
    const lot=polygons.difference(polygons.union(links,...lotAreas),...deckSlabs);
    // Tuck the slab edge just inside the wall to avoid coplanar curb faces.
    const obstructionArea=polygons.union(...blocks.map(box=>boxArea(expand(box,-.018))));
    // Patch enclosed scraps between the widened sidewalks and access paths.
    // Leave full courtyards open, then restore the actual road and wall cuts.
    const paved=polygons.union(network,lot).map(([outline,...gaps])=>[outline,...gaps.filter(gap=>ringArea(gap)>=16)]);
    return {area:polygons.difference(paved,road,premium || [],obstructionArea),access,paths:connectors};
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

  function weatherMesh(THREE, mesh, forecourts) {
    if(!mesh) return;
    const position=mesh.geometry.attributes.position;
    const tints=forecourts.map(area=>new THREE.Color(area.tint));
    const colors=[];
    for(let i=0;i<position.count;i++) {
      const x=position.getX(i), z=position.getZ(i);
      const wear=.89+.07*Math.sin(x*.38+z*.14)+.06*Math.sin(x*.73-z*.09);
      const index=forecourts.findIndex(area=>Math.abs(x-area.x)<=area.w/2+.01 && Math.abs(z-area.z)<=area.d/2+.01);
      const tint=tints[index];
      colors.push(tint ? wear*(.30+.70*tint.r) : wear,
        tint ? wear*(.30+.70*tint.g) : wear,
        tint ? wear*(.30+.70*tint.b) : wear*.97);
    }
    mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  }

  function streetLayout(roads,areas,buildings,obstacles,publicSpaces,premium,forecourts) {
    const pavement = streetFootprint(roads,areas,0);
    if (!pavement.length) return null;
    const chamfer = streetFootprint(roads,areas,chamferWidth);
    const granite = streetFootprint(roads,areas,curbDepth);
    const streetWalk = streetFootprint(roads,areas,walkWidth,32,.7);
    const expanded = streetFootprint([],forecourts,0);
    const plazaJoin=publicSpaces?.plazaWestJoin;
    const campusJoin=publicSpaces?.campusParkJoin;
    // Fill the entire pedestrian corner before clipping the sidewalk around
    // the real carriageway. The old disconnected curb appeared inside it.
    const additions=[expanded.length ? expanded : null,plazaJoin ? boxArea(plazaJoin) : null,
      campusJoin ? boxArea(campusJoin) : null].filter(Boolean);
    const offset = additions.length ? polygons.union(streetWalk,...additions) : streetWalk;
    const exclusions = premium?.length ? [premium] : [];
    const network = polygons.difference(offset,granite,...exclusions);
    const routingRoad = buildings.length ? streetFootprint(roads,areas,curbDepth+.40) : granite;
    const {area:sidewalk,access,paths}=buildingWalks(network,granite,routingRoad,premium,buildings,obstacles,publicSpaces);
    const apron = polygons.difference(granite,chamfer,...exclusions);
    const bevel = polygons.difference(chamfer,pavement,...exclusions);
    return {pavement,sidewalk,access,paths,apron,bevel,premium,plazaJoin};
  }

  function build(THREE, world, {roads, areas, asphalt, curb, buildings=empty, obstacles=empty, publicSpaces,premium,
    forecourts=empty,cacheLayout=false}) {
    const authoredFootprint=globalThis.DrivePortfolioArrivalSidewalks?.footprint;
    const inputs=[roads,areas,buildings,obstacles,publicSpaces,premium===undefined ? authoredFootprint : premium,forecourts];
    // Authored maps can reuse the union and path search after a car switch.
    // Each world still owns its Three meshes, materials and physics bodies.
    const hit=cacheLayout && cachedLayout && inputs.every((input,index)=>input===cachedLayout.inputs[index]);
    const layout=hit ? cachedLayout.layout : streetLayout(roads,areas,buildings,obstacles,publicSpaces,
      premium===undefined ? authoredFootprint?.() : premium,forecourts);
    if (cacheLayout && !hit) cachedLayout={inputs,layout};
    if (!layout) return;
    const {pavement,sidewalk,access,paths,apron,bevel,premium:covered,plazaJoin}=layout;
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
    weatherMesh(THREE,slabMesh,forecourts);
    // The narrow granite strip sits below the slabs. Separate vertical faces
    // step down to it and to the road, including along the curves of a junction.
    curbSides(THREE,world,sidewalk,surfaceY,wall,'portfolio-sidewalk-faces',covered);
    curbSides(THREE,world,bevel,kerbY,innerWall,'portfolio-curb-faces',covered);
    if (slabMesh) sidewalkSurfaces.set(world,{pavement,sidewalk,apron,bevel,slabMesh,lipMesh,bevelMesh,access,paths,plazaJoin});
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

  function finishPlazaJoin(THREE,world,pavers) {
    const active=activeSurfaces(world);
    if (!active?.plazaJoin) return;
    const {minX,maxX,minZ,maxZ}=active.plazaJoin;
    const finish=active.slabMesh.material;
    finish.onBeforeCompile=shader=>{
      shader.uniforms.plazaJoinMap={value:pavers};
      shader.uniforms.plazaJoinBounds={value:new THREE.Vector4(minX,maxX,minZ,maxZ)};
      shader.uniforms.plazaJoinColor={value:new THREE.Color(0x9eaeae).convertSRGBToLinear()};
      shader.vertexShader='varying vec2 vPlazaJoin;\n'+shader.vertexShader.replace(
        '#include <begin_vertex>','#include <begin_vertex>\nvPlazaJoin=position.xz;');
      shader.fragmentShader=`varying vec2 vPlazaJoin;
        uniform sampler2D plazaJoinMap;
        uniform vec4 plazaJoinBounds;
        uniform vec3 plazaJoinColor;
        `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          vec2 p=vPlazaJoin;
          vec4 limits=plazaJoinBounds;
          float join=smoothstep(limits.x,limits.x+3.,p.x)*(1.-smoothstep(limits.y-2.,limits.y,p.x))*
            smoothstep(limits.z,limits.z+4.,p.y)*(1.-smoothstep(limits.w-3.,limits.w,p.y));
          vec2 tiles=p/vec2(1.34,1.15);
          tiles.x+=mod(floor(tiles.y),2.)*.5;
          vec2 edge=.5-abs(fract(tiles)-.5);
          vec2 pixel=fwidth(p)/vec2(1.34,1.15);
          vec2 joint=(1.-smoothstep(vec2(.012),vec2(.019)+pixel,edge))*
            (1.-smoothstep(vec2(.07),vec2(.30),pixel));
          float wear=fract(sin(dot(floor(tiles),vec2(12.9898,78.233)))*43758.5453);
          vec3 shade=pow(texture2D(plazaJoinMap,p/3.5).rgb,vec3(2.2))*plazaJoinColor;
          shade*=mix(.87,1.08,wear)*(1.-.56*max(joint.x,joint.y));
          diffuseColor.rgb=mix(diffuseColor.rgb,shade,join);
        `);
    };
    finish.customProgramCacheKey=()=>'portfolio-projects-plaza-walk-join';
    finish.needsUpdate=true;
  }

  function buildingAccess(world) {
    return activeSurfaces(world)?.access || [];
  }

  function buildingPaths(world) {
    return activeSurfaces(world)?.paths || [];
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

  return {build,attachSidewalkPhysics,surfaceHeight,buildingAccess,buildingPaths,finishPlazaJoin};
});
