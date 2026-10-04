# RP18: Feature California watershed data and audit Eel elevation sources

## Scope

Record the user's acceptance of RP17's first form baseline. Audit local elevation
resolution separately from available 1 m LiDAR-derived DEM coverage. Fetch primary
catalog metadata rather than assume coverage or equate a fine export with fine
source data. Use state-authored CalWater watershed geometry in a visible Eel context
map and feature its California agency provenance. Bundle inputs for offline runtime;
document source origin, host, dates, units, limitations and a repeatable acquisition.
Preserve accepted terrain, water and fixed cameras. No live flow/hydraulic binding,
new detailed visual pass, push or merge.

## Checks

- `node --test pipeline/tests/eel-state-sources.test.mjs pipeline/tests/eel-scene.test.mjs`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Browser: featured California context, source links, actual watershed/study map,
  desktop/phone, Evidence controls, no errors or horizontal overflow; save previews.
- `git diff --check`

## Result

- Status: done.
- Commit: `6586109`.
- Checks: focused Node suite — 5 pass, 0 fail; `node pipeline/validate-river-packages.mjs`
  — River packages valid.; `npm run test:build` — Built experience pages and river
  assets valid. (117 browser modules); `git diff --check` — exit 0.
- Browser: actual overview/state inset inspected at 980×876 and 390×844; featured
  California button, Evidence open/close and primary source links verified. Phone
  document width 390 px, browser errors empty. Actual before/desktop/phone images
  saved under `previews/eel/rp18-*.png`; viewport restored before handoff.
- Notes: accepted RP17 form baseline and 3D terrain/cameras retained. State CalWater
  geometry is actually used and visibly credited. Current DEM remains 14.05 m.
  CA09_Perkins actual survey boundary verifies partial 1 m availability at station,
  excluding the main bluff targets; no fine DEM/raw points downloaded. Checked DWR
  project has no intersecting footprints. Failed National Map request is recorded
  as unverified; full-study 1 m availability remains unknown. Watershed source data
  adds approximately 1.23 MiB uncompressed; no new frame/GPU/memory measurements.
  One test initially assumed FeatureCollection for the OpenTopography single Feature;
  corrected input handling and all tests pass. No push or merge.
- Parallel request: agent started Tuolumne/Poopenaut foundation in isolated `task/RP19`
  at `C:/Github/waterscape-tuolumne-rp19`, commits `615acb1` and `951e73d`. Root inspected
  source sheet/notes and independently passed its source validator. No runtime scene
  or acceptance claim; proposed cameras need first plain-form browser validation.
