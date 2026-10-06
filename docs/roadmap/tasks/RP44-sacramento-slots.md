# RP44: Sacramento slots

## Scope

Direction from the project owner: Sacramento River has only Freeport; it needs a start and an end. Freeport is the middle.
Decisions: the **end** is the Delta confluence with the San Joaquin (Collinsville and Pittsburg area); the **start** is the public landmark,
Headwaters Park at Big Springs in Mount Shasta City, not the official origin (the confluence of the South, Middle and North Forks near
Mount Eddy, a hard-to-reach point). Both statements come from the owner's reading and must be sourced before a scene relies on them.

## Done

- `scenes/end/freeport` moved to `scenes/middle/freeport` with `git mv` (same depth, so no import changed; the bridge model is untouched).
- Placeholders named and recorded with their rationale: `start/headwaters_park`, `end/delta_confluence`. `river.json`, registry, READMEs,
  tests, the build redirect for the old Freeport URL and doc links updated.

## Checks

186 unit tests, 39 pipeline tests, registry, validators, build, doc links; all pages load in Edge with no errors.

## Remaining

RP45 (end scene), RP46 (start scene): see the roadmap. Photo counts for the place-choosing heuristic have not been fetched.
