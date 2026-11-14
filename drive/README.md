# Car Go Vroom

Static Three.js driving playground and interactive portfolio. Serve the repository over HTTP and open `/drive/`. There is no build step. Three.js r128 loads from jsDelivr; CANNON 0.6.2 and GLTFLoader are bundled.

## Cars and maps

Five cars share a 120 Hz rigid-body, four-wheel raycast suspension engine: Comet (141 mph target), Rally (115 mph), Pickup (99 mph), Hypercar (205 mph), and the hidden Yangwang U9 Xtreme (313 mph target). Actual speed depends on drag and terrain. The HUD uses mph; physics uses metres, seconds, and kilograms.

The selector offers the City, mountain, and a Racetrack / stunt course group:

- **City / Alex after dark** starts as an 880 m rainy neon street grid with 100 blocks, 163 varied buildings, businesses, six portfolio landmarks, and a driveable elevated highway with ramps. Buildings, highway deck, rails, and supports have solid colliders. The City Guide opens every stop directly; slow down near a landmark and press E to explore it there. Each story can jump back to that location.
- **Cliffside mountain** is an 894 m winding ledge with 7 m asphalt, real collision cliffs, and a steep ascent and descent. Falling off requires a reset.
- **Racetrack / stunt course** is a 1.19 km ordered route with a 9 m overpass, slalom gates, an 8 m jump gap, a lower crossing, and a narrow balance bridge. Its road slabs are the colliders; there is no paved shortcut around a stunt. Approach the orange jump around 52–63 mph and slow down for the blue bridge.

The Racetrack group also offers three user-supplied GLB scenes, loaded only when selected:

- **Rainbow Road** scales the supplied model 2.5× and follows its full 1.83 km route through all nine road sections. Its built-in checker is the start and finish. Every road section has native mesh collision, with a thin support surface under short source mesh seams. Two large gaps use guided glides between the existing sections. An anti-gravity assist follows the model's steep MK7 climb and descent before returning the car to wheel physics.
- **Race Game Circuit** follows the model's complete paved lap from its checker through the lower underpass, the graded central bridge, and the outer turns. Native road, bridge, grass, and nearby curb surfaces have collision. The lower straight has a real opening over the underpass; line up at its center and launch near 30 mph. A support ribbon sits below the road at small seams, while the jump remains open. The backup ground sits below the model to prevent grass overlap.
- **Bangkok Rush** scales the supplied scene 0.026× so the cars fit its streets. The 285 m timed point-to-point course starts at the model's arch, follows native gray asphalt past the temple and market, then continues along the east boulevard to a generated finish on the southeast street with 39 m of road beyond it. The blue bridge, roundabout, waterfront, other gray branches, and red plaza have source mesh collision for free driving outside the timed route.

On every course, the **Ghost Challenge** panel offers a non-colliding course racer or a replay of your best completed run, saved separately for each course in this browser. The car spawns behind the checkered start line; crossing it in the course direction starts the timer and replay automatically. A loop finishes on the next forward crossing after the ordered full route; Bangkok Rush finishes at its end gate. **Reset to start** lines up another attempt. Choose a course ghost car and pace, or leave **Match my car** selected for the same car as the player. The four visible garage cars are explicit choices; the hidden U9 Xtreme is available through Match my car when driving it. The original stunt-course replays were recorded with each car's physics. Imported-course ghosts follow their authored centerlines at car-specific tuned speeds, slowing for the Race Game jump and Rainbow Road's assisted MK7 section; they are path replays rather than simulated drivers. The HUD shows elapsed time and the gap at the same point on the route. The original course ghost data loads only when entering that course. Regenerate `js/ghost-traces.js` with `node scripts/generate-ghost-traces.cjs` after changing the original course geometry or vehicle physics.

The built-in City has a 440 m half-width boundary and a flat collision plane beneath its raised highway. Mountain and racetrack retain 200 m half-width boundaries; the mountain road follows its heightfield triangle sampler. The old proving-ground ramp remains only as a physics test fixture. Changing maps resets onto the selected route; changing cars preserves position and orientation while stopping momentum. World geometry, materials, and procedural textures are disposed on rebuild.

## Optional imported city

If `data/imported-city/manifest.json` exists, the page loads that converted CSLModernMap city and switches from the built-in district after the first nearby tiles arrive. If the data is absent or cannot load, the built-in City remains playable. The import keeps source terrain and road elevations, loads and evicts detail tiles around the car, and places the six portfolio stops beside suitable streets. The lower-left radar keeps the car and its vision cone pointing up while nearby streets turn around it. Click it or press M for the larger City Guide map with wheel/button zoom and drag/keyboard panning. Its markers lead to seven density-selected city centers and six portfolio stops. FIT restores the full-city view.

The imported driving physics uses the decoded terrain grid as a collision heightfield. Building colliders follow the rendered, inset footprints, leaving gaps between neighboring buildings; raised streets, true bridges, rails, and supports get nearby colliders as tiles load. Tile unload removes them. Ground road edge joins and junction mouths share pavement geometry sampled against the terrain, closing gaps at bends and multi-road intersections. Elevated road detail stays a continuous deck through its ramps, with matching collision surfaces and trimmed guardrails at merges. Grade-separated roads stay separate. Underground roads are omitted until the terrain can be carved for tunnels. Lane markings and directional arrows use exported vehicle lane positions and directions, while roadside speed signs show converted lane limits in km/h. Sidewalks, curbs, crosswalks, and street trees are inferred or procedurally placed because the export contains no sidewalk meshes or tree instances. Buildings use exported prefab names, footprints, categories, and heights to choose among 75 geometric recipes in 15 families, including distinct forms for special buildings. These are browser-authored interpretations: exact game meshes, materials, and adaptive lane connections are absent from this export. See [the conversion guide](docs/imported-city.md) for the `.cmm.gz` workflow and output schema.

