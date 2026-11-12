# Car Go Vroom

Static Three.js driving playground. Serve the repository over HTTP and open `/drive/`. There is no build step. Three.js r128 loads from jsDelivr; CANNON 0.6.2 and GLTFLoader are bundled.

## Cars and maps

Four cars share a 120 Hz rigid-body, four-wheel raycast suspension engine: Comet (141 mph target), Rally (115 mph), Pickup (99 mph), and Hypercar (205 mph). Actual speed depends on drag and terrain. The HUD uses mph; physics uses metres, seconds, and kilograms.

The selector offers three routes:

- **City** is a placeholder district with a flat 400 m collision heightfield, a closed road loop, sidewalks, decorative buildings, and streetlights. The buildings are not yet solid colliders or portfolio stops.
- **Cliffside mountain** is an 894 m winding ledge with 7 m asphalt, real collision cliffs, and a steep ascent and descent. Falling off requires a reset.
- **Racetrack / stunt course** is a 1.19 km ordered route with a 9 m overpass, slalom gates, an 8 m jump gap, a lower crossing, and a narrow balance bridge. Its road slabs are the colliders; there is no paved shortcut around a stunt. Approach the orange jump around 52–63 mph and slow down for the blue bridge.

All three grounds have a 200 m half-width boundary. Mountain and City roads follow the heightfield triangle sampler. The old proving-ground ramp remains only as a physics test fixture. Changing maps resets onto the selected route; changing cars preserves position and orientation while stopping momentum. World geometry, materials, and procedural textures are disposed on rebuild.

## Portfolio direction

The City could become a navigable portfolio hub with About, Projects, Experience, and Contact stops that open readable HTML cards when the car is parked nearby. A persistent menu should give direct access to the same content. The existing home page has the first project links; resume and experience details need to come from the owner.

## Controls and mobile

WASD or arrows drive, Space brakes, 1–4 select cars, C cycles chase/wide/hood cameras, and R resets. Drag or swipe the scene to look around; the view recenters four seconds after release. In the air, up/down apply pitch torque and left/right apply roll torque. Touch pedals support independent fingers. Blur or hiding the tab releases held controls. Committing a route releases selector focus so keyboard driving resumes.

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
```

Automated tests cover car motion and collisions, map and car switching, terrain agreement, the cliff route, stunt slabs and obstacles, cameras, touch controls, model loading, and resource disposal. Check the City, cliff, stunt route, and mobile controls in a WebGL browser before deployment.
