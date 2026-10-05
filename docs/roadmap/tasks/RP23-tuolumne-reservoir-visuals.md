# RP23: Reuse the reservoir visual stack at Tuolumne's dam

## Scope

The user finds the isolated dam inferior to their complete reservoir experience
and asks to reuse existing terrain/water/lighting for suitable river environments,
continuing cheaper-agent delegation. Reuse the existing Hetch Hetchy renderer and
bundle as a clearly identified dam/reservoir context inside the Tuolumne page.
Preserve Poopenaut's native terrain, five review cameras, source/form presentations
and actual California watershed context. Do not feed RiverTerrain into reservoir
water kernels or turn a still-water level into river stage. Keep the original
engine/kernel/vendor files unchanged. Convert shared camera locations carefully;
offer the existing reservoir's dam/pool cameras and light/motion controls. Lazy
load and stop rendering when inactive/hidden/paused; avoid rebuilding GPU engines
when switching views. Preserve the previous plain dam comparison.

Inspect actual reservoir and integrated runtime views, desktop/phone, animation
frames/pause, light presets and source/evidence controls. Record cost and boundaries
of reused/observed/illustrative content. Document a reuse-first terrain workflow
for future rivers, with place-specific biome/source and reservoir-only assumptions
separated. No native LiDAR acquisition or changes to other river scenes in this
bounded pass. Save locally; no push or merge.

## Checks

- `node --test pipeline/tests/reservoir-context.test.mjs pipeline/tests/tuolumne-dam.test.mjs pipeline/tests/structures.test.mjs`
- `python pipeline/validate_tuolumne_foundation.py`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Browser: reservoir reference and actual integration, same-pose plain/full
  comparison, retained five native views, dam/pool/lake, lighting/motion/pause,
  form/source, Evidence/state geography, desktop/phone, errors/overflow, cost.
- `git diff --check`

## Visual pass record

- Reused the complete original Hetch Hetchy bundle/renderer on one lazily loaded
  full-viewport canvas. Native river terrain and original engine/kernel remain
  unchanged. Original downstream/shoreline cameras and light/pause controls work.
- Reviewed matching named downstream reference/integration at 980×820; previous
  versus full close pose has native 52° / full ~64° projection. Native five views,
  plain form/source, full transition/close/downstream/shoreline, three light
  presets, moving frames, phone 390×844 and Evidence/state context were inspected.
  Native phone close uses 84°. Pause frames are byte-identical; errors/overflow
  are absent; eight phone camera buttons are 44 px high.
- Improved rock shading, light, vegetation context and shoreline water. Inherited
  trees obscure the old close camera; near-water highlights remain harsh. Native
  valley remains coarse/bare. Native 1 m geometry has not been acquired. Reservoir
  water, bed and releases remain illustrative context, without river stage transfer.
- Added ongoing frame cost versus the static study. Rolling automatic-quality
  observations: desktop 62.3 ms / 120 samples at final 768×648 low, phone 35.5 ms /
  25 at 448×976 low, measuring submission plus GPU completion wait rather than
  GPU-only time or FPS. Tracked engine GPU buffers: 121.78 / 117.86 MiB; excludes
  textures, driver, uniforms and resident native renderer. Cached ready: 5.681 /
  2.920 s. Native CPU geometry/texture estimate remain 25.69 / 13.33 MiB. These
  categories are not summed as total memory and are not controlled benchmarks.
- Outcome: ready for human review, needs further visual/performance passes.
  [Actual captures](../../../previews/tuolumne/rp23/review.html) preserve evidence;
  [reuse-first guidance](../../river-pulse/reference/reservoir-renderer-reuse.md) records
  suitable candidates and next bounded terrain trials for other rivers.
  Two cheaper agents handled focused tests, audits, documentation/gallery and
  asset inventory. Root checked sources/paths, integrated and inspected runtime.

## Result

- Status: done (integration and review baseline; human visual acceptance pending).
- Commit: `655fd19`.
- Checks:
  - `node --test pipeline/tests/reservoir-context.test.mjs pipeline/tests/tuolumne-dam.test.mjs pipeline/tests/structures.test.mjs`: 9 pass, 0 fail. Sandbox worker spawn initially returned EPERM; approved execution passed.
  - `python pipeline/validate_tuolumne_foundation.py`: Tuolumne foundation valid, 768×512 at 14.66 m, 278 mapped flowlines, state CalWater unit/area, five review cameras.
  - `node pipeline/validate-river-packages.mjs`: River packages valid.
  - `npm run test:build`: Built experience pages and river assets valid; 119 browser modules.
  - Browser: reference/integrated and desktop/phone native/full views, light/motion/pause, form/source, Evidence/state context reviewed; zero console errors, zero phone overflow, byte-identical pause frames. Lifecycle and failure paths audited; fallback labeling corrected.
  - `git diff --check`: exit 0.
- Notes: full Hetch context improves the dam setting; native valley materials, tree placement, harsh highlights and runtime cost need subsequent passes. Original engine/kernel/vendor and native source cells unchanged. Reuse guidance now applies to future suitable river environments. Local branch only; no push or merge.
