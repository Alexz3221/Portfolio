(function(root, factory) {
  const layout = factory();
  if (typeof module === 'object' && module.exports) module.exports = layout;
  else root.DrivePortfolioNeighborhoods = layout;
})(globalThis, function() {
  'use strict';

  const regions = [
    {stop:'about', color:'#dc9989', label:[-12,-120],
      border:[[-31,-138],[25,-138],[38,-104],[44,-85],[43,-49],[29,-38],[-25,-38],[-31,-63]]},
    {stop:'contact', color:'#f48bbd', label:[90,-128],
      border:[[36,-121],[55,-149],[104,-142],[131,-111],[126,-78],[75,-71],[45,-81]]},
    {stop:'education', color:'#d3a2f3', label:[-105,-46],
      border:[[-145,-74],[-104,-79],[-56,-53],[-53,10],[-58,42],[-85,60],[-142,55]]},
    {stop:'experience', color:'#f5ba79', label:[123,-47],
      border:[[90,-62],[149,-76],[157,-40],[154,65],[113,73],[83,61],[68,18],[71,-26]]},
    {stop:'skills', color:'#b8d592', label:[-77,108],
      border:[[-122,66],[-79,61],[-46,57],[-34,95],[-32,133],[-69,134],[-108,111]]},
    {stop:'projects', color:'#80e4dd', label:[12,8],
      border:[[-42,-36],[34,-32],[62,-5],[65,31],[66,58],[79,89],[54,111],[-26,115],[-36,67],[-52,44],[-49,7]]}
  ];

  // Each court extends a ground-level sidewalk beside a street or building entrance.
  const forecourts = [
    {x:34,z:-90,w:14,d:10,tint:0xb99c92},
    {x:59.5,z:-94.3,w:15,d:12,tint:0xc696a7},
    {x:-96.2,z:24.5,w:14,d:19,tint:0xb59ebe},
    {x:123.8,z:57,w:16,d:12,tint:0xc4ad90},
    {x:-38.5,z:89.7,w:19,d:13,tint:0x9eae97},
    {x:-4,z:78,w:13,d:14,tint:0x97c2c0},
    {x:43,z:73,w:14,d:14,tint:0x92b6c5},
    {x:22,z:59,w:15,d:14,tint:0x9cb5b6}
  ];

  return {regions,forecourts};
});
