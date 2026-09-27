# Waterscape — land quality, quality tiers and scene controls — design

Date: 2026-09-26 · Status: approved in conversation, pending spec review
Parent spec: `2026-09-26-waterscape-design.md` (its constraints still bind: public government
data, static hosting, no external browser imports, visuals first class, journey never blocks
on 3D). Water level by month remains that spec's build step 2 and is out of scope here.

## Problem

In live 3D the land looks poor next to the water, mainly **up close**:

- Grass and hills look flat and plastic: one smooth colour, no texture, soil or rock.
- Trees are single smooth ellipsoids: flat discs or blobs near the camera, no trunks, no
  canopy structure.

Visitors should also be able to **change the scene** in 3D (time of day, season, wind and
waves, water clarity). And on a typical laptop the browser picks the integrated GPU, so live
3D runs at ~128 ms/frame and shows "This device is struggling" with no explanation.

## Decisions

| Question | Decision |
|---|---|
| Which land problems | Near-field ground/grass (A) and trees (B). Horizon and lighting mood are not in scope (lighting mood arrives partly through time of day). |
| Which controls | Time of day and season; wind/waves and water clarity. Water level stays in parent step 2. |
| Weakest device for live 3D | Recent integrated GPUs (Intel Xe class) with automatic quality tiers; phones stay on the video tier. |
| Land approach | Image-based detail inside the existing CUDA ray-marched renderer: CC0 photo ground textures and baked oak impostors. No second (raster) renderer. |
| Order | 1 quality tiers + GPU visibility → 2 near-field land → 3 scene controls. Each is its own plan. |

## Sub-project 1 — Quality tiers and GPU visibility

- `render_water` gains an integer `quality` (0 low, 1 medium, 2 high). It scales: primary
  terrain-trace step budget, terrain-shadow steps, reflection-trace steps, the distance out to
  which trees get individual crown tests (and, after sub-project 2, texture detail). High
  equals today's settings; low must reach ≤ 33 ms/frame at 768 px wide on the Intel Xe-LPG
  in this laptop; medium sits between.
- **Automatic tier:** browsers do not report "discrete vs integrated" directly, so the
  starting tier comes from `adapter.info.vendor`: `nvidia` starts at high; everything else
  (intel, amd, apple, unknown) starts at medium. Then measure frame time for ~2 s after the first frame; if the median exceeds
  33 ms step down a tier (then down in resolution); if it stays under 16 ms for 4 s at a
  lower tier, step up once. `?quality=low|medium|high` forces a tier (tests, sharing links).
- **Visible:** in 3D mode (journey live view and explore page) a small chip shows the GPU
  (vendor/architecture from `adapter.info`) and the tier. When the vendor is `intel` (or
  the tier drops to low) it links a one-line tip: "If this computer has a faster graphics card, set your browser to High
  performance in Windows graphics settings."
- The journey's "struggling" notice appears only when the lowest tier is still above 60 ms.

## Sub-project 2 — Near-field land

### Ground materials
- Four CC0 texture sets (green grass, dry grass, bare soil, rock outcrop), e.g. from
  ambientCG, each colour + normal/height, stored like the pebble floor (linear float data
  uploaded once), at a resolution that keeps the shared asset set to a few MB.
- Per-point weights from slope, the lidar valley channel, aspect, season and noise. The
  texture is projected on the ground plane (height-field terrain), with the existing
  stochastic no-tiling technique (`stone()`), and its normal perturbs lighting up close.
- Grass texture coordinates sway with the existing wind/gust field, so near grass moves.
- Detail fades to today's procedural shading with pixel footprint (beyond a few hundred
  metres), so distant hills are unchanged and aliasing-free.

### Trees (impostors)
- `pipeline/bake-impostors.py` runs Blender 5.2 headless (installed on this machine) to
  build or import 3–4 California oak shapes — spreading valley oak, compact blue oak, dense
  coast live oak — and bake each into an **octahedral impostor** atlas: colour+alpha,
  normal and depth for many view directions.
- Shading: the existing per-cell tree placement stays (density rules, positions, sizes). A
  ray that meets a tree's bounds samples the impostor view nearest the ray direction; alpha
  decides hit or pass-through (the ray continues to the next candidate or the ground);
  normal and depth give correct sun lighting and cast shadows. Species chosen per tree by
  hash and site (drainage/aspect).
- Far groves keep today's averaged canopy, tinted by the impostors' mean colours.
- Tier scaling: fewer candidate trees and lower mip on low/medium.

### Assets
- Shared (not per reservoir): `data/shared/ground/*` and `data/shared/trees/*` plus a small
  JSON manifest, validated like bundles (files present, sizes, dimensions). Scripts fetch
  and pack textures (`pipeline/fetch-textures.py`) and bake impostors. Every source is CC0
  and recorded in THIRD_PARTY_NOTICES with its URL.
- Flyover videos and posters are re-rendered after this sub-project.

## Sub-project 3 — Scene controls in 3D

- A compact **Scene** panel in the journey's live view and on the explore page:
  - **Time of day**: slider plus Morning / Midday / Golden hour presets. The sun follows its
    real path for the reservoir's latitude on a chosen date; sun direction and colour become
    renderer parameters (today a constant in the shader), used consistently by terrain,
    water glint/reflection, caustics and sky.
  - **Season**: spring green / summer gold (exists in the renderer today, hidden in 3D).
  - **Wind**: strength and direction, driving wave energy/direction and grass gusts.
  - **Clarity**: clear ↔ turbid water (the absorption/scattering coefficients).
- Settings persist per visitor (localStorage, with fallback when unavailable) and can be
  shared via URL parameters. Flyover videos stay at the midday default.

## Testing

- Tiers: browser checks render each forced tier and assert the frame-time budget on low;
  auto-tier logic is unit-tested with simulated frame times.
- Assets: manifest/schema checks in `validate-bundles.mjs` (or a sibling validator) and in CI.
- Visual: preview screenshots per tier and per time-of-day preset, reviewed by eye; the
  existing FFT, caustic-energy and zero-readback checks keep passing.
- Controls: each control changes the corresponding renderer parameter (asserted via the lab
  API) and survives reload/URL sharing.

## Out of scope

Horizon/far-field terrain beyond the lidar crop; blade-geometry grass or any second
renderer; water level by month (parent step 2); phones in live 3D.
