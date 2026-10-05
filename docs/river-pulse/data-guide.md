# Data guide

How data flows into a scene and how to keep it honest. For the full architecture and schemas see the
[implementation contract](./reference/implementation-contract.md); for mistakes already made once, see
[known traps](./reference/known-traps.md). The principle behind all of it is [Making Water Visible](../making-water-visible.md).

## The one rule

> Real data is the backbone. Science determines the relationships. Visuals make the relationships visible,
> and are labelled when they are interpretation.

```
source records -> adapters -> normalised quantities (+provenance) -> selection policy
   -> RiverState(valid time) -> visual binding -> scene, labels, charts
```

Scientific state and presentation stay separate. A shader, particle system or chart reads quantities through a declared
binding. It never redefines them.

## What goes where

| Layer | Folder | Rule |
|---|---|---|
| Adapters | `core/adapters/` | Fetch and normalise one source. Keep provenance (station, parameter, series, statistic, retrieval time). No DOM. |
| Data model | `core/data-model/` | Quantities, deterministic selection, `RiverState`, place and river loaders. |
| Visual bindings | `core/visual-bindings/` | Turn state into display text, chart paths and styling. Never mutates quantities. |
| Place-specific bindings | the scene folder | A binding tied to one gauge, such as Freeport's discharge, stays in that scene. |
| Sourced files | the scene's `data/` | `place.json`, `source.json`, terrain, hydrography, setting assets. |

## Data sources used today

| Source | Used for | Adapter |
|---|---|---|
| USGS Water Data (latest continuous, daily values) | Current discharge or level, 30-day history | `core/adapters/usgs.js` |
| USGS day-of-year statistics | Seasonal condition context | `core/adapters/usgs-statistics.js` |
| USGS 3DEP elevation | Terrain (NAVD88), via `pipeline/build_river_terrain.py` | build time |
| USGS 3DHP / California DWR major rivers | River centerlines | `pipeline/build_river_hydrography.py`, `core/adapters/dwr-hydrography.js` |
| USGS/USDA NAIP | Aerial colour context | build time |
| California CalWater (State Water Boards) | Watershed boundaries in the Eel and Tuolumne scenes | build time |

Rules for sources: record the URL and retrieval time next to every number copied from one; never infer a value you
could not fetch; label a service-resampled image as such (a 1 m-spaced image is not 1 m geometry); a failed request
does not prove absence of data.

## Quantities, time and selection

- A **quantity** says what is known (feature, phenomenon, value, unit, evidence type, time, method, quality), not how it is drawn.
- Times are explicit: **valid time** (when the condition applies) and **as-of time** (what was knowable then). Keep each
  source's own time semantics.
- **No generic "best available".** A binding declares a policy, such as "latest eligible observation at or before the requested time
  within a maximum age, otherwise missing". Freeport's policy is 45 minutes. The result is a current, stale or missing state,
  which the data card shows as in the [style guide](./style-guide.md#data-states).
- Keep different gauge products separate even when units match. Freeport's instantaneous discharge and tidally filtered daily
  discharge are different products and are matched exactly by series ID (`core/data-model/binding-series.js`).
  Where a binding has no series ID, as in Hacienda's, matching falls back to station and quantity, and the inspect drawer says so.

## Places and capabilities

`data/place.json` declares what a place is **designed to support** (`supported_capabilities`) and which sources are installed
(`data_bindings`). *Supported is not the same as available.* The UI must not imply a mode is available when its data is absent.

Minimal `place.json`:

```json
{
  "schema_version": "river-pulse-place-0.1",
  "minimum_engine_version": "0.1.0",
  "id": "hacienda_bridge",
  "river_pack": "russian_river",
  "name": "Hacienda Bridge",
  "hydrologic_context": "river_reach",
  "anchor": { "latitude": 38.508, "longitude": -122.928 },
  "horizontal_crs": "EPSG:32610",
  "supported_capabilities": ["observed_discharge", "historical_discharge"],
  "data_bindings": [
    { "id": "hacienda_discharge", "adapter": "usgs_water_data", "feature_id": "USGS-11467000",
      "parameter_code": "00060", "phenomenon": "discharge" }
  ]
}
```

## Terrain and centerlines

Rivers have absolute elevation, not a reservoir-relative surface. Terrain is NAVD88 metres from 3DEP in a local UTM frame
pinned to the anchor, with no single still-water level and no invented bathymetry.

```sh
python pipeline/build_river_terrain.py      river-pulse/rivers/<river>/scenes/<slot>/<id>/data/source.json
python pipeline/build_river_hydrography.py  river-pulse/rivers/<river>/scenes/<slot>/<id>/data/source.json
python pipeline/build_river_registry.py     # then --check
npm run validate                            # layout, terrain sizes, centerlines, registry
```

`source.json` needs `id`, `name`, `anchor` `[lat, lon]`, `bbox` `[west, south, east, north]` and `size` `[width, height]`. Only rebuild
terrain deliberately: the builder fetches USGS elevation and records the service, crop, projection and encoding in `terrain.json`.
Do not feed river terrain into the reservoir water kernel; the kernel expects reservoir-relative heights and a signed shoreline.

## Choosing the fidelity

Let the data decide how much a scene earns. Mark it in `scene.json` `data` and the `fidelity` string.

| You have | Then the scene can |
|---|---|
| Terrain and centerline only | Show native form and an illustrative river. Say so. No data card. |
| A live gauge | Add a data card with current, stale and missing states |
| A daily series | Add a sparkline or hydrograph, labelled as a daily mean |
| Statistics | Add the condition band, as "compared with this time of year" |
| Fine terrain (lidar) | Spend it on a few hero cameras. Do not claim it for the whole extent |

New presentation of data (a forecast chart, a rainfall layer) is a new component that a scene opts into. It is added in
`core/visual-bindings/` (the mapping) and `ui/` (the look), and declared by a new `data` flag in `scene.json`, so existing
scenes do not change.

## Honesty checklist

Before a data-bearing change ships:

- Every displayed number comes from a fetched record or is labelled illustrative or authored.
- Stale, missing and unavailable are distinct and visible; nothing is silently substituted.
- Illustrative water, bed, colour and motion are labelled; discharge does not claim to drive local hydraulics unless a model exists.
- Source URL, retrieval time and approval status (provisional or approved) are reachable from the evidence drawer.
- A source outage degrades gracefully: graphics failure must not hide data, and data failure must not hide graphics.
