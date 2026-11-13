# Lane and junction roadmap

Goal: make the imported Obamna's America roads read and drive like the saved
Cities: Skylines II network, including lane-specific turns and highway merges.
Use fast-travel center 03 (Terminus District, near the Seabreeze/Washington/
Belmont split) as the first reference junction, then cover the other centers.

## Save 12 export and scope

- Each road has a centerline, width, class, car travel direction, speed limit,
  and sampled vehicle lane offsets, widths, and directions. The browser can
  draw lane separators, travel-direction arrows, and speed signs from those.
- The patched 2026-11-12 Save 12 `.cmm.gz` contains 27,363 edge-lane curves,
  20,016 junction connectors, 53 forbidden connectors, and 455 active
  traffic-light node positions. Every emitted connector resolves to two
  exported lanes. The exporter also counted 40,636 car node-lane candidates
  that did not resolve to two exported road edges; their distribution still
  needs investigation before claiming complete game routing coverage.
- The older traffic snapshot's `lane_index` is a `SubLane` buffer position,
  **not** a stable game lane identifier. The new graph instead preserves
  native entity IDs, versions, and path-node lane indexes for each connector.
- The game export contains no junction mesh vertices, painted decals,
  approach-by-approach signal colors, or signal timing. The browser builds
  pavement and markings from actual lane paths and road widths. It does not
  replay traffic-light phases or vehicles.

