(function(root) {
  'use strict';

  const north=Math.PI, west=-Math.PI/2, east=Math.PI/2;
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
      mount:{x:-119.53,y:10.76,z:28.5}}
  ];

  if (typeof module==='object' && module.exports) module.exports=placements;
  else root.DrivePortfolioCorporateAdPlacements=placements;
})(globalThis);
