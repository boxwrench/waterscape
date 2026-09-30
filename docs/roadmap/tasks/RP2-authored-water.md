# RP2: First Hacienda authored water surface

User-authorized scope: realistic-looking water in authored River Pulse views. Keep the
map/corridor representation separate. Start with Hacienda; do not restore the archived
corridor prototype or build Jenner in this task.

## Work

1. Use an isolated `task/RP2` checkout based on main, preserving the unfinished W2 work.
2. Add a bounded local water surface around Hacienda using the bundled authoritative
   mainstem centerline and sampled terrain. Declare its extent, level, depth and bed as
   illustrative; do not infer measured hydraulics from discharge or change sourced terrain.
3. Add animated fine ripples, Fresnel reflection, shallow-to-deep attenuation, modeled
   gravel and caustic detail. Use relative browser imports and the existing Three/TSL stack.
   Keep protected reservoir runtime/shader and vendor files unchanged.
4. Show the surface in the authored Bridge view and retain cartographic centerlines in
   Overview. Add a Shallows camera for optical inspection. Respect the river-layer control and reduced motion. Put the optical/geometry
   disclosure in the evidence drawer. Data failures must not manufacture hydraulic state.
5. Verify geometry constraints with focused unit tests; run all JS unit tests, river
   package validation, built-asset checks and the River Pulse browser suite. Inspect built
   desktop/mobile screenshots including a close water view. If any check fails twice, stop
   and report the exact output. Record limitations rather than claiming measured velocity,
   surveyed bathymetry, complete river simulation or hardware performance.
6. Update the handoff and authored-water notes; link the evaluation from the resource library. Commit using this task title; append Result
   and commit the result separately. Never push or merge.

## Result
- Status: done
- Commit: 45660b6
- Checks: `node --test 'pipeline/tests/*.test.mjs'` — ℹ fail 0 (26 test files passed).
- Checks: `node pipeline/validate-river-packages.mjs` — River packages valid.
- Checks: `npm run test:build` — Built experience pages and river assets valid.
- Checks: `RIVER_PULSE_BROWSER=/opt/google/chrome/chrome node scripts/verify-river-pulse.mjs` — River Pulse browser checks passed: production assets, WebGL fallback, timeline, evidence, camera/layers, mobile, data outage and GPU failure.
- Checks: `git diff --check` — exit 0; no whitespace errors.
- Notes: Inspected desktop and mobile authored-Shallows screenshots, refined parallel-wave artifacts into filtered multi-directional detail, and retained the existing overview/UI behavior. Screenshots are under `/tmp/waterscape-rp2/previews/river-pulse-ui/`. Initial sandboxed browser server startup reported "Detected unsettled top-level await"; authorized execution outside the sandbox passed, including the final optical revision. Browser rendering uses Chrome WebGL2/SwiftShader; native WebGPU and Windows hardware performance remain unmeasured. See authored-water notes for coarse geometry, approximate caustics, modeled bed and planar-reflection limits. Resource library reviewed and linked to the evaluation; no new upstream code/assets copied. Isolated checkout preserved all W2 changes. No push or merge.
