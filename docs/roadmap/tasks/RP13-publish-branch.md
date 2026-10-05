# RP13: Publish the East Fork and River Pulse work as a branch

The user found the separately developed Lake Mendocino/Russian River work missing and
requested committing and pushing it, then explicitly specified pushing as a branch.

## Scope

- Merge `task/rp-visuals-v2` at `82ea78b`, which includes `task/LM2`, with remote main
  at `06f44d0` on `task/RP13-publish`.
- Include East Fork below Coyote Valley Dam, the geographic Russian River map, Hacienda
  historical high/low water controls, Jenner visuals and their source/task documentation.
- Preserve current main's Hetch Hetchy work and resource references.
- Push the integration branch only. Do not update main or deploy Pages.
- Keep incomplete `task/LM1` reservoir foundations separate.

## Checks

- `node --test --test-isolation=none pipeline/tests/*.test.mjs`
- `/tmp/waterscape-r1-venv/bin/python -m pytest pipeline/tests -q`
- `python3 pipeline/build_river_registry.py --check`
- `npm run check`
- `npm run validate`
- `npm run test:build`
- `RIVER_PULSE_BROWSER=/usr/bin/google-chrome node scripts/verify-east-fork.mjs`
- `RIVER_PULSE_BROWSER=/usr/bin/google-chrome node scripts/verify-jenner.mjs`
- `RIVER_PULSE_BROWSER=/usr/bin/google-chrome node scripts/verify-river-pulse.mjs`
- `git diff --cached --check`

## Result

- Status: done
- Commit: `7255688` (integration merge)
- Checks:
  - JavaScript tests with `--test-isolation=none`: 137 passed, 0 failed.
  - Python tests using the existing virtual environment: 36 passed.
  - Registry freshness: `River Pulse registry is current`.
  - Shader checks: all listed CUDA kernels translated to WGSL successfully.
  - Data validation: `Bundles valid.` and `River packages valid.`
  - Built assets: `Built experience pages and river assets valid.`
  - East Fork browser: `East Fork scene, shoreline controls and map navigation passed.`
  - Jenner browser: `Jenner views, motion, mobile, data outage and GPU fallback passed.`
  - River Pulse browser: production assets, WebGL fallback, timeline, evidence,
    camera/layers, mobile, data outage and GPU failure passed.
  - `git diff --cached --check`: no output.
- Notes: Pushed to `origin/task/RP13-publish`. Remote branch confirmed at `7255688`;
  remote main remained `06f44d0`. Browser checks used Chrome with software WebGL2,
  not hardware WebGPU performance validation. The sandbox blocked the initial local
  server bind; the authorized browser checks passed outside it. System Python lacked
  pytest, so the existing Waterscape virtual environment was used. Node's isolated test
  runner reported only file-level results here; the in-process run executed all 137 tests.
  This branch includes completed LM2/RP11/RP12 work, not the incomplete LM1 reservoir bundle.
