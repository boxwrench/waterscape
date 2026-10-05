# RP25 Eel water optics review

First bounded implementation of the [visual parity plan](visual-parity-plan.md),
on `task/RP25`. Implementation complete; human visual acceptance pending. This
spike demonstrates material reuse, but does not justify shared-water extraction
or adoption on other rivers yet. The previous surface remains the default.

## What changed and why

The experimental selector reuses Hacienda's `createAuthoredWater` custom-grid
input on Eel's existing refined clipped surface. Its position and index attributes
are shared with the previous mesh; only the optical-depth attribute is added.
An Eel-only adapter estimates signed distance to the existing wet-mask threshold,
including dry islands. Depth is zero at the clipped boundary, scales by 0.08 metres
per map metre, and caps at 2.6 metres. Eight-neighbour distance and interpolation
are approximations, with deterministic results and explicit bounds checks.

Fresnel reflection, filtered waves, modeled gravel-bed refraction and approximate
caustics consume that illustrative input. Eel supplies the direction of its existing
light. Screen derivatives attenuate subpixel procedural gravel toward its mean,
reducing the initial gold speckling. Hacienda's omitted options preserve its
previous appearance. The reservoir engine, kernel, vendor, terrain elevations,
water positions, forest, light and v1 cameras were not modified.

Optics is enabled only in Landscape study with the refined shoreline. Form,
Source aerial and the initial raster boundary retain their previous behavior.
The clock freezes on pause and reduced-motion preference. URL parameters support
repeatable review: `?water=optics&view=primary` and `?water=previous&view=primary`.

## Sources and interpretation

The runtime still uses the existing 384×384 USGS 3DEP grid at approximately
14.05 m spacing, aligned NAIP context and mapped 3DHP footprint. No native 1 m
LiDAR data was added. Existing California Water Boards CalWater context remains
featured in Evidence, with interagency origin, dates and geographic limits.
The existing source manifest and [source audit](eel-source-audit.md)
describe those inputs. No new scientific source or observed value was introduced.

The optical-depth model is illustrative input, not bathymetry. The optics binding
is Derived from that modeled input and authored light. Water color, clarity, wave
motion and gravel are authored; no gauge drives stage or velocity. Mirror height
15.70 m is a selected proxy vertex, not a water-level measurement. The same surface
ranges from 12.08 to 21.20 m, incompatible with one horizontal reflection plane
throughout the reach. The plan now distinguishes resampled 1 m reservoir detail
from verified native 1 m LiDAR, and records the verified custom-grid API seam.

## Actual render evidence

The [comparison gallery](../../previews/eel/rp25/review.html) presents six paired
comparisons: Bluffs, eye-level and shoreline at 980×820 and 390×844. All final
before/after images were captured from the implemented runtime with the same
paused clock per device, fixed v1 cameras, refined boundary and reservoir bluff
material. Review controls were collapsed, title hidden, and captures settled
after each change. Dimensions were checked from image files. These are browser
renders, not concept images.

Additional inspected evidence in `previews/eel/rp25/`:

- `optics-overview.jpg` and `optics-bend.jpg`: footprint continuity and distant view.
- `phone-form.jpg` and `phone-source.jpg`: original form and aligned aerial modes.
- `motion-1.jpg` / `motion-2.jpg`: water changes within the visible surface.
  `paused-1.jpg` / `paused-2.jpg` are pixel-identical after settling.
- `iteration-primary.jpg` / `iteration-shore.jpg`: initial unfiltered optics.
- `iteration-height-shore.jpg`: rejected height-agreement fade. It removed forest
  reflection and flattened water while leaving the white band.
- `iteration-no-glint-shore.jpg`: diagnostic with sun glint disabled. The white
  band remained; the test was reverted. This rules out glint alone as the cause.
- `hacienda-beach-smoke.jpg`: original authored-water scene renders without errors.

Evidence disclosure and California inset were inspected in the actual phone UI.
Phone width was verified as 390 pixels with no document horizontal overflow;
camera buttons measured 44 pixels high. Expanded review controls stay within the
viewport and scroll. Optics selection is disabled in form/aerial/baseline modes
and reactivates when returning to refined study. Eel and Hacienda had no captured
error logs.

## What improved and what remains weak

Bluffs reads as reflective water against forest instead of a pale blue strip.
Shallows have a visible bed; filtering reduces procedural speckling. This is a
larger visible change than RP24's fine rock-texture pass, especially at phone size.

Eye-level and shoreline views introduce a strong angular white band along the
far bank; matched previous-water captures have no such band. Reflections distort
over the DEM-following surface. Neither the rejected height fade nor removal of
sun glint resolved the band. The single-plane reflector is a major compatibility
limit, but reflection clipping/contact geometry must be isolated before asserting
the exact cause. Coarse bluff form, uneven water contact, authored forest and
plain sky remain visibly below the reservoir standard. Main-view improvement
does not establish acceptance of the close views.

## Cost

Paired final primary-view samples: WebGPU, 980×820, DPR approximately 1, paused,
12 warmup frames plus 120 measured frames. Both Eel review contexts remained open
for both samples. Raw outputs are `before-desktop-metrics.txt` and
`after-desktop-metrics.txt` in the gallery directory.

| Metric | Previous surface | Experimental optics |
|---|---:|---:|
| Rendered triangles, including additional passes | 1,261,548 | 2,514,254 |
| Draw calls | 8 | 14 |
| Resident CPU geometry, both materials available | 18.03 MiB | 18.03 MiB |
| Frame interval p50 / p95 | 44.28 / 71.12 ms | 58.13 / 76.40 ms |
| CPU submission p50 / p95 | 0.50 / 0.81 ms | 0.57 / 0.81 ms |

The adapter adds 0.091 MiB depth data over the prior 17.94 MiB geometry baseline.
Position/index attributes are shared rather than duplicated. Eight source textures
retain the existing 55.0 MiB RGBA/mip estimate. The 65% reflector target is
637×533, estimated at 2.59 MiB for half-float color only; depth storage, driver
allocation and total memory are excluded. The target remains resident after its
first use even when switching back to previous water.

The additional reflected scene almost doubles rendered triangles and increases
draw calls by 75%. CPU submission is not GPU execution time. Earlier occluded
automation samples ran at roughly 1 Hz; `previous-desktop-metrics.txt` and
`iteration-desktop-metrics.txt` preserve those separate runs. Their pacing is not
comparable to the final paired sample and cannot imply FPS improvement. No normal
foreground FPS guarantee, GPU duration, total browser memory or phone performance
acceptance is established.

## Verification and checkpoint

Three cheaper agents built the depth adapter/tests, audited integration and
assembled the gallery. Root integrated, inspected the actual views, rejected
ineffective refinements and verified motion/pause, source modes and UI. The focused
four-suite run passes 15 tests; river packages and built assets validate.

Status: ready for human review as an experiment, needs another bounded correction
before production water acceptance. Shared-water extraction and new advection are
deferred. The next pass should isolate the bright reflection band and establish an
appropriate river surface/reflection strategy, then repeat these fixed comparisons
and costs. No branches were merged or pushed.
