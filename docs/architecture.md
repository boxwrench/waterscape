# Architecture

Waterscape is a static site. The journey page (`index.html`, `site/`) plays each stop's
flyover video and fact card; "Explore in 3D" embeds the live page
(`renderer/explore.html?reservoir=<id>&embed=1`) in an iframe.

## Data flow

```
data/<id>/source.json ──pipeline/build.py──▶ data/<id>/terrain.bin.gz, terrain.json, cameras.json
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
| `presets.js` | `PRESETS` (morning, midday, golden), `presetBuffer` (six float4s), `choosePreset` |

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
