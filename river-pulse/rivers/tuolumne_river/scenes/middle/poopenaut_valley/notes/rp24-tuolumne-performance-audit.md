# Tuolumne reservoir context: performance and reuse audit

This is a source-accounting summary of the RP23 implementation in the isolated
`C:\Github\waterscape-tuolumne-rp19` checkout. Paths below are relative to that checkout's
root. Captures and metrics are actual runtime observations; buffer-category figures are
arithmetic derived from allocation sizes in source, not separate device probes.

## Captured runtime

The desktop reservoir shoreline view ran at 768×648, low quality, with a 62.3 ms median over
120 submission-plus-GPU-completion waits. The phone downstream view ran at 448×976, low quality,
with a 35.5 ms median over 25 waits. These waits include the combined frame path; they are not
GPU-only timings or FPS. Desktop first-ready time was 5.681 s and phone was 2.920 s from a
cached run, not cold-load benchmarks.

The wrapper reports 121.78 MiB tracked engine GPU buffers on desktop and 117.86 MiB on phone.
`river-pulse/renderer/reservoir-context.js` sums `ws.rt.buffers`; the metric excludes textures,
driver allocations, uniforms and the separate native renderer. Source allocation arithmetic
accounts for the desktop total as about 89.51 MiB of fixed buffers plus 32.27 MiB of
viewport-sized buffers:

- Fixed: 21.91 MiB terrain cells, 22.10 MiB padded baked-light storage, and about 45.5 MiB
  for the wave, ripple, caustics, lens and seabed buffers.
- Viewport-sized at 768×648: 7.59 MiB HDR, 15.19 MiB bloom buffers, 1.90 MiB pixels and
  7.59 MiB land-pass output.

The phone's viewport-sized portion is about 28.35 MiB by subtraction from the reported total.
These allocations remain resident while the context is hidden, inactive or paused:
`reservoir-context.js` stops scheduling frames but does not destroy the engine. The native
scene's reported 25.69 MiB CPU geometry and 13.33 MiB texture estimate are separate accounting.
The reservoir scene needs ongoing frames while active; the native scene renders on control
changes.

The desktop result is at the existing quality governor's lowest tier and 768 px floor
(`renderer/engine/quality.js`); 62.3 ms is above its 60 ms struggling threshold. The measured
phone result is also low tier. `renderer/engine/waterscape.js` runs wave and ripple updates,
caustics, the land pass, per-pixel water and post-processing; `renderer/land/scene.js` updates
grass and trees/impostors and renders the terrain pass each active frame.

## Bounded follow-up hypotheses

1. Try a wrapper-only emergency render width below 768 px when the lowest tier remains above
   the struggling threshold. `ws.resize()` already supports a changed viewport; it would
   reduce pixel work and viewport-sized buffers while keeping the same scene and camera.
   Fixed caustics and simulation buffers remain. No savings are measured yet.
2. Keep the current pause and inactive/hidden frame gates. They stop ongoing submissions but
   do not reduce resident memory. Actual buffer release would need an engine disposal path;
   do not describe hidden mode as freeing the 121.78/117.86 MiB.
3. Evaluate an optional wrapper-only reduced-glare control under sustained load. Setting
   `ws.settings.glare = false` skips active glare passes in `waterscape.js`, while its lens
   buffers remain allocated. It changes the image and has no measured performance result;
   compare captured views before considering a default.

## Native Tuolumne dry-slope direction

The native Poopenaut terrain is 14.6627 m cell spacing (`river-pulse/data/tuolumne_river/foundation/poopenaut/terrain.json`). A bounded next pass can test fine-relief shading on dry slopes while retaining its elevation mesh and source mode. The overlapping Hetch Hetchy asset
`data/hetch_hetchy/detail-dam.webp` is a 1 m-spaced, service-resampled normal/relief image;
`data/hetch_hetchy/detail.json` records its UTM footprint and source requests. It can inform
shading in the shared geographic footprint, but it does not provide native 1 m geometry or
prove 1 m source fidelity. Do not transfer reservoir drawdown, still-water shoreline,
bathymetry or level assumptions into the river view. The reuse workflow and wider river
candidate boundaries are in `docs/river-pulse/reservoir-renderer-reuse.md` in the isolated
checkout.
