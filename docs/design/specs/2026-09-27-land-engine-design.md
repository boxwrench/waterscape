# Waterscape — land engine (three.js land, CUDA water) — design

Date: 2026-09-27 · Status: approved in conversation, pending spec review
Supersedes: sub-project 2 (near-field land) of `2026-09-26-land-and-scene-design.md`, and the
time-of-day part of its sub-project 3. That spec's sub-project 1 (quality tiers, shipped) and
its other scene controls (season, wind/waves, water clarity) still stand.
Parent constraints still bind (`2026-09-26-waterscape-design.md`): public government data,
static hosting, no external browser imports, visuals first class, the journey never blocks
on 3D.

## Goal

Land that holds up from knee height to the horizon — grass that moves in the breeze, real
oak trees, a realistic sky with clouds and sun — without flat, low-quality texture anywhere.
It must render every reservoir from data, so new "waterscapes" are bundles, not code.

| Question | Decision |
|---|---|
| Land renderer | three.js `WebGPURenderer` (vendored, MIT) for terrain, ground, grass, oaks and sky, on the **same GPUDevice** as the CUDA WebShader runtime. The CUDA renderer keeps the water. Reverses the earlier "no second renderer" decision. |
| Lighting | Three hand-tuned presets — Morning, Midday, Golden hour — shared by all reservoirs; not a continuous time-of-day slider. |
| Sky | Physically based sky with a drifting 2D cloud layer; clouds cast moving shadows on land and water. |
| Grass | Real blades at knee height (camera down to ~1.6 m above ground). |
| Vegetation placement | Procedural from terrain now; one `density(x, z)` function a per-bundle land-cover map can replace later. |
| Scope of "engine" | Data-driven for any reservoir; build only the California oak-woodland biome now (Calaveras, San Antonio). New biomes = new shared assets, no engine code. |
| Voxel oaks | Dropped (branch `voxel-oaks` is not merged). |
| Native Windows host | Keeps today's ray-marched land, frozen; it is a development tool. |
| GPUs | Any WebGPU GPU (NVIDIA, AMD, Intel, Apple); browsers without WebGPU or float32 filtering keep the video tier. |

## Evidence (spike, 2026-09-27, throwaway, not committed)

`spike/land/` in the `voxel-oaks` worktree: three.js r186 on the runtime's device
(`renderer.backend.device === rt.device`), 3 km lidar mesh + 16 km skirt, 220k instanced
blades with TSL wind, ez-tree oaks instanced, `SkyMesh` with clouds. GPU time per frame
(submit → `onSubmittedWorkDone`), 1280×800, overlook / 20 m / knee:

| Configuration | NVIDIA Blackwell | Intel Xe-LPG |
|---|---|---|
| 922 full-mesh oaks to 450 m, 2048 shadows, 220k grass | 5.9 / 5.7 / 5.9 ms | 49 / 55 / 100 ms |
| Full-mesh oaks within 150 m | — | 23 / 15 / 14 ms |
| + no shadow map, 80k grass | — | 10.5 / 9.1 / 8.6 ms |

Visual findings: near grass and oaks read as real; flat untextured ground beyond the grass
disk, leafless distant oaks (alpha-tested leaves vanish in mips), a hard grass-disk edge and
European-looking ez-tree oaks are the defects this design addresses. Water compositing was
not tested in the spike.

## Architecture

One frame, one device:

