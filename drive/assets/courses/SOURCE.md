# Imported course asset provenance

The three original GLB downloads were supplied in the user's Downloads folder. Their embedded glTF `asset.extras` metadata reports the following Sketchfab sources and CC BY 4.0 claims:

| Local file | Embedded source and author | Site use |
| --- | --- | --- |
| `rainbow-road.glb` | [rainbow road dx](https://sketchfab.com/3d-models/rainbow-road-dx-ce0d3ec403474d389548bb8138ac87cf), amogusstrikesback2 | Scaled 2.5×; a connected road section supplies native mesh collision, with a small hidden patch at the start stripe. |
| `race-game-environment.glb` | [Race Game Environment](https://sketchfab.com/3d-models/race-game-environment-31da91ea095d401ba78c603bdafae58c), Pranav 3d | Native collision from reachable road, curbs, and nearby solid scenery; distant decoration remains visual. |
| `bangkok-rush.glb` | [Mario Kart 8 Deluxe - Tour Bangkok Rush](https://sketchfab.com/3d-models/mario-kart-8-deluxe-tour-bangkok-rush-d194e9517a54433cabca645eeafe1f62), Fortnite/jkimmel694 | The city street supplies native mesh collision for a point-to-point sprint. Runtime hides duplicate overlapping mesh instances. |

The Rainbow Road and Bangkok models contain Mario Kart content. Their publication here is based on the project owner's confirmation that they have permission to publish both GLBs. The uploaders' CC BY claims alone do not establish rights to Nintendo's underlying material or other contributors' work. The [Rainbow uploader's profile](https://sketchfab.com/amogusstrikesback2) also warns that many of their copyrighted models cannot be used commercially. The game code can show a lightweight playable road if a source GLB is unavailable.

The original files in Downloads were copied without modifying them. The game applies a 0.01 display scale to Bangkok and 2.5× to Rainbow, and loads each GLB only when its course is selected. Attribution links are also visible on `drive/credits.html`.
