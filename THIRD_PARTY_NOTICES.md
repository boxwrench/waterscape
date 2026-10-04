# Third-party notices

Clearwater's original source, optical design and embedded seabed texture are by Aurélien / Lumaris, copyright 2026 Lumaris, distributed under the MIT license in `LICENSE`. The original application remains in Git history; the unmodified extracted seabed image used by both applications is `renderer/assets/seabed.jpg`.

The compiler and runtime in `vendor/cuda-webshader/` are from SamG-Coder/cuda-webshader, copyright 2026 SamG-Coder and CUDA WebShader contributors. Their MIT license is included in that directory. Snapshot commit: `9011955806cee30636ba24ae34b22d218e84196f`. Only modules reachable from the browser entry are retained; the retained module implementations are unchanged.

`data/*/terrain.bin.gz` is derived from USGS National Map 3D Elevation Program (3DEP) elevation data, a U.S. Government work in the public domain. Source: https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer (see `data/*/terrain.json` and `pipeline/build.py`). Credit: U.S. Geological Survey.

Playwright is a development dependency used for browser validation and is not shipped to the browser.

## California river overview

`river-pulse/data/california-overview.json` derives from U.S. Census Bureau TIGERweb
2022 generalized California boundary and USGS 3D Hydrography Program named flowlines.
`california-relief.jpg` is the USGS 3DEP elevation-tinted hillshade export. These federal
datasets are U.S. Government public-domain works. Source requests, retrieval time,
projection and processing notes are preserved in the overview JSON and
`docs/river-pulse/california-overview.md`. The rendering and navigation code are original.

## Sacramento Freeport scene resources

Freeport's bundled terrain and flowlines derive from USGS 3DEP and 3DHP. Its aerial
image is an aligned USGS/USDA NAIP Plus export (public domain); `aerial.json` records
the request, extent and credit. Shared CC0 Hacienda rock maps, original MIT ez-tree
coast-live mesh/leaf/bark assets from `data/biomes/diablo-oak`, and the already credited
MIT Tidewater noise adaptation are reused unchanged. Existing licenses remain applicable.
Freeport reference photos by Dicklyon (CC BY-SA 4.0) and HistoricBridges.org were studied
for composition only; no photo files are redistributed. Source links are recorded in
`river-pulse/data/sacramento_river/places/freeport/setting/references.json`.

## three.js

`vendor/three/` is three.js r186 (https://github.com/mrdoob/three.js), MIT License,
Copyright © 2010-2025 three.js authors; see `vendor/three/LICENSE`. The sky model in
`renderer/water.cu` (`sky()`) is ported from three.js's `SkyMesh` (MIT), itself based
on Preetham et al. 1999 and the work of Simon Wallner, Martin Upitis and zz85.

## Ground textures

`data/biomes/*/ground/` are resized from ambientCG materials (https://ambientcg.com), CC0 1.0
Universal; each biome's `biome.json` records the asset ids and download URLs (Grass004,
Ground109, Rock030 for `diablo-oak`; Ground091, Ground108, Rock034, Rock020, Rock043L and
Rock058 for `sierra-granite`). `data/structures/` holds ambientCG Concrete036, CC0 1.0.

## Fluffy grass

`data/biomes/diablo-oak/grass/fluffy-mask.jpg` is the unmodified `public/grass.jpeg` from
https://github.com/thebenezer/FluffyGrass, snapshot
`34745a1028067e90591bd388df60117edbefa23a`, copyright (c) 2023 Ebenezer, MIT
licence (included in `data/biomes/diablo-oak/grass/LICENSE`). The splayed-card technique in
`renderer/land/grass.js` follows the author's Codrops tutorial:
https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/.

## Hacienda bank materials and conifers

`river-pulse/data/russian_river/places/hacienda_bridge/setting/pebbles-*.jpg` and
`rock-*.jpg` are unmodified 1K JPG maps from Poly Haven's **Ganges River Pebbles** by
Amal Kumar and **Rock Boulder Dry** by Dimitrios Savva (photography) / Rico Cilliers
(processing). CC0 1.0: https://polyhaven.com/license. Source pages:
https://polyhaven.com/a/ganges_river_pebbles and
https://polyhaven.com/a/rock_boulder_dry. The local `materials.json` records individual
map URLs, upstream MD5 hashes and material scales.

The two lightweight Douglas-fir bakes, bark and needle textures in the same directory
are reused unchanged from `data/biomes/peninsula-oak-fir/trees/` at repository commit
`af0bb6c`. Generated with ez-tree 1.1.0 (MIT); its license is included as `LICENSE-ez-tree`.
The `conifers.json` records the source commit and binary part layouts. They are authored
Setting assets, not surveyed Hacienda trees.

RP5 also reuses the unchanged `coast-live-a-far.bin`, `coast-live-b-far.bin`,
`blue-a-far.bin`, `oak-bark.jpg` and `oak-leaf.png` from
`data/biomes/diablo-oak/trees/`. The `broadleaf.json` manifest records the original
variant metadata and ez-tree generation source. They use the included MIT license.
Stone color grading happens in the renderer; the CC0 source JPGs remain unchanged.
Hacienda reference photographs were used for composition only and are not distributed.

## Jenner coastal resources and Tidewater

`river-pulse/renderer/jenner-noise.js` adapts the periodic gradient FBm noise texture
generator from `src/ocean/SeaDetail.js` in https://github.com/dgreenheck/tidewater,
revision `4811ba48d795197de5621985f404e765c0b7c0ef`.
Copyright (c) 2026 DRG Software Solutions LLC, MIT License. The complete license is
included in `river-pulse/data/russian_river/places/jenner/setting/LICENSE-tidewater`.
Jenner's directional swell, breaking foam and swash are independently authored TSL;
Tidewater's FFT renderer and third-party assets are not distributed here.

Jenner reuses the above CC0 Poly Haven bank maps, CC0 ambientCG Grass004 ground color,
MIT FluffyGrass alpha mask and MIT ez-tree broadleaf assets unchanged. The reference
credits and resource/source URLs are recorded in Jenner's `setting/references.json`.
The photographs by Xaven (CC BY-SA 1.0) and BookOfDisquiet (CC BY-SA 4.0) inform the
composition only and are not distributed as assets.
