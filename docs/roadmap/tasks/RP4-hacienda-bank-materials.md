# RP4: Add Hacienda pebble beach and bank rocks

User-authorized scope: integrate the two agreed Poly Haven materials into Hacienda. Reuse
the existing reservoir conifer assets for a bounded riverbank setting. Continue from RP3
without changing the active reservoir/W2 checkout.

## Work

1. Work on `task/RP4`. Fetch Ganges River Pebbles and Rock Boulder Dry from their official
   sources. Bundle local color, normal and roughness textures, record source/license/hash
   metadata and third-party notices. No CDN browser imports or runtime asset dependencies.
2. Use the pebble material for exposed bank terrain and the refracted modeled bed. Add
   foreground pebble meshes and large textured bank rocks in the local authored reach.
   Preserve sourced terrain; disclose authored geometry as Setting/illustrative.
3. Reuse only the committed Douglas-fir lightweight bakes and textures from W2 as local
   scene assets, recording the originating commit. Place bounded varied stands above the
   waterline; do not copy the reservoir placement model or claim individual surveyed trees.
4. Put the close camera at a terrain-derived actual preview shoreline with foreground
   gravel, visible shallows and deeper water beyond. Keep Valley cartographic, preserve
   camera/data/layer behavior and reduced motion. Keep the bridge as the subsequent
   architecture task; do not invent bridge measurements in this material integration.
5. Verify focused asset/placement constraints and all JS unit tests, river validation,
   production build assets and River Pulse browser behavior. Inspect desktop/mobile and
   focused shoreline screenshots. If a check fails twice, stop and report exact output.
6. Update resource status, authored-water notes and handoff; commit this task title, append
   Result, then commit Result. Never push or merge. Protected vendor/reservoir files stay
   unchanged.

## Result
- Status: done
- Commit: 50546fb
- Checks: `node --test 'pipeline/tests/*.test.mjs'` — ℹ fail 0 (101 tests passed).
- Checks: `node pipeline/validate-river-packages.mjs` — River packages valid.
- Checks: `npm run test:build` — Built experience pages and river assets valid.
- Checks: `RIVER_PULSE_BROWSER=/opt/google/chrome/chrome node scripts/verify-river-pulse.mjs` — River Pulse browser checks passed: production assets, WebGL fallback, timeline, evidence, camera/layers, mobile, data outage and GPU failure. Includes missing-setting-assets fallback and authored-shore checks.
- Checks: `git diff --check` — exit 0; no whitespace errors.
- Notes: Six official 1K maps match upstream hashes; licenses/source metadata are bundled. Reused two committed W2 lightweight fir bakes/textures without altering the reservoir checkout. Inspected desktop, focused shoreline and mobile captures under `/tmp/waterscape-rp2/previews/river-pulse-ui/`; `shoreline-focus.png` is the clearest material preview. Browser missing-asset coverage initially timed out at `scripts/verify-river-pulse.mjs:259:24` (`page.waitForFunction: Timeout 30000ms exceeded.`); a shadowed document reference in the fallback was fixed and the final suite passed. Local Chrome uses WebGL2/SwiftShader; native WebGPU and Windows GPU performance remain unmeasured. Bank geometry/stands are authored Setting and optical depth is modeled; coarse terrain and planar-reflection artifacts remain. Bridge architecture is the next scene task. No push or merge.
