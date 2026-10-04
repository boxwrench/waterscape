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

## Result

- Status: done
- Commit: `71137a7`
- Checks:
  - `node --test pipeline/tests/sacramento-scene.test.mjs pipeline/tests/river-pulse-sacramento.test.mjs pipeline/tests/california-overview.test.mjs`: 11 pass, 0 fail.
  - `node pipeline/validate-river-packages.mjs`: `River packages valid.`
  - `npm run test:build`: `Built experience pages and river assets valid.`
  - Browser: southeast/northeast banks, both approaches, underside and overhead
    inspected; portrait overhead and both east bank angles checked at 390 × 844.
    No console errors or horizontal overflow. Temporary viewport override reset.
    Four local previews updated; aerial view left open for comparison.
  - `git diff --check` and `git diff --cached --check`: pass.
- Notes: Crest links now reach the forward leaf-head and rear counterweight joints.
  The moving arm, leaf truss, pivot details and catwalk use the same endpoints.
  Roof bracing covers both slopes; duplicate crest headers removed and walkway
  narrowed. Phone bank cameras include both joints. Positions are photo-fitted
  estimates, not surveyed mechanism dimensions. The user reference is not bundled.
  No push or merge.
