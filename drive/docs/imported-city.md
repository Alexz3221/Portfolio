# Importing a Cities: Skylines II city

The converter accepts a **CSLModernMap `cmm-v1` `.cmm.gz` export**, not a `.cok` save. Keep the save and raw export outside the repository. The exported browser data is a separate, opt-in public copy: it contains road geometry, building geometry and names, district boundaries, and terrain samples. Review it before publishing.

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

`manifest.json` is the entry point. It has `format: "drive-city-v1"`, source city name and sea level, `originWorld`, `verticalOriginWorld`, local `bounds` and `worldBounds`, `tileSize`, tile descriptors, a `terrain` file reference, `featuredDistrict`, and `meshBackedParentIds`. The latter identifies generic placed-building parent records that have a more precise mesh-bounds proxy record; render and collide with the proxy, not both. Source X and Z orientation is preserved. Local X/Z subtract the center of the **full source terrain**. Local Y subtracts the terrain height near the selected detailed district, recorded as `verticalOriginWorld` and `originWorld[1]`; this keeps the driveable neighborhood near Y=0 while preserving every relative road, building, and terrain height. A district selection can change that vertical origin.

`overview.json` has `format: "drive-city-overview-v1"`, simplified **full-city** road centerlines, source area polygons, and an empty portfolio `stops` array. The six portfolio stops are placed by the browser adapter near suitable streets until curated placements are supplied. Roads contain source `id`, `kind`, `mode`, `level`, `width`, `name`, `lanes`, `carAccess`, `roadClass`, and `points: [[x,y,z], ...]`. When the source includes a traffic snapshot, each road also has `laneDetails: [{position,width,direction,index,speed}]`: signed lateral offset and width in meters, direction along the segment, lane index, and speed in m/s. CSLModernMap labels all driveable road types `kind: "ROAD"`; `roadClass` maps source `level: "HIGHWAY"` to `highway`, `"MAIN"` to `arterial`, and `"BRANCH"` to `street`. Car-forbidden airplane taxiways and runways are excluded. Areas contain `id`, `name`, `kind`, and `polygon: [[x,z], ...]`. All 11,383 areas in this export are labeled `PARK_ZONE`, but that label does not reliably mean vegetation: 9,538 are named Industrial Manufacturing, and others cover factories, airports, or buildings. The browser should render greenery only for areas with clear park names.

`tiles/<ix>_<iz>.json` contain road and building `features`. A tile covers local coordinates `ix*tileSize` to `(ix+1)*tileSize` in X and likewise in Z; indices can be negative. Roads are clipped to each tile, with Y interpolated at boundaries, and can have several `part` fragments under one source `id`; each fragment retains its source `laneDetails`. Buildings are assigned once by footprint centroid and keep their complete polygon, even if it crosses a tile boundary. Building features include `footprint`, `baseY`, `height`, `role`, `category`, `name`, internal `prefab`, `geometrySource`, `growthKind`, and `parentBuildingId`.

This particular export has lane center offsets, widths, and directions, but no pedestrian-lane or sidewalk polygons. Sidewalk bands must be inferred from total road width and car-lane envelopes. It also contains no placed tree instances: the source `forests` and `procedural_objects` arrays are empty. The building `prefab` and `geometrySource` fields identify asset types and approximate footprint/mesh bounds; the `.cmm.gz` does not contain mesh vertices, UVs, materials, textures, or model files. Distinct 3D landmarks therefore require authored or separately licensed browser models matched to those prefab identifiers.

`terrain.json` has `format: "drive-city-terrain-v1"`, `rows`, `cols`, `origin: [x,z]`, `cell`, and flat row-major `heights` and `waterDepths` arrays. `origin` is the **grid corner**. Sample `(row,column)` is centered at `origin + [(column+0.5)*cell, (row+0.5)*cell]`; rows increase toward +Z and columns toward +X. Heights are meters relative to `verticalOriginWorld`. Water depths are nonnegative meters. The source has square cells; the converter samples a wider cell if the requested output would exceed the sample cap.

The converter scans the gzip stream, assembles one road/building/district at a time, and inflates terrain samples incrementally. It does not load the entire source JSON into memory. It does not include a `.cok` reader or alter the game save. `node --test tests/convert-cmm.test.cjs` runs synthetic export checks without a private city file.
