# RP27 water adoption, hero land and river navigation

## Bounded sign-off

Root reviewed actual browser renders, not concepts. Eel's RP26 reduction of broad
white reflected bank patches is accepted as a bounded improvement and is now
the default. Its olive/smeared close reflection and thin bright rim remain.
This is not reservoir visual parity or final human acceptance.

RP23 was merged locally with the user's explicit authorization, preserving the
original Hetch Hetchy dam/downstream/reservoir contexts. Tuolumne's native valley
now uses the shared authored water material instead of only a symbolic teal line.
The old line remains selectable. The material's original Hacienda reflector path
is unchanged; an optional analytic sky treatment supports this sloping valley.

The verified native 1 m Eel crop is accepted as a source-derived land baseline.
Matched plain Form renders show sharper cliffs, benches and gullies. The Study
material softens this gain; vertical streaking, smooth contact foreground and
coarse surrounding slopes remain. No exaggeration, new lighting or decorative
vegetation hides the form comparison. Trees keep their seed, X/Z sites and counts
and are grounded on the selected surface.

## Implementation and sources

- Eel bundles an 800×750-cell, all-valid crop from USGS 3DEP Northern California
  Wildfires B4, 2018 project. Bounded byte ranges verify the source and crop;
  [source audit](../../../river-pulse/rivers/eel_river/scenes/middle/scotia_bluffs/notes/eel-hero-lidar-audit.md) records alternatives, coordinates, CRS
  operation and provenance. Source spacing is 1 m; desktop eye/shore meshes use
  2 m spacing, primary/phone meshes 4 m, with the original 14.05 m terrain outside.
  A two-coarse-cell seam and wet-edge blend preserve the existing water contact.
  Quantization is 0.05 m, not a claim of survey accuracy.
- California state data remains used and featured: CalWater's actual watershed
  polygons, state/interagency authorship and State Water Boards hosting appear
  separately from federal elevation. The checked California coastal 1 m DEM has
  no valid cells at the targets; it is not used as the hero elevation source.
- Tuolumne's 3DHP source centerlines define geography. Width (40 m), depth, gravel,
  clearance, sky and motion are authored. Sampling matches actual land triangles.
  The surface spans 959.62–1038.46 m DEM-proxy heights; one horizontal reflection
  would be invalid across that reach. Analytic sky avoids a reflected-scene pass.
  A study-only cut lowers 457 terrain vertices by at most 1 m beneath the modeled
  corridor. Source aerial restores native terrain; Form omits the river cut but
  retains the separate existing dam-contact treatment while the dam is visible.
- The eye-level Tuolumne camera was corrected from v3 to v4 after the first
  render exposed off-channel dry-ground occlusion. Its new sightline crosses the
  mapped river without excavating that dry foreground. [Camera record](../../../river-pulse/rivers/tuolumne_river/scenes/start/poopenaut_valley/notes/tuolumne-eye-camera-review.md).
- The clarified journey uses existing content: California overview → each
  river's own home → manifest scenes → fixed views. Camera views are not new
  geographic scenes. [Inventory](./river-scene-journey.md).

## Actual evidence reviewed

[Comparison gallery](../../../previews/river-pulse/rp27/review.html) preserves:

- Three Eel v1 hero cameras in matched Form before/after at 980×820, and six
  Study pairs across 980×820 desktop and 390×844 phone. Both Study sides use the
  improved water, isolating land changes. All comparison frames use zero wave
  phase and a hidden title.
- Six Tuolumne water pairs across those same dimensions: Valley, v4 Eye level
  and River contact. Both sides use v4, the same current UI and phase zero.
  Tuolumne's water is readable in all three; banks remain coarse/scalloped,
  flat and untextured foreground remains, and upstream source gaps remain.
- A default Eel primary render without an opt-in water/terrain flag. Earlier
  Tuolumne eye iteration is retained as diagnosis, not final paired evidence.

## Cost and acceptance

The primary Eel patch changes submitted triangles from 2,514,254 to 2,646,810
(about +5.3%) and calls from 14 to 16 with the same water. Resident CPU geometry
is 23.71 MiB with the cached 4 m comparison mesh, versus RP26's 18.03 MiB;
2.29 MiB of decoded source crop is excluded. Shader textures remain estimated
at 55 MiB. Reflection still repeats scene geometry and is the larger cost issue.
Phone/desktop source and reflection texture estimates are not full GPU memory.

Eel and native Tuolumne now submit frames while water is playing, while measuring,
or after visible camera/presentation changes. Paused and source/form views retain
the image without continuous submissions. Loaded comparison meshes and the lazy
reservoir engine remain resident. This reduces idle work, not active-water cost.

Recorded 12-warmup/120-frame samples are browser-throttled at roughly 1004 ms
frame intervals. CPU submission, geometry and allocations are recorded separately;
no GPU-only timing, foreground FPS, measured phone-device performance or speedup
is claimed. [Detailed cost record](./rp27-performance-review.md).

Agent acceptance: bounded water/land/navigation baseline. Human acceptance of the
overall look remains open. Next visual problems are Eel terrain normals/shading,
close gravel-water contact, Tuolumne land materials/vegetation and phone reflection
cost. Flow advection and measured hydraulic bindings are not implemented.
