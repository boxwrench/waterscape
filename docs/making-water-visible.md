# Making Water Visible

The guiding principle for Waterscape: what we build, what we may exaggerate, and what we must
keep honest. Read this before adding a visual, a data source or a new kind of water system.

## Concept

Water systems are hard to understand because many of their most important processes are
invisible: flow, storage, sediment movement, residence time, erosion, pressure, stratification,
treatment, and the connections across a watershed. These are usually communicated through
charts, maps, tables and engineering diagrams. Those are useful, but they rarely give an
intuitive sense of what the system is doing.

**Making Water Visible** turns real water-system data into explorable visual worlds. The goal is
not to reproduce every physical process literally. It is to preserve the most important
relationships while using visualization, animation, scale, exaggeration and narrative to make
them understandable. The result sits between simulation, scientific visualization and visual
storytelling.

## Core principle

> Real data provides the backbone. Science determines the relationships. Visual interpretation
> makes those relationships visible.

A visual does not have to claim that every particle, ripple or colour is physically simulated.
Instead, each important effect should help communicate something meaningful about the system:

- a faster-moving texture can represent greater velocity;
- a glowing bank can represent increased erosion potential;
- a changing shoreline can follow measured reservoir elevation;
- animated particles can illustrate a circulation pattern that was never simulated particle by
  particle.

The visual is an interpretation of reality, not a replacement for it.

## The architecture

**Reality → scientific state → visual bindings → interactive world.**

### 1. Observed reality

The factual foundation: lidar and terrain, bathymetry, stream gauges, reservoir elevations,
historical imagery, river centrelines, rainfall, temperature, infrastructure, watershed
boundaries, treatment-plant measurements, documented events. Every project preserves
provenance so the source can always be identified.

### 2. Derived scientific state

Observed data is transformed into quantities that describe what the system is doing: flow
direction, velocity, slope, curvature, storage volume, residence time, inundation, hydraulic
gradient, shear stress, erosion tendency, sediment transport potential, stratification, water
age. These form the scientific model of the scene.

### 3. Visual bindings

Scientific quantities are connected to visual effects. One quantity can drive several
representations. River-bank shear, for example, can become a number, a coloured bank surface,
more suspended sediment, a stronger erosion animation and highlighted cut-bank geometry. The
quantity stays the same; the visualization decides how to communicate it.

Every binding belongs to exactly one class:

- **Exact**: directly presents a scientific quantity without an interpretive visual remapping
  (terrain geometry that follows an elevation grid; a shoreline placed at the state's water
  level).
- **Derived**: transforms scientific state through a defined, documented visual mapping (a
  colour ramp over shear stress; optics computed from the current water surface).
- **Illustrative**: emphasizes a scientifically supported concept without claiming literal
  physical accuracy (corkscrew ribbons for a weak secondary current; amplified sediment).
- **Setting**: makes no scientific claim. It is the world the water sits in: grass, trees,
  sky, light, clouds.

**Binding class is separate from scientific provenance.** A quantity can itself be observed,
derived, modeled or assumed, while its visual binding is still Exact if the visual directly
represents that state. Keep the source, method and uncertainty on the quantity; keep the
presentation class on the binding. This prevents an Exact binding from being mistaken for an
Exact measurement.

The first three give artistic freedom without weakening scientific integrity. The fourth is
covered next.

### 4. The interactive world

The environment itself is the interface. Instead of reading that a reservoir has fallen 12
metres, the user watches its shoreline retreat. Instead of reading that velocity rises on the
outside of a bend, the user sees flow accelerate toward that bank. Graphs, values, sources and
technical explanations stay available, but they support the world rather than replace it.

## Setting

Grass, trees and sky are not backed by data the way the water is, and they do not need to be.
They still matter, for two reasons:

1. **People are drawn to visuals.** We build this for humans. A low-effort setting may never
   earn the attention we need in order to communicate anything. A landscape that looks alive
   and beautiful is what makes a person stay long enough to see the water do something.
   Setting is part of the delivery of the data, not decoration beside it.
2. **A setting still implies things.** Gold summer hills say something about the season and
   climate. A setting should therefore be **plausible and evidence-informed** for the place,
   season and biome (species, colours, terrain cover), and it must never contradict the data.
   It does not need per-blade or per-tree provenance.

Rules for Setting:

- It makes no scientific claim and is not held to the "meaningful property" standard.
- It must not contradict Observed reality (no green hills if the record says a dry gold
  summer; no water where the terrain shows land).
- It should not compete with the water. It supports the story and does not carry it.
- When a setting choice does state something about the place (a default season, a species mix),
  base it on a reasonable source for that place, and change it if the source disagrees.

## Editorial discretion

Some processes are too subtle, slow, small, large or complex to perceive directly, so
visualization may intentionally alter time, scale, colour, particle density, motion, contrast,
visibility and camera perspective. A century of river migration can play in seconds. A weak
secondary current can be shown as visible corkscrew ribbons. Sediment concentration and terrain
relief can be exaggerated.

These choices are acceptable when they clarify an important relationship and do not misrepresent
the scientific conclusion. The objective is **conceptual fidelity rather than literal visual
fidelity**. Where a visual is exaggerated, say so (see below).

## Design standard

A Waterscape experience satisfies both:

> **Every important visual communicates a meaningful property or relationship of the water
> system.**

> **Every scientific claim is traceable to observation, calculation, or a clearly identified
> illustrative interpretation.**

Setting is exempt from the first and bound by the "must not contradict" rule above. That lets
the project be visually ambitious without confusing spectacle with evidence.

## In practice today

The binding class below describes the presentation. The state column describes where the thing
being presented came from. Keeping those separate is important: a modeled quantity can have an
Exact binding, while an observed quantity can be shown through a Derived binding.

