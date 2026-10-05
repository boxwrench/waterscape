# RP26 Eel water contact audit

Read-only contact review for the RP26 water-reflection correction. Findings below distinguish
the final matched captures from earlier diagnostics. This is not a human acceptance decision.

## Final matched captures

The fixed eye pairs are [before-eye.jpg](../../previews/eel/rp26/before-eye.jpg),
[after-eye.jpg](../../previews/eel/rp26/after-eye.jpg),
[before-phone-eye.jpg](../../previews/eel/rp26/before-phone-eye.jpg), and
[after-phone-eye.jpg](../../previews/eel/rp26/after-phone-eye.jpg). Shore pairs are
[before-shore.jpg](../../previews/eel/rp26/before-shore.jpg),
[after-shore.jpg](../../previews/eel/rp26/after-shore.jpg),
[before-phone-shore.jpg](../../previews/eel/rp26/before-phone-shore.jpg), and
[after-phone-shore.jpg](../../previews/eel/rp26/after-phone-shore.jpg). Each desktop image is
980 x 820 and each phone image is 390 x 844. The matching primary pair is
[before](../../previews/eel/rp26/before-phone-primary.jpg) and
[after](../../previews/eel/rp26/after-phone-primary.jpg); the complete 12-image set is in
[previews/eel/rp26](../../previews/eel/rp26/).

The gallery uses `?freeze=1`, so both water passes begin paused at clock phase zero. I inspected
the desktop and phone eye/shore pairs: the broad bright far-bank band has been reduced to a thin,
discontinuous line with a few angular remnants. The primary view retains a readable forest
reflection. The earlier RP25 no-glint, height-fade and reflection-isolation probes used different
animation phases; those are diagnostic snapshots, not matched visual comparisons. Root reports
that the no-reflection probe removes most of the band but leaves two angular shore distortions,
and that a calibrated alternate projection was rejected. The final Eel caller restores the
authored shader's default glint strength of 1.8; it no longer overrides glint.

## Geometry and shading findings

- Terrain and refined water share each cell's diagonal. `buildRiverTerrainGrid` indexes a cell
  as `[a, south, east]` and `[east, south, southeast]`
  ([terrain-mesh.js](../../river-pulse/renderer/terrain-mesh.js#L25)). Eel clips `[a,b,c]` and
  `[c,b,d]` using that same topology ([eel.js](../../river-pulse/renderer/eel.js#L78),
  [eel-layout.js](../../river-pulse/renderer/eel-layout.js#L33)). The clip preserves vertex
  order, so both surfaces face upward. The optical shader does not use the computed geometry
  normals.
- Refined water edge heights interpolate on those terrain triangles, then receive a shared
  0.18 m lift ([eel.js](../../river-pulse/renderer/eel.js#L85),
  [eel-layout.js](../../river-pulse/renderer/eel-layout.js#L40)). The previous and optical
  passes reuse the same surface positions. This lift can leave a small bank clearance because
  the water follows DEM relief rather than constant stage, but it does not explain an optical-
  only band. Changing it first would alter both passes and risk z-fighting.
- The shader constructs a near-up normal from world x/z for Fresnel, refraction and glint; it
  ignores the sloped water-mesh normal ([authored-water.js](../../river-pulse/renderer/authored-water.js#L17),
  [authored-water.js](../../river-pulse/renderer/authored-water.js#L31)). Refraction offsets
  procedural gravel coordinates using modeled optical depth
  ([authored-water.js](../../river-pulse/renderer/authored-water.js#L35)). This remains an
  approximation on the DEM-draped far bank.
- The reflector remains a single horizontal plane at `grid.focus.y`
  ([authored-water.js](../../river-pulse/renderer/authored-water.js#L63)). RP25 metrics put
  that plane at 15.70 m while the clipped surface spans 12.08 to 21.20 m
  ([after-desktop-metrics.txt](../../previews/eel/rp25/after-desktop-metrics.txt)). The gap in
  elevations helps explain why background samples can cross the far-bank contact. Root's
  no-reflection diagnostic and the final depth-gated captures support reflected background
  samples as the main source of the broad band, but do not explain the residual shore distortions.
- Optical depth is an approximate wet-mask shore-distance control, not submerged-bed elevation
  ([eel-water-depth.js](../../river-pulse/renderer/eel-water-depth.js#L31),
  [eel-water-spike.js](../../river-pulse/renderer/eel-water-spike.js#L6)). It is zero at clipped
  threshold vertices and ramps into the footprint; interpolation across coarse clipped triangles
  can still produce visible facets.

## Current bounded correction and remaining check

The final candidate keeps the ordinary reflector orientation, front-sided water material, plane
height, surface geometry, cameras and authored glint. Its only Eel-specific reflection guard
uses the reflector depth target at the same perturbed UVs. It estimates whether a reflected sample
contains geometry; when the sample is background and modeled optical depth is shallow, it blends
the reflection toward muted green. When geometry is present, it preserves the reflection
([authored-water.js](../../river-pulse/renderer/authored-water.js#L62)). This is a view-dependent
display heuristic, not a physical Fresnel law or geometry repair. Matched phase-zero captures
show the broad band reduced while retaining the primary forest reflection.

Two thin angular shore distortions remain. The next bounded review should isolate the
underwater-only shader from the false-color optical-depth/contact view, with the same camera,
mesh, 0.18 m lift, depth model and light. If the residual appears only in underwater shading,
test one restrained shallow-bed or caustic adjustment. If a geometry-only view shows an actual
gap, investigate that local contact before changing the shared lift. Keep the previous-water
default and Hacienda's default shader behavior. Do not infer stage or bathymetry from the optics.
