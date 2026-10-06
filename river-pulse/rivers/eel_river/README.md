# Eel River

A Lower Eel reach at Scotia Bluffs: native 3DEP terrain with a 1 m USGS lidar crop at the hero cameras, mapped river footprint and illustrative water.

Status: **in development**. A first visual study of Scotia Bluffs: the Eel's river bend, gravel bars and steep valley sides. Review the landforms before detailed vegetation and water work.

## Scenes

<!-- slots: generated from river.json and scene.json files; run node scripts/sync-river-readmes.mjs -->
| Slot | Scene | Status | Data | Views |
|---|---|---|---|---|
| start | Lake Pillsbury and Scott Dam outflow | **planned** | n/a | n/a |
| middle | [Scotia Bluffs visual study](scenes/middle/scotia_bluffs/README.md) | built | fine terrain | Overview, Bluffs, Eye level, Shoreline, Bend |
| end | Eel River estuary and mouth (near Ferndale) | **planned** | n/a | n/a |
<!-- /slots -->

## Sources

- [National Wild and Scenic Rivers System](https://www.fws.gov/rivers/river/eel)

## Layout

`river.json` lists the slots in order. Each scene lives in `scenes/<slot>/<place_id>/` with a `scene.json`; built scenes add `index.html`, their code, `thumb.jpg` and `data/`. The map view is a planned part of the template (`map.status` in `river.json`).
