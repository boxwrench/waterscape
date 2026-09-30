# Visual workspace

The Hacienda interface gives most of the screen to the landscape, with a compact selected-flow
readout, a bottom history deck and an on-demand evidence drawer. Map preserves source terrain;
tint is a cartographic elevation mapping. Its blue water ribbon widens/narrows with selected
discharge within loaded history, with seasonal-color margins and exaggerated moving detail.
Bridge and Hacienda Beach show a separate photo-informed local setting with optical green
water. Neither scene simulates local hydraulics. See
[authored-water notes](authored-water.md) for the binding, geometry and source distinctions.

## Interactions

- **Map / Bridge / Hacienda Beach:** source terrain overview and two local authored compositions. Switching between source and authored scene spaces is immediate; transitions within one space ease unless reduced motion is enabled. Beach movement stays bounded near the dry shoreline at eye height.
- **Drag / scroll / WASD:** look, move closer and fly. Focused form controls keep their keyboard behavior. Pointer cancellation and window blur clear camera input.
- **River / elevation tint:** toggle water/river symbols; elevation tint applies to Map.
- **Explore:** hide data panels temporarily to give the landscape the full screen.
- **Timeline / play / now:** compare daily historical values, play the available history, then return to the latest eligible continuous observation. Missing days break the hydrograph line.
- **Inspect data:** examine selected value, valid interval, evidence, quality, method, source, retrieval/availability and selection policy, plus Map width/motion disclosure. Click Map terrain for its coordinate/elevation readout. Authored views label their local setting rather than reporting surveyed elevation.
- **Mobile:** compact live readout and expandable chart. Camera buttons remain available; data inspection opens as a drawer.

The page supports WebGPU and Three.js's WebGL2 backend. Data remains accessible if both graphics paths fail. Live USGS refresh runs once a minute while the page is visible; viewing a historical date is not interrupted by current-value refreshes.

## Local verification

```sh
npm ci
python -m pip install numpy scipy Pillow pytest
npm run build
npx playwright install chromium
node scripts/verify-river-pulse.mjs
```

The browser checker creates its own local server. `RIVER_PULSE_BROWSER=/path/to/chromium` optionally selects an installed browser. It verifies the production page, uses the real generated terrain, and intercepts hydrology with explicitly synthetic test fixtures. Screenshots in `previews/river-pulse-ui/` therefore demonstrate interaction/layout, not current river conditions. Neither the test fixtures nor screenshots are included in the published site.

CI validates the committed, sourced Hacienda terrain and checks the built interface.
Terrain regeneration is an explicit data update, not a deployment dependency.

## Scope

This remains a prototype with real source terrain/data and an approximate authored Hacienda
setting: gray steel bridge, left-pier rock outcrop, gray pebbles, grouped woodland, reflective
green water and modeled bed. Surveyed bathymetry, locally resolved currents, water-level-driven
shorelines and Jenner's renderer remain future work. Time selection changes scientific state
and the Map width/category, not the authored beach shoreline. Native target GPU performance
remains unmeasured; software WebGL2 checks do not establish a hardware frame-rate budget.
