const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const audit = require('../js/portfolio-scene-audit');
const city = require('../js/portfolio-city');
const holograms = require('../js/portfolio-holograms');
const storefronts = require('../js/portfolio-storefronts');
const skyMall = require('../js/portfolio-sky-mall');

const geometry = new THREE.BoxGeometry(1,1,1);
const material = new THREE.MeshStandardMaterial();

function panel(parent,name,position,scale) {
  const mesh = new THREE.Mesh(geometry,material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

test('finds an instanced support blocking a rotated sign face', () => {
  const world = new THREE.Group();
  const cabinet = new THREE.Group();
  cabinet.rotation.y = Math.PI/2;
  world.add(cabinet);
  const display = panel(cabinet,'display',[0,3,0],[6,2,.5]);
  display.userData = {portfolioAdId:'market',portfolioAdFace:true};
  panel(cabinet,'mounting frame',[0,3,.30],[6.2,2.2,.23]);
  panel(world,'wall behind sign',[-.6,3,0],[.3,6,6]);
  const posts = new THREE.InstancedMesh(geometry,material,2);
  posts.name = 'rib';
  const post = new THREE.Object3D();
  post.position.set(.45,2,-1);
  post.scale.set(.4,4,.28);
  post.rotation.y = .31;
  post.updateMatrix();
  posts.setMatrixAt(0,post.matrix);
  post.position.z = 5;
  post.updateMatrix();
  posts.setMatrixAt(1,post.matrix);
  world.add(posts);
  const result = audit.run(THREE,world,{});
  assert.deepEqual(result.checked,{signs:1,corridors:0});
  assert.deepEqual(result.signs,[{target:'market',obstacle:'rib#0',at:[.45,2,-1]}]);
});

test('detects extruded letter signs buried in a facade', () => {
  const world = new THREE.Group();
  const font = new THREE.Font(require('../assets/portfolio-type/display.json'));
  const lettering = new THREE.TextGeometry('EDUCATION',{font,size:1,height:.09});
  lettering.center();
  const text = new THREE.Mesh(lettering,material);
  text.userData = {portfolioAdId:'education-label',portfolioAdFace:true};
  text.position.set(1.81,4,0);
  text.rotation.y = Math.PI/2;
  world.add(text);
  panel(world,'school wall',[0,4,0],[4,8,12]);

  assert.deepEqual(audit.run(THREE,world,{}).signs,[
    {target:'education-label',obstacle:'school wall',at:[0,4,0]}
  ]);
  text.position.x = 2.1;
  assert.deepEqual(audit.run(THREE,world,{}).signs,[]);
});

test('checks ground and upper roads at their own heights', () => {
  const world = new THREE.Group();
  panel(world,'deck',[0,5.65,0],[16,.5,5]);
  panel(world,'lane post',[2,1.8,0],[.55,2.5,.55]);
  panel(world,'walkway post',[2,1.8,4],[.55,2.5,.55]);
  panel(world,'upper road post',[-4,7.4,0],[.55,2.5,.55]);
  const road = {x1:-8,z1:0,x2:8,z2:0,width:5};
  const run = audit.run(THREE,world,{
    networkRoads:[road],
    highwaySegments:[{...road,topStart:6,topEnd:7}]
  });
  assert.equal(run.checked.corridors,2);
  assert.deepEqual(run.corridors,[
    {target:'street-1',obstacle:'lane post',at:[2,1.8,0]},
    {target:'skyway-1',obstacle:'upper road post',at:[-4,7.4,0]}
  ]);
});

test('Portfolio City billboard faces and central drive corridors are clear', () => {
  const world = new THREE.Group();
  city.build(THREE,world);
  storefronts.attach(THREE,world);
  const mall = skyMall.attach(THREE,world);
  const mallSigns = [];
  world.getObjectByName('portfolio-sky-mall').traverse(object => {
    if (object.userData.portfolioAdFace) mallSigns.push(object);
  });
  holograms.create(THREE,world,[],{adverts:city.adPlacements});
  const report = audit.run(THREE,world,city);
  mall.dispose();
  const roadSigns = world.children.filter(object=>object.name==='portfolio-sign');
  assert.ok(roadSigns.length > 0 && mallSigns.length > 0);
  assert.equal(report.checked.signs,city.adPlacements.length+roadSigns.length+mallSigns.length);
  assert.equal(report.checked.corridors,city.networkRoads.length+city.highwaySegments.length+city.skyMall.loop.length);
  assert.deepEqual(report.signs,[]);
  assert.deepEqual(report.corridors,[]);
});
