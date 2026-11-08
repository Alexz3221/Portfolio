# Car Go Vroom

Static Three.js driving playground. Serve the repository with `python -m http.server 8000`, then open `http://localhost:8000/drive/`. No build step. Runtime Three.js r128 loads from jsDelivr; MIT-licensed CANNON 0.6.2 is bundled.

## Cars and maps

All four cars use the same 120 Hz rigid-body, four-wheel raycast suspension engine on all five selectable maps. Comet is a 1,200 kg sports car (141 mph target), Rally is 1,350 kg with better dirt performance (115 mph target), Pickup is 1,850 kg (99 mph target), and Hypercar is 1,450 kg with a 205 mph target. Engine force tapers toward those targets; drag and terrain mean actual speed is lower. The HUD and garage use mph; simulation units remain metres/seconds/kilograms.

The old proving-ground/ramp map is removed from the selector and scene builder. Its isolated physics fixture remains for jumping regression tests. Cliffside mountain is a 894 m winding closed ledge with 7 m asphalt, 0.5 m shoulders and a 71–129 m ascent/descent. The inside rises about 55 m and the outside drops about 60 m over six horizontal metres. Both cliffs are real collision terrain, not decorative meshes; the shelf extends slightly beyond the asphalt to accommodate the 2 m collider grid. Falling off requires resetting back to the road.

The racetrack is a single ordered 1.19 km figure-eight stunt route. Its 9 m overpass is part of the lap, followed by alternating slalom gates, an orange launch ramp with a real 8 m gap, a lower-road crossing beneath the overpass, and a 3.6 m-wide raised balance bridge. Follow the arrows. Approach the orange jump at about 52–63 mph (23–28 m/s), release throttle in the air for neutral flight, and slow down for the blue balance bridge. There is no alternate paved shortcut around a stunt. The recovery floor is 8 m below normal road level; press R / Reset after falling. Reset returns to the start. There is no lap timer or checkpoint scoring.

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

## Glancing contacts and mobile zoom

Chassis scraping now uses a separate contact material (friction 0.01, restitution 0), while raycast-tire grip and braking are unchanged. The lower chassis has a 0.5 m front/rear and 0.12 m side bevel rising 0.37 m, retaining its upper collision footprint. This avoids the old square bumper catching shallow inclines, and reduces artificial friction impulses along cliff triangles. Normal collision impulses still stop direct impacts; there is no velocity restoration, teleporting, or disabled collision. Hard impacts and steep/embedded terrain contacts can still roll the car.

Regression fixtures reproduce 8/25/50 m/s shallow landings and real cliffside scrapes with every car. At a 25 m/s, 9-degree landing, the old chassis stopped/reversed; the new chassis retains at least 21.7 m/s in the half-second fixture and stays upright. The real cliff scrape fixture retains over 40 m/s from 50 m/s for all cars. Solid obstacle tests cover all 20 car/map combinations at 8 m/s and each car's configured maximum speed. These are bounded regression scenarios, not a guarantee against every possible high-speed contact.

The camera has no pinch/double-tap zoom operation. Browser zoom was possible on overlay panels, and the route selector's small font could trigger iOS focus zoom. Overlays now use `touch-action: manipulation`, which suppresses double-tap zoom but preserves pinch zoom. The selector uses 16px text in portrait and landscape. Canvas and driving pedals retain their existing gesture isolation. No global zoom lock or maximum-scale viewport restriction is added. Repeated scene taps and multiple pointers are tested across all three camera modes without changing FOV, zoom or camera distance. Physical iPhone/iPad focus, double-tap and pinch behavior still require verification.

Local Chromium was retried for this change and still fails before page load with `socket() failed: Operation not permitted`. No browser rendering, actual Safari zoom behavior, or device FPS result is claimed. Before merging, check repeated taps on camera/reset/car controls, route selection, pinch recovery on the overlay panels, and driving/swipe-look with multiple fingers in both phone orientations. This branch is not deployed.

## Continuous stunt-route rebuild

The previous optional bridges and Gaussian terrain rollers have been removed. One shared ordered route defines both rendered solid slabs and CANNON convex colliders. The upper crossing has 8.4 m underside clearance over the full lower-road width. The jump lip is 3 m above normal road level, the landing starts at 2 m and descends smoothly; the 8 m gap has no hidden road or collision surface. The balance section is 40 m long, 3.6 m wide and 4 m above normal road level, with real drops on both sides. Three alternating solid gates extend across the east-straight centerline and leave a wider than 5 m opening on the opposite side, requiring a weave.

The former ground-level ribbon and bridge-approach layers are not drawn on this map. Slab endpoints share exact edge vertices. Explicit curve/grade boundary tangents keep convex top faces planar. Hazard stripes and arrows have deliberate depth separation; orange identifies the launch and blue identifies the balance section. Four support columns have matching visible and physical boxes. The route uses 200 coalesced slabs and 213 total physics bodies including supports, obstacles, ground, boundary and car. Its two main batched meshes contain fewer than 8,000 solid vertices plus markings. This is more physics bodies than the former layout; real-phone performance remains unmeasured. Other maps and car physics are unchanged.

Tests verify the connected route except its one intentional gap, matching rendered/collider vertices, physical gap/edge drops, full-width overpass clearance, all-car jump landings at 23/26/28 m/s, the slow balance crossing, and a complete continuous lap with all four cars through the actual slalom gates and every stunt. The lap controller accelerates and brakes normally, steers around gates, and never teleports or directly sets velocity during the lap. Isolated jump fixtures set the initial approach velocity to measure a controlled speed range; they are not a guarantee at every speed or air-control input. Tests also cover switching maps/cars and resource disposal.

Offline Blender CPU renders of the exported scene geometry were inspected from aerial, jump, balance and underpass views. They confirm readable connected geometry, not browser rendering. Procedural textures were omitted by that diagnostic export. Local Chromium launch remains restricted; the separate cloud browser cannot reach the local HTTP preview (ERR_CONNECTION_REFUSED). Actual WebGL shimmer, driving feel and physical-phone performance have not been verified. Before merging, drive complete laps in all camera modes and test portrait/landscape touch controls, car/map switching, edge falls and Reset on a phone. No merge or deployment is authorized by this draft.

## Mobile long-press and fullscreen

Native non-passive Safari long-press guards are scoped to the game scene and driving pedals; overlay pinch and native forms remain usable. Full Screen uses the feature-detected browser API with rejection and exit handling. Unsupported iPhone Safari gets Add to Home Screen / Open as Web App help and a standalone manifest rather than forced browser-bar hiding. This is not offline support. iPhone behavior requires real-device verification; automated tests cover handler scope, multitouch and the fullscreen lifecycle, not reproduction of Safari's magnifier. Relevant references: [WebKit fullscreen issue](https://bugs.webkit.org/show_bug.cgi?id=328773) and [Apple web-app instructions](https://support.apple.com/en-az/guide/iphone/iphea86e5236/26/ios/26).
