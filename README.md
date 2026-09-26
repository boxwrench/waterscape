# Calaveras Reservoir — CUDA/WebGPU water study

A local, interactive study of Calaveras Reservoir at **37°28′42.5″N, 121°49′21.5″W**, built from [SamG-Coder's CUDA Clearwater reimplementation](https://github.com/SamG-Coder/clearwater) and the original [Clearwater](https://github.com/Aureliengmz/clearwater) optical design.

The terrain is the real ground: a ~9 × 11 km crop of [USGS 3D Elevation Program](https://www.usgs.gov/3d-elevation-program) lidar (public domain) at ~10 m, with the reservoir outline taken from the lidar's flattened water surface. Oak woodland follows the real drainages, grass moves with travelling wind gusts, and the three-scale FFT water, interactive ripples, caustics and CUDA-authored post-processing are unchanged. The interface reads out camera, ground and cursor elevation above sea level, and the camera's latitude/longitude, from the same data.

![Calaveras Reservoir](previews/calaveras-ui.png)

All simulation and image formation lives in [`src/clearwater.cu`](src/clearwater.cu). The browser executes it through [cuda-webshader](https://github.com/SamG-Coder/cuda-webshader): CUDA source → generated WGSL → WebGPU. JavaScript handles controls, resources, dispatch and presentation. There is no WebGL, Three.js, handwritten WGSL, CPU wave simulation or CPU FFT.

## Run locally

Requires Node.js 20+ and a WebGPU-capable browser.

On Windows, double-click **`START.bat`**. It starts the local server and opens the experience. To run it manually:

```powershell
npm ci
npm start
```

Open **http://localhost:5173**.

- Choose **Overlook** for the Calaveras Road composition or **Shoreline** for the shallow-water view.
- Switch between the March-inspired **Spring green** palette and **Summer gold**.
- Drag or use arrow keys to look. WASD flies, E rises and Q descends.
- Scroll changes travel speed; Shift provides a temporary 6× boost. Speed also scales with height above the ground (1× below 25 m, 20× at 500 m), so climbing with E is the fast way across the basin.
- Click nearby water to create ripples. Space pauses and H hides the controls.
- Adjust wave energy, basin depth, exposure, resolution, diagnostics and lens glare.
- PNG exports the current frame. `?t=5` starts at a fixed wave time.

## CUDA pipeline

| Stage | Implementation |
|---|---|
| Spectrum | Seeded Gaussian complex coefficients, directional spectral bumps and GPU RMS slope normalization |
| Reservoir surface | Three independently seeded 256² cascades spanning 4.6 m, 37 m and 293 m, clipped by an irregular shoreline |
| Terrain | Ray-traced procedural near bank plus a world-oriented ridge layer for stable distant hills and reflections |
| Materials | Spring/summer grass, exposed shoreline, sediment, clustered oak shading and distance haze |
| Interaction | 256² camera-relative ripple field, 16 m wide, fixed 120 Hz wave equation |
| Caustics | 1024² refracted rays, three refractive indices, fixed-point splats into a 512² RGB field |
| Water optics | Fresnel reflection, Snell refraction, Beer–Lambert extinction, underwater scattering and pebble/sediment seabed |
| Lens/output | Diffraction, bloom, filmic tone curve and direct GPU-buffer-to-canvas copy |

The normal frame loop performs **zero GPU-to-CPU readbacks**. Explicit inspection and PNG export read data back on request. The compiler/runtime graph is vendored; no runtime CDN is needed.

## Verification

In one terminal:

```powershell
$env:PORT='5186'
npm start
```

In another:

```powershell
npm run check
npm test
```

The suite compiles all 20 CUDA entries and launches Microsoft Edge through Playwright. It checks FFT correctness, optical energy, finite buffers, zero render-loop readbacks, ripple interaction, viewpoint/reset behavior, seasonal controls, resizing, diagnostics, PNG export and reservoir classification. Latest evidence is in [`previews/verification.json`](previews/verification.json).

## Scope and tradeoffs

Landforms, shoreline and elevations come from USGS 3DEP lidar; everything finer than the ~10 m grid (grass, oaks, bank detail, sub-grid relief) is procedural. Lidar flattens water, so the reservoir bed is modelled as banks falling at about 1:3 to the interface's basin depth. The water level is the level at the time of the lidar survey (≈224 m). Outside the ~9 × 11 km crop, the land falls away under painted, hazy far ridges.

`python scripts/build-terrain.py` regenerates `assets/calaveras-terrain.bin.gz` and its `.json` metadata from the USGS service (needs numpy, scipy, Pillow). The shader's `TERRAIN_*` constants are checked against that metadata at startup. `--native` also writes the uncompressed `.bin` the native host loads.

The water is bounded visually while its FFT fields remain periodic underneath. This is a linear spectral height field, not volumetric water; it does not model sediment transport or changing reservoir levels. The distant hills are a directional landscape layer, while nearby banks use the traversable height field. Caustics and the pebble bed are intentionally strongest in the Shoreline view.

The browser and optional native Windows host share `src/clearwater.cu`. The native host remains a developer-oriented compatibility target and requires Windows, CUDA Toolkit 13.x, Visual Studio C++ Build Tools and an NVIDIA GPU.

## Provenance

- Original Clearwater: [Aureliengmz/clearwater](https://github.com/Aureliengmz/clearwater), commit `4bc826134321043a25df3c2b6fed16fb7b9241e8`, MIT, copyright 2026 Lumaris.
- CUDA reimplementation: [SamG-Coder/clearwater](https://github.com/SamG-Coder/clearwater), MIT.
- Pebble image: extracted without modification from the original embedded asset into `assets/seabed.jpg`.
- CUDA WebShader: vendored compiler and runtime, MIT; license at `vendor/cuda-webshader/LICENSE`.
- Terrain: USGS National Map 3D Elevation Program (3DEP), public domain, fetched from the [3DEPElevation ImageServer](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer) by `scripts/build-terrain.py`.
- Original design references: Tessendorf (FFT water), Evan Wallace (refracted-grid caustics), Inigo Quilez (texture repetition), Olano & Baker (LEAN Mapping).

The original license is retained in [`LICENSE`](LICENSE), with additional notices in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
