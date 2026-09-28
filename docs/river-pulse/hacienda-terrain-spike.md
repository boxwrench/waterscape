# River Pulse — Hacienda terrain spike

## Status

**Terrain spike passed.** The branch now builds a real Hacienda Bridge-area USGS 3DEP crop in CI, verifies its river-specific schema, loads it through the River Pulse browser terrain path, and packages the live Hacienda prototype without changing Waterscape reservoir semantics.

The spike established that River Pulse can stand on Waterscape's geospatial/rendering foundation **without pretending a river is a reservoir**.

Follow-on work on the same branch now includes normalized USGS flow quantities, deterministic time selection, RiverState, recent daily history, interactive time selection, USGS seasonal condition context, authoritative river hydrography, and the scene-first Hacienda UI.

## Goal

Prove that Waterscape's mature California terrain/WebGPU path can support a river authored place **without importing reservoir assumptions**.

This was intentionally a bounded spike. It did not require realistic river water, currents, forecasts, or Jenner.

## Result against success criteria

1. **PASS — real 3DEP crop.** CI fetches the configured Hacienda crop through the existing USGS elevation path.
2. **PASS — absolute elevation.** The river terrain bundle stores absolute NAVD88 elevation rather than height relative to one water surface.
3. **PASS — no reservoir detector.** `build_river_terrain.py` does not call `detect_water()` and does not create a reservoir centroid or `waterLevel`.
4. **PASS — browser loader.** `river-pulse/renderer/terrain.js` decodes the river terrain schema independently of the reservoir loader.
5. **PASS — WebGPU terrain path.** The Hacienda page renders the generated terrain through Three.js WebGPU.
6. **PASS — navigation.** The existing Waterscape flight-camera contract works against River Pulse terrain clearance.
7. **PASS — geospatial readout.** Local positions map back to latitude/longitude and NAVD88 elevation; terrain points can be inspected.
8. **PASS — metadata.** The bundle records CRS, vertical datum, source, schema version, anchor, cell size, and source service.
9. **PASS — Waterscape isolation.** Existing reservoir source/build/runtime semantics are unchanged; River Pulse is additive on this branch.

## Implemented shape

```text
pipeline/
  build_river_terrain.py

river-pulse/
  data/
    russian_river/
      places/
        hacienda_bridge/
          source.json
          # terrain.json + terrain.bin.gz are generated
  renderer/
    terrain.js
    terrain-mesh.js
    hacienda.html
    hacienda.js
    hacienda.css
```

The implementation deliberately avoided creating a shared framework before proving a reusable seam.

## Terrain contract

The generated bundle uses:

```text
schemaVersion: river-pulse-terrain-0.1
source: USGS National Map 3D Elevation Program (3DEP)
CRS: projected UTM for the configured place
verticalDatum: NAVD88 metres (3DEP)
verticalOrigin.type: absolute
channels: elevation
```

It does **not** carry Waterscape's reservoir `waterLevel`, signed shoreline-distance channel, or synthetic basin semantics.

The local scene retains the useful Waterscape convention:

```text
x = east in metres
z = south in metres
y = vertical metres
```

The local x/z origin is pinned to the configured Hacienda/USGS gauge anchor. Absolute vertical meaning remains recoverable from bundle metadata.

## Verification

Automated coverage checks:

- deterministic elevation packing/decoding
- absolute vertical metadata
- absence of reservoir water semantics
- non-square cell handling
- UTM georeference
- terrain picking / camera clearance contract
- generic GPU cell representation
- river terrain mesh construction
- real Hacienda 3DEP build in the draft-PR CI path
- generated schema / datum / `waterLevel` absence
- existing Waterscape validation and build

## Follow-on vertical path

The project has moved beyond the terrain spike in this same branch:

```text
USGS source
    ↓
source adapter
    ↓
normalized Quantity
    ↓
deterministic selection policy
    ↓
RiverState
    ↓
visual binding
    ↓
Hacienda UI / hydrograph / river scene
```

Recent daily mean discharge is represented as a derived statistic rather than an instantaneous observation. Current-flow selection refuses future observations and marks data stale rather than silently presenting an old reading as current.

## Next visual step

The next problem is deliberately split by scale rather than forcing one water system everywhere.

### Corridor / overhead

Build a first-class animated river corridor from the authoritative hydrography already layered over the terrain. Initial display modes should include:

- **relative-flow width** — illustrative widening/narrowing driven by a declared discharge comparison mapping;
- **seasonal-condition color** — the USGS day-of-year condition class;
- subtle downstream motion so the river reads as flowing water rather than a static GIS line.

The corridor width is not literal bank geometry or measured water extent unless a later source/model provides those quantities.

### Hacienda authored-place / hero water

Treat close-range Hacienda water as a separate rendering problem. Reuse/adapt Waterscape optics where they help, then add place-scale surface/current cues, foam, refraction/reflection, caustics, and shoreline/structure interaction as appropriate. The local visual facsimile should be tuned to the phenomenon being communicated rather than constrained to match the map-scale corridor renderer.

This split lets the corridor be clear and performant while allowing authored places to pursue much higher visual fidelity.
