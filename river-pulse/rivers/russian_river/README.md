# Russian River

Reference river. This is the worked example for the River Pulse template: a built start below the dam, a scenic middle with live data, history and seasonal condition, a built end where the river meets the sea, and a river map with a pin for each. Copy its shape for a new river; see [Make a river](../../../docs/river-pulse/make-a-river.md).

Status: **available**. Follow the Russian River from the East Fork below Lake Mendocino, to Hacienda Bridge in the middle, to the estuary at Jenner.

## Scenes

<!-- slots: generated from river.json and scene.json files; run node scripts/sync-river-readmes.mjs -->
| Slot | Scene | Status | Data | Views |
|---|---|---|---|---|
| start | [East Fork below Coyote Valley Dam](scenes/start/east_fork/README.md) | built | geography only | Riverbank, Below the outlet, Map |
| middle | [Hacienda Bridge](scenes/middle/hacienda_bridge/README.md) | built | live gauge, history, condition, extremes | Map, Bridge, Hacienda Beach |
| end | [Jenner Estuary](scenes/end/jenner/README.md) | built | live gauge | Estuary lookout, River shore, Pacific beach |
<!-- /slots -->

The river map (`map/overview.json`, from USGS 3DHP centerlines) is drawn by `scene-kit/river-map.js` as a pinned inset in each scene. Lake Mendocino's reservoir outline is not bundled; the East Fork is the river below the dam.

## Sources

- [Sonoma Water estuary](https://www.sonomawater.org/russian-river-estuary)

## Layout

`river.json` lists the slots in order. Each scene lives in `scenes/<slot>/<place_id>/` with a `scene.json`; built scenes add `index.html`, their code, `thumb.jpg` and `data/`. The map view is a planned part of the template (`map.status` in `river.json`).
