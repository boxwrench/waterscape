# Roadmap

Where Waterscape is going, in rough order. Each step gets its own design spec and
implementation plan in [`docs/design/`](docs/design/) before it is built; this page is the
map, not the contract.

The roadmap broken into agent-sized tasks — including fully spelled-out tasks for small local
models — is the [work queue](docs/roadmap/README.md); agents start with [`AGENTS.md`](AGENTS.md).

The repository also contains the separate **River Pulse** experiment on the
`river-pulse/bootstrap` branch. River Pulse reuses parts of the terrain/rendering stack but has
its own river data model, authored-place system, and visual-binding contract under
[`docs/river-pulse/`](docs/river-pulse/). It should not be confused with Waterscape's still-water roadmap below.

## Shipped

- **Journey + video tier** — Calaveras and San Antonio reservoirs (Hetch Hetchy Regional Water
  System) as stops with pre-rendered flyovers and sourced fact cards; works on any device.
- **Live 3D** — FFT water, ripples, caustics and reflections in a CUDA shader compiled to
  WebGPU, over USGS 3DEP lidar terrain.
- **Automatic quality** — tiers chosen from the GPU and adapted to hold ~30 fps; a GPU chip and
  a tip for laptops that hand the browser their integrated graphics.
- **Land foundation** — three.js draws the lidar terrain on the same GPU device as the water
  (about twice as fast on integrated graphics); Preetham sky with drifting clouds; Morning,
  Midday and Golden hour light presets; summer-gold hills by default.
- **Engine and data architecture** — one folder per water body, shared biome assets, tours,
  any US location, the engine split from its page, and a
  [make-your-own guide](docs/make-a-waterscape.md).

## Next: land that holds up up close

The goal: grass that moves in the breeze and real oak trees — no flat, low-quality texture from
knee height to the horizon — on NVIDIA as the showcase and still smooth on integrated graphics.

1. **Ground and grass**
   - CC0 photo materials per biome (green grass, dry grass, bare soil, rock) blended by slope,
     ravines and season, with anti-tiling; land colour moves from the water shader to three.js.
   - A camera-following field of instanced grass blades with rolling gusts, swell and
     per-blade flutter, thinning into the ground material at its edge.
2. **Oaks**
   - California coast live, blue and valley oak variants — ez-tree presets tuned toward real
     silhouettes, or authored in Blender — baked into `data/biomes/diablo-oak/`.
   - Full meshes with leaf cards near the camera, octahedral impostors far away; placement from
     one `density(x, z)` function (procedural now, land-cover data later).
   - Water reflections of land drawn from a mirrored three.js render on the high tier.
3. **Light and tuning**
   - Cloud shadows sweeping across the land and the water.
   - Per-tier budgets for grass count, tree range and shadows, tuned on Intel and NVIDIA.
   - Preset polish: calmer far-water reflections under the brighter horizon, per-preset water
     tint.
   - Flyover videos and posters re-rendered with the new land (they still show spring green).

## Then: the journey grows

4. **Water level and timeline** — monthly storage from CDEC; water levels above the lidar
   survey level filled from the dam line (USACE National Inventory of Dams); a month timeline
   on the fact cards.
5. **Crystal Springs and San Andreas reservoirs** — same oak-woodland biome, so they are data
   only.
6. **Hetch Hetchy** — a new Sierra granite and conifer biome (ground, rock, pines and cedars).
7. **More tours** — beyond the Hetch Hetchy system, e.g. the State Water Project and the
   remaining California reservoirs; anyone can add their own lake with the guide.

## River Pulse experiment

River Pulse is intentionally developed in smaller verified batches rather than being folded into
Waterscape's still-water engine. Its current direction is:

1. authoritative Russian River terrain/hydrography plus USGS flow/time context;
2. a **corridor/overhead river representation** with animated flow, relative-flow-width and
   seasonal-condition-color display modes;
3. a separate **authored-place hero-water representation** for Hacienda and Jenner with much
   higher visual fidelity and place-specific optics/current cues;
4. forecast/weather/model layers and replay after the observed/historical path is solid;
5. contributor/package generalization only after the first river proves the abstractions.

The two River Pulse visual scales consume the same selected scientific state but are not forced
through one renderer. Expressive simulation is allowed; unsupported hydraulic quantities are not silently presented as measurements.

## Scene controls

A compact Scene panel in live 3D and in the journey's live view:

- Light presets (shipped) and season (shipped).
- **Wind** — strength and direction for waves and grass gusts.
- **Clarity** — clear to turbid water.
- Settings remembered per visitor and shareable by URL.

## Later and ideas

- Real land-cover data (e.g. LANDFIRE / USGS tree canopy) replacing procedural vegetation
  placement, so every water body's trees stand where they really are.
- A deeper layer for enthusiasts: lidar acquisition dates, measured water-surface area,
  shoreline and slope profiles, bathymetry where it exists (the 2018 USGS San Antonio survey),
  dam specifications, state water-system layers (SWRCB / DDW).
- A local "studio" for building and previewing water bodies without the command line.
- Git LFS for media once the repository holds about 20 water bodies.

## Known issues

- On integrated graphics the low tier is close to its 33 ms budget when the laptop is warm or
  other 3D tabs are open.
- Far water can look speckled (white sky vs. green hill reflections) at the Shoreline view.
- Flyover videos predate the summer-gold default and the new sky.
- The optional native Windows host is not rebuilt with each change.

## Not planned for Waterscape itself

Waterscape's current product remains focused on still water with one level inside a shoreline;
rivers and coasts are therefore not being added by mutating the reservoir model. River Pulse is
the separate river path in this repository. Also not planned here: elevation sources outside
the US, accounts or any server-side component, or a continuous multi-reservoir world.
