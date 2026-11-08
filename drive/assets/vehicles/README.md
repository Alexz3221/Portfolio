# Vehicle model provenance

These are authored, generic low-poly vehicle meshes from **Kenney Car Kit 3.1**, not manufacturer-approved replicas or photorealistic licensed car brands.

- Author/distributor: Kenney (https://kenney.nl)
- Official pack: https://kenney.nl/assets/car-kit
- Author's mirror/listing: https://opengameart.org/content/car-kit
- Download: https://opengameart.org/sites/default/files/kenney_car-kit_3.1.zip
- Retrieved: 2026-11-08
- Archive SHA-256: `fac7dacac5c7874348cf19729af3ef205f3d366493edaf0a827d93f4fdf3d0c4`
- License: Creative Commons Zero 1.0, https://creativecommons.org/publicdomain/zero/1.0/
- Original archive license retained unmodified in `LICENSE-Kenney.txt`. It expressly allows personal, educational, and commercial use. CC0 permits redistribution and modification; attribution is appreciated but not mandatory. No brand/trademark rights are claimed.

## Selected assets

| Game option | Source asset | Bytes |
| --- | --- | ---: |
| Comet | `sedan-sports.glb` | 177676 |
| Rally | `hatchback-sports.glb` | 197804 |
| Pickup | `truck-flat.glb` | 207424 |
| Hypercar | `race-future.glb` | 173164 |

The four GLBs and the shared 12,371-byte palette texture total 768,439 bytes (about 750 KiB), before HTTP compression. All files are original, unmodified source assets. Only these four vehicles and their shared palette ship, rather than the complete pack. They contain no animations or external remote dependencies. The GLBs refer to the relative `Textures/colormap.png` file. Models should load on demand, cache for repeated selections, and leave a usable fallback if a request fails.

## Integration notes

Models face +Z with +Y up. Each has a `body` node; Comet's spoiler is a child of its body. The four wheel nodes are named `wheel-front-left`, `wheel-front-right`, `wheel-back-left`, and `wheel-back-right`. Wheel radius is 0.3 source units and axle is X. The node origin is near the inner face, not the tire center: center a detached wheel's geometry before placing on a physics pivot. Preserve the palette material when splitting the nodes.

`manifest.json` records source hashes, triangle counts, and local mesh bounds plus node translations for reproducible validation and alignment. Bounds describe source coordinates, not physics chassis dimensions. Visual scale/translation needs to be aligned to each chassis and wheelbase at runtime.