The [CSLModernMap exporter](https://github.com/Liuiuera/CSLModernMap-CodeMod/blob/main/CS2/Systems/CarNavigationExport.cs)
shows the upstream omitted `NodeLane` path and its
[traffic pass](https://github.com/Liuiuera/CSLModernMap-CodeMod/blob/main/CS2/Systems/TrafficExport.cs)
shows the lane samples. The open-source
[Traffic mod connector code](https://github.com/krzychu124/Traffic/blob/main/Code/Systems/LaneConnections/GenerateConnectorsSystem.GenerateConnectionLanesJob.cs)
shows how a node's `SubLane` entries resolve start/end edges and lane indexes,
and how to read each connector's Bezier curve and forbidden/unsafe flags.
[Paradox's Road Tools description](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools)
also confirms that highway acceleration/deceleration lanes are explicit lane
count transitions where a single-lane ramp joins a wider highway section.

## Milestones

| Step | Deliverable | Done when |
| --- | --- | --- |
| 0. Direction cues | Group densely sampled source-road pieces and paint one-way/highway arrows over the complete visible curve. | Center 03's previously unmarked `5516868`, `5516697`, and `5516806` have arrows pointing with exported travel direction; a real-data regression and WebGL preview pass. This step is implemented. |
| 1. Game-side lane graph | Extend the exporter or add a companion export pass. For **every** driveable edge lane, including partial ramp lanes, write an entity ID/version, owner edge, actual path-node lane indexes, direction, width, speed, and Bezier. For each junction `NodeLane`, write the source/target edge and lane identities, Bezier control points, path method, and allowed/forbidden/unsafe flags. Keep the existing road and node IDs. | A new export of the same save resolves every reported connector to a source and target lane, with diagnostics for unresolved paths. Center 03's split and a highway on-ramp are inspectable as lane graphs. |
| 2. Convert and validate | Add a versioned lane-graph section to `convert-cmm.cjs` and tile it independently of buildings. Preserve source IDs through clipping; apply the same browser-local transform to connector curves. Validate finite coordinates, endpoints, direction, and level/height. | The converter reports connector totals and unresolved/forbidden counts. Tests reject dangling IDs, reversed connectors, and grade-separated false junctions. Existing `.cmm.gz` files still load with basic markings. |
| 3. Driveable junction meshes | Generate lane-centered curved ribbons through the node, join them to approach pavement, and use lane-width transitions for merge/diverge tapers. Build the matching collision surface and keep overpasses on separate levels. | At center 03 and sample T, four-way, roundabout, and highway junctions, lanes lead continuously from entrance to permitted exit without ground holes, overlaps, floating rails, or invisible walls. The car can drive each path. |
| 4. Lane instructions and paint | Classify straight/left/right/U turns from connector tangents. Aggregate permitted exits per source lane for turn/combined arrows. Add merge guides, stop lines, and lane separators appropriate to the validated graph. Signs use the already exported speeds. | Turn arrows match the save at center 03 and selected city junctions. No lane displays a turn it cannot make. Paint follows curves and stays clear of intersections and sidewalks. |
| 5. Citywide and performance pass | Compare top-down game references with the browser at spawn, all seven original centers, and seventeen additional street jumps. Add graph continuity/coverage checks over every tile, then tune streaming and batching for the full 293-tile city. | No new road holes or large frame-time spikes while driving or fast traveling; new and old junction tests pass. |
| 6. Signals and traffic | Export node signal group/timer and each controlled lane's signal state/group mask if accurate working signals are desired. Place lights at existing exported nodes; later route procedural cars over the validated lane graph, respecting direction, connections, and signals. | A representative signalized junction follows per-lane signal permissions and cars do not turn through forbidden connectors. Traffic remains a separate milestone after road geometry works. |

## Implemented pass

Steps 1–5 now have a working browser implementation. The exporter patch is in
`tools/cs2-lane-exporter/`; the converter writes compact lane-graph tiles and
traffic-light positions, while old exports still work without them. The
browser streams the new files with the corresponding road tiles, draws curved
lane connectors and lane-boundary guides at merges and splits, uses those curves for
raised-road collision, and paints per-lane permitted turns and stop lines at
active signal nodes. There are 293 road/building tiles and 283 graph tiles.

`node scripts/audit-lane-city.cjs data/imported-city` checks every tiled
connector copy. All 20,016 unique connectors resolve; the largest rounded
endpoint gap is 0.001 m, there are no locally missing lane copies, and all
seven fast-travel centers have lanes and connectors. The browser uses 55
distinct zoned building recipes (20 residential, 15 commercial, 10
industrial, 10 office), all present in this save, plus 40 specialty recipes.
At 1280×720, a local browser fast travel from spawn to center 03 had 5.6 ms
p95 frame time over four seconds; nine nearby road tiles loaded by 2.2 s.
There was still one 126 ms frame during streaming. Tile concurrency is capped
at two to soften clustered mounts, but GPU upload hitches need another pass.

The center 03 Orchard/Seabreeze and Fairview/Belmont merges now use exported
edge-lane curves to taper the approach shoulders into the connector ribbons.
The old full-width approach slabs left a broad, unmarked asphalt star at these
nodes; the new pavement follows the actual 2+1 to 3-lane join. Boundary paint
is placed between parallel connector paths and begins at the ramp only after
the lanes converge. Real-save regression checks cover the Fairview approach
and exit pavement and Orchard's two lane dividers. A local WebGL inspection
also checked both joins and the nearby four-arm junction.

The traffic exporter measures lateral lane offsets with the opposite road
normal from the browser road mesh. The browser now reverses that offset before
placing lane paint, arrows, and signs; tests compare the painted centerline
with native forward/backward lane curves. Connections flagged `unsafe` remain
in the graph but do not create ordinary turn arrows. Left/right turn heads
also follow the full map's X/Z handedness. The full city map keeps
the saved city's orientation. The imported 3D display, city steering, chase
camera, and rotating minimap now use one matching orientation so left and
right turns agree with the full map.

The International Airport export contains a site-sized mesh bound rather
than detailed terminal geometry. That bound no longer becomes a solid glass
box. Procedural terminal pods, concourses, a control tower, and open dropoff
canopies sit around the exported Eastgate and Daffodil roads. A regression
checks all eleven airport approach road IDs against the terminal footprints
and physical road surfaces. The replacement is an interpretation of the
airport site, not a copy of its Cities: Skylines II asset.

## Mapwide road-surface audit (2026-11-12)

`node scripts/audit-city-smoothness.cjs` loads all 293 tiles and examines
5,367 source roads, 8,231 road segments of at least 2 m, 27,363 native edge
lanes, the rendered lane connectors, generated guardrails, and supports.
`node scripts/audit-city-colliders.cjs --all` samples the actual streamed
CANNON surfaces along every visible permitted connector in 1,581 map cells. The
checks are reproducible, but they sample lane paths rather than driving
every possible line across a road.

The final CANNON sweep found zero missing surfaces in 67,184 lane samples.
It found 1,248 places where the top collider is more than 0.5 m above the
exported lane height, including 177 over 1 m. Some reflect a native graph
lane buried below a continuous, smooth source road deck, such as node
`3025183`; others are real overlapping source surfaces that need route-aware
resolution. At the 82 selected elevated graph junctions, only 5 of 1,534
samples differ by more than 0.5 m and none by more than 1 m. These ray checks
cannot prove that every lateral path or collision impulse is smooth.

The bridge renderer now cuts full-width centerline slabs back where the
exported lane graph supplies the merge, width transition, or sharp bend.
Native edge-lane ribbons fill the approaches. Physics uses the same cuts and
lane ribbons. The compound-collider bounding boxes now include every curved
box segment, fixing a CANNON broadphase omission that left physical holes
despite visible pavement. Conventional ground junctions with complete graph
coverage, conflicting source heights, and lanes close to terrain receive the
same selective treatment. Their local asphalt fill extends to the trimmed
road shoulders.

At the interchange east of the Experience stop, visual shoulder tapers and
physical support now share the same width. Ground road colliders follow the
visible carriageway and its rendered junction cutbacks, so hidden full-width
slabs cannot block a graph merge. Elevated approach colliders are included
only for lane segments actually rendered at that junction. The affected
interchange, an unrendered elevated approach elsewhere, and a road-edge lip
were checked with vertical visual and CANNON rays. The local raised surfaces
had no unsupported pavement or invisible raised road bodies in those sweeps.

Clipped curved road colliders interpolate the same edge miters as the painted
mesh. Curved connector pieces use the rendered ribbon triangles where a box
would protrude beyond the lane. Raised conventional junction fill has its own
triangle surface for wheel contact, streamed per junction within 90 m. The
fallback junction near (5293, -1527) now supports a simulated car crossing;
its dense mesh costs about 1 ms per 60 Hz physics step while nearby. A
visual-to-physics audit sampled 143 junction visits and 7,007 rays across the
city. Its one remaining raised-body mismatch was a sub-meter tile-edge ray
that matched the visible road 25 cm away. The legacy lane-centerline sweep
above compares source heights to physics; it does not by itself detect
invisible colliders outside visible pavement.

Generated guardrails are clipped where they cross other same-level roads or
permitted lane paths; their visual and physics lengths are identical. Bridge
supports are removed if they occupy a road or permitted lane, including a
road from a neighboring tile. The audit reports no remaining sampled
guardrail or support intrusions. It also checks tiles loaded in either order.

Six source road segments exceed 35% grade. Three lie entirely under the new
graph surface and no longer provide the visible or physical road deck. The
three still exposed are Bayview `5339578`, Fawn `5264023`, and Cornfield
`530495`; `node scripts/check-steep-surfaces.cjs` records their source grade
and collider rays. The malformed near-vertical native lane curves on rendered
approaches are regraded to the road deck. The other source slopes remain
possible bumps rather than being globally flattened, which could break
ramps or underpasses. At Cornfield, the approach collider now follows the
existing road contact where they overlap; its worst sampled local grade fell
from 68% to about 40%, with no missing contact.

The export still cannot reproduce exact game intersection meshes, asset
models, or traffic-light cycles. Small paint fragments remain at the
Orchard/Seabreeze gore tip, some four-arm junction centers have broad
unmarked asphalt, and some source road heights disagree with native lane
heights. A long graph route near node `3372922` passes beneath a road whose
source edges do not share endpoints; changing either level globally would
destroy one of the routes. This needs a route-aware junction reconstruction.

## Implementation order and boundaries

1. For a future save, run the patched exporter and
   `node scripts/inspect-lane-graph.cjs "C:/path/to/city.cmm.gz"` before
   conversion to check connector IDs and unresolved counts.
2. Keep the junction graph factual. Connector geometry is the source for
   legal turns and merge paths. Road-angle heuristics may fill visual gaps but
   may not create turn permissions.
3. Use automated topology/coverage tests plus side-by-side visual checks. A
   screenshot alone cannot establish that the lane graph or collision works.
4. Defer moving traffic until lane paths and intersection geometry are stable.
   The present paused export cannot replay the game's vehicles or light cycle.
   The open-source [Traffic Tool Essentials signal system](https://github.com/ZessonsDE/TrafficToolEssentials/blob/main/TrafficToolEssentials/Systems/TrafficLightSystems/Simulation/PatchedTrafficLightSystem.cs)
   illustrates the node and `LaneSignal` fields, but a browser cycle would
   need its own simulation policy.

The existing project entry points are `scripts/convert-cmm.cjs`,
`js/imported-city.js`, `tests/road-surface-coverage.test.cjs`, and the
`tests/road-preview.html` WebGL diagnostic.
