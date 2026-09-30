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

## Result
- Status: done
- Commit: 01e34f4
- Checks:
  - `node --test "pipeline/tests/*.test.mjs"`: 108 passed, `ℹ fail 0`.
  - `node pipeline/validate-river-packages.mjs`: `River packages valid.`
  - `npm run test:build`: `Built experience pages and river assets valid.` (90 modules).
  - `RIVER_PULSE_BROWSER=/opt/google/chrome/chrome node scripts/verify-river-pulse.mjs`: `River Pulse browser checks passed: production assets, WebGL fallback, timeline, evidence, camera/layers, mobile, data outage and GPU failure.`
  - Visual inspection: desktop high/low and mobile Map water is blue with irregular softer highlights. Closer renders at two advancing animation times show changing detail without regular crosshatching; no page errors. Accepted beach composition and green water inspected and retained.
- Notes: Three Water2Mesh is a technique reference, not imported code/assets. Existing local TSL noise supplies detail; no new downloads. Firefox preview reopened at `http://localhost:5174/river-pulse/renderer/hacienda.html?preview=rp7`. Software Chrome WebGL2 verified; target GPU performance remains unmeasured. No push, merge or publication; reservoir checkout untouched.
