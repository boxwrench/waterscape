# River Pulse v0.1 implementation contract

## Purpose

River Pulse v0.1 proves that a real river can be represented through an interactive web/3D environment using authoritative hydrologic data while keeping every factual representation traceable and every authored place reusable.

The **Russian River** is the reference river. The first authored places are **Hacienda Bridge** and **Jenner**.

The Russian River is the first **content package**, not an application-specific special case.

## Hard architectural boundary

```text
Authoritative source records
            ↓
     Source adapters
            ↓
Normalized scientific quantities + provenance
            ↓
  Deterministic selection policy
            ↓
 RiverState(valid time, as-of time)
            ↓
       Visual bindings
            ↓
 Rendering / simulation / interaction
            ↓
 Scene + charts + labels + UI/game systems
```

Scientific state and visual interpretation remain separate. A renderer, current field, particle system, shader, replay mechanic, or other presentation system may consume scientific quantities through a declared visual binding, but it does not redefine those quantities.

## Scientific quantity model

A normalized quantity describes what is known, not how it is drawn.

```text
Quantity

identity
  quantity_id
  feature_id
  phenomenon

value
unit

evidence_type
  observation
  derived_statistic
  model_output

time
  valid_start
  valid_end
  issue_time?     # model output where applicable
  as_of_time?     # information availability/replay where known

method
  method_id
  calculation?
  interpolation?
  model_name?
  model_version?

availability
  present
  missing

source_approval
  provisional
  approved
  unknown

estimation_status
  source_estimated
  not_flagged
  unknown

source_flags[]    # retained unchanged

provenance
  agency
  dataset
  source_feature_id
  source_record_id
  source_snapshot_id
  retrieval_time

spatial
  geometry / position
  horizontal_crs
  vertical_datum?
```

`historical`, `current`, and `forecast` remain useful interface concepts. They are not scientific evidence types. An observation from 1990 remains an observation; a percentile remains derived; a forecast remains model output even after its valid time passes.

## Visual bindings

Presentation metadata belongs on the binding between a quantity and a visual effect, not on the quantity itself.

The same discharge observation may drive an exact numeric label, a proportional comparison ribbon, an illustrative current field, foam, or surface turbulence while retaining one unchanged scientific identity.

Example:

```yaml
id: hacienda-discharge-water
inputs:
  - discharge
outputs:
  - current-field-strength
  - foam-intensity
  - surface-agitation
representation: illustrative
note: >
  Surface behavior communicates relative discharge. It does not represent measured
  local velocity unless a supporting hydraulic model supplies that quantity.
```

## Time model

River Pulse exposes one user-facing timeline while preserving each source layer's own time semantics.

Core request:

```text
requested_valid_time
optional_as_of_time
```

- **Valid time**: when the represented condition applies.
- **As-of time**: what information was available by a particular moment.

Forecast replay therefore distinguishes issue time from valid time. Revised observations and other mutable records require retained source snapshots when reproducibility depends on their prior state; retrieval time alone is not sufficient proof of first public availability.

## Deterministic selection policy

There is no generic `best available` rule. Each dataset or binding declares an explicit policy.

Example gauge policy:

```text
select latest eligible observation
at or before requested_valid_time
within configured maximum age
otherwise return missing
```

Nearest-time selection, interpolation, interval overlap, or other rules are permitted only when explicitly declared.

Freshness is computed from the selected record, the requested time, and the policy tolerance. An old observation can be correct for historical replay while being stale for a present-time view.

## RiverState is spatial

RiverState represents a collection of spatial features rather than one river-wide discharge value.

```text
RiverState

request
  valid_time
  as_of_time?

features
  reaches[]
  gauges[]
  tributaries[]
  weather_fields[]
  model_fields[]
  authored_places[]

selected_quantities[]
missing_quantities[]
selection_results[]
```

Each selected quantity retains its own provenance, timing, method, and quality properties.

## Authored places and capabilities

A place declares what the scene is designed to support. Supported capability is distinct from current data availability.

Example:

```text
Hacienda Bridge
  supports:
    observed_discharge
    historical_discharge
    historical_statistics
    forecast_discharge
    precipitation_context
```

`supported != currently available`

### Jenner rule

Jenner remains in v0.1 because it deliberately tests a place whose behavior differs from a conventional river reach.

The engine must not assume:

```text
Hacienda discharge == Jenner water level
Hacienda discharge == Jenner mouth condition
river discharge == local current direction
```