1. **Land pass (three.js)** renders terrain, ground, grass, oaks and sky into an HDR colour
   target and a depth target, from the same camera as the water (yaw/pitch/position mapped
   from `state`; three's camera looks down −z, `rotation.order = "YXZ"`, `rotation.y = −yaw`).
2. **Water pass (CUDA → WGSL)**: `render_water` no longer shades land. Per pixel it reads
   land depth and colour; if the water surface is nearer than the land it shades water
   (refraction samples land colour near the shore, the bed as today) and writes it,
   otherwise it keeps the land colour. Reflections: high tier samples a low-resolution
   mirrored land render from three.js (planar reflection about y = 0); medium and low trace
   today's cheap ray-marched terrain plus the preset's sky.
3. **Post** (existing bloom, glare, present) runs on the combined HDR image.

Interop: our buffers and three's textures share a device; data moves by
`copyTextureToBuffer`/`copyBufferToTexture` in the same command stream, never through the
CPU (the zero-readback rule stands). If binding three's depth texture directly to a
WebShader kernel proves simpler, prefer it.

## Modules (`renderer/land/`)

| Module | Responsibility | Depends on |
|---|---|---|
| `scene.js` | Builds the land for a bundle + land profile; owns three's renderer, scene and camera sync; exposes `render(state, tier)` and the colour/depth targets | all below |
| `terrain-mesh.js` | Lidar terrain as camera-centred rings (≈5 m spacing near, coarser far), rebuilt/shifted as the camera moves; sunk skirt to hide seams | `renderer/terrain.js` |
| `ground.js` | Ground material: four CC0 photo sets (green grass, dry grass, bare soil, rock) blended by slope, curvature/valley channel, aspect, season and noise, with stochastic anti-tiling; fades to a matched average colour with distance so far hills are neither flat nor aliased | textures in `data/shared/ground/` |
| `grass.js` | Instanced tapered blades (≈4 segments) in a camera-following field; per-blade height/width/tint, wind = rolling gust bands + swell + flutter from shared wind uniforms; density and height thin toward the field edge into the ground material's grass colour | `vegetation.js`, `presets.js` |
| `oaks.js` | Oak variant library: full meshes (branches + leaf cards) within the tier's near range, **octahedral impostors** beyond; instanced per variant; cast/receive shadows | assets in `data/shared/trees/`, `vegetation.js` |
| `vegetation.js` | `density(x, z)` and `species(x, z)` from terrain (valley, north-facing, steep, grove noise, shore distance) × profile multipliers; the single seam for a future land-cover map | land profile |
| `sky.js` | Physically based sky (`SkyMesh`) with drifting clouds; a cloud-shadow texture (same cloud field projected along the sun) applied to ground, grass, oaks and water | `presets.js` |
| `presets.js` | Named presets: sun direction and colour, sky parameters, exposure, fog/haze, ambient, water tint and absorption | — |

`renderer/explore.js` owns the loop: governor → `scene.render` → water/post kernels. Journey
and explore pages gain a preset picker (Morning / Midday / Golden hour).

## Data

- `data/shared/manifest.json` lists shared assets with sizes, dimensions and CC0/MIT sources.
  - `ground/` — four texture sets (albedo + normal/height), a few MB total.
  - `trees/` — oak variants: GLB (branches + leaves) and impostor atlases, baked offline by
    `pipeline/bake-oaks.mjs` from ez-tree presets tuned toward coast live, blue and valley
    oaks (wide, rounded, dense crowns; 8–14 m).
- `data/<id>/land.json` (new, per bundle):
  ```json
  {
    "biome": "oak-woodland",
    "vegetation": { "density": 1.0, "species": { "coast-live": 0.5, "blue": 0.3, "valley": 0.2 } },
    "grass": { "spring": "green", "summer": "gold" },
    "presets": ["morning", "midday", "golden"],
    "defaultPreset": "golden"
  }
  ```
- `pipeline/validate-bundles.mjs` checks every `land.json` (biome known, species and presets
  exist in the shared manifest) and the shared manifest's files. `data/shared` is not a
  bundle.
- three.js is vendored under `vendor/three/` (build files + LICENSE); addons we use
  (`SkyMesh`) are copied into `renderer/land/` with relative imports, since the build
  rejects bare imports.

## Quality tiers

The existing ladder (tier × width) and governor stay. Land settings per tier:

| | High (2) | Medium (1) | Low (0) |
|---|---|---|---|
| Grass | ~220k blades, 60 m | ~120k, 40 m | ~60k, 25 m |
| Full-mesh oaks | 250 m | 150 m | 80 m |
| Sun shadow map | 2048 | 1024 | none |
| Cloud shadows | yes | yes | yes |
| Land in reflections | mirror render | ray-marched | ray-marched |

Budgets unchanged: low ≤ 33 ms/frame at 768 px on Intel Xe-LPG; high is the NVIDIA
showcase. Numbers above are starting points, tuned in sub-project 4.

## Sub-projects (each its own plan, each shippable)

1. **Foundation** — vendored three.js; shared device; terrain mesh; land/water composite
   with depth; sky + the three presets and picker; ground ported from today's procedural
   terrain shading (grass tones, gust bands, bank ring, oak canopy tint) so nothing regresses.
   Done when: explore and journey look at least as good as today at equal or better frame
   time per tier, zero readbacks, all checks green.
2. **Ground and grass** — `ground.js` materials and the camera-following grass field.
3. **Oaks** — tuned variants, bake script, impostors, `vegetation.js` placement.
4. **Cloud shadows and tuning** — cloud-shadow texture, per-tier tuning on Intel/NVIDIA,
   flyover videos and posters re-rendered.

## Testing (proportionate)

- Existing suite stays green; `verify.mjs` adds: shared device true; land ready; per-tier
  frame budget on Intel (low ≤ 33 ms at 768 px); zero readbacks.
- `validate-bundles` covers `land.json` and the shared manifest.
- Visual review each sub-project: screenshots at knee (≈1.6 m), 20 m and overlook for each
  preset, compared before/after — up close first.

## Out of scope

Real land-cover data (slot only); biomes beyond oak woodland; the native host's land;
water level by month (parent spec); season, wind/waves and clarity controls (earlier
spec's sub-project 3, unchanged).
