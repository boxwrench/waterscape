# C1: Resolve outstanding pull requests and branches

The user requested resolution of the three open PRs and four remote branches,
authorizing the merges, pushes and recoverable branch cleanup needed for this task.

1. Work on `task/C1`; inspect current branches, PR diffs and CI.
2. Preserve `river-pulse/bootstrap` and `task/river-pulse-ui` as remote archive tags.
   The interface/scientific-selection work is integrated in R1, but bootstrap has
   additional corridor-water prototype commits that must remain recoverable.
3. Review the documentation-only resource-library PR #3 and merge after CI passes.
4. Close superseded PRs #1 and #2. Remove the three task branches from the remote
   after confirming the archive tags and resource-library merge preserve their work.
5. Check that only remote `main` remains and no open PRs remain; check the merged
   build and Pages workflow. Record the outcome in this task and `docs/HANDOFF.md`.
6. Commit with this task title and publish the cleanup record. Do not rewrite history.

## Result
- Status: done
- Commit: d94595c (resource-library merge); cleanup record committed separately with this task title.
- Checks: Resource-library PR workflow `36628737509` — completed, success.
- Checks: `npm run test:build` — Built experience pages and river assets valid.
- Checks: `git diff --check` — exit 0, no output.
- Checks: `git ls-remote origin 'refs/tags/archive/*'` — both archive heads match the preserved branches.
- Checks: `gh api repos/boxwrench/waterscape/branches --paginate --jq '.[].name'` — main.
- Checks: `gh pr list --state open --json number` — [].
- Notes: PR #3 merged; #1/#2 closed. Removed the three remote task branches with exact-head leases. Additional bootstrap corridor-water work is preserved in the archive tag, not silently discarded or merged into the published interface. Existing local branches and untracked `.aws` were left alone.
