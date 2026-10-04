# RP11: Add river atlas and Sacramento data foundation

## Scope

Add the five requested rivers: Sacramento as the next detailed river, with San Joaquin,
Eel, Tuolumne and American placeholders. Preserve the Russian River scenes. Introduce
river-level manifests and generated discovery, an accessible atlas, and a first Freeport
place with separately labeled instantaneous discharge and tidally filtered daily history.
Do not publish or claim a completed Sacramento 3D scene. Do not copy approximate river
lengths into factual UI until a consistent authoritative definition is selected.

## Design

Use river-blue (#227886), pale water (#e6f0ef), deep teal (#193b43), riparian green
(#50766b) and slate (#536b71). Georgia titles and system sans body type. A left-aligned
river list beside a generous selected-river panel replaces generic equal-sized cards;
the sourced hydrograph is the central visual. Mobile stacks the list above the panel.
No decorative map implying surveyed geography, external fonts or autonomous motion.

## Steps

1. Add river manifests, discover/validate them at build time, and register Freeport.
2. Build the atlas and first Sacramento observation/history panel using existing
   quantity, selection, state and hydrograph machinery. Preserve source parameters.
3. Add atlas navigation to the existing scenes and include assets in production.
4. Document the Sacramento source foundation and remaining terrain/setting work.

## Checks

- `node --test "pipeline/tests/*.test.mjs"`
- `python -m pytest pipeline/tests/test_river_registry.py -q`
- `python pipeline/build_river_registry.py --check`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Inspect atlas desktop/mobile, selected placeholders, source evidence and error states.
