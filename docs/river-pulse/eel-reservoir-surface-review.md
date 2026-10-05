# Eel / Scotia Bluffs reservoir surface pass — RP24

Status: implementation ready for human visual review; not an accepted baseline.

## Scope and evidence

Adapted existing reservoir Rock030 photo color/normal detail to Eel's dry steep
faces. The reusable module applies two world-space projections, a rotated second
frame and deterministic low-frequency blending. Color varies only the previous
palette's luminance. Fine normal slopes use the same unreflected UV axes as color,
are projected onto the geometry tangent plane and converted to view space by the
caller. Existing procedural bump is retained. Woody cover softly attenuates the
effect. Detail fades between 400 and 1400 m from the camera.

The [source/projection audit](rp24-source-audit.md) records license metadata and
cross-river candidate limits. Existing Rock030 maps are authored appearance assets,
not photographs of Scotia rock. Ellin Beltz's March 2016 Scotia photograph remains
the credited external visual reference. Source terrain, aerial and river footprint
are unchanged; no new scientific value, geology, native 1 m DEM, species inventory
or river-stage claim is introduced. California CalWater remains featured in Evidence.

Native 384² terrain is still approximately 14.05 m, without vertical exaggeration.
Forest sites retain seed 17041, camera-dependent detail budgets and existing assets.
The five v1 cameras, lighting and water system are unchanged. The previous RP20
material remains selectable independently of forest and shoreline controls.
Original form/source presentations remain available.

## Iteration and actual review

The [runtime comparison gallery](../../previews/eel/rp24/review.html) preserves
five desktop and five phone before/after pairs. Initial before captures were taken
before integration, but final inspection caught several screenshots before the
browser had painted the selected camera. The final comparison pairs were therefore
recaptured from the retained previous RP20 material and the final photo material
in the same runtime, allowing paint to settle between selections. The original
pre-integration cost sample remains separately preserved. Desktop is 980×820;
phone is 390×844. Both use the same named
fixed cameras, study/detail/refined presentation, paused highlights and hidden title.
Browser cursors/button focus and the frozen water-highlight phase can differ;
these are visual comparisons, not pixel-identical image-difference experiments.

The first pass was too faint in the main view. Preserved `iteration-primary.jpg`
and `iteration-eye.jpg` show its 0.92–1.08 color gain and 0.22 normal strength.
The bounded correction increased gain to 0.82–1.18 and strength to 0.42, preserving
9/12.33 m texture scales and the distance fade. A separate projection audit caught
normal-only face flips that did not match the color UVs; the final implementation
uses consistent fixed-UV normal slopes. Original geometry normals supply the mask.

Root inspected all five final desktop and phone views, primary form/source views,
California context and multiple animated/paused primary frames. Captures are actual
browser renders, not reference or concept images. Fine texture reads more clearly
at eye level and on the near bend face; the primary-view change remains modest.
No obvious tile grid or projection seam was observed at these cameras. Detail
largely fades from the overview. It does not solve the coarse cliff silhouette.

Still weak: smooth rounded bluff forms, generic tree spacing/crowns, coarse cover
boundaries, flat illustrative water and angular water/shore contact. Adding fine
surface grain can make the lack of larger-scale cliff structure more apparent.
The result remains well below the reservoir visual standard.

## Runtime cost

Primary at 980×820, WebGPU, DPR ~1, paused study/detail/refined: each material
sample warmed for 12 frames and recorded 120. Both render 1,261,548 triangles,
eight draw calls and 17.94 MiB resident CPU geometry buffers. Both materials are
loaded in this comparison. The same-runtime previous material recorded CPU
submission p50/p95 0.30/0.40 ms and frame interval 12.25/16.76 ms; the final photo
material recorded 0.28/0.45 ms submission and 12.48/16.86 ms interval. This is a
small sample, not evidence of improved rendering speed.

The pre-integration six-texture estimate was 44.3 MiB. The final eight-texture
RGBA/mipmap estimate is 55.0 MiB: approximately +10.67 MiB from the two 1024² maps,
stored JPEGs totaling 0.945 MiB. The maps stay loaded when the previous material
or source/form mode is selected. The cached first frame changed from 395 ms in the
pre-integration sample to 343 ms in the final reload; these are observations, not
a controlled loading benchmark. Phone primary at 390×844 recorded submission
0.23/0.35 ms and interval 8.27/12.42 ms over 120 frames, with the same geometry
and texture estimates. Raw samples are preserved beside the captures.

GPU time, total browser/device memory and normal foreground FPS are not measured.
Automated frame intervals can be throttled and cannot establish a performance
guarantee. This pass adds shader sampling work even though geometry and draw calls
are unchanged; CPU submission is insufficient to measure that GPU cost.

Browser error logs were empty. Phone document width was 390 px with no horizontal
overflow; visible scene buttons were at least 44 px tall. The CalWater inset had
four rendered paths and its source-backed caption. All ten desktop and ten phone
gallery images loaded at their recorded dimensions. Two animated frames visibly
change the river highlights; two settled paused frames (`paused-3/4.jpg`) are
byte-identical with the document visible and pause active. Initial paused captures
`paused-1/2.jpg` differ only around the clicked camera button/cursor overlay; that
UI transient was investigated before recording the settled pair.

Seven focused Eel tests, package validation and the 120-module build passed.
The sandbox initially prevented Node test-worker spawning (`EPERM`); the permitted
retry outside the sandbox passed. No test failure was hidden by a visual claim.

## Parallel work and next pass

Three cheaper agents produced the isolated material module/comparison gallery,
source/projection audit, and [Tuolumne performance audit](rp24-tuolumne-performance-audit.md).
Completed agents were redeployed within the pass; root integrated and reviewed.
The Tuolumne audit identifies wrapper-level resolution/glare trials with no measured
savings yet. Its full reservoir context remains in the isolated RP23 checkout.

After human acceptance, prioritize Eel's larger bluff/shore contact forms and water
before adding more fine material detail. For Tuolumne, test georeferenced dry-slope
normal/relief shading on the native mesh while keeping the full original reservoir
context selectable. Preserve the difference between a 1 m-spaced resampled shading
image and native 1 m elevation geometry.
