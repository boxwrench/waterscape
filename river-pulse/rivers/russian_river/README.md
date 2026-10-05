# Russian River

Reference river. This is the worked example for the River Pulse template: a planned start, a built scenic middle with live data, history and seasonal condition, and a built end where the river meets the sea. Copy its shape for a new river; see [Make a river](../../../docs/river-pulse/make-a-river.md).

Status: **available**. Follow the Russian River from a planned start at the East Fork, to Hacienda Bridge in the middle, to the estuary at Jenner.

## Scenes

<!-- slots: generated from river.json and scene.json files -->
| Slot | Scene | Status | Data | Views |
|---|---|---|---|---|
| start | East Fork (Lake Mendocino area) | **planned** | n/a | n/a |
| middle | [Hacienda Bridge](scenes/middle/hacienda_bridge/README.md) | built | live gauge, history, condition | Map, Bridge, Hacienda Beach |
| end | [Jenner Estuary](scenes/end/jenner/README.md) | built | live gauge | Estuary lookout, River shore, Pacific beach |
<!-- /slots -->

The **start** slot is reserved for the East Fork of the Russian River near Lake Mendocino. It is a named placeholder: no scene, terrain or sources exist for it yet.

## Sources

- [Sonoma Water estuary](https://www.sonomawater.org/russian-river-estuary)

## Layout

`river.json` lists the slots in order. Each scene lives in `scenes/<slot>/<place_id>/` with a `scene.json`; built scenes add `index.html`, their code, `thumb.jpg` and `data/`. The map view is a planned part of the template (`map.status` in `river.json`).
