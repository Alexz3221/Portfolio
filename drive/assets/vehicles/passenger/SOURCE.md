# Generic passenger car pack

This work is based on **“Generic passenger car pack”** by **Comrade1280**, licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.

- Original model: https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5
- Creator: https://sketchfab.com/comrade1280
- License: https://creativecommons.org/licenses/by/4.0/
- Original supplied credit and license notice: [LICENSE.txt](LICENSE.txt)

The user supplied the original Sketchfab glTF download (`generic_passenger_car_pack.zip`, SHA-256 `a2d97d1a437d1e6dd6f02c4b0d879b7ccdac28993b056bd4b99896476dd96d4a`). No viewer extraction or substitute asset was used.

## Included cars and modifications

Four cars from the ten-car pack fit the playground's existing four vehicle slots:

| Playground slot | Source model | Source triangles |
| --- | --- | ---: |
| Comet | Coupe | 6,022 |
| Rally | Hatchback | 6,808 |
| Pickup | Pickup | 6,918 |
| Hypercar | Sport | 6,268 |

Original modeled body panels, wheels, glazing, optics and UVs are retained. Export transforms are baked, each car is centered between its axles, and all cars face +Z with +Y up. Uniform scale sets car lengths to 5.2, 4.85, 5.7 and 5.0 metres respectively, preserving natural proportions. Four separate wheel nodes are named by axle and side; their geometry is centered around their own pivots. Left corresponds to positive X in this game's convention.

Only selected cars and their referenced materials/textures are included. Textures are capped at 1024 pixels per side. Base colors use JPEG quality 88; packed roughness/metallic maps remain lossless PNG. Authored rear red lamp triangles are assigned a separate `BrakeLens` material using the same original color texture and a low emissive value, allowing runtime brake illumination without adding detached geometry. Triangle count is unchanged. At runtime, glazing is made opaque and dark to hide sparse source interiors and avoid transparent sorting artifacts. Brake lens emissive intensity increases while braking.

Each GLB is self-contained. `manifest.json` records final file hashes, byte counts, dimensions, triangle counts and per-wheel positions/radii/widths. The original pack contains additional cars and color variants that are not bundled here.

## Reproduction

With Python 3, NumPy and Pillow installed, run:

```
python drive/scripts/convert-passenger-pack.py /path/to/extracted-pack drive/assets/vehicles/passenger
```

The script consumes the original `scene.gltf`, `scene.bin`, `textures/` and `license.txt`; it makes no network requests. The original ZIP is not committed to the repository.
