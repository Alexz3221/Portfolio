'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const C=require('cannon');
const Imported=require('../js/imported-city');
const Physics=require('../js/physics');

test('converted city streams visual tiles and matching colliders as the car changes district',async()=>{
  const base='data/imported-city/';
  const manifest={format:'drive-city-v1',bounds:{minX:-1000,maxX:1000,minZ:-1000,maxZ:1000},tileSize:200,
    focus:[-300,0],overview:{file:'overview.json'},terrain:{file:'terrain.json'},tiles:[
      {ix:-2,iz:0,file:'tiles/-2_0.json',buildingCount:1},
      {ix:4,iz:0,file:'tiles/4_0.json',buildingCount:1}
    ]};
  const overview={format:'drive-city-overview-v1',roads:[{id:'main',kind:'ROAD',mode:'normal',width:12,
    points:[[-900,0,0],[900,0,0]]}],districts:[],stops:[]};
  const terrain={format:'drive-city-terrain-v1',rows:21,cols:21,origin:[-1050,-1050],cell:100,
    heights:Array(21*21).fill(0)};
  const building=(id,x)=>({type:'building',id,footprint:[[x-5,45],[x+5,45],[x+5,55],[x-5,55]],baseY:0,height:10});
  const tiles={
    '-2_0':{format:'drive-city-tile-v1',features:[
      {type:'road',id:'west',kind:'ROAD',mode:'normal',width:12,points:[[-350,0,0],[-250,1,0]]},
      {type:'road',id:'west-bridge',kind:'ROAD',mode:'elevated',width:10,points:[[-350,6,30],[-250,6,30]]},
      building('west-tower',-300)]},
    '4_0':{format:'drive-city-tile-v1',features:[
      {type:'road',id:'east',kind:'ROAD',mode:'normal',width:12,points:[[850,0,0],[950,.5,0]]},
      building('east-tower',900)]}
  };
  const files=new Map([[base+'manifest.json',manifest],[base+'overview.json',overview],
    [base+'terrain.json',terrain],[base+'tiles/-2_0.json',tiles['-2_0']],[base+'tiles/4_0.json',tiles['4_0']]]);
  const fetchFile=async url=>({ok:files.has(url),json:async()=>files.get(url)});
  const map=await Imported.load(base+'manifest.json',{fetch:fetchFile});
  assert.equal(map.buildings.length,1,'only the starting district loads initially');
  assert.equal(map.highwaySegments.length,1);
  assert.equal(map.stops.length,6);
  const world=new THREE.Group(),visual=map.build(THREE,world);
  assert.ok(world.getObjectByName('imported-city-terrain-chunk'));
  assert.ok(world.getObjectByName('imported-city-road'));
  assert.ok(world.getObjectByName('imported-city-highway'));
  assert.ok(world.getObjectByName('imported-city-building'));
  const physics=Physics.create({map:'city',city:map,distanceToRoad:map.distanceToRoad,roadHalfWidth:map.roadHalfWidth});
  physics.reset(-300,0);
  let grounded=0;for(let i=0;i<120;i++)grounded=Math.max(grounded,physics.step(1/60).grounded);
  assert.ok(grounded>=2,'car settles onto the graded imported street');
  const roof=(x)=>{const result=new C.RaycastResult();assert.ok(physics.world.raycastClosest(
    new C.Vec3(x,20,50),new C.Vec3(x,5,50),{},result));return result.hitPointWorld.y;};
  assert.ok(Math.abs(roof(-300)-10)<.01);
  physics.reset(900,0);
  await map.ensureNear(900,0,240);
  physics.reset(900,0);
  visual.update({position:{x:900,y:8,z:0}},1/60);
  assert.equal(map.buildings.length,1,'the distant tile is evicted');
  assert.equal(map.buildings[0].id,'east-tower');
  assert.ok(Math.abs(roof(900)-10)<.01,'newly loaded tower has a collider');
  assert.equal(world.getObjectByName('imported-city-highway'),undefined,'evicted bridge mesh is removed');
  const tile=world.getObjectByName('imported-city-tile');
  assert.equal(tile.userData.tile.ix,4,'renderer follows the loaded district');
  physics.dispose();visual.dispose();
});
