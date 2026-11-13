'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const C = require('cannon');
const Imported = require('../js/imported-city');
const Physics = require('../js/physics');

test('source lane connector curves render a raised junction with matching collision', async () => {
  const base = 'data/lane-graph-fixture/';
  const edgeFields = ['entity_id','entity_version','edge_id','edge_version','edge_start_node_id',
    'edge_end_node_id','start_lane_index','end_lane_index','start_path_index','end_path_index',
    'edge_delta','width_m','speed_limit_mps','car_flags','twoway','forbidden','unsafe','public_only','curve'];
  const connectorFields = ['entity_id','entity_version','node_id','node_version','from_edge_id',
    'from_edge_version','from_lane_index','from_path_index','to_edge_id','to_edge_version',
    'to_lane_index','to_path_index','path_methods','path_methods_bits','width_m','car_flags',
    'forbidden','unsafe','public_only','curve'];
  const connectorCurve = [[80,3,50],[90,3,90],[110,3,90],[120,3,50]];
  const firstRoad = {type:'road',id:'1',kind:'ROAD',mode:'GROUND',width:8,
    points:[[10,3,50],[80,3,50]]};
  const secondRoad = {type:'road',id:'2',kind:'ROAD',mode:'GROUND',width:8,
    points:[[120,3,50],[190,3,50]]};
  const manifest = {format:'drive-city-v1',bounds:{minX:-200,maxX:200,minZ:-200,maxZ:200},
    tileSize:200,focus:[50,50],overview:{file:'overview.json'},terrain:{file:'terrain.json'},
    tiles:[{ix:0,iz:0,file:'tiles/0_0.json',buildingCount:0}],
    laneGraph:{format:'drive-city-lane-graph-v1',edgeFields,connectorFields,tiles:[{ix:0,iz:0,
      edgeLanes:{file:'lane-graph/edge-lanes/0_0.json',count:1},
      connectors:{file:'lane-graph/connectors/0_0.json',count:1}}]},
    trafficLights:{file:'traffic-lights.json',count:1}};
  const edge = [11,1,1,1,10,20,2,2,2,2,[0,1],3,20,64,false,false,false,false,
    [[10,3,50],[30,3,50],[60,3,50],[80,3,50]]];
  const connector = [21,1,20,1,1,1,2,2,2,1,2,2,'Road',2,3,64,false,false,false,connectorCurve];
  const files = new Map([
    [base+'manifest.json',manifest],
    [base+'overview.json',{format:'drive-city-overview-v1',roads:[firstRoad,secondRoad],districts:[],stops:[]}],
    [base+'terrain.json',{format:'drive-city-terrain-v1',rows:5,cols:5,origin:[-200,-200],
      cell:100,heights:Array(25).fill(0)}],
    [base+'tiles/0_0.json',{format:'drive-city-tile-v1',features:[firstRoad,secondRoad]}],
    [base+'lane-graph/edge-lanes/0_0.json',{format:'drive-city-lane-tile-v1',ix:0,iz:0,
      kind:'edgeLanes',items:[edge]}],
    [base+'lane-graph/connectors/0_0.json',{format:'drive-city-lane-tile-v1',ix:0,iz:0,
      kind:'connectors',items:[connector]}],
    [base+'traffic-lights.json',{format:'drive-city-traffic-lights-v1',lights:[
      {nodeId:20,position:[100,3,80],active:true}]}]
  ]);
  const map = await Imported.load(base+'manifest.json', {fetch:async (url) => ({
    ok:files.has(url),json:async () => files.get(url) })});
  const tile = map.loadedTiles.get('0,0').data;
  assert.equal(tile.edgeLanes[0].edge_id,1);
  assert.equal(tile.connectors[0].from_lane_index,2);
  assert.equal(map.trafficLights[0].nodeId,20);
  assert.equal(map.nearbyLaneConnectors(100,80,5).length,1);

  const world = new THREE.Group(), visual = map.build(THREE,world);
  const surface = world.getObjectByName('imported-city-lane-connector');
  assert.ok(surface,'Bezier lane path has an asphalt ribbon');
  assert.equal(surface.geometry.attributes.uv.count,surface.geometry.attributes.position.count);
  const physics = Physics.create({map:'city',city:map,distanceToRoad:map.distanceToRoad,
    roadHalfWidth:map.roadHalfWidth});
  physics.reset(100,80);
  const ray = new C.RaycastResult();
  assert.ok(physics.world.raycastClosest(new C.Vec3(100,8,80),new C.Vec3(100,0,80),{},ray));
  assert.ok(Math.abs(ray.hitPointWorld.y - 3.08) < .05,
    'the curved connector collider reaches the visible raised pavement');
  physics.dispose(); visual.dispose();
});
