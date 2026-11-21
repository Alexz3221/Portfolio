(function(root,factory) {
  const life = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = life;
  else root.DrivePortfolioSidewalkLife = life;
})(globalThis,function(root) {
  'use strict';

  const patterns = {
    arrival:['bollard','newspaper-box','bin','litter','potted-tree','a-frame','bag-pile'],
    market:['market-basket','crate-stack','a-frame','litter','bin','street-stool','bag-pile','planter'],
    plaza:['planter','bench','bin','pallet','a-frame','potted-tree','litter','newspaper-box'],
    campus:['bike-rack','potted-tree','bench','bin','planter','newspaper-box','litter','bollard'],
    utility:['utility-cabinet','pallet','bin','crate-stack','bag-pile','service-cart','drain-grate','litter'],
    park:['bench','planter','bin','potted-tree','litter','bike-rack','bag-pile'],
    shops:['vending-machine','a-frame','planter','newspaper-box','bin','street-stool','bag-pile','crate-stack']
  };
  // Small groups along the curb or the outer edge of a forecourt. The length
  // is the frontage available to that group, not a spacing repeated citywide.
  // Yaw aligns the group with the street and directs the fronts of the props.
  const frontages = {
    'arrival-concourse':[
      ['vault-entry',-7.55,-111,90,13,'arrival'],
      ['vault-walk',7.48,-107,90,17,'shops'],
      ['transfer-east',7.22,-85,90,18,'arrival'],
      ['transfer-west',-7.10,-86,90,17,'utility'],
      ['brick-walk',-7.25,-62,90,17,'arrival'],
      ['canopy-walk',7.38,-60,90,20,'shops'],
      ['concourse-gate',-10.74,-41,90,11,'arrival']
    ],
    'night-market':[
      ['produce-row',-79.5,-9.45,0,12,'market'],
      ['repair-row',-67.3,-8.48,0,12,'utility'],
      ['night-market-south',-78.5,-32.28,180,18,'market'],
      ['west-turn',-91.9,-8.05,-44,12,'shops'],
      ['terrace-walk',-52.8,-3.91,-25,14,'market']
    ],
    'projects-plaza':[
      ['corner-press',-35.3,10.45,0,11,'market'],
      ['plaza-west-loop',-19.1,16.15,0,12,'plaza'],
      ['plaza-west-south',-16.2,42.2,180,13,'plaza'],
      ['west-residences',-33.9,34.4,90,15,'shops'],
      ['plaza-east-loop',18.1,17.2,0,15,'plaza'],
      ['plaza-facilities',17.4,42.55,180,15,'plaza'],
      ['test-lab-walk',29.3,51.75,90,13,'utility'],
      ['arcade-landing',29.5,67.5,140,15,'shops'],
      ['plaza-approach',-25.44,-3.1,90,15,'utility'],
      ['skyway-east-walk',25.4,-21.1,90,16,'shops'],
      ['east-forecourt',52.35,60.7,0,15,'plaza']
    ],
    'service-district':[
      ['test-bay-east',101.19,-73.3,90,14,'utility'],
      ['spectrum-walk',122.73,-33.7,-90,20,'shops'],
      ['coorstek-walk',122.7,-57.8,-90,15,'utility'],
      ['test-bay-south',73.5,-31.95,0,20,'utility'],
      ['test-bay-north',73.4,-73.17,0,18,'utility'],
      ['service-ring-west',101.07,-18.6,90,16,'plaza'],
      ['gate-approach',122.9,20.1,-90,18,'utility'],
      ['service-east-ring',122.55,7.3,-90,15,'shops'],
      ['learning-exchange',122.7,59.8,-90,18,'campus'],
      ['service-west-ring',101.3,36.2,90,17,'shops'],
      ['learning-court',147.5,57.75,0,12,'campus']
    ],
    'boulder-campus':[
      ['quad-south',-125.6,13.4,180,12,'campus'],
      ['quad-north',-124.2,-.75,0,12,'campus'],
      ['west-campus-walk',-117.85,23.5,90,16,'campus'],
      ['computing-walk',-98.18,38.6,-90,18,'campus'],
      ['research-walk',-98.09,58.3,-90,17,'campus'],
      ['course-reserves',-95.43,22.2,90,13,'shops'],
      ['west-ring-campus',-117.76,-4.5,90,17,'campus']
    ],
    'switchyard-park':[
      ['switchyard-east',-119.81,58.5,90,17,'park'],
      ['switchyard-front',-132.6,41.63,0,17,'park'],
      ['switchyard-back',-133.15,71.32,180,16,'park'],
      ['switchyard-west',-145.24,55.5,-90,14,'park']
    ],
    'workshop-quarter':[
      ['tool-library-north',-51.5,69.36,180,20,'utility'],
      ['tool-library-south',-46.2,88.85,0,21,'utility'],
      ['workshop-corner',-62.1,88.75,0,13,'shops'],
      ['workshop-ring',-48,125.9,153,19,'utility'],
      ['workshop-north-cut',-54,102.0,-27,19,'utility'],
      ['workshop-court',-81.3,82.3,90,12,'market'],
      ['south-workshop-walk',-78.9,97.85,-59,15,'shops'],
      ['west-workshop-walk',-67.7,69.32,180,13,'shops']
    ],
    'south-street':[
      ['south-street-west',47.7,-97.72,180,15,'shops'],
      ['south-street-north',66.6,-118.25,0,20,'plaza'],
      ['south-street-shops',71.45,-97.62,180,18,'shops'],
      ['south-street-turn',94.9,-94.2,-18,15,'utility'],
      ['interests-court',57.4,-90.0,0,13,'plaza'],
      ['east-ring-north',101.44,-82.0,90,11,'shops'],
      ['south-street-far',81.4,-118.25,0,13,'arrival']
    ]
  };

  const groundSurface = /^(?:arrival-sidewalk-(?:stone|drainage)|portfolio-(?:projects-plaza(?:-west)?|switchyard-park)-(?:court|perimeter-walk|curb-cut))$/;
  const padding = .14;
  const plans = Object.entries(frontages).flatMap(([district,rows])=>rows.map(row=>({district,row})));
  const courtOffsets = [-.42,.36,-.32,.48,-.37,.22,.45,-.31];

  function occupiedSpace(THREE,world,city,groundMeshes) {
    const cells = new Map(), cellSize = 5;
    function doCells(bounds,visit) {
      const {min,max}=bounds;
      for(let x=Math.floor(min.x/cellSize);x<=Math.floor(max.x/cellSize);x++) {
        for(let z=Math.floor(min.z/cellSize);z<=Math.floor(max.z/cellSize);z++) {
          if (visit(x+','+z)) return true;
        }
      }
      return false;
    }
    function add(bounds) {
      if(bounds.min.y>2.66 || bounds.max.y<.22 || bounds.isEmpty()) return;
      doCells(bounds,key=>{
        if(!cells.has(key)) cells.set(key,[]);
        cells.get(key).push(bounds);
      });
    }
    function blocked(bounds) {
      return doCells(bounds,key=>cells.get(key)?.some(obstacle=>bounds.intersectsBox(obstacle)));
    }

    world.updateMatrixWorld(true);
    const matrix=new THREE.Matrix4(), instance=new THREE.Matrix4();
    world.traverseVisible(object=>{
      // The storefront panels share a citywide mesh, with solid housings in the other batches.
      if(!object.isMesh || groundMeshes.has(object) || object.name==='portfolio-storefront-signs-and-windows') return;
      const {geometry}=object;
      if(geometry.type==='PlaneGeometry' && !object.userData.portfolioAdFace) return;
      if(!geometry.boundingBox) geometry.computeBoundingBox();
      for(let i=0;i<(object.isInstancedMesh ? object.count : 1);i++) {
        matrix.copy(object.matrixWorld);
        if(object.isInstancedMesh) {
          object.getMatrixAt(i,instance);
          matrix.multiply(instance);
        }
        const bounds=geometry.boundingBox.clone().applyMatrix4(matrix);
        if(object.userData.portfolioAdFace) bounds.expandByVector(new THREE.Vector3(.55,0,.55));
        add(bounds);
      }
    });
    for(const {x,z,width,depth,baseY,height} of city.buildings) {
      if(baseY>2.66) continue;
      add(new THREE.Box3(new THREE.Vector3(x-width/2,baseY,z-depth/2),new THREE.Vector3(x+width/2,baseY+height,z+depth/2)));
    }
    return {add,blocked};
  }

  function supportSampler(THREE,world,groundMeshes) {
    const streets=root.DrivePortfolioStreets;
    const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,.21);
    const surfaces=Array.from(groundMeshes,mesh=>{
      mesh.geometry.computeBoundingBox();
      return {mesh,bounds:mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)};
    });
    return (x,z)=>{
      let y=streets?.surfaceHeight(world,x,z) || 0;
      ray.ray.origin.set(x,.34,z);
      for(const {mesh,bounds:{min,max}} of surfaces) {
        if(x<min.x || x>max.x || z<min.z || z>max.z) continue;
        const hit=ray.intersectObject(mesh)[0];
        if(hit) y=Math.max(y,hit.point.y);
      }
      return y;
    };
  }

  function bufferPath(x1,z1,x2,z2,width) {
    const dx=x2-x1,dz=z2-z1;
    return {x1,z1,dx,dz,lengthSquared:dx*dx+dz*dz,width};
  }

  function approaches(world) {
    const streets=root.DrivePortfolioStreets;
    const paths=(streets?.buildingPaths(world) || []).map(({x1,z1,x2,z2,width})=>bufferPath(x1,z1,x2,z2,width));
    for(const {building,x,z} of streets?.buildingAccess(world) || []) {
      const wallX=Math.max(building.x-building.width/2,Math.min(building.x+building.width/2,x));
      const wallZ=Math.max(building.z-building.depth/2,Math.min(building.z+building.depth/2,z));
      paths.push(bufferPath(x,z,wallX,wallZ,2.5));
    }
    // Reserve the door-side strip between ground-level portfolio venues and
    // their drive-up stops, even if their facade is custom built.
    for(const {building,approach} of root.DrivePortfolioDistricts?.sites || []) {
      if(approach.y>0) continue;
      paths.push(bufferPath(approach.x,approach.z,building.x,building.z,2.55));
    }
    return paths;
  }

  function blocksApproach(paths,x,z,clearance) {
    return paths.some(({x1,z1,dx,dz,lengthSquared,width})=>{
      const t=lengthSquared ? Math.max(0,Math.min(1,((x-x1)*dx+(z-z1)*dz)/lengthSquared)) : 0;
      const radius=width/2+clearance;
      return (x-x1-t*dx)**2+(z-z1-t*dz)**2<radius*radius;
    });
  }

  function compose(THREE,world,city,catalog) {
    const groundMeshes=new Set();
    world.traverse(object=>{if(object.isMesh && groundSurface.test(object.name)) groundMeshes.add(object);});
    const occupied=occupiedSpace(THREE,world,city,groundMeshes);
    const support=supportSampler(THREE,world,groundMeshes);
    const paths=approaches(world);
    const items=[];
    function seat(x,z,hx,hz,height) {
      if(blocksApproach(paths,x,z,Math.hypot(hx,hz))) return null;
      const bounds=new THREE.Box3(new THREE.Vector3(x-hx,.18,z-hz),new THREE.Vector3(x+hx,.19+height,z+hz));
      if(occupied.blocked(bounds)) return null;
      const levels=[support(x,z)];
      for(const a of [-1,0,1]) for(const b of [-1,0,1]) {
        if(a || b) levels.push(support(x+a*hx,z+b*hz));
      }
      const y=Math.min(...levels);
      if(y<.164 || Math.max(...levels)-y>.012) return null;
      occupied.add(bounds);
      return y;
    }

    for(const [index,{district,row:[label,cx,cz,angle,length,pattern]}] of plans.entries()) {
      const types=patterns[pattern], heading=angle*Math.PI/180, c=Math.cos(heading), s=Math.sin(heading);
      const courtPattern=pattern==='plaza' || pattern==='market' || pattern==='park';
      for(const [slot,type] of types.entries()) {
        const shape=catalog[type];
        if(!shape) continue;
        const variant=(index*11+slot*5)%9;
        const turn=type==='litter' || type==='bag-pile' || type==='market-basket' ? heading+(variant-4)*.097 : heading;
        const ac=Math.abs(Math.cos(turn)), as=Math.abs(Math.sin(turn));
        const hx=(ac*shape.width+as*shape.depth)/2+padding, hz=(as*shape.width+ac*shape.depth)/2+padding;
        const station=length*((slot+.5)/types.length-.5)+(variant-4)*.068;
        const edgeOffset=slot%2 ? .10 : -.11;
        const lateralOffset=courtPattern ? courtOffsets[(slot+index)%courtOffsets.length] : edgeOffset;
        for(const [along,across] of [[0,0],[.65,0],[-.65,0],[0,.47],[0,-.47],[.88,.68],[-.88,-.68],[.38,1.05],[-.38,-1.05]]) {
          const offset=lateralOffset+across;
          const x=cx+c*(station+along)+s*offset,z=cz-s*(station+along)+c*offset;
          const y=seat(x,z,hx,hz,shape.height);
          if(y===null) continue;
          items.push({id:label+'-'+(slot+1),type,x,y,z,heading:turn,variant,district});
          break;
        }
      }
    }
    return items;
  }

  function attach(THREE,world,city) {
    const props=root.DrivePortfolioSidewalkProps;
    if(!props) return null;
    const items=compose(THREE,world,city,props.catalog);
    const dressing=props.attach(THREE,world,items);
    dressing.group.userData.placements=items;
    return dressing;
  }

  return {attach};
});
