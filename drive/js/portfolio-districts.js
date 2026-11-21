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

  function districtsFor(city) {
    return (city?.stops || []).flatMap(({id,x,z,color}) => {
      const district = byStopId[id];
      return district ? [{...district,x,z,color}] : [];
    });
  }

  function site(id,title,sectionId,[name,x,z],approach) {
    return {id,title,sectionId,districtId:byStopId[sectionId].id,building:{name,x,z},approach};
  }

  const east = Math.PI / 2;
  function project(id,title,building,{x,z,heading,y=0},content) {
    const upper = y > 0;
    const approach = {x,y,z,heading,interactionRadius:upper ? 8 : 12};
    const record = site(id,title,'projects',building,approach);
    record.building.y = y;
    return {...record,...content,stopId:`project-${id}`};
  }

  const projects = [
    project('car-go-vroom','Car Go Vroom',['Concourse Garage',-34,36], {x:-20,z:36,heading:0}, {
      summary:'Explore this city or race a ghost on the stunt course.',
      detail:'Save your best lap, share the replay with a friend, or compare times on the leaderboard.',
      link:{href:'./',label:'Play Car Go Vroom'}
    }),
    project('oops-thats-canon','Oops, That’s Canon',['Signal Cinema',0,57.6], {x:0,y:26,z:47.4,heading:east}, {
      summary:'A local tool for interactive stories with choices and editable scenes.',
      detail:'Rewind to try another choice. Adventure Studio keeps notes about what happened as the story moves forward.',
      link:{href:'../projects/local-ai/#adventure',label:'View the story tools'}
    }),
    project('computer-draw-a-little-guy','Computer, Draw a Little Guy',
      ['Render Workshop',12.35,57.6], {x:12.35,y:26,z:47.4,heading:east}, {
        summary:'Generate images and turn references into prompts.',
        detail:'The local image workspace saves your variations to a gallery.',
        link:{href:'../projects/local-ai/#image',label:'View the image tools'}
      }),
    project('one-neuron-over','One Neuron Over',['Model Lab',-11,83],
      {x:-19.8,z:72.3,heading:Math.atan2(-28,23)}, {
        summary:'Experiments with individual language-model neurons.',
        detail:'Find neurons tied to a concept, adjust their contribution, and compare the responses.',
        link:{href:'../lab/',label:'View One Neuron Over'}
      }),
    project('edvise','Edvise',['Course Planning Center',-31.5,-27.5],
      {x:-38,z:-9,heading:Math.atan2(-34,-16)}, {
        summary:'A course planner for students.',
        detail:'Built with React, Node, Express, Firebase, Google Cloud and Jenkins.'
      }),
    project('neurips-privacy-challenge','NeurIPS Privacy Challenge',['Privacy Research Tower',11,88],
      {x:22.3,z:74,heading:Math.atan2(31,25)}, {
        summary:'I co-authored a paper for the 2024 LLM Privacy Challenge.',
        detail:'Our team placed seventh in the competition.',
        link:{href:'https://llm-pc.github.io/results',label:'See the competition results'}
      }),
    project('unnecessary-lore','Unnecessary Lore',['North Printworks',58,69],
      {x:54.3,z:86,heading:Math.atan2(51,11)}, {
        summary:'My blog posts, story drafts and media reviews.',
        link:{href:'../blog/',label:'Read Unnecessary Lore'}
      }),
    project('one-more-chapter','One More Chapter',['Reading Lounge',-12.35,57.6], {x:-12.35,y:26,z:47.4,heading:east}, {
      summary:'A password-protected reader for translated novels.',
      link:{href:'../reader/',label:'Visit the reader'}
    })
  ];

  function projectStopsFor(city) {
    if (!city?.skyway) return [];
    return projects.filter(project => !project.approach.y || city.skyMall?.deck?.y === project.approach.y)
      .map(project => ({id:project.stopId,title:project.title,...project.approach}));
  }

  const sites = [
    ...projects,
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

  return {byStopId,districtsFor,sites,projects,projectStopsFor};
});
