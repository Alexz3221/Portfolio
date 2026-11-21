(function(root) {
  'use strict';

  const north=Math.PI, west=-Math.PI/2;
  const placements=[
    // A large plate marks the end of the narrow arrival canyon.
    {id:'sky-arrival-lumen',campaign:'lumen',x:0,y:36.6,z:-35.35,width:48.5,height:20,heading:north,artShare:.43,sky:true},
    // The paired plates frame the towers behind Projects and leave its sign centered.
    {id:'sky-projects-halo',campaign:'halo',x:25,y:37.2,z:71.5,width:43,height:18,heading:north,artShare:.44,sky:true},
    {id:'sky-projects-aureole',campaign:'aureole',x:-23,y:34.8,z:72,width:39.5,height:14.4,heading:north,artShare:.42,sky:true},
    // Distant placements serve the north and east ring approaches.
    {id:'sky-north-relay',campaign:'relay',x:135,y:46,z:-106,width:50,height:18,heading:west,artShare:.38,sky:true},
    {id:'sky-service-shiftwell',campaign:'shiftwell',x:112,y:44,z:-8,width:53,height:17,heading:north,artShare:.43,sky:true},
    // The west ring and Night Market entrance each get a different scale.
    {id:'sky-west-meridian',campaign:'meridian',x:-110,y:42.7,z:13,width:51,height:16.7,heading:north,artShare:.39,sky:true},
    {id:'sky-market-hush',campaign:'hush',x:-39.4,y:40,z:-18.5,width:54,height:18,heading:west,artShare:.41,sky:true},
    // The southern horizon is visible from both Campus approaches.
    {id:'sky-campus-pact',campaign:'pact',x:-88,y:60,z:146,width:62,height:20,heading:north,artShare:.45,sky:true},
    {id:'sky-south-hearth',campaign:'hearth',x:132,y:46.8,z:103,width:54,height:19.5,heading:west,artShare:.42,sky:true},
    {id:'sky-arrival-zenith',campaign:'zenith',x:0,y:60,z:-135,width:66,height:20,heading:0,artShare:.42,sky:true},
    // Tilted sheets face down into the open plaza and the upper arrival canyon.
    {id:'sky-plaza-overhead',campaign:'threshold',x:0,y:47,z:-1,width:68,height:29,heading:north,tilt:1.24,artShare:.40,sky:true},
    {id:'sky-approach-overhead',campaign:'tideline',x:-3.2,y:52,z:-78,width:32,height:22,heading:north,tilt:1.20,artShare:.40,sky:true}
  ];

  if (typeof module==='object' && module.exports) module.exports=placements;
  else root.DrivePortfolioSkyCampaignPlacements=placements;
})(globalThis);