| Element | Binding class | Underlying state | Note |
|---|---|---|---|
| Terrain geometry above the waterline | Exact | Observed / processed | Directly follows the bundled USGS 3DEP elevation grid. The service export is bilinearly resampled to roughly 10 m cells and the bundle is quantized, so "Exact" means exact to the bundle grid, not raw lidar-point fidelity. |
| O'Shaughnessy Dam | Derived | Observed / reported | Crest line traced from NAIP, crest elevation from 3DEP, height and length from NID; the cross-section is a generic gravity profile, not the as-built drawings. |
| Dam outlet jets | Illustrative | Assumed | Two outlets placed by eye from a visitor's photograph, always shown releasing; not flow data. |
| Tuolumne below the dam | Derived | Observed | Centre line and width traced from NAIP, surface from 3DEP; drawn as still water, no flow modelled. |
| Drawdown band (Hetch Hetchy) | Illustrative | Derived from 3DEP | Bare bleached rock up to 10 m above the surveyed water, inside the full-pool zone flood-filled from the survey; the height is set by eye, not from storage records. |
| Aerial map inset | Exact | Observed | USGS NAIP orthoimagery over exactly the terrain grid; its request URL is in `aerial.json`. The photograph's date is the service's, not the scene's. |
| Facts and figures in `story.json` | Exact | Reported | Each summary/fact carries an https source; the bundle validator requires the source URL. |
| Water surface and shoreline | Exact | Derived from 3DEP | The rendered surface is exactly `y = 0` at the bundle's `waterLevel`. The pipeline detects the anchor-connected hydro-flattened region in 3DEP and rounds its level to 0.1 m. This is the DEM/survey-time water surface, not a live gauge level. Within ~8 m of the shoreline the drawn edge is illustrative: it follows this shoreline to within about 2.5 m of modelled relief, plus the ebb. |
| Shoreline contact (edge relief, ebb and flow, wet band) | Illustrative | Modeled / interactive | Organic waterline, a slow ebb and a darkened wet band within ~8 m of the shoreline. Amplitude follows the hand-set wave energy, not measured wind or water level. |
| FFT waves and click ripples | Illustrative | Modeled / interactive | The wave model is physically motivated and uses the depth setting, but wave energy is hand-controlled rather than driven by measured local wind; ripples are user-triggered. |
| Refraction, reflections and caustics | Derived | Renderer state | Computed from the current water surface, light and bed through defined optical calculations. Their inputs can themselves be illustrative, modeled or Setting. Water colour (absorption and in-scatter) is a per-body profile chosen by eye, not measured: turbid for the Diablo reservoirs, greener at Crystal Springs. |
| Underwater bed | Derived | Modeled | Synthetic bathymetry from shoreline distance, `bankSlope` and a depth cap, with small procedural relief. `maxDepth` currently uses the dam's sourced hydraulic height as a proxy and `bankSlope` is an estimate; this is not observed bathymetry. |
| Grass, trees, sky, light presets and morning fog | Setting | Biome / presentation profile | Biome-plausible rather than individually observed. The Diablo bundles default to summer/gold terrain; Crystal Springs uses a Peninsula oak and Douglas-fir biome (species from SMC Parks and SFPUC pages, colours tuned to Wikimedia Commons photos) and its Morning preset is an overcast marine-layer morning with valley fog over the water. Light presets are hand-tuned. |
| River Pulse Map water ribbon | Illustrative | Selected USGS discharge / history and seasonal statistics | Bounded width compares gauge discharge within the loaded history; category colors the margins. Blue color, irregular ripples and speed are display choices, not measured width, stage, inundation, water quality or local velocity. Missing history uses a disclosed fixed scale; zero/missing discharge stops motion. |
| Hacienda Bridge / Beach geometry and woodland | Setting | Photo-informed authored reconstruction | Approximate gray steel bridge, left-pier rock, gray pebble beach, banks and grouped trees; local coordinates are not surveyed. The shoreline remains fixed during timeline selection. |
| Hacienda water optics | Derived | Modeled surface/bed and authored light | Fresnel reflections, refraction and approximate caustics consume illustrative ripples and modeled bed geometry. Green color/clarity follows visual references, not measured water quality. See [authored-water notes](../river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/README.md). |

