# RP25: Test reused water optics on Eel's clipped surface

## Scope

Implement the first bounded pass of the user's visual parity plan. Reuse
`createAuthoredWater` through its custom-grid input on Eel's existing clipped
surface, with a deterministic illustrative optical-depth adapter. Keep this a
selectable experimental water pass, with the previous surface as the default
pending visual acceptance. Do not extract shared river-water or adopt other rivers
before this render answers compatibility and cost questions. Preserve geographic
positions, shoreline passes, land/forest, light, fixed v1 cameras, source/form
modes and California context. Do not merge or push branches.

Use available cheaper agents with exclusive file ownership for the pure depth
adapter and meaningful geometry tests, read-only compatibility audit, and actual
comparison gallery. Root integrates, renders, critiques and refines only water.
Document illustrative depth, modeled bed, nonplanar-surface/single-plane reflection
limits, and added rendering cost. Correct previously identified plan assumptions
while preserving the user's uncommitted plan and handoff additions. Original
Hacienda behavior, engine/kernel/vendor and other river runtimes remain unchanged.

Capture settled Bluffs, eye-level and shoreline desktop/phone pairs, inspect
overview/bend, source/form, California context, motion/pause, UI and error logs.
Measure both water passes over 120 warmed frames. Keep the experimental adapter
isolated for replacement or removal after the spike decision. Stop at this visual
acceptance checkpoint and identify whether shared-water extraction is justified.

## Checks

- `node --test pipeline/tests/eel-water-optics.test.mjs pipeline/tests/eel-setting.test.mjs pipeline/tests/eel-scene.test.mjs pipeline/tests/eel-state-sources.test.mjs`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Actual browser review described above, including settled image dimensions and
  matched camera/presentation before/after, paired cost and pause verification.
- `git diff --check`

## Result

- Status: done (bounded experiment); human visual acceptance pending.
- Commit: `6d007cd`
- Checks: `node --test pipeline/tests/eel-water-optics.test.mjs pipeline/tests/eel-setting.test.mjs pipeline/tests/eel-scene.test.mjs pipeline/tests/eel-state-sources.test.mjs` — 15 tests, 15 pass, 0 fail.
- Checks: `node pipeline/validate-river-packages.mjs` — `River packages valid.`
- Checks: `npm run test:build` — `Built experience pages and river assets valid.`
- Checks: `git diff --check` — exit 0, no whitespace errors.
- Browser: inspected six matched desktop/phone camera pairs, overview/bend,
  form/source, California Evidence, baseline fallback, phone controls and gallery.
  Motion frames differ within water; settled paused frames are pixel-identical.
  Eel and original Hacienda Beach rendered without captured errors. Capture
  dimensions are 980×820 / 390×844. Both 120-frame cost samples completed.
- Notes: Three cheaper agents were reused and redeployed. Previous water remains
  default; improved main-view reflection and shallows are still a trial. Close
  views introduce a bright angular band, unresolved after rejected height-fade
  and no-glint diagnostics. Reflections on the DEM-following surface and nearly
  doubled rendered triangles prevent shared extraction/adoption at this checkpoint.
  Native 1 m LiDAR was not added. See
  [review](../../../river-pulse/rivers/eel_river/scenes/end/scotia_bluffs/notes/eel-water-optics-review.md) and
  [gallery](../../../previews/eel/rp25/review.html). No merge or push; the separate
  Tuolumne worktree remains clean.
