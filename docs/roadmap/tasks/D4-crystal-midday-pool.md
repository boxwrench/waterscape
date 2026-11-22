# D4: Crystal Springs opens at midday; a glass-still reflecting pool

**Who:** capable · **Needs:** D2 (the temple and its pool) · **Branch:** `task/D4-crystal-midday-pool`

## Goal

The maintainer's look at D2: at golden hour the low sun shines straight down the pool axis from
the temple viewpoint and its glare hides the temple, and the reflecting pool does not read as
still water. Open Crystal Springs at midday, and make the pool a glass-still mirror.

## Steps

1. `data/crystal_springs/land.json`: `defaultPreset` midday (morning and golden stay on offer).
2. `renderer/land/landmarks.js` `reflectingPool()`: no ripple offsets the mirror; a faint, slow
   swell in the normal only; a dark basin seen through the water, so the reflection reads looking
   down; a sun reflection as a small disc, not a smeared glint. Reference: River Pulse's
   `scene-kit/authored-water.js` (planar mirror, Fresnel, small mirror offset).
3. Before and after renders from the temple viewpoint (`ridge` in `cameras.json`) and looking
   down the pool (pose `3224,9.245,3193,-1.85,-0.3`), at midday and golden.

## Result
- Status: done; the maintainer's look pending.
- Commit: see the branch (this Result is in the same commit).
- Checks:
  - `node --test "pipeline/tests/*.test.mjs"` → `ℹ pass 189`, `ℹ fail 0`;
  - `node pipeline/validate-bundles.mjs` → `Bundles valid.`;
  - `npm run build` → `Built Pages with 137 browser modules, shared CUDA source and licensed assets.`;
    `npm run test:build` → `Built experience pages and river assets valid.`;
  - `node scripts/check-doc-links.mjs` → `Documentation links valid (145 Markdown files).`;
  - renders in Chrome with WebGPU from both cameras, midday and golden, no errors.
- Notes:
  - The journey page (`site/journey.js`) still passes `preset=golden` to every live stop unless
    the URL names another; only the explorer's own default changed.
  - The pool's change costs nothing: the same mirror pass, fewer noise lookups.
