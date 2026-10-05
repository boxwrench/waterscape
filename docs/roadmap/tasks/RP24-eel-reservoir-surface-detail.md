# RP24: Reuse reservoir surface detail on Eel's bluffs

## Scope

The user asks to keep redeploying available cheaper agents, and to reuse their
existing reservoir terrain solutions where suitable across River Pulse. Make one
bounded dry-land surface pass on Eel / Scotia Bluffs using existing licensed
reservoir rock photo detail and triplanar techniques. Keep native elevations,
forest scatter, water geometry/optics, fixed v1 cameras and lighting unchanged.
Preserve the RP20 land-material baseline, original form/source modes and featured
California data. All added surface appearance is authored Setting, without new
geology, native 1 m terrain or river-stage claims. Original engine/kernel/vendor
remain unchanged. Do not copy reservoir shoreline, bathtub, basin or granite
species assumptions.

Capture actual before/after renders at fixed desktop/phone cameras, inspect and
refine obvious repetition/contrast issues, and record texture/render cost. Reuse
available cheaper agents for the bounded material module, source/projection audit
and a read-only Tuolumne performance audit; integrate and inspect with root. The
cross-river audits inform next tasks without editing other river runtimes. Write
a review record and local handoff; no push/merge. Stop at the review checkpoint.

## Checks

- `node --test pipeline/tests/eel-setting.test.mjs pipeline/tests/eel-scene.test.mjs pipeline/tests/eel-state-sources.test.mjs`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Browser: five fixed desktop/phone views; material before/after, form/source,
  California context, animation/pause, errors/overflow and paired 120-frame cost.
- `git diff --check`

## Result

- Status: done; visual baseline awaiting human review.
- Commit: `c4939a0`.
- Checks: focused Eel setting/scene/state tests — 7 passed, `ℹ fail 0`
  (sandbox worker-spawn EPERM resolved by permitted retry outside sandbox);
  `node pipeline/validate-river-packages.mjs` — `River packages valid.`;
  `npm run test:build` — `Built experience pages and river assets valid.`
  with 120 browser modules; `git diff --check` — exit 0.
- Browser: all five settled desktop/phone material pairs inspected; 20 recorded
  dimensions verified; form/source, CalWater, controls, motion/pause and paired
  120-frame costs reviewed. Error logs empty, phone width 390 without horizontal
  overflow, ten images loaded for each gallery viewport. Initial premature camera
  captures were replaced before delivery. Settled visible paused frames match.
- Notes: shared CC0 surface maps add approximately 10.67 MiB to the texture
  RGBA/mipmap estimate (44.3 → 55.0 MiB). Geometry and draw calls unchanged;
  GPU cost unmeasured. Fine eye-level texture improves; coarse form, trees and
  water/shore remain weak. Three cheaper agents produced/reviewed the module,
  gallery, cross-river sources and Tuolumne performance hypotheses, with completed
  agents redeployed within this pass. Full Tuolumne RP23 remains isolated.
  Review: `previews/eel/rp24/review.html`; record:
  `docs/river-pulse/eel-reservoir-surface-review.md`. No push or merge.
