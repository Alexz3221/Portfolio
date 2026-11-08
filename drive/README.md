# Car Go Vroom

Static Three.js driving playground. Serve the repository with `python -m http.server 8000`, then open `http://localhost:8000/drive/`. No build step. Runtime Three.js r128 loads from jsDelivr; MIT-licensed CANNON 0.6.2 is bundled.

## Cars and maps

All four cars use the same 120 Hz rigid-body, four-wheel raycast suspension engine on all four maps. Comet is a 1,200 kg sports car (137 mph target), Rally is 1,350 kg with larger tires and better dirt performance (112 mph target), Pickup is 1,850 kg (96 mph target), and Hypercar is 1,450 kg with a 199 mph target. Engine force tapers toward those targets; drag and terrain mean actual speed is lower. The HUD and garage use mph; simulation units remain metres/seconds/kilograms.

The proving ground has a collision heightfield matching the hills, a solid launch ramp, solid square tree trunks and cone-marked perimeter. Lakeside, desert and alpine retain their original flat routes and decorative scenery but now have suspension, inertia, tire traction, coasting, braking and lower off-road grip/speed. Their visual lake is decorative, not simulated water. Scenic trees, buildings and mountains remain decorative; this is not a full collision/terrain conversion. Boundaries are at the visible ground edges (160 m course, 250 m scenic maps).

Changing maps resets onto that route. Changing cars preserves location/orientation and stops the car safely. R resets position and momentum. World geometry, materials and procedural textures are disposed on rebuild. Small seeded 128px mipmapped textures add ground/asphalt/ramp detail without external texture downloads. Scenic maps now have distinctive grass/sand/gravel patterns, bump detail, striated rocks and mountains, bark grain, lake ripples and building windows. Up to 360 instanced roadside details add one draw call per scenic map. All scenery is still decorative, with flat scenic collision floors.

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

The 26 tests use the actual physics and Three.js source (DOM/renderer stubs for application integration). They cover every map/car combination, settling, acceleration/coasting/braking/reverse, jumping/landing, full air rotations and gentle stabilization, collision, 30/60/120 Hz consistency, mph, controls, map reset/switching, mouse/hood cameras and texture disposal. Browser visual appearance and real phone performance are not established by these tests.

Headless Chromium launch in the current environment fails before loading the page (`socket() failed: Operation not permitted`). Desktop WebGL and phone portrait/landscape smoke tests remain required before merging. Verify every car/map, driving/braking, jumping, camera drag/idle return, repeated switching and tab focus. `main` deploys through GitHub Pages; this draft feature branch does not deploy.


## Authored vehicle assets

Four genuine authored low-poly meshes from Kenney Car Kit 3.1 (CC0) replace the procedural bodies after loading: sedan-sports, hatchback-sports, truck-flat, and race-future. These are generic designs, not branded replicas or photorealistic cars. See [asset provenance and license](assets/vehicles/README.md). Four GLBs plus their shared palette total 768,439 bytes before compression; models load only on first selection and are cached. Wheels are detached, centered, scaled and driven by the actual suspension/steering/roll transforms. Physics axle positions match the normalized source wheel arches. Old procedural cars remain playable fallbacks on download failure, with explicit HUD status. Reload to retry a failed download. A vendored Three r128 GLTFLoader is MIT-licensed.

The source palette's KHR_texture_transform explicitly selects UV set 0. Three r128 emits a harmless custom-UV warning for this redundant declaration; these meshes use the default UV set 0. The source assets remain unmodified.

## Horizon clipping repair

The old sky sphere had radius 490 at the world origin, while the camera's far plane is 600. At camera (0,5,200), looking toward the origin, the center sky depth is about 690, while off-axis parts remain inside the clip plane. This cuts a circular hole through the sky and exposes the black clear background. The sky now follows the camera every frame, so all vertices remain within 490 units. The map fog color also supplies a background safeguard. This confirmed geometric defect matches the reported intermittent black horizon ball, but screenshot identification remains unverified because Chromium cannot start here.

New automated coverage includes parsed shipped GLBs and hashes, finite geometry and centered wheels, Hypercar selection/HUD and all four-map physics, lazy model caching, late load completion and failure fallback, scenic detail/disposal, and sky clipping at distant camera positions. These are not WebGL screenshots or real-phone performance measurements. Before merging, visually check model proportions/wheel alignment, material appearance, every map edge and camera mode, touch controls in both phone orientations, repeated switching, and asset-load failure recovery.
