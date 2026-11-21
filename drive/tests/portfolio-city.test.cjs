const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('cannon');
const THREE = require('three');
const physics = require('../js/physics');
const city = require('../js/portfolio-city');
const playground = require('../js/portfolio-play');
const facades = require('../js/portfolio-facades');
const signText = require('../js/portfolio-sign-text');

test('each arrival podium has its own design and recessed bays on all four elevations', () => {
  const group = facades.attach(THREE, new THREE.Group(), city);
  const elevations = group.userData.arrivalFacades;
  assert.equal(elevations.length, 24);
  assert.equal(new Set(elevations.map(elevation => elevation.kind)).size, 6);
  for (const elevation of elevations) assert.ok(elevation.rooms > 0, elevation.building + ' · ' + elevation.face);
});

test('visible roof caps stand above the old roof plane', () => {
  const world = new THREE.Group();
  city.build(THREE, world);
  const roofs = world.getObjectByName('portfolio-roofs');
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
  assert.ok(roofs.count > 30);
  for (let index = 0; index < roofs.count; index++) {
    roofs.getMatrixAt(index, matrix);
    matrix.decompose(position, rotation, scale);
    const top = position.y + scale.y / 2;
    const source = city.buildings.find(building => !building.collisionOnly &&
      Math.abs(building.x - position.x) < .001 && Math.abs(building.z - position.z) < .001 &&
      Math.abs(building.width + .11 - scale.x) < .001 && Math.abs(building.depth + .11 - scale.z) < .001 &&
      Math.abs(building.baseY + building.height - top) < .6);
    assert.ok(source, 'each cap has a corresponding roof');
    assert.ok(top - (source.baseY + source.height) > .1, 'the visible faces have real separation');
  }
});

test('every overhead utility line terminates on an entrance gantry', () => {
  const world = new THREE.Group();
  city.build(THREE, world);
  world.updateMatrixWorld(true);
  const cables = world.getObjectByName('portfolio-utility-cables');
  const insulators = world.getObjectByName('portfolio-utility-insulators');
  const positions = cables.geometry.getAttribute('position');
  const matrix = new THREE.Matrix4();
  insulators.geometry.computeBoundingBox();
  const terminals = Array.from({length:insulators.count}, (_, index) => {
    insulators.getMatrixAt(index, matrix);
    return insulators.geometry.boundingBox.clone().applyMatrix4(matrix.premultiply(insulators.matrixWorld));
  });
  const terminalCenters = terminals.map(box => box.getCenter(new THREE.Vector3()));
  const spanRanges = city.entryRibs.filter((_, index) => index % 2 === 0)
    .map((rib, index) => [rib.z, city.entryRibs[index * 2 + 1].z]);
  assert.equal(positions.count, 120);
  assert.equal(terminals.length, 12);
  for (let index = 0; index < positions.count; index++) {
    const point = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(cables.matrixWorld);
    assert.ok(point.y > 8 && spanRanges.some(([from, to]) => point.z >= from && point.z <= to));
    if (index % 20 === 0 || index % 20 === 19) {
      assert.ok(terminalCenters.some(terminal => point.distanceTo(terminal) < .001));
    }
  }
});

