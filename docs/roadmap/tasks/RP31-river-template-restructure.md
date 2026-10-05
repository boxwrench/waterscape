# RP31: River template and modular structure

## Scope

User direction: define a shared River Pulse template with Russian River as the reference (a river map view and 3-4
3D scenes: start, scenic middle, end, each with a few views), a cohesive visual language that leaves room for richer
data, a hierarchical and modular folder structure, and a full documentation revision so a new contributor can make a
river with an AI partner. Hard requirement: do not lose any 3D data or model. Staged, aggressive. Spec:
[river template design](../../superpowers/specs/2026-10-05-river-template-design.md).

## Done

1. Restore point (git tag `pre-restructure-2026-10-05`) and a SHA-256 inventory of every `river-pulse/` file.
2. `river-pulse/` restructured with `git mv` and automatic reference rewriting (tools and the move table in
   `docs/archive/restructure-2026-10-05/`): `app/`, `core/`, `scene-kit/`, `ui/`, `rivers/<river>/scenes/<slot>/<place>/`.
3. Data layer: `river.json` 0.2 (ordered slots), `scene.json` per slot (built or planned, views, data flags), planned
   placeholders for every empty slot, registry builder and package validator rewritten for the layout, build discovers scenes.
4. River home shows start / middle / end cards with planned placeholders; atlas reads the same package loader.
5. `ui/tokens.css`; the build follows CSS `@import`; old scene URLs are emitted as redirects.
6. Documentation rewritten: [docs/river-pulse/](../../river-pulse/README.md) (structure, style, data, make a river, working with AI),
   per-river and per-scene READMEs, a fresh handoff, root README / AGENTS.md / architecture updated, history archived.
   `scripts/check-doc-links.mjs` added.

## Checks

- `node --test "pipeline/tests/*.test.mjs"`: 179 pass. `python -m pytest pipeline/tests -q`: 39 pass.
- `python pipeline/build_river_registry.py --check`, `npm run validate`, `npm run test:build`, `node scripts/check-doc-links.mjs`.
- Edge: atlas, six river homes and five scenes load with no failed request or console error; scenes render.
- Hash check: all 33 binary/data assets identical at their new paths; `freeport-bridge-layout.js` identical; `freeport-bridge.js` differs
  only in its vendor import depth.

## Remaining

- Human acceptance. River map view page. Fill planned slots (start with the East Fork). Move shared chrome from scene stylesheets into `ui/`.
- `scripts/verify-river-pulse.mjs` still cannot run on Windows (static server path); predates this task.
