# Reuse the reservoir renderer across River Pulse

Start a suitable new scene by inventorying existing Waterscape bodies, terrain products,
materials, detail tiles, lighting and vegetation before considering new data acquisition.
Keep each source bundle and its coordinate and vertical datum explicit. Reuse a component when
its geography and visual meaning fit; adapt its presentation and document assumptions where
they do not. A shared renderer or palette does not make one river's terrain, water level,
geology or species valid for another.

## Reusable components

- `renderer/land/ground.js` blends ground textures by terrain form and season; `granite.js`
  supplies layered rock, joints and slab treatments. Biome files under `data/biomes/` hold
  texture sources, licenses, palettes and vegetation recipes.
- `data/<body>/detail.json` and `detail-*.webp`, consumed by `ground.js`, provide
  georeferenced fine relief shading. Their sample spacing and source resolution must be
  described accurately; they shade the terrain mesh rather than adding geometric detail.
- `renderer/engine/presets.js` and `look.js` coordinate sun, sky fill, haze and place profile.
  `renderer/water.cu:bake_light` provides terrain-wide sun visibility and sky openness used by
  the three.js ground pass.
- `renderer/land/scene.js`, `trees.js`, `impostors.js` and `grass.js` layer instanced grass,
  near tree meshes and distant tree impostors over the terrain.

These are techniques and rendering components. Hetch Hetchy's exact detail tile, drawdown
band, signed still-water shoreline, reservoir surface and synthetic basin bathymetry are
place-specific assumptions. The 1 m-spaced detail exports are service-resampled and encoded
as normal/relief images; they do not establish native 1 m terrain geometry. Do not feed
absolute-elevation RiverTerrain into the stock reservoir water kernel, which expects a
reservoir-relative surface and signed shoreline and derives its underwater bed from depth and
bank-slope settings.

## Candidate application by place

| River Pulse place | Reuse direction | Boundary |
|---|---|---|
| Tuolumne dam | Show the complete existing Hetch Hetchy scene and bundle as a distinct reservoir context. | Keep Poopenaut native terrain/source modes separate; do not combine reservoir level with river stage. |
| Tuolumne canyon; American River | Consider adapted Sierra granite materials and lighting after checking local references. | Candidate visual direction only; confirm geology, setting and source coverage first. |
| Sacramento; San Joaquin | Consider shared material and lighting techniques with palettes and bank surfaces suited to each referenced scene. | Slower/alluvial is a visual candidate, not an established geology or material prescription. Calibrate against place references. |
| Eel / Scotia Bluffs | Use its own reference-led bluff, gravel and vegetation calibration. | Do not apply Sierra granite or species recipes automatically. |
| Russian River | Retain existing Hacienda/Jenner work and reuse proven shared pieces where they fit. | Preserve their existing source and authored-setting boundaries. |

RP23 presents the full Hetch Hetchy renderer through a dedicated full-viewport canvas at the
dam, while the Poopenaut views retain their own native/source presentations. The reservoir
engine and kernel remain unchanged; the two contexts stay distinct, with no stage transfer.
This is a reuse path for a relevant reservoir context, not a claim that every river now has a
finished terrain or water visualization.

## Next bounded terrain trials

- Eel: try the existing Diablo rock/soil maps' triplanar and anti-tiling techniques
  on one dry bluff face, using its fixed eye/contact views and its own place references.
  Asset names do not establish the bluff's geology.
- Sacramento: compare existing `river-pulse/renderer/bank-materials.js` and
  `freeport-setting.js` with the reservoir ground textures in one bank-contact pass.
  The shared photo manifest is under
  `river-pulse/data/russian_river/places/hacienda_bridge/setting/materials.json`.
- Tuolumne valley: trial the existing Sierra `ground/joints_*` and `ground/slab_*`
  maps on one dry slope. Keep the native elevation mesh and plain/source comparisons.

Port selected material functions or build an explicit native-terrain adapter.
The stock ground pass expects reservoir-relative heights and signed shoreline,
valley and drawdown channels that RiverTerrain does not contain. Preset light
directions can guide the river lights; reservoir radiance/exposure values are
not interchangeable with Three light intensities. Each trial needs actual
before/after renders and measured cost before wider application.
