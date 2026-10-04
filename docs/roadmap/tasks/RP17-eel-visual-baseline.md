# RP17: Start Eel River with a repeatable visual review

## Scope

Trial the user's visual development workflow on the Scotia Bluffs reach of the
Eel River. Research licensed photographs and authoritative geographic inputs.
Build major landforms and an explicitly authored water/gravel setting first.
Use fixed overview, primary, eye-level and shoreline cameras, a plain form mode,
deterministic generation and visible runtime measurements. Preserve actual
before/after browser renders, critique and refine a bounded shape pass. Link the
development scene from the river catalog and include it in the build.

Document the reusable process if actual comparative review proves useful. Stop
after this first pass for human acceptance; do not imply acceptance or a finished
river. No new hydrodynamics, live-flow binding, surveyed water level, detailed
bridges or botanical species claims. Geographic inputs and artistic estimates
must remain distinguishable. Save locally; never push or merge.

## Checks

- `node --test pipeline/tests/eel-scene.test.mjs pipeline/tests/river-pulse-sacramento.test.mjs pipeline/tests/california-overview.test.mjs`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Actual browser: fixed cameras, form mode, comparison, evidence, animation frames,
  desktop and phone, no errors or overflow; capture measurements and previews.
- `git diff --check`
