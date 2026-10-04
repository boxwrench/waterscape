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
