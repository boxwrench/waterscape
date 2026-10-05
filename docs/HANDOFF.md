# Handoff

The current state of the project and where to pick up. Add a short entry at the top for each pass; when this grows past a
few screens, move older entries to `docs/archive/`. History through RP30 is in [`archive/HANDOFF-through-RP30.md`](./archive/HANDOFF-through-RP30.md).

## River template and modular structure: RP31 (2026-10-05)

Branch `task/RP31` (built on `task/RP27`, which merged the Tuolumne work). Local only: nothing pushed or merged. Pending human
review of the new layout and docs.

**What changed.** `river-pulse/` was reorganised around the river template: every river has a start, a scenic middle and an end,
each a scene folder `rivers/<river>/scenes/<slot>/<place>/` holding its page, code, sourced data, notes and thumbnail. Shared code
moved to `core/` (adapters, data model, visual bindings), `scene-kit/` (shared 3D) and `ui/` (tokens and chrome); the atlas and
river home are in `app/`. Unbuilt slots are explicit `planned` placeholders (Russian River's start is the East Fork near Lake
Mendocino; nothing is built there yet). The river home now shows start / middle / end cards, with dashed planned cards.
The documentation was rewritten from scratch: [`docs/river-pulse/`](./river-pulse/README.md) has the Structure, Style, Data,
Make-a-river and Working-with-AI guides, with durable references under `reference/` and the old per-pass reviews moved into
the scene folders (`notes/`) or `docs/archive/`.

**No 3D data was lost.** A SHA-256 inventory of every file under `river-pulse/` was recorded before the move
([`archive/restructure-2026-10-05/asset-inventory.sha256`](./archive/restructure-2026-10-05/asset-inventory.sha256)). All 33 binary and data assets
(terrain, trees, textures, GeoJSON) are byte-identical at their new paths. At the moment of the move, the 46 text files that changed differed only in
rewritten import/path strings (+162/-162 lines); later edits (registry, validators, river home, docs) are separate commits. The Freeport bridge model is `rivers/sacramento_river/scenes/end/freeport/freeport-bridge.js` and
`freeport-bridge-layout.js`; the former is identical apart from its vendor import depth, the latter is byte-identical. The restore
point is the git tag `pre-restructure-2026-10-05`; the move tools are kept in `docs/archive/restructure-2026-10-05/`.

**Also in this pass.**
- Stale gauge readings show their last value, muted, in Freeport and Hacienda (shared `flowDisplay()`); Freeport gained a 30-day sparkline.
- Eel and Tuolumne chrome now matches the other scenes; shared `ui/tokens.css` and `ui/study-scene.css`.
- Old scene URLs (`river-pulse/renderer/<scene>.html`) are emitted as redirects by the build.
- The build finds scenes by walking `rivers/*/scenes/*/*/index.html` and follows CSS `@import`.
- `scripts/check-doc-links.mjs` checks every Markdown link.

**Verified.** 179 unit tests, 39 pipeline tests, `npm run test:build`, the river package validator, the registry check and the doc-link
check pass. Every page (atlas, six river homes, five scenes) loads in Edge with no failed request or console error, and the five scenes render.

**Not verified.** `scripts/verify-river-pulse.mjs` cannot run on Windows (its static server returns 404 for `dist/`); this predates RP31.
GPU timing and phone performance are unmeasured.

### Open items

- **Human acceptance** of the new layout, the river-home cards and the docs.
- **River map view** is defined in the template (`map` in `river.json`) but not built; every river says `planned`.
- **Fill the planned slots**, starting with Russian River's East Fork start. Follow [Make a river](./river-pulse/make-a-river.md). Earlier East Fork work is believed to exist,
  unpushed, on another machine (not in this repo); bring it in rather than rebuilding (see that scene's README).
- **Shared chrome in code**: scene stylesheets still duplicate topbar, data card and view bar styling. Move one component into `ui/` whenever a scene's chrome is touched.
- **Hacienda's data language** (live card, history chart, condition band) should reach Jenner (no daily series exists for its tidal gauge) and the
  terrain-only scenes only where their data supports it.
- **Eel and Tuolumne** still show a small `Review tools & runtime cost` control to every visitor.
- **Tuolumne dam context** costs 62 ms per frame on desktop at the lowest quality tier (see `rivers/tuolumne_river/scenes/start/poopenaut_valley/notes/`).
