# RP17: Start Eel River with a repeatable visual review

## Scope

Trial the user's visual development workflow on the Scotia Bluffs reach of the
Eel River. Research licensed photographs and authoritative geographic inputs.
Build major landforms and an explicitly authored water/gravel setting first.
Use fixed overview, primary, eye-level and shoreline cameras, a plain form mode,
deterministic generation and visible runtime measurements. Preserve actual
before/after browser renders, critique and refine a bounded shape pass. Link the
development scene from the river catalog and include it in the build.

Document the reusable process if actual comparative review proves useful. Stop
after this first pass for human acceptance; do not imply acceptance or a finished
river. No new hydrodynamics, live-flow binding, surveyed water level, detailed
bridges or botanical species claims. Geographic inputs and artistic estimates
must remain distinguishable. Save locally; never push or merge.

## Checks

- `node --test pipeline/tests/eel-scene.test.mjs pipeline/tests/river-pulse-sacramento.test.mjs pipeline/tests/california-overview.test.mjs`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Actual browser: fixed cameras, form mode, comparison, evidence, animation frames,
  desktop and phone, no errors or overflow; capture measurements and previews.
- `git diff --check`

## Result

- Status: done (first study and process trial delivered; human visual acceptance pending).
- Commit: 10c1dbb
- Checks: focused Node suite — 9 pass, 0 fail; `node pipeline/validate-river-packages.mjs`
  — River packages valid.; `npm run test:build` — Built experience pages and river assets valid.;
  `python pipeline/build_river_registry.py --check` — River Pulse registry is current;
  `git diff --check` — exit 0.
- Browser: five fixed desktop/phone cameras, form/source modes, Evidence and pause,
  actual highlight frames, catalog navigation and all comparison images inspected.
  No console errors or phone horizontal overflow; final phone buttons are 44 px high.
- Notes: first form study is deliberately unfinished. Terrain/cover are coarse,
  water remains a DEM-following proxy and has classification gaps at crossings,
  and the downstream terrain extent needs extension. No trees/structures are modeled.
  Paired 120-frame samples add 0.99% triangles with three draw calls retained;
  automated pacing prevents an FPS claim. The user supports combining this process
  with Sacramento's detailed photographic modeling. Process and actual evidence are
  committed; no push/merge. RP16 remains an unfinished saved draft.
