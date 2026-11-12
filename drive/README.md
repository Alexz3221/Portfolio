# Car Go Vroom

Static Three.js driving playground and interactive portfolio. Serve the repository over HTTP and open `/drive/`. There is no build step. Three.js r128 loads from jsDelivr; CANNON 0.6.2 and GLTFLoader are bundled.

## Cars and maps

Four cars share a 120 Hz rigid-body, four-wheel raycast suspension engine: Comet (141 mph target), Rally (115 mph), Pickup (99 mph), and Hypercar (205 mph). Actual speed depends on drag and terrain. The HUD uses mph; physics uses metres, seconds, and kilograms.

The selector offers three routes:

- **City / Alex after dark** is an 880 m rainy neon street grid with 100 blocks, 163 varied buildings, businesses, six portfolio landmarks, and a driveable elevated highway with ramps. Buildings, highway deck, rails, and supports have solid colliders. The City Guide opens every stop directly; slow down near a landmark and press E to explore it there. Each story can jump back to that location.
- **Cliffside mountain** is an 894 m winding ledge with 7 m asphalt, real collision cliffs, and a steep ascent and descent. Falling off requires a reset.
- **Racetrack / stunt course** is a 1.19 km ordered route with a 9 m overpass, slalom gates, an 8 m jump gap, a lower crossing, and a narrow balance bridge. Its road slabs are the colliders; there is no paved shortcut around a stunt. Approach the orange jump around 52–63 mph and slow down for the blue bridge.

City has a 440 m half-width boundary and a flat collision plane beneath its raised highway. Mountain and racetrack retain 200 m half-width boundaries; the mountain road follows its heightfield triangle sampler. The old proving-ground ramp remains only as a physics test fixture. Changing maps resets onto the selected route; changing cars preserves position and orientation while stopping momentum. World geometry, materials, and procedural textures are disposed on rebuild.

## Portfolio stops

The six City stops are About / The Workshop, Projects / Project Arcade, Experience / The Shift Log, Education / Campus Corner, Skills / The Toolbox, and Contact / Signal Tower. Their stories paraphrase Alex's resume and link to existing projects. The public Contact stop shows LinkedIn and GitHub only. The guide and nearby prompt are accessible HTML over the 3D scene, so visitors can read the portfolio without driving. The home page links directly to the City while keeping its quick project list.

## Controls and mobile

WASD or arrows drive, Space brakes, E opens a nearby City stop when moving slowly, 1–4 select cars, C cycles chase/wide/hood cameras, and R resets. Drag or swipe the scene to look around; the view recenters four seconds after release. In the air, up/down apply pitch torque and left/right apply roll torque. Touch pedals support independent fingers. Blur or hiding the tab releases held controls. Committing a route releases selector focus so keyboard driving resumes.

The Full Screen button uses the browser API where supported. On iPhone, the help panel explains Add to Home Screen / Open as Web App. The manifest does not add offline support. Touch targets and safe-area spacing support phone portrait and landscape layouts.

## Vehicle assets and credits

The garage uses **Generic passenger car pack** by **Comrade1280**, under **CC BY 4.0**: Coupe (Comet), Hatchback (Rally), Pickup, and Sport (Hypercar). See [visible credits](credits.html), [license](assets/vehicles/passenger/LICENSE.txt), and [conversion provenance](assets/vehicles/passenger/SOURCE.md). Only the selected GLB loads; later selections are cached. Procedural cars remain playable fallbacks if a model fails.

## Verification

With Node.js 18+:

```sh
cd drive
npm ci
npm test
node --check js/main.js
node --check js/physics.js
node --check js/city.js
node --check js/portfolio-ui.js
```

Automated tests cover car motion and collisions, City streets, buildings and highway, map and car switching, terrain agreement, the cliff route, stunt slabs and obstacles, cameras, touch controls, model loading, and resource disposal. `tests/portfolio-ui-smoke.html` exercises the guide, cards, fast travel, E prompt, Escape, and map visibility in a browser. Check the City, cliff, stunt route, and mobile controls in a WebGL browser before deployment.
