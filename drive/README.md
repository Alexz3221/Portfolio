# Car Go Vroom

Static Three.js driving playground. Serve the repository with `python -m http.server 8000`, then open `http://localhost:8000/drive/`. No build step. Runtime Three.js r128 loads from jsDelivr; MIT-licensed CANNON 0.6.2 is bundled.

## Cars and maps

All four cars use the same 120 Hz rigid-body, four-wheel raycast suspension engine on all five selectable maps. Comet is a 1,200 kg sports car (141 mph target), Rally is 1,350 kg with better dirt performance (115 mph target), Pickup is 1,850 kg (99 mph target), and Hypercar is 1,450 kg with a 205 mph target. Engine force tapers toward those targets; drag and terrain mean actual speed is lower. The HUD and garage use mph; simulation units remain metres/seconds/kilograms.

The old proving-ground/ramp map is removed from the selector and scene builder. Its isolated physics fixture remains for jumping regression tests. Cliffside mountain is a 894 m winding closed ledge with 7 m asphalt, 0.5 m shoulders and a 71–129 m ascent/descent. The inside rises about 55 m and the outside drops about 60 m over six horizontal metres. Both cliffs are real collision terrain, not decorative meshes; the shelf extends slightly beyond the asphalt to accommodate the 2 m collider grid. Falling off requires resetting back to the road.

The racetrack is now about 1.56 km long (previously about 0.88 km), with an outer circuit and winding infield return, three rolling collision-heightfield crests (1.0, 1.6 and 2.8 m), and six alternating solid slalom blocks. The large crest produces real airtime at speed and remains drivable slowly. Kerbs and checkered start/finish are terrain-conforming, vertex-colored geometry with explicit depth offsets, batched into two draw calls rather than flat tiles that intersect hills. Blocks share dimensions between rendering and CANNON. Both maps retain 400 m ground with a 2 m grid (80,000 terrain triangles); only one map exists at a time. Reset returns to the start; there is no lap timer or checkpoint scoring.

The route itself is a closed driving loop. An inverted stunt loop is **not implemented**: the existing terrain heightfield cannot represent an overhanging surface, and dependable inverted driving needs a separately tested collider and tire-contact/air-control extension. There is no decorative loop pretending to be drivable.

Lakeside, desert and alpine retain their rolling 2 m collision heightfields and curved roads. Road surfaces follow the exact collision triangle sampler. Scenic trees, rocks, buildings, mountains and lakes remain decorative, not individual solid objects. Suspension, inertia, tire traction, coasting, braking and lower off-road grip/speed are retained. Boundaries are at the visible ground edges (200 m half-width on the new maps, 250 m scenic maps).

Changing maps resets onto that route. Changing cars preserves location/orientation and stops the car safely. R resets position and momentum. World geometry, materials and procedural textures are disposed on rebuild. Small seeded 128px mipmapped textures add ground/asphalt/ramp detail without external texture downloads. Scenic maps now have distinctive grass/sand/gravel patterns, bump detail, striated rocks and mountains, bark grain, lake ripples and building windows. Up to 360 instanced roadside details add one draw call per scenic map. Scenic ground is collidable; trees, rocks, buildings and distant mountains remain decorative.

## Controls and jumping

WASD/arrows drive, Space brakes, 1–4 select cars, C cycles chase/wide/hood cameras, R resets. Touch controls retain steering, acceleration, reverse and brake. Blur/hiding the tab releases controls. Native selector and button keyboard behavior remains intact.

Drag or swipe the scene to orbit in chase/wide mode or look around in hood mode. The view smoothly returns four seconds after releasing the look pointer. Other fingers can hold throttle, steering and brake simultaneously; releasing one input does not release a different finger or held keyboard key. Long-press selection and callouts are suppressed on the game canvas and touch controls, while normal page links and selectors remain accessible. Reset and camera changes clear the look offset.

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

The automated tests use the actual physics and Three.js source (DOM/renderer stubs for application integration). They cover every map/car combination, settling, acceleration/coasting/braking/reverse, jumping/landing, full air rotations and gentle stabilization, collision, 30/60/120 Hz consistency, mph, controls, map reset/switching, mouse/touch/hood cameras and texture disposal. Browser visual appearance and real phone performance are not established by these tests.

Headless Chromium launch in the current environment fails before loading the page (`socket() failed: Operation not permitted`). Desktop WebGL and phone portrait/landscape smoke tests remain required before merging. Verify every car/map, driving/braking, jumping, camera drag/idle return, repeated switching and tab focus. `main` deploys through GitHub Pages; this draft feature branch does not deploy.


## Approved passenger car assets

The four garage slots use real models from **Generic passenger car pack** by **Comrade1280**, under **CC BY 4.0**: Coupe (Comet), Hatchback (Rally), Pickup, and Sport (Hypercar). These replace the earlier Kenney bodies. See [visible credits](credits.html), [original license](assets/vehicles/passenger/LICENSE.txt) and [conversion provenance](assets/vehicles/passenger/SOURCE.md). The user supplied the official Sketchfab download; no substitute pack or viewer extraction was used.

