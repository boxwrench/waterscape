# H2: Granite walls at Hetch Hetchy

User-requested (2026-10-02). Needs H1 (the `sierra-granite` biome and the `hetch_hetchy`
bundle). Read the [H1 brief](../capable-agent-briefs.md#h1-hetch-hetchy) first, including
its lidar data check.

Hetch Hetchy's walls (Kolana Rock, Hetch Hetchy Dome, the faces behind Wapama and
Tueeulala Falls) are near-vertical granite. NAIP cannot colour them: from above, a 600 m
face is a line of pixels. Make the walls read as Sierra granite from the journey cameras
at the water, 0.5–2 km away, under all three light presets. The walls are a **setting**
binding (see `docs/making-water-visible.md`): plausible for the place, no claim of exact
appearance.

**Approach (decided):** shape from 1 m lidar; colour procedural, calibrated from the
user's own photos. Do not project photos onto the mesh by default. Photos carry their own
sun and shadows, which contradict the presets. Photo projection (skyline-matched pose,
pixels projected onto the lidar) is a fallback for one hero face only, after step 6
shows procedural colour cannot get there.

1. **Photos in.** The user supplies their own Hetch Hetchy photos. Put them in
   `data/hetch_hetchy/photos/` with a `photos.json` listing, for each: file, author (the
   user), licence (the user's choice; ask), date and time if known, and the viewpoint if
   known (dam, trail to Wapama Falls, etc.). Keep originals out of the Pages build unless
   the user says otherwise; record anything shipped in `THIRD_PARTY_NOTICES.md` or the
   bundle's story sources.
2. **Calibrate from the photos.** Sample sunlit and shaded granite, the dark water
   streaks, ledge vegetation and talus in each photo. Write the measured colours, and
   their spread, to the biome (`data/biomes/sierra-granite/`). These are the targets the
   procedural material extrapolates from across every wall, including faces no photo
   shows. Note how sampling corrected for each photo's exposure and white balance.
3. **Shape.** Use the H1 brief's 1 m lidar patches (`USGS_1M_11_x25y421`, `x26y421`)
   so wall geometry near the cameras comes from lidar, not the coarse grid.
4. **Rock material**, in the land pass (`renderer/land/ground.js` or a biome-specific
   material beside it):
   - Triplanar granite on steep faces (CC0 texture; today's ground samples by `xz` and
     would smear on vertical walls).
   - **Water streaks:** dark varnish and lichen stripes that follow drainage down the
     faces. Derive them offline from flow over the DEM (where runoff from ledges and
     notches goes down the wall), bake to a texture, and darken toward the photo-measured
     streak colour. This is the most important cue.
   - Ledges: vegetation and darker soil where the face eases below a slope threshold.
   - Fresh, lighter rock on sharp convex edges and exfoliation sheets; darker in cracks
     and concave recesses (curvature from the 1 m DEM).
   - NAIP stays on near-flat ground only; fade it out with slope.
5. **Lidar intensity (optional).** Download one LAZ tile (`11SKC5705`, under Wapama
   Falls) and grid its intensity on the walls. If it is clean across flight lines, use
   it as a gentle brightness variation on the walls. If it is noisy or striped, drop it
   and say so.
6. **Compare.** Render the same view as each photo with a known viewpoint (at least the
   dam looking east toward Kolana Rock and Wapama Falls), under the preset nearest the
   photo's time of day, and save side-by-side images to `previews/`. Judge colour, streaks
   and ledges at journey distance. If one face still reads wrong after tuning, propose
   photo projection for that face to the user before building it.
7. **Cost.** Median `diag.frameMs` at a Hetch Hetchy journey camera, medium and high tier,
   with and without the wall material. Keep the low tier within its budget.
8. Run `node --test "pipeline/tests/*.test.mjs"`, `npm run validate`, `npm run check`,
   `npm run build` and `git diff --check`; `npm test` where the browser environment allows.
   Record the comparisons, timings and limitations below, then commit. Do not push or
   merge.

## Result
- Status: todo
