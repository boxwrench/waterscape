# Third-party notices

Clearwater's original source, optical design and embedded seabed texture are by Aurélien / Lumaris, copyright 2026 Lumaris, distributed under the MIT license in `LICENSE`. The original application remains in Git history; the unmodified extracted seabed image used by both applications is `renderer/assets/seabed.jpg`.

The compiler and runtime in `vendor/cuda-webshader/` are from SamG-Coder/cuda-webshader, copyright 2026 SamG-Coder and CUDA WebShader contributors. Their MIT license is included in that directory. Snapshot commit: `9011955806cee30636ba24ae34b22d218e84196f`. Only modules reachable from the browser entry are retained; the retained module implementations are unchanged.

`data/*/terrain.bin.gz` is derived from USGS National Map 3D Elevation Program (3DEP) elevation data, a U.S. Government work in the public domain. Source: https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer (see `data/*/terrain.json` and `pipeline/build.py`). Credit: U.S. Geological Survey.

Playwright is a development dependency used for browser validation and is not shipped to the browser.

## three.js

`vendor/three/` is three.js r186 (https://github.com/mrdoob/three.js), MIT License,
Copyright © 2010-2025 three.js authors; see `vendor/three/LICENSE`. The sky model in
`renderer/clearwater.cu` (`sky()`) is ported from three.js's `SkyMesh` (MIT), itself based
on Preetham et al. 1999 and the work of Simon Wallner, Martin Upitis and zz85.
