# RP13: Build the Sacramento Freeport scene

## Scope

Continue the user's Sacramento river work with its first immersive scene at Freeport.
Keep the accepted California overview and Russian River views. Use the reservoir/Russian
River optics and saved resources as inspiration. No publication or unrelated refactoring.

## Design

Water carries the composition: broad muted olive water, pale blue sky, green steel bridge,
layered riparian trees and stone levee banks. Palette: water #405847, steel #789480,
sky #c9dce1, bank #8d8870, foliage #42563b, text #f3f0e2. Georgia display and system
sans controls continue the existing atlas. A quiet corner title/data card leaves the
bridge and water central. Three explicit viewpoints: Bridge, Riverbank, Terrain.
The broad lowland reach gets deciduous foliage and levees rather than Hacienda's canyon.

## Steps

1. Verify Freeport photo references and acquire bounded USGS 3DEP/3DHP data plus
   aligned NAIP imagery for the terrain overview.
2. Author an explicitly approximate bridge/bank/water setting and bounded cameras.
3. Show matched Freeport instantaneous discharge independently of graphics; retain
   the existing daily history on the individual data page and expose source evidence.
4. Connect Sacramento's atlas link and package/registry/build entries.
5. Inspect desktop/mobile compositions and controls; record provenance and limitations.

## Checks

- `node --test pipeline/tests/sacramento-scene.test.mjs pipeline/tests/river-pulse-sacramento.test.mjs pipeline/tests/california-overview.test.mjs`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Browser: desktop/mobile; all viewpoints; evidence; pause; atlas/data routes;
  graphics failure/data independence where inspectable; no console errors.
- `git diff --check`

Never infer water level, local current or bank inundation from Freeport discharge.
Setting coordinates/dimensions are artistic estimates, not surveyed geometry.
