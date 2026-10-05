# San Joaquin River

Planned. The river has a reserved place in the atlas; every slot is a placeholder.

Status: **planned**. A future river experience following the Sierra Nevada's water into the Central Valley.

## Scenes

<!-- slots: generated from river.json and scene.json files -->
| Slot | Scene | Status | Data | Views |
|---|---|---|---|---|
| start | Start (to be chosen) | **planned** | n/a | n/a |
| middle | Middle (to be chosen) | **planned** | n/a | n/a |
| end | End (to be chosen) | **planned** | n/a | n/a |
<!-- /slots -->

## Sources

- [San Joaquin River Restoration Study](https://restoresjr.net/wp-content/uploads/2025/05/2390___Chapter1-Introduction.pdf)

## Layout

`river.json` lists the slots in order. Each scene lives in `scenes/<slot>/<place_id>/` with a `scene.json`; built scenes add `index.html`, their code, `thumb.jpg` and `data/`. The map view is a planned part of the template (`map.status` in `river.json`).
