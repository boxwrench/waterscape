# B1: Organic shoreline contact with ebb and flow

User-requested. Design: [shoreline contact](../../design/specs/2026-09-29-shoreline-contact-design.md).
Water currently meets the bank along straight lines; make the contact organic with a
slight ebb and flow tied to wave energy, without slowing the renderer.

1. Explicitly permitted edits: `renderer/water.cu` (contact-zone bank function, edge
   test, ebb, wave damping, wet band) and `renderer/engine/waterscape.js` (pass
   `settings.energy` to `render_water` only) and `Native/main.cu` (append that argument
   to its `render_water` call only). Plan:
   [shoreline contact plan](../../design/plans/2026-09-29-shoreline-contact.md). Do not edit `vendor/`, `pipeline/dem.py`,
   the bundles or `renderer/land/ground.js`.
2. Timing is light by user request: median `diag.frameMs` at the Shoreline viewpoint,
   medium tier, on `main` and on the branch.
3. Implement per the design. Tune at each reservoir's Shoreline viewpoint.
4. Re-measure. If the branch is clearly slower, reduce per the design's fallback order
   and re-measure.
5. Add the Shoreline contact row and the shoreline note to
   `docs/making-water-visible.md`.
6. Run `node --test "pipeline/tests/*.test.mjs"`, `node pipeline/validate-bundles.mjs`,
   `npm run check`, `npm run build` and `git diff --check`; `npm test` where the browser
   environment allows. Record screenshots, timings and limitations, then commit.
   Do not push or merge.

## Result
- Status: done (pending the user's visual review)
- Commit: cc9dd04
- Checks:
  - `npm run check`: all kernels compile (`render_water: 99950 WGSL bytes`).
  - `node --test "pipeline/tests/*.test.mjs"`: `ℹ fail 0` (95 passed).
  - `node pipeline/validate-bundles.mjs`: `Bundles valid.`
  - `npm run build`: `Built Pages with 78 browser modules, shared CUDA source and licensed assets.`
  - `git diff --check`: no output.
  - Headless Chrome (WebGPU, AMD RDNA3, high tier, 1152 px) at a Calaveras bank
    30 m offshore (`pose=-783.643,1.8,246.876,3.436,-0.07`): `errors: []`. Before/after
    frames show the straight waterline replaced by an irregular edge that moves between
    t = 20, 22 and 24 s.
  - Light timing, median `diag.frameMs`, same pose, two alternating runs:
    main 5.50 / 6.58 ms, branch 6.55 / 6.62 ms — within this setup's run-to-run noise.
- Notes: Contact zone widened to 8 m and warp to ~2.5 m after the first look (1.4 m still
  read as straight from 30 m). Where the shader's bank shows in front of the land pass's
  hit, it keeps the land pass's colour; shading it with the shader palette left a grey
  strip. Not checked: San Antonio, Windows Chrome/Edge timing, native host build, full
  `npm test` (Edge browser suite).
