# Car Go Vroom

Static Three.js driving playground. Serve the repository with `python -m http.server 8000`, then open `http://localhost:8000/drive/`. No build step. Runtime Three.js r128 loads from jsDelivr; MIT-licensed CANNON 0.6.2 is bundled.

## Cars and maps

All four cars use the same 120 Hz rigid-body, four-wheel raycast suspension engine on all four maps. Comet is a 1,200 kg sports car (137 mph target), Rally is 1,350 kg with larger tires and better dirt performance (112 mph target), Pickup is 1,850 kg (96 mph target), and Hypercar is 1,450 kg with a 199 mph target. Engine force tapers toward those targets; drag and terrain mean actual speed is lower. The HUD and garage use mph; simulation units remain metres/seconds/kilograms.

The proving ground has a collision heightfield matching the hills, a solid launch ramp, solid square tree trunks and cone-marked perimeter. Lakeside, desert and alpine use rolling 2 m collision heightfields, with matching visual terrain and curved roads. Lakeside has shoreline rises, desert has broad dune crests, and alpine has the largest climbs and descending hairpins. Roads, paint and roadside detail follow the same triangle-height sampler as the collider. All maps retain suspension, inertia, tire traction, coasting, braking and lower off-road grip/speed. Their visual lake is decorative, not simulated water. Scenic trees, buildings and mountains remain decorative; they do not yet have individual object colliders. Boundaries are at the visible ground edges (160 m course, 250 m scenic maps).

Changing maps resets onto that route. Changing cars preserves location/orientation and stops the car safely. R resets position and momentum. World geometry, materials and procedural textures are disposed on rebuild. Small seeded 128px mipmapped textures add ground/asphalt/ramp detail without external texture downloads. Scenic maps now have distinctive grass/sand/gravel patterns, bump detail, striated rocks and mountains, bark grain, lake ripples and building windows. Up to 360 instanced roadside details add one draw call per scenic map. Scenic ground is collidable; trees, rocks, buildings and distant mountains remain decorative.

## Controls and jumping

WASD/arrows drive, Space brakes, 1–4 select cars, C cycles chase/wide/hood cameras, R resets. Touch controls retain steering, acceleration, reverse and brake. Blur/hiding the tab releases controls. Native selector and button keyboard behavior remains intact.

Drag the scene with the primary mouse button to orbit in chase/wide mode or look around in hood mode. The view smoothly returns after four seconds without mouse movement. Touch gestures are not intercepted by mouse look. Reset and camera changes clear the look offset.

In the air, up/down apply pitch torque and left/right apply roll torque. Previously, carrying throttle over the ramp immediately applied nose-down torque; this was not front-heavy mass placement. Air input now blends in after 150 ms over 350 ms, with a gentle capped damping torque to reduce accidental pitch/roll. It never snaps upright and deliberate full flips remain possible. Release throttle for a neutral jump. Reset recovers an overturned vehicle.

## Verification

Node.js 18+:

```sh
cd drive
npm ci
npm test
node --check js/main.js
node --check js/physics.js
```

The automated tests use the actual physics and Three.js source (DOM/renderer stubs for application integration). They cover every map/car combination, settling, acceleration/coasting/braking/reverse, jumping/landing, full air rotations and gentle stabilization, collision, 30/60/120 Hz consistency, mph, controls, map reset/switching, mouse/hood cameras and texture disposal. Browser visual appearance and real phone performance are not established by these tests.

Headless Chromium launch in the current environment fails before loading the page (`socket() failed: Operation not permitted`). Desktop WebGL and phone portrait/landscape smoke tests remain required before merging. Verify every car/map, driving/braking, jumping, camera drag/idle return, repeated switching and tab focus. `main` deploys through GitHub Pages; this draft feature branch does not deploy.


## Authored vehicle assets

Four genuine authored low-poly meshes from Kenney Car Kit 3.1 (CC0) replace the procedural bodies after loading: sedan-sports, hatchback-sports, truck-flat, and race-future. These are generic designs, not branded replicas or photorealistic cars. See [asset provenance and license](assets/vehicles/README.md). Four GLBs plus their shared palette total 768,439 bytes before compression; models load only on first selection and are cached. Wheels are detached, centered, scaled and driven by the actual suspension/steering/roll transforms. Physics axle positions match the normalized source wheel arches. Painted panels use garage colors and clear-coat shading, glazing has its own material response, and lamp faces are lit independently. Generic bounding-box lamp boxes have been removed: brake lights use authored red faces or small overlays fitted directly to real body panels. Old procedural cars remain playable fallbacks on download failure, with explicit HUD status. Reload to retry a failed download. A vendored Three r128 GLTFLoader is MIT-licensed.

The source palette's KHR_texture_transform explicitly selects UV set 0. Three r128 emits a harmless custom-UV warning for this redundant declaration; these meshes use the default UV set 0. The source assets remain unmodified.

## Horizon clipping repair

The old sky sphere had radius 490 at the world origin, while the camera's far plane is 600. At camera (0,5,200), looking toward the origin, the center sky depth is about 690, while off-axis parts remain inside the clip plane. This cuts a circular hole through the sky and exposes the black clear background. The sky now follows the camera every frame, so all vertices remain within 490 units. The map fog color also supplies a background safeguard. This confirmed geometric defect matches the reported intermittent black horizon ball, but screenshot identification remains unverified because Chromium cannot start here.

New automated coverage includes parsed shipped GLBs and hashes, finite geometry and centered wheels, Hypercar selection/HUD and all four-map physics, lazy model caching, late load completion and failure fallback, scenic detail/disposal, and sky clipping at distant camera positions. These are not WebGL screenshots or real-phone performance measurements. Before merging, visually check model proportions/wheel alignment, material appearance, every map edge and camera mode, touch controls in both phone orientations, repeated switching, and asset-load failure recovery.

## Curved terrain and motion stability

Scenic routes now rise and descend on real heightfields, including off-road ground. The existing loop shapes gain extra shoreline bends, dune sweepers and alpine S-bends. Road ribbons are subdivided across their width, use stable depth offsets, and follow the exact CANNON triangle sampler. Lake water stays level. Ground mesh topology matches the 2 m collider grid (125,000 triangles per scenic map); only the active map exists. This increases terrain work compared with the former single flat plane, so phone performance must still be checked.

The renderer now interpolates chassis, suspension, steering and wheel rotation between 120 Hz physics steps. Camera movement follows that smooth pose; hood view follows the chassis pitch on hills. Texture mipmaps now use up to 8x anisotropic filtering when supported, and the camera near plane is 0.3 m for better depth precision. These address concrete causes of motion stutter and grazing-angle depth/texture shimmer. The user's exact visual symptom has not been reproduced in a browser here.

New tests check scenic road elevation/bends, road vertex and triangle clearance against the collider, actual CANNON ray agreement, sustained uphill driving for all cars, complete low-speed scenic laps with suspension contact, interpolation/reset behavior, and fitted lamp/material geometry. Chromium still fails to start because the environment denies socket creation, including an escalated launch attempt. No screenshot or real-device FPS claim is made. Before merge, review lights and body appearance from all angles, drive full laps at low/high speeds, check road paint shimmer at speed, inspect crests in hood/chase view, and test touch controls and repeated map/car swaps on a phone. This draft does not deploy.
