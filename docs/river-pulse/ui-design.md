# River Pulse UI design language

River Pulse should feel like an explorable place first and a dashboard second. The interface borrows from modern web visualization, mapping, games, and cinematic environmental tools while keeping scientific provenance close at hand.

## Design intent

The scene carries the primary story. UI should frame it, not cover it.

A visitor should be able to answer three questions at increasing depth:

1. **What is happening here?** — visible directly in the river/world state.
2. **How does it compare?** — timeline, historical context, forecast, and linked charts.
3. **How do we know?** — exact values, source, time semantics, method, quality, and visual mapping.

The interface can be beautiful and game-like without blurring measured data, model output, and illustrative rendering.

## Visual character

- Dark translucent environmental UI over a bright natural scene.
- Restrained river-green / blue accents rather than a saturated dashboard palette.
- Large place names and small technical labels: landscape first, instrumentation second.
- Rounded glass surfaces, thin borders, soft depth, and compact controls.
- Motion should feel geographic: camera travel, layered fades, timeline transitions, and spatial selection.
- Use full-screen 3D whenever it adds information; do not shrink the scene into a card surrounded by charts.

## Information hierarchy

### Persistent

Keep only the essentials visible:

- River Pulse / river identity
- current authored place
- active data mode
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

### Inspectable

Hide deeper evidence behind an explicit inspection action:

- agency and dataset
- units
- valid time / issue time / as-of time
- selection policy
- source flags
- model version
- visual-binding explanation

## Data modes

`Terrain`, `Flow`, and `Forecast` are understandable user-facing modes. They are not evidence types in the data model.

The UI must not imply a mode is available when its required data is absent. Disabled or unavailable states should be explicit rather than silently substituted.

## Authored places

An authored place should feel recognizable and intentional. Use high-quality photographic references to guide camera composition, bridge/landmark placement, vegetation, riverbank character, and lighting.

Each authored place should expose a small set of named views, for example:

- Overview
- Bridge / landmark
- River eye
- Estuary / mouth where relevant

Transitions between views should preserve geographic continuity rather than teleport abruptly when practical.

## Inspection interaction

Clicking or tapping the world should select a spatial feature or terrain point where possible.

The inspector should report exact geographic/elevation information independently from illustrative effects. Later, selecting a gauge or reach should use the same interaction pattern to expose hydrologic quantities and provenance.

## Timeline

The timeline is a primary interaction system, not a decorative chart.

When implemented, one scrub should coordinate:

- scene state
- gauge values
- historical context
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
- use touch-friendly authored-view controls

Do not create a separate reduced-information mobile product unless performance requires it.

## Current Hacienda prototype

The first Hacienda page establishes this language before live streamflow is connected:

- full-screen WebGPU terrain
- River Pulse / Russian River identity
- authored Overview and Bridge views
- USGS gauge identity
- direct terrain inspection
- source/datum provenance
- a visible but inactive future `History → Flow → Forecast` vocabulary

The UI should evolve with the data path. Do not fill unfinished modes with fake values merely to make the interface look complete.