| Jenner gauge card | Exact | Observed USGS 63160 / NAVD88 | Source water level at Highway 1; stale/missing values remain unavailable. No gauge-to-coast level conversion. |
| Sacramento Freeport observation | Exact | Observed USGS 00060 | Source series is selected at or before the requested time with a 45-minute display freshness policy. Stale/missing values stay explicit; no river-wide state or local hydraulics are inferred. |
| Sacramento Freeport daily chart | Exact | Derived USGS 72137 / 00003 | Tidally filtered daily means retain their separate phenomenon and provenance. The chart leaves gaps open and does not substitute them for instantaneous discharge. |
| Freeport close bridge/bank views | Setting | Photo-fitted reconstruction with archival dimensions | Closed green steel crossing uses the 2012 NBI horizontal envelope; heights, sections, links, weights, piers, banks and cameras remain photo-fitted estimates. Portal signs reproduce archived photos, not live clearance data. Fixed shoreline and local coordinates are not surveyed. |
| Freeport water surface/color | Illustrative | Authored surface normals and fixed geometry | Optical ripples, color and clarity are display choices. Gauge discharge does not drive stage, velocity, flooding or ripple speed. |
| Freeport riverfront, marina and roads | Setting | Photo-informed authored geometry and vegetation | Local placements, boats/slips, structures, grass, fields and foliage follow the supplied aerial composition; dimensions/counts are estimates, not a survey, current inventory or seasonal observation. |
| Freeport reflections | Derived | Authored surface, camera and lighting | Planar reflections and Fresnel calculations consume illustrative/authored scene inputs. |
| Freeport terrain and aerial imagery | Exact | Processed USGS 3DEP and NAIP | DEM follows bundle elevations at 1× vertical scale; imagery follows the same cell-edge extent. No bathymetry/current-condition claim. |
| Freeport terrain centerline | Derived | USGS 3DHP | Source positions drape over bundle elevations; named river line width is symbolic. |
| Eel Scotia Bluffs terrain/source aerial | Exact | Resampled USGS 3DEP and aligned NAIP | Preserved source elevations in a 384×384, approximately 14.05 m grid, with no exaggeration; not a native 1 m LiDAR product. Encoding precision is not spatial resolution or accuracy. Source mosaic is archival context, not current conditions. |
| Eel California watershed context inset | Derived | California state/interagency CalWater 2.2.1 geometry | Bundled Eel River hydrologic unit and Lower Eel River hydrologic area, projected and fitted into the inset with the station anchor and study extent. DWR/CDF-led interagency origin and State Water Boards hosting are credited separately. Boundaries finalized in 1999, attribution/documentation updated May 2004; hybrid drainage/administrative context, not flooding, current wet extent or legal jurisdiction. |
| Eel coarse cover palette | Setting | Authored palette informed by aligned imagery | Color classes support form review; not a scientific land-cover or species product. |
| Eel bluff surfaces and forest | Setting | Image-informed deterministic scatter and reused generic tree shapes | Seeded heights, canopy mix, distant atlas lighting and procedural rock grain/bump are authored. Source vertex elevations and water geometry are retained; form/source presentations exclude these authored details. No surveyed species/counts or finer elevation claim. |
| Tuolumne Poopenaut terrain/source aerial | Exact | Resampled USGS 3DEP and aligned USGS/USDA NAIP | Bundle elevations retain NAVD88 metres and 1× vertical scale; 14.66 m exported cells, not a native 1 m lidar grid. Source imagery is archival photographic context, not modeled 3D vegetation or current conditions. |
| Tuolumne mapped river guide | Derived | Projected USGS 3DHP named line positions draped over DEM | Symbolic cyan stroke uses authored 3.5 m rendering clearance; not river width, stage, shoreline, flow or a water surface. Source gaps remain. |
| Tuolumne reused O’Shaughnessy Dam / contact | Derived dam; Setting contact | Original reservoir crest and sourced dimensions; generic profile / authored render cut | Shared reservoir geometry and concrete material, translated in UTM 11 / NAVD88 at 1× scale. Local render-mesh clearance prevents the coarse DEM piercing the face; native source/aerial and dam-off meshes are retained. No reservoir level, synthetic bed or releasing jets are imported. |
| Tuolumne state watershed inset | Derived | California CalWater 2.2.1 HU / HA polygons | Actual state/interagency geography in a longitude/latitude context diagram; no area, legal-jurisdiction or inundation claim. State Water Boards hosting and DWR/CDF/interagency authorship are featured separately from federal sources. |
| Eel surface and moving highlights | Illustrative | Authored image-color classification inside mapped 3DHP footprint, DEM height proxy | Interpolated boundaries and rendering clearance are visual choices, not current stage, bathymetry, velocity or inundation. No gauge drives the surface. |
| Eel reused water optics | Derived | Illustrative shoreline-distance depth, modeled gravel bed and authored light | Default after bounded RP27 visual sign-off, with the previous surface retained. Reuses Hacienda Fresnel/refraction/caustics on the existing clipped surface. Depth scales approximate wet-mask distance by 0.08 and caps at 2.6 m; no surveyed bathymetry, stage, water quality or current is implied. RP26 uses reflection-target depth to mute background over modeled shallows, an authored guard rather than a geometry repair or physical Fresnel correction. Single-plane reflection remains approximate; olive/smeared close reflection and a bright rim remain. See [RP27 review](./archive/river-pulse-history/rp27-water-land-review.md). |
| Eel hero land | Derived | Verified USGS 3DEP 1 m bare-earth source crop, 2018 Northern California Wildfires B4 | An 800×750-cell native crop preserves source heights at 1× scale, encoded at 0.05 m increments. Rendering samples it at 2 m in desktop eye/shore views and 4 m in primary/phone views. Authored seam/wet blending transitions to the previous 14.05 m terrain and preserves existing water contact; no raw point cloud or 1 m mesh everywhere is claimed. [Source audit](../river-pulse/rivers/eel_river/scenes/end/scotia_bluffs/notes/eel-hero-lidar-audit.md). |
| Tuolumne valley water and bank contact | Derived water; Setting contact | USGS 3DHP lines and resampled 3DEP terrain; authored width, depth, bed and contact clearance | Default authored surface within the native valley focus, illustrative 40 m width clipped against actual rendered terrain triangles. DEM-proxy surface spans approximately 79 m of height, so authored sky reflection replaces a horizontal mirror. A bounded contact treatment lowers 457 render vertices by at most 1 m; it is not bathymetry, erosion, measured stage or hydraulics. Source/form river terrain and previous line guide remain selectable. |
| California overview geography | Derived | Census generalized boundary, USGS 3DHP flowlines and 3DEP tinted hillshade | Uniform Web Mercator positioning, 200 m flowline generalization and SVG rounding. This is a state-scale navigation map; it retains source gaps and includes American River forks. |
| California overview line glow and floating state edge | Setting | Authored presentation | Width, selection color, glow and decorative edge emphasize navigation. They are not measured discharge, channel width, land-cover colors or 3D elevation extrusion. |
| Jenner coast, rocks, sand spit and vegetation | Setting | Photo-informed authored reconstruction | Fixed open-mouth composition, not surveyed terrain or today’s observed mouth status. |
| Jenner swell, foam, swash and water colors | Illustrative | Authored surface and depth profile | Contrasts calm estuary with Pacific surf; not measured tide, currents, waves or water quality. Optical calculations consume authored inputs. See [Jenner scene](../river-pulse/rivers/russian_river/scenes/end/jenner/README.md). |

