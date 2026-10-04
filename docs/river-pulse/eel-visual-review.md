# Eel River / Scotia Bluffs — visual review

RP17 trials the user's research → form → fixed cameras → render → compare → refine
workflow. [Open the study](../../river-pulse/renderer/eel.html) or
[actual runtime comparison](../../previews/eel/review.html).

**Acceptance: awaiting human review.** This is a first landform/contact pass. It is
not a finished environment, a photo-identical reconstruction or a hydraulic model.

## Research and coordinate frame

- [USGS Scotia station](https://waterdata.usgs.gov/monitoring-location/USGS-11477000/)
  supplies the WGS84 anchor, 40.49149394275497, -124.09974068101218. It does not supply
  the scene's water level. The anchor is a station location, not an open-water sample.
- [USGS 3DEP](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer)
  supplies the 384×384 native elevation grid, approximately 14.05 m cells, NAVD88
  metres and local UTM zone 10. No vertical exaggeration or authored terrain carving.
- [USGS 3DHP](https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer)
  supplies flowlines and mapped river footprints in the same geographic frame.
- [USGS/USDA NAIP mosaic](https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer)
  is aligned to the DEM's outer cell edges. It informs coarse cover colors and an
  authored water/gravel classifier inside the mapped footprint. It is not a current
  photograph. Package JSON records full source queries and retrieval times.
- [Scotia Bluffs photograph](https://commons.wikimedia.org/wiki/File:Scotia_Bluffs_Railroad_Bridge_2016.jpg),
  Ellin Beltz, March 2016, CC BY-SA 4.0, was downloaded and visually inspected.
  The vegetated crest, exposed bluff face and river below it are review cues.
  Different viewpoint/season prevents a precise photographic overlay comparison.
  The original photograph is not bundled.

The water height is a DEM-following visual proxy with rendering clearance, not
observed stage or bathymetry. Water optics, colors and highlights are illustrative.
Coarse cover colors are Setting, not a scientific land-cover/species product.
Source aerial mode preserves geographic alignment; form mode removes cover colors
and animated highlights to expose the native shape. No random scatter is used;
17041 is reserved for future vegetation. Geographic inputs and camera presets are
committed for deterministic rebuilding. Acquisition scripts are deliberate tools,
not build-time or browser network dependencies.

## Bounded correction

Initial overview renders visibly broke the water into triangular gaps. The first
correction interpolated clipped water heights on the actual terrain triangle plane,
rather than sampling a different bilinear surface along clipped edges. Review still
showed repeated distant gaps. A second related correction improved overview depth
precision and added a small polygon depth bias to the proxy overlay.

Native terrain geometry remains unchanged. The baseline selector retains raster
water edges; the refined selector clips continuous classification triangles and
smooths the field locally. Both reuse the same camera, input data and lighting.
The before overview screenshot preserves the actual earlier contact defect; it is
not a recreated failure. Code tests now cover the observed triangle-plane mismatch.

The readable river bend and exposed bluff relationship improve the first form
study. The 14 m terrain and interpolated cover palette remain visibly smooth and
coarse. The DEM-following water inherits small elevation undulations; it is not
convincing close water. Individual trees, rail/road bridges, buildings, rock bedding,
contact stones and a surveyed water surface are absent. Aerial mode shows source
context for those features rather than pretending they have been modeled.
The color classifier also interrupts the surface at visible bridge crossings;
continuous water beneath those structures remains a separate correction. Form mode
retains that authored water boundary while removing terrain cover colors/highlights.

## Evidence and checks

The committed review gallery contains actual fixed-camera browser renders. The
camera presets are in `eel-layout.js`; no free camera drift is used for comparisons.
The shoreline camera was moved closer to the source-image gravel/water edge before
the final v1 gallery was recorded. Earlier exploratory shoreline framing is not
used as a matched comparison. The overview before/after retains its numeric preset.
The source aerial and form modes make the geography/interpretation distinction
visible. The review controls expose baseline/refined boundaries, highlight pause,
title hiding and a 120-frame measurement after 12 warmup frames.

Timing in this automated browser is visibly paced near one frame per second.
Consequently frame interval measurements describe this review session and cannot
establish foreground FPS. CPU submission timing is separate from GPU execution.
The metrics panel explicitly excludes GPU time and total browser memory. Geometry
bytes include both baseline/refined CPU buffers, and the texture byte figure is an
RGBA plus mip estimate, not a complete GPU allocation measurement.

Both comparison samples used the same overview, landscape presentation, 980×876
viewport, DPR 1.25, 12 warmup frames and 120 measured frames. Both passes are resident.

| Metric | Raster boundary | Refined boundary |
| --- | ---: | ---: |
| Rendered triangles, including background | 302,291 | 305,292 |
| Draw calls | 3 | 3 |
| CPU geometry buffers, both passes resident | 10.62 MiB | 10.62 MiB |
| CPU submission p50 / p95 | 0.62 / 0.88 ms | 0.43 / 0.60 ms |
| Frame interval p50 / p95 in this session | 1016.40 / 1016.57 ms | 1016.40 / 1016.57 ms |
| First frame, same loaded session | 162 ms | 162 ms |
| Source texture RGBA + mip estimate | 12.0 MiB | 12.0 MiB |

Refinement adds 3,001 rendered triangles (approximately 0.99%) without adding draw
calls or another texture. CPU timings vary; the lower refined sample is not proof of
a speedup. Browser pacing near one second is a review-session limitation, not a
foreground throughput result. Raw visible UI measurements are saved in
`previews/eel/baseline-cost.txt` and `refined-cost.txt`. These runs preceded the added
backend label; the panel now records backend on subsequent runs. GPU execution time,
device-wide memory and cold-cache load cost remain unmeasured.

The final review panel confirms WebGPU for desktop inspection. Two fixed shoreline
frames show pixel changes confined to the water region; highlight motion is very
subtle. A longer foreground clip is still needed before a polished motion claim.
Pause was exercised separately. The downstream view exposes the finite terrain
extent at the far end: extending geographic coverage is a future form correction,
not something to hide with fog. These images validate the implementation rather
than a photographed or measured water state.

## Next acceptance question

Verification: Overview, primary bluffs, eye level, shoreline and downstream bend
were inspected at 980×876 and 390×844, plus desktop form/source-aerial modes. Phone
framing uses the same positions with a wider overview FOV. Evidence and pause were
exercised; phone document width matches the viewport and the console has no errors.
Phone controls were increased to 44 px minimum height. OS reduced-motion startup
handling is implemented; changing the operating-system preference was not tested.
The focused geometry/provenance/navigation suite passes 9 tests, packages validate
and the full build includes the new Eel page and local assets.

Is this reach and its major bend/bluff composition a useful starting baseline?
If accepted, the next bounded pass should address the bluff/forest silhouette and
close terrain scale, then shoreline/water presentation. Detailed vegetation and
structures must be compared from these same cameras rather than concealing a weak
form. The reusable process is [documented here](../visual-development.md).
