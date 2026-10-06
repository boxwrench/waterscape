# RP26 Eel reflection contact review

Continues the [RP25 optics experiment](./eel-water-optics-review.md) on `task/RP26`
after the user's instruction to go on. Ready for human visual review; the original
water remains the default. This pass strongly reduces the broad white patches
without repairing the coarse surface or establishing production acceptance.

## Correction and evidence

The optional Eel guard samples the planar reflector's depth at the same distorted
UV as its color. Geometry confidence is `1 - smoothstep(0.95, 0.9999, RTdepth)`;
background confidence falls toward zero. Reflected background over modeled
shallows blends toward muted green `0x294c38`, with squared smoothstep over optical
depth 0.02–2.6 m. Reflected geometry retains its contribution where depth indicates
geometry confidently. Fresnel, refraction, wave normals, gravel, light and mirror
height remain the prior settings. The guard is an authored display approximation,
not a physical Fresnel correction, measured bathymetry or curved-surface reflection.

The surface positions/indices, 0.18 m rendering clearance, depth mapper, land,
forest, source modes and v1 cameras were preserved. Hacienda omits the new option:
its reflector depth sampling stays disabled and its original color path remains.
No engine, kernel, vendor or other river runtime was modified.

The [actual comparison gallery](../../../../../../../previews/eel/rp26/review.html) contains six
matched pairs: Bluffs, eye level and shoreline at 980×820 desktop and 390×844 phone.
All final pairs were recaptured with `?freeze=1`, starting the wave clock paused at
zero in both source versions. Before is RP25 optics with the guard absent; after
enables the guard. Title hidden, review controls collapsed, refined boundary,
reservoir bluff material and fixed cameras match. The previous non-reflective
water is not the before state in this gallery.

Bluffs retains the useful bank/forest reflection. Eye and shoreline lose most of
the large white patches. A thin bright angular rim and some distorted contact
remain in both sizes, including after a second no-glint diagnostic. Coarse land
and water silhouettes remain visible. Bend review exposes authored shallow/color
contours more clearly; these still look artificial. This is a bounded improvement,
not visual parity with the reservoir or proof that a single mirror suits the reach.

## What the diagnostics established

Saved runtime evidence in `previews/eel/rp26/`:

| Probe | Observed result and decision |
|---|---|
| `diagnostic-no-reflection-phone-shore.jpg` | White band disappears while bed remains. Reflection path implicated. |
| `diagnostic-no-distortion-phone-shore.jpg` | Band remains. UV ripple offset alone is not the cause. |
| `diagnostic-two-sided-phone-shore.jpg` | Band remains. Face culling alone is not the cause. |
| Lowered/raised-plane diagnostic images | Lowering 4 m broadens the gap; raising 4 m gives black/clear output. Rejected. |
| `iteration-projected-phone-shore.jpg` | Geometry-projected UV produces mostly sky on the warped surface. Rejected. |
| `diagnostic-projected-flipy-phone-shore.jpg` | Appeared promising, but UV calibration showed the Y orientation was wrong. Rejected. |
| `diagnostic-uv-calibration-phone-shore.jpg` | Green error against `screenUV.flipX()` disproves apparent projection cleanup. |
| `iteration-shore-fade-phone-shore.jpg` | Fading the whole reflection reveals a gold/angular bed edge. Replaced by background-sensitive guard. |
| `diagnostic-guard-no-glint-phone-eye.jpg` | Thin bright rim remains. Glint alone is not its cause; normal strength restored. |

These probes localize the problem and reject plausible fixes. They do not prove
one exact clipping/projection mechanism for every residual. The [reflection
audit](./rp26-reflection-audit.md) and [contact audit](./rp26-contact-audit.md) explain
the plane, clipping, shared triangulation and remaining limits. No diagnostic
branch remains in the runtime.

## Verification

Root inspected all twelve paired screenshots and additional overview/bend,
plain form/source, California Evidence and motion views. California CalWater
geometry/credits remain featured; no new dataset or native 1 m LiDAR was added.
Terrain remains the existing approximately 14.05 m 3DEP grid. The Evidence drawer
now explains the background guard and its limits.

`motion-1.jpg` / `motion-2.jpg` differ within the water region; settled
`paused-1.jpg` / `paused-2.jpg` are pixel-identical. Manual pause/resume works after
the zero-phase review starts. Form/aerial and the initial shoreline disable optics;
returning to refined study restores it. The default previous surface remains
available. Phone camera buttons measure 44 px high, the review panel fits and
scrolls, and the document has no horizontal overflow. Actual Eel and Hacienda
Beach renders were checked for errors. WebGPU was the reviewed backend.

## Cost and limits

Primary view, WebGPU, 980×820, DPR approximately 1, paused phase zero; 12 warmup
plus 120 sampled frames. Both desktop and phone contexts were settled at Bluffs
for both measurements. Raw outputs are `before-desktop-metrics.txt` and
`after-desktop-metrics.txt`; loading times are individual page-load observations.

| Metric | RP25 optics before | Guarded optics after |
|---|---:|---:|
| Rendered triangles / draw calls | 2,514,254 / 14 | 2,514,254 / 14 |
| Resident CPU geometry | 18.03 MiB | 18.03 MiB |
| Frame interval p50 / p95 | 52.25 / 95.14 ms | 47.59 / 93.50 ms |
| CPU submission p50 / p95 | 0.69 / 1.52 ms | 0.76 / 1.44 ms |
| First frame | 850 ms | 907 ms |

Eight source textures retain the 55.0 MiB RGBA/mip estimate. The 637×533 reflector
color target is estimated at 2.59 MiB. Sampleable depth has nominal 32-bit storage
of 1.30 MiB; the prior reflection target already had an implicit depth attachment.
This figure is not measured incremental allocation. Backend/driver storage,
GPU execution and total browser memory remain unmeasured. A shader depth lookup
was added; the full reflected-scene pass remains. These automated intervals do
not establish a speedup, foreground FPS or phone performance acceptance.

Three cheaper agents audited contact/reflection, peer-reviewed the images and
assembled the gallery; one was redeployed for focused checks. The four suites
pass 15 tests, river packages validate, and built assets validate. The retained
source/model inputs and render evidence are reproducible.

## Checkpoint

Implemented as a reviewable experimental improvement; awaiting human acceptance.
The thin rim, warped reflection and coarse bank still need another bounded pass
before shared-water adoption. Next investigate the residual in separate bed-only,
reflection-depth and plain-contact views, then establish a coherent river surface
strategy before more decorative detail. The original water remains the production
default. No branches were merged or pushed.
