# Imported course asset provenance

The three original GLB downloads were supplied in the user's Downloads folder. Their embedded glTF `asset.extras` metadata reports the following Sketchfab sources and CC BY 4.0 claims:

| Local file | Embedded source and author | Site use |
| --- | --- | --- |
| `rainbow-road.glb` | [rainbow road dx](https://sketchfab.com/3d-models/rainbow-road-dx-ce0d3ec403474d389548bb8138ac87cf), amogusstrikesback2 | Scaled 5×; all nine road sections supply native mesh collision on the full loop. A thin underlay supports short mesh seams, two large gaps use guided glides, and the steep MK7 section has assisted driving. |
| `race-game-environment.glb` | [Race Game Environment](https://sketchfab.com/3d-models/race-game-environment-31da91ea095d401ba78c603bdafae58c), Pranav 3d | Full circuit from the source checker toward the northern straight, including native road, bridge, underpass, grass, curbs, and a west-to-east stunt jump. A lower collision ribbon supports small seams without filling the jump. |
| `bangkok-rush.glb` | [Mario Kart 8 Deluxe - Tour Bangkok Rush](https://sketchfab.com/3d-models/mario-kart-8-deluxe-tour-bangkok-rush-d194e9517a54433cabca645eeafe1f62), Fortnite/jkimmel694 | Scaled 0.026×; the 285 m timed run follows native gray asphalt from the southeast city street past the market and temple, finishing westbound through the model's built-in arch with 39 m of sloped runout. The blue bridge, roundabout, waterfront, other gray branches, and red plaza have collision for free driving. Duplicate mesh instances are hidden at runtime. |

The Rainbow Road and Bangkok models contain Mario Kart content. Their publication here is based on the project owner's confirmation that they have permission to publish both GLBs. The uploaders' CC BY claims alone do not establish rights to Nintendo's underlying material or other contributors' work. The [Rainbow uploader's profile](https://sketchfab.com/amogusstrikesback2) also warns that many of their copyrighted models cannot be used commercially. The game code can show a lightweight playable road if a source GLB is unavailable.

The original files in Downloads were copied without modifying them. The game scales Bangkok 0.026× and Rainbow 5× for the vehicle size, and loads each GLB only when its course is selected. Attribution links are also visible on `drive/credits.html`.
