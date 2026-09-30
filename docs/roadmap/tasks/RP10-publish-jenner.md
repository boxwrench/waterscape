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
