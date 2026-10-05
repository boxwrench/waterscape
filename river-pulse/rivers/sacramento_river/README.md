# Sacramento River

Lower-river reach at Freeport, tidally influenced, with a detailed closed green steel bridge and live USGS discharge with a 30-day tidally filtered history.

Status: **available**. Explore the Sacramento River at Freeport: green steel, tree-lined levees and a broad reflective channel, alongside sourced USGS discharge.

## Scenes

<!-- slots: generated from river.json and scene.json files; run node scripts/sync-river-readmes.mjs -->
| Slot | Scene | Status | Data | Views |
|---|---|---|---|---|
| start | Start (to be chosen) | **planned** | n/a | n/a |
| middle | Middle (to be chosen) | **planned** | n/a | n/a |
| end | [Freeport](scenes/end/freeport/README.md) | built | live gauge, history | Bridge, Riverbank, Terrain |
<!-- /slots -->

## Sources

- [California DWR Sacramento River region](https://water.ca.gov/-/media/DWR-Website/Web-Pages/Work-With-Us/Grants-And-Loans/Sustainable-Groundwater/Technical-Assistance/Educational-Material-Dec-2022/Sacramento_River_Lesson_Plan_11_11_22.pdf)
- [USGS Sacramento River at Freeport](https://waterdata.usgs.gov/monitoring-location/USGS-11447650/)

## Layout

`river.json` lists the slots in order. Each scene lives in `scenes/<slot>/<place_id>/` with a `scene.json`; built scenes add `index.html`, their code, `thumb.jpg` and `data/`. The map view is a planned part of the template (`map.status` in `river.json`).

---

## Notes from build history

Sacramento is the second River Pulse river with a local scene (RP13). San Joaquin, Eel, Tuolumne
and American are river-level placeholders, with no fabricated gauges, anchors or scenes.
The river atlas at `/river-pulse/` discovers packages from the generated registry.
Hacienda and Jenner retain their existing scene URLs.

## First data place: Freeport

The [USGS station record](https://waterdata.usgs.gov/monitoring-location/USGS-11447650/)
supplies the WGS84 gauge anchor: latitude 38.4556638888889, longitude -121.501616666667.
This is not a bank camera or bathymetric measurement. UTM zone 10 is the planned terrain CRS.

The [USGS listing](https://waterdata.usgs.gov/nwis/uv?site_no=11447650) distinguishes
discharge and tidally filtered discharge. API requests verified on 2026-10-03 found:

- Latest continuous `00060`, statistic `00011`, series `ae75783b6205495e91cbd943f34d2718`.
- Daily `72137`, statistic `00003`, series `1edf86cd546c47d3ab2e967d9a90af76`.
- The tested September daily `00060` request returned no records.

Verification URLs:

- https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items?monitoring_location_id=USGS-11447650&parameter_code=00060&f=json
- https://api.waterdata.usgs.gov/ogcapi/v1/collections/daily/items?monitoring_location_id=USGS-11447650&datetime=2026-09-01/2026-10-02&limit=1000&f=json

The atlas fetches live records without committing readings. It matches station,
parameter, statistic, series, unit and evidence type before selection. Latest-at-or-before uses a 45-minute
display freshness threshold (an application policy), rejects future readings and
discloses stale/missing data. Daily means preserve `tidally_filtered_discharge` and
source metadata. Charts use the last 30 completed UTC dates and leave gaps open. UTC
daily intervals follow the existing adapter convention, not a new assertion about the
source's local aggregation boundary. The source date remains visible in each record.

## Visual scope and next work

Observation and daily chart bindings are Exact to selected source quantities; daily
means remain derived statistics. Freeport data does not describe the downtown waterfront
or every reach. No discharge-to-depth, stage, velocity or flood conversion is made.
RP13 adds the [first Freeport scene](./scenes/end/freeport/README.md): an approximate
photo-informed bridge/bank setting and a separate 3DEP/3DHP/NAIP terrain view.

Next: review/refine Freeport and choose the next local Sacramento viewpoint. Lengths are omitted from factual UI
until the different definitions in the initial brief have an authoritative source.
