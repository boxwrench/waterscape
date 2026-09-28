# RP1: River Pulse visual workspace and scientific selection fixes

User-authorized scope: fix the reviewed production assets, station isolation and as-of selection gaps; refine the frontend with visual exploration as a first-class experience. Work from `river-pulse/bootstrap`. The user explicitly requested pushing the finished work; this overrides the repository's default no-push rule. Do not merge.

## Work

1. Include every River Pulse HTML module and stylesheet in production, with a regression check.
2. Filter gauge inputs by station, phenomenon, units and evidence before temporal selection. Enforce explicit as-of availability, keeping unknown availability ineligible.
3. Refine the Hacienda visual workspace: more room for terrain, meaningful camera/layer controls, a synchronized history deck, accessible evidence drawer, responsive touch controls and graceful errors.
4. Keep rendering mappings separate from scientific quantities. Use real existing terrain artifacts; do not invent geography or hydraulic values.
5. Verify JavaScript and Python tests, data checks, build, and browser behavior/screenshots of the built page at desktop/mobile sizes. Include unavailable-data and unavailable-GPU checks.
6. Commit and push the task branch; record results here.

## Boundaries

No edits to vendor modules or the protected Waterscape water/runtime files. Do not claim completed hydraulic simulation, new surveyed assets or finished Jenner rendering. Browser test fixtures must be labeled test fixtures and kept out of production data.

## Result

- Status: done
- Commit: c724ccf
- Checks: `node --test pipeline/tests/*.test.mjs` — 23 test files passed, fail 0.
- Checks: `/tmp/river-pulse-checks/bin/python -m pytest pipeline/tests -q` — 21 passed.
- Checks: `node pipeline/validate-bundles.mjs` — Bundles valid.
- Checks: `npm run check` — all shader kernels compiled through present.
- Checks: `npm run build` — Built Pages with 72 browser modules, shared CUDA source and licensed assets.
- Checks: `node scripts/verify-river-pulse.mjs` with an installed Chromium override — browser checks passed for production assets, WebGL2 fallback, timeline, evidence, cameras/layers, mobile, data outage and GPU failure.
- Checks: `git diff --check` — no whitespace errors.
- Notes: Reviewed desktop, evidence, mobile and expanded mobile-history screenshots. Browser interaction tests use labeled synthetic hydrology fixtures with real terrain from the successful bootstrap CI artifact. Generated terrain remains untracked; CI regenerates it. Existing Waterscape end-to-end Edge tests were not rerun; its unit, bundle and shader checks passed. Native WebGPU performance remains hardware-dependent; the browser suite exercises WebGL2 fallback. The branch is intended for review against `river-pulse/bootstrap`, not a direct merge to main.
