# River Pulse UI design language

River Pulse should feel like an explorable place first and a dashboard second. The interface borrows from modern web visualization, mapping, games, and cinematic environmental tools while keeping scientific provenance close at hand.

## Design intent

The scene carries the primary story. UI should frame it, not cover it.

A visitor should be able to answer three questions at increasing depth:

1. **What is happening here?** — visible directly in the river/world state.
2. **How does it compare?** — timeline, historical context, forecast, and linked charts.
3. **How do we know?** — exact values, source, time semantics, method, quality, and visual mapping.

The interface can be beautiful and game-like without blurring measured data, model output, and illustrative rendering. Visual quality is part of the product, not a decorative layer added after the data path works.

## Visual character

- Dark translucent environmental UI over a bright natural scene.
- Restrained river-green / blue accents rather than a saturated dashboard palette.
- Large place names and small technical labels: landscape first, instrumentation second.
- Rounded glass surfaces, thin borders, soft depth, and compact controls.
- Motion should feel geographic: camera travel, layered fades, timeline transitions, spatial selection, and visible downstream flow cues.
- Use full-screen 3D whenever it adds information; do not shrink the scene into a card surrounded by charts.

## Two visual regimes

River Pulse has two deliberately different water presentation scales. They consume the same selected scientific state through visual bindings, but the rendering problem is different.

### Corridor / overhead

The corridor view is a long-range spatial visualization. Its job is to make the river readable across miles, not to reproduce close-up water optics everywhere.

A first-class corridor representation may use:

- an animated river ribbon/corridor following authoritative hydrography
- **relative-flow width**: illustrative widening/narrowing tied to selected discharge or a declared comparison baseline
- **seasonal-condition color**: the USGS day-of-year condition class mapped to the river corridor
- directional motion, texture, or restrained particles to communicate downstream flow
- LOD appropriate to map-scale viewing

Relative width and seasonal color are different encodings. The interface should allow a simple display toggle such as `Flow width` / `Seasonal color` rather than forcing both encodings simultaneously.

The first Hacienda corridor prototype now implements that pattern: a terrain-draped ribbon placed from DWR/NHD river geometry, animated sheen/flow traces, and a live `Flow width` / `Season color` toggle driven by the selected RiverState and seasonal condition.

An illustrative width is not a measured bank edge, channel width, or water-surface extent. That distinction belongs in the visual binding and inspector.

### Authored-place / hero

Hacienda, Jenner, and later authored places are close-range experiences. Their water should prioritize believable local appearance and composition:

- surface detail and current cues
- reflections/refraction and attenuation
- foam/turbulence where useful
- caustics where useful at close range
- interaction with bridge/shoreline/rocks/vegetation
- authored lighting and camera composition

The hero renderer may use a local visual facsimile tuned to the phenomenon being communicated. It is not required to share the corridor ribbon's geometry or shader. Apparent local width, level, current direction, depth, or turbulence become factual only when supported by the corresponding source/model.

## Information hierarchy

### Persistent

Keep only the essentials visible:

- River Pulse / river identity
- current authored place
- active data/display mode
- source/status cue
- one compact time control when hydrology is connected

### Contextual

Show when relevant:

- camera/place controls
- gauge identity
- selected terrain/feature readout
- historical comparison
- forecast state
- uncertainty
- river display toggle when more than one useful encoding is available

### Inspectable

Hide deeper evidence behind an explicit inspection action:

- agency and dataset
- units
- valid time / issue time / as-of time
- selection policy
- source flags
- model version
- visual-binding explanation, including whether geometry/behavior is direct, derived, modelled, or illustrative

## Data and display modes

`Terrain`, `Flow`, and `Forecast` are understandable user-facing data modes. They are not evidence types in the data model.

Display choices such as `Flow width` and `Seasonal color` are presentation choices inside a data mode; they must not alter the underlying selected Quantity or RiverState.

The UI must not imply a mode is available when its required data is absent. Disabled or unavailable states should be explicit rather than silently substituted.

## Authored places

An authored place should feel recognizable and intentional. Use high-quality photographic references to guide camera composition, bridge/landmark placement, vegetation, riverbank character, water appearance, and lighting.

Each authored place should expose a small set of named views, for example:

- Overview
- Bridge / landmark
- River eye
- Estuary / mouth where relevant

Transitions between views should preserve geographic continuity rather than teleport abruptly when practical.

## Inspection interaction

Clicking or tapping the world should select a spatial feature or terrain point where possible.

The inspector should report exact geographic/elevation information independently from illustrative effects. Selecting a gauge, reach, or rendered river state should use the same interaction pattern to expose hydrologic quantities, provenance, and the active visual mapping.

## Timeline

The timeline is a primary interaction system, not a decorative chart.

One scrub should coordinate:

- scene state
- gauge values
- seasonal context
- corridor representation
- authored-place water response where supported
- weather
- model output
- charts
- labels

The interface may present `History → Now → Forecast`, while the underlying system preserves each layer's own valid time, issue time, as-of time, and selection policy.

## Responsive behavior

Desktop can carry a place card, inspector, and timeline simultaneously.

Mobile should become a compact heads-up display / bottom-sheet experience:

- preserve most of the screen for the world
- collapse descriptive copy first
- retain place identity, time control, and the currently selected value
- retain the active river display mode when it materially changes interpretation
- use touch-friendly authored-view controls

Do not create a separate reduced-information mobile product unless performance requires it.

## Current Hacienda prototype

The Hacienda branch currently establishes:

- full-screen WebGPU terrain
- River Pulse / Russian River identity
- authored Overview and Bridge views
- USGS gauge identity and live discharge path
- recent daily-mean hydrograph and interactive historical time selection
- USGS seasonal-condition context
- direct terrain inspection and provenance
- authoritative river geometry as a separate layer
- animated corridor river with relative-flow-width and seasonal-color display modes

The next step is visual evaluation and tuning of this map-scale river treatment before moving separately into higher-detail authored-place water. Do not fill unsupported hydraulic quantities merely to make either renderer look complete.
