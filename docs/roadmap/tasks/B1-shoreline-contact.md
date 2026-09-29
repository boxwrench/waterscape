# B1: Organic shoreline contact with ebb and flow

User-requested. Design: [shoreline contact](../../design/specs/2026-09-29-shoreline-contact-design.md).
Water currently meets the bank along straight lines; make the contact organic with a
slight ebb and flow tied to wave energy, without slowing the renderer.

1. Explicitly permitted edits: `renderer/water.cu` (contact-zone bank function, edge
   test, ebb, wave damping, wet band) and `renderer/engine/waterscape.js` (pass
   `settings.energy` to `render_water` only). Do not edit `vendor/`, `pipeline/dem.py`,
   the bundles or `renderer/land/ground.js`.
2. Measure `render_water` GPU time on `main` first (P2 method: temporary instrumentation,
   not shipped) at the Shoreline, ridge and overlook viewpoints on all three tiers.
3. Implement per the design. Tune at each reservoir's Shoreline viewpoint.
4. Re-measure. The change passes only if `render_water` stays within measurement noise
   (target ≤ 2 %). If not, reduce per the design's fallback order and re-measure.
5. Add the Shoreline contact row and the shoreline note to
   `docs/making-water-visible.md`.
6. Run `node --test "pipeline/tests/*.test.mjs"`, `node pipeline/validate-bundles.mjs`,
   `npm run check`, `npm run build` and `git diff --check`; `npm test` where the browser
   environment allows. Record screenshots, timings and limitations, then commit.
   Do not push or merge.