Jenner v0.1 may use a limited set of accurately scoped quantities and visual bindings. Unsupported estuary behavior remains unavailable until an appropriate observation or model adapter exists.

## Package system

v0.1 uses development/build-time package discovery.

A package may contain:

```text
pack.json
terrain
hydrography
places
assets
data bindings
visual bindings
references
attribution
```

Required package metadata includes at least:

```text
schema_version
minimum_engine_version
pack_id
pack_version
horizontal_crs
vertical_datum where relevant
units
source attribution
asset attribution
supported_capabilities
```

Discovery contract:

> Adding or removing a valid package changes the generated content registry on the next development reload or build, without engine edits.

v0.1 does not promise arbitrary runtime filesystem discovery in a deployed browser. Remote pack loading can come later.

## Reproducibility

A meaningful scene state must be replayable.

A saved selection records enough information to reconstruct:

```text
engine_version
pack_version
visual_mapping_version
valid_time
as_of_time
source_snapshot_ids
model_run_ids
selected feature/place
camera state where relevant
```

Decorative animation may vary. Represented measurements, selected baselines, model runs, derived values, factual labels, and visual mapping rules may not.

Scrubbing backward reconstructs state from records and deterministic mappings; it does not assume an arbitrary simulation can simply run in reverse.

## Inspectability

Every factual representation must expose enough information to answer:

- What is this?
- Where did it come from?
- When does it apply?
- How was it selected or calculated?
- What quality/flags apply?
- How is the scene representing it?

## Candidate implementation resources

These are implementation leads, not dependencies. Each must be evaluated for portability, licensing, performance, and fit before adoption.

- **Waterscape** — https://github.com/boxwrench/waterscape
  - strongest reuse candidate for terrain, package/build tooling, WebGPU/Three.js integration, camera/navigation, quality adaptation, optics, and validation.
- **Currents in HDRP's Water System** — https://anisb.github.io/2026/09/26/currents-in-hdrps-water-system/
  - candidate reference for spatial current-field concepts and separating flow direction from surface detail.
- **CAUSTIC//VOLUME** — https://scottiefox.github.io/caustic-volume/
  - candidate reference for close-water optics/caustics.
- **Nathan Wilbanks reference** — https://x.com/NathanWilbanks_/status/2103966250405892270
  - visual/simulation reference to classify after its underlying technique/source is captured.

Resource-use rule:

> River Pulse may reuse rendering and simulation techniques without inheriting their scientific meaning. Scientific quantities remain authoritative; visual bindings declare how they are represented.

## v0.1 acceptance tests

### A1 — River corridor

Russian River terrain and hydrography load with multiple gauge features.

### A2 — End-to-end data path

Selecting one gauge and changing time performs:

```text
source
→ adapter
→ normalized Quantity
→ deterministic selection
→ RiverState
→ visual binding
→ scene + chart
```

Scene and hydrograph update from the same selected quantities.

### A3 — Evidence inspection

Every factual value in the working path exposes source, units, valid time, as-of information where applicable, method, quality properties, original source flags, provenance, and visual mapping.

### A4 — Common place loader

Hacienda Bridge and Jenner both load through the same place/package mechanism. No place-specific engine modification is permitted.

### A5 — Package discovery

Adding or removing a valid authored-place package changes the generated registry on the next development reload/build without engine edits.

### A6 — Reproducible offline replay

Save one completed scene state together with the required source snapshots, disconnect the network, and reload it. Selected factual quantities, historical baseline, derived values, model selection where applicable, visual mappings, and factual labels remain identical.

## Explicit v0.1 non-goals

Do not block v0.1 on:

- detailed Jenner estuary simulation
- complete NOAA forecast integration
- perfect hydraulic water depth
- physically calculated local velocity everywhere
- runtime third-party remote pack loading
- every Russian River gauge
- a second polished river
- a generalized contributor SDK
- every future game/interaction mechanic

The architecture should permit these additions without requiring them in v0.1.

## First implementation path

Start with one complete vertical slice before broadening the scene:

```text
ONE HACIENDA GAUGE
      ↓
source record
      ↓
normalized Quantity
      ↓
deterministic time policy
      ↓
RiverState
      ↓
one visual binding
      ↓
scene + hydrograph + exact label
      ↓
inspect provenance + mapping
      ↓
save snapshot
      ↓
offline reload
```

Before writing new rendering infrastructure, complete the bounded Waterscape reuse audit and Hacienda terrain spike documented beside this contract.
