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
