# River Pulse — Hacienda terrain spike

## Goal

Prove that Waterscape's mature California terrain/WebGPU path can support a river authored place **without importing reservoir assumptions**.

This is intentionally a bounded spike. It does not implement RiverState, gauge history, forecast models, currents, or final water rendering yet.

## Success criteria

The spike is successful when all of the following are true:

1. A real Hacienda Bridge-area USGS 3DEP crop can be fetched through the existing elevation path.
2. The generated terrain bundle retains absolute elevation and geospatial metadata rather than defining all heights relative to one detected water surface.
3. No reservoir flat-water detector or reservoir centroid is required.
4. The browser can load the bundle with an adapted terrain loader.
5. The existing Three.js/WebGPU land pass can render the terrain.
6. The existing flight camera can navigate the scene with terrain clearance.
7. Scene positions can round-trip to useful latitude/longitude and elevation readouts.
8. The package records CRS, vertical datum, source, build metadata, and schema version.
9. Existing Waterscape reservoir behavior remains unchanged.

## Non-goals

Do not add these to the spike:

- realistic river surface
- current simulation
- foam
- hydraulic depth or velocity
- gauge ingestion
- historical timeline
- Jenner
- NOAA forecasts
- new shared library extraction
- production LOD/streaming

The spike should answer one question: **can River Pulse stand on Waterscape's geospatial/rendering foundation without pretending a river is a reservoir?**

## Proposed implementation shape

Keep existing Waterscape code intact and add a River Pulse experimental path on `river-pulse/bootstrap`.

Suggested structure:

```text
river-pulse/
  README.md
  pipeline/
    build_terrain.py
  data/
    russian_river/
      places/
        hacienda_bridge/
          source.json
          terrain.json
          terrain.bin.gz
  renderer/
    terrain.js
    hacienda.html
    hacienda.js
```

The exact folder names may change if a smaller integration with existing modules is cleaner. Avoid premature framework extraction.

## Terrain contract for the spike

The bundle should preserve absolute source meaning.

Candidate metadata:

```json
{
  "schemaVersion": "river-pulse-terrain-0.1",
  "name": "Hacienda Bridge",
  "source": "USGS National Map 3D Elevation Program (3DEP)",
  "bboxLonLat": [0, 0, 0, 0],
  "crs": "EPSG:...",
  "verticalDatum": "NAVD88 metres (3DEP)",
  "width": 0,
  "height": 0,
  "cell": [0, 0],
  "originUTM": [0, 0],
  "gridOrigin": [0, 0],
  "channels": {
    "elevation": {}
  }
}
```

For this spike, a single elevation channel is sufficient unless retaining an additional terrain derivative materially simplifies rendering. Do not carry `waterLevel`, reservoir shoreline distance, or reservoir valley channels just because Waterscape currently has them.

## Coordinate convention

Prefer compatibility with the existing renderer where practical:

```text
x = east in local metres
z = south in local metres
y = vertical metres
```

Unlike Waterscape, `y=0` must not implicitly mean the reservoir surface.

Choose and document a local vertical origin for numerical/rendering convenience while preserving the absolute NAVD88 transformation in metadata. A scene-local offset is acceptable; losing the absolute relation is not.

## Work sequence

### T1 — Reuse geospatial primitives

Use or adapt:

- `pipeline/dem.py::fetch_dem`
- `pipeline/geo.py`

Do not call `detect_water()`.

### T2 — Emit river-compatible terrain

Create the smallest deterministic encoder that stores the Hacienda crop and enough metadata to reconstruct absolute elevations.

Retain reproducible gzip behavior (`mtime=0`) if the existing packing path is reused.

### T3 — Browser loader

Adapt the Waterscape terrain loader so it can distinguish the new terrain schema without changing current reservoir loading.

Required methods for the spike:

```text
sample elevation
ground(x,z)
latLon(x,z)
elevation(sceneY)
pick(...)
GPU terrain buffer
```

### T4 — Render land

Reuse the existing Three.js/WebGPU land pass if possible.

If the land pass currently assumes `ground()` returns zero over reservoir water, isolate that assumption rather than changing existing Waterscape semantics globally.

### T5 — Navigate

Reuse `renderer/engine/camera.js` where its contract is genuinely terrain-generic.

Create one or two pinned Hacienda camera poses manually for the spike. Do not run reservoir viewpoint search.

### T6 — Evidence and validation

Add a focused validator/test that confirms:

- terrain metadata schema
- expected CRS/datum fields
- finite decoded elevations
- local ↔ lat/lon sanity
- no reservoir `waterLevel` requirement
- existing Waterscape validation/tests remain unaffected

## Stop conditions

Stop and revise the design if any of these appear:

- existing `Terrain` semantics are too tightly coupled to a zero-elevation reservoir surface to adapt safely
- the land pass cannot consume absolute/offset terrain without invasive reservoir-specific changes
- one terrain crop is impractically large enough that tiling must be solved before Hacienda can render
- the proposed bundle cannot preserve the vertical datum/elevation relationship clearly

If one of these occurs, record the failure and choose a smaller generic seam rather than forcing reuse.

## After the spike

Only after the terrain path succeeds:

1. add real Russian River hydrography/reach geometry as a separate layer
2. add one Hacienda gauge adapter
3. implement normalized Quantity + deterministic time selection
4. drive one simple visual binding from discharge
5. add chart/evidence inspection
6. snapshot and verify offline replay
7. then evaluate current-field and high-detail water techniques

The first water experiment should compare River Pulse's current-field need against the candidate references listed in `implementation-contract.md`, while treating Waterscape's existing optics as a rendering resource rather than a hydrologic model.