A real CSLModernMap export is now converted in `data/imported-city/`: 293 detail tiles, 21,493 building records, 4,258 driveable road records, and a 318 × 366 terrain grid. Synthetic and real-data physics/render tests pass. A local WebGL check confirmed a city-center jump, road junction, sidewalks, trees, building variants, and stop travel; the entire city has not been visually inspected. The [lane and junction roadmap](docs/lane-network-plan.md) records the export gap and milestones for accurate turn lanes, merge geometry, signals, and traffic. One-way arrows now follow complete sampled curves near fast-travel center 03.

## Portfolio stops

The six City stops are About / The Workshop, Projects / Project Arcade, Experience / The Shift Log, Education / Campus Corner, Skills / The Toolbox, and Contact / Signal Tower. Five are anchored near named landmarks in the actual save using `config/obamnas-america-stops.json`; About remains in the densest downtown area. Their stories paraphrase Alex's resume and link to existing projects. The public Contact stop shows LinkedIn and GitHub only. The guide and nearby prompt are accessible HTML over the 3D scene, so visitors can read the portfolio without driving. The home page links directly to the City while keeping its quick project list.

## Controls and mobile

WASD or arrows drive, Space brakes, E opens a nearby City stop when moving slowly, M toggles the City map, 1–4 select garage cars, and 6 selects the hidden Yangwang U9 Xtreme. C cycles chase/wide/hood cameras, F rights the car in place, and R returns to the route start. Drag or swipe the scene to look around; the view recenters four seconds after release. In the air, up/down apply pitch torque and left/right apply roll torque. Touch pedals support independent fingers. Blur or hiding the tab releases held controls. Committing a route releases selector focus so keyboard driving resumes.

The Full Screen button uses the browser API where supported. On iPhone, the help panel explains Add to Home Screen / Open as Web App. The manifest does not add offline support. Touch targets and safe-area spacing support phone portrait and landscape layouts.

## Vehicle assets and credits

The garage uses **Generic passenger car pack** by **Comrade1280**, under **CC BY 4.0**: Coupe (Comet), Hatchback (Rally), Pickup, and Sport (Hypercar). See [visible credits](credits.html), [license](assets/vehicles/passenger/LICENSE.txt), and [conversion provenance](assets/vehicles/passenger/SOURCE.md). Only the selected GLB loads; later selections are cached. Procedural cars remain playable fallbacks if a model fails.

The hidden key-6 car lazily loads the user-supplied [2024 Yangwang U9 model](assets/vehicles/u9-xtreme/SOURCE.md) with its original proportions, materials, interior, and exterior details. Only uniform size conversion and four animated wheel pivots are applied for the simulator. Its appearance is the regular U9, while the driving setup uses U9 Xtreme specifications. A lightweight procedural visual remains as a loading and failure fallback. The downloaded mesh is marked **CC BY-NC-SA 4.0**, and its uploader states that it derives from a *Need for Speed Mobile* model; review the [provenance and license notes](assets/vehicles/u9-xtreme/SOURCE.md) before public redistribution. Physics mass, power, and top-speed target follow [BYD's published specifications](https://media.byd.com/focus-technique-de-la-yangwang-u9-a-la-yangwang-u9-xtreme-detentrice-du-record-mondial-de-vitesse/?lang=fra) and [503.17 km/h speed record](https://media.byd.com/the-fastest-gets-faster-yangwang-u9-xtreme-tops-500kmh-to-set-new-global-speed-record-in-abu-dhabi/?lang=eng). Engine force and grip are game tuning; this is not a validated vehicle dynamics model.

The three imported course GLBs live in `assets/courses/`. Their scene credits are on [the visible credits page](credits.html), and [source/provenance notes](assets/courses/SOURCE.md) record their embedded metadata and the project owner's permission to publish the Mario Kart-derived files. The 36 MB Race Game and 76 MB Bangkok GLBs may take time to load on a network; the lightweight physical route appears first. The Bangkok loader hides identical overlapping mesh copies to reduce its render work.

## Verification

With Node.js 18+:

```sh
cd drive
npm ci
npm test
node --check js/main.js
node --check js/physics.js
node --check js/city.js
node --check js/imported-city.js
node --check js/portfolio-ui.js
```

Automated tests cover car motion and collisions, the built-in City, imported terrain and nearby collision bodies, road junction and ramp geometry, map and car switching, converter output, the cliff route, stunt slabs and obstacles, cameras, touch controls, model loading, and resource disposal. `DRIVE_FULL_ROAD_AUDIT=1 node --test tests/road-surface-coverage.test.cjs` checks asphalt and terrain coverage at spawn and seven fast-travel districts. `tests/portfolio-ui-smoke.html` exercises the guide, cards, map zoom/pan, M hotkey, fast travel, E prompt, and Escape in a browser. `tests/road-preview.html?x=1840.721&z=-1052.141&span=100` gives a top-down WebGL view of a known tight bend. Check the imported City, cliff, stunt route, and mobile controls in a WebGL browser before deployment.
