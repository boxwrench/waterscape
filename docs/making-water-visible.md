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

- **Exact**: directly represents a measured or calculated quantity (the lidar terrain; a
  shoreline placed at a measured water level).
- **Derived**: transformed from scientific state by a defined, documented mapping (a colour
  ramp over shear stress).
- **Illustrative**: emphasizes a scientifically supported concept without claiming literal
  physical accuracy (corkscrew ribbons for a weak secondary current; amplified sediment).
- **Setting**: makes no scientific claim. It is the world the water sits in: grass, trees,
  sky, light, clouds.

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
   climate. So a setting must be **aligned with reality somewhat**: it should be plausible for
   the place, the season and the biome (species, colours, terrain cover), and it must never
   contradict the data. It does not need per-blade or per-tree provenance.

Rules for Setting:

- It makes no scientific claim and is not held to the "meaningful property" standard.
- It must not contradict Observed reality (no green hills if the record says a dry gold
  summer; no water where the lidar shows land).
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

| Element | Class | Note |
|---|---|---|
| Lidar terrain | Exact | USGS 3DEP; source in each bundle |
| Facts and figures in `story.json`, `storage.json` | Exact | every number carries its fetched https source |
| Water surface height | Exact / Derived | a fixed reference plane, y = 0, with land heights relative to it |
| Waves, caustics, ripples | Illustrative | modeled, and not tied to measured wind or flow |
| Basin depth and bed | Derived / Illustrative | modeled from the shoreline and the bundle's depth setting |
| Grass, trees, sky, light presets | Setting | biome-plausible; gold summer is each bundle's default season |

This table is our current reading, not an audit. Update it when a visual changes class.

## Not built yet

- **Disclosure in the UI.** Viewers should be able to tell what is exact, derived, illustrative
  or setting, and see any exaggeration factor (for example vertical exaggeration) where one
  applies. Nothing does this yet.
- **Enforcement.** A binding manifest per water body, checked by `pipeline/validate-bundles.mjs`
  the way `story.json` sources are checked, would fail the build on an unlabeled visual.
- **Time-driven data.** The clearest first test of this principle is a time control that moves
  the shoreline with measured storage (the CDEC monthly records we already hold): the first
  fully Exact and Derived visual.
- **Other water systems.** Rivers, watersheds, aqueducts, groundwater, treatment plants,
  floodplains, estuaries and distribution networks can share the architecture. Build the generic
  machinery only when a second kind of system exists.

## Vision

The long-term goal is not to simulate water. It is to help people understand water systems by
seeing them operate, and to create a moment where an abstract concept suddenly becomes
intuitive:

**"Oh. Now I can see what the water is doing."**
