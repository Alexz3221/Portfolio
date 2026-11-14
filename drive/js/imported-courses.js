/* Optional downloaded course scenes and their playable time-trial centerlines. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DriveImportedCourses = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function routeFrom(controls, loop, width, step = 3) {
    const route = [];
    const segments = controls.length - (loop ? 0 : 1);
    for (let index = 0; index < segments; index++) {
      const a = controls[index], b = controls[(index + 1) % controls.length];
      const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / step));
      for (let part = 0; part < count; part++) {
        const t = part / count;
        route.push({x: a[0] + (b[0] - a[0]) * t,
          y: a[1] + (b[1] - a[1]) * t,
          z: a[2] + (b[2] - a[2]) * t, width});
      }
    }
    if (!loop) {
      const last = controls.at(-1);
      route.push({x:last[0], y:last[1], z:last[2], width});
    }
    for (let index = 0; index < route.length; index++) {
      const a = route[loop ? (index + route.length - 1) % route.length : Math.max(0, index - 1)];
      const b = route[loop ? (index + 1) % route.length : Math.min(route.length - 1, index + 1)];
      const distance = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      route[index].tx = (b.x - a.x) / distance;
      route[index].tz = (b.z - a.z) / distance;
    }
    return route;
  }

  // Full native Rainbow Road, from the checker through every road era and back.
  // These source controls were measured at 2.5x; enlarge the entire course
  // together so the route, collision and source checker stay aligned.
  // Two authored air gaps connect the Wii and DS roads, then N64 and SFC.
  const rainbowScale = 5;
  const rainbowExpansion = rainbowScale / 2.5;
  const rainbowPoint = point => ({x:point.x*rainbowExpansion,
    y:point.y*rainbowExpansion,z:point.z*rainbowExpansion});
  const rainbowTransfer = link => ({...link,from:rainbowPoint(link.from),
    to:rainbowPoint(link.to),radius:link.radius*rainbowExpansion,
    duration:link.duration*rainbowExpansion,arc:link.arc*rainbowExpansion});
  const rainbowControls = [
    [188,69,-26],[187.62,69.06,-34.33],[188.63,69.05,-39.13],
    [190.41,68.71,-43.31],[188.46,69.47,-47.69],[189.74,69.51,-52.24],
    [192.49,69.4,-55.53],[197.04,68.74,-55.9],[202.09,69.47,-59.24],
    [206.21,69.03,-56.81],[210.25,69.47,-54.47],[213.06,69.9,-51.49],
    [215.11,70.29,-47.77],[217.58,70.95,-46.31],[216.6,71.5,-40.37],
    [213.49,71.87,-35.31],[207.58,71.62,-33.04],[203.28,72.23,-30.44],
    [198.44,72.15,-32.2],[195.37,72.15,-35.98],[196.88,72.62,-41.19],
    [195.55,73.11,-46.57],[198.94,74.14,-50.23],[200.57,74.66,-52.7],
    [202.07,75.03,-54.14],[204.66,75.8,-55.48],[206.6,76.65,-58.44],
    [208,77.29,-60],[211.01,71.74,-63.52],[213.22,72.03,-66.06],
    [215.55,74.22,-67.19],[217.66,76.49,-66.87],
    [220.21,79.23,-68.19],[222.65,82,-68.05],[225.57,85.49,-69.53],
    [228.34,88.76,-69.48],[231.63,92.81,-70.18],[234.14,96.14,-71.31],
    [237.16,99.85,-70.71],[239.26,102.8,-71.11],[241.24,105.29,-69.49],
    [242.61,107.34,-68.78],[243.67,108.86,-66.62],[243.87,109.18,-64.44],
    [244.22,109.96,-61.98],[243.73,109.45,-59.83],[244.12,110.33,-57.7],
    [243.82,110.2,-55.68],[243.63,109.52,-58.14],[244.06,109.89,-60.31],
    [243.98,109.48,-62.95],[244.03,109.45,-65.17],[243.12,107.95,-67.11],
    [242.17,106.59,-68.62],[240.59,104.58,-70.58],[238.73,101.91,-70.54],
    [235.99,98.53,-71.44],[233.04,95.56,-73.32],[229.83,91.16,-72.05],
    [226.82,87.68,-72.11],[223.86,83.75,-70.6],[221.21,80.84,-70.7],
    [218.76,77.79,-69.36],[216.57,75.55,-69.67],[214.31,73.12,-69.27],
    [212.64,71.3,-68.27],[210.45,69.27,-68.84],[208.79,67.66,-67.99],
    [206.76,65.89,-68.79],[205.11,64.52,-68.1],[203.09,62.98,-68.35],
    [201.63,61.82,-69.42],[199.52,60.51,-69.11],[198.17,59.53,-70.32],
    [196.29,58.47,-70.96],[194.45,57.77,-70.81],[192.88,56.99,-72.36],
    [190.94,56.57,-72.32],[189.36,56.19,-74.09],[187.17,56.23,-74.24],
    [185.27,56.5,-76.42],[182.63,57.2,-76.89],[180.1,58.39,-79.69],
    [176.6,59.94,-80.75],[167.4,62.2,-86.8],[160,62.5,-89.3],
    [148,63,-97],[136,64,-105],[124,65,-113],
    [112,66,-121],[100,67,-129],[88.6,68.9,-138.5],
    [80.43,69.06,-143.7],[72.25,67.89,-145.12],[64.47,65.85,-144.28],
    [59.46,63.18,-136.16],[59.02,61.28,-126.28],[57.67,60.16,-119.81],
    [49.49,58.47,-113.79],[43.74,57.92,-116.63],[38.79,57.43,-120.42],
    [38.12,59.97,-133.34],[33.36,60.27,-140.39],[25.67,59.18,-146.5],
    [16.91,57.67,-144.35],[11.24,57.66,-140.46],[5.66,57.87,-135.84],
    [0.37,58.62,-131.1],[-5.72,58.88,-130.57],[-11.88,59.45,-130.78],
    [-20.11,60.7,-130.93],[-28.71,61.23,-139.9],[-40.27,64.29,-142.06],
    [-50.75,69.27,-150.79],[-59.06,74.23,-157.26],[-48.48,79.2,-167.12],
    [-36.08,86.61,-167.99],[-24.41,94.19,-165.13],[-21.48,97.63,-149.22],
    [-24.74,98.08,-136.51],[-30.15,96.94,-119.55],[-35.21,105.38,-106.43],
    [-38.82,111.75,-96.13],[-45.04,116.21,-78.8],[-47.12,115.53,-66.03],
    [-53.84,115.49,-54.34],[-54.57,115.51,-41.83],[-55,115.5,-36],
    [-79.6,49.2,20.9],[-82.09,46.98,20.96],[-83.64,45.5,24.29],
    [-85.83,43.39,26.86],[-86.35,43.61,30.86],[-87.53,42.99,33.35],
    [-89.09,42.57,36.15],[-91.44,42.07,38.91],[-94.5,41.35,41.29],
    [-97.25,39.83,41.76],[-99.67,38.4,41.54],[-101.71,37.59,41.58],
    [-104.56,36.97,41.36],[-107.01,36.61,40.53],[-111.07,38.08,40.37],
    [-112.61,37.78,38.11],[-113.57,37.47,35.39],[-113.89,37.1,32.34],
    [-113.39,36.72,29.07],[-111.45,35.53,27.26],[-109.22,34.4,26.13],
    [-108.57,35.43,22.5],[-105.71,34.76,20.95],[-102.88,34.02,20.16],
    [-100,33.24,19.9],[-97.78,31.8,21.42],[-94.81,31.29,20.97],
    [-92.16,30.59,21.05],[-91.29,29.01,24.05],[-88.36,27.77,25.8],
    [-83.64,26.07,28.64],[-80.25,26.18,27.29],[-77.81,27.14,25.29],
    [-69.54,27.76,28.67],[-63.6,28.3,30.85],[-54.2,29.27,34.3],
    [-47.9,31.38,37.4],[-42.29,32.42,39.82],[-33.34,35.36,44.54],
    [-24.45,38.39,50.88],[-28.01,36.99,45.1],[-35.75,38.71,36.7],
    [-41.55,40.58,30.1],[-46.15,42.28,24.89],[-47.43,42.59,23.27],
    [-39.18,43.34,24.82],[-30.83,44.91,25.25],[-21.67,46.93,26.61],
    [-12.34,49.81,28.85],[-1.45,53.18,27.29],[4.48,54.48,25.05],
    [12.98,57.64,20.13],[17.25,60.05,14.78],[22.49,62,9.21],
    [27.83,63.79,3.47],[27.09,64,-2.15],[27.03,64,-10.25],
    [30.56,64,-19.55],[39.72,64,-20.34],[64.41,64,32.8],
    [77.75,64,64.11],[86.16,64,67.3],[90.5,64,62.83],
    [96.42,64,58.2],[95.14,64,48.35],[84.45,64,24.34],
    [80.85,64,11.06],[87.9,64,5.61],[94.74,64,2.56],
    [102.08,64,-5.43],[98.99,64,-19.56],[93,64,-26.98],
    [86.17,66.63,-43.19],[84.85,65.96,-47.2],[85.56,66.37,-50.93],
    [82.86,65.17,-53.31],[81.86,65.1,-56.42],[82.59,66.07,-59.97],
    [79.71,65.44,-62.41],[80,66.84,-65.98],[76.81,66.45,-67.73],
    [76,68.25,-71.07],[72.48,67.78,-71.25],[70.04,69.83,-73.51],
    [66.81,70.46,-73.38],[63.59,70.91,-72.8],[61.32,69.75,-70.77],
    [58.67,69.69,-69.3],[56.46,69.33,-67.28],[54.69,68.75,-64.76],
    [53.62,68.01,-61.92],[53.09,67.31,-59.22],[53.13,66.54,-56.25],
    [53.76,65.69,-53.48],[54.84,64.72,-50.85],[56.33,63.61,-48.61],
    [58.17,62.48,-46.63],[60.37,61.23,-45.09],[62.72,59.99,-43.42],
    [65.78,58.56,-44.37],[68.5,57.27,-44.4],[70.95,56.08,-42.01],
    [73.75,54.85,-41.91],[76.52,53.65,-39.55],[79.6,52.51,-41.5],
    [82.43,51.51,-41.35],[85.48,50.6,-41.24],[88.49,49.85,-39.02],
    [91.7,49.38,-38.94],[94.95,49.22,-41],[98.25,49.35,-40.94],
    [101.25,49.73,-38.78],[104.3,50.47,-38.75],[107.25,51.62,-38.73],
    [109.99,53.02,-38.72],[112.26,54.34,-38.71],[114.65,55.73,-40.83],
    [116.54,56.59,-38.7],[119.1,57.22,-40.83],[122.4,57.52,-40.83],
    [132.78,57.57,-40.83],[137.4,57.6,-36.6],[160,69,-41],
    [170,69,-31],[168,69,-21],[135,69,-21],
    [133,69,0],[135,69,8],[180,69,8],
    [188,69,2]
  ];
  // One full lap of the model's painted road. The lower west-to-east road
  // launches across a gap over the central underpass, and the other crossing
  // follows the continuous upper bridge.
  // The first point is the middle of the source model's checkerboard stripe.
  const raceGameControls = [
    [55,.87,-19.4],[55,.87,-12],[55,.87,0],[55,.87,10],
    [52,.87,16],[45,.87,20],[20,.87,20],[15,.87,20],
    [12.5,.92,20],[10,1.36,20],[7.5,2.28,20],[5,3.64,20],
    [2.5,5.47,20],[-2.5,7.5,20],[-7.5,7.5,20],[-12.5,4.8,20],
    [-15,3.14,20],[-17.5,1.93,20],[-20,1.17,20],[-22.5,.88,20],
    [-25,.87,20],[-40,.87,20],[-43,.87,20],[-45,1.06,20],
    [-45,.87,23],[-47,.87,30],[-47,.87,35],
    [-42,.87,42],[-32,.79,44],[-20,.87,44],[-10,.87,40],
    [-5,.87,34],[-5,.87,20],[-5,.82,10],[-5,.83,0],
    [-5,.88,-10],[-5,.87,-20],[-3,.87,-25],[2,.87,-27],
    [10,.87,-26],[20,.87,-26],[28,.92,-26],[35,.94,-22],
    [38,.94,-16],[38,.94,-10],[34,.94,-5],[30,.94,-4],
    [25,.87,-4],[20,1.31,-4],[15,3.04,-4],[10,5.15,-4],
    [5,6.68,-4],[0,6.91,-4],[-10,6.91,-4],[-15,6.9,-4],
    [-20,6.01,-4],[-25,4.05,-4],[-30,2.02,-4],[-35,.89,-4],
    [-40,.87,-4],[-48,.87,-10],[-50,.87,-25],[-50,.88,-35],
    [-45,.88,-42],[-35,.87,-45],[-15,.87,-45],[10,.87,-45],
    [30,.87,-45],[43,.87,-43],[51,.88,-38],[55,.87,-31],
    [55,.87,-27]
  ];
  // The model's checker faces the long northern straight. Reverse the
  // measured full-lap controls while keeping that checker as sample zero.
  const raceGameRoute = routeFrom(
    [raceGameControls[0],...raceGameControls.slice(1).reverse()], true, 8, 2.5);
  for (const point of raceGameRoute) {
    // The model has no deck between these ramp lips. Leave the crossing open
    // in the loading collision proxy so a car must actually jump the gap.
    if (point.z===20 && point.y>2 && point.x>=-12.5 && point.x<2.5) point.kind='gap';
    // The east landing is much wider than the measured centerline suggests:
    // the source asphalt spans z=18..30, while the route is centered at z=20.
    // Keep its solid safety underlay inside that native surface so a long
    // airborne landing cannot pass through CANNON's thin road triangles.
    if (point.z===20 && point.x>=12.5 && point.x<=45) {
      point.proxyLeft=2;
      point.proxyRight=10;
    } else if (point.x>45 && point.x<=52 && point.z>=16 && point.z<20) {
      // The same surface fans outward around the southeast bend.
      point.proxyLeft=4;
      point.proxyRight=12;
    }
  }
  const bangkokScale = .052;

  const courses = {
    rainbowroad: {
      id:'rainbowroad', name:'Rainbow Road',
      caption:'Rainbow Road · full native course · all nine road sections',
      asset:'assets/courses/rainbow-road.glb', scale:rainbowScale,
      loop:true, width:4.6*rainbowExpansion,
      route:routeFrom(rainbowControls.map(point=>point.map(value=>value*rainbowExpansion)),
        true, 4.6*rainbowExpansion, 5*rainbowExpansion),
      // The checkerboard in the source model is the lap gate.
      spawn:{...rainbowPoint({x:188,y:68.96,z:-21}),heading:Math.PI},
      spawnBack:4*rainbowExpansion,
      // Native collision for every road era; the narrow underlay supports mesh seams.
      proxyRoad:true, proxyMesh:true, proxyOffset:-.15, proxyCap:.04, overlayRoad:false,
      edge:650*rainbowExpansion, floor:-50*rainbowExpansion,
      roadSearchWidth:12*rainbowExpansion,
      collisionPattern:/^mesh_mdl_(?:DSroad1|MK8road2|MK8road3|SFCroad1|N64road1|GBAroad1|GCNroad1|Wiiroad1|MK7road1|DSroad3ds)_/i,
      transfers:[
        {from:{x:-55,y:115.5,z:-36},to:{x:-79.6,y:49.2,z:20.9},radius:4,
          duration:2.8,arc:12,takeoffHeading:-.1,landingHeading:-.75,landingSpeed:12},
        {from:{x:137.4,y:57.6,z:-36.6},to:{x:160,y:69,z:-41},radius:4,
          duration:1.4,arc:6,takeoffHeading:.8,landingHeading:.78,landingSpeed:12}
      ].map(rainbowTransfer),
      guidedSections:[{fromIndex:35,toIndex:92,radius:4*rainbowExpansion,
        speed:14,landingSpeed:12}],
      ground:0x0d1230, skyLow:0x18265d, skyHigh:0x020415, fog:0x101536,
      ghostSpeed:20
    },
    racegame: {
      id:'racegame', name:'Race Game Circuit',
      caption:'Race Game Circuit · full native lap · jump near 30 mph · bridge and underpass',
      asset:'assets/courses/race-game-environment.glb', loop:true, width:8,
      route:raceGameRoute,
      spawn:{x:55,y:.87,z:-12,heading:Math.PI}, spawnBack:7.4,
      routeHeightWeight:1.2,
      // The visual model is partitioned into 15 arbitrary mesh chunks. Keep
      // all native road, bridge and terrain tops plus nearby curb/obstacle
      // sides as collision; Object_20 is the nonphysical background plane.
      collisionPattern:/^Object_(?:[4-9]|1[0-8])$/,
      collisionFilter:'racegame', maxCollisionTriangles:230000,
      proxyRoad:true, proxyOffset:-.15,
      edge:240, floor:-6, groundVisualOffset:-.5, roadSearchWidth:20,
      ground:0x54883b, skyLow:0x9ec5dd, skyHigh:0x6b9fc4, fog:0x99b9ce,
      ghostSpeed:23,
      ghostSpeedZones:[{from:{x:-25,y:.87,z:20},to:{x:20,y:.87,z:20},speed:12.5}]
    },
    bangkok: {
      id:'bangkok', name:'Bangkok Rush',
      caption:'Bangkok Rush · native city loop from the Mario Kart arch',
      asset:'assets/courses/bangkok-rush.glb', scale:bangkokScale, loop:true, width:13.6,
      // The source arch/checker crosses Object_61 near raw (-100,500,0).
      // Follow the connected gray road east around the block's south bend,
      // then return on the outer west street and climb back under the arch.
      // Source coordinates are scaled together with the full model; the
      // southeast boulevard and other branches stay driveable off route.
      route:routeFrom([
        [-100,500,0],[200,500,0],[500,500,0],[800,500,-50],
        [950,500,-200],[1000,500,-500],[1000,500,-800],
        [1000,500,-1100],[980,500,-1250],[800,500,-1400],
        [600,500,-1500],[400,500,-1600],[200,500,-1700],
        [0,500,-1800],[-200,500,-1900],[-300,500,-2000],
        [-500,500,-1900],[-600,500,-1800],[-800,491,-1700],
        [-1000,466,-1600],[-1200,436,-1500],[-1300,418,-1400],
        [-1450,402,-1300],[-1500,400,-1200],[-1600,400,-1000],
        [-1600,400,-800],[-1600,400,-500],[-1570,400,-200],
        [-1500,400,0],[-1300,400,0],[-1200,401,0],
        [-1000,413,0],[-800,437,0],[-600,464,0],[-400,490,0]
      ].map(point=>point.map(value=>value*bangkokScale)), true, 13.6, 3),
      spawn:{x:-300*bangkokScale,y:495*bangkokScale,z:0,heading:Math.PI/2},
      spawnBack:10.4,
      // The source splits its road and ground among several mesh objects.
      // Include the whole surfaces so the untimed city branches are driveable.
      collisionPattern:/^Object_(?:33|37|45|61|62|63|64)$/i,
      collisionFilter:'bangkok', maxCollisionTriangles:30000,
      proxyRoad:true, proxyOffset:-.5, overlayRoad:false,
      edge:1120, floor:-100, roadSearchWidth:90,
      ground:0x355d42, skyLow:0xcad6c7, skyHigh:0x85a6a2, fog:0x9ab3a6,
      ghostSpeed:23
    }
  };

  function makeGhostTrace(course, car) {
    const route = course.route, positions = course.loop ? [...route, route[0]] : route;
    const lengths = [0];
    for (let index = 1; index < positions.length; index++) lengths.push(lengths.at(-1) +
      Math.hypot(positions[index].x - positions[index - 1].x,
        positions[index].y - positions[index - 1].y,
        positions[index].z - positions[index - 1].z));
    // Imported ghosts use car-specific tuned paces along the same safe path.
    // Authored stunt sections may need a lower absolute speed to land on the
    // source mesh, even when the rest of a lap can be driven much faster.
    const carPace = {comet:1,rally:.95,pickup:.9,hypercar:1.12,u9xtreme:1.25};
    const speed = course.ghostSpeed * (carPace[car] || 1), dt = 1 / 30;
    const nearestIndex = point => {
      let best = Infinity, at = 0;
      for(let index = 0; index < route.length; index++) {
        const sample = route[index];
        const distance = Math.hypot(sample.x-point.x,sample.y-point.y,sample.z-point.z);
        if(distance < best) {best = distance; at = index;}
      }
      return at;
    };
    const slowZones = (course.ghostSpeedZones || []).map(zone => ({
      from:nearestIndex(zone.from),to:nearestIndex(zone.to),speed:zone.speed
    })).concat((course.guidedSections || []).map(section => ({
      from:section.fromIndex,to:section.toIndex,speed:section.speed
    })));
    const flights = (course.transfers || []).map(link => ({
      from:nearestIndex(link.from),to:nearestIndex(link.to),arc:link.arc||0
    }));
    const times = [0];
    for(let index = 0; index < positions.length - 1; index++) {
      const cap = slowZones.filter(zone => index >= zone.from && index < zone.to)
        .reduce((minimum,zone) => Math.min(minimum,zone.speed),speed);
      times.push(times.at(-1) + (lengths[index+1]-lengths[index]) / cap);
    }
    const lapTime = times.at(-1), frameCount = Math.ceil(lapTime / dt) + 1;
    const frames = [];
    let segment = 0;
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const elapsed = Math.min(lapTime, frameIndex * dt);
      while (segment < times.length - 2 && times[segment + 1] < elapsed) segment++;
      const a = positions[segment], b = positions[segment + 1];
      const fraction = Math.max(0, Math.min(1, (elapsed - times[segment]) /
        (times[segment + 1] - times[segment] || 1)));
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      const horizontal = Math.hypot(b.x - a.x,b.z - a.z);
      const flight = flights.find(link => segment>=link.from&&segment<link.to);
      const pitch = flight ? 0 : -Math.atan2(b.y - a.y,horizontal);
      const flightFraction = flight ? Math.max(0,Math.min(1,
        (elapsed-times[flight.from])/(times[flight.to]-times[flight.from]||1))) : 0;
      const flightArc = flight ? Math.sin(Math.PI*flightFraction)*flight.arc : 0;
      const sy=Math.sin(yaw/2),cy=Math.cos(yaw/2);
      const sp=Math.sin(pitch/2),cp=Math.cos(pitch/2);
      const progress = segment + fraction;
      frames.push([
        a.x + (b.x - a.x) * fraction, a.y + (b.y - a.y) * fraction + flightArc + 1.0,
        a.z + (b.z - a.z) * fraction,
        cy*sp, sy*cp, -sy*sp, cy*cp,
        Math.min(route.length, progress)
      ]);
    }
    frames.at(-1)[7] = route.length;
    return {car, dt, lapTime, duration:(frames.length - 1) * dt,
      routeLength:route.length, frames};
  }
  for (const course of Object.values(courses)) {
    course.ghostTraces = Object.fromEntries(['comet','rally','pickup','hypercar','u9xtreme']
      .map(car => [car, makeGhostTrace(course, car)]));
  }

  const sceneCache = new Map();
  function deduplicateBangkok(scene) {
    scene.updateMatrixWorld(true);
    const buckets = new Map();
    const sameArray = (a,b) => a === b || a.length === b.length && a.every((value,index) => value === b[index]);
    scene.traverse(object => {
      if (!object.isMesh) return;
      const positions = object.geometry.attributes.position?.array;
      const indices = object.geometry.index?.array;
      if (!positions || !indices) return;
      const sample = array => [array[0],array[Math.floor(array.length/3)],
        array[Math.floor(array.length*2/3)],array[array.length-1]].join(',');
      const key = [positions.length,indices.length,sample(positions),sample(indices),
        object.material?.uuid,object.matrixWorld.elements.map(n => n.toFixed(5)).join(',')].join(':');
      const bucket = buckets.get(key) || [];
      const duplicate = bucket.some(other => sameArray(positions,other.geometry.attributes.position.array) &&
        sameArray(indices,other.geometry.index.array));
      if (duplicate) object.visible = false;
      else { bucket.push(object); buckets.set(key,bucket); }
    });
  }
  function extractCollision(scene, course) {
    const pattern = course.collisionPattern;
    if (!pattern) return [];
    scene.updateMatrixWorld(true);
    const meshes = [];
    const distanceToRoute = (x,z) => {
      let nearest = Infinity;
      for(let index=0;index<course.route.length-1;index++) {
        const a=course.route[index],b=course.route[index+1];
        const dx=b.x-a.x,dz=b.z-a.z;
        const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
        nearest=Math.min(nearest,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));
      }
      return nearest;
    };
    scene.traverse(object => {
      if (!object.isMesh || !object.visible || !pattern.test(object.name)) return;
      const positions = object.geometry.attributes.position;
      const vertices = [], point = new THREE.Vector3();
      for (let index = 0; index < positions.count; index++) {
        point.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
        vertices.push(point.x, point.y, point.z);
      }
      let indices = object.geometry.index ? Array.from(object.geometry.index.array)
        : Array.from({length:positions.count}, (_, index) => index);
      if(course.collisionFilter==='racegame') {
        const filtered=[];
        for(let index=0;index<indices.length;index+=3) {
          const ia=indices[index]*3,ib=indices[index+1]*3,ic=indices[index+2]*3;
          const ax=vertices[ia],ay=vertices[ia+1],az=vertices[ia+2];
          const bx=vertices[ib],by=vertices[ib+1],bz=vertices[ib+2];
          const cx=vertices[ic],cy=vertices[ic+1],cz=vertices[ic+2];
          const y=(ay+by+cy)/3;
          const abx=bx-ax,aby=by-ay,abz=bz-az;
          const acx=cx-ax,acy=cy-ay,acz=cz-az;
          const nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;
          const up=ny/(Math.hypot(nx,ny,nz)||1);
          // Some broad painted road and ramp faces are wound downward even
          // though the visible material is double-sided. Flip their winding
          // so CANNON raycast tires can use them from above. Tiny downward
          // decorative triangles are excluded to keep collision light.
          const flippedRoad=up<-.3&&y>-4.5&&y<12&&Math.abs(ny)*.5>.1;
          const surface=y>-4.5&&y<12&&up>.3;
          const solidSide=y>-.5&&y<8&&Math.abs(up)<=.5;
          if(!surface&&!flippedRoad&&!(solidSide&&
              distanceToRoute((ax+bx+cx)/3,(az+bz+cz)/3)<7))continue;
          filtered.push(indices[index],
            flippedRoad?indices[index+2]:indices[index+1],
            flippedRoad?indices[index+1]:indices[index+2]);
        }
        indices=filtered;
      }
      if(course.collisionFilter==='bangkok') {
        // Several native asphalt tops have downward winding despite their
        // double-sided visual material. Wheel rays need upward faces.
        for(let index=0;index<indices.length;index+=3) {
          const ia=indices[index]*3,ib=indices[index+1]*3,ic=indices[index+2]*3;
          const ax=vertices[ia],ay=vertices[ia+1],az=vertices[ia+2];
          const bx=vertices[ib],by=vertices[ib+1],bz=vertices[ib+2];
          const cx=vertices[ic],cy=vertices[ic+1],cz=vertices[ic+2];
          const ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az);
          const nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay);
          const nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
          if(ny < 0 && -ny / (Math.hypot(nx,ny,nz)||1) > .35)
            [indices[index+1],indices[index+2]]=[indices[index+2],indices[index+1]];
        }
      }
      if(indices.length)meshes.push({vertices, indices});
    });
    return meshes;
  }
  function rainbowStripePatch(course) {
    const start = course.route[0], half = course.width / 2;
    const expansion=course.scale/2.5;
    const y = start.y - .12, zMin = start.z - 1.1*expansion,
      zMax = start.z + .9*expansion;
    return {vertices:[
      start.x-half,y,zMin, start.x-half,y,zMax,
      start.x+half,y,zMax, start.x+half,y,zMin
    ],indices:[0,1,2,0,2,3]};
  }
  function load(id) {
    const course = courses[id];
    if (!course) return Promise.reject(new Error('Unknown course: ' + id));
    if (sceneCache.has(id)) return sceneCache.get(id);
    const loading = new Promise((resolve, reject) => {
      if (!globalThis.THREE?.GLTFLoader) { reject(new Error('GLTFLoader is unavailable')); return; }
      new THREE.GLTFLoader().load(course.asset, gltf => {
        const scene = gltf.scene;
        scene.name = id + '-course-asset';
        scene.scale.setScalar(course.scale || 1);
        scene.traverse(object => {
          if (!object.isMesh) return;
          object.castShadow = false;
          object.receiveShadow = true;
          if(id==='rainbowroad' && object.name==='mesh_mdl_MKlogo1_mdl_MKlogo1_0'){
            // The source logo has two sides, but the side facing our full-lap
            // direction has reversed U coordinates. Correct that quad only.
            const uv=object.geometry.attributes.uv;
            if(uv?.count>=8){
              for(let index=4;index<8;index++)uv.setX(index,1-uv.getX(index));
              uv.needsUpdate=true;
            }
          }
        });
        if (id === 'bangkok') deduplicateBangkok(scene);
        const collisionMeshes = extractCollision(scene, course);
        if (id === 'rainbowroad') collisionMeshes.push(rainbowStripePatch(course));
        resolve({scene, collisionMeshes});
      }, undefined, reject);
    }).catch(error => { sceneCache.delete(id); throw error; });
    sceneCache.set(id, loading);
    return loading;
  }
  return {getCourse:id => courses[id] || null, load, routeFrom, makeGhostTrace};
});
