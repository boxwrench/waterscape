# RP26: Correct Eel water reflection contact

Continue the RP25 experiment after the user's instruction to go on. Isolate the
bright angular band in fixed eye/shore views using actual browser diagnostics,
then implement the smallest supported correction. Reuse three cheaper agents
for read-only reflection and contact audits plus an exclusive review gallery.
Root owns runtime integration and actual visual verification. Preserve the
previous-water default, RP25 depth model, geography, terrain elevations, forest,
light, v1 cameras, source/form modes and featured California context. Preserve
Hacienda defaults. Do not merge, push or edit engine, kernel or vendor files.

Bounded acceptance question: can close water/shore views lose the introduced
bright band while retaining useful main-view reflections and shallows? Keep
diagnostic evidence separate from final renders; do not hide source geometry
problems or claim surveyed stage/depth. No cross-river adoption or unrelated
terrain/forest changes in this pass.

## Checks

- `node --test pipeline/tests/eel-water-optics.test.mjs pipeline/tests/eel-setting.test.mjs pipeline/tests/eel-scene.test.mjs pipeline/tests/eel-state-sources.test.mjs`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Actual settled desktop/phone Bluffs, eye and shore before/after pairs; overview,
  bend, form/source, California context, baseline fallback, motion/pause and errors.
- Matched 12-warmup/120-frame cost samples, named estimates and unmeasured GPU cost.
- `git diff --check`

Record critique, unresolved limits and explicit acceptance checkpoint. Commit the
implementation with this task title, then append and separately commit Result.

## Result

- Status: done (bounded correction; residual contact still visibly weak).
- Commit: `3956dd1`.
- Checks: four focused Eel suites listed above: 15 pass, 0 fail. Initial sandbox
  worker spawn failed with EPERM; elevated retry passed. River package validator:
  `River packages valid.` Build: `Built experience pages and river assets valid.`
  `git diff --cached --check`: exit 0, no output.
- Notes: six matched desktop/phone pairs at phase zero, overview/bend/form/source,
  motion and pixel-identical paused frames, plus Hacienda smoke inspected. Broad
  white patches are strongly reduced; thin bright rim, distorted reflection and
  coarse bank remain. No added triangles/draw calls; GPU allocation/time unknown.
  Three agents supplied audits/gallery/checks. No merge/push in this pass. The
  subsequent user request authorizes Eel default adoption and RP23 integration
  in the next task; it does not turn this shoreline into reservoir visual parity.
