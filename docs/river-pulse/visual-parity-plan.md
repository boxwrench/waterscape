# River Pulse visual parity plan

Status: proposal from a read-only review on 2026-10-04 (branch `task/RP24`). RP25 now
implements the first isolated Eel optics experiment; later adoption/extraction remains
pending human acceptance. Its [rendered review and cost record](eel-water-optics-review.md)
identify close-view reflection issues; shared extraction is deferred. No later step
is implemented by this trial.
Human visual acceptance decides every pass, as in [visual-development.md](../visual-development.md).

## Problem

The reservoir (Hetch Hetchy) and Hacienda/Jenner look better than Eel, Freeport and
Tuolumne's valley. RP24's own review says Eel is "well below the reservoir visual
standard" and that more fine grain exposes the missing large-scale form.

## Diagnosis (from code and captured previews)

| Scene | Rendering stack | Why it looks as it does |
|---|---|---|
| Reservoir | Full Waterscape engine: `renderer/engine/waterscape.js`, `water.cu`, `renderer/land/*`; Hetch uses ~10.44 m 3DEP terrain plus 1 m-spaced service-resampled `detail-*.webp` relief | The integrated stack is tuned together; the detail tiles do not establish native 1 m terrain or verified LiDAR. |
| Hacienda / Jenner | Three.js WebGPU, hand-authored scene, `authored-water.js`, `beach-*`, `hacienda-bridge.js` | Small area, so authoring covers it, and the water shader is good. |
| Eel | Three.js, ~14 m 3DEP, authored cover/rock/forest, own clipped water triangles (`eel-layout.js`) | Coarse bluff form. Previous water has illustrative moving normals, Fresnel and glints; it lacks optical depth, modeled bed refraction and planar reflection. RP25 trials those separately. |
| Freeport | Three.js, good props (`freeport-bridge.js`), `freeport-water.js` | Props are ahead of ground, sky and water. |
| Tuolumne (RP21-23, **separate worktree**) | Native 14.66 m mesh with a line for the river, plus the full Hetch Hetchy engine at the dam via `reservoir-context.js` | The valley has no water surface. The dam looks good only because it is the reservoir engine. |

Hard constraint, already documented in
`docs/river-pulse/reservoir-renderer-reuse.md` (only in the RP23 worktree, not in this checkout): `water.cu` expects
reservoir-relative height and a signed shoreline, plus a single water level. Do not feed
RiverTerrain into it. Plans below respect that.

## Reuse inventory

Reusable now, with no new engine work:

- `river-pulse/renderer/authored-water.js` (+ `authored-water-geometry.js`): TSL shader with
  nine-wave filtered normals, fresnel, `refract` onto a modeled gravel bed, `reflector`, and a
  per-vertex `opticalDepth` attribute. It runs in the same Three.js stack as Eel, Freeport and
  Tuolumne. **Verified input:** `createAuthoredWater` accepts a fourth custom-grid argument
  with positions, indices, per-vertex depths, focus and representation. This bypasses
  `buildAuthoredWaterGeometry`, whose default builder specifically expects Russian River lines.
- Eel already has mapped river footprint triangles clipped against terrain
  (`clippedWaterTriangle`). That is the natural geometry source for an `opticalDepth` ribbon.
- `terrain-surface-detail.js` (RP24): triplanar Rock030 color and normal detail, 400-1400 m fade.
- Eel forest assets and placement (RP20): licensed reservoir tree meshes/atlas, seed 17041.
- `bank-materials.js`, `beach-materials.js`, `beach-woodland.js` (Hacienda banks, gravel, woodland).
- `freeport-bridge.js`, `freeport-surroundings.js` (props that already read well).
- Reservoir light/sky, as technique only: `renderer/engine/presets.js`, `look.js`,
  `water.cu:bake_light` terrain-wide sun visibility and sky openness. Reservoir radiance values
  are not interchangeable with Three light intensities (existing note).
- Granite: `renderer/land/granite.js`, `ground.js`, and `data/biomes/` `ground/joints_*`,
  `ground/slab_*` (Sierra; Tuolumne only).
