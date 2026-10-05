# RP30: Scene chrome consistency (Eel and Tuolumne)

## Scope

CSS and header markup only; no renderer, water, terrain or camera change.
Eel and Tuolumne now match Freeport, Jenner and Hacienda: the wave-icon brand, a glass
Evidence button, the segmented glass camera control (wraps on Tuolumne's eight views; full
width on phone) and a quieter collapsed "Review tools & runtime cost" control (still present,
still opens as before, so the review workflow is unchanged).

## Checks

- `node --test "pipeline/tests/*.test.mjs"`, `npm run test:build`.
- Edge captures at 1280 and 390: no page errors or failed requests (`previews/river-pulse/rp30/`).

## Remaining

- Hacienda, Jenner and Freeport still use their own header/button implementations; they match
  visually but not in code. Extracting one shared stylesheet would touch every scene.
- Human visual acceptance is open.
