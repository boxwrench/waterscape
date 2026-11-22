# D5: The explorer opens at full quality; the visitor lowers it

**Who:** capable · **Needs:** none · **Branch:** `task/D5-full-quality` (on `task/D4-crystal-midday-pool`)

## Goal

The maintainer saw a poorer render on their own PC than in the review screenshots: the
automatic quality governor renders at most 1152 px wide and stretches it to the window (2.2× on
their 2560 × 1440 monitors), starts non-NVIDIA GPUs at medium, and steps down for good after any
slow patch. The maintainer: render beautifully first and let the visitor turn it down if frame
rates suffer.

## Steps

1. `renderer/engine/quality.js`: `CHOICES` (Full: high tier at the window's device pixels, up to
   4K wide; High 1536 px; Balanced: medium, 1152; Performance: low, 768) and `SlowWatch` (median
   frame over 60 ms for 2 s); the governor stays for River Pulse and the journey's embedded view.
2. `renderer/explore.js` / `explore.html`: the Resolution menu becomes Quality and sets tier and
   width; it opens at Full with no automatic stepping; a "Running slowly" tip suggests a lower
   choice. The embedded view (no controls) keeps automatic quality.
3. Tests for the choices and the slow watch; `scripts/verify.mjs` checks the new default.

## Result
- Status: done; the maintainer's look pending.
- Commit: see the branch (this Result is in the same commit).
- Checks:
  - `node --test "pipeline/tests/*.test.mjs"` → `ℹ pass 191`, `ℹ fail 0` (two new quality tests);
  - `node pipeline/validate-bundles.mjs` → `Bundles valid.`;
  - `npm run build` → `Built Pages with 137 browser modules, shared CUDA source and licensed assets.`;
    `npm run test:build` → `Built experience pages and river assets valid.`;
  - in Chrome with WebGPU at 2560 px wide on this PC (AMD RDNA 4): opens at high · 2560 px,
    10 ms a frame; Balanced → medium · 1152 px, 5 ms; Performance → low · 768 px, 4.1 ms; the
    embedded view stays automatic; no errors. Median frame time by width at high, Crystal
    Springs temple view: 1152 px 6.4 ms, 1536 7.4, 1920 8.3, 2560 9.4.
  - `npm test` (`scripts/verify.mjs`) not run: it needs Edge, which is not installed here.
- Notes: a weak GPU now opens at full quality and must be lowered by hand (the tip says so);
  the journey's live view is unchanged.
