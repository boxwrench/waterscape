# L4: 1 m lidar detail where the camera is close

User-requested (2026-10-02). Every scene's terrain is the USGS 3DEP lidar-derived DEM
sampled at ~10 m (`pipeline/dem.py`, `pipeline/build_river_terrain.py`). That is right for
hills, but near the camera it smooths away the features the shallow-water views depend on:
bank terraces, drawdown benches, rocks, gullies, narrow river channels and gravel bars. Add
small 1 m patches around the close cameras only; keep the 10 m grid everywhere else.

USGS 1 m DEMs exist for every current scene (checked 2026-10-02 against the staged-products
bucket, `https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1m/Projects/`):

| Scene | 1 m project(s) | Tile at the anchor |
|---|---|---|
| Calaveras | `CA_AlamedaCounty_2021_B21`, `CA_SantaClaraCounty_2020_A20` | `USGS_1M_10_x60y415` |
| San Antonio | same two | `USGS_1M_10_x60y416` |
| Crystal Springs | `CA_CaliforniaGaps_B23` | `USGS_1M_10_x55y416` |
| San Andreas | `CA_CaliforniaGaps_B23` | `USGS_1M_10_x55y417` |
| Hacienda Bridge | `CA_NorthernCA_B22` | `USGS_1M_10_x50y427` |
| Jenner | `CA_NorthernCA_B22` | `USGS_1M_10_x48y426` |
| Hetch Hetchy (H1) | `CA_YosemiteNP_2019_D19` | `USGS_1M_11_x25y421`, `x26y421` |

Tiles are ~270–290 MB GeoTIFFs; download them in the pipeline only. Each patch shipped to the
browser should be about 1–2 MB.

**Priority** (do in this order, and stop to show the user after the first two):
1. **Hacienda Bridge.** The Russian River is only a few 10 m cells wide; 1 m shows the real
   channel edge, gravel bars and banks around the piers.
2. **Reservoir Shoreline viewpoints** (each bundle's `cameras.json` `shore` view, and any other
   view with `above` under ~3 m). This is where the water meets the bank at the camera.
3. **Jenner** bluffs and Goat Rock. Record the survey date: the sand spit moves, so the
   lidar shows one moment, not the current mouth.
4. **Hetch Hetchy** walls, consumed by H1/H2.
Skip overlook and ridge views; at their distances 10 m already holds up.

1. **Pipeline.** A shared step (for example `pipeline/detail.py`) that, for each close
   camera, finds the covering 1 m tile(s), cuts a square patch (start at 640 m; tune), and
   writes it beside the bundle's terrain (for example `detail-<view>.bin.gz` plus metadata
   in `terrain.json`). Pick the project by date when two overlap (prefer the newer unless
   it is worse at the waterline). Record source project, tile names and acquisition date
   for each patch.
2. **Water and survey date.** Lidar has no returns under water; the 1 m surface over the
   lake is a flat or interpolated sheet at the survey-day level. Keep the bundle's water
   level and shoreline as the authority: below the waterline, use the existing modelled bed,
   not the patch. If a survey caught the reservoir low, note the exposed bed as a finding;
   do not change the water level in this task.
3. **Blend.** Feather each patch into the 10 m grid over its outer ~50 m so there is no
   seam or step. Match vertical datums (both are NAVD88 in 3DEP; confirm).
4. **Land pass.** `renderer/land/terrain-mesh.js` draws the patch as a finer mesh inside the
   coarse grid (cut a hole or drop the coarse cells under it). Ground textures, grass and
   oak placement keep working on it.
5. **Keep everything else consistent.** The water kernel (`renderer/water.cu`) traces the
   terrain buffer for reflections and the shoreline contact (B1), and the host samples it
   for collisions, picking and elevation readouts (`Terrain.sample`). Where they disagree
   with the 1 m mesh near the camera, fix the visible case: the waterline must still meet
   the land exactly. Updating only the shoreline-distance channel inside the patch is
   acceptable if full 1 m tracing in the kernel is too costly.
6. **River Pulse.** Hacienda is built by `pipeline/build_river_terrain.py` and drawn by the
   River Pulse renderer; reuse the same patch step and keep the accepted authored setting
   (bridge, rock outcrop, pebble beach) in place on the new ground. Ask the user before moving
   any authored element.
7. **Cost.** Patch bytes per bundle, first-scene time (P1 measurements), and median
   `diag.frameMs` at each changed camera on medium and high tier, before and after.
8. **Compare.** Before/after screenshots from each changed camera into `previews/`.
9. Run `node --test "pipeline/tests/*.test.mjs"`, `npm run validate`, `npm run check`,
   `npm run build`, `python -m pytest pipeline/tests -q` and `git diff --check`; `npm test`
   where the browser environment allows. Record results below, then commit. Do not push or
   merge.

## Result
- Status: todo
