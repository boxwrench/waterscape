# River Pulse implementation notes

This is the short running record of conclusions we do **not** want to rediscover in later batches. Keep it compact. Add only decisions, source behavior, traps, or deferred questions that materially affect future implementation.

## Settled decisions

- **One Waterscape repository.** River Pulse now lives in root `river-pulse/`, sharing the
  existing vendor, camera/geospatial utilities, pipeline, tests and Pages build. Its scientific
  model remains river-specific. Hacienda terrain is committed and deployment validates it;
  Jenner is still a manifest/data contract rather than a ready scene.
- **Scientific state and visual interpretation stay separate.** Source records normalize into scientific `Quantity` objects; visual bindings decide how those quantities affect scene, charts, labels, particles, surface activity, etc. Renderers do not redefine the science.
- **Historical / Now / Forecast are UI concepts, not evidence types.** Evidence remains observation, derived statistic, or model output with its own valid time, issue time where applicable, method, quality, and provenance.
- **Current discharge and historical discharge are intentionally different products.** Current uses continuous USGS observations. Historical timeline dates use USGS daily means, represented as `derived_statistic`, not instantaneous observations.
- **As-of time is not inferred from retrieval time or `last_modified`.** Reproducible information-state replay requires real publication/revision evidence or retained source snapshots.
- **Hacienda and Jenner must use the same authored-place/package mechanism.** No place-specific engine changes should be required to load either one.
- **Hacienda discharge must not be promoted into unsupported Jenner estuary state.** It does not by itself establish Jenner water level, mouth condition, or local current direction.
- **Game techniques are valid implementation tools.** Camera systems, replay, state machines, progression, interaction, objectives, time controls, discovery, and other game mechanisms are in scope when useful.

## Verified USGS behavior

- Hacienda gauge: `USGS-11467000`.
- Continuous discharge parameter: `00060`.
- Daily mean statistic: `00003`.
- The modern USGS statistics service exposes `observationNormals` day-of-year statistics, including fixed percentile thresholds rather than an arbitrary exact percentile rank for the current value.
- River Pulse therefore reports **percentile bands / condition classes**, not an invented exact value such as “18th percentile.”
- Seasonal-condition boundaries currently follow the USGS day-of-year convention implemented and tested on the branch:
  - zero -> Not flowing
  - at/below historical minimum -> All-time low for this day
  - below 10th -> Much below normal
  - 10th to <25th -> Below normal
  - 25th through 75th -> Normal
  - >75th through 90th -> Above normal
  - >90th and below historical maximum -> Much above normal
  - at/above historical maximum -> All-time high for this day
- Ranked seasonal context requires sufficient historical support; the current implementation uses a 20-value minimum and otherwise reports `Not ranked`.
- The USGS statistics response can arrive in a nested feature/property/data shape. The adapter must preserve method metadata such as percentile, computation, computation id, sample count, approval state, and source geometry when present.
- When the user scrubs to a historical date, seasonal context should use that selected date’s **day-of-year**, not today’s.

## Terrain / geometry boundaries

- Waterscape’s 3DEP fetch, UTM/georeference utilities, terrain transport, camera runtime, WebGPU/Three.js integration, quality logic, and validation patterns are strong reuse candidates.
- Reservoir-specific flat-water detection, one-water-level semantics, shoreline-distance assumptions, synthetic basin depth, and reservoir viewpoint generation are **not** river semantics.
- River Pulse terrain retains absolute elevation and keeps river/reach geometry separate.
- Authoritative river geometry is useful as broad-scale centerline/cartographic context. It must not be presented as exact bank geometry, channel width, cross-section, local depth, water-surface elevation, or hydraulic velocity unless a source/model actually supports those quantities.
- Discharge alone does not determine local depth or velocity. Flow particles, turbulence, foam, and similar effects must remain explicitly mapped/illustrative unless driven by an appropriate hydraulic model.

## Known traps already encountered

- HTML module/style references are production build inputs. Timeline, seasonal and interface modules must ship even when the scene module does not import them. The build regression test and built-page browser test cover this.
- Gauge resolution filters station, phenomenon, units and evidence before temporal selection. Explicit as-of requests exclude unknown or later availability; no availability cutoff is inferred from retrieval time.
- UI data startup is independent of terrain/GPU startup. WebGL2 is a rendering fallback, and the timeline/evidence remain usable when graphics initialization fails.
- Camera presets must face the configured anchor. River-line width and elevation colors are cartographic display choices, not measured channel width or land cover.

- Do not depend on source API ordering when two records have the same timestamp; selection needs a deterministic tie-break.
- Do not silently use stale observations as current state. Current-selection policies have an explicit maximum age and return missing/stale state when exceeded.
- Do not hard-code the current year into historical labels or timeline display logic.
- Do not collapse source quality into one enum. Availability, approval, estimation flags, freshness, and original source flags are independent.
- Do not let a rendering technique inherit scientific meaning from the demo it came from. A current field, shader, caustic effect, particle system, or wave texture is only a representation until connected to supported quantities/models.

## Useful references to keep in view

- **Waterscape reservoir experience** — the sibling experience in this repository and primary
  reuse source for terrain/build/WebGPU/camera/optics infrastructure.
- **USGS National Water Dashboard / Water Data** — source for streamflow condition semantics and seasonal percentile-band conventions.
- **California Water Watch** — future-function reference for watershed drill-down, multiple environmental layers, condition summaries, and spatial/historical context. Consider later; do not copy its implementation assumptions into the current thin slice.
- **HDRP current-map article** — useful prior art for separating a generated spatial current field from the generic water renderer.
- **CAUSTIC//VOLUME** — candidate close-water/refraction/caustics rendering reference; evaluate before adopting.
- **Nathan Wilbanks water reference** — visual/technical lead only until its actual method, source availability, stack, and licensing are confirmed.

## Deferred questions

- Best source/model for predictive streamflow and forecast replay, including which forecast products retain historical issued runs versus requiring River Pulse to archive them.
- Exact river current-field model and how much of the Waterscape optical water stack should be reused for hero reaches.
- Detailed Jenner estuary model/data sources and mouth-state behavior.
- Final shared package schema between Waterscape and River Pulse; avoid extracting a common library until real duplicated code proves the boundary.
- Reduced/mobile fallback for the dynamic River Pulse experience.

## Working rule for future batches

One batch = one narrowly defined change, followed by verification and a stop point. If a batch produces a durable conclusion, add one or two lines here rather than opening another architecture cycle.
