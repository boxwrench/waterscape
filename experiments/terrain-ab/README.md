# Hetch Hetchy terrain A/B (experimental)

This is a reproducible **source-level prototype**, not a performance-validated release. It has not been run on a physical GPU in this environment (npm registry installation was unavailable).

The scene uses Waterscape's checked-in 3DEP Hetch Hetchy elevation and signed shoreline channels, with a 2,048m square crop near O'Shaughnessy Dam. The A side is a conventional Three.js terrain mesh. The B side invokes the actual MIT-licensed ZyFou Procedural Terrains v2.0.0 heightmap runtime with the **same 257 × 257 elevation samples**; procedural height noise is disabled.

Both scenes share a shoreline-masked, illustrative water surface and an identical dam mesh: crest and elevation from data/hetch_hetchy/structures.json, swept generic gravity cross-section from renderer/land/structures.js, and three simplified side-spillway gate blocks. These are not engineering as-built geometry. The full WebGPU/TSL spillway and outlet jets are **not** ported into this WebGL2 comparison. Underwater depths are not surveyed bathymetry; both sides use Waterscape's existing schematic 1:3 underwater bank (capped at 30m).

## Run

From this folder, run:

    npm install
    npm run dev

Open http://127.0.0.1:5176/experiments/terrain-ab/

The dev server uses the repository root and serves its real data files; no invented terrain and no duplicate large files are committed.

Switch between side-by-side synchronized camera mode and A-only/B-only mode. Use **solo** mode for performance measurement; split mode renders both canvases simultaneously and cannot be used to compare isolated GPU frame rates.

## What to evaluate

Compare the same camera angles, shoreline intersections, dam abutment, mountain silhouettes, mesh/LOD transitions, compilation time, draw calls, memory, and perceived quality. Benchmark on the intended hardware before drawing conclusions.

The upstream 2.0.0 runtime requires WebGL2 and a Three.js ~0.185.1 peer. This experiment keeps dependencies separate from Waterscape's production Three.js/WebGPU renderer.

Unvalidated: end-to-end browser launch, texture/shader compatibility on the target AMD drivers, and GPU/CPU frame times. Treat this branch as the first implementation candidate, not an accepted visual improvement.
