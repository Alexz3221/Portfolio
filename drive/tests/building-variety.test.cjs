'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const THREE = require('three');
const C = require('cannon');
const Imported = require('../js/imported-city');
const Physics = require('../js/physics');

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

test('touching exported lots gain a real gap in both meshes and colliders', async () => {
  const base = 'data/lot-gaps/';
  const manifest = { format:'drive-city-v1', bounds:{minX:0,maxX:200,minZ:0,maxZ:200},
    tileSize:200, focus:[60,70], terrain:{file:'terrain.json'},
    tiles:[{ix:0,iz:0,file:'tiles/0_0.json',buildingCount:2}] };
  const overview = { format:'drive-city-overview-v1', roads:[{id:'main',width:12,
    points:[[0,0,20],[200,0,20]]}], districts:[], stops:[] };
  const terrain = { format:'drive-city-terrain-v1',rows:4,cols:4,origin:[0,0],cell:100,
    heights:Array(16).fill(0) };
  const building = (id,x0,x1) => ({type:'building',id,role:'RESIDENTIAL',
    category:'NA Low Density Housing',growthKind:'zoned',geometrySource:'cs2:lot-fallback',
    height:9,baseY:0,footprint:[[x0,60],[x1,60],[x1,80],[x0,80]]});
  const records = [building('lot-left',40,60),building('lot-right',60,80)];
  const tile = {format:'drive-city-tile-v1',features:records};
  const files = new Map([[base+'manifest.json',manifest],[base+'overview.json',overview],
    [base+'terrain.json',terrain],[base+'tiles/0_0.json',tile]]);
  const map = await Imported.load(base+'manifest.json',{fetch:async url =>
    ({ok:files.has(url),json:async()=>files.get(url)})});
  const [left,right] = map.buildings;
  assert.equal(left.sourceFootprint[1][0],60);
  assert.equal(right.sourceFootprint[0][0],60);
  assert.ok(left.setback>=.7 && right.setback>=.7);
  assert.ok(Math.max(...left.footprint.map(p=>p[0])) < 59.3);
  assert.ok(Math.min(...right.footprint.map(p=>p[0])) > 60.7);
  const world = new THREE.Group(), visual = map.build(THREE,world);
  const physics = Physics.create({map:'city',city:map,distanceToRoad:map.distanceToRoad,
    roadHalfWidth:map.roadHalfWidth});
  physics.reset(100,20);
  const roofAt = x => {
    const hit = new C.RaycastResult();
    assert.ok(physics.world.raycastClosest(new C.Vec3(x,20,70),new C.Vec3(x,-2,70),{},hit));
    return hit.hitPointWorld.y;
  };
  assert.ok(roofAt(50)>8,'the visible left building has a solid roof');
  assert.ok(roofAt(70)>8,'the visible right building has a solid roof');
  assert.ok(roofAt(60)<.2,'the former shared lot edge has no invisible building collider');
  physics.dispose();visual.dispose();
});

