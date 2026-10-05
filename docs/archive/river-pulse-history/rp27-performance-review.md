# RP27 performance review: Eel optics and Tuolumne reservoir context

This is a source and measurement review for the proposed reuse sequence. It records measured
costs, limits, and bounded follow-up options; it does not claim a combined runtime benchmark or
accept the Eel reflection treatment.

## What the counters say

RP23 keeps Poopenaut's native scene in its own Three.js renderer. Its current readout reports
790,251 triangles and four draw calls with the reused dam visible, 25.69 MiB CPU geometry, and
13.33 MiB estimated texture storage. With the dam hidden, the same page reports 788,995
triangles and three calls, while geometry and texture totals stay resident. Its scene renders
on view or control changes. These are native renderer counters and estimates, not GPU timing or
whole-page memory ([Tuolumne review](../../../previews/tuolumne/rp23/review.html),
[integration](../../../river-pulse/rivers/tuolumne_river/scenes/start/poopenaut_valley/tuolumne.js)).

The lazily loaded Hetch Hetchy renderer is a second rendering path and retains one engine after
first use. At 768x648 desktop low quality, its rolling submission-plus-GPU-completion wait
median was 62.3 ms over 120 samples, with 121.78 MiB of tracked engine GPU buffers. At
448x976 phone low quality, it was 35.5 ms over 25 samples and 117.86 MiB tracked buffers.
Cached ready times were 5.681 s desktop and 2.920 s phone. These are automatic-quality
observations, not controlled comparisons, GPU-only timings, FPS, cold loads, total GPU memory,
or device-independent targets. Tracked buffers exclude textures, driver allocations, uniforms,
and the native renderer. The reservoir `hide()` path cancels its frame request; pause, hidden-tab,
and inactive checks prevent further frame work, but the context has no disposal path, so its
buffers remain resident ([context](../../../river-pulse/scene-kit/reservoir-context.js),
[runtime notes](../../../previews/tuolumne/rp23/review.html)).

RP26's Eel-only candidate reports 2,514,254 rendered triangles and 14 draw calls in both the
previous-optics and guarded-optics captures. CPU geometry is 18.03 MiB in both. The 0.091 MiB
optical-depth attribute was already present in RP25; RP26 adds no triangles, calls, or CPU
geometry allocation. It enables sampling from the reflector's depth attachment. The 637x533
target has a 2.59 MiB color estimate and 1.30 MiB nominal sampled-depth estimate, but the prior
target already had implicit depth storage; incremental allocation is unknown. Eight source
textures are estimated at 55 MiB RGBA with mipmaps. The paired desktop frame interval p50/p95
was 52.25/95.14 ms before and 47.59/93.50 ms after; CPU submission was 0.69/1.52 ms and
0.76/1.44 ms. These captures do not establish a speedup, GPU-only time, or phone performance
acceptance ([metrics](../../../previews/eel/rp26/before-desktop-metrics.txt),
[candidate](../../../previews/eel/rp26/after-desktop-metrics.txt)).

RP27's current Eel primary-view measurements compare the previous exported land surface with
the bounded native-source form at the same water, material, detail, and photo settings. Both
phone captures used a 390x844 viewport at DPR 1 on WebGPU, with 12 warmup frames followed by
120 samples. The previous surface reported 2,514,254 triangles and 14 calls; the 1 m crop
sampled at 4 m reported 2,646,810 triangles and 16 calls. Geometry buffers measured 23.71 MiB
in both cases because comparison-pass buffers were resident together. The decoded 2.29 MiB
source crop is excluded from that geometry count. Eight textures have the same 55 MiB RGBA+mips
estimate, and the 0.091 MiB optical-depth attribute and shared water buffers are present in both
passes.

Phone frame interval p50/p95 was 1003.88/1004.18 ms for the previous surface and
1003.90/1004.06 ms for the native form; CPU submission was 0.64/0.87 ms and 0.65/0.88 ms.
The roughly one-second intervals reflect browser throttling and cannot be read as FPS or a
controlled speed comparison. A separate desktop native-form capture at 980x820 reported the
same 2,646,810 triangles, 16 calls, and 23.71 MiB resident geometry, with 1003.89/1004.11 ms
frame intervals and 0.68/0.81 ms CPU submission. There is no matched previous-form desktop
metric here, so it is not a desktop comparison. The phone reflector estimate is 254x549,
1.06 MiB color plus 0.53 MiB nominal sampled depth; desktop is 637x533, 2.59 MiB plus 1.30 MiB.
These targets remain resident after first use; actual backend allocation and GPU time are
unknown. Full browser and driver memory are also unknown ([phone previous](../../../previews/river-pulse/rp27/eel-before-phone-metrics.txt),
[phone native](../../../previews/river-pulse/rp27/eel-after-phone-metrics.txt),
[desktop native](../../../previews/river-pulse/rp27/eel-after-desktop-metrics.txt)).