test('sign lettering keeps its proportions when fitted to wide or narrow faces', () => {
  const previousDocument = global.document;
  const scales = [];
  const ctx = {
    scale: (x,y) => scales.push([x,y]),
    save() {}, translate() {}, restore() {}, fillText() {},
    measureText: () => ({width:200})
  };
  global.document = {createElement: () => ({getContext: () => ctx})};
  try {
    for (const faceWidth of [1,16]) {
      scales.length = 0;
      signText.canvas(faceWidth,1,512,256);
      signText.text(ctx,'PROCESS MODEL',24,80,84);
      const [, [x,y]] = scales;
      assert.ok(Math.abs(x * faceWidth / 512 - y / 256) < .00001);
      assert.ok(200 * x <= 84.00001);
      assert.ok(y > 0 && y <= 1);
    }
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});

test('the rebuilt arrival towers have matching roof collision and meet both transfer sockets', () => {
  const world=new THREE.Group();
  city.build(THREE,world);
  world.updateMatrixWorld(true);
  const simulation=physics.create({map:'city',city,distanceToRoad:city.distanceToRoad,roadHalfWidth:city.roadHalfWidth});
  for (const [name,x,z] of [
    ['portfolio-zenith-vault-slate',20.2,-100.6],
    ['portfolio-sublight-freight-hoist-masonry',24,-88.42],
    ['portfolio-sublight-interlocking-masonry',29,-68.82]
  ]) {
    const ray=new THREE.Raycaster(new THREE.Vector3(x,95,z),new THREE.Vector3(0,-1,0));
    const [roof]=ray.intersectObject(world.getObjectByName(name));
    assert.ok(roof,`${name} has a visible roof`);
    const hit=new C.RaycastResult();
    simulation.world.raycastClosest(new C.Vec3(x,95,z),new C.Vec3(x,0,z),{skipBackfaces:true},hit);
    assert.ok(hit.hasHit && Math.abs(hit.hitPointWorld.y-roof.point.y)<.17,`${name} has matching roof collision`);
  }

  function insideInstance(name, point) {
    const mesh=world.getObjectByName(name), matrix=new THREE.Matrix4();
    mesh.geometry.computeBoundingBox();
    for (let index=0;index<mesh.count;index++) {
      mesh.getMatrixAt(index,matrix);
      matrix.premultiply(mesh.matrixWorld).invert();
      if (mesh.geometry.boundingBox.containsPoint(point.clone().applyMatrix4(matrix))) return true;
    }
    return false;
  }
  for (const [x,z,tower] of [
    [-19,-80.1,'portfolio-arrival-upper-balcony-block'],
    [19,-74.5,'portfolio-sublight-interlocking-bridge-entry-block']
  ]) {
    const landing=new THREE.Vector3(x,28.5,z);
    const deckEnd=new THREE.Vector3(x-Math.sign(x)*.25,26.55,z);
    assert.ok(insideInstance(tower,landing),`${tower} overlaps its landing`);
    assert.ok(insideInstance('portfolio-high-transfer-sockets',landing),`${tower} meets its socket`);
    assert.ok(insideInstance('portfolio-high-transfer-sockets',deckEnd));
    assert.ok(insideInstance('portfolio-high-transfer-deck',deckEnd));
  }
  simulation.dispose();
});

test('the portfolio city has six drivable stops and collision-backed buildings', () => {
  assert.notEqual(city, physics.city);
  assert.deepEqual(city.stops.map(stop => stop.id).sort(),
    ['about', 'contact', 'education', 'experience', 'projects', 'skills']);
  const simulation = physics.create({map:'city', city, distanceToRoad:city.distanceToRoad, roadHalfWidth:city.roadHalfWidth});
  for (const stop of city.stops) {
    simulation.reset(stop.x, stop.z, stop.heading);
    let state;
    for (let frame = 0; frame < 90; frame++) state = simulation.step(1 / 120, {});
    assert.ok(city.distanceToRoad(stop.x, stop.z) < city.roadHalfWidth, stop.id + ' is on pavement');
    assert.equal(state.grounded, 4, stop.id + ' has room to park');
    assert.ok(Math.hypot(simulation.body.position.x - stop.x, simulation.body.position.z - stop.z) < .3);
  }
  const building = city.buildings[0];
  const hit = new C.RaycastResult();
  simulation.world.raycastClosest(new C.Vec3(building.x, 200, building.z), new C.Vec3(building.x, -1, building.z), {}, hit);
  assert.ok(hit.hasHit && hit.hitPointWorld.y >= building.height, 'the rendered footprint has a solid collider');
});

test('the portfolio test bay has moveable pylons and a driveable jump', () => {
  const simulation = physics.create({map:'city', city, distanceToRoad:city.distanceToRoad, roadHalfWidth:city.roadHalfWidth});
  const world = new THREE.Group();
  const play = playground.create(C, THREE, world, simulation, city.playProps);
  const pylons = world.getObjectByName('portfolio-test-bay-pylons').children;
  const starts = pylons.map(pylon => pylon.position.clone());
  simulation.reset(80, -78, 0);
  for (let frame = 0; frame < 400; frame++) {
    simulation.step(1 / 120, {throttle:1, steer:0});
    play.update(1 / 120);
  }
  assert.ok(pylons.some((pylon, i) => pylon.position.distanceTo(starts[i]) > 1));
  play.reset();
  pylons.forEach((pylon, i) => assert.ok(pylon.position.distanceTo(starts[i]) < .001));

  simulation.reset(72, -76, 0);
  let peak = 0;
  for (let frame = 0; frame < 420; frame++) {
    simulation.step(1 / 120, {throttle:1, steer:0});
    peak = Math.max(peak, simulation.body.position.y);
  }
  assert.ok(peak > 3.5 && simulation.body.position.z > -50);
  const count = simulation.world.bodies.length;
  play.dispose();
  assert.equal(simulation.world.bodies.length, count - pylons.length);
});

test('the skyway crosses both tower portals in both directions above the open lower street', () => {
  const simulation = physics.create({map:'city', city, distanceToRoad:city.distanceToRoad, roadHalfWidth:city.roadHalfWidth});
  for (const [start, direction] of [[city.skyway.west,1], [city.skyway.east,-1]]) {
    simulation.reset(start.x, start.z, start.heading);
    let abovePlaza = false;
    for (let frame=0; frame<2200; frame++) {
      const state = simulation.step(1/120, {throttle:.52});
      const {x,y,z} = simulation.body.position;
      assert.ok(Math.abs(z-start.z) < .35, `${start.id} remains in its lane`);
      if (Math.abs(x)<8 && state.grounded===4 && y>11.5) abovePlaza = true;
      if ((x-start.x)*direction>216 && y<1.6) break;
    }
    assert.ok(abovePlaza, `${start.id} drives on an elevated deck through the plaza`);
    assert.ok((simulation.body.position.x-start.x)*direction>216 && simulation.body.position.y<1.6,
      `${start.id} returns to the opposite ground-level street`);
  }
  simulation.reset(0,-40,0);
  for (let frame=0; frame<900 && simulation.body.position.z<-21; frame++) {
    simulation.step(1/120,{throttle:.52});
    assert.ok(simulation.body.position.y<1.5, 'lower approach stays below the raised deck');
  }
  assert.ok(simulation.body.position.z>=-21, 'the lower route continues through the crossing');
});

test('either Skyway entrance can reach the mall and return through the other branch', () => {
  const {branches,loop,deck}=city.skyMall;
  const entrances=[city.skyway.west,city.skyway.east];
  const endpoints=segments=>[[segments[0].x1,segments[0].z1],...segments.map(s=>[s.x2,s.z2])];
  const arc=(x,z,side)=>{
    const radius=6.5;
    return Array.from({length:9},(_,index)=>{
      const angle=index*Math.PI/16;
      return [x+side*radius*(1-Math.sin(angle)),z+radius*(1-Math.cos(angle))];
    });
  };
  const clamp=THREE.MathUtils.clamp;
  const forward=new C.Vec3(0,0,1);
  for (const index of [0,1]) {
    const other=1-index, side=index===0 ? -1 : 1;
    const start=entrances[index], finish=entrances[other];
    const ascend=endpoints(branches[index]),descend=endpoints(branches[other]);
    const enter=arc(ascend[0][0],start.z,side),leave=arc(descend[0][0],finish.z,-side);
    const across= index===0 ? endpoints(loop) : endpoints(loop).reverse();
    const points=[[start.x,start.z],...enter,...ascend.filter(point=>point[1]>enter.at(-1)[1]),
      ...across.slice(1),...descend.slice(0,-1).filter(point=>point[1]>leave.at(-1)[1]).reverse(),
      ...leave.reverse(),[finish.x,finish.z]];
    const route=points.slice(1).map(([x,z],i)=>{
      const [fromX,fromZ]=points[i],dx=x-fromX,dz=z-fromZ;
      return {fromX,fromZ,dx,dz,length:Math.hypot(dx,dz)};
    });
    const sim=physics.create({map:'city',city,distanceToRoad:city.distanceToRoad,roadHalfWidth:city.roadHalfWidth});
    sim.reset(start.x,start.z,start.heading);
    let current=0,reachedMall=false,reachedExit=false;
    // Follow the connected route with ordinary steering, throttle and brake.
    for(let frame=0;frame<8200;frame++) {
      const {position:{x,y,z},velocity,quaternion}=sim.body;
      if (current===route.length-1 && Math.hypot(x-finish.x,z-finish.z)<3 && y<1.5) {
        reachedExit=true;
        break;
      }
      const distanceAlong=s=>((x-s.fromX)*s.dx+(z-s.fromZ)*s.dz)/s.length;
      while (current<route.length-1 && distanceAlong(route[current])>route[current].length-.48) current++;
      const speed=Math.hypot(velocity.x,velocity.z);
      let along=clamp(distanceAlong(route[current]),0,route[current].length)+1.7+speed*.27;
      let next=current;
      while (next<route.length-1 && along>=route[next].length) along-=route[next++].length;
      const aim=route[next],t=Math.min(1,along/aim.length);
      const facing=quaternion.vmult(forward);
      const angle=Math.atan2(aim.fromX+t*aim.dx-x,aim.fromZ+t*aim.dz-z)-Math.atan2(facing.x,facing.z);
      const error=Math.atan2(Math.sin(angle),Math.cos(angle));
      const targetSpeed=current===0||current===route.length-1 ? 7.8 : 5.1;
      const state=sim.step(1/120,{
        throttle:clamp((targetSpeed-speed)*.35+.08,.04,.70),
        brake:speed>targetSpeed+.55 ? Math.min(.65,(speed-targetSpeed)*.3) : 0,
        steer:clamp(error*2.25,-1,1)
      });
      if (frame>20) assert.ok(state.grounded>=2,`${start.id} maintains wheel contact across the joins`);
      if (Math.abs(x)<4 && z>44 && y>deck.y && state.grounded===4) reachedMall=true;
    }
    assert.ok(reachedMall,`${start.id} climbs and crosses the mall`);
    assert.ok(reachedExit,`${start.id} can descend to the other ground-level exit`);
    sim.dispose();
  }
});

test('the chase camera clears the skyway slab and retains an open view down the street', () => {
  const focus = {x:-72,y:1.5,z:-21.5};
  assert.ok(city.constrainCamera(focus,{x:-72,y:4.9,z:-32}) < .95);
  assert.equal(city.constrainCamera(focus,{x:-72,y:4.2,z:-16}),1);
  assert.equal(city.constrainCamera({x:5,y:13.2,z:-27.5},{x:-7,y:16,z:-27.5}),1);
});