This table is an implementation reading, not a full scientific audit. Update it when either the
underlying state or a visual binding changes.

## Not built yet

- **Disclosure in the UI.** Viewers should be able to tell what is exact, derived, illustrative
  or setting, see the provenance/method of the underlying state, and see any exaggeration factor
  (for example vertical exaggeration) where one applies. River Pulse's evidence drawer and
  scene labels now explain its quantities and illustrative/authored views; comprehensive
  binding disclosure across all experiences remains open.
- **Enforcement.** A binding manifest per water body, checked by `pipeline/validate-bundles.mjs`
  the way `story.json` source URLs are checked, would fail the build on an unlabeled visual.
- **Time-driven data.** A strong first test of this principle is a time control that moves the
  shoreline from measured reservoir history. No `storage.json` or CDEC time series is committed
  in the current bundles, and the storage/elevation-to-shoreline mapping must be defined before
  assigning its final binding class.
- **Setting evidence.** The current Diablo Range biome is intentionally plausible, but the
  species mix and default-season assumptions are not yet source-cited at the same level as the
  scientific data. The doctrine above is the target standard for future biome profiles.
- **Other water systems.** River Pulse now provides an initial river experience within this
  repository: Hacienda terrain, gauge observations, time selection and visual bindings, with
  a Jenner authored coastal scene and source water-level card. River hydrodynamics are not implemented. Watersheds, aqueducts,
  groundwater, treatment plants, floodplains and distribution networks remain future
  experiences. Extract shared machinery only where these experiences prove a common need.

## Vision

The long-term goal is not to simulate water. It is to help people understand water systems by
seeing them operate, and to create a moment where an abstract concept suddenly becomes
intuitive:

**"Oh. Now I can see what the water is doing."**
