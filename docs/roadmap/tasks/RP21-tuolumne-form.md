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
