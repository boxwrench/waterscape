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

## Result

- Status: done
- Commit: `8d51d62`
- Checks:
  - `node --test pipeline/tests/sacramento-scene.test.mjs pipeline/tests/river-pulse-sacramento.test.mjs pipeline/tests/california-overview.test.mjs`: 10 pass, 0 fail.
  - `node pipeline/validate-river-packages.mjs`: River packages valid.
  - `npm run test:build`: 109 browser modules; Built experience pages and river assets valid.
  - Browser: default desktop and 390 × 844 phone renders inspected; Bridge/Riverbank/Terrain,
    Evidence, Pause/Resume and Explore exercised; History opens Sacramento's individual
    page, and the California map's Sacramento label opens Freeport. No console errors/warnings.
    Phone scroll width equals viewport width. Temporary viewport reset; bridge preview left open.
  - `git diff --check` and staged whitespace check: clean.
- Notes: first authored Freeport baseline, with separate sourced terrain and imagery.
  Close-view geometry remains approximate; no hydraulics or native-GPU performance claim.
  Graphics/data independence is present in initialization and source-selection architecture;
  a forced graphics outage was not injected through the browser. Tests cover current,
  stale, future, missing and distinct source products. The initial test assertion referred
  to a nonexistent state field; corrected to inspect selected quantities/model fields.
  Network/process sandbox restrictions required approved reruns; source acquisition and
  all final checks succeeded. Builds on local RP11/RP12 work. No push, merge or publication.
