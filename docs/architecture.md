# Architecture

Waterscape is one static-site repository with multiple water-system experiences. Its shared
principle is [Making Water Visible](making-water-visible.md): **reality → scientific state →
visual bindings → interactive world**. Provenance belongs to scientific state; the exact,
derived, illustrative or setting class belongs to each visual binding.

## Experience boundaries

- **Reservoirs:** existing `index.html`, `site/`, `renderer/`, and `data/` retain their URLs
  and still-water semantics. The root opens the reservoir journey, with navigation to River Pulse.
- **River Pulse:** `river-pulse/` contains `adapters/`, `data-model/`, `visual-bindings/`,
  `renderer/`, and `data/`. `/river-pulse/` opens the Hacienda prototype; its header links to
  Jenner's coastal scene, which uses the same place registry and a separate source level card.
- **Shared infrastructure:** one `vendor/`, `pipeline/`, `scripts/`, npm install and Pages
  build. River Pulse already imports the root camera utilities and inverse UTM helper. Python
  river builders reuse elevation acquisition and projection, not reservoir detection.
- **Shared doctrine, separate scientific models:** river elevations remain absolute; river
  discharge is not converted into reservoir levels or assumed local velocity. Keep each
  experience's data package and validator separate until a stable shared contract is proven.

Do not maintain a complete Waterscape clone inside River Pulse, or move every path into an
`apps/` framework just to make the directory tree symmetrical. Extract a shared module when
both experiences actually use the same behavior. Future experiences can follow the River Pulse
boundary; this is one repository, not a collection of nested repositories or submodules.

The Pages build follows browser imports from all HTML module entries and explicitly copies
styles, static assets and both data roots. `validate-river-packages.mjs` rejects missing or
malformed terrain, missing centerlines and stale registries before publication. Hacienda terrain is a committed
USGS artifact; rebuilding it is deliberate, not a deployment-time network dependency.

The reservoir journey embeds the live page
(`renderer/explore.html?reservoir=<id>&embed=1`) in an iframe. River Pulse has an independent
scene and time selection UI; the existing reservoir engine is not its river-flow model.

### River Pulse rendering

Hacienda keeps two scene spaces: Map drapes a continuous ribbon over sourced USGS terrain;
Bridge and Hacienda Beach show a separate photo-informed local reconstruction. Only Map
reports source coordinates/elevation. The authored shoreline stays fixed during time selection.

`visual-bindings/map-flow.js` maps eligible selected discharge to bounded display width
within the loaded history range. `renderer/map-ribbon-geometry.js` builds the terrain-draped
strip; `renderer/map-flow.js` gives it blue irregular moving detail and seasonal-color margins.
Zero/missing discharge stops motion; absent history uses a disclosed fixed fallback scale.
These mappings are illustrative, not inferred stage, banks or local velocity.

`hacienda-beach.js` composes bridge, rock, pebbles and woodland; `authored-water.js` supplies
green water, planar reflections, refraction and approximate caustics. Local setting assets
live under Hacienda's `setting/` package, with source/license metadata. Three/TSL is shared
with the umbrella; reservoir water kernels are not used as river hydraulics. See
[authored-water notes](river-pulse/authored-water.md) for sources and optical limits.

`jenner.js` composes an authored coastal height field, sand spit, rocks, woodland and shore
views. `jenner-water.js` contrasts calm estuary optics with Pacific swell/foam using a small
MIT Tidewater noise adaptation. `jenner-level.js` selects eligible USGS NAVD88 observations
for the separate Highway 1 card; it does not drive coastline, tide, currents or mouth status.
Both pages load through `data-model/place-registry.js`. See [Jenner notes](river-pulse/jenner-scene.md).

## Data flow

```
data/<id>/source.json ──pipeline/build.py──▶ data/<id>/terrain.bin.gz, terrain.json, cameras.json,
                                              aerial.jpg, aerial.json (pipeline/aerial.py, NAIP)
data/<id>/story.json, land.json (hand-written)        pipeline/render-flyover.mjs ──▶ flyover.mp4, poster.jpg
data/biomes/<biome>/  (shared per landscape)          data/tours/<tour>.json (journeys)
                                   │
                    renderer/engine/body.js  loadBody(id) → { terrain, viewpoints, land, biome }
```

`pipeline/validate-bundles.mjs` (part of `npm test` and CI) checks every body, biome and tour.
Terrain is USGS 3DEP lidar in a local frame: x east, z south, y up from the water surface,
origin at the water's centroid; `terrain.json` records the UTM zone and origin.

## The engine (`renderer/engine/`)

| Module | Interface |
|---|---|
| `waterscape.js` | `createWaterscape(canvas, body, { onError, onProgress, time, playing })` → `{ rt, state, settings, diag, lab, setPreset(name), step(dt), resize(width), tap(sx, sy), width, height, locked }` |
| `body.js` | `loadBody(id)`, `viewpoint(body, name)` |
| `camera.js` | `viewRay` (matches the shader's `ray()`), `fly(state, input, dt, terrain)`, `altitudeFactor`, `terrainClearance` |
| `quality.js` | Quality ladder (tier × width), `QualityGovernor`, `startingLevel(vendor)`, `forcedTier` |
| `presets.js` | `PRESETS` (morning, midday, golden), `presetBuffer(preset, look)` (twelve float4s: light, then the land look, fog and water optics), `choosePreset` |
| `look.js` | `landLook(land)` from `land.json` (summer grass, cover, species weights and stands, fog, water optics), `effectivePreset` (overcast fog mornings), `speciesThresholds`, `pickSpecies` — shared by the kernel and the three.js land |

`renderer/minimap.js` (`createMinimap(parent, base, terrainMeta)`, `mapPoint`) draws a body's
`aerial.jpg` with the camera marked, in the explorer and on the journey page.

The page (`renderer/explore.js`) owns controls, input, readouts, the quality governor and
journey messaging. It keeps `ws.settings` in sync with its controls and calls `ws.step(dt)`
each animation frame.

## Anatomy of a frame (`step`)

1. **Waves** — `evolve_spectrum` + 16 FFT passes produce three 256² height/slope cascades
   (4.6 m, 37 m, 293 m).
2. **Ripples** — a 256² camera-relative wave-equation field stepped at a fixed 120 Hz.
3. **Land pass** (`renderer/land/`) — three.js draws the lidar mesh on the runtime's own
   GPUDevice into colour + depth; `pack.js` turns depth into distance along each pixel's ray.
4. **Caustics** — 1024² refracted rays splatted into a 512² RGB field.
5. **`render_water`** — per pixel: sky, land (shaded at the land-pass distance), and water
   (Fresnel, refraction to the bed, caustics, reflections of traced terrain and sky).
6. **Lens and output** — optional FFT diffraction glare, bloom, tone curve, then a direct
   buffer-to-canvas copy. No GPU→CPU readbacks in the loop.

Light comes from a six-float4 preset buffer shared by sky, land, water and caustics.

## Quality

Tier 2 (high) is the full budget; medium and low shorten terrain shadows, reflection steps,
and near-tree detail, and the governor also steps resolution. NVIDIA starts high,
other vendors medium; frames over 33 ms step down, under 16 ms for 4 s step up once. The
journey shows "struggling" only when the lowest level is still over 60 ms.

## The native host

`Native/` is an optional Windows CUDA application that includes `renderer/water.cu` directly.
It keeps the traced land (`landPass = 0`) and the golden-hour light; it is a development tool,
not part of the site.

## Design history

Specs and implementation plans live in `docs/design/` — read them for why things are the way
they are.
