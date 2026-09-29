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
