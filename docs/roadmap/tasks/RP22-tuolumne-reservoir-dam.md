# RP22: Reuse the Hetch Hetchy dam in Tuolumne

## Scope

At the user's direction, reuse the existing Waterscape Hetch Hetchy dam rather
than rebuild it. Import the shared geometry/material and original structures
metadata, translate its UTM/NAVD88 coordinates into the river frame, and preserve
its generic-profile/photo-fitted limitations. Keep reservoir rendering defaults
unchanged. Do not import reservoir terrain edits, synthetic bathymetry, water
level or illustrative flowing outlet jets. Reuse the reservoir's bounded dam
contact-cutout principle if the native DEM pierces the face; apply it only to the
render mesh while the dam is visible, preserving native source/baseline geometry
and disclosing the local authored cut. Retain the five river review cameras,
plain-form/source modes and featured California CalWater context; add a static
dam comparison toggle and a focused dam view if the original transition view is
too distant. Capture actual before/after desktop/phone views, inspect placement
and terrain contact, record costs and document visible limitations. One bounded
dam reuse pass; no new river hydraulics, vegetation or geographic terrain refinement.
No vendor/kernel changes. No push or merge.

## Checks

- `node --test pipeline/tests/structures.test.mjs pipeline/tests/tuolumne-dam.test.mjs`
- `python pipeline/validate_tuolumne_foundation.py`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Browser: before/after fixed transition and dam views; original five cameras,
  desktop/phone, source/form modes, dam toggle, Evidence, cost/errors/overflow.
- `git diff --check`

## Result

- Status: done; bounded dam reuse ready for human visual review, not a finished river.
- Commit: `249cbbd`.
- Checks: `node --test pipeline/tests/structures.test.mjs pipeline/tests/tuolumne-dam.test.mjs` — 5 pass, 0 fail; `python pipeline/validate_tuolumne_foundation.py` — Tuolumne foundation valid: 768x512 @ 14.66 m; 278 mapped flowlines; state CalWater unit/area; five review cameras.; `node pipeline/validate-river-packages.mjs` — River packages valid.; `npm run test:build` — Built experience pages and river assets valid. (117 browser modules); `git diff --check` — exit 0.
- Browser: actual six desktop/phone views visually inspected; original five v3
  cameras retained plus a focused dam camera. Paired native/structure close and
  transition captures, plain form/aerial, dam/guide toggles, Evidence and visible
  California CalWater checked. Ten gallery images load; errors empty, phone width
  390 px and camera buttons 44 px. Phone close FOV widened to fit crest; viewport
  overrides restored. A final screenshot accidentally targeted the other tab’s
  viewport; corrected with a fresh phone tab and verified 390×844.
- Notes: original source metadata, crest/profile and concrete asset reused. Native
  heights retained in source cells; bounded authored render-mesh clearance fixes
  DEM piercing the face. Dam-off/aerial restore native geometry. No reservoir
  water level, synthetic bed, releasing jets or river water surface imported.
  Added 1,256 triangles / one draw call (790,251 / 4 total), resident CPU geometry
  25.69 MiB, texture RGBA/mip estimate 13.33 MiB. Original RP21 increases are
  4.58 MiB and 5.33 MiB; same-page hidden baseline retains all assets. GPU timing,
  total browser/GPU memory and foreground FPS unmeasured. Coarse terrain contact
  and bare surroundings remain weak. No push or merge; isolated Tuolumne worktree.
- Delegation: lower-cost agent audited placement, drafted notes and checked for
  regressions; root caught and corrected an initial audit arithmetic error before
  implementation and checked translation with tests. Review wording corrections
  were applied. Another redeployed agent reports CA10_Stock’s actual native raster
  footprint covers four valley camera targets but excludes the dam target/crest;
  native rasters remain unacquired. Treat this as the next terrain audit lead,
  reconcile NAD83(CORS96)/WGS84 and NAVD88 realization before any installation.
