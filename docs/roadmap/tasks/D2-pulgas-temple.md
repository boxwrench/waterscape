# D2: Pulgas Water Temple in the Crystal Springs scene

**Who:** capable · **Needs:** the Crystal Springs bundle (W2), the maintainer's temple model
([boxwrench/water_temple](https://github.com/boxwrench/water_temple), `lod/Pulgas-Water-Temple-lod86k-s90.blend`),
the measurements already sourced for the Minecraft world (MC7) · **Branch:** `task/D2-pulgas-temple`

## Goal

The Pulgas Water Temple, the Hetch Hetchy Aqueduct's 1934 terminus, in the browser's Crystal
Springs scene, **at its true place and scale**: the maintainer's model of the temple, its
reflecting pool lined with Italian cypress, the paved forecourt with lavender beds, and the canal
behind it to Upper Crystal Springs Reservoir. Unlike the Minecraft world (MC7), nothing is
enlarged or moved.

## Stop rules

- Every measured number has a source URL in `data/crystal_springs/structures.json`.
- Do not edit `vendor/`, `renderer/water.cu` or `renderer/engine/waterscape.js`. The kernel's
  distant tree crowns (beyond the impostor range) therefore still cover the clearing; say so.
- Browser code has relative imports only. The model is converted offline (Blender), not loaded
  as glTF in the browser.

## Steps

1. **Mesh:** `pipeline/structure_mesh.py` (run inside Blender) converts the model to a compact
   gzip mesh in `data/crystal_springs/` (quantised positions, normals, a material index and baked
   ambient occlusion per vertex), at 13.2 m per model unit (the landing's terracotta ring measured
   on NAIP, as in MC7).
2. **Data:** `structures.json` with a `landmarks` entry: the temple centre, the pool axis and size,
   cypress rows, forecourt and the canal line traced on NAIP, with sources; `land.json`
   `structures: true`; a "Pulgas Water Temple" viewpoint in place of South ridge (the `ridge`
   slot in `cameras.json` and `source.json`; the maintainer's choice).
3. **Renderer:** `renderer/land/landmarks.js` draws the temple mesh (lit like the dams), the pool,
   the coping and paving, lavender beds, the cypress and the canal; `renderer/land/clearings.js`
   keeps oak meshes, impostors and grass out of the grounds.
4. **Checks:** validate the new fields in `pipeline/validate-bundles.mjs` with tests; before and
   after renders from fixed cameras (from the pool, overview, eye level at the temple, the canal);
   the maintainer's look.

## Fixed cameras (scene metres, yaw and pitch in radians; version 1)

| Name | x, y, z, yaw, pitch |
|---|---|
| Pool | 3224, 9.5, 3193, -1.85, -0.02 |
| Overview | 3260, 60, 3250, -1.2, -0.35 |
| Temple | 3184, 8.6, 3204, -1.85, 0.12 |
| Canal | 3120, 9, 3225, 1.29, -0.05 |

## Result
- Status: done; the maintainer's look pending.
- Commit: see the branch (this Result is in the same commit).
- Checks:
  - `node --test "pipeline/tests/*.test.mjs"` → `ℹ pass 189`, `ℹ fail 0` (three new landmark tests);
  - `node pipeline/validate-bundles.mjs` → `Bundles valid.`;
  - `npm run build` → `Built Pages with 137 browser modules, shared CUDA source and licensed assets.`
    (the mesh ships in `data/crystal_springs/`); `npm run test:build` → `Built experience pages and river assets valid.`;
  - `node scripts/check-doc-links.mjs` → `Documentation links valid (144 Markdown files).`;
  - before and after renders from the four fixed cameras in Chrome with WebGPU (Edge, which
    `npm test` uses, is not installed here, so the full browser suite was not run); Calaveras,
    Hetch Hetchy and San Antonio still load with no errors.
- Notes:
  - Mesh: 86,046 triangles, 118,868 vertices, 978 KB gzip; 8,710 of the model's corner normals
    pointed against their faces and are turned in the conversion.
  - The temple sits on the bundle's ground at its centre (3DEP there is 94.2 m; the 10 m grid
    is about 0.4 m lower), the pool and paving on the highest ground under them, with skirts.
  - The kernel's distant crowns (beyond the 1.5 km impostor range) still cover the grounds;
    clearing them needs `pipeline/build.py` to mark the landmark's footprint (as it does for
    dams) and the bundle rebuilt, which re-fetches the terrain.
  - Cypress shapes and heights, lavender, paving and the stone colours are illustrative; the
    canal runs a little above the 10 m ground, which cannot hold its cut.

## Reflections (maintainer's request after the first look)

The pool now mirrors the scene: three.js's planar reflector (`reflector()` in the vendored
three.js, full resolution, colour lightly rippled, depth unrippled so geometry and sky part
cleanly), blended with the turquoise basin by water's Fresnel term; empty mirror pixels show a
sky graded from the preset's fill colour. The land pass's hidden canvas is now sized with its
render target, since the reflector sizes its own target from the canvas (it had been the
default 300 × 150, which made the mirror blocky). The mirror renders only within 500 m and above
the lowest quality tier. Measured here (RDNA4, high tier): 59.8 fps at the pool with the mirror,
59.6 without, at the 60 fps cap; Calaveras and Hetch Hetchy unchanged, no errors.
