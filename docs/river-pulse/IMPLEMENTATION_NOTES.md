# River Pulse implementation notes

This is the short running record of conclusions we do **not** want to rediscover in later batches. Keep it compact. Add only decisions, source behavior, traps, or deferred questions that materially affect future implementation.

## Settled decisions

- **Scientific state and visual interpretation stay separate.** Source records normalize into scientific `Quantity` objects; visual bindings decide how those quantities affect scene, charts, labels, particles, surface activity, etc. Renderers do not redefine the science.
- **Historical / Now / Forecast are UI concepts, not evidence types.** Evidence remains observation, derived statistic, or model output with its own valid time, issue time where applicable, method, quality, and provenance.
- **Current discharge and historical discharge are intentionally different products.** Current uses continuous USGS observations. Historical timeline dates use USGS daily means, represented as `derived_statistic`, not instantaneous observations.
- **As-of time is not inferred from retrieval time or `last_modified`.** Reproducible information-state replay requires real publication/revision evidence or retained source snapshots.
- **Hacienda and Jenner must use the same authored-place/package mechanism.** No place-specific engine changes should be required to load either one.
- **Hacienda discharge must not be promoted into unsupported Jenner estuary state.** It does not by itself establish Jenner water level, mouth condition, or local current direction.
- **Game techniques are valid implementation tools.** Camera systems, replay, state machines, progression, interaction, objectives, time controls, discovery, and other game mechanisms are in scope when useful.
- **Visual quality is first-class.** River Pulse may use expressive simulation/facsimile techniques when they clearly communicate the intended quantity or condition and do not silently claim unsupported hydraulic meaning.

## Two visual regimes

River Pulse deliberately uses different river/water representations at different viewing scales. They consume the same RiverState through visual bindings, but they do not need to share one rendering solution.

### Corridor / overhead view

Purpose: make a long river readable and expressive at map scale.

- Use an animated river corridor/ribbon rather than forcing literal close-water rendering across many miles.
- Width may vary to communicate **relative discharge/flow state**. That width is illustrative unless supported by measured/modelled bank geometry or water-surface extent.
- Seasonal-condition color is a separate presentation mode using the USGS condition classes already implemented.
- Width and seasonal color should be independently understandable and may be exposed as a user toggle rather than combining every encoding at once.
- Directional motion, restrained particles, surface texture, or similar cues may make flow legible, but they do not become measured local velocity by appearance alone.
- **First corridor implementation exists on the Hacienda branch.** California DWR NHD Major Rivers supplies placement; a terrain-draped ribbon, animated sheen, and moving flow traces provide the visual. The width/color toggle is live and follows the selected RiverState/seasonal condition.
- The first width mapping is deliberately a rendering parameter: selected discharge is log-normalized between the returned 10th and 90th day-of-year thresholds, mapping to a 12–42 m apparent corridor and saturating beyond those anchors. Seasonal-color mode uses a fixed 24 m corridor. These metres are **not** bank geometry or inundation extent.
- Flow traces use local terrain slope as a visual downstream cue and scale their motion with the same relative-flow mapping; this is not measured local velocity.

### Authored-place / hero view

Purpose: make Hacienda, Jenner, and later authored reaches feel like real places at close range.

- Prioritize high-quality water optics and believable local behavior: current cues, reflections/refraction, surface detail, foam, caustics where useful, shoreline/structure relationships, lighting, and authored composition.
- Hero water may use a local facsimile tuned to the phenomenon being communicated; it is not required to use the same geometry or shader as the corridor ribbon.
- Local apparent width, level, current direction, or turbulence only become factual when an appropriate source/model supports them. Otherwise the visual binding must describe the representation as illustrative/contextual.
- Waterscape optics are a strong candidate resource for this scale, while its still-reservoir hydrodynamic assumptions remain separate.

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

- Do not depend on source API ordering when two records have the same timestamp; selection needs a deterministic tie-break.
- Do not silently use stale observations as current state. Current-selection policies have an explicit maximum age and return missing/stale state when exceeded.
- Do not hard-code the current year into historical labels or timeline display logic.
- Do not collapse source quality into one enum. Availability, approval, estimation flags, freshness, and original source flags are independent.
- Do not let a rendering technique inherit scientific meaning from the demo it came from. A current field, shader, caustic effect, particle system, or wave texture is only a representation until connected to supported quantities/models.
- Do not force corridor and authored-place water through one renderer merely for architectural neatness; their visual jobs and scale constraints differ.

## Useful references to keep in view

- **Waterscape** — sibling implementation and primary reuse source for terrain/build/WebGPU/camera/optics infrastructure.
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
