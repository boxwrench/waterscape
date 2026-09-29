# Handoff — 2026-09-28

Where things stand, for whoever picks this up next (person or agent). The plan lives in
`ROADMAP.md` and `docs/roadmap/README.md`; this file is the snapshot of "what just happened
and what's next".

## Live now

https://boxwrench.github.io/waterscape/ (GitHub Pages deploys on every push to `main`).

- **Front page** (`index.html`, `site/journey.js`): WebGPU browsers open straight into live 3D
  at each reservoir's **Shoreline** viewpoint; the flyover is the fallback (P1 fixes its early
  pause during live startup). "Back to video" is remembered for later stops. The embedded 3D hides
  the control panel.
- **Explorer** (`renderer/explore.html`): full controls, opens at Shoreline too. Toggles for
  **3D trees** and **Grass**; auto quality low/medium/high (NVIDIA starts high, others medium).
- **Land (L1 + L2):** CC0 photo ground materials, wind grass, baked ez-tree oak meshes near
  the camera (40/100/200 m by tier), photographed impostor cards beyond (250/900/1500 m),
  procedural shader crowns past that. Lighting presets Morning/Midday/Golden, gold-summer
  season by default.
- **Flyover videos and posters** (`data/<id>/flyover.mp4`, `poster.jpg`) were re-recorded with
  the new land via `npm run flyover -- <id>`.

## Ready for review: P1 (not deployed)

`task/P1` keeps video playing until the first live frame, reports that frame immediately,
loads only far trees on low, and loads full detail after the first frame on medium/high.
Detail failures retain far meshes. Next-video prefetch is deferred to video-only playback;
both return-to-video controls preserve that preference across stops.

`npm test` and `npm run build` pass. `node scripts/measure-startup.mjs` records local Edge
startup and completed resource body bytes, including iframe resources. Single before/after
samples: cold low 16.1 → 14.6 s, next stop 15.6 → 14.2 s; cold resource bodies 26.8 → 15.8 MB.
Tree geometry is 9,815,328 → 1,226,464 bytes (12 → 6 requests). These are local observations,
not wire-transfer totals or a production network benchmark. Engine initialization still
takes about 13 s; P1b proposes profiling this before changing the renderer lifecycle.

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
- **Tree geometry is 9.8 MB** (`data/biomes/diablo-oak/trees/*.bin` float32), including
  1.2 MB of far meshes. P1 stages geometry loading; compact encoding remains a follow-up.
- User verdict on L2 visuals: "just ok". Grass still reads sparse/pixelated (L1b).

## Next up (user's interest, roughly in order)

1. **Review/merge P1** — complete on `task/P1`; see [task](roadmap/tasks/P1-first-scene.md).
   Keep GitHub Pages and the per-stop iframe for now; profile the remaining engine startup
   separately before choosing a reuse/caching design.
2. **P2 opening composition, L2b shadows and L1b grass** — establish one convincing shoreline
   view, then apply the standard to both stops. Judge the baseline before extending Ultra.
3. **Journey context, W1/W2 and T1/T2** — explain the system, add Crystal Springs using the
   shared biome, then show sourced storage history. Do not conflate storage with a measured
   water elevation; level reconstruction remains T3.
4. **U1 PC-only Ultra and further expansion** — still opt-in, never auto-picked. Compact
   tree encoding, renderer reuse and hosting changes follow measurements rather than being
   prerequisites for this pass.

## How to work on it

- Read `AGENTS.md` first. `npm test` runs everything (needs Microsoft Edge; ~5–10 min, opens
  real browser windows). `npm run test:site` is the front-page subset.
- Work on a `task/<id>` branch and commit results. Agents never merge or push (AGENTS.md).
  A human reviews, merges and publishes; Pages deploys after a push to `main`.
- Testing is intentionally light on this side project: one full `npm test` before merging.
  Judge visual changes by flying close in the explorer, not from far screenshots.
- Chromium (Chrome/Edge) is the only target for live 3D; others get the video.
- Key files for land work: `renderer/land/` (`scene.js`, `ground.js`, `grass.js`, `trees.js`,
  `impostors.js`, `oak-placement.js`, `pack.js`), `renderer/water.cu` (`render_water`,
  `terrainShade`, `bake_light`), `data/biomes/diablo-oak/biome.json`, and the offline tree bake
  `pipeline/bake-trees.mjs` + `bake-trees.html`.
- After changing how land looks, re-record the front-page videos:
  `npm run flyover -- calaveras` and `npm run flyover -- san_antonio` (needs ffmpeg).
