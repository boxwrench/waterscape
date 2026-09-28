# Handoff — 2026-09-28

Where things stand, for whoever picks this up next (person or agent). The plan lives in
`ROADMAP.md` and `docs/roadmap/README.md`; this file is the snapshot of "what just happened
and what's next".

## Live now

https://boxwrench.github.io/waterscape/ (GitHub Pages deploys on every push to `main`).

- **Front page** (`index.html`, `site/journey.js`): WebGPU browsers open straight into live 3D
  at each reservoir's **Shoreline** viewpoint; the flyover video plays until the first 3D frame
  and stays the fallback. "Back to video" is remembered for later stops. The embedded 3D hides
  the control panel.
- **Explorer** (`renderer/explore.html`): full controls, opens at Shoreline too. Toggles for
  **3D trees** and **Grass**; auto quality low/medium/high (NVIDIA starts high, others medium).
- **Land (L1 + L2):** CC0 photo ground materials, wind grass, baked ez-tree oak meshes near
  the camera (40/100/200 m by tier), photographed impostor cards beyond (250/900/1500 m),
  procedural shader crowns past that. Lighting presets Morning/Midday/Golden, gold-summer
  season by default.
- **Flyover videos and posters** (`data/<id>/flyover.mp4`, `poster.jpg`) were re-recorded with
  the new land via `npm run flyover -- <id>`.

## Known issues

- **Shadows don't match the 3D trees.** Ground shadows are soft analytic blobs from the old
  procedural crowns. Fix is L2b (sun shadow map).
- **Shoreline opening shot is mostly water.** `data/calaveras/cameras.json` → `shore` looks east
  across open water, so the first view shows few oaks or grass. The user may want it moved to a
  bank with trees in frame (same for `data/san_antonio/cameras.json`).
- **Intel integrated graphics:** low tier is ~27 ms at the overlook but ~37 ms at the shoreline
  (the water fills the frame; grass + trees only add ~2 ms). `scripts/verify.mjs` times the
  33 ms low-tier budget at the overlook on purpose. Frame times on the dev laptop drift a few
  ms day to day with machine load.
- **Tree data is ~11 MB** (`data/biomes/diablo-oak/trees/*.bin` float32). Half floats would
  roughly halve it.
- User verdict on L2 visuals: "just ok". Grass still reads sparse/pixelated (L1b).

## Next up (user's interest, roughly in order)

1. **L2b real tree shadows** — render oaks (and grass) from the sun into a shadow map sampled
   by ground, grass and trees; drop the blob shadows where meshes exist.
2. **U1 PC-only Ultra tier** — opt-in, never auto-picked: dense curved grass, land-pass AA,
   shadow maps, full-detail oaks to ~400 m, native resolution, photo mode. The user wants a
   "really nice" version for screenshots and people with a real GPU.
3. **Shrink tree data** (half-float positions/normals/uvs in `pipeline/bake-trees.mjs` +
   `renderer/land/trees.js` loader).
4. **L1b grass refinement.**

## How to work on it

- Read `AGENTS.md` first. `npm test` runs everything (needs Microsoft Edge; ~5–10 min, opens
  real browser windows). `npm run test:site` is the front-page subset.
- Work on a branch (a worktree under `.worktrees/` has worked well), merge to `main` with a
  fast-forward, push; Pages deploys automatically. Check the live link after deploy.
- Testing is intentionally light on this side project: one full `npm test` before merging.
  Judge visual changes by flying close in the explorer, not from far screenshots.
- Chromium (Chrome/Edge) is the only target for live 3D; others get the video.
- Key files for land work: `renderer/land/` (`scene.js`, `ground.js`, `grass.js`, `trees.js`,
  `impostors.js`, `oak-placement.js`, `pack.js`), `renderer/water.cu` (`render_water`,
  `terrainShade`, `bake_light`), `data/biomes/diablo-oak/biome.json`, and the offline tree bake
  `pipeline/bake-trees.mjs` + `bake-trees.html`.
- After changing how land looks, re-record the front-page videos:
  `npm run flyover -- calaveras` and `npm run flyover -- san_antonio` (needs ffmpeg).
