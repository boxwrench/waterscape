# Roadmap

Where Waterscape is going, in rough order. Each step gets its own design spec and
implementation plan in [`docs/design/`](docs/design/) before it is built; this page is the
map, not the contract.

**Direction:** shallow water is the visual centerpiece; real reservoir data gives it
meaning. Preserve the close-up bed, caustics, ripples and transition to deeper water.
Landscape detail supports that experience. Do not move opening cameras to showcase trees.

The roadmap broken into agent-sized tasks — including fully spelled-out tasks for small local
models — is the [work queue](docs/roadmap/README.md); agents start with [`AGENTS.md`](AGENTS.md).

## Waterscape umbrella

Follow [Making Water Visible](docs/making-water-visible.md). Waterscape encompasses several
visual representations of water data, each keeping its scientific state and visual bindings
explicit. Reservoirs and [River Pulse](river-pulse/README.md) share one repository and build.
River Pulse connects Hacienda terrain, discharge/history and seasonal context, with a blue
flow-scaled Map ribbon and photo-informed Bridge/Hacienda Beach views. The gray steel bridge,
rock outcrop, pebble beach, grouped woodland and green optical water form an accepted authored
baseline. Width/motion are illustrative; local hydrodynamics and wider corridor coverage
remain future work. Jenner is a data package. See
[rendering and source notes](./river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/README.md).
The detailed river contract is in [docs/river-pulse/](./docs/river-pulse/reference/implementation-contract.md).

The roadmap below describes the **reservoir experience**, rather than limiting the umbrella.

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
- **Ground and grass** — photo-textured ground (CC0 grass, soil, rock) with baked terrain
  shadows and ambient occlusion per light preset; a field of wind-blown 3D grass blades around
  the camera on every quality tier; natural lake depth from each dam's hydraulic height;
  Shoreline views at the waterline. Refinement (sharper, denser grass; golden-hour shade) is
  queued as L1b.
- **Engine and data architecture** — one folder per water body, shared biome assets, tours,
  any US location, the engine split from its page, and a
  [make-your-own guide](docs/make-a-waterscape.md).
- **Crystal Springs and San Andreas (W1–W4)** — `pipeline/locate.py`; both Crystal Springs
  lakes via `extraAnchors`; a Peninsula oak and Douglas-fir biome with sage summers, fir stands,
  an overcast valley-fog Morning and greener water, all set per body in `land.json`; a
  four-stop Hetch Hetchy tour.
- **Shoreline contact (B1)** — organic waterline with a wave-energy ebb and a wet band.
- **Aerial map inset** — USGS NAIP photograph per reservoir with the camera marked, in the
  explorer and on the journey.
- **Hetch Hetchy (H1)** — `sierra-granite` biome (photographed CC0 granite, ponderosa pine and
  black oak, bare cliffs, a bleached drawdown band), O'Shaughnessy Dam from NAIP, 3DEP and NID
  with illustrative outlet jets, the Tuolumne's first ~760 m below it, and dam viewpoints; the
  fifth stop on the Hetch Hetchy tour.
- **P1 loading improvements** — merged and deployed as `ab96848`: video keeps playing until
  the first live-frame report, tree downloads are staged, and next-video prefetch is deferred.
  Low-tier tree geometry fell from 9.8 MB to 1.2 MB. Local first handoff measured 16.1 → 14.6 s;
  next stop 15.6 → 14.2 s (single samples, not a production benchmark).

## Man-made features

Reservoir scenes currently leave out everything man-made; land beyond the water is drawn as the biome
even where aerial photographs show suburbs. When structures are added, in this order:

1. **Dams** — the structure that makes each reservoir, sourced from the National Inventory of
   Dams. O'Shaughnessy Dam is done (H1); the other four reservoirs' dams are not.
2. **Adits and outlet structures** — intakes, towers and tunnel portals that move the water.
3. **Roads and other buildings** — last, if at all.

## Next: water and reservoir context

1. **D1 — Reservoir context around the water**
   ([task](docs/roadmap/tasks/D1-reservoir-context.md)), complete on `task/D1` pending review:
   compact, sourced supply and capacity
   information, with other facts and an explanation of the scene in an expandable section.
   Clearly separate terrain/reference elevation from modeled underwater bed and waves.
   A point acquisition year is not a survey date for the entire terrain. Capacity is not
   current storage. Keep the current water-focused cameras.
2. **P1b — Profile remaining startup time** — engine initialization still takes about 13 s
   locally. Measure compilation, allocation and baking before choosing caching or renderer
   reuse. Keep GitHub Pages until evidence supports a hosting change.
3. **Crystal Springs and sourced storage history** — W1/W2 adds another real reservoir using
   the existing biome and unlocks T1/T2. Keep recorded storage distinct from estimated water
   levels; reconstruction remains T3.
4. **Water polish and further reservoirs** — refine distracting distant reflections while
   preserving the shallow-water foreground. Trees, grass refinement and Ultra are secondary.

Delivery follow-ups are evidence-driven: compact tree encoding, versioned shared assets
and longer cache lifetimes, then hosting changes only if measured traffic or load times
justify them. Startup download time and GPU frame time are separate budgets.

## Supporting landscape detail (later)

Grass and oak improvements support the water experience and follow reservoir context and
startup work. Keep their cost proportionate on integrated graphics.

1. **Oaks** — first version live (baked oak meshes plus impostors, with 3D trees and grass
   toggles; the explorer opens at the shoreline). The current geometry is 9.8 MB, of which
   1.2 MB is the lightweight set. P1 stages those downloads; compact encoding is a later
   option. Real shadows remain L2b.
   Originally planned as:
   - California coast live, blue and valley oak variants — ez-tree presets tuned toward real
     silhouettes, or authored in Blender — baked into `data/biomes/diablo-oak/`.
   - Full meshes with leaf cards near the camera, octahedral impostors far away; placement from
     one `density(x, z)` function (procedural now, land-cover data later).
   - Water reflections of land drawn from a mirrored three.js render on the high tier.
2. **Light and tuning**
   - Cloud shadows sweeping across the land and the water.
   - Per-tier budgets for grass count, tree range and shadows, tuned on Intel and NVIDIA.
   - Preset polish: calmer far-water reflections under the brighter horizon, per-preset water
     tint.
   - Flyover videos and posters were re-rendered with the new land; refresh again after
     shoreline composition and lighting changes.

## A PC-only Ultra tier

After water, reservoir-data and startup priorities, an opt-in quality level for screenshots
and people with a strong GPU (never chosen
automatically): denser curved grass with seed heads and wildflowers, light glowing through
backlit blades, anti-aliasing on the land, real sun shadow maps for trees and grass, full-detail
oaks to ~400 m, native resolution, and a photo mode that pauses, hides the interface and saves a
2× PNG.

## The journey grows

4. **Water level and timeline** — monthly storage from CDEC; water levels above the lidar
   survey level filled from the dam line (USACE National Inventory of Dams); a month timeline
   on the fact cards.
5. **Crystal Springs and San Andreas reservoirs** — same oak-woodland biome, so they are data
   only.
6. **Hetch Hetchy** — a new Sierra granite and conifer biome (ground, rock, pines and cedars).
7. **More tours** — beyond the Hetch Hetchy system, e.g. the State Water Project and the
   remaining California reservoirs; anyone can add their own lake with the guide.

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
- The optional native Windows host is not rebuilt with each change.

## Outside the reservoir renderer

River and coastal hydrodynamics (separate experience models, starting with River Pulse);
elevation sources outside the US; accounts or any server-side component; a continuous
multi-reservoir world.
