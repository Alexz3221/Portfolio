# Car Go Vroom garage models

| Game model | Source and license | Changes |
| --- | --- | --- |
| DeLorean DMC-12 | [Delorean-dmc-12 by cadwalader](https://sketchfab.com/3d-models/delorean-dmc-12-6d5569d1bb8648beb744e88a99f36752), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). [Sketchfab metadata](https://api.sketchfab.com/v3/models/6d5569d1bb8648beb744e88a99f36752) and [Objaverse archive](https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-100/6d5569d1bb8648beb744e88a99f36752.glb). | Retains all 117,341 car triangles from the archived GLB along with its 1K window, lamp, plate, and rim maps. The showroom floor was removed and the four original wheel assemblies were fitted to separate pivots. Braking brightens the existing red taillight cells through their source emissive texture. The body uses the garage's reflection lighting. |
| Rally | [Rally Car by tevy](https://tevy.dev/models/rally-car), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). | Converted the 17,770-triangle LOD1 to standard glTF geometry and PNG textures. Preserved the sponsor-free blue livery, gravel tires, and four hood lamps. |
| Pickup | [Pickup Truck Armored by Quaternius](https://poly.pizza/m/RUwMItmU4B), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). | Separated the rear axle into two animated wheels and added brake lenses beside the tailgate. Preserved the reinforced body, bed, fenders, and protective plow. |

The three models were fitted to the existing garage chassis and use the original driving parameters. The DeLorean replaces the appearance of the internal `hypercar` slot.

The Pickup uses exposed steel and oxidized patches, with cyan cage accents and lime safety stripes picked from its original palette. Rally keeps its livery with a lighter satin finish and traces of wear. Both pick up soft reflections from the same light map used by the Comet.

`rust-detail.webp` packs the color and roughness maps from [Rust Coarse 01 by Dimitrios Savva and Rico Cilliers](https://polyhaven.com/a/rust_coarse_01), released under [CC0](https://polyhaven.com/license). The 1K maps were resized to 512 × 512 and packed as color in RGB and roughness in alpha. The garage shaders sample it in chassis space and blend it with a procedural wear mask.

## Source files

- [Objaverse mirror of JandroS’s Sketchfab GLB](https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-158/7001f739fe594314b5a3081163577139.glb). SHA-256 `286932df77d89c440a78fc1b1c0d00af4210beba8a747094fe098fb81ddaa5c4`.
- [Pinned tevy Rally Car v1 LOD1](https://tevy.dev/models/rally-car/v1/lod1.glb). SHA-256 `40b963744bb7e3adc7e759b0e7146a21a1764237c8ac3506baba22afeff9b369`.
- [Quaternius asset downloaded from Poly Pizza](https://static.poly.pizza/cc992b7f-3e7f-474e-8e45-f80b72010669.glb). SHA-256 `38f1cae38a5302cf702edd2c7459bdf104b17ec2fdbc8465330c1a6b99b4375b`.
