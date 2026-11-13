# Importing a Cities: Skylines II city

The converter accepts a **CSLModernMap `cmm-v1` `.cmm.gz` export**, not a `.cok` save. Keep the save and raw export outside the repository. The exported browser data is a separate, opt-in public copy: it contains road geometry, building geometry and names, district boundaries, terrain samples, and, when present, native car-lane paths and traffic-light node positions. Review it before publishing.

With Node.js 18 or newer, from the `drive` directory:

```sh
node scripts/convert-cmm.cjs --input "C:/path/to/My City.cmm.gz" --out data/imported-city
```

The output directory must be empty. To convert a bounded driveable district while retaining an overview of the entire city, provide either:

```sh
node scripts/convert-cmm.cjs --input "C:/path/to/My City.cmm.gz" --out data/imported-city --center 1200,-800 --radius 1500
node scripts/convert-cmm.cjs --input "C:/path/to/My City.cmm.gz" --out data/imported-city --bounds -300,-900,1600,700
```

To place portfolio stops near handpicked city landmarks, add `--stops-file config/obamnas-america-stops.json`. The JSON uses `format: "drive-city-stops-v1"`, `coordinateSystem: "source-world-xz"`, and a `stops` array with unique `id`, numeric source-world `x,z`, and optional `landmarkId`, `landmark`, and `roadId`. An optional `cityName` checks that the config matches the export. The converter translates source-world coordinates into browser-local coordinates; the browser then snaps each target onto a driveable road. Omitted stop IDs keep their automatic placement and existing portfolio titles.

Coordinates in `--center` and `--bounds` are **source world X,Z meters**, not browser-local coordinates. The default processes the whole city. `--tile-size 512` sets the road/building tile width in meters. `--terrain-cell 32` requests terrain samples about 32 m apart; `--max-terrain-samples 250000` coarsens larger exports automatically to about a 500×500 grid or smaller, bounding browser physics and converter memory. The CLI prints counts, output bytes, and the tile with the highest building/road density. That tile is the suggested first detailed district.

For a city with a much larger surrounding terrain than its built area, use `--bounds` around the roads and buildings. The overview still contains every road and area boundary, while the detailed tiles and terrain stay near the driveable city. For this save, `--bounds -7680,-5632,7680,7680` covers all exported roads and buildings with a margin and yields a finer terrain grid under the default sample cap.

## Browser data

`manifest.json` is the entry point. It has `format: "drive-city-v1"`, source city name and sea level, `originWorld`, `verticalOriginWorld`, local `bounds` and `worldBounds`, `tileSize`, tile descriptors, a `terrain` file reference, `featuredDistrict`, `centerCandidates`, `travelCandidates`, and `meshBackedParentIds`. Center candidates are density-selected, separated tile centers for street-level fast travel. Travel candidates fill wider gaps between those centers on comparatively flat, terrain-clear ground streets; the browser lands the car in a permitted driving lane. This save has seven centers and seventeen additional street jumps. `meshBackedParentIds` identifies generic placed-building parent records that have a more precise mesh-bounds proxy record; render and collide with the proxy, not both. Source X and Z orientation is preserved. Local X/Z subtract the center of the **full source terrain**. Local Y subtracts the terrain height near the selected detailed district, recorded as `verticalOriginWorld` and `originWorld[1]`; this keeps the driveable neighborhood near Y=0 while preserving every relative road, building, and terrain height. A district selection can change that vertical origin.

`overview.json` has `format: "drive-city-overview-v1"`, simplified **full-city** road centerlines, source area polygons, and five curated portfolio stop positions; an uncurated export can leave stops empty and let the browser adapter choose nearby streets. Roads contain source `id`, `kind`, `mode`, `level`, `width`, `name`, `lanes`, `carAccess`, `carSpeed`, `roadClass`, `trafficFlow`, and `points: [[x,y,z], ...]`. When the source includes a traffic snapshot, each road also has `laneDetails: [{position,width,direction,index,speed}]`: signed lateral offset and width in meters, direction along the segment, lane index, and speed in m/s. CSLModernMap labels all driveable road types `kind: "ROAD"`; `roadClass` maps source `level: "HIGHWAY"` to `highway`, `"MAIN"` to `arterial`, and `"BRANCH"` to `street`. Car-forbidden airplane taxiways and runways are excluded. Areas contain `id`, `name`, `kind`, and `polygon: [[x,z], ...]`. All 11,383 areas in this export are labeled `PARK_ZONE`, but that label does not reliably mean vegetation: 9,538 are named Industrial Manufacturing, and others cover factories, airports, or buildings. The browser should render greenery only for areas with clear park names.

`trafficFlow` is derived from native car access as `forward-only`, `backward-only`, `two-way`, or `unknown`. It is separate from `roadClass`: a highway can be one-way or two-way. `carSpeed` and each lane's `speed` are the game's effective car-lane limits in m/s; multiply by 3.6 for km/h. The browser draws permitted-direction lane arrows and speed signs from these fields. The export does not contain the original sign meshes, painted decals, or turn-only lane rules.

`tiles/<ix>_<iz>.json` contain road and building `features`. A tile covers local coordinates `ix*tileSize` to `(ix+1)*tileSize` in X and likewise in Z; indices can be negative. Roads are clipped to each tile, with Y interpolated at boundaries, and can have several `part` fragments under one source `id`; each fragment retains its source `laneDetails`. Buildings are assigned once by footprint centroid and keep their complete polygon, even if it crosses a tile boundary. Building features include `footprint`, `baseY`, `height`, `role`, `category`, `name`, internal `prefab`, `geometrySource`, `growthKind`, and `parentBuildingId`.

