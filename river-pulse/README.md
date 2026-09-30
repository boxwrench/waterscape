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
- **Jenner:** authored place manifest, common package-loader tests and a USGS NAVD88
  water-level adapter. No Jenner 3D scene yet.
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

## Layout

| Directory | Responsibility |
|---|---|
| `adapters/` | Normalize USGS and DWR source records, preserving provenance |
| `data-model/` | Quantities, deterministic selection, RiverState, packages and replay |
| `visual-bindings/` | Convert scientific state into labels, charts and scene styling |
| `renderer/` | Hacienda terrain scene and its interface |
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
