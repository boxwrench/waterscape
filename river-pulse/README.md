# River Pulse

A Waterscape experience for understanding rivers through terrain, authoritative observations,
time selection and declared visual bindings. Read the umbrella principle,
[Making Water Visible](../docs/making-water-visible.md), and the
[implementation contract](../docs/river-pulse/implementation-contract.md).

## Run

From the **repository root**:

```sh
npm ci
npm start
```

Open http://localhost:5173/river-pulse/ in a WebGPU-capable browser. Windows Chrome/Edge are
the primary targets. The Hacienda terrain is included; gauge history, seasonal statistics
and river-centerline geometry are fetched from their public sources at runtime.

## Current state

- **Hacienda Bridge:** real USGS 3DEP terrain, California DWR NHD cartographic centerline,
  USGS discharge/history, time selection and seasonal context.
- **Jenner:** authored place manifest, common package-loader tests and a USGS NAVD88
  water-level adapter. No Jenner 3D scene yet.
- **Not implemented:** river-current/water-surface simulation, forecasts, a complete river
  corridor and a polished non-WebGPU fallback. Package capabilities describe intent, not
  guaranteed data availability. Offline replay has a tested data contract, not a finished UI.

The centerline is not measured channel width, depth or local velocity. Current and historical
data preserve separate time/quality semantics; missing and stale data remain explicit.

## Layout

| Directory | Responsibility |
|---|---|
| `adapters/` | Normalize USGS and DWR source records, preserving provenance |
| `data-model/` | Quantities, deterministic selection, RiverState, packages and replay |
| `visual-bindings/` | Convert scientific state into labels, charts and scene styling |
| `renderer/` | Hacienda terrain scene and its interface |
| `data/` | River/place manifests, generated registry and committed terrain |

Root `vendor/`, camera/projection utilities, `pipeline/`, `scripts/` and dependency installation
are shared with the reservoir experience. Do not add another `.git`, vendor copy or npm
project here. New river behavior must not reuse still-water assumptions as scientific claims.

## Build and validate data

With the documented Python dependencies installed, from the root:

```sh
python pipeline/build_river_registry.py
python pipeline/build_river_registry.py --check
python pipeline/build_river_terrain.py river-pulse/data/russian_river/places/hacienda_bridge/source.json
npm run validate
npm run test:unit
python -m pytest pipeline/tests -q
npm run test:build
```

Only rebuild terrain deliberately: the builder fetches USGS elevation and records the service,
crop, projection and encoding in `terrain.json`. It does not detect a reservoir level or
invent bathymetry. Place manifests without terrain are allowed, but a declared terrain source
must have a valid payload before the site can build.
