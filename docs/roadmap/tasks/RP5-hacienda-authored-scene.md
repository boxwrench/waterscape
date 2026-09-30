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