### Optional native lane graph

The patched exporter can add `extensions.cs2.lane_graph` to a `cmm-v1` file. This is optional: older exports still convert and have no `manifest.laneGraph`. Inspect a new export with `node scripts/inspect-lane-graph.cjs "C:/path/to/My City.cmm.gz"` before conversion to check source IDs, connector lane references, and exporter diagnostics.

`manifest.laneGraph` has `format: "drive-city-lane-graph-v1"`, `schemaVersion: 1`, `coordinateSystem: "browser-local-xyz"`, `edgeFields`, `connectorFields`, `counts`, `sourceStats`, and `tiles`. The counts distinguish all source lanes/connectors from those inside the selected bounds. `sourceStats` preserves the exporter's unresolved-connector and invalid-curve counts; unresolved connectors were omitted by the exporter and cannot be inferred by the browser. A lane tile descriptor has `ix`, `iz`, and either or both of `edgeLanes: {file,count}` and `connectors: {file,count}`. File paths are relative to the imported-city directory. Some lane-only tiles have no road/building entry in `manifest.tiles`.

Each `lane-graph/edgeLanes/<ix>_<iz>.json` or `lane-graph/connectors/<ix>_<iz>.json` is `{format:"drive-city-lane-tile-v1",ix,iz,kind,items}`. An `items` record is a compact positional array; `edgeFields` or `connectorFields` in the manifest gives its field names. Both record types end in `curve`, four Bezier control points `[[x,y,z], ...]` in the same local frame and vertical origin as the road tiles. The converter retains native entity IDs and versions, owner edge/node IDs, lane indexes, full path indexes, width, flags, and, for edge lanes, edge range and speed. Connector records also retain source and target edge IDs and `path_methods_bits`. The complete curve is copied into each tile touched by its control-point hull, so a renderer should deduplicate adjacent tiles by `entity_id` plus `entity_version`.

The converter streams one source lane or connector at a time. It retains a compact lane endpoint index and pending connector references to copy each connector and its two endpoint lanes into every tile needed for independent paint and seam rendering; it then rewrites one output tile at a time after choosing the vertical origin. The lane graph describes the game's exported car paths, including permitted turn and merge connectors; it does not contain the game's road mesh, painted decals, or signal timing.

### Optional traffic lights

When the source has `traffic.lights`, the manifest has `trafficLights: {file:"traffic-lights.json",count,sourceCount}`. The file is `{format:"drive-city-traffic-lights-v1",coordinateSystem:"browser-local-xyz",lights:[{nodeId,position:[x,y,z],active}]}`. It retains the source node ID, position, and active state for lights inside the selected bounds. The source snapshot's `states` array is empty, so these positions can identify signalized approaches but cannot reproduce per-lane colors or timing. Inactive lights should not create stop control.

The original export has sampled lane center offsets, widths, and directions, but no pedestrian-lane or sidewalk polygons. Sidewalk bands must be inferred from total road width and car-lane envelopes. Connected road endpoints are joined with generated pavement and corner returns; the optional native lane graph adds actual car-lane connection paths, while the game's intersection meshes remain absent. Ground carriageways and junctions are tessellated against terrain, while elevated roads keep continuous decks through ramps and merges. The City Guide mirrors the north/south map axis (+X right, +Z up) to match this save's recognized layout. [CSLModernMap's PNG renderer](https://github.com/Liuiuera/CSLModernMap/blob/main/dev/CSLModernMapRenderer/csmodernmap/renderer.py) uses a different default projection. The export also contains no placed tree instances: the source `forests` and `procedural_objects` arrays are empty. The building `prefab` and `geometrySource` fields identify asset types and approximate footprint/mesh bounds; the `.cmm.gz` does not contain mesh vertices, UVs, materials, textures, or model files. The browser uses `role`, `category`, and `prefab` to select 55 authored zoning recipes: 20 residential, 15 commercial, 10 industrial, and 10 office. Another 40 recipes cover civic and landmark families. These recipes vary massing, roof forms, facades, and accents while keeping each visible shell inside its inset source footprint. The same footprint is used for collision. Exact asset reproduction would require separately available and licensed game models.

`terrain.json` has `format: "drive-city-terrain-v1"`, `rows`, `cols`, `origin: [x,z]`, `cell`, and flat row-major `heights` and `waterDepths` arrays. `origin` is the **grid corner**. Sample `(row,column)` is centered at `origin + [(column+0.5)*cell, (row+0.5)*cell]`; rows increase toward +Z and columns toward +X. Heights are meters relative to `verticalOriginWorld`. Water depths are nonnegative meters. The source has square cells; the converter samples a wider cell if the requested output would exceed the sample cap.

The browser lifts ordinary road pavement and lane ribbons to at least the
sampled terrain height. In this save, the browser terrain uses 42 m cells,
while the source terrain uses 14 m cells. The coarser, uncut terrain can rise
above an exported road and make an artificial steep wedge. Source roads
marked `TUNNEL` and connectors touching those roads are hidden from the
driveable scene. The terrain has no tunnel cuts or portals, so tunnels cannot
be driven yet. Supporting them requires local terrain cuts, portal meshes,
and matching terrain and tunnel collision surfaces; merely removing the
road-height clamp would bury road pavement under the existing terrain.

The converter scans the gzip stream, assembles one road/building/district/lane/connector at a time, and inflates terrain samples incrementally. It does not load the entire source JSON into memory. It does not include a `.cok` reader or alter the game save. `node --test tests/convert-cmm.test.cjs tests/inspect-lane-graph.test.cjs` runs synthetic export checks without a private city file.
