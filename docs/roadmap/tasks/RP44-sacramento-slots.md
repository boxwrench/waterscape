# RP44: Sacramento and Eel slots

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

## Addendum: Eel

Same correction for the Eel River: Scotia Bluffs (downstream of the South Fork confluence at Dyerville, upstream of the estuary) moved to `middle`.
The **start** is Lake Pillsbury and Scott Dam outflow (a dam-outflow start; the official source on Bald Mountain is a note), the **end** is the Eel River estuary and
mouth near Ferndale. The owner's diagram also names the Dos Rios and South Fork (Dyerville) confluences; they are recorded as candidates for an optional `extra` slot.
All of this comes from the owner's reading and must be sourced before a scene is built. The published `scenes/end/scotia_bluffs/` URL redirects to the middle.

## Addendum: Tuolumne

Poopenaut Valley (the valley below O'Shaughnessy Dam, with the dam views) moved from `start` to `middle`; the owner said the dam is arguably the start but could be seen as the
middle. The **start** is reserved for the upper river (Hetch Hetchy or the meadows, to be chosen), the **end** is the San Joaquin confluence at Dos Rios State Park near Grayson and
Modesto (a different Dos Rios from the Eel's). Reversible with a folder rename. From the owner's reading; to be sourced. The published `scenes/start/poopenaut_valley/` URL redirects.
