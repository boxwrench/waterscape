# Reservoir context around the water

Water, especially the shallow bed, ripples and caustics, is the memorable visual. Real
reservoir information gives the scene meaning. Keep cameras and rendering unchanged.

## Design and implementation

Reuse the existing visual language: deep water background `#173d42`, translucent water-glass
`#183f46b8`, pale text `#eef6f2`, muted text `#bcd3cf`, light rules `#ffffff2e`.
Retain Georgia for the reservoir name and system-ui for body and controls. Left-align the
existing corner card; use the existing narrow measure and no new decorative panels.

```
Reservoir name / operator
Who the regional system supplies [source]
Capacity [source]
> Reservoir & scene details
Previous / Explore / Light / Next
```

The disclosure contains the existing headline and other sourced facts, a note that capacity
is not current storage, and a plain explanation of data and simulation. The reference year
belongs to the USGS point sample, not necessarily every terrain tile. The scene has a fixed
water elevation; the underwater bed, waves and light are modeled, not live observations.

Optional `story.summary = { value, source }` supplies the short context and
`fact.featured = true` chooses the compact card fact. Older bundles fall back to their
headline and first fact. Keep all other facts available within a native `<details>`.
Reset expansion and scroll on a stop change so each reservoir opens with water in view.

Bound the card height and scroll its contents on small/short screens. Wrap navigation
controls, retain visible keyboard focus, and prevent scroll/key interaction inside the
card from navigating to another reservoir. Respect reduced motion for the media fade.

## Review against the brief

Adding a second permanently visible provenance panel would consume the shallow-water view.
Use a disclosure in the existing card instead. Keep the source-linked capacity and supply
context visible; make deeper reading optional. Trees, new camera framing and decorative
data graphics add nothing to this task and remain unchanged.

## Verification

Check both reservoirs in video and live modes, keyboard disclosure control, source links,
legacy metadata, and narrow/short viewports. Inspect desktop/mobile screenshots. Use the
existing full suite for navigation and live-handoff regressions.
