# Waterscape

**Hydrology, simulated.** Real lakes and reservoirs, rebuilt from public lidar and public
records, and brought to life in the browser. Each water body becomes a stop on a journey: a
pre-rendered flyover that plays on any device, and — in Chrome or Edge with WebGPU — a live 3D
scene where the water is simulated and lit in real time and you can fly anywhere over the land.

**Live:** https://boxwrench.github.io/waterscape/ — starting with the Hetch Hetchy Regional
Water System (Calaveras and San Antonio reservoirs). What comes next is in the [roadmap](ROADMAP.md).

![Calaveras Reservoir in live 3D](previews/calaveras-overlook.png)

## Making water visible

Water systems are hard to understand because their most important processes are invisible.
Waterscape's guiding principle is to make them visible: *real data provides the backbone,
science determines the relationships, and visual interpretation makes those relationships
visible.* Every visual is one of four kinds: **exact** (a measured or calculated quantity),
**derived** (a defined mapping from one), **illustrative** (emphasis of a real concept without
literal accuracy) or **setting** (the grass, trees and sky that make people want to look, kept
plausible for the place but carrying no claim). Exaggeration is allowed when it clarifies, and
every scientific claim must trace to a source or be labelled illustrative. The full principle is
in [docs/making-water-visible.md](docs/making-water-visible.md).

## How a frame is made

- **Land** — the water body's USGS 3DEP lidar is a triangle mesh drawn by
  [three.js](https://threejs.org) on the page's WebGPU device.
- **Water** — a CUDA program ([`renderer/water.cu`](renderer/water.cu)), compiled to WebGPU by
  [cuda-webshader](https://github.com/SamG-Coder/cuda-webshader), simulates FFT waves and
  click ripples, then traces refraction, caustics and reflections. It reads each pixel's
  distance to the land from the three.js pass, so land and water meet exactly.
- **Light** — three hand-tuned presets (Morning, Midday, Golden hour) set the sun, a Preetham
  sky with drifting clouds, fill light and haze.
- **Quality** — the renderer picks a tier from the GPU and adapts tier and resolution to hold
  ~30 fps; a chip shows the GPU in use and how to switch a laptop to its faster one.
- **Everyone else** — browsers without WebGPU get the flyover video and the same facts.

## Make your own waterscape

Any US lake, reservoir or pond with 3DEP lidar coverage can become a stop:

1. Create `data/<id>/source.json` — name, biome, a lon/lat box around the water and an
   on-water anchor point.
2. `python pipeline/build.py <id>` — downloads the lidar and writes the terrain and cameras.
3. Write `data/<id>/story.json` (facts, each with an https source) and `data/<id>/land.json`
   (light presets, default season).
4. `node pipeline/render-flyover.mjs <id>` — renders the flyover video and poster.
5. Add the stop to a tour in `data/tours/`, run `npm test`, and publish with GitHub Pages.

The full guide, with field references and examples, is
[docs/make-a-waterscape.md](docs/make-a-waterscape.md).

## Run locally

Requires Node.js 20+ and Chrome or Edge. On Windows, double-click **`START.bat`**; otherwise:

```
npm ci
npm start
```

Open **http://localhost:5173/** for the journey, or
**http://localhost:5173/renderer/explore.html?reservoir=calaveras** for live 3D.

In live 3D: drag or arrow keys to look; W/A/S/D to fly, E/Q up and down; scroll sets speed,
Shift boosts (speed also grows with height above the ground). Click water for ripples, Space
pauses, H hides the controls. The panel sets wave energy, basin depth, exposure, season,
light, resolution and lens glare; PNG saves the frame.

URL options: `?reservoir=<id>`, `?preset=morning|midday|golden`, `?quality=low|medium|high`
(pins a tier), `?t=<seconds>` (fixed wave time); the journey takes `?tour=<tour>`.

## Repository layout

| Path | What it is |
|---|---|
| `index.html`, `site/` | The journey page (videos, facts, "Explore in 3D") |
| `renderer/explore.*` | The live 3D page: controls, input and readouts |
| `renderer/engine/` | The engine: `waterscape.js` (runtime, kernels, frame), `body.js`, `camera.js`, `quality.js`, `presets.js` |
| `renderer/land/` | three.js land pass: terrain mesh, depth → distance pack |
| `renderer/water.cu` | All water simulation and image formation (CUDA, shared with the native host) |
| `data/<id>/` | One folder per water body: `source.json` (inputs), terrain, cameras, story, land profile, flyover, poster |
| `data/biomes/<biome>/` | Reusable assets per landscape type (`diablo-oak` today) |
| `data/tours/<tour>.json` | Journeys: ordered stops |
| `pipeline/` | Builds and checks water bodies: `build.py`, `render-flyover.mjs`, `validate-bundles.mjs` |
| `vendor/` | cuda-webshader and three.js, vendored (the site loads nothing from CDNs) |
| `Native/` | Optional native Windows CUDA host (developer tool) |
| `docs/` | [Architecture](docs/architecture.md), [make a waterscape](docs/make-a-waterscape.md), design history; see also the [roadmap](ROADMAP.md) |

## Tests

```
npm test
```

Serves itself, compiles all 20 CUDA kernels, validates every water body, biome and tour, and
drives Edge through Playwright: FFT correctness, optics, zero readbacks in the frame loop,
ripples, viewpoints, presets, resizing, quality tiers and the journey. Pipeline tests:
`python -m pytest pipeline/tests -q`.

## Scope

Still water only — one water level inside a shoreline. Landforms and shorelines come from
lidar (~10 m); everything finer is procedural or from shared biome assets. Lidar flattens
water, so the bed is modelled as banks falling about 1:3 to the chosen basin depth, and the
water level is the level at survey time. Outside the lidar crop the land falls away under
painted far ridges.

## Credits and licences

- Water optics: [Clearwater](https://github.com/Aureliengmz/clearwater) by Aurélien / Lumaris
  (MIT) and its CUDA reimplementation [SamG-Coder/clearwater](https://github.com/SamG-Coder/clearwater) (MIT).
- [cuda-webshader](https://github.com/SamG-Coder/cuda-webshader) (MIT) and
  [three.js](https://github.com/mrdoob/three.js) r186 (MIT), vendored under `vendor/`.
- Terrain: USGS 3D Elevation Program, public domain. Facts: public records cited per fact.
- References: Tessendorf (FFT water), Evan Wallace (caustics), Preetham et al. (sky),
  Inigo Quilez (texture repetition), Olano & Baker (LEAN mapping).

MIT licence ([`LICENSE`](LICENSE)); third-party notices in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
