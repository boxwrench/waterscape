# Tuolumne River

The valley below O'Shaughnessy Dam at Poopenaut, with native terrain, shared river water and the original Hetch Hetchy reservoir context at the dam.

Status: **in development**. Yosemite's high Sierra meadows, granite canyons and Hetch Hetchy, connected by the river.

## Scenes

<!-- slots: generated from river.json and scene.json files -->
| Slot | Scene | Status | Data | Views |
|---|---|---|---|---|
| start | [Poopenaut Valley form study](scenes/start/poopenaut_valley/README.md) | built | geography only | Overview, Valley, Eye level, River contact, Dam transition, Dam close-up, Below dam, Reservoir |
| middle | Middle (to be chosen) | **planned** | n/a | n/a |
| end | End (to be chosen) | **planned** | n/a | n/a |
<!-- /slots -->

## Sources

- [National Wild and Scenic Rivers System](https://www.fws.gov/rivers/river/tuolumne)
- [NPS Tuolumne River Plan / Poopenaut Valley](https://www.nps.gov/yose/getinvolved/trp.htm)
- [California Water Boards / state CalWater watershed mapping](https://gispublic.waterboards.ca.gov/portalserver/rest/services/Hydrology/CalWater_Boundaries/MapServer)
- [OpenTopography / NCALM Poopenaut 1 m lidar availability](https://portal.opentopography.org/datasetMetadata?otCollectionID=OT.022013.26911.1)

## Layout

`river.json` lists the slots in order. Each scene lives in `scenes/<slot>/<place_id>/` with a `scene.json`; built scenes add `index.html`, their code, `thumb.jpg` and `data/`. The map view is a planned part of the template (`map.status` in `river.json`).