test('55 zoned and 40 landmark recipes have distinct geometry with stable source assignments', async () => {
  const families = [
    ['house','RESIDENTIAL','NA Low Density Housing',9],
    ['rowhouse','RESIDENTIAL','EU Row Housing',14],
    ['apartments','RESIDENTIAL','NA Medium Density Housing',26],
    ['tower','RESIDENTIAL','NA High Density Housing',110],
    ['storefront','COMMERCIAL','NA Low Density Business',18],
    ['gasstation','COMMERCIAL','NA Low Density Business',8,'NA_CommercialGasStation01_L5_4x6'],
    ['glass','COMMERCIAL','NA High Density Business',100],
    ['industrial','INDUSTRIAL','Industrial Manufacturing',20],
    ['warehouse','INDUSTRIAL','Industrial Manufacturing',20,'IndustrialManufacturing02_L5_5x6'],
    ['office','OFFICE','Low Density Offices',22],
    ['officeTower','OFFICE','High Density Offices',110],
    ['civic','INFRASTRUCTURE','City Hall',25],
    ['campus','EDUCATION','University',25],
    ['hospital','HEALTHCARE','Hospital',25],
    ['castle','PARK_SERVICE','Castle',25],
    ['airport','AIRPORT','Airport Terminal',30],
    ['stadium','PARK_SERVICE','Stadium',18],
    ['parking','INFRASTRUCTURE','Parking Garage',24],
    ['monument','PARK_SERVICE','Monument',24]
  ];
  assert.equal(new Set(Imported.modelCatalog).size,95);
  const zoned = families.filter(([,role])=>['RESIDENTIAL','COMMERCIAL','INDUSTRIAL','OFFICE'].includes(role));
  assert.equal(zoned.length*5,55,'all four zoning roles contribute authored models');
  assert.deepEqual(Imported.modelCatalog.map(key=>key.split(':')[0]),
    families.flatMap(([style])=>Array(5).fill(style)));
  const records = [], labels = [];
  for (const [style,role,category,height,prefab] of families) for (let variant=0;variant<5;variant++) {
    let id;
    for (let suffix=0;;suffix++) {
      const candidate = `${style}-recipe-${suffix}`;
      if (hash('model:'+candidate)%5===variant) {id=candidate;break;}
    }
    const index = records.length, x=60+index*48;
    records.push({type:'building',id,role,category,prefab,height,baseY:0,
      geometrySource:'cs2:mesh-bounds',footprint:[[x-10,60],[x+10,60],[x+10,78],[x-10,78]]});
    labels.push({style,variant,x,id});
  }
  const base='data/model-catalog/';
  const manifest={format:'drive-city-v1',bounds:{minX:0,maxX:4800,minZ:0,maxZ:200},
    tileSize:4800,focus:[1800,70],terrain:{file:'terrain.json'},
    tiles:[{ix:0,iz:0,file:'tiles/0_0.json',buildingCount:95}]};
  const overview={format:'drive-city-overview-v1',roads:[{id:'main',width:12,
    points:[[0,0,20],[4800,0,20]]}],districts:[],stops:[]};
  const terrain={format:'drive-city-terrain-v1',rows:4,cols:50,origin:[0,0],cell:100,
    heights:Array(200).fill(0)};
  const tile={format:'drive-city-tile-v1',features:records};
  const files=new Map([[base+'manifest.json',manifest],[base+'overview.json',overview],
    [base+'terrain.json',terrain],[base+'tiles/0_0.json',tile]]);
  const map=await Imported.load(base+'manifest.json',{fetch:async url=>
    ({ok:files.has(url),json:async()=>files.get(url)})});
  assert.equal(map.buildings.length,95);
  for(const [i,building] of map.buildings.entries())
    assert.equal(building.modelVariant,labels[i].variant);
  const world=new THREE.Group(),visual=map.build(THREE,world);
  for(const [style] of zoned)
    assert.ok(world.getObjectByName('imported-city-building-'+style),
      `${style} source role and prefab render with their own facade family`);
  for(const [a,b] of [['office','glass'],['officeTower','tower'],['industrial','warehouse']]) {
    const facadeA=world.getObjectByName('imported-city-building-'+a);
    const facadeB=world.getObjectByName('imported-city-building-'+b);
    assert.notDeepEqual(Array.from(facadeA.material.map.image.data.slice(0,96)),
      Array.from(facadeB.material.map.image.data.slice(0,96)),
      `${a} and ${b} use distinct facade patterns`);
  }
  const roof=world.getObjectByName('imported-city-roof').geometry.attributes.position;
  const vertices=Array.from({length:95},()=>[]);
  for(let i=0;i<roof.count;i++) {
    const x=roof.getX(i), index=Math.round((x-60)/48);
    if(index<0||index>=95||Math.abs(x-labels[index].x)>13)continue;
    vertices[index].push([Math.round((x-labels[index].x)*100)/100,
      Math.round(roof.getY(i)*100)/100,Math.round((roof.getZ(i)-69)*100)/100]);
  }
  const signatures=vertices.map(points=>createHash('sha256')
    .update(JSON.stringify(points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2])))
    .digest('hex'));
  for(let group=0;group<families.length;group++) {
    const groupSignatures=signatures.slice(group*5,group*5+5);
    assert.ok(vertices[group*5].length>0,`${families[group][0]} has roof geometry`);
    assert.equal(new Set(groupSignatures).size,5,
      `${families[group][0]} has five different geometric roof recipes`);
  }
  visual.dispose();
});

