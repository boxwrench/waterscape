# RP15: Correct Freeport upper-link connections

## Scope

The user supplied an aerial photograph and identified that the top members still
connect incorrectly. Correct the connection topology on both bascule assemblies.
Retain the existing scene, controls, river data and terrain. Work locally.

## Approach

Use the user-supplied aerial photograph to distinguish the tower crest, forward
raised leaf joint, heel and rear counterweight joint. Connect the crest to the
forward joint and rear joint, and run the moving counterweight arm to the forward
joint. Refit the first leaf panels and catwalk to those common endpoints. Keep the
standing tower frame separate from the articulated links and roof bracing.
Narrow the crest walkway and face the desktop overhead camera broadly toward the
tender-house side, matching the supplied photo's useful comparison direction.
Member dimensions and elevations remain photo-fitted estimates. Do not bundle the
user photograph or claim a surveyed model or operating mechanism simulation.

## Checks

- `node --test pipeline/tests/sacramento-scene.test.mjs pipeline/tests/river-pulse-sacramento.test.mjs pipeline/tests/california-overview.test.mjs`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Browser: compare bank, approach, overhead and underside views; phone framing;
  no console errors. Save updated local previews.
- `git diff --check`
