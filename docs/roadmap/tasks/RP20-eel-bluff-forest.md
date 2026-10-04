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
