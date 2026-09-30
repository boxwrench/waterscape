# RP8: Document and publish Hacienda views and Map water

## Authorization and scope

The user requests commit, push, a README link and updated docs. This authorizes integration
and publication to the existing GitHub Pages site, overriding the default no-merge/no-push
rule for this task. Publish accepted RP2–RP7 River Pulse work. Preserve current remote main
and leave the independent dirty reservoir checkout untouched.

## Steps

1. Integrate current remote main into the isolated River Pulse branch, retaining both tracks.
   Existing upstream reservoir/vendor changes are carried through unchanged, not edited.
2. Add a prominent direct Hacienda link in the README. Update River Pulse guide, architecture,
   roadmap and handoff to describe Map/Bridge/Beach, optics, illustrative flow and limitations.
3. Run publication checks, commit docs and push the verified integrated commit to main using
   an ordinary fast-forward push. Never force-push.
4. Monitor the Pages workflow and verify deployed River Pulse assets against the local build.
   If CI exposes a rendering/readiness defect, diagnose with its pinned Chromium version
   and repair only the publication-blocking River Pulse behavior/check.
5. Record the publication result and commit/push that documentation update too.

## Checks

- `node --test "pipeline/tests/*.test.mjs"`
- `python3 -m pytest pipeline/tests -q`
- `npm run check`
- `npm run validate`
- `python3 pipeline/build_river_registry.py --check`
- `npm run test:build`
- `RIVER_PULSE_BROWSER=/opt/google/chrome/chrome node scripts/verify-river-pulse.mjs`
- README/internal document links resolve; GitHub Pages build/deploy succeeds; deployed
  representative HTML, modules, terrain and setting assets match the verified local build.

## Interpretation

No new source data, scientific claims or visual bindings. Water optics and reconstructed
beach are presentation; Map width follows selected discharge within loaded history, not
measured channel banks/stage/velocity. Documentation must preserve these distinctions.

## Result
- Status: blocked
- Commit: 15648e2; verified width-timing repair 6dc6a48
- Checks:
  - `node --test "pipeline/tests/*.test.mjs"`: 117 passed, `ℹ fail 0`.
  - `python3 -m pytest pipeline/tests -q`: system Python initially lacked pytest; existing `/tmp/waterscape-r1-venv/bin/python3 -m pytest pipeline/tests -q` passed: `26 passed in 0.58s`.
  - `npm run check`: all 21 CUDA kernels compiled; final `present: 14028 WGSL bytes`.
  - `npm run validate`: `Bundles valid.` and `River packages valid.`
  - `python3 pipeline/build_river_registry.py --check`: `River Pulse registry is current`.
  - `npm run test:build`: `Built experience pages and river assets valid.` (92 modules), including after timing repair.
  - Local browser suite with installed Chrome and subsequently CI's pinned Chromium 141: `River Pulse browser checks passed: production assets, WebGL fallback, timeline, evidence, camera/layers, mobile, data outage and GPU failure.`
  - Updated documentation file links resolve; publication diff preserves upstream reservoir files.
  - First CI run 36671779067: `page.waitForFunction: Timeout 30000ms exceeded.` at `scripts/verify-river-pulse.mjs:166:14`; width settling depended on frame count. Elapsed-time easing repaired this.
  - Second CI run [36672469191](https://github.com/boxwrench/waterscape/actions/runs/36672469191): `River Pulse page errors before check failure: []`; `page.screenshot: Timeout 30000ms exceeded.` at `scripts/verify-river-pulse.mjs:208:14`. Build failed; deployment skipped.
- Notes: README direct Hacienda link and updated guide, architecture, visual workspace, binding principles, roadmap and handoff are committed/pushed. Accepted RP2–RP7 changes are on remote main, but are not deployed; live-file matching was not attempted because deployment failed. Stopped after the second failed check per AGENTS.md, also honoring the user's request to avoid excessive checks. No further CI rerun or bypass. Docs-only result commit uses `[skip ci]` to avoid a third run. Dirty H1 reservoir checkout remains untouched.
