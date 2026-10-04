# Eel / Scotia Bluffs — bluff and forest review, RP20

RP17's form baseline remains accepted. This bounded surface/forest pass awaits
human visual review; it is still below the Russian River/reservoir visual benchmark.
The scene retains the five v1 camera positions, native 14.05 m terrain elevations,
water geometry and California CalWater inset. No fine LiDAR, observed vegetation
inventory, bathymetry or hydraulic state was added.

## Reference and authored detail

Ellin Beltz's licensed [Scotia Bluffs photograph](https://commons.wikimedia.org/wiki/File:Scotia_Bluffs_Railroad_Bridge_2016.jpg)
was inspected again. Its irregular crown silhouette, overlapping conifers and
exposed, weathered faces guide this pass. Different season/viewpoint prevents a
pixel-matched photographic reconstruction. Aligned archival NAIP supplies a
dark-green cover heuristic; it is not a species or surveyed-tree product.

Seed 17041 fixes jittered sites, estimated heights, crown mix and color variation.
Sites exclude the mapped river footprint, steep terrain and camera clearances.
The generic mix of conifer and broad crowns is Setting. Nearby visible conifers
use unchanged ez-tree branch/needle geometry. Other crowns use the reservoir's
eight-angle tree color/normal atlas, fitted to their recorded heights and rotated
toward the fixed camera. Rock multiscale grain, shallow bump, weathering and modest
bedding cues are authored shading; no terrain vertex is displaced or carved.
`setting.json` records assets, MIT license and the scientific/Setting distinction.

Landscape study exposes **Environment pass** in the collapsed Review tools panel:
current detail versus original form baseline. Plain Form excludes authored rock
and vegetation, and Source aerial retains the photo mosaic on the geographic mesh.
California's actual watershed geometry stays available through its visible button
and Evidence. Neither source mode nor the photograph is presented as modeled detail.

## Actual iteration and critique

The original rendered bluff had a smooth green cap and blurred bare patches.
The initial forest used simple ragged cones; actual primary renders looked like
regular toy trees and produced an excessive triangle count. Baked atlas silhouettes
replaced those distant cones. A second render exposed dark, unlit silhouettes.
Lighting from the existing normal atlas, restrained desaturation and mixed crowns
made the forest less uniform. Low views then exposed overly dark nearby conifers;
their constant needle/bark tints were brightened after the cost sample, without
changing shader complexity, geometry, source textures or counts. Final frames
include that palette correction. Detailed mesh allocation was narrowed to forward
near-camera trees instead of wasting it behind and beside the view.

The result breaks the skyline and replaces painted cover with tree silhouettes.
Bare faces have more grain and weathering without changing the accepted geographic
shape. Still weak: broad cliff forms are smooth at 14 m; tree shapes and regular
scatter can read as procedural; close water remains an undulating DEM proxy,
bridge crossings interrupt its classification, and modeled rail/road structures
and foreground stone/grass contact are absent. Lighting/sky and the finite DEM
extent remain future passes. This surface pass does not solve those limitations.

## Runtime evidence and measured cost

Actual screenshots and raw measurement text are in `previews/eel/rp20/`.
The `before-*` images preserve the earlier running implementation. Initial
iteration images retain the visible unsuccessful tree treatments. Final paired
baseline/detail images use the same v1 primary camera and presentation; the
baseline selector faithfully retains the earlier material, not a fabricated defect.
Measurements warm up 12 frames and sample 120 with highlights paused.

Paired final samples used the same primary camera, 980 × 876 viewport, WebGPU,
DPR approximately 1.0, paused highlights, 12 warmup frames and 120 measured frames.
Both retained all assets. Raw text: `paired-baseline-cost.txt` and
`paired-detail-cost.txt`.

| Metric | Original material | Bluff/forest detail |
| --- | ---: | ---: |
| Rendered triangles | 305,292 | 1,261,548 |
| Draw calls | 3 | 8 |
| CPU geometry/instance buffers, both passes resident | 17.94 MiB | 17.94 MiB |
| CPU submission p50 / p95 | 0.43 / 0.73 ms | 0.41 / 0.68 ms |
| Frame interval p50 / p95 in this session | 33.48 / 1016.35 ms | 16.75 / 66.48 ms |
| First frame, same loaded page | 444 ms | 444 ms |
| Six texture RGBA + mip estimate, all resident | 44.3 MiB | 44.3 MiB |

The detailed primary view adds 956,256 triangles and five draw calls. Most distant
trees cost two triangles each; at this camera 96 forward trees within 450 m use
branch/needle geometry. The 77,328 generated sites are an authored render count,
not an observed tree inventory. The original RP17 page held 10.62 MiB CPU geometry
and an estimated 12 MiB source texture; this pass increases those resident budgets
by approximately 7.32 MiB and 32.3 MiB. Similar CPU timings do not establish equal
GPU cost or a speedup. Different pacing prevents an FPS comparison.

Frame pacing varies with automation/occlusion and competing browser work. CPU
submission timing is separate from GPU execution; do not infer foreground FPS.
Geometry bytes include retained baseline/detail CPU buffers and instance arrays.
Texture figures estimate RGBA with mipmaps; GPU memory/time and total browser
memory remain unmeasured. Source imagery and normal/color atlases are resident
even while the baseline is selected, so its resident byte figure differs from
the original RP17 page. First-frame time is a warm local load, not cold deployment.

## Verification

All five fixed cameras were rendered and visually inspected at 980×876 desktop
and 390×844 phone after the final palette correction. Baseline/detail, plain Form,
Source aerial, Evidence open/close, California inset and highlight pause/resume
were exercised. Phone camera targets are 44 px high; document width stays 390 px.
Final browser error log is empty. The [actual comparison gallery](../../previews/eel/rp20/review.html)
loads all ten images. Phone Evidence was recaptured after its opening transition;
its state outline and credits are visible in the preserved image.

Seven focused geometry/source/Setting tests pass, river packages validate, and
`npm run test:build` validates all assets with 119 browser modules. Diff whitespace
check passes. Work is saved locally; no push or merge.

## Acceptance point

Awaiting human review of this bluff/forest pass. The next focused visual problem is
shoreline and convincing close water, with geographic extent/structures addressed
separately. New detail should continue to be compared from these cameras.
