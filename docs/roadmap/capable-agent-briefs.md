# Briefs for capable agents

These tasks need design decisions, rendering work and visual judgment, so they go to a frontier
coding agent (Claude Code, Codex), not a small local model. Each agent should:

1. Read `AGENTS.md`, `docs/architecture.md` and the spec named in the brief.
2. Write its own design spec in `docs/design/specs/` and get it approved by the human, then an
   implementation plan in `docs/design/plans/`.
3. Break out any mechanical sub-steps as new **small** task files in `docs/roadmap/tasks/`
   (same format as the existing ones) so a local model can do them.
4. Judge visuals up close — screenshots at knee height (~1.6 m), 20 m and the overlook, for
   every light preset, on both an NVIDIA and an Intel GPU — before calling anything better.

Shared constraints: Chromium browsers only; no external imports; zero readbacks in the frame
loop; the low tier stays ≤ 33 ms per frame at 768 px on Intel Xe-class graphics; everything a
water body or biome needs lives under `data/`.

## L1 Ground and grass

- **Spec:** `docs/design/specs/2026-09-27-land-engine-design.md` (sub-project 2).
- **Goal:** land colour moves from `renderer/water.cu` (`terrainShade`) to three.js materials in
  `renderer/land/`: CC0 photo sets (green grass, dry grass, bare soil, rock) under
  `data/biomes/diablo-oak/ground/`, blended by slope, the lidar valley channel, aspect and
  season, with stochastic anti-tiling; far hills keep a matched average colour.
- **Grass:** camera-following instanced blades (spike: ~220k in 45 m on NVIDIA at ~6 ms),
  rolling gusts + swell + flutter, thinning into the ground at the field edge; per-tier counts
  and radii (spec table).
- **Watch:** the `pack.js` distance must still come from geometry depth; grass needs a flag so
  the water kernel uses three.js colour for it (the foundation spec proposes MRT or an alpha
  flag).

## L2 Oaks

- **Goal:** coast live, blue and valley oak variants under `data/biomes/diablo-oak/trees/`,
  generated offline (ez-tree presets tuned toward California silhouettes — wide, rounded, dense
  crowns, 8–14 m — or authored in Blender 5.2, installed on the dev machine), baked with
  octahedral impostors for distance.
- **Rendering:** instanced meshes with leaf cards near the camera (150–250 m by tier), impostors
  beyond; placement from one `density(x, z)` / `species(x, z)` module fed by `land.json`;
  mirrored three.js render for water reflections on the high tier.
- **Evidence:** the throwaway spike showed full-mesh oaks to 450 m cost ~45 ms on Intel; within
  150 m it dropped to ~15–23 ms.

## L3 Light and tuning

- Cloud shadows on land and water from the sky's cloud field.
- Per-tier budgets tuned on Intel and NVIDIA (`renderer/engine/quality.js`).
- Preset polish: the brighter Preetham horizon makes far water at the Shoreline view read as
  white/green speckle — calm it; add per-preset water tint.
- Re-render every flyover and poster (`pipeline/render-flyover.mjs`) with the new land.

## S2 Wind

- A wind control (strength, direction) that drives wave energy and direction in the FFT
  spectrum (`evolve_spectrum` in `water.cu`) and the grass gusts from L1; remembered and
  shareable like S1.

## S3 Clarity

- A clear ↔ turbid control mapped to the water's absorption and scattering coefficients in
  `render_water`; per-body default in `land.json`; remembered and shareable like S1.

## T3 Water level above the survey surface

- **Spec:** `docs/design/specs/2026-09-26-waterscape-design.md` ("Water level").
- Levels above the lidar surface come from a flood fill that starts at the anchor and cannot
  cross the dam line (USACE NID dam coordinates, crest length, height); levels below the survey
  level are not shown as terrain. Driven by `storage.json` (T1) and an elevation–storage relation
  where available.

## H1 Hetch Hetchy

- A new `data/biomes/sierra-granite/` (granite, pines and cedars — built on L1/L2's
  asset pipeline), then `data/hetch_hetchy/` with `pipeline/locate.py "Hetch Hetchy Reservoir"
  sierra-granite`, NID `CA00123` (O'Shaughnessy Dam: 312 ft, 360,000 acre-ft, 1923) and CDEC
  station `HTH` for storage.
