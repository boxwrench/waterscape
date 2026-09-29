# Waterscape — shoreline contact — design

Date: 2026-09-29 · Status: approved in conversation, pending spec review
Task: [B1](../../roadmap/tasks/B1-shoreline-contact.md)
Reference: a procedural coastal demo (`https://kaloyan-stuff.b-cdn.net/temp/beach_test_1.html`),
read for technique only; no code or assets are copied.

## Goal

Where reservoir water meets the bank it currently cuts along long straight lines. Make the
contact organic, with a slight ebb and flow, **without slowing the renderer**. This is a
calm inland reservoir, not a surf beach: no breakers, no wide foam band.

## Cause of the straight lines

1. The shoreline distance is a Euclidean distance transform of a binary lidar water mask
   at ~10 m cells (`pipeline/dem.py`), bilinearly sampled. Its contours are straight,
   grid-aligned segments.
2. The water pass decides water vs. land with a 2D test on that field,
   `shoreDistance < -0.5` (`render_water` in `renderer/water.cu`), not by where the water
   surface meets the ground.
3. The three.js land mesh (`renderer/land/terrain-mesh.js`) is a 10 m triangle grid; where
   it crosses y = 0 it cuts straight lines, and a land-pass hit nearer than the water
   hides the water.
4. The shader's sub-grid ground relief is faded to zero at the waterline
   (`terrainHeight`), so nothing breaks those lines up.

## Technique

The reference demo never draws a shoreline. Its water surface rises and falls a few
centimetres and the visible edge is wherever that surface meets a gently sloped, noisy
beach; a small vertical change moves the edge a long way horizontally. Its sand shader
darkens sand that the water covered moments ago. Waterscape adopts that principle, in a
narrow zone, using data the shader already has.

## Design

All changes are in `renderer/water.cu` except one kernel parameter
(`renderer/engine/waterscape.js`) and documentation.

### 1. One near-shore bank function

A new device function, the **contact zone** bank, applies where
`|shoreDistance| < ZONE` (`ZONE` = 8 m; 6 m in the first draft):

- a warped shore distance `s' = s + warp(x, z)`, where `warp` is two or three octaves of
  the existing `noise`, amplitude at most **2.5 m** (below the 10 m source resolution; 1.5 m read as straight from 30 m away), at
  scales of roughly 4–40 m;
- a gentle slope near the edge (about 1:10 over the first few metres), blending into the
  existing modeled bed (`bedDepth`, `bankSlope`) offshore and into the lidar height inland
  by the zone boundary;
- fine relief (a few centimetres) that is **not** faded out at the waterline.

`terrainHeight` (land side), `floorDepth` (bed seen through the water), the water/land
decision and the wet band all use this one function inside the zone, so they cannot
disagree. Outside the zone every existing formula is unchanged.

### 2. Edge from heights

Inside the zone, a pixel's water hit `P` (already found by the existing surface iteration)
shows water when the surface height there is above the bank height, instead of when
`shoreDistance < -0.5`. Outside the zone the current test stands.

A plain ground hit from the land pass inside the zone no longer hides the water (so the
mesh's straight y = 0 crossing stops showing). Grass-blade and tree-mesh hits (the pack.js
markers) still occlude as today.

### 3. Ebb and flow, bound to wave energy

- A slow rise and fall of the mean surface inside the zone, period ~5–8 s, travelling
  toward the bank along the shore-distance coordinate, with its phase varied along the
  shore by low-frequency noise so the edge never pulses in unison.
- Amplitude proportional to the page's **wave energy** setting (`settings.energy`, today
  passed only to `evolve_spectrum`). Tune so the default energy (0.38; 0.30 at the
  Shoreline viewpoint) gives a few centimetres, i.e. roughly 20–40 cm of edge travel on
  the 1:10 bank. Minimum energy gives a nearly still edge.
- FFT wave height and slopes are damped toward zero as water depth approaches zero, so
  waves settle into the bank instead of poking through it.

`render_water` gains one `float energy` parameter, passed from `renderer/engine/waterscape.js`.

### 4. Wet band

The ebb is analytic in time, so "was this point covered within the last ~2 s" is computed
directly (a few past samples of the same function; no history buffer). Recently covered
ground is darkened and slightly desaturated, drying over a few seconds. It is applied in
`terrainShade`, so it works both on the three.js-shaded ground (`given`) and on the native
host's ray-marched ground. The existing static wet band in `renderer/land/ground.js`
(0.2–0.9 m above water) stays as it is.

## Performance

The requirement is "no slower". Added work is limited to pixels inside the ~12 m zone:
the zone test reuses the shore distance already sampled, and inside it the extra cost is a
few noise evaluations. No new passes, buffers, textures or dispatches.

**Acceptance:** `render_water` GPU time within measurement noise (target ≤ 2 %) of `main`
at the Shoreline, ridge and overlook viewpoints on all three quality tiers, measured with
the P2 method (temporary GPU pass timing, not shipped). If it misses: restrict the zone
work to near the camera, then drop the wet band. Performance wins over the effect.

## Making Water Visible

- New row: **Shoreline contact** (edge relief, ebb and flow, wet band) — binding
  **Illustrative**, state **Modeled / interactive** (driven by the hand-set wave energy,
  not measured wind or water level).
- The "Water surface and shoreline — Exact" row gets a note: the drawn edge follows the
  bundle's derived shoreline to within about 2.5 m of illustrative relief plus the ebb.

## Out of scope

Surf, breakers and foam lace; River Pulse (no river water renderer yet); changes to
`pipeline/dem.py` or the bundles (a smoother source contour could be a later task); the
static wet band and bathtub rings in `ground.js`; re-recording flyovers.

## Verification

- Before/after screenshots at each reservoir's Shoreline viewpoint (edge organic, ebb
  visible, no seams, no water on dry ground or dry patches in open water).
- Fixed-time comparison at ridge and overlook: differences confined to the contact zone.
- GPU timing as above.
- `node --test "pipeline/tests/*.test.mjs"`, `node pipeline/validate-bundles.mjs`,
  `npm run check`, `npm run build`, `git diff --check`; `npm test` where the browser
  environment allows it.
