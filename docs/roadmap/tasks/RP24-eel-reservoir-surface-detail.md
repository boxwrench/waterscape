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
