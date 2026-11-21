const test = require('node:test');
const assert = require('node:assert/strict');
const city = require('../js/portfolio-city');
const physics = require('../js/physics');
const {destination: skyMall} = require('../js/portfolio-sky-mall');
const {stories} = require('../js/portfolio-ui');
const {byStopId,districtsFor,sites} = require('../js/portfolio-districts');

test('portfolio sections have distinct districts and Sky Mall uses its landmark position', () => {
  const districts = districtsFor(city);
  assert.deepEqual(districts.map(district => district.stopId), city.stops.map(stop => stop.id));
  assert.equal(new Set(districts.map(district => district.id)).size, city.stops.length);
  for (const [index, {id,x,z}] of city.stops.entries()) {
    assert.deepEqual(districts[index], {...byStopId[id],x,z,color:city.stops[index].color});
  }

  const withMall = districtsFor(city,skyMall);
  assert.deepEqual(withMall.slice(0,-1), districts);
  assert.deepEqual(withMall.at(-1), {id:skyMall.id,title:skyMall.title,x:skyMall.mapX,y:skyMall.y,z:skyMall.mapZ});
});

test('each project and experience entry has a distinct footprint with a drivable approach', () => {
  const titlesFor = sectionId => sites.filter(site => site.sectionId === sectionId).map(site => site.title);
  const projectTitles = [...stories.projects.body.matchAll(/<strong>([^<]+)<\/strong>|class="city-inline-link">([^<]+)<\/a>/g)]
    .map(([,card,link]) => card || link.replace(' (blog)','').replace(' (reader)',''));
  const experienceTitles = [...stories.experience.body.matchAll(/<h3>([^<]+) · /g)].map(([,title]) => title);
  assert.deepEqual(titlesFor('projects'), projectTitles);
  assert.deepEqual(titlesFor('experience'), experienceTitles);
  assert.equal(new Set(sites.map(site => site.id)).size, sites.length);
  assert.equal(new Set(sites.map(site => `${site.building.x},${site.building.z}`)).size, sites.length);

  const simulation = physics.create({map:'city',city,distanceToRoad:city.distanceToRoad,roadHalfWidth:city.roadHalfWidth});
  try {
    for (const {id,sectionId,districtId,building,approach} of sites) {
      assert.equal(districtId, byStopId[sectionId].id, id);
      assert.ok(building.name, id);
      assert.ok(city.buildings.some(block => block.baseY === 0 && !block.collisionOnly &&
        block.x === building.x && block.z === building.z), `${id} has a building footprint`);
      const {x,z,heading} = approach;
      assert.ok(city.distanceToRoad(x,z) < city.roadHalfWidth, `${id} can be reached from the road`);
      simulation.reset(x,z,heading);
      let state;
      for (let frame = 0; frame < 90; frame++) state = simulation.step(1 / 120, {});
      assert.equal(state.grounded, 4, `${id} has room to park`);
      assert.ok(Math.hypot(simulation.body.position.x - x,simulation.body.position.z - z) < .3, id);
    }
  } finally {
    simulation.dispose();
  }
});
