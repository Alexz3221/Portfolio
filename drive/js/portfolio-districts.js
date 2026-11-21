(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePortfolioDistricts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const byStopId = {
    about: {id:'arrival-concourse',title:'Arrival Concourse',stopId:'about'},
    projects: {id:'projects-plaza',title:'Projects Plaza',stopId:'projects'},
    experience: {id:'service-district',title:'Service District',stopId:'experience'},
    education: {id:'night-market',title:'Night Market',stopId:'education'},
    skills: {id:'campus',title:'Campus',stopId:'skills'},
    contact: {id:'south-street',title:'South Street',stopId:'contact'}
  };

  function districtsFor(city, skyMallDestination) {
    const districts = (city?.stops || []).flatMap(({id,x,z,color}) => {
      const district = byStopId[id];
      return district ? [{...district,x,z,color}] : [];
    });
    if (skyMallDestination) {
      const {title,x,z,mapX=x,mapZ=z,y} = skyMallDestination;
      districts.push({id:'sky-mall',title,x:mapX,z:mapZ,y});
    }
    return districts;
  }

  // A site pairs an existing building footprint with a nearby ground-level approach.
  // Sites are planning data. The six section stops still handle visits and fast travel.
  function site(id,title,sectionId,[name,x,z],approach) {
    return {id,title,sectionId,districtId:byStopId[sectionId].id,building:{name,x,z},approach};
  }

  const east = Math.PI / 2;
  const west = -east;
  const sites = [
    site('car-go-vroom','Car Go Vroom','projects',
      ['Concourse Garage',-34,36], {x:-20,z:36,heading:0}),
    site('oops-thats-canon','Oops, That’s Canon','projects',
      ['Branch Theatre',39,31], {x:20,z:30,heading:0}),
    site('computer-draw-a-little-guy','Computer, Draw a Little Guy','projects',
      ['Render Studio',36.5,-27.5], {x:20,z:-27.5,heading:0}),
    site('one-neuron-over','One Neuron Over','projects',
      ['Model Lab',-11,83], {x:-19.8,z:72.3,heading:Math.atan2(-28,23)}),
    site('edvise','Edvise','projects',
      ['Course Planning Center',-31.5,-27.5], {x:-38,z:-9,heading:Math.atan2(-34,-16)}),
    site('neurips-privacy-challenge','NeurIPS Privacy Challenge','projects',
      ['Privacy Research Tower',11,88], {x:22.3,z:74,heading:Math.atan2(31,25)}),
    site('unnecessary-lore','Unnecessary Lore','projects',
      ['North Printworks',58,69], {x:54.3,z:86,heading:Math.atan2(51,11)}),
    site('one-more-chapter','One More Chapter','projects',
      ['Plaza Reading Room',-44,58], {x:-43,z:76,heading:west}),
    site('spectrum','Spectrum','experience',
      ['Service Relay',133.3,-30.4], {x:115.5,z:-34,heading:0}),
    site('rtx-raytheon','RTX / Raytheon','experience',
      ['Systems Depot',139,19], {x:116,z:19,heading:0}),
    site('google','Google','experience',
      ['Service Overlook',83,15], {x:84.5,z:-9,heading:east}),
    site('coorstek','CoorsTek','experience',
      ['Materials Foundry',130,-60], {x:115,z:-61,heading:0}),
    site('rocket-software','Rocket Software','experience',
      ['Data Workshop',129,1.2], {x:115.5,z:1,heading:0})
  ];

  return {byStopId,districtsFor,sites};
});
