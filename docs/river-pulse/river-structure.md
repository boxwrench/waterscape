# River structure — how every river is organised

A reusable pattern, so each new river feels like the others. Read
[Making Water Visible](../making-water-visible.md) first; this file only says how a river is
divided into places and views.

## River → places → views

- **A river has about three authored places** (locales). Each is a close-up with its own scene.
- **A place has one to a few views.** More than one is optional; add one only when a second
  angle shows something the first cannot (Hacienda: bridge and beach; Jenner: lookout, shore,
  beach).
- **The river overview** ties places together. It is the terrain view where source terrain
  exists. A whole-river terrain in segments is undecided. A static aerial appears only as a
  small pinned inset with place pins, like the reservoir minimap (`renderer/minimap.js`),
  never as the main view.

## Choosing places

Default set: **start, scenic middle, end.**

1. **End:** the mouth, estuary or confluence (Russian River: Jenner).
2. **Start:** the *spiritual* start, meaning where people feel the river begins. This is
   usually not the hydrological source. Choose it from what people photograph and visit, not
   from the headwaters.
3. **Middle:** the most scenic or best-known reach between them, unless a **special situation**
   justifies another choice: a famous flood site, a dam, a gauge with a long record.
4. **Heuristic:** the number of public photographs of a candidate place is a good sign of how
   much it matters, and of how many views it can support. Count from a source you fetched and
   record its URL and the date; never write a count from memory. Photographs also inform
   scene composition, as Jenner's references do (`setting/references.json`).

Photographs inform Setting only. They are not redistributed and make no scientific claim.

## History at every level

- **Overview:** the timeline drives the river's condition at each place pin and the map ribbon.
- **Place close-ups do not replay all history.** They show a **historical high and low** so the
  viewer can judge scale (the river at Hacienda in a flood stands visibly higher). The viewer
  chooses Low, Now or High.
- The high and low come from fetched observations of the same gauge (for example USGS gage
  height, parameter `00065`, over its period of record). Record the URL beside the value. If
  the fetch fails or a value is missing, say so; do not estimate stage from discharge.
- The water height in an authored scene is an **Illustrative** binding. The real gauge
  numbers stay visible in the interface beside it.

## Adding a river

1. Pick the three places with the rules above, record photo evidence, and add each place
   manifest to `river-pulse/data/<river>/places/<id>/`.
2. Build terrain and hydrography for each place (`pipeline/build_river_*.py`) and regenerate
   the registry.
3. Give each place a gauge with a period of record for its high and low.
4. Author the views. Keep the same interface: place header, selected-flow readout, history
   deck, Low / Now / High, evidence drawer.
5. Run the river package checks: `node pipeline/validate-river-packages.mjs`.
