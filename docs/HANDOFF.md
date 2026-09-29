# Handoff — 2026-09-29

Where things stand, for whoever picks this up next (person or agent). The plan lives in
`ROADMAP.md` and `docs/roadmap/README.md`; this file is the snapshot of "what just happened
and what's next".

## Live now

https://boxwrench.github.io/waterscape/ (GitHub Pages deploys on every push to `main`).

## R1 stopping point — 2026-09-29

Implementation and local verification are complete at `58674ce`. Both preview videos/posters
were refreshed. The user asked to wrap up and switch models; the authorized push is the final
action of this session. Next session should check the Pages workflow and hosted asset versions
before claiming the latest site is live. See R1 Result below for checks and the comparison script.

## R1 umbrella integration — 2026-09-29

The user explicitly authorized merging and pushing the combined work, overriding the default
agent rule for this task. Remote main's [Making Water Visible](making-water-visible.md)
principles and the supplied `river-pulse/bootstrap` history are integrated with G2 and P2.

- **One repo/build:** existing reservoir URLs remain; `/river-pulse/` opens Hacienda.
  Navigation joins the experiences. River-specific adapters/state/visual bindings/data stay
  in `river-pulse/`; root vendor, camera/projection utilities, pipeline and scripts are shared.
  The completed `task/river-pulse-ui` controls and scientific-selection fixes are also
  included following the request to publish the latest interface.
- **River Pulse is a prototype:** real Hacienda terrain, discharge/history and seasonal
  context. Jenner is a place manifest and water-level adapter contract, not a 3D scene.
  Current/forecast capabilities do not promise current availability. River water/current
  simulation is not built, and reservoir water must not be presented as river hydrodynamics.
- **Deployment:** Hacienda's sourced 3DEP terrain and 3DHP centerlines are committed. Build validates river
  packages and includes all timeline/seasonal modules and styles. CI runs Python tests,
  registry freshness, built-page checks and River Pulse browser interaction checks as well
  as the existing reservoir checks.
- **G2 accepted:** Codrops-style grass clumps with texture cutouts, chunk culling and distance
  LOD. MIT texture and licence are included. Spring and gold use the existing season control.
- **P2:** defer sky/terrain shading that water overwrites. Three deterministic comparison
  views matched byte-for-byte; measured GPU pass work fell 14–16% on local Firefox. This is
  not a Windows FPS measurement. Windows Chrome/Edge remain the target; no Firefox workaround
  was added. See [P2](roadmap/tasks/P2-render-cost.md).

The older sections below retain historical context. R1 supersedes their single-experience
scope; G2 supersedes G1's blade counts. See [R1](roadmap/tasks/R1-waterscape-umbrella.md) for
the final publication result and checks.

- **Front page** (`index.html`, `site/journey.js`): WebGPU browsers open straight into live 3D
  at each reservoir's **Shoreline** viewpoint; the flyover keeps playing until the first
  live-frame report. "Back to video" is remembered for later stops. The embedded 3D hides
  the control panel.
- **Explorer** (`renderer/explore.html`): full controls, opens at Shoreline too. Toggles for
  **3D trees** and **Grass**; auto quality low/medium/high (NVIDIA starts high, others medium).
- **Land (L1 + L2):** CC0 photo ground materials, wind grass, baked ez-tree oak meshes near
  the camera (40/100/200 m by tier), photographed impostor cards beyond (250/900/1500 m),
  procedural shader crowns past that. Lighting presets Morning/Midday/Golden, gold-summer
  season by default.
- **Flyover videos and posters** (`data/<id>/flyover.mp4`, `poster.jpg`) were re-recorded with
  the new land via `npm run flyover -- <id>`.

## P1 deployed

Merged and deployed at the user's request as `ab96848`. P1 keeps video playing until the
first live frame, reports that frame immediately,
loads only far trees on low, and loads full detail after the first frame on medium/high.
Detail failures retain far meshes. Next-video prefetch is deferred to video-only playback;
both return-to-video controls preserve that preference across stops.

`npm test` and `npm run build` pass. `node scripts/measure-startup.mjs` records local Edge
startup and completed resource body bytes, including iframe resources. Single before/after
samples: cold low 16.1 → 14.6 s, next stop 15.6 → 14.2 s; cold resource bodies 26.8 → 15.8 MB.
Tree geometry is 9,815,328 → 1,226,464 bytes (12 → 6 requests). These are local observations,
not wire-transfer totals or a production network benchmark. Engine initialization still
takes about 13 s; P1b proposes profiling this before changing the renderer lifecycle.

## Current direction and D1

The user explicitly prefers close shallow water as the central visual: visible bed,
caustics, ripples and deeper water beyond. Real reservoir data supplies the meaning.
Keep the existing opening cameras; do not prioritize tree-heavy compositions, grass,
shadows or Ultra over water/data/startup work.

D1 is deployed (shipped with G1 in `9489555`, at the user's request; D1 itself was not
separately reviewed): compact source-linked supply and capacity, expandable
reservoir/scene details, acquisition-year labeling for the sampled USGS point, and a clear
distinction between terrain data and modeled bed/waves. Sources were re-fetched; no
current storage claim is added. See [task](roadmap/tasks/D1-reservoir-context.md).

## G1 deployed (grass)

`9489555`, deployed at the user's request. The grass field is now tufts of 5 splayed blades
(4 / 10 / 14 tufts per m² on low / medium / high), clumped into patches by a slow noise, with
wider blades and a lighter root shadow. Only `renderer/land/grass.js` changed. Green and gold are
the existing Season control (gold default). A "stylized" Breath-of-the-Wild-like option was
tried and removed at the user's request. See [task](roadmap/tasks/G1-tufted-grass.md).

**Open, deferred as polish:** `node scripts/verify.mjs` fails its low-tier frame-time check
(`low tier median … ms > 33 ms at 768 px`; 52–70 ms on an integrated Intel GPU). It also fails on
the pre-G1 code, so it is not caused by G1, but medium/high now draw more blades: re-measure on
the target hardware and tune `GRASS_TIERS`. CI does not run `verify.mjs`, so it did not block the
deploy, and `verify-site.mjs` did not run behind it.

## Known issues

- **Shadows don't match the 3D trees.** Ground shadows are soft analytic blobs from the old
  procedural crowns. Fix is L2b (sun shadow map).
- **Far-water reflections can look speckled.** Preserve the shallow-water foreground when
  refining them. The water-dominant opening composition is intentional, not a defect.
- **Intel integrated graphics:** low tier is ~27 ms at the overlook but ~37 ms at the shoreline
  (the water fills the frame; grass + trees only add ~2 ms). `scripts/verify.mjs` times the
  33 ms low-tier budget at the overlook on purpose. Frame times on the dev laptop drift a few
  ms day to day with machine load.
- **Tree geometry is 9.8 MB** (`data/biomes/diablo-oak/trees/*.bin` float32), including
  1.2 MB of far meshes. P1 stages geometry loading; compact encoding remains a follow-up.
- User verdict on L2 visuals: "just ok". Grass still reads sparse/pixelated (L1b).

## Next up (user's interest, roughly in order)

1. **D1 reservoir context** — compact information around the current water experience.
2. **P1b startup profiling** — keep GitHub Pages and the per-stop iframe until measurements
   support a different initialization/reuse design.
3. **W1/W2 and T1/T2** — add Crystal Springs using the shared biome, then show sourced storage
   history. Do not conflate storage with a measured water elevation; reconstruction is T3.
4. **Water polish and further reservoirs** — landscape detail and U1 Ultra remain secondary.

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
