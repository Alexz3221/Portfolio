const test = require('node:test');
const assert = require('node:assert/strict');
const city = require('../js/portfolio-city');
const physics = require('../js/physics');
const {stories,nearestStopOnLevel} = require('../js/portfolio-ui');
const {byStopId,districtsFor,sites,projects,experience,education,projectStopsFor,siteStopsFor} = require('../js/portfolio-districts');

test('each portfolio section has its own district and Aerie Arcade is a Projects Plaza landmark', () => {
  const districts = districtsFor(city);
  assert.deepEqual(districts.map(district => district.stopId), city.stops.map(stop => stop.id));
  assert.equal(new Set(districts.map(district => district.id)).size, city.stops.length);
  for (const [index, {id,x,z}] of city.stops.entries()) {
    assert.deepEqual(districts[index], {...byStopId[id],x,z,color:city.stops[index].color});
  }

  const {destination} = city.skyMall;
  assert.equal(destination.kind, 'landmark');
  assert.ok(!districts.some(district => district.id === destination.id));
  assert.ok(projects.every(project => project.districtId === byStopId.projects.id));
  assert.equal(byStopId.education.title, 'Boulder Campus');
  assert.equal(byStopId.skills.title, 'Workshop Quarter');
});

test('each portfolio site has an overview card and a distinct drivable approach', () => {
  const cardIds = section => [...stories[section].body.matchAll(/data-stop="([^"]+)"/g)].map(([,id]) => id);
  assert.equal(projects.length, 8);
  assert.equal(experience.length, 6);
  assert.equal(education.length, 3);
  assert.deepEqual(cardIds('projects'), [...projects.filter(p => p.approach.y === 0),
    ...projects.filter(p => p.approach.y > 0)].map(project => project.stopId));
  for (const [section,entries] of [['experience',experience],['education',education]]) {
    assert.deepEqual(cardIds(section), entries.map(site => site.stopId));
  }
  assert.ok(experience.every(site => site.position));
  const boulder = experience.find(site => site.id === 'cu-boulder');
  assert.equal(boulder.position, 'Course Assistant');
  assert.equal(boulder.dates, undefined);
  assert.equal(new Set(sites.map(site => site.id)).size, sites.length);
  assert.equal(new Set(sites.map(site => `${site.building.x},${site.building.z}`)).size, sites.length);

  const simulation = physics.create({map:'city',city,distanceToRoad:city.distanceToRoad,roadHalfWidth:city.roadHalfWidth});
  try {
    for (const {id,sectionId,districtId,building,approach} of sites) {
      assert.ok(building.name, id);
      const {x,y=0,z,heading} = approach;
      assert.equal(districtId, byStopId[sectionId].id, id);
      if (y > 0) {
        const deck = city.skyMall.deck;
        assert.equal(y, deck.y, id);
        assert.ok(building.x > deck.minX && building.x < deck.maxX &&
          building.z > deck.minZ && building.z < deck.maxZ, `${id} is inside Aerie Arcade`);
      } else {
        assert.ok(city.buildings.some(block => block.baseY === 0 &&
          Math.abs(block.x - building.x) < block.width / 2 &&
          Math.abs(block.z - building.z) < block.depth / 2), `${id} has a building footprint`);
        assert.ok(city.distanceToRoad(x,z) < city.roadHalfWidth, `${id} can be reached from the road`);
      }
      simulation.reset(x,z,heading,y);
      let state;
      for (let frame = 0; frame < 90; frame++) state = simulation.step(1 / 120, {});
      assert.equal(state.grounded, 4, `${id} has room to park`);
      assert.ok(Math.abs(simulation.body.position.y - y) < 2, `${id} parks at the intended elevation`);
      assert.ok(Math.hypot(simulation.body.position.x - x,simulation.body.position.z - z) < .3, id);
    }
  } finally {
    simulation.dispose();
  }
});

test('education degree cards retain their exact degrees and graduation dates', () => {
  assert.deepEqual(education.map(({title,dates}) => [title,dates]), [
    ['B.S. Computer Science','May 2026'],
    ['B.A. Mathematics','May 2026'],
    ['M.S. Computer Science','Expected May 2028']
  ]);
  assert.ok(education.every(site => site.organization === 'University of Colorado Boulder' &&
    site.districtId === 'boulder-campus'));
});

test('portfolio proximity honors each site’s elevation and radius', () => {
  const stops = siteStopsFor(city);
  assert.equal(stops.length, 17);
  assert.equal(projectStopsFor(city).length, 8);
  assert.equal(siteStopsFor(city,experience).length, 6);
  assert.equal(siteStopsFor(city,education).length, 3);
  assert.equal(stops.filter(stop => stop.y === city.skyMall.deck.y).length, 3);
  for (const stop of stops) {
    const {x,y,z} = stop;
    assert.equal(nearestStopOnLevel({x,y:y+.85,z},stops,true).stop.id, stop.id);
    assert.equal(nearestStopOnLevel({x,y:y+12,z},stops,true), null);
    assert.equal(nearestStopOnLevel({x,y:y+.85,z:z-stop.interactionRadius-.3},[stop],true), null);
  }
  assert.equal(projectStopsFor({...city,skyMall:null}).length, 5);
  assert.deepEqual(projectStopsFor(null), []);
});

test('section markers and close-by sites each open at their own marker', () => {
  const stops = [...city.stops,...siteStopsFor(city)];
  for (const [sectionId,siteId] of [['experience','experience-rtx-raytheon'],['education','education-bs-computer-science']]) {
    const section = stops.find(stop => stop.id === sectionId);
    const site = stops.find(stop => stop.id === siteId);
    assert.ok(Math.hypot(section.x - site.x,section.z - site.z) < site.interactionRadius);
    assert.equal(nearestStopOnLevel({...section,y:.85},stops,true).stop.id, sectionId);
    assert.equal(nearestStopOnLevel({...site,y:.85},stops,true).stop.id, siteId);
  }
});