test('imported housing, factories, and towers have distinct facades and silhouettes', async () => {
  const base = 'data/imported-city/';
  const manifest = { format: 'drive-city-v1', bounds: {minX:0,maxX:200,minZ:0,maxZ:200},
    tileSize:200, focus:[100,100], overview:{file:'overview.json'}, terrain:{file:'terrain.json'},
    tiles:[{ix:0,iz:0,file:'tiles/0_0.json',buildingCount:3}] };
  const overview = { format:'drive-city-overview-v1', roads:[{id:'road',kind:'ROAD',width:12,
    points:[[0,0,100],[200,0,100]]}], districts:[], stops:[] };
  const terrain = { format:'drive-city-terrain-v1', rows:4, cols:4, origin:[-50,-50],
    cell:100, heights:Array(16).fill(0) };
  const building = (id, x, height, role, category) => ({type:'building',id,role,category,height,baseY:0,
    footprint:[[x-8,60],[x+8,60],[x+8,72],[x-8,72]]});
  const tile = {format:'drive-city-tile-v1',features:[
    {type:'road',id:'local',kind:'ROAD',width:12,points:[[0,0,100],[200,0,100]]},
    building('house-0',20,9,'RESIDENTIAL','NA Low Density Housing'),
    building('factory-1',80,18,'INDUSTRIAL','Industrial Manufacturing'),
    building('tower-1',140,120,'RESIDENTIAL','NA High Density Housing')
  ]};
  const files = new Map([[base+'manifest.json',manifest],[base+'overview.json',overview],
    [base+'terrain.json',terrain],[base+'tiles/0_0.json',tile]]);
  const map = await Imported.load(base+'manifest.json',{fetch:async (url) =>
    ({ok:files.has(url),json:async()=>files.get(url)})});
  const world = new THREE.Group();
  const visual = map.build(THREE,world);
  const house = world.getObjectByName('imported-city-building-house');
  const factory = world.getObjectByName('imported-city-building-industrial');
  const tower = world.getObjectByName('imported-city-building-tower');
  assert.ok(house && factory && tower, 'separate merged facade families are present');
  assert.notDeepEqual(Array.from(house.material.map.image.data.slice(0,96)),
    Array.from(factory.material.map.image.data.slice(0,96)), 'facades do not share one painted pattern');
  assert.notDeepEqual(Array.from(factory.material.map.image.data.slice(0,96)),
    Array.from(tower.material.map.image.data.slice(0,96)));
  const roofs = world.getObjectByName('imported-city-roof').geometry.attributes.position;
  const roofHeights = (x0,x1) => {
    const ys = new Set();
    for(let i=0;i<roofs.count;i++) if(roofs.getX(i)>=x0 && roofs.getX(i)<=x1)
      ys.add(Math.round(roofs.getY(i)*100)/100);
    return [...ys].sort((a,b)=>a-b);
  };
  assert.ok(roofHeights(10,30).length>=2&&Math.max(...roofHeights(10,30))===9,
    'pitched house recipe has eaves below its roof peak');
  assert.ok(roofHeights(70,90).length>=2, 'factory has a sawtooth roof');
  const positions=tower.geometry.attributes.position, groundX=[], upperX=[];
  for(let i=0;i<positions.count;i++) {
    if(positions.getY(i)<8) groundX.push(positions.getX(i));
    if(positions.getY(i)>119) upperX.push(positions.getX(i));
  }
  assert.ok(Math.max(...upperX)-Math.min(...upperX)<Math.max(...groundX)-Math.min(...groundX),
    'upper tower is set back from its base');
  visual.dispose();
});

