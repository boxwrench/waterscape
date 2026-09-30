# RP7: Replace striped Map water with irregular blue ripples

## Scope

The user sees an obvious striped pattern in Map and requests a better water resource and
more blue water. Change only Map surface shading; preserve accepted Hacienda authored views,
flow width, condition border, data behavior and the independent reservoir checkout.

## Steps

1. Evaluate existing water resources and Three's flowing-water reference; record the choice.
2. Replace evenly spaced wave bands with varied, advected surface normals using the existing
   local Three/TSL noise functions. Make the Map body blue and soften highlights.
3. Inspect rendered desktop high/low flow and mobile Map views, including closer Map detail.
4. Run the checks below, document outcomes and commit. No push, merge or publication.

## Checks

- `node --test "pipeline/tests/*.test.mjs"`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- `RIVER_PULSE_BROWSER=/opt/google/chrome/chrome node scripts/verify-river-pulse.mjs`
- Visual inspection of desktop/mobile water detail and accepted authored scene.

## Interpretation

Ripple size, speed, blue color and reflection highlights are illustrative presentation
choices, not measurements of velocity, water quality or waves. No new hydrology binding,
external runtime import, texture asset or vendor modification is needed.
