(function(root) {
  'use strict';

  const north=Math.PI, west=-Math.PI/2, east=Math.PI/2;
  const northwest=Math.atan2(-51,-11);
  const placements=[
    // Arrival: suspended over the exit toward the concourse.
    {id:'farline',x:0,y:12.45,z:-50.3,width:15.2,height:5.6,heading:north,artShare:.45,
      mount:{x:-10.42,y:4.63,z:-54.44,heading:east}},
    // Projects: high enough to see over the west forecourt's shop awnings.
    {id:'relay',x:-26.96,y:10.24,z:35.80,width:9.5,height:3.65,heading:east,
      mount:{x:-28.53,y:7.38,z:35.80}},
    // North ring: the equipment bay projects across the Interests road.
    {id:'morrow',x:84.8,y:15.1,z:-108,width:22.25,height:7,heading:west,artShare:.45,
      mount:{x:87,y:8.98,z:-95.37,heading:north}},
    // Skyway: the western approach to the Morrow portal, above the opening.
    {id:'sublight',x:25.00,y:27.45,z:-27.5,width:9.7,height:3.7,heading:west,
      mount:{x:27.33,y:25.77,z:-27.5}},
    // Campus: across the lower ring road, mounted to the Library podium.
    {id:'ion',x:-63.8,y:12.3,z:70.65,width:10.6,height:4.06,heading:0,
      mount:{x:-63.86,y:9.17,z:70.14}},
    // Service district: the west wall of the relay tower near the Skyway ramp.
    {id:'oxide',x:123.12,y:9.25,z:-31.4,width:11.75,height:4.46,heading:west,
      mount:{x:123.74,y:6.41,z:-31.46}},
    // North Market: suspended over the street and the lower Skyway span.
    {id:'afterimage',x:-73.65,y:18.7,z:-20,width:20.8,height:7.4,heading:west,artShare:.45,
      mount:{x:-65.85,y:4.17,z:-7.20,heading:north}},
    // Zenith records vault's first tall setback, clear of the lower catwalk.
    {id:'zenith',x:8.78,y:23.22,z:-103.05,width:10.4,height:3.91,heading:west,
      mount:{x:9.102,y:19.55,z:-103.05}},
    // Education: over the reading room and on the approach to Switchyard Park.
    {id:'meridian',x:-117.77,y:13.65,z:28.5,width:9.65,height:3.74,heading:east,
      mount:{x:-119.53,y:10.76,z:28.5}},

    // The older arrival towers hold vertical theater and delivery panels.
    {id:'hush',x:-7.67,y:11.32,z:-85.75,width:3.75,height:6.6,heading:east,
      mount:{x:-8.12,y:4.07,z:-86.85}},
    {id:'hearth',x:8.65,y:6.0,z:-58.5,width:4.1,height:6.1,heading:west,
      mount:{x:10.58,y:3.22,z:-58.5}},
    // The east ring opens into the test bay and service forecourt.
    {id:'lumen',x:112,y:13.85,z:-68.1,width:20.5,height:7.4,heading:north,artShare:.45},
    {id:'shiftwell',x:122.25,y:9.75,z:-58.8,width:4.2,height:6.4,heading:west,
      mount:{x:122.34,y:6.01,z:-59.06}},
    {id:'vista',x:124.3,y:15.55,z:19.0,width:17.8,height:6.4,heading:west,artShare:.45},
    {id:'loop',x:126.9,y:7.25,z:62.8,width:4.2,height:6.2,heading:west},
    // Short displays ahead of the west ring and Switchyard Park.
    {id:'pact',x:-108,y:14.2,z:-69,width:20.4,height:6.7,heading:north,artShare:.45},
    {id:'accord',x:-118.5,y:7.45,z:-7.8,width:4.25,height:5.7,heading:east},
    {id:'tideline',x:-97.3,y:7.8,z:44.2,width:5.0,height:4.7,heading:west,
      mount:{x:-95.41,y:4.3,z:44.2}},
    // Projects forecourt, Campus approach and the open southeastern bend.
    {id:'halo',x:32.9,y:7.25,z:24.0,width:4.45,height:6.1,heading:west,
      mount:{x:33.47,y:3.65,z:24.0}},
    {id:'threshold',x:-33.4,y:11.4,z:64.95,width:6.9,height:6.0,heading:east,
      mount:{x:-34.61,y:8.51,z:65.26}},
    {id:'aureole',x:60.0,y:13.7,z:88.1,width:19.25,height:6.8,heading:northwest,artShare:.45}
  ];

  if (typeof module==='object' && module.exports) module.exports=placements;
  else root.DrivePortfolioCorporateAdPlacements=placements;
})(globalThis);
