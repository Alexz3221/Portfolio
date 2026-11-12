'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const THREE = require('three');
const Imported = require('../js/imported-city');

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
    building('house-1',20,9,'RESIDENTIAL','NA Low Density Housing'),
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
  assert.deepEqual(roofHeights(10,30),[7.02,9], 'house has eaves and a pitched peak');
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
