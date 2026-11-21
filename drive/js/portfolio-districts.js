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
    education: {id:'boulder-campus',title:'Boulder Campus',stopId:'education'},
    skills: {id:'workshop-quarter',title:'Workshop Quarter',stopId:'skills'},
    contact: {id:'south-street',title:'South Street',stopId:'contact'}
  };

  function districtsFor(city) {
    return (city?.stops || []).flatMap(({id,x,z,color}) => {
      const district = byStopId[id];
      return district ? [{...district,x,z,color}] : [];
    });
  }

  const east = Math.PI / 2;
  function site(sectionId,id,title,[name,buildingX,buildingZ],{x,y=0,z,heading},content) {
    const prefix = sectionId === 'projects' ? 'project' : sectionId;
    return {id,title,sectionId,districtId:byStopId[sectionId].id,stopId:`${prefix}-${id}`,
      building:{name,x:buildingX,y,z:buildingZ},approach:{x,y,z,heading,interactionRadius:y > 0 ? 8 : 12},...content};
  }
  const project = (...args) => site('projects',...args);
  const role = (...args) => site('experience',...args);

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

  const experience = [
    role('spectrum','Spectrum',['Broadcast & Model Lab',133.3,-30.4], {x:115.5,z:-34,heading:0}, {
      position:'DevOps co-op',dates:'August 2026–present',
      summary:'I work on video engineering and packaging workflows. I also work with small language models.'
    }),
    role('rtx-raytheon','RTX / Raytheon',['Systems Depot',139,19], {x:116,z:19,heading:0}, {
      position:'Software engineering co-op',dates:'August 2026–May 2027',
      summary:'I work on systems software.'
    }),
    role('google','Google',['Event Systems / Evaluation',83,15], {x:84.5,z:-9,heading:east}, {
      position:'Software engineering intern',dates:'Summer 2026',
      summary:'I worked on an event-driven backend for evaluating policy impact.'
    }),
    role('coorstek','CoorsTek',['Materials Foundry',130,-60], {x:115,z:-61,heading:0}, {
      position:'Computational materials intern',dates:'Summer 2026',
      summary:'I used Databricks and Spark to predict heat-treatment outcomes.'
    }),
    role('rocket-software','Rocket Software',['Dataset Archives',129,1.2], {x:115.5,z:1,heading:0}, {
      position:'Software engineering intern',dates:'Summer 2025',
      summary:'I wrote Python pipelines for LLM datasets.'
    }),
    role('cu-boulder','CU Boulder',['Learning Exchange',154.5,45], {x:139,z:45,heading:east}, {
      position:'Course Assistant'
    })
  ];
  function degree(id,title,building,approach,dates) {
    return site('education',id,title,building,approach,{organization:'University of Colorado Boulder',dates});
  }
  const education = [
    degree('bs-computer-science','B.S. Computer Science',['Computing Hall',-86,36],
      {x:-104.5,z:37,heading:east},'May 2026'),
    degree('ba-mathematics','B.A. Mathematics',['Mathematics Hall',-130.8,25.2],
      {x:-111.4,z:23.8,heading:-east},'May 2026'),
    degree('ms-computer-science','M.S. Computer Science',['Graduate Research Tower',-86.5,59.8],
      {x:-104.5,z:60,heading:east},'Expected May 2028')
  ];
  const sites = [...projects,...experience,...education];

  function siteStopsFor(city, entries = sites) {
    if (!city?.skyway) return [];
    return entries.filter(site => !site.approach.y || city.skyMall?.deck?.y === site.approach.y)
      .map(site => ({id:site.stopId,title:site.title,...site.approach}));
  }

  const projectStopsFor = city => siteStopsFor(city,projects);

  return {byStopId,districtsFor,sites,projects,experience,education,projectStopsFor,siteStopsFor};
});
