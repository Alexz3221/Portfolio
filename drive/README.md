# Car Go Vroom

A static Three.js driving playground. Serve the repository with `python -m http.server 8000`, then open `http://localhost:8000/drive/`. No build step is needed. Runtime Three.js r128 is loaded from jsDelivr, as before.

## Cars and routes

- Comet: 220 km/h road cap, sport roof, hood accents and supported spoiler.
- Rally: 180 km/h road cap, roof lights, mud flaps and better off-road pace.
- Pickup: 155 km/h road cap, tailgate and ribbed cargo bed.
- All cars have mirrors, window pillars, grille slats, handles, exhausts, detailed rotating wheels, front-wheel steering and brighter brake lights.
- Lakeside loop retains the original twilight setting. Desert highway adds long straights, sand and cactus scenery. Alpine pass adds a winding route and a cool mountain palette. These are flat free-roam maps, not elevation/terrain simulations.

Choose a route from the selector. Switching routes stops the car and places it on the road; changing cars keeps position. Back to road / R resets the car. World geometry and materials are disposed when switching maps.

## Controls

WASD / arrows to drive, Space to brake, 1–3 for cars, C for chase/wide/hood cameras, R to reset. Touch controls include steering, forward, reverse and a square brake button. Losing focus or hiding the tab releases held controls. Arrow keys remain native when the route selector is focused.

The physics remain arcade-style: scenery is decorative, and there is no traffic or object collision simulation. Slow down for tight corners; the advertised caps apply on the road, with lower limits off-road and in reverse.

## Tests

Use Node.js 18+:

```sh
cd drive
npm ci
npm test
node --check js/main.js
```

The tests execute the actual application source against Three.js r128 with DOM and renderer stubs. They check map geometry/spawns, repeat switching and disposal, top speeds, braking/reverse/off-road behavior, car switching, touch release/reset, native keyboard behavior, and hood-camera tracking. They do not verify WebGL rendering or real-device touch behavior.

Before merging, run a browser smoke test on desktop and phone (portrait and landscape): load every map/car, drive and brake, cycle cameras, reset while driving, change maps repeatedly, and return after switching tabs. Check for console errors and overlapping controls. `main` deploys through GitHub Pages; feature branches do not publish through that workflow.
