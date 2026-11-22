# D3: O'Shaughnessy Dam's drum-gate spillway in the Hetch Hetchy scene

**Who:** capable · **Needs:** the Hetch Hetchy bundle, the Minecraft spillway (PR #8,
`experimental/minecraft/prototype/add_spillway.py`) for the layout and the maintainer's
corrections · **Branch:** `task/D3-hetch-spillway`

## Goal

The browser's O'Shaughnessy Dam gets its side spillway, as the Minecraft world has it: three
drum gates between piers on the lake shore at the dam's south end, the unlined channel behind
them running back to the dam, the arch that carries it under the road, and the run-out down the
rock beside the dam face. The maintainer's corrections from the Minecraft review hold: no channel
down the dam face; the outlet is an arch at the road and the spill runs down rock. Gates closed,
spillway dry.

## Stop rules

- Positions are traced on the USGS NAIP image (URL in `structures.json`); counts, widths and
  elevations come from fetched sources recorded next to them; everything else is marked
  illustrative.
- Do not edit `vendor/`, `renderer/water.cu` or `renderer/engine/waterscape.js`.
- River Pulse's Tuolumne scene reuses `createStructures` with this dam; it stays as it is.

## Steps

1. **Data:** a `spillway` entry on the dam in `data/hetch_hetchy/structures.json`: the gate line,
   portal and run-out in UTM, the number and width of the gates, the gate tops' height below the
   crest, with sources and a note on what is illustrative.
2. **Renderer:** `renderer/land/spillway.js` builds piers, sill and spill face, drum gates, the
   channel with its rock bank, the arch openings and portal headwall, and the run-out; drawn by
   `structures.js` for dams with a `spillway`; its footprint is kept clear of pines and grass
   (`clearings.js`).
3. **Checks:** validate the new fields with tests; before and after renders from fixed cameras;
   the maintainer's look.

## Fixed cameras (scene metres, yaw and pitch in radians; version 1)

| Name | x, y, z, yaw, pitch |
|---|---|
| Lake | -4230, 30, -250, -2.396, -0.22 |
| Below | -4400, 30, -60, 0.675, -0.15 |
| Road | -4245, 18, -168, -1.356, -0.2 |
| Top | -4300, 170, -170, 0, -1.45 |
| West | -4430, 25, -175, 1.571, -0.12 |

## Result
- Status: done; the maintainer's look pending.
- Commit: see the branch (this Result is in the same commit).
- Checks:
  - `node --test "pipeline/tests/*.test.mjs"` → `ℹ pass 191`, `ℹ fail 0` (two new spillway tests);
  - `node pipeline/validate-bundles.mjs` → `Bundles valid.`;
  - `npm run build` → `Built Pages with 138 browser modules, shared CUDA source and licensed assets.`;
    `npm run test:build` → `Built experience pages and river assets valid.`;
  - `node scripts/check-doc-links.mjs` → `Documentation links valid (145 Markdown files).`;
  - before and after renders from the fixed cameras and the built-in "O'Shaughnessy Dam" and
    "Below the dam" views in Chrome with WebGPU, no errors (Edge, which `npm test` uses, is not
    installed here); River Pulse's Poopenaut Valley scene, which reuses `createStructures`,
    loads as before with no errors.
- Notes:
  - Sources: the gate line, channel, portal, run-out and the face edge are traced on NAIP; three
    65 ft (19.8 m) drum gates on an unlined side spillway from Wikipedia; the gate tops at
    3806 ft from 33 CFR 208.82, set 6 ft below the 3DEP crest (Wikipedia gives the crest as
    3812 ft) so both use one datum. Gate height, pier shape, channel floor and bank, arch size
    and the run-out are illustrative; the 10 ft gate height in USGS reports could not be
    fetched, so 3 m is marked illustrative.
  - The bundle's 10 m ground is near lake level behind the gates and in the dam's carve at the
    portal, so the structures stand on their own footings down to below the ground.
  - The generic gravity face runs the whole traced crest; beyond the traced face edge it is
    painted granite (with tilted normals for relief) instead of being reshaped. A rock slope
    laid over the face was tried and looked like a white stepped ramp.
  - Frame rate not measured: the desktop session was locked, so Chrome drew about one frame a
    second with and without the change. The spillway adds a few small meshes and no render pass.