test('mesh-backed landmarks replace enclosing shells and ground features stay flat', async () => {
  const base='data/landmark-city/';
  const manifest={format:'drive-city-v1',bounds:{minX:0,maxX:320,minZ:0,maxZ:200},
    tileSize:320,focus:[90,60],meshBackedParentIds:['hospital-shell'],
    terrain:{file:'terrain.json'},tiles:[{ix:0,iz:0,file:'tiles/0_0.json',buildingCount:5}]};
  const overview={format:'drive-city-overview-v1',roads:[{id:'road',kind:'ROAD',width:12,
    points:[[0,0,20],[320,0,20]]}],districts:[],stops:[]};
  const terrain={format:'drive-city-terrain-v1',rows:4,cols:6,origin:[-50,-50],
    cell:100,heights:Array(24).fill(0)};
  const record=(id,category,role,x,width,height,name=category)=>({type:'building',id,name,category,role,
    height,baseY:0,footprint:[[x-width/2,60],[x+width/2,60],[x+width/2,80],[x-width/2,80]]});
  const tile={format:'drive-city-tile-v1',features:[
    {type:'road',id:'road',kind:'ROAD',width:12,points:[[0,0,20],[320,0,20]]},
    record('hospital-shell','Hospital','HEALTHCARE',30,30,28),
    {...record('hospital-mesh','Hospital','HEALTHCARE',30,16,28,'Hospital01 mesh 0'),
      prefab:'Hospital01 mesh 0',parentBuildingId:'hospital-shell'},
    record('stadium','Basketball Center','PARK_SERVICE',105,30,12),
    record('court','Basketball Court Decal','OTHER',175,26,12),
    record('courtyard','CN Low Density Courtyard Housing','RESIDENTIAL',260,22,10)
  ]};
  const files=new Map([[base+'manifest.json',manifest],[base+'overview.json',overview],
    [base+'terrain.json',terrain],[base+'tiles/0_0.json',tile]]);
  const map=await Imported.load(base+'manifest.json',{fetch:async url=>
    ({ok:files.has(url),json:async()=>files.get(url)})});
  const byId=Object.fromEntries(map.buildings.map(b=>[b.id,b]));
  assert.equal(byId['hospital-shell'].skipVisual,true);
  assert.equal(byId['hospital-shell'].skipCollider,true);
  assert.equal(byId['hospital-mesh'].skipVisual,false);
  assert.equal(byId.court.landscape,true);
  assert.equal(byId.court.skipCollider,true);
  assert.equal(byId.courtyard.skipCollider,false,'courtyard housing remains a solid building');
  const world=new THREE.Group(),visual=map.build(THREE,world);
  assert.ok(world.getObjectByName('imported-city-building-hospital'),'hospital has a distinct facade');
  const roofs=world.getObjectByName('imported-city-roof').geometry.attributes.position;
  const heights=(x0,x1)=>{const values=[];for(let i=0;i<roofs.count;i++)
    if(roofs.getX(i)>=x0&&roofs.getX(i)<=x1)values.push(roofs.getY(i));return values;};
  assert.equal(heights(15,20).length,0,'enclosing parent shell is not rendered');
  assert.ok(Math.max(...heights(90,120))>5&&Math.min(...heights(90,120))<1,
    'stadium has stepped stands around a low playing field');
  assert.ok(Math.max(...heights(160,190))<.2,'court decal is a ground surface, not a 12 m block');
  visual.dispose();
});

test('neighboring business towers do not repeat one cyan window wall', async () => {
  const base='data/business-row/';
  const manifest={format:'drive-city-v1',bounds:{minX:0,maxX:240,minZ:0,maxZ:160},
    tileSize:240,focus:[100,20],terrain:{file:'terrain.json'},
    tiles:[{ix:0,iz:0,file:'tiles/0_0.json',buildingCount:4}]};
  const overview={format:'drive-city-overview-v1',roads:[{id:'street',kind:'ROAD',width:12,
    points:[[0,0,20],[240,0,20]]}],districts:[],stops:[]};
  const terrain={format:'drive-city-terrain-v1',rows:4,cols:6,origin:[-50,-50],
    cell:60,heights:Array(24).fill(0)};
  const ids=['5502560','4551517','4551538','1306624'];
  const features=ids.map((id,index)=>{const x=35+index*50;return {type:'building',id,
    role:'COMMERCIAL',category:'NA High Density Business',height:index===3?100:55,baseY:0,
    name:index===3?'Stylus Tower':'NA High Density Business',
    footprint:[[x-12,60],[x+12,60],[x+12,82],[x-12,82]]};});
  const files=new Map([[base+'manifest.json',manifest],[base+'overview.json',overview],
    [base+'terrain.json',terrain],[base+'tiles/0_0.json',
      {format:'drive-city-tile-v1',features}]]);
  const map=await Imported.load(base+'manifest.json',{fetch:async url=>
    ({ok:files.has(url),json:async()=>files.get(url)})});
  const world=new THREE.Group(),visual=map.build(THREE,world);
  const glass=[];world.traverse(object=>{
    if(object.name==='imported-city-building-glass')glass.push(object);
  });
  assert.equal(glass.length,4,'four neighboring towers use four facade variants');
  const signature=glass.map(object=>createHash('sha256').update(object.material.map.image.data).digest('hex'));
  assert.equal(new Set(signature).size,4,'window patterns and colors differ between neighbors');
  assert.ok(world.getObjectByName('imported-city-building-trim'),
    'vertical ribs and floor bands break up long walls');
  const roofs=world.getObjectByName('imported-city-roof').geometry.attributes.position;
  let crown=0;for(let i=0;i<roofs.count;i++)if(roofs.getX(i)>165&&roofs.getX(i)<205)
    crown=Math.max(crown,roofs.getY(i));
  assert.ok(crown>120,'a named skyline tower gets a recognizable crown');
  visual.dispose();
});
