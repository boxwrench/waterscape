# Third-party notices

Clearwater's original source, optical design and embedded seabed texture are by Aurélien / Lumaris, copyright 2026 Lumaris, distributed under the MIT license in `LICENSE`. The original application remains in Git history; the unmodified extracted seabed image used by both applications is `assets/seabed.jpg`.

The compiler and runtime in `vendor/cuda-webshader/` are from SamG-Coder/cuda-webshader, copyright 2026 SamG-Coder and CUDA WebShader contributors. Their MIT license is included in that directory. Snapshot commit: `9011955806cee30636ba24ae34b22d218e84196f`. Only modules reachable from the browser entry are retained; the retained module implementations are unchanged.

`assets/calaveras-terrain.bin.gz` is derived from USGS National Map 3D Elevation Program (3DEP) elevation data, a U.S. Government work in the public domain. Source: https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer (see `assets/calaveras-terrain.json` and `scripts/build-terrain.py`). Credit: U.S. Geological Survey.

Playwright is a development dependency used for browser validation and is not shipped to the browser.
