# RP5: Compose Hacienda Beach and animate map flow

## Scope

The user rejected the optical preview's appearance. Visual fidelity is a first-class
requirement: use the two supplied Hacienda photos as composition references. Keep
topographic Map separate from the authored beach, and make river flow visible on Map.
Work only in River Pulse, its assets, verification, resource/provenance notes and handoff.
Do not change the reservoir renderer or its active checkout. Never push or merge.

## Steps

1. Restore an illustrative animated map corridor using the bundled mainstem and selected
   discharge/seasonal state. Missing and zero observations must not imply known flowing water.
   Describe width/motion as a visual mapping, not measured hydraulics.
2. Replace the misleading Gauge flyover with Bridge and Hacienda Beach compositions in a
   bounded authored local setting. Retain exact source terrain in Map. Authored ground is a
   photo-informed approximation, with no surveyed-coordinate/elevation claim.
3. Model Hacienda's distinctive seven-panel camelback steel truss and concrete approaches;
   add the exposed bank rock, curved pebble beach, layered mixed woodland, daylight sky and
   shore-level water. Reuse licensed committed tree/material assets. Record evidence and
   assumptions separately from observations; do not invent stage or bathymetry.
4. Constrain authored travel to the completed setting. Preserve timeline, evidence, layers,
   reduced motion, mobile layout, data-outage and asset-failure behavior.
5. Build and visually inspect actual rendered desktop/mobile beach and bridge compositions
   against the supplied photos. Iterate on composition and materials before declaring done.

## Checks

- `node --test "pipeline/tests/*.test.mjs"`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- `RIVER_PULSE_BROWSER=/opt/google/chrome/chrome node scripts/verify-river-pulse.mjs`
- Inspect rendered desktop and mobile screenshots; record limitations candidly.

## Evidence

- User-provided contemporary photos: clear shallow pebble foreground, left beach/outcrop,
  gray camelback bridge, concrete approach and pier, mixed densely wooded banks.
- https://historicbridges.org/bridges/browser/?bridgebrowser=california/riverroadrussianriver/
  fetched 2026-09-29: seven-panel camelback through truss; main span 61 m; road width 7.71 m.
- https://hacienda-cosmo.com/page-5/ fetched 2026-09-29: contemporary bridge identification
  and photographic context. Reference photographs are not shipped as scene textures.
- Existing RP3/RP4 Poly Haven material sources and committed ez-tree asset provenance.

## Result
- Status: blocked
- Commit: 4687052
- Checks:
  - `node --test "pipeline/tests/*.test.mjs"`: 104 passed, `ℹ fail 0`. The first run found a dry-bank relief defect; fixed before the passing rerun.
  - `node pipeline/validate-river-packages.mjs`: `River packages valid.`
  - `npm run test:build`: `Built experience pages and river assets valid.` (89 browser modules).
  - `RIVER_PULSE_BROWSER=/opt/google/chrome/chrome node scripts/verify-river-pulse.mjs`: failed twice; stopped per AGENTS.md. First failure was a startup timeout from a missing caption DOM element, which was repaired. Second failure is recorded exactly below.
  - Desktop photo-composition renders inspected through multiple material/geometry iterations; browser run captured desktop, reduced-motion and mobile shoreline screenshots before reaching the failing outage check. Visual match remains approximate and is not declared a finished photorealistic reconstruction.
- Notes: preview remains on http://localhost:5174/river-pulse/renderer/hacienda.html. User corrections for gray steel/stone, large left-support rock and greener/less-clear water are incorporated. No push or merge. Required browser verification remains unfinished. The outage test checks `riverPulseMapFlow.mesh` before waiting for asynchronous scene-layer initialization; investigate that ordering before resuming verification. Target native WebGPU/Windows GPU performance is unmeasured.
- Visual acceptance: the user reviewed the Firefox preview and accepted the current scene: "not perfect but recognizable." Preserve this as the Hacienda visual baseline. Acceptance does not resolve the remaining browser verification failure.

Second browser failure:

```text
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

page.evaluate: TypeError: Cannot read properties of undefined (reading 'mesh')
    at eval (eval at evaluate (:290:30), <anonymous>:1:32)
    at UtilityScript.evaluate (<anonymous>:292:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
    at /tmp/waterscape-rp2/scripts/verify-river-pulse.mjs:265:34

Node.js v24.19.0
```
