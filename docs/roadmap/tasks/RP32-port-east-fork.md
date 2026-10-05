# RP32: Port East Fork, the river map and the Jenner / Hacienda work

## Scope

The East Fork scene, a river map and other River Pulse work had been built on local branches against the pre-restructure layout and
were pushed as `origin/task/RP13-publish` (LM2 and RP11-RP13 on that line; the task ids RP11-RP13 were used on both lines, and their
task files keep their own names). Bring all of it onto the RP31 template layout without losing either line's work.

## Done

1. Port tool (`docs/archive/restructure-2026-10-05/port-east-fork.mjs`): translates the old paths to the new layout and three-way merges
   files both lines edited, with line endings normalised. 42 files changed on that branch: 20 added, 12 merged cleanly, 4 conflicts resolved by hand, and 6 skipped on purpose (the READMEs and
   handoff, which were rewritten in RP31; `registry.json`, regenerated; and the build scripts, which already discover scenes). The four
   conflicts: the authored-water module combined my reflection guard with their Low/Now/High level API; the Hacienda and Jenner pages keep
   both the River home link and their map / East Fork links; the package test lists the new place.
2. East Fork is the Russian River start scene (`scenes/start/east_fork/`, views Riverbank and Below the outlet, no live gauge: the nearby
   USGS station's record ended in 2011). Its dam, outlet, banks and dry-grass setting are photo-informed.
3. The river map: `rivers/russian_river/map/overview.json` (USGS 3DHP centerlines) drawn by `scene-kit/river-map.js` as a pinned
   inset with East Fork, Hacienda and Jenner pins; `river.json` marks the Russian map `built`. Other rivers' maps remain `planned`.
4. Jenner: barrier-beach channel, conifer stands, flowing water. Hacienda: record high/low water with the real gauge figures, map flow
   dynamics. Authored water gained a level API.
5. Data/layer fixes: the build now ships every discovered page (it had a second hardcoded list), `scripts/sync-river-readmes.mjs`
   generates scene cards and slot tables, a new `extremes` data flag, docs updated, `choosing-places.md` (their structure doc) kept as a reference.

## Checks

- 186 unit tests, 39 pipeline tests, registry check, `npm run validate`, `npm run test:build`, doc-link check: pass.
- Edge: atlas, six river homes and six scenes load with no failed request or console error. East Fork map pins open; Hacienda Record high / Record
  low update the readout (49.7 ft, 1955-12-23; 0.75 ft3/s daily mean, 1977-05-06).

## Remaining

- `origin/main` has newer commits (resource-library entries) that this line does not contain. Merge main when you decide to.
- Human acceptance of East Fork and the ported Jenner / Hacienda visuals. LM1's lake-side reservoir work lives on a separate branch (not ported).
- The river-home page does not yet embed the river map; scenes show it as an inset.
