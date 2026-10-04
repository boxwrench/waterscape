# RP21: Render the Tuolumne River plain-form baseline

Continue RP19 independently in `task/RP21`. Build a bounded actual browser scene
for Poopenaut Valley with unexaggerated terrain, a disclosed symbolic river-layout
guide, aligned aerial mode, five fixed cameras and visibly featured California
CalWater watershed context. Do not claim river stage, width, bathymetry, flow,
finished vegetation or downloaded native 1 m lidar. Keep generation deterministic.

Capture actual first renders, describe a visible mismatch, correct one related
problem and preserve before/after from a fixed camera. Inspect five desktop views,
form/aerial modes, Evidence and phone views when shared browser viewport access
is available. Record geometry cost and measurement limits. Stop at human review.

## Checks

- `python pipeline/validate_tuolumne_foundation.py`
- `node pipeline/validate-river-packages.mjs`
- `python pipeline/build_river_registry.py --check`
- `npm run test:build`
- `git diff --check`
- Actual browser fixed-camera renders, source mode, Evidence, console errors;
  phone check when browser coordination permits.

Never push or merge. Commit implementation with task title and a separate Result.

## Result

- Status: done (early runtime form pass delivered; awaiting human visual acceptance).
- Commit: `6d8f5e2`.
- Checks:
  - `python pipeline/validate_tuolumne_foundation.py` -> `Tuolumne foundation valid: 768x512 @ 14.66 m; 278 mapped flowlines; state CalWater unit/area; five review cameras.`
  - `node pipeline/validate-river-packages.mjs` -> `River packages valid.`
  - `python pipeline/build_river_registry.py --check` -> `River Pulse registry is current: C:\Github\waterscape-tuolumne-rp19\river-pulse\data\registry.json`.
  - `npm run test:build` -> `Built experience pages and river assets valid.` (116 local browser modules).
  - `git diff --check` and `git diff --cached --check` -> exit 0, no whitespace errors.
  - Browser: five desktop 980x820 and five phone 390x844 form cameras inspected;
    actual source aerial, state inset, Evidence, river-to-scene link, hidden guide
    and title controls verified. No console errors or phone horizontal overflow;
    camera targets 44 px. All nine comparison-gallery images loaded. Shared
    viewport reset and root notified immediately after phone review.
- Notes: Native terrain unchanged at 1x scale. RP19 camera proposals initially
  missed the river; actual mapped layout/aerial/runtime calibrated v3 cameras.
  A separate fixed-overview contrast correction has preserved before/after at
  matched viewport/DPR; camera calibration images are not geometry comparisons.
  State CalWater polygons are actually drawn and visibly attributed. Contact is
  a disclosed symbolic river guide, not water stage/width/bathymetry. Native 1 m
  lidar is still a verified availability lead, not installed. Bare close views
  remain coarse/empty; named source-line gaps remain visible. Guide-visible cost:
  788,995 triangles, 3 calls, 21.11 MiB CPU geometry; texture estimate 8.0 MiB.
  Contrast pass adds no geometry/calls. GPU/full-memory/FPS and cold loading are
  unmeasured. No animated effects. Gallery uses authoritative final-prefix
  desktop captures; exploratory images may show the prior frame. Work remains
  isolated at localhost:5174, branch task/RP21; no push, merge or shared Eel edits.
