# River Pulse

A Waterscape experience for understanding rivers through terrain, authoritative observations,
time selection and declared visual bindings. Read the umbrella principle,
[Making Water Visible](../docs/making-water-visible.md), and the
[implementation contract](../docs/river-pulse/implementation-contract.md).

## Run

**[Open the live Hacienda experience](https://boxwrench.github.io/waterscape/river-pulse/renderer/hacienda.html)**

From the **repository root**:

```sh
npm ci
npm start
```

Open http://localhost:5173/river-pulse/ in a modern browser. Windows Chrome/Edge are
the primary targets; the scene supports WebGPU and WebGL2. Hacienda terrain and USGS
3DHP centerlines are included. Gauge history and seasonal statistics use live public APIs;
California DWR geometry is a fallback if the local centerline cannot load.

## Current state

- **Hacienda Bridge:** real USGS 3DEP terrain, USGS 3DHP cartographic centerlines,
  USGS discharge/history, time selection and seasonal context; Map, Bridge and Hacienda
  Beach viewpoints.
- **East Fork:** Lake Mendocino outflow, with two bounded bank views, photo-informed earthfill
  dam/outlet, riprap and oak groups. USGS 11462000 is a historical record; this scene has no
  live discharge or stage binding.
- **Jenner:** photo-informed estuary lookout, river shore and Pacific beach, with sourced
  USGS NAVD88 water-level evidence independent of its illustrative ocean water.
- **Geographic map:** bundled USGS centerlines and clickable place pins join all three places.
  The inset opens on Hacienda Map, or through Map on East Fork/Jenner. It does not expand
  Hacienda's local 3D terrain into a surveyed whole-river scene.
- **Not implemented:** local hydrodynamic simulation, forecasts, a complete river
  corridor. Package capabilities describe intent, not
  guaranteed data availability. Offline replay has a tested data contract, not a finished UI.

The centerline is not measured channel width, depth or local velocity. Current and historical
data preserve separate time/quality semantics; missing and stale data remain explicit.

## Views and water

- **Map:** sourced topography and a continuous blue water ribbon with irregular moving
  surface detail. Width follows selected gauge discharge within the loaded history range;
  seasonal color borders it. This is an illustrative display scale, not surveyed channel
  width, stage, flood extent or local velocity. Missing history uses a disclosed fixed
  width scale; zero/missing discharge stops motion. Reduced motion freezes ripples.
- **Bridge / Hacienda Beach:** photo-informed local reconstruction with a gray steel
  camelback, concrete approaches, left-pier rock outcrop, gray pebble beach and grouped
  woodland. Green reflective water includes refraction and approximate caustics over a
  modeled bed. Beach movement is bounded at eye height near the dry shoreline. Scene
  geometry is authored, not a survey, and the timeline does not move its shoreline.

Drag to look, scroll to move closer and use WASD to move. View buttons change the composition;
River toggles water, and Elevation tint applies to Map. Explore hides the data panels.
Use the history slider or Play history to compare daily discharge, Return to now for the
latest eligible observation, and Inspect data for source/time/quality evidence. Data remains
accessible if graphics initialization fails. Source outages show unavailable data explicitly.

The [authored-water notes](../docs/river-pulse/authored-water.md) record visual mappings,
photographic references, CC0 ground materials, MIT tree assets and rendering limitations.

See [River structure](../docs/river-pulse/river-structure.md) for how rivers, places and views
are organised, and how to choose places for a new river.

## Map flow bindings

- **Reach dynamics (Derived, then Illustrative):** `visual-bindings/map-flow-dynamics.js`
  derives, along the 3DHP centerline and 3DEP terrain, how steeply the ground falls
  downstream and how sharply the line bends. The ribbon maps these to streak speed (steeper
  runs faster) and speeds up and froths the outside bank of a bend. This is an Illustrative
  binding: it is not velocity, shear stress or erosion, and the ordering within the reach is
  all it claims. Two half-period-offset copies of the pattern are blended so changing speed
  does not stretch it.
- **Baseline drift:** with no discharge available the water drifts slowly (Setting). A recorded
  zero stops it; reduced motion freezes it.
- **Haze (Setting):** a light exponential haze on the Map gives the valley depth.

## Historical high and low (Hacienda close-ups)

Bridge and Hacienda Beach offer **Selected time / Record low / Record high**. The record
extremes come from USGS (`visual-bindings/hacienda-extremes.js`, each with its source URL; see
[RP11](../docs/roadmap/tasks/RP11-hacienda-high-low.md)): record low flow 0.75 ft³/s
(1977-05-06, no stage published) and record high stage 49.7 ft (90,100 ft³/s, 1955-12-23).
Water height is an **Illustrative** mapping of discharge: below the authored 100 ft³/s baseline
it falls 1.1 m per tenfold drop (the record low empties the channel); above it the level rises
with the log of discharge so the record high reaches the underside of the authored bridge steel
(11.7 m), as the great floods do. The real rise is about 15 m, and the bridge dimensions are
photo-informed estimates. Selected time follows the timeline. The water surface spreads past the
banks and the terrain cuts the waterline. The readout always shows the real values.

## Layout

| Directory | Responsibility |
|---|---|
| `adapters/` | Normalize USGS and DWR source records, preserving provenance |
| `data-model/` | Quantities, deterministic selection, RiverState, packages and replay |
| `visual-bindings/` | Convert scientific state into labels, charts and scene styling |
| `renderer/` | Hacienda terrain, authored place scenes, map navigation and interfaces |
| `data/` | River/place manifests, generated registry and committed terrain/centerlines |

Root `vendor/`, camera/projection utilities, `pipeline/`, `scripts/` and dependency installation
are shared with the reservoir experience. Do not add another `.git`, vendor copy or npm
project here. New river behavior must not reuse still-water assumptions as scientific claims.

## Build and validate data

With the documented Python dependencies installed, from the root:

```sh
python pipeline/build_river_registry.py
python pipeline/build_river_registry.py --check
python pipeline/build_river_terrain.py river-pulse/data/russian_river/places/hacienda_bridge/source.json
python pipeline/build_river_hydrography.py river-pulse/data/russian_river/places/hacienda_bridge/source.json
npm run validate
npm run test:unit
python -m pytest pipeline/tests -q
npm run test:build
node scripts/verify-river-pulse.mjs
```

Only rebuild terrain and hydrography deliberately: the builder fetches USGS elevation and records the service,
crop, projection and encoding in `terrain.json`. It does not detect a reservoir level or
invent bathymetry. Place manifests without terrain are allowed, but a declared terrain source
must have a valid payload before the site can build.
