'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
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
    if(positions.getY(i)<1) groundX.push(positions.getX(i));
    if(positions.getY(i)>119) upperX.push(positions.getX(i));
  }
  assert.ok(Math.max(...upperX)-Math.min(...upperX)<Math.max(...groundX)-Math.min(...groundX),
    'upper tower is set back from its base');
  visual.dispose();
});
