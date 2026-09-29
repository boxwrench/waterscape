# P2: Reduce rendering overhead without changing quality

The user requested performance improvements across the scene while preserving
the accepted fluffy grass and image quality. Work from the G2 trial on `task/P2`.

1. Profile Firefox Nightly GPU passes and host completion separately. Use temporary
   instrumentation; do not ship profiling readbacks in the normal frame loop.
2. Explicitly permitted edit: `renderer/water.cu` to defer sky/terrain shading until
   it is known to contribute to the pixel. Preserve quality tiers and all visual
   effects. The user clarified Windows Chrome/Edge are the target: do not ship a
   Firefox-specific completion workaround or change the engine lifecycle.
   Do not edit `vendor/` or `renderer/engine/waterscape.js`.
3. Compare fixed-time rendered pixels
   before/after the shader change, and measure GPU and frame timings in Firefox.
4. Run `node --test "pipeline/tests/*.test.mjs"`, `node pipeline/validate-bundles.mjs`,
   `npm run check`, `npm run build`, and Firefox visual/runtime checks covering
   grass, seasons, quality tiers, resizing and shader comparison. The existing full
   Edge suite remains blocked by the missing system browser; do not rerun it solely
   to reproduce that installation failure.
5. Record measurements, limitations and results, then commit. Do not push or merge.

## Result
- Status: done
- Commit: 8b98d1b
- Checks:
  - `node --test "pipeline/tests/*.test.mjs"`: `ℹ fail 0`.
  - `node pipeline/validate-bundles.mjs`: `Bundles valid.`
  - `npm run check`: `present: 14025 WGSL bytes` (all kernels compiled).
  - `npm run build`: `Built Pages with 57 browser modules, shared CUDA source and licensed assets.`
  - `git diff --check`: exit 0, no output.
  - Firefox Nightly: all three tiers and both seasons advanced five frames each,
    including resolution changes to 768/1152 px, with `errors: []`. Inspected
    summer grass from above; restored the user's camera, lighting and controls.
  - Fixed-time RGBA comparison, shoreline/ridge/sky at 768 × 576: **zero differing
    bytes in all three views**. Animated grass and mesh trees were disabled for
    this deterministic comparison. Corrected an initial comparison setup mismatch
    (the user had selected Morning; reloading the URL had restored Midday).
- Notes: The only production change is deferred sky/terrain shading in
  `render_water`. Those colours are now calculated only when water will not
  overwrite them. No resolution, density, quality budget, visual effect, frame
  lifecycle or browser workaround was changed.

### Performance evidence

Used WebGPU timestamp queries in temporary Firefox instrumentation, alternating
original and optimized shader kernels on the same device. At 1536 × 1152, high
quality, three samples per version/view, median sums of wave, land, water and
post-processing pass durations were:

| View | Original | Optimized | Reduction |
|---|---:|---:|---:|
| Shoreline | 10.055 ms | 8.494 ms | 15.5% |
| North ridge | 9.112 ms | 7.827 ms | 14.1% |

These are GPU pass timings from fixed-time `lab.seek` frames, excluding browser
completion latency, copies and the normal ripple update. They are not end-to-end
FPS or Windows Chrome/Edge benchmarks. Raw local captures are in
`/tmp/fluffy-grass/ab-gpu.json`, `pixels-before.json`, `pixels-after.json`, and
`p2-runtime.json`. No instrumentation/readbacks ship in the normal frame loop.

Firefox's completion callback delay explains the earlier ~100 ms wall times;
Mozilla tracks this at https://bugzilla.mozilla.org/show_bug.cgi?id=1870699.
A temporary polling experiment was discarded after the user clarified Windows
Chrome/Edge are the target. The full Edge suite remains unrun here because Edge
is absent; target-browser timing and full regression checks are still needed
before merging/deployment. Nothing was pushed or merged.
