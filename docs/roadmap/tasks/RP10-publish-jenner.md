# RP10: Update, merge and publish the accepted Jenner scene

## Scope

The user accepts Jenner as a good start and explicitly requests updating, committing,
merging and pushing. This instruction authorizes merge/push despite AGENTS.md's default
prohibition and supersedes RP9's publication deferral. Preserve separate reservoir work
and the accepted coastal visuals. Keep checks focused per the user's instruction.

## Steps

1. Fetch current main and merge the accepted RP9 branch in the isolated River Pulse worktree.
2. Update README with the public Jenner link and record the user's acceptance in handoff,
   roadmap and scene notes. Retain the historical RP8 failure record.
3. Fix the known browser artifact timeout by giving screenshot capture a bounded longer
   timeout and finishing CSS transitions. Keep every existing assertion and viewpoint.
4. Run the focused checks below, commit, merge into main and push without force.
5. Observe the normal Pages workflow. If it succeeds, verify deployed Jenner assets and
   update the final Result. If it fails, diagnose and make only a bounded relevant correction;
   stop/report if a check fails twice. Do not bypass failing runtime checks.

## Checks

- `node --test pipeline/tests/jenner.test.mjs`.
- `npm run test:build`.
- One targeted capture of Hacienda's authored shoreline at the CI desktop viewport with
  pinned CI Chromium; retain RP9's completed Jenner browser/visual verification.
- Normal GitHub Actions checks after pushing, and deployed asset verification on success.

## Publication record

Result-only documentation may use `[skip ci]` after the runtime commit's Pages workflow
has completed. It does not change runtime files or bypass an unfinished/failed runtime check.


## Result
- Status: done
- Commit: 4a404c4 (main merge; publication update 874b975)
- Checks: `node --test pipeline/tests/jenner.test.mjs` — 8 passed; `ℹ fail 0`.
- Checks: `npm run test:build` — `Built experience pages and river assets valid.`
- Checks: `PLAYWRIGHT_BROWSERS_PATH=/tmp/rp8-browsers node .rp10-capture.mjs` (temporary targeted checker) — `Pinned CI Chromium authored-shoreline capture passed.`
- Checks: `gh run watch 36724078133 --interval 30 --exit-status` — success; build and deploy both successful. [Pages run](https://github.com/boxwrench/waterscape/actions/runs/36724078133).
- Checks: `python3 /tmp/rp10-verify-live.py` — `Deployed Jenner and Hacienda assets match the verified build.` (six HTTPS assets, HTTP 200 and SHA-256 equality).
- Checks: `git diff --check` — no output / exit 0.
- Notes: User acceptance recorded; README has the public Jenner link. The accepted coastal visuals and source-level distinction are retained. All existing River Pulse browser assertions remain; only artifact timeout/CSS transition completion changed. The earlier RP8 deployment block is resolved by the successful RP10 run. Six deployed checks cover Jenner HTML/entry/water, Hacienda HTML/Map water and the MIT license. Independent reservoir work is untouched. Result-only docs use `[skip ci]` after the runtime workflow succeeded; no runtime check was bypassed. Local preview remains on port 5174.