Four self-contained GLBs total 3,621,764 bytes before HTTP compression, approximately 0.9 MB each. Only the selected model loads; later selections are cached. Each car has 6,022–6,918 triangles. Textures are capped at 1024 px and retain source body/wheel/optics detail. Authored red rear-lamp faces light up on braking, with no detached boxes. Glass is made opaque and dark because the source cars have sparse interiors. Separate wheels retain their original proportions, including the Sport's different front/rear tire radii; suspension connection points and render pivots use each wheel's measured center.

Old procedural cars remain playable fallbacks if an asset download fails, with explicit HUD status. Reload retries failed downloads. The source geometry and material mapping were visually inspected using a Blender CPU render. This is not a browser or real-phone performance measurement. Tests parse actual shipped GLBs, verify hashes/geometry/physical wheel alignment and confirm attribution. Three r128 GLTFLoader is vendored under MIT.

## Horizon clipping repair

The old sky sphere had radius 490 at the world origin, while the camera's far plane is 600. At camera (0,5,200), looking toward the origin, the center sky depth is about 690, while off-axis parts remain inside the clip plane. This cuts a circular hole through the sky and exposes the black clear background. The sky now follows the camera every frame, so all vertices remain within 490 units. The map fog color also supplies a background safeguard. This confirmed geometric defect matches the reported intermittent black horizon ball, but screenshot identification remains unverified because Chromium cannot start here.

Automated coverage includes parsed shipped GLBs and hashes, finite geometry and centered wheels, Hypercar selection/HUD and all four-map physics, lazy model caching, late load completion and failure fallback, scenic detail/disposal, and sky clipping at distant camera positions. These are not WebGL screenshots or real-phone performance measurements. Before merging, visually check model proportions/wheel alignment, material appearance, every map edge and camera mode, touch controls in both phone orientations, repeated switching, and asset-load failure recovery.

## Curved terrain and motion stability

Scenic routes now rise and descend on real heightfields, including off-road ground. The existing loop shapes gain extra shoreline bends, dune sweepers and alpine S-bends. Road ribbons are subdivided across their width, use stable depth offsets, and follow the exact CANNON triangle sampler. Lake water stays level. Ground mesh topology matches the 2 m collider grid (125,000 triangles per scenic map); only the active map exists. This increases terrain work compared with the former single flat plane, so phone performance must still be checked.

The renderer now interpolates chassis, suspension, steering and wheel rotation between 120 Hz physics steps. Camera movement follows that smooth pose; hood view follows the chassis pitch on hills. Texture mipmaps now use up to 8x anisotropic filtering when supported, and the camera near plane is 0.3 m for better depth precision. These address concrete causes of motion stutter and grazing-angle depth/texture shimmer. The user's exact visual symptom has not been reproduced in a browser here.

New tests check scenic road elevation/bends, road vertex and triangle clearance against the collider, actual CANNON ray agreement, sustained uphill driving for all cars, complete low-speed scenic laps with suspension contact, interpolation/reset behavior, and authored lamp/material geometry. Chromium still fails to start because the environment denies socket creation, including an escalated launch attempt. No screenshot or real-device FPS claim is made. Before merge, review lights and body appearance from all angles, drive full laps at low/high speeds, check road paint shimmer at speed, inspect crests in hood/chase view, and test touch controls and repeated map/car swaps on a phone. Deployment occurs only after explicit user approval.


## Car-centered camera and phone landscape

Chase and wide views now aim at the car body, removing the old 4 m forward target. Hood view still looks down the road. Resets place the camera relative to the car’s elevation. Landscape layouts keep steering bottom-left, pedals bottom-right, route/reset top-left and the compact garage top-right. Touch targets remain at least 44 px; safe-area insets and the dynamic viewport keep them clear of cutouts and browser bars. Rendering resizes from the visible canvas, including visual-viewport changes. Existing independent touch fingers, swipe look, cancellation and keyboard controls are retained.

New regression tests check car-centered chase/wide aim, five-map switching, new-map mesh/collider agreement, obstacle geometry, full slow laps with every car, and terrain complexity. These are real CANNON simulations with a stubbed WebGL renderer, not a visual or device-performance claim. Local headless Chromium remains blocked by socket permissions; the separate browser route could not reach this preview. Real phone portrait/landscape and desktop WebGL checks remain required before merging. No deployment is performed by this branch.


## Cliff/course feedback fixes

The route-selector issue was keyboard focus, not a frozen physics body: selecting a map left the select focused, and the keyboard guard correctly ignored driving keys on form controls. Committing a route now blurs that selector; native navigation remains usable before committing. A focus-aware regression reproduces the old failure and checks keyboard acceleration and independent touch pedals after switching through all four cars and five maps without a car swap.

All cars gain 5% engine force and 3% target speed; mass, brakes, suspension, mobile controls and drag remain unchanged. Focused tests check real airtime/landing for every car, a complete narrow mountain lap for every car, cliff collision heights, course length, and terrain-conforming paint. These are automated simulations and geometry checks, not visual or phone-FPS evidence. Local Chromium remains unavailable due to socket permissions, and the cloud browser cannot reach the local preview. Desktop WebGL and real-phone portrait/landscape checks remain outstanding before merging. This draft branch is not merged or deployed.
