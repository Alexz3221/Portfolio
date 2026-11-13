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
| 5. Citywide and performance pass | Compare top-down game references with the browser at spawn and all seven fast-travel centers. Add graph continuity/coverage checks over every tile, then tune streaming and batching for the full 293-tile city. | No new road holes or large frame-time spikes while driving or fast traveling; new and old junction tests pass. |
| 6. Signals and traffic | Export node signal group/timer and each controlled lane's signal state/group mask if accurate working signals are desired. Place lights at existing exported nodes; later route procedural cars over the validated lane graph, respecting direction, connections, and signals. | A representative signalized junction follows per-lane signal permissions and cars do not turn through forbidden connectors. Traffic remains a separate milestone after road geometry works. |

## Implemented pass

Steps 1–5 now have a working browser implementation. The exporter patch is in
`tools/cs2-lane-exporter/`; the converter writes compact lane-graph tiles and
traffic-light positions, while old exports still work without them. The
browser streams the new files with the corresponding road tiles, draws curved
lane connectors and road-level merge/split guides, uses those curves for
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

The export still cannot reproduce exact game intersection meshes, asset
models, or traffic-light cycles. A few short straight-cut seams remain where
generated connector ribbons meet the sampled approach pavement. One raised
ramp join has a preexisting collision bump about 0.17–0.26 m above the new
connector at two samples. These are geometry followups; they do not create
missing lane-graph links.

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
