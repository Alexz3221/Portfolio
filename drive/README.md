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

## Physics proving ground (phase one)

The default route now uses bundled MIT-licensed CANNON 0.6.2 rigid-body physics, a 1,200 kg Comet chassis and four raycast spring/damper wheels. The new course has a matching rendered/collision heightfield, two hills, a tilted launch ramp straight ahead of spawn, solid square tree trunks, and a cone-marked boundary. Gravity and collisions control the chassis orientation and landing; it is not snapped to the ground. The original three routes retain their original arcade handling and car selection, explicitly labeled in the menu. No other site pages change.

- Accelerate/brake normally on the ground. Acceleration tapers with speed; air drag and mild rolling resistance allow coasting. Reverse first brakes forward motion.
- In the air, up/down apply pitch torque and left/right apply roll torque. Release the accelerator after takeoff for a neutral jump, or hold it to rotate. The square button is a brake, not an air reset.
- R / Reset on runway recovers an overturned vehicle. Map changes discard the previous physics world.
- The course intentionally uses one existing stylized car. A licensed car model and physics conversions for the other maps are not part of phase one.
- Collisions use a box chassis and square trunks, not detailed mesh bodywork. Tree foliage is decorative. Raycast wheels are an approximation, not a full tire model. The fixed 120 Hz physics step caps catch-up at 100 ms, so heavily throttled devices may slow down instead of simulating a long backlog.

Additional tests exercise actual physics for spring settling, acceleration/coasting/braking/reverse, takeoff and landing, air rotation, tree impacts, frame-rate consistency, and application integration. Browser/physical-phone driving feel still needs manual review before merge. Headless Chromium could not start in the current execution environment (`socket() failed: Operation not permitted`), so no WebGL screenshots or real-device validation are claimed.
