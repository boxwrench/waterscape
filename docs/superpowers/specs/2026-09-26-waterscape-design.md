# Waterscape — design

Date: 2026-09-26 · Status: approved in conversation, pending spec review
Project name: **Waterscape** (repository `boxwrench/waterscape`), an umbrella for further
water features. The first experience is the "follow the water" journey described here.
Tagline (provisional): "Hydrology, simulated."

## Purpose

A hosted web experience about California's critical water supply, led by beautiful,
real-terrain views. The views catch attention; once visitors are there, they learn where
their water comes from, how full the reservoirs are, and who each reservoir serves.

- **Primary audience:** the general public. Plain language, emotional hook, shareable.
- **Deeper layer (later):** for people who want to dig in: fuller data, history, and
  SWRCB / Division of Drinking Water system data.
- **Visuals are first class** on every device, including phones.
- **Data:** public government sources only: USGS 3DEP (terrain), DWR CDEC (storage and
  levels), SWRCB / DDW (water systems, later). Every number shown links to its source.

## Decisions

| Question | Decision |
|---|---|
| Audience | Public first; deeper layer later |
| Processing | Phase 1: a local pipeline bakes static files that the hosted page displays. Formats are designed so an enthusiast "local studio" can come later without rework |
| Launch scope | The SFPUC system (Hetch Hetchy, Calaveras, San Antonio, Crystal Springs, San Andreas). All 12 atlas reservoirs later |
| Visitor journey | A guided "follow the water" journey: cinematic opening, stops along the system with story cards, free 3D exploration at any stop, and a small system map as the progress indicator |
| Weak devices | Pre-rendered flyover video and stills from the same renderer; live 3D is an upgrade on capable devices |
| Repository | Evolve this repo (keeping its history and provenance). atlas-twin-v3 contributes data and ideas, not code structure |
| Structure | Self-contained reservoir bundles plus a thin journey shell (not one continuous world, not a page per reservoir) |

## Architecture

### Repository layout

```
pipeline/     Python. build-terrain (per-reservoir config), cdec-storage,
              render-flyovers (drives the renderer headlessly, writes mp4 + poster)
renderer/     src/clearwater.cu and its WebGPU host (today's app.js, split into
              renderer host vs. UI). The native host stays a local-only extra.
site/         the journey shell: stops, story cards, system map, device tiering
data/<id>/    baked reservoir bundles, one folder per reservoir
journey.json  ordered stops for the journey
```

Ported from atlas-twin-v3 into `pipeline/` data: reservoir facts (operator, capacity,
serves, fun facts), dam positions, and the CDEC import script. Facts gain source links
before they ship.

### Reservoir bundle (the contract)

The pipeline writes, and the renderer and site read, `data/<id>/`:

| File | Contents |
|---|---|
| `terrain.bin.gz`, `terrain.json` | Today's packed format (height, signed shore distance, valley), plus grid size, cell size, grid origin, water level at survey time, and `biome` |
| `storage.json` | CDEC monthly storage history; water-surface elevation per month only where derivable (see Water level) |
| `story.json` | Title, operator, capacity, who it serves, facts; every fact carries a source URL |
| `cameras.json` | Flyover camera path and named viewpoints (line-of-sight search as today) |
| `flyover.mp4`, `poster.jpg` | Pre-rendered fallback-tier visuals |

The bundle is the only interface between the three parts. Each part is testable against
the bundle alone.

### Renderer changes

- The terrain grid comes from the bundle: `TERRAIN_W/H/X0/Z0/CELL` stop being `#define`s
  and travel in two header texels at the start of the terrain buffer, so no shader
  signature changes and the grid cannot drift from its data (the startup consistency
  check is then unnecessary).
- `biome` parameter selects landscape shading. Launch biome: Diablo Range oak woodland and
  grass (today's). Hetch Hetchy needs a Sierra granite and conifer biome (step 4).
- Water level as a parameter (see below).
- A camera-path playback mode for the flyover renders and the opening shot.

### Water level

Lidar flattens water, so terrain below the survey-time surface is unknown. Levels **above**
the survey level are derived from the DEM by a flood fill that starts at the
reservoir's anchor point (a known on-water coordinate in `pipeline/reservoirs.json`, also used
to pick the lidar water surface) and cannot cross the dam line, taken from the USACE National
Inventory of Dams (coordinates, crest length, height). Without both, a fill by elevation alone
can spill into neighbouring or downstream valleys — the failure seen in atlas-twin's TODO #1.
Levels **below** it are not shown as terrain
until bathymetry or an operator's elevation–storage table is available; the cards still
show the storage number. Where CDEC reports reservoir elevation directly, it is used in
preference to converting storage percentage.

### Site

1. Opens on the first stop's poster, then plays its flyover video.
2. Device check in the background: WebGPU present, then a short frame-time probe. Capable
   devices get "Explore in 3D", which swaps the video for the live renderer at the same
   camera pose.
3. Scroll or "Next" advances stops; story cards and the system map show progress. The next
   bundle is prefetched.
4. Every figure links to its public source.

Failure behaviour: if a bundle's live assets fail to load, the stop stays on its video and
poster; if the video fails, the poster and card still show. The journey never blocks on 3D.

## Testing

- Bundle schema checks (every file present and valid; every story fact has a source URL).
- Pipeline smoke run on Calaveras (terrain rebuild reproduces the committed asset).
- Site tests in Playwright: the video tier and the live tier both render, stop navigation,
  prefetch, and a forced live-asset failure falls back to video.
- The existing renderer checks (FFT, caustics, zero-readback frame loop) are kept.

## Build order

Each step is its own spec → plan → implementation cycle.

1. **Vertical slice.** Calaveras as a bundle; renderer grid from bundle; journey shell
   with two stops, **Calaveras and San Antonio** (same biome, no new shading); flyover
   video fallback; restructure into `pipeline/ renderer/ site/ data/`.
2. **Water level and timeline.** CDEC history in `storage.json`; water level above the
   survey level; month timeline on the cards.
3. **Crystal Springs and San Andreas** (same biome).
4. **Hetch Hetchy.** Sierra granite and conifer biome.
5. **Later:** SWRCB / DDW water-system layers, the local studio tier, the remaining atlas
   reservoirs, and performance work for general browsers (auto quality, half-resolution
   terrain, GPU indicator). Deeper-layer candidates already produced by the pipeline: lidar
   acquisition date and water level (USGS Elevation Point Query Service), measured
   water-surface area, shoreline and slope profiles, the 2018 USGS San Antonio bathymetric
   survey, and NID dam specifications.

## Out of scope for now

A continuous multi-reservoir world; a second (WebGL) live renderer; accounts or any
server-side component; bathymetry acquisition.