A separate desktop eye-view sample uses the finer 2 m source mesh: 3,079,422 triangles,
16 calls, and 36.42 MiB geometry buffers, with CPU submission p50/p95 of 0.93/1.57 ms and
1003.49/1005.83 ms frame intervals. The decoded 2.29 MiB source crop remains excluded. This
geometry total includes both cached 2 m and 4 m tiers. Against the earlier desktop 4 m primary
capture (2,646,810 triangles, 16 calls, 23.71 MiB), this is 432,612 more submitted triangles
and 12.71 MiB more resident geometry; the views differ, and the byte delta includes cache
residency, so it is not an isolated allocation or controlled performance comparison. It makes
the finer tier's current resident cost explicit ([2 m eye metrics](../../../previews/river-pulse/rp27/eel-after-desktop-eye-metrics.txt)).

The current Tuolumne phone water capture reports 826,068 triangles and four calls, compared
with 790,251 and four calls in the matched previous line-guide counters: +35,817 triangles and
no added calls. Both passes report 30.93 MiB CPU geometry buffers with the comparison surface
resident. The authored water attributes are 0.708 MiB; source texture estimate is 13.33 MiB.
There is no reflection target or reflected-scene pass. Current CPU submission p50/p95 is
0.87/1.32 ms and frame interval is 1003.43/1005.93 ms; the before file contains counters only,
so there is no sampled CPU baseline. The roughly one-second interval is browser throttling, not
phone FPS or performance acceptance ([current](../../../previews/river-pulse/rp27/tuolumne-after-phone-metrics.txt),
[previous counters](../../../previews/river-pulse/rp27/tuolumne-before-phone-counters.txt)).

Triangle and draw-call counts describe submitted rendering work as reported by a renderer;
geometry bytes describe allocated geometry buffers. They are not interchangeable. RP23's
native and reservoir contexts have separate renderers, and the Eel reflector adds an offscreen
scene pass, so counters from these paths should not be added or compared as a single pass budget.

## Bounded options to test

1. **Keep demand gating correct.** Eel's paused, source, and form states now skip scene renders
   until a camera, mode, setting, or resize change marks the view dirty; frozen controls
   invalidate the frame, while active Study water remains continuous. Tuolumne applies the same
   gate to native water and stops submitting when the reservoir context or another scene is
   active. The animation-loop callback still wakes to check state, so this gates rendered work
   rather than proving zero idle CPU. Verify all controls and browser visibility transitions
   continue to invalidate or stop work correctly.
2. **Bound phone reflection resolution.** The Eel reflector currently uses a fixed 0.65
   resolution scale in `authored-water.js`. A viewport-aware lower tier is a small, reversible
   experiment; compare its water-edge readability and reflected forest at the three phone
   cameras before retaining it. The nominal desktop target estimate is not an observed mobile
   allocation or predicted saving.
3. **Preserve bounded terrain and visibility gates.** The Eel hero form samples the verified
   1 m source crop at 2 m for desktop eye/shore and 4 m for primary and phone views; it fades to
   the retained 14.05 m surrounding grid and suppresses source displacement near wet cells.
   Continue source-derived detail only inside verified dry coverage. The
   full reservoir context is loaded only for the dam/downstream/lake study views and hidden
   native views stop its frame loop. Keep that gate and one retained context. If a future native
   valley pass adds detail, first keep it bounded by verified coverage and camera range; reuse
   the land pass's existing grass tiers and tree/impostor ranges before expanding them.
   `createWaterscape` and `createLandPass` currently expose no complete disposal API, so hidden
   means inactive, not released. A true memory-release policy needs a tested engine/land
   lifecycle path.

The water material has nine analytic wave terms per fragment, a procedural bed, and a reflector;
avoid adding water geometry or detail maps to the native valley until LiDAR coverage and the
existing source/resolution limits are checked. If phone performance remains poor after idle
render gating and reflection-resolution trials, test a lower wave-detail tier as a separate
optical comparison. Record measured viewport, quality, browser, and device with each result.
