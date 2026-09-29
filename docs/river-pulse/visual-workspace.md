# Visual workspace

The Hacienda interface now gives most of the screen to the landscape, with a compact selected-flow readout, a bottom history deck and an on-demand evidence drawer. The terrain preserves its source elevation; tint is a cartographic elevation mapping. The river stroke is a fixed display width and changes category color through the existing seasonal visual binding. It does not simulate local hydraulics.

## Interactions

- **Valley / gauge views:** smooth camera transitions aimed toward the configured gauge; immediate under reduced-motion preference.
- **Drag / scroll / WASD:** look, move closer and fly. Focused form controls keep their keyboard behavior. Pointer cancellation and window blur clear camera input.
- **River / elevation tint:** toggle the cartographic overlays.
- **Explore:** hide data panels temporarily to give the landscape the full screen.
- **Timeline / play / now:** compare daily historical values, play the available history, then return to the latest eligible continuous observation. Missing days break the hydrograph line.
- **Inspect data:** examine selected value, valid interval, evidence, quality, method, source, retrieval/availability and selection policy. Click terrain for its coordinate/elevation readout.
- **Mobile:** compact live readout and expandable chart. Camera buttons remain available; data inspection opens as a drawer.

The page supports WebGPU and Three.js's WebGL2 backend. Data remains accessible if both graphics paths fail. Live USGS refresh runs once a minute while the page is visible; viewing a historical date is not interrupted by current-value refreshes.

## Local verification

```sh
npm ci
python -m pip install numpy scipy Pillow pytest
python pipeline/build_river_terrain.py river-pulse/data/russian_river/places/hacienda_bridge/source.json
python pipeline/build_river_hydrography.py river-pulse/data/russian_river/places/hacienda_bridge/source.json
npm run build
npx playwright install chromium
node scripts/verify-river-pulse.mjs
```

The browser checker creates its own local server. `RIVER_PULSE_BROWSER=/path/to/chromium` optionally selects an installed browser. It verifies the production page, uses the real generated terrain, and intercepts hydrology with explicitly synthetic test fixtures. Screenshots in `previews/river-pulse-ui/` therefore demonstrate interaction/layout, not current river conditions. Neither the test fixtures nor screenshots are included in the published site.

CI validates the committed, sourced Hacienda terrain and checks the built interface.
Terrain regeneration is an explicit data update, not a deployment dependency.

## Scope

This remains a terrain-and-data preview. Vegetation, bridge assets, surveyed bathymetry, a detailed river surface and Jenner's authored renderer are subsequent content/rendering work. This change does not merge the old separate TypeScript scaffold or rewrite the existing package architecture.
