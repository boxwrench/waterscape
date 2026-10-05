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
