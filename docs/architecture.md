# Architecture

Waterscape is a static site. The journey page (`index.html`, `site/`) plays each stop's
flyover video and fact card; "Explore in 3D" embeds the live page
(`renderer/explore.html?reservoir=<id>&embed=1`) in an iframe.

The `river-pulse/bootstrap` branch also contains a sibling experiment, **River Pulse**. River
Pulse reuses selected geospatial/rendering infrastructure but does not turn Waterscape's
still-water model into a river model. Its own contract lives in
[`docs/river-pulse/implementation-contract.md`](river-pulse/implementation-contract.md).

## Waterscape data flow

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

## The Waterscape engine (`renderer/engine/`)

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

## Anatomy of a Waterscape frame (`step`)

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

## River Pulse architecture

River Pulse uses a separate scientific-state path:

```text
source records
  → source adapters
  → normalized Quantity + provenance
  → deterministic time selection
  → RiverState
  → visual bindings
  → corridor / hero renderers + charts + labels
```

The central rule is that scientific state is independent of presentation. A discharge
observation remains the same Quantity whether it drives an exact label, a hydrograph, an
illustrative river width, a seasonal-condition color, particles, foam, or a local hero-water
effect.

### Two visual scales

River Pulse does not force one water renderer across every camera scale.

**Corridor / overhead** uses a cheap, legible, animated river representation over long reaches.
The first planned display modes are relative-flow width and USGS seasonal-condition color.
Width is illustrative unless a bank/water-extent source or hydraulic model supports literal
geometry.

**Authored-place / hero** uses higher-detail local water at places such as Hacienda and Jenner.
This is where Waterscape optics, refraction/reflection, caustics, foam, current cues, local
geometry and authored lighting can be adapted aggressively. The visual facsimile can differ
from the corridor renderer because the communication problem and perspective differ.

Both scales consume the same RiverState through declared visual bindings. Neither renderer may
silently turn discharge alone into measured local depth, water-surface elevation, bank width or
velocity.

### Shared/reused pieces

River Pulse currently reuses or adapts the parts of Waterscape that are genuinely generic:

- USGS 3DEP acquisition and WGS84/UTM georeferencing
- terrain transport/sampling concepts with absolute river elevation semantics
- Three.js/WebGPU land rendering patterns
- flight camera/navigation
- quality/validation patterns
- selected water optics for future authored-place rendering

Reservoir flat-water detection, one-water-level semantics, shoreline-distance/basin-depth
assumptions, and reservoir automatic viewpoints remain Waterscape-specific.

## Quality

Tier 2 (high) is the full Waterscape budget; medium and low shorten terrain shadows, reflection
steps, and near-tree detail, and the governor also steps resolution. NVIDIA starts high, other
vendors medium; frames over 33 ms step down, under 16 ms for 4 s step up once. The journey shows
"struggling" only when the lowest level is still over 60 ms.

River Pulse should preserve measured quality adaptation while treating corridor and hero water
as separate budgets: map-scale water should remain cheap enough for long reaches, while authored
places may spend substantially more GPU budget near the camera.

## The native host

`Native/` is an optional Windows CUDA application that includes `renderer/water.cu` directly.
It keeps the traced land (`landPass = 0`) and the golden-hour light; it is a development tool,
not part of the site.

## Design history

Waterscape specs and implementation plans live in `docs/design/`. River Pulse decisions and
running implementation notes live in `docs/river-pulse/`.
