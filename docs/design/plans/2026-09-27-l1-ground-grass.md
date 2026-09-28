# L1 Ground and Grass — working plan

**Spec:** `docs/design/specs/2026-09-27-land-engine-design.md` (sub-project 2), with three
decisions approved in conversation on 2026-09-27:

1. **Baked terrain lighting.** Per light preset, a sun-visibility map (soft shadows marched over
   the lidar grid toward that preset's sun) is computed when the preset is applied; one
   ambient-occlusion map (sky openness) is computed once per water body. Per frame the terrain
   reads them instead of ray-marching shadows.
2. **three.js owns land colour.** Ground (photo textures blended by slope, valley channel,
   aspect, season, with anti-tiling) and grass blades are lit in TSL with the same model as
   `terrainShade` (sun radiance × n·sun × visibility, sky fill × (0.38 + 0.3 nᵧ), warm bounce);
   the water kernel adds haze, water, sky and reflections. Reflections still trace the CUDA
   terrain.
3. **Canopy map.** The oak placement function (`oakSite`/density in `water.cu`) is baked into a
   tree-cover map (~5 m texels) shaded as canopy — the far LOD that L2's oak meshes will join.

Executor: Claude, inline, on branch `land-l1` (worktree `.worktrees/land-l1`), served on port
5174 for side-by-side evaluation against `main` on 5173. Merge only when it is visibly better up
close (screenshots at knee height, 20 m and overlook, all presets) and the Intel low tier stays
≤ 33 ms at 768 px. Testing is proportionate: unit tests for pure modules, `npm test` per task,
screenshot review.

## Tasks

1. **Biome ground textures.** `pipeline/biome_assets.py <biome>` downloads the ambientCG CC0
   sets listed in `data/biomes/<biome>/biome.json` (`ground.grass` Grass004, `ground.soil`
   Ground109, `ground.rock` Rock030; 1K JPG colour + normal) into `data/biomes/<biome>/ground/`.
   Validator checks listed files exist. Credits in THIRD_PARTY_NOTICES.
2. **Baked maps (`renderer/land/bake.js`).** Pure functions over the terrain grid:
   `bakeOcclusion(terrain)` and `bakeSunVisibility(terrain, sunDir)` → Float32/Uint8 arrays at
   grid resolution; `bakeCanopy(terrain)` from the shared oak placement rules (ported from
   `water.cu`). Unit tests on synthetic grids (flat = fully lit; a wall casts a shadow on the
   side away from the sun).
3. **Ground material (`renderer/land/ground.js`).** TSL material on the terrain mesh: layer
   weights (slope → rock, valley/shore → soil, season grades grass toward straw gold), stochastic
   anti-tiling, normal detail up close, distance fade to layer means, canopy darkening + crown
   shading from the canopy map, CUDA-matching lighting from the baked maps and the preset.
4. **Hand land colour to three.js.** `landPass == 2`: `render_water` uses the land pass colour
   (plus `aerial`) for land pixels; pack keeps distance. Light preset values also drive the TSL
   uniforms.
5. **Grass field (`renderer/land/grass.js`).** Camera-following instanced blades (spike model),
   thinning to the ground at the edge, lit with the same model, wind from time; counts/radius
   per tier.
6. **Tuning and evaluation.** Screenshots up close and far, all presets, NVIDIA and Intel;
   frame budgets; roadmap + work queue updated.