- Hetch Hetchy `data/hetch_hetchy/detail-{dam,north,south}.webp` + `detail.json`: 1 m-spaced
  service-resampled relief. It shades the mesh and is not 1 m geometry.
- `reservoir-context.js` (RP23): lazy, pause-gated wrapper that is already written for reuse.
- Review harness: `previews/*/review.html` galleries, fixed cameras, cost txt files.

Not reusable: `water.cu` on river terrain, reservoir drawdown/shoreline/bathymetry, Sierra
granite or species recipes on Eel or Sacramento.

## Plan

### Step 0. Reconcile branches before cross-river adoption

`task/RP24` and `task/RP23` (worktree `C:/Github/waterscape-tuolumne-rp19`) are on diverging
lines. RP21-23 are not in this checkout. The Eel-only experiment can use existing shared
files in RP24 without a merge. Reconcile before cross-river adoption so there is one
shared implementation. Repository instructions prohibit agent merges; reconciliation
remains a separate authorized task, not a prerequisite for the experiment.

### Step 1. One shared river water (biggest visible gain)

1. **Spike (RP25):** feed Eel's clipped footprint into `authored-water.js` through the
   custom-grid hook, then inspect Bluffs, eye-level and shoreline views and cost.
   Keep it a selectable experimental adapter with previous water as default; replace
   or remove the adapter after the decision. This is evidence for extraction, not adoption.
2. If viable, extract a shared `river-water.js` that takes ribbon geometry, per-vertex
   `opticalDepth` and a flow direction. Add flow as new work: advect the normal field along the
   centerline tangent (the 3DHP centerlines already exist). `authored-water.js` has no current
   field today.
3. Adopt in Eel, then Freeport (replacing `freeport-water.js` only if it looks better in the
   same-camera comparison), then Tuolumne.
4. Labels stay honest: depth, bed and color are illustrative, not stage or bathymetry.

Cost to measure: Eel is already 1.26 M triangles / 8 draw calls; GPU time is unmeasured.

### Step 2. Tuolumne valley as flagship

1. Replace the teal guide line with the shared river water (Step 1).
2. Trial the existing Sierra `joints_*` / `slab_*` maps and the Hetch Hetchy `detail-*.webp`
   shading on one dry slope, keeping the native elevation mesh and the plain/source toggles.
   RP24's Tuolumne audit already lists this as the next material candidate.
3. Reuse the engine's trees and the granite look only where Sierra geography fits.
4. Desktop was 62.3 ms at the lowest tier with the dam engine. Keep the engine lazy and
   inactive-gated, and consider a lower render width (audit hypotheses 1 and 3, unmeasured).

### Step 3. Eel and Sacramento: hero cameras, not whole extents

Stop adding procedural detail to 14 m data; RP20 and RP24 both hit that ceiling.

- **Eel:** the source audit says a partial NCALM 2009 CA09_Perkins 1 m survey covers the
  station but not the Bluffs, eye-level, shoreline or bend targets. Next question is
  whether any 1 m coverage reaches those cameras. Unverified; check before planning around it.
- **Sacramento / Freeport:** check USGS 3DEP lidar availability at the Freeport extent. I did
  not verify this; do not assume 1 m exists.
- Where fine data is absent, spend effort on large silhouette and contact: bluff face form,
  bank edge, waterline, sky and haze. Freeport needs sky, distance haze and ground texture
  to match its props.

### Step 4. Shared look

Light, sky and haze presets borrowed as technique from `presets.js`/`look.js` so every
river shares one time-of-day logic. This is what makes scenes read as one product.

## Acceptance for each pass

Fixed cameras, before/after renders at desktop and phone, same geometry and lighting, a
selectable previous material, cost numbers, and a human decision. Per the repo's rules,
agent critique does not replace the human review.

## Open questions

- How well do Hacienda optics tolerate Eel's DEM-following surface and a single-plane reflector?
  Its custom-grid hook is already usable; no geometry-builder refactoring is needed for the spike.
- Which of the Eel or Freeport cameras have any 1 m lidar coverage?
- Merge strategy for RP23 versus RP24.
