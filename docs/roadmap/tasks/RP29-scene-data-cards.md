# RP29: Scene data cards and placeholder favicon

## Scope

Follow-on to RP28 for the 3D scene pages' data communication. No renderer, water, terrain or
camera change.

1. A stale gauge reading keeps its last value prominent (muted gold) with the note
   "No current reading · last value <time>", instead of replacing the number with
   "No current reading". Shared `flowDisplay()` in `visual-bindings/flow-status.js`, used by
   Freeport's card and Hacienda's discharge card. Current and missing wording is unchanged.
2. Freeport's discharge card gains a 30-day tidally filtered daily-discharge sparkline, from
   the same exact-bound series as the river home, labelled as a separate product from the
   instantaneous value. Failure leaves the card unchanged.
3. Placeholder inline SVG favicon on the atlas and river home (the site had none).

## Checks

- `node --test "pipeline/tests/*.test.mjs"` (179 pass, includes `flow-display.test.mjs`).
- `npm run test:build`.
- Edge captures of all five scenes at 1280 and 390: no page errors or failed requests.
  Evidence in `previews/river-pulse/rp29/`.
- `scripts/verify-river-pulse.mjs` could not run: on Windows its static server returns 404
  for `dist/` (path built from `URL.pathname`). Not caused by this task; not fixed here.

## Remaining

- Jenner has no history; Eel and Tuolumne have no gauge and still show developer "Review tools
  & runtime cost" controls to all visitors. Hiding those behind a review flag would change the
  review workflow and needs a decision.
- Camera button rows differ in style between scenes.
- Human visual acceptance is open.
