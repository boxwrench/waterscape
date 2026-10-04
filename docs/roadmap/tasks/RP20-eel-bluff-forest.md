# RP20: Give Scotia Bluffs rock detail and a forest silhouette

## Scope

Continue toward the Russian River/reservoir visual benchmark with one bounded
Eel bluff/forest pass. Inspect licensed Scotia imagery and existing aerial data.
Preserve geographic terrain elevations, water boundaries and five review cameras.
Build image-informed, deterministic Setting vegetation and rock surface detail,
retaining original plain-form and source-aerial modes. Reuse licensed local assets
where useful, keep California context featured, expose baseline/detail comparison.
Capture actual before/after fixed-view desktop and phone evidence, critique and
correct visible problems, record costs and source/interpretation limits. End with
this pass ready for human review; no claim of final environment acceptance.
No hydrodynamics, surveyed species counts, invented finer DEM or bridge work.
Save locally; never push or merge.

## Checks

- `node --test pipeline/tests/eel-setting.test.mjs pipeline/tests/eel-scene.test.mjs pipeline/tests/eel-state-sources.test.mjs`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Browser: five fixed views, baseline/detail, form/source, Evidence and pause;
  actual desktop/phone screenshots, console/overflow check and paired costs.
- `git diff --check`

## Result

- Status: done; bounded pass ready for human visual review, not accepted as final.
- Commit: `b5ec12a`.
- Checks: `node --test pipeline/tests/eel-setting.test.mjs pipeline/tests/eel-scene.test.mjs pipeline/tests/eel-state-sources.test.mjs` — 7 pass, 0 fail; `node pipeline/validate-river-packages.mjs` — River packages valid.; `npm run test:build` — Built experience pages and river assets valid. (119 browser modules); `git diff --check` — exit 0.
- Browser: five final desktop/phone views visually inspected, baseline/detail and
  form/source modes exercised, Evidence/California context and highlight pause/resume
  checked. All ten comparison gallery images load. Final errors empty, phone document
  width 390 px and camera buttons 44 px. Viewport overrides restored for handoff.
- Notes: native 14.05 m geographic elevations, water geometry and fixed v1 cameras
  preserved. Licensed shared tree assets and authored rock surface cues are Setting.
  Primary view adds 956,256 triangles and five draw calls (1,261,548 / 8 total).
  CPU geometry buffers 17.94 MiB; texture RGBA/mip estimate 44.3 MiB. GPU cost and
  foreground FPS unmeasured. Detailed cost/iteration record is in
  `docs/river-pulse/eel-bluff-forest-review.md`. Cliff shape remains soft; close
  water, shoreline contact and structures remain below the visual benchmark.
  Final constant tree palette correction followed profiling; geometry and shader
  complexity retained. Sandbox EPERM blocked final test workers; rerun with approved
  escalation passed. Earlier incorrect test fixture transition expectation was
  corrected, then all checks passed. No push or merge.
- Parallel: Tuolumne first actual form scene is isolated on `task/RP21` in
  `C:/Github/waterscape-tuolumne-rp19`, commits `6d8f5e2` and `0d74dcb`.
  Root inspected its final primary render; no full environment acceptance or merge.
