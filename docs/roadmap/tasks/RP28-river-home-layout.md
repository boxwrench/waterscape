# RP28: River home layout and consistent navigation

## Scope

User goal: update River Pulse's layout and visuals for the best viewing and data
communicating experience. This first pass covers the river home page and top navigation.
It does not change any 3D scene, renderer, water or terrain.

1. Rebuild `river-pulse/river.html|css|js` in the atlas's dark visual language: river tabs,
   a hero using the river's own scene capture, a "What the river is doing" data panel,
   scene cards with viewpoint chips and fidelity labels, "What comes next" for unfinished rivers.
2. Data honesty: a live reading appears only where a USGS binding exists (Sacramento at
   Freeport, Russian at Hacienda Bridge). A stale reading shows its value with a Stale badge.
   Eel, Tuolumne and planned rivers say plainly that no gauge is bound.
3. Navigation: the atlas header no longer lists Russian River places on every river; Eel and
   Tuolumne trails link California and river home; Freeport's "History" link is "River home".
4. Scene images, fidelity labels and viewpoint lists live in each `river.json`; the package
   validator checks that images exist.

## Checks

- `node --test "pipeline/tests/*.test.mjs"`, `node pipeline/validate-river-packages.mjs`,
  `npm run test:build`.
- Browser: all six rivers desktop (1280) and phone (390): no horizontal overflow, no page
  errors; live Russian and Sacramento readings load; scene links and tabs work.

## Evidence

`previews/river-pulse/rp28/`: two before captures and four rivers after, desktop and phone.
Scene thumbnails are UI-free captures of the actual scenes on 2026-10-04.

## Remaining

- Scene chrome (camera buttons, evidence drawers, discharge cards) is still hand-built per
  scene. Hacienda's discharge, history chart and condition band is the best data pattern and
  has not been propagated to Freeport, Jenner, Eel or Tuolumne.
- Russian River's live reading uses station-and-quantity matching because its binding has no
  time-series ID; the inspect drawer labels this.
- The site has no favicon (404 on every page).
- Human visual acceptance is open.
