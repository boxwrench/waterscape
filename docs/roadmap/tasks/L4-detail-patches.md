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
- Status: reservoir Shoreline patches built and wired in; needs the user's visual review on
  a real GPU (not rendered on a GPU in the session that built it). Hacienda deferred by the user.
- Commit: see `git log --grep "L4:"`
- User decisions (2026-10-02): leave Hacienda for later; water levels vary, keep the bundle
  level as the authority; keep roads and trails as the lidar shows them (adding them as features
  may move up the queue later); move the Shoreline cameras back so a little bank shows in front.
- Built:
  - `pipeline/detail.py <id>`: finds the USGS 1 m project covering each close camera (cached S3
    index, newest survey year first), reads a ~640 m window by HTTP range, resamples NAD83 to the
    bundle's WGS84 UTM grid on a grid 10x the bundle's (~1 m), aligned to its cell lines, and
    writes `detail-<view>.bin.gz` (height, shore distance, valley, blend weight) and `detail.json`.
    1 m ground at or below the bundle's water level is water. ~200–240 KB per patch.
  - `renderer/terrain.js`: loads `detail.json` when present; `sample()` reads the patch inside it
    (camera, collisions, picking, oak placement and the mesh all follow); `coarse()` is the grid
    alone; `gpuCells()` appends patch descriptors and cells after the grid.
  - `renderer/water.cu`: `terrainSample()` reads a patch first (header `T[1].y` = patch count; the
    native host's buffer has none, so it is unchanged); the procedural sub-grid relief and the
    B1 shoreline warp fade to a quarter where the patch gives real relief (`.w` blend weight).
  - `renderer/land/terrain-mesh.js`: grid cells under a patch are left out and the patch adds its
    own 1 m mesh; its edge vertices lie on the grid's cell edges at the grid's heights (closed seam).
  - `renderer/land/ground.js` `terrainAt()`: grass and impostors read the patch texture inside it.
  - `pipeline/validate-bundles.mjs`: checks `detail.json` patches (viewpoint, size, fit, file).
  - Shoreline cameras (`cameras.json` and `source.json`), walked back along their line of sight
    from the `main` positions until the ray 20% up from the bottom of the frame lands on bank:
    calaveras unchanged (already 1.7 m inland), san_antonio 14.5 m back, san_andreas 6.3 m back.
    The 1 m data showed three of the old cameras standing in the water (San Antonio 12 m out).
    crystal_springs: its bank is too steep (the rule wanted 22 m back and 16 m up), so it stands
    1.7 m inland of the waterline (7.9 m back) and still shows open water at the bottom of frame.
  - `scripts/verify.mjs`: the Shoreline viewpoint must be within 4 m of the waterline (was: over
    water); the ripple click moves up to open water above the new strip of bank.
  - Previews: `previews/l4-shoreline-10m-vs-1m.png` (plan views),
    `previews/l4-shoreline-cpu-view.png` (CPU ray-cast of each new Shoreline framing, 10 m vs 1 m:
    shape and framing only, no materials).
- Checks:
  - `python -m pytest pipeline/tests -q`: `32 passed` (adds `test_detail.py`).
  - `node --test "pipeline/tests/*.test.mjs"`: `ℹ fail 0` (128 passed; adds `terrain-detail.test.mjs`).
  - `node pipeline/validate-bundles.mjs`: `Bundles valid.`; `node pipeline/validate-river-packages.mjs`: `River packages valid.`
  - `npm run check`: all 21 kernels compile (`render_water: 107295 WGSL bytes`).
  - `npm run build`: `Built Pages with 98 browser modules, …`; `npm run test:build`: `Built experience pages and river assets valid.`
  - `git diff --check`: no output.
  - Not run: `npm test` browser suites (need Microsoft Edge); frame timings.
- Notes:
  - Within 5 m of the waterline B1's illustrative 1:10 contact bank still replaces the lidar
    bank, so the ebb stays visible; it now sits on the 1 m shoreline.
  - The light bake (`bake_light`) stays on the 10 m grid; the 1 m relief is lit by its own
    normals in the land pass.
  - 1 m adds roads, trails and, at San Andreas, low flats in the water (the 1 m survey caught the
    lake ~2 m low; ground above the bundle level stays land).
  - Re-run `python pipeline/detail.py <id>` after moving a close camera or rebuilding a bundle;
    `pipeline/build.py` does not touch `detail.json`.
  - Survey numbers from the first pass (before the camera moves), for reference:

    | Bundle | 1 m project | Lake level, 1 m vs bundle | 1 m − 10 m on land within 300 m (RMS / max) |
    |---|---|---|---|
    | calaveras | `CA_SantaClaraCounty_2020_A20` | −0.04 m | 1.20 / 3.6 m |
    | san_antonio | `CA_AlamedaCounty_2021_B21` | −0.03 m | 1.27 / 4.6 m |
    | crystal_springs | `CA_CaliforniaGaps_B23` | −1.72 m | 0.80 / 6.6 m |
    | san_andreas | `CA_CaliforniaGaps_B23` | −2.05 m | 0.53 / 2.4 m |
