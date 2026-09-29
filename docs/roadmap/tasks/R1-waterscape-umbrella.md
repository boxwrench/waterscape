# R1: Integrate River Pulse under Waterscape

The user added the River Pulse checkout and requested a unified Waterscape repository,
aligned with the remote `docs/making-water-visible.md`, including publication of the
accepted G2 grass and P2 performance changes. The user explicitly approved overriding
the default no-merge/no-push rule for this integration and publication.

1. Preserve the uploaded checkout, merge remote main and River Pulse bootstrap history
   into `task/R1`, and retain existing reservoir routes. Include the completed
   `task/river-pulse-ui` branch: the user subsequently requested the latest hosted
   cards, options and grass. Preserve its scientific-selection fixes and verify them.
2. Keep River Pulse in `river-pulse/`, sharing root vendor, geospatial/camera utilities,
   build tooling and tests. Document this boundary and the umbrella principles.
3. Fix the shared build to ship all River Pulse page modules/styles and real sourced
   Hacienda terrain and hydrography. Add package validation and navigation between experiences.
   Keep Jenner labeled as a data package, not a completed scene. Do not invent data
   or change the scientific mappings as part of repository integration.
4. Verify JS and Python tests, both data validators, registry freshness, shader
   compilation, build output, and local browser smoke tests. Use Firefox for local
   WebGPU inspection; Windows Chrome/Edge remain the target browsers. Record any
   remaining browser/performance limitations. Verify the built Pages paths.
5. Commit with this task title, append results, merge the verified integration into
   main, push normally (no force), and monitor GitHub Pages deployment.

Scope includes repository/docs/build/CI/navigation/package validation, generated
terrain/hydrography assets, refreshed reservoir preview media, and scoped fixes needed for the combined site to load. Existing
renderer/vendor implementations remain untouched by this task.

## Result
- Status: blocked — implementation complete; final hosted verification deferred at the user's request to wrap up and switch models.
- Commit: 58674ce (integration), 2235e80 (bootstrap integration).
- Checks: `npm run test:unit` — 25 test files passed, fail 0.
- Checks: `node --test --test-isolation=none 'pipeline/tests/*.test.mjs'` — 95 passed, fail 0.
- Checks: `/tmp/waterscape-r1-venv/bin/python -m pytest pipeline/tests -q` — 21 passed.
- Checks: `/tmp/waterscape-r1-venv/bin/python pipeline/build_river_registry.py --check` — River Pulse registry is current.
- Checks: `npm run validate` — Bundles valid; River packages valid.
- Checks: `npm run check` — all kernels compiled through present (14025 WGSL bytes).
- Checks: `npm run test:build` — Built experience pages and river assets valid (78 modules).
- Checks: `RIVER_PULSE_BROWSER=/home/boxwrench/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome node scripts/verify-river-pulse.mjs` — browser checks passed for production assets, WebGL fallback, timeline, evidence, camera/layers, mobile, data outage and GPU failure.
- Checks: Firefox WebGPU smoke against dist — both scenes ready; reservoir diagnostics and console had no errors. Desktop/mobile River Pulse screenshots reviewed.
- Checks: Refreshed both reservoir flyovers and posters with Firefox; ffprobe confirms each 1280x720, 300 frames, 10 seconds.
- Notes: Full reservoir Edge end-to-end suite was not rerun because Edge is unavailable locally. Windows Chrome/Edge performance remains unmeasured. Original nested checkout preserved at `/tmp/waterscape-river-pulse-import-20260929`.
- Next: After the authorized push, check the Pages workflow and live assets. `/tmp/waterscape-r1-live-assets.mjs <commit>` compares deployed cards, controls, grass, water shader, preview videos and river assets against dist. No further work should run until the user resumes.
