const assert = require('node:assert/strict');
const test = require('node:test');
const THREE = require('three');
const city = require('../js/portfolio-city');
const streets = require('../js/portfolio-streets');
const arrival = require('../js/portfolio-arrival-sidewalks');
const publicSpaces = require('../js/portfolio-public-spaces');
const props = require('../js/portfolio-sidewalk-props');
const life = require('../js/portfolio-sidewalk-life');

test('Portfolio City dresses all districts with separate, supported ground props', t => {
  const globals = {
    DrivePortfolioStreets:streets,
    DrivePortfolioArrivalSidewalks:arrival,
    DrivePortfolioPublicSpaces:publicSpaces,
    DrivePortfolioSidewalkProps:props,
    DrivePortfolioNeighborhoods:require('../js/portfolio-neighborhoods'),
    DrivePortfolioDistricts:require('../js/portfolio-districts')
  };
  const originals = Object.keys(globals).map(key=>[key,globalThis[key]]);
  Object.assign(globalThis,globals);
  t.after(()=>{
    for(const [key,value] of originals) {
      if(value===undefined) delete globalThis[key];
      else globalThis[key]=value;
    }
  });

  const world = new THREE.Group();
  city.build(THREE,world);
  arrival.attach(THREE,world);
  publicSpaces.attach(THREE,world);
  require('../js/portfolio-storefronts').attach(THREE,world);
  require('../js/portfolio-education-campus').attach(THREE,world,city);
  const dressing = life.attach(THREE,world,city);
  const {placements,itemCount,itemCounts}=dressing.group.userData;
  assert.ok(itemCount>=150);
  assert.equal(new Set(placements.map(item=>item.id)).size,itemCount);
  assert.equal(Object.values(itemCounts).reduce((a,b)=>a+b,0),itemCount);
  assert.equal(new Set(placements.map(item=>item.district)).size,8);
  for(const type of ['bench','planter','bin','bag-pile','litter','utility-cabinet']) assert.ok(itemCounts[type],type);

  const supports=[];
  world.traverse(object=>{
    if(/^(?:portfolio-curbs|arrival-sidewalk-(?:stone|drainage)|portfolio-(?:projects-plaza(?:-west)?|switchyard-park)-(?:court|perimeter-walk|curb-cut))$/.test(object.name)) {
      supports.push({object,bounds:new THREE.Box3().setFromObject(object)});
    }
  });
  const ray = new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,.30);
  for(const {id,type,x,y,z,heading} of placements) {
    const c=Math.cos(heading),s=Math.sin(heading),{width,depth}=props.catalog[type];
    for(const [u,v] of [[0,0],[-.5,-.5],[-.5,.5],[.5,-.5],[.5,.5]]) {
      const px=x+u*width*c+v*depth*s,pz=z-u*width*s+v*depth*c;
      ray.ray.origin.set(px,.44,pz);
      const heights=supports.flatMap(({object,bounds:{min,max}})=>
        px>=min.x && px<=max.x && pz>=min.z && pz<=max.z ? ray.intersectObject(object).map(hit=>hit.point.y) : []);
      const support=Math.max(...heights);
      assert.ok(support>=.162 && Math.abs(support-y)<.015,`${id} has paved support across its footprint`);
    }
  }
  dressing.dispose();
  assert.ok(!world.getObjectByName('portfolio-sidewalk-props'));
});
