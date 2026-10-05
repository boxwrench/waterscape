# Tuolumne / Poopenaut Valley: first runtime form review

This is the archived RP21 first-form record. The later
[RP22 dam reuse review](tuolumne-dam-reuse.md) adds the existing Waterscape
O’Shaughnessy Dam, a disclosed local render-contact cut and a separate close camera.
The source bundle and five v3 review cameras are retained.

RP21 turns [RP19's geographic foundation](tuolumne-foundation.md) into an actual
local browser form study. [Live scene](http://localhost:5174/river-pulse/renderer/tuolumne.html)
and [render comparison](http://localhost:5174/previews/tuolumne/review.html) use the
isolated Tuolumne worktree, not the Eel development server. Source geography has
not been carved or vertically exaggerated. Human acceptance is pending.

## Source and interpretation

The 14.66 m USGS 3DEP grid retains absolute NAVD88 heights in UTM 11N. The named
USGS 3DHP line positions are projected into the same local metre frame with
`pipeline/geo.py` and rounded to centimetres in `layout.json`. Only positions are
source-backed: the cyan stroke and 3.5 m clearance are symbolic authored display
choices. This pass has no river surface, observed width, stage, bathymetry,
hydraulic flow or gauge binding. Source geometry can have gaps, including named
line discontinuities around the dam/reservoir transition; these remain visible.

The always-visible inset uses downloaded **California CalWater 2.2.1 watershed
polygons**, not a decorative invented basin. HU 6536 identifies Tuolumne River;
HA 65366 is Hetch Hetchy. The state/interagency dataset is attributed to the Water
Boards host and DWR/CDF/interagency authorship, dated 1999/2004. Its map is
archival context, not inundation or legal jurisdiction. Longitude is scaled by
the cosine of study latitude for this context diagram; no survey-scale map or
area estimate is claimed.

Source aerial mode lays aligned archival USGS/USDA NAIP imagery on the terrain.
Its vegetation, water and structures are photographic, not constructed detail.
Native 1 m NCALM lidar availability and the collection's partial irregular
footprints remain disclosed; neither raw points nor native 1 m tiles are installed.

## Review and bounded corrections

The first real render revealed that RP19's camera proposals faced the northern
ridge, missing the nearby river. Source layout puts the valley around local
x 627, z 1071 m. Cameras were calibrated against the actual aerial and runtime.
The first primary view also hid the guide behind a foreground slope; its
viewpoint was moved before freezing the final set. `review-cameras.json` now
records **poopenaut-runtime-v3**. Positions are authored views, not surveyed
access points. The initial proposal image is retained as `before-overview.png`;
camera calibration changes cannot establish a same-camera geometry improvement.

The calibrated overview then showed washed-out valley relief and an almost
invisible guide. A bounded presentation correction reduced ambient/exposure,
darkened the plain terrain color and increased guide contrast. Native elevations,
geometry, sun direction and the overview camera stayed fixed. The paired
`before-lighting-overview.png` / `after-overview.png` use the same 980×820 viewport,
WebGPU, DPR 1.25 and identical overview coordinates. The primary camera changed
later; overview coordinates remain the same between v2 and v3.

Actual five-camera renders were inspected on desktop **980×820** and phone
**390×844**, plus the source aerial and Evidence panel. Final desktop captures
after phone reset use approximately DPR 1.0; they are not substituted into the
earlier DPR 1.25 paired comparison. Phone review found a state-card/title overlap;
the state inset became a compact horizontal card. No horizontal overflow and
44 px camera targets were verified. Browser console errors were empty. Captures
waited for the new rendered frame after camera changes; final-prefix files are
the authoritative desktop set, replacing exploratory captures that could show
the previous view.

## Cost and remaining weaknesses

At overview with guide visible, the runtime reports **788,995 rendered triangles,
three draw calls and 21.11 MiB CPU geometry buffers**. Source texture RGBA+mips
estimate is **8.0 MiB**. Hidden guide reduces draw calls to two. The contrast
correction changes no topology/buffer bytes or call count. Cached first-frame
readouts ranged 162-208 ms in this session; they are not a cold-cache loading
measurement or evidence of speed improvement. Full browser/GPU memory, GPU time
and foreground FPS are unmeasured. Rendering is static and triggered by controls
or resizing, so no animated effect or clip is claimed.

Overview and valley views now reveal the source-backed corridor and granite
relief. Close views remain empty, smooth and coarse; imagery supplies appearance
only in the labeled source mode. River guides may be locally occluded or visibly
disconnected. No trees, rock bedding, grass, detailed dam or convincing water
have been built. The finite DEM extent remains a geographic limitation. These
weaknesses are visible in plain form rather than masked with vegetation or fog.

River status is `in_development` and its page links the Poopenaut form study.
The deployable build includes the new entry, local module graph and source data.
This is a reviewable early geographic baseline, not a finished scene. **Awaiting
human acceptance** before the next detailed pass. Next: verify/download native
lidar coverage and reconcile datums for a bounded terrain refinement, then source
mapped water footprint/contact before adding water optics and detailed setting.
