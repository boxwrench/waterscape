# Handoff — 2026-10-04

## Scene chrome consistency — RP30

Eel and Tuolumne headers, camera controls and review-tools control now match the other scenes
(CSS/markup only; [task](../roadmap/tasks/RP30-scene-chrome-consistency.md),
`previews/river-pulse/rp30/`). Tests and build pass; pending human visual acceptance.

## Scene data cards — RP29

Implemented locally on `task/RP27` after RP28; pending human visual acceptance. Freeport and
Hacienda show a stale gauge reading's last value prominently (muted, with the time) instead of
"No current reading". Freeport's card adds a 30-day tidally filtered discharge sparkline.
Placeholder favicon added. 179 unit tests and the build pass; Edge captures of all five scenes
show no errors ([task](../roadmap/tasks/RP29-scene-data-cards.md), `previews/river-pulse/rp29/`).
`scripts/verify-river-pulse.mjs` cannot run on Windows (static server 404s for `dist/`).
Open: Jenner history, hiding Eel/Tuolumne review tools from visitors, unified camera-button style.

## River home layout and navigation — RP28

Implemented locally on `task/RP27` after the RP27 checkpoint commit; pending human visual
acceptance. The river home (`river-pulse/river.html`) is rebuilt in the atlas's dark style:
river tabs, a hero from the river's own scene, a data panel, scene cards with viewpoints, and
what comes next. Live USGS discharge and a 30-day history show for Sacramento and now Russian
River (Hacienda Bridge); a stale reading keeps its value with a Stale badge. Eel, Tuolumne and
planned rivers state that no gauge is bound. Atlas, Eel, Tuolumne and Freeport navigation now
link consistently to California and river home. See [task](../roadmap/tasks/RP28-river-home-layout.md)
and `previews/river-pulse/rp28/`. 177 unit tests, package validation and the build pass.
Scene pages are unchanged. Next: bring Hacienda's discharge, history and condition-band
pattern into the other scenes; no push or merge.

## River water adoption and hero land — RP27

Implemented locally on `task/RP27`, with three cheaper agents reused for geometry,
source verification, gallery/performance and checks. The user explicitly authorized
the RP23 merge; no push or merge into main. [Actual gallery](../../previews/river-pulse/rp27/review.html)
and [review](./river-pulse-history/rp27-water-land-review.md) preserve matched desktop/phone
comparisons. Eel now defaults to the bounded RP26 water improvement. Tuolumne's
valley now has shared river water, with analytic sky instead of a horizontal mirror
over its sloping reach; original reservoir contexts remain available.

Verified native 1 m USGS coverage at all three Eel hero targets, extracted an
800×750-cell crop and integrated source-derived land at 2 m desktop eye/shore and
4 m primary/phone mesh spacing. California CalWater remains featured and used;
the checked state coastal DEM is NoData at these targets. Native plain forms show
clearer cliffs/gullies; Study shading mutes them. Olive/smeared shoreline reflection,
bright rim, smooth foreground and coarse surrounding slopes remain. Primary land
adds approximately 5.3% submitted triangles (2.65M / 16 calls with reflection).
CPU/frame samples are browser-throttled; GPU timing and phone performance are not
established. Paused/source/form views now gate rendering to visible changes.

Navigation follows the latest clarification: state overview → own river home →
existing scenes → camera views. No headwaters or scenic-middle scenes are invented.
[Scene inventory](./river-pulse-history/river-scene-journey.md). Bounded agent sign-off;
overall human visual acceptance and reservoir parity remain open. Older sections
below describe their original checkpoints, including the earlier opt-in defaults.

## Eel reflection contact — RP26

Implemented locally on `task/RP26`, pending human visual acceptance. Three cheaper
agents were reused for reflection/contact audits, peer review, gallery and checks.
[Actual comparison gallery](../../previews/eel/rp26/review.html) and
[review record](../../river-pulse/rivers/eel_river/scenes/middle/scotia_bluffs/notes/eel-reflection-contact-review.md) preserve six matched
desktop/phone pairs at zero wave phase. An Eel-only depth-sensitive reflection guard
strongly reduces broad white bank patches while retaining main-view reflections.
A thin bright rim, warped reflection and coarse contact remain; this is not a
geometry repair or reservoir visual parity. Original water stays the default.
Counts remain 2,514,254 triangles / 14 calls; sampled depth allocation and GPU
time are unmeasured. Shared extraction/adoption remain deferred. No merge/push.

## Eel water optics spike — RP25

Implemented locally on `task/RP25`, pending human visual acceptance. Three cheaper
agents handled the deterministic depth adapter/tests, compatibility audit and
comparison gallery; root integrated and inspected actual desktop/phone renders.
[Comparison gallery](../../previews/eel/rp25/review.html) and
[review record](../../river-pulse/rivers/eel_river/scenes/middle/scotia_bluffs/notes/eel-water-optics-review.md) preserve paired evidence.
The previous water remains the default. Optional Hacienda optics improve forest
reflection and shallows, but close bright edges and nonplanar reflection mismatch
remain. Added reflection nearly doubles rendered triangles; GPU time is unmeasured.
Shared-water extraction, flow advection and cross-river adoption remain pending.

## Visual parity review and plan — first spike implemented; later steps proposed

Read-only review on `task/RP24`; no code changed. Eel, Freeport and Tuolumne's valley
trail the reservoir and Hacienda because they use a simpler Three.js path on ~14 m data
with proxy water, while the reservoir runs the full engine and Hacienda is hand-authored.
Full diagnosis, reuse inventory and steps are in
[visual-parity-plan.md](./river-pulse-history/visual-parity-plan.md). Summary of the order:

1. Reconcile `task/RP23` (Tuolumne worktree) before cross-river adoption; the Eel
   spike is independent. Branch merge is a separate human action under AGENTS.md.
2. Spike, then extract one shared river water from Hacienda's `authored-water.js`
   (refraction onto a gravel bed), fed by Eel's clipped footprint, plus new flow advection.
   The stock `water.cu` cannot take river terrain.
3. Make Tuolumne's valley the flagship: shared water, existing Sierra granite maps and
   Hetch Hetchy `detail-*.webp` shading on one dry slope.
4. Eel and Freeport: hero-camera work and large-form/contact/sky, not more fine grain on
   14 m data. Lidar coverage at the cameras is unverified for both.

Verified: `createAuthoredWater` accepts a custom fourth-argument grid; its default
builder selects Russian River geometry. Native 1 m lidar coverage at the Eel and
Freeport review cameras remains unverified; Eel still renders the 14.05 m 3DEP grid.

## Eel reservoir surface reuse — RP24

Complete locally on `task/RP24`; awaiting human visual acceptance. The
[actual comparison gallery](../../previews/eel/rp24/review.html) and
[review record](../../river-pulse/rivers/eel_river/scenes/middle/scotia_bluffs/notes/eel-reservoir-surface-review.md) preserve five fixed
desktop/phone before-after pairs, form/source views, California context, material
iterations, motion/pause frames and runtime measurements. Eel's dry bluff material
reuses existing CC0 Rock030 maps and reservoir triplanar technique through
`terrain-surface-detail.js`. The previous material remains selectable. Fine texture
improves eye-level/near bend faces, with a modest main-view change. Coarse cliff form,
tree character and close water/shore contact remain below the reservoir benchmark.

Three cheaper agents were reused and redeployed for the module/gallery, source and
projection audit, and Tuolumne performance audit. Root corrected an identified UV /
normal-axis mismatch, integrated the module and inspected actual runtime renders.
Reuse-first guidance now appears in `docs/visual-development.md`; cross-river
recommendations are in [the source audit](../../river-pulse/rivers/eel_river/scenes/middle/scotia_bluffs/notes/rp24-source-audit.md).

Seven focused tests, package validation and the 120-module build pass. Browser
errors are empty; phone has no horizontal overflow; settled pause images match.
Primary geometry/draw calls remain 1,261,548 triangles / eight calls with 17.94 MiB
resident CPU geometry. Two maps add about 10.67 MiB to the RGBA/mipmap texture
estimate, from 44.3 to 55.0 MiB. GPU cost and total memory remain unmeasured.
After review, prioritize larger bluff/contact form and water over more fine grain.
No push or merge.

## Isolated Tuolumne reservoir integration — RP23

The latest parallel work supersedes the RP21 historical entry below.
`C:/Github/waterscape-tuolumne-rp19` is clean on `task/RP23`, implementation
`655fd19`, Result `d8a18ef`. Full original Hetch Hetchy reservoir terrain, water,
lighting and vegetation are selectable at the dam, lake and below-dam views;
native 14.66 m Poopenaut source/form/valley remains separate. Live scene:
http://localhost:5174/river-pulse/renderer/tuolumne.html?view=below ; actual review:
http://localhost:5174/previews/tuolumne/rp23/review.html . Native 1 m LiDAR remains
unacquired; a 1 m-spaced service-resampled shading image does not supply 1 m geometry.

The [performance audit](../../river-pulse/rivers/tuolumne_river/scenes/start/poopenaut_valley/notes/rp24-tuolumne-performance-audit.md) records
62.3 ms desktop / 35.5 ms phone submission-plus-completion waits at low quality,
121.78 / 117.86 MiB tracked engine buffers and unmeasured follow-up hypotheses.
Hidden/paused gating stops submissions but retains allocated buffers. The desktop
remains slow at its lowest tier. Wrapper-level resolution and optional glare trials
are candidates; no savings have been measured. A native dry-slope shading trial is
the next material reuse candidate. This isolated work is not merged into this checkout.

## Eel bluff and forest pass — RP20

Complete locally on `task/RP20`; this visual pass awaits human acceptance.
The [actual comparison gallery](../../previews/eel/rp20/review.html) and
[review record](../../river-pulse/rivers/eel_river/scenes/middle/scotia_bluffs/notes/eel-bluff-forest-review.md) preserve five fixed desktop
and phone views, the original primary baseline, source/form presentations, failed
iterations and measured costs. Deterministic Setting trees reuse licensed reservoir
mesh/atlas assets; authored rock grain and weathering improve the forest silhouette
and exposed faces. Geographic elevations, river geometry and v1 cameras are retained.
California CalWater remains featured and visible in Evidence. No new fine DEM,
species inventory, measured stage or bathymetry is claimed.

Seven focused tests, river package validation and the complete 119-module build
pass. Browser errors are empty, phone width is 390 px, and all ten gallery images
load. Paired primary views increase triangles from 305,292 to 1,261,548 and draw
calls from 3 to 8. Resident CPU geometry is 17.94 MiB; texture RGBA/mip estimate is
44.3 MiB. CPU submission stayed similar in this sample, but GPU time/memory and
foreground FPS remain unmeasured. Palette-only correction followed cost sampling.

Still below the reservoir visual benchmark: cliff forms remain soft at 14 m,
some trees look procedural, and close water/shore contact and structures are weak.
Next bounded pass after visual review: shoreline and close water. No push or merge.

## Parallel Tuolumne first runtime form — RP21

The delegated Tuolumne branch now has an actual plain-form Poopenaut scene in
`C:/Github/waterscape-tuolumne-rp19`, branch `task/RP21`, implementation
`6d8f5e2` and Result `0d74dcb`. It is not merged into this checkout.
Local scene: http://localhost:5174/river-pulse/renderer/tuolumne.html ; actual
review: http://localhost:5174/previews/tuolumne/review.html . Root inspected the
final primary render. Native 14.66 m terrain, aligned archival source aerial,
mapped river guide and actual California CalWater watershed geometry are present.
The cyan line is a mapped guide; there is no water surface, observed channel width,
stage or bathymetry. Native 1 m LiDAR has not been acquired.

Actual rendering corrected the proposed RP19 camera positions; calibrated v3
cameras and five desktop/phone views are preserved in that checkout's
`docs/river-pulse/tuolumne-visual-review.md`. Focused tests, data/source checks and
116-module build pass. Agent reports no browser errors/phone overflow and 788,995
triangles, three draw calls, 21.11 MiB CPU buffers and 8 MiB texture estimate.
No final visual acceptance, GPU cost or FPS claim. RP19 below is the earlier
foundation checkpoint; RP21 supersedes its statement that no runtime scene exists.

## California source context and elevation audit — RP18

Complete on `task/RP18`. The user accepted RP17's first
form baseline with "looks good" and asked about 1 m LiDAR, actual reference inputs
and using/featuring California state data. RP18 preserves the accepted 3D scene and
fixed cameras while adding a state CalWater watershed inset and visible provenance.
Bundled polygons identify the Eel River hydrologic unit (1111) and Lower Eel River
hydrologic area (11111). State/interagency authorship is credited separately from
State Water Boards hosting; these 1999/2004 hybrid drainage/administrative boundaries
provide geographic context, not flood or jurisdiction data.

Current local terrain is a 384×384 resampled 3DEP export at 14.05296785 m cells,
not a native 1 m LiDAR product. Elevations are preserved without exaggeration;
0.05 m encoding precision is not spatial resolution or accuracy. No local 1 m DEM
or raw LiDAR point cloud is bundled. The checked DWR NoCAL Wildfires 2018 footprint
catalog did not intersect this study extent. The actual CA09_Perkins survey
footprint verifies partial 1 m availability at the station, but not the main bluff
review targets; this NCALM/NSF/UC Santa Cruz project is not state agency data.
Full-study 1 m availability remains unverified; a failed National Map catalog
request is not evidence of absence. See the [source audit](../../river-pulse/rivers/eel_river/scenes/middle/scotia_bluffs/notes/eel-source-audit.md).
The [workflow](../visual-development.md) now requires a California source search and
coverage/date/CRS/vertical-datum/source-resolution/runtime-sampling audit, while
retaining federal origins for state-hosted federal products. Source inputs and
limitations are in the [Eel review](../../river-pulse/rivers/eel_river/scenes/middle/scotia_bluffs/README.md).

Verification: five focused source/geometry tests, river package validation and
the complete 117-module build pass. Actual state inset and entry button inspected
at 980×876 and 390×844; phone width remains 390 px and browser errors are empty.
Screenshots are `previews/eel/rp18-*.png`. Full watershed inputs add approximately
1.23 MiB uncompressed; 3D geometry is unchanged. New frame/GPU/memory cost is not
measured for this UI pass. No push or merge.

## Parallel Tuolumne foundation — RP19

At the user's request a separate agent started Tuolumne at Poopenaut Valley in
`C:/Github/waterscape-tuolumne-rp19`, branch `task/RP19`, commits `615acb1` and
`951e73d`. This foundation is not merged into this checkout. It includes a
14.66 m unexaggerated terrain bundle, mapped river lines, aligned source aerial,
actual California CalWater unit/area and five proposed cameras. Its reviewed
source sheet visibly features state geometry. Source validator passes; no runtime
scene or human visual acceptance is claimed. NCALM's 2010 Poopenaut 1 m project
is an available lead; its full footprint and native raster are not acquired.
Next: actual plain-form scene and fixed-view review. See that checkout's
`docs/river-pulse/tuolumne-foundation.md` and RP19 task Result.
## Full reservoir renderer reused at Tuolumne's dam — RP23

Complete locally on `task/RP23`, awaiting human visual acceptance. The user found
isolated dam reuse inferior to their existing reservoir and requested using their
terrain/water/lighting solutions across suitable river environments. The dam now
shows the actual original Hetch Hetchy bundle and complete `createWaterscape`
renderer: granite materials, relief shading, baked terrain light, vegetation,
concrete and water. Original engine/kernel/vendor files are unchanged.
Live recommended view: http://localhost:5174/river-pulse/renderer/tuolumne.html?view=below .

Two full-viewport canvases keep reservoir context and native Poopenaut separate.
Only cameras are translated between shared UTM 11 / NAVD88 frames. Original five
v3 river cameras and native elevation cells remain unchanged; previous dam study,
plain form and source aerial remain inspectable. The original reservoir shoreline
and downstream dam cameras are added. Light presets and pause work. Lazy loading
retains one engine; inactive/hidden/paused scenes do not schedule ongoing frames.
Phone output width is capped to the viewport and aligned for the kernel's row copy.
Actual CalWater state polygons and attribution remain featured in both contexts.

Actual reference/integrated named downstream captures use 980×820 and the same
pose. Close before/after has a different projection (native 52° desktop / 84°
phone; reservoir about 64°). Five native desktop/phone views, full dam transition,
close/downstream/shoreline, form/source, three light presets, motion frames,
pause and Evidence were inspected. Paused captures are byte-identical and their
frame counter stayed fixed. Console errors are empty; phone document width is
390 px and all eight camera buttons are 44 px high. Reservoir source assumptions,
illustrative bed/water/ribbon/release and 1 m-spaced shading versus geometry are
explicit in Evidence. No native 1 m terrain has been installed.

Rolling submission-plus-GPU-completion waits under automatic quality: desktop
shoreline 62.3 ms median / 120 samples at final 768×648 low; phone downstream
35.5 ms / 25 samples at 448×976 low. These are not controlled benchmarks, pure
GPU elapsed times or FPS. Tracked engine GPU buffers are 121.78 / 117.86 MiB,
excluding textures, uniforms, driver and native renderer. Native assets still
retain 25.69 MiB CPU geometry and 13.33 MiB estimated texture memory; these
different accounting categories are not a total memory sum. Cached ready times
were 5.681 s desktop / 2.920 s phone. The added renderer has an ongoing frame cost
versus the previous static study. Performance remains a weakness.

The complete context improves the bare dam/rock surroundings and shoreline water.
Inherited trees obscure the old close camera, near-water highlights look harsh,
and the native valley is still coarse and bare. This is a review baseline, not
final visual acceptance or improved terrain on every river. Two cheaper agents
tested coordinates, audited lifecycle/fallback, drafted reuse guidance/gallery,
and inventoried candidates. Root fixed fallback labels, integrated the renderer,
checked their paths/arithmetic and inspected actual renders. Nine focused Node
checks, source validation, river package checks and the 119-module build pass.
[Actual evidence](../../previews/tuolumne/rp23/review.html) and
[reuse-first guidance](../river-pulse/reference/reservoir-renderer-reuse.md) record next small
Eel bluff, Sacramento bank and Tuolumne dry-slope trials. Work stays isolated in
`C:/Github/waterscape-tuolumne-rp19`; never pushed or merged.

## Tuolumne reuses the existing reservoir dam — RP22

Complete locally on `task/RP22`, awaiting human visual acceptance. User identified
the existing Hetch Hetchy dam as the correct reusable asset. The Tuolumne scene now
imports its original crest/profile and weathered concrete material from the shared
reservoir module. Direct UTM 11 / NAVD88 translation retains source coordinates,
height and scale. Original metadata is unchanged. No reservoir water level,
synthetic bathymetry, river ribbon or illustrative outlet jets are imported.

Actual initial render showed the coarse native DEM piercing the dam face. A
bounded authored cut in the render mesh follows the reservoir contact-clearance
principle; native source cells remain intact. Dam-off and Source aerial restore
native geometry. Five v3 cameras remain fixed; a separate dam close camera has a
phone FOV adjustment. All six desktop/phone views, native/dam comparison, plain
form/aerial, guide toggle, Evidence and featured California context were inspected.
No browser errors or phone overflow; all six camera buttons are 44 px high.

Five focused dam/profile/coordinate/contact tests, source validation, river package
checks and full 117-module build pass. Dam on adds 1,256 triangles and one draw call
(790,251 / 4 total at close view); resident CPU geometry is 25.69 MiB and texture
RGBA/mip estimate 13.33 MiB. Native baseline in the same loaded page retains those
assets; original RP21 had 21.11 MiB / 8 MiB. GPU timing/full memory and foreground
FPS are unmeasured. Coarse terrain contact, bare surroundings and river water still
need later passes. [Actual gallery](../../previews/tuolumne/rp22/review.html) and
[reuse notes](../river-pulse/reference/tuolumne-dam-reuse.md) retain evidence and limitations.
Live close view: http://localhost:5174/river-pulse/renderer/tuolumne.html?view=dam-close .
Work is isolated in `C:/Github/waterscape-tuolumne-rp19`; never pushed or merged.
Cheaper agent audited the transform/reviewed integration and drafted reuse notes;
root checked the arithmetic, integrated the scene and inspected actual renders.
Earlier Eel entries below preserve this worktree's inherited historical checkpoint.

## Eel River visual baseline — RP17

The user redirected RP16's unfinished surroundings to an Eel River trial of their
research/form/fixed-camera/render/compare workflow. `task/RP17` starts Scotia Bluffs
with preserved 3DEP elevations in a resampled grid, aligned NAIP imagery and mapped
3DHP footprints.
The scene has five fixed cameras, plain form/source modes, boundary comparison,
highlight pause and visible 120-frame cost measurement. Water/cover classification
and surface optics are explicitly authored; no gauge or hydraulic values are bound.
The first actual render exposed triangular water/terrain gaps; related plane/depth
corrections are preserved in before/after evidence. Detailed vegetation/structures
and convincing close water remain future passes. The user subsequently accepted
this first form baseline on 2026-10-04; the detailed environment remains unfinished.
The [reusable process](../visual-development.md) and [review record](../../river-pulse/rivers/eel_river/scenes/middle/scotia_bluffs/README.md)
explain provenance, weak points and measurement limits. Work is local; never pushed.
Verification: 9 focused tests, river validation, registry regeneration check and
complete build pass. Five desktop/phone cameras, form/source modes, Evidence,
highlight pause and actual moving frames inspected. No console errors or phone
overflow. Refined boundary adds approximately 0.99% rendered triangles with the
same three draw calls; automated frame pacing prevents an FPS claim. The user
endorses combining this workflow with Sacramento's detailed photo-based modeling;
the later "looks good" accepts the first form baseline, not a finished environment.

## Freeport riverfront setting — RP16

Draft checkpoint: the user redirected work to an Eel River visual study before
acceptance. Desktop views were inspected and 12 focused tests, package validation
and the full build passed. Phone, Evidence/pause and final comparative review remain
unfinished. This setting is not an accepted visual baseline.

After the user accepted the bridge and asked to move on, `task/RP16` builds its
surroundings from their aerial reference. Earthy shoreline/grass materials replace
the pale repeating banks. Levee roads and bridge ramps, roofed marina/slips, original
boats, village/farm buildings, utility poles, fields and layered riparian vegetation
give the scene a riverfront. Riverbank starts on the marina shore; desktop Above
includes a wider corridor. Structures are batched; existing licensed tree/rock assets
are reused. New placements, materials, counts and dimensions are Setting estimates,
not surveyed or current-condition records. The accepted bridge mesh, water bindings
and geographic terrain are retained. No push or merge.

## Freeport upper-link connections — RP15

The user's aerial reference exposed a missing forward tower link. `task/RP15`
defines shared heel, forward leaf-head, tower-crest and rear counterweight endpoints.
Both upper links and the long moving counterweight arm now meet those common joints;
the first leaf panels and catwalk follow them. Upper roof bracing covers both slopes,
and the crest walkway is narrow. The desktop overhead angle faces the bridge broadly
from the tender-house side for comparison with the supplied image.
These are photo-fitted component positions, not a surveyed mechanism or simulation.
The user photograph is referenced by filename only and is not bundled. River data,
water interpretation and geographic terrain are unchanged. No push or merge.
Verification: 11 focused tests, river package validation and full build pass. Bank,
both road approaches, underside and overhead were inspected, plus portrait overhead
and bank framing. No console errors or phone horizontal overflow; previews updated.

## Freeport bridge reconstruction — RP14

`task/RP14` replaces RP13's generic bridge with detailed laced/built-up green steel,
tapered closed leaves, Pratt counterweight support spans, upper links and trunnions,
exposed concrete weights, east Warren pony/west stringer approaches, rounded piers,
timber fenders/ladders, road surfaces, railings, signals and a hip-roof tender house.
Eight selectable angles cover both sides, both approaches, underside and above.
Close-up upper-bracing review adds paired open diagonals, cross ties/center plates,
vertical lattice headers, angle-member sway frames and a railed top platform.
The archived 2012 NBI anchors length/span/roadway/deck width. Unreported heights and
small components are fitted to original photos, not surveyed/as-built geometry.
Evidence/reference metadata preserves that distinction and identifies archival signs.
Scientific observations, water bindings and geographic terrain remain independent.
Verification: 11 focused tests pass, river packages validate, and the complete build
passes. Eight desktop/phone angles and evidence/pause/navigation controls were inspected;
no console errors. Local previews include bridge, east approach, underside and overhead.
See [scene notes](../../river-pulse/rivers/sacramento_river/scenes/middle/freeport/README.md) and
[task](../roadmap/tasks/RP14-freeport-bridge-fidelity.md). No push or merge.

## Sacramento at Freeport — RP13

`task/RP13` continues Sacramento with `/river-pulse/renderer/freeport.html`.
The California overview opens it directly. Bridge/Riverbank use explicitly approximate
photo-informed green steel, levees, stone banks, shared detailed broadleaf meshes,
reflections and optical ripples. Terrain switches to a separate sourced coordinate
frame: 3DEP NAVD88 elevation, 3DHP Sacramento centerline and aligned NAIP imagery.
Live matched Freeport discharge starts independently of graphics; stale/missing values
stay explicit. The existing distinct tidally filtered daily history remains on the
individual river page. No discharge-to-stage/current/flood conversion is made.
See [scene notes](../../river-pulse/rivers/sacramento_river/scenes/middle/freeport/README.md) and
[task](../roadmap/tasks/RP13-sacramento-freeport.md). Work is local; no push or merge.

## California relief overview — RP12

`task/RP12` replaces the index catalog with a sourced California relief map. Census
boundary, USGS 3DHP named river reaches (including American forks) and 3DEP tinted
hillshade are bundled locally. The six river lines and labels are links; hover/keyboard
focus updates a compact preview. Russian River opens Hacienda; Sacramento and the four
planned rivers open `river.html?river=<id>`. Existing observations moved to that page.
Desktop fits the whole state; mobile enlarges map labels and retains full river links.
The user's reservoir/Russian River visuals and saved resource library informed terrain
depth, sea palette and geographic storytelling. No upstream implementation was copied.
Focused map checks, build checks and desktop/mobile navigation pass. No publication.
See [overview notes](../../river-pulse/app/README.md).

## River atlas and Sacramento foundation — RP11

`task/RP11` adds river-level discovery and a local atlas at `/river-pulse/`. Sacramento
is the next river in development; San Joaquin, Eel, Tuolumne and American are source-linked
placeholders. Russian River scenes keep their URLs and gain a Rivers link. Freeport is
the first registered Sacramento data place: instantaneous `00060` and tidally filtered
daily `72137` are kept distinct, with pinned source series, quality/time evidence,
45-minute display freshness and a separate daily chart. No Sacramento 3D scene or terrain
is claimed. See [foundation](../../river-pulse/rivers/sacramento_river/README.md) and
[task](../roadmap/tasks/RP11-river-atlas-sacramento.md). Next work is to choose the first
Sacramento viewpoint, gather photo references and build its terrain/centerline crop.
Local tests/build pass and desktop/mobile atlas was inspected; no publication.

Where things stand, for whoever picks this up next (person or agent). The plan lives in
`ROADMAP.md` and `docs/roadmap/README.md`; this file is the snapshot of "what just happened
and what's next".

## Jenner publication — RP10

The user accepted Jenner as "a good start" and explicitly requested updating, committing,
merging and pushing. `task/RP10` integrates RP9 into the current main base in the isolated
River Pulse worktree. README now has the public Jenner link and the scene/resource docs
record acceptance. The known RP8 artifact-capture failure is addressed with a 90-second
screenshot timeout and completed CSS transitions; existing runtime assertions are retained.
Merged/pushed as `4a404c4`. [Pages run 36724078133](https://github.com/boxwrench/waterscape/actions/runs/36724078133)
passed build and deployment. The public [Jenner scene](https://boxwrench.github.io/waterscape/river-pulse/renderer/jenner.html)
is live; Jenner page/module/water, Hacienda page/Map water and the Tidewater license match
the verified build by SHA-256. Focused Jenner tests (8), built assets and pinned-CI-browser
shoreline capture pass. See [RP10](../roadmap/tasks/RP10-publish-jenner.md). Separate reservoir
work remains untouched. The result-only docs commit skips CI after successful runtime deployment.

## Jenner estuary and Pacific shoreline — RP9

`task/RP9` in `/tmp/waterscape-rp2` adds a complete local coastal page at
`/river-pulse/renderer/jenner.html`, linked from Hacienda. Actual mouth/headlands photos
inform gray-brown sand, green estuary, teal Pacific surf, Goat Rock, green bluffs, driftwood
and inland woodland. Lookout, River shore and Pacific beach have bounded dry-ground cameras;
mobile has a shoreline-facing Pacific composition and Explore. The small MIT Tidewater
periodic-noise adaptation, original license and photo/resource credits are recorded in the
Jenner package. No full FFT engine or upstream third-party assets are imported.

The independent gauge card selects source USGS 11467270 / 63160 NAVD88 observations at
Highway 1, with 45-minute freshness, future-value exclusion and explicit missing/stale
records. The authored coast does not infer current mouth status, tide or local currents;
Hacienda discharge is not converted to estuary state. Data survives graphics failure.
See [scene notes](../../river-pulse/rivers/russian_river/scenes/end/jenner/README.md) and [task](../roadmap/tasks/RP9-jenner-estuary.md).

Verification is deliberately focused per the user: eight Jenner unit tests, built assets
and the Jenner browser smoke; desktop/mobile screenshots were inspected against references.
Software WebGL2 does not establish native GPU performance or WebGPU correctness. Existing
Hacienda/reservoir rendering is preserved; the independently dirty `task/H1` checkout is
untouched. Preview server port 5174 serves this isolated build. RP9 did not push/merge; the
user subsequently accepted this baseline and authorized publication in RP10.

## River Pulse publication — RP8

The user authorized committing/pushing accepted RP2–RP7 work, a prominent README link and
updated docs. `task/RP8` integrates current remote main (`1b44237`) into the isolated River
Pulse worktree, preserving published reservoir work and leaving the dirty `task/H1` checkout
untouched. Code/docs are pushed to main at `15648e2`, with timing correction `6dc6a48`.
Local unit (117), Python (26), shader/data/build checks and browser checks pass, including
the pinned CI Chromium. RP8’s Pages deployment was blocked: the first CI run timed out settling
width; after elapsed-time easing fixed that, the second run timed out saving `authored-shallows-desktop.png`
at browser-check line 208 (`page.screenshot: Timeout 30000ms exceeded.`), with page errors `[]`.
Build/deploy run [36672469191](https://github.com/boxwrench/waterscape/actions/runs/36672469191)
failed build and skipped deployment. The accepted visuals were not live at that point. Per AGENTS.md's
two-failure rule and the user's request to avoid more checks, no further rerun or CI bypass
was attempted. See [RP8](../roadmap/tasks/RP8-publish-river-pulse.md) for the result. Its docs-only
result commit skips CI to avoid another run; runtime code remains the locally verified build.
The River Pulse sections below record historical local milestones.

## Irregular blue Map water — RP7

RP7 refines Map surface detail after the user spotted regular stripes: varied advected noise
normals replace the periodic bands, with a bluer body and softer highlights. Three's flowing
water example is recorded in the resource library as a technique reference; existing vendored
TSL noise supplies the detail. No new asset downloads or vendor changes. RP6's width, border,
state and reduced-motion behavior, and the accepted authored beach remain unchanged. See
[surface refinement notes](../../river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/README.md#map-surface-refinement--rp7).

Unit tests (108), river validation, built assets and the complete River Pulse browser suite
pass. Desktop high/low flow and mobile renders were inspected. Work remains isolated in
`/tmp/waterscape-rp2` on `task/RP7`; preview port 5174. No push, merge or publication.

## Map water ribbon — RP6

`task/RP6` in `/tmp/waterscape-rp2` adds a continuous water-like Map ribbon with exaggerated
ripples and traveling highlights. Seasonal category colors its margins; selected discharge
widens/narrows it within the loaded history range. Zero/missing data stops motion; missing
history uses a disclosed fixed fallback scale. River toggle and reduced motion are intact.
The user's accepted Hacienda Beach/Bridge setting is unchanged. Read the
[Map binding notes](../../river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/README.md#map-flow-and-scientific-state--rp6) for
normalization and limitations: width/motion are symbolic, not measured banks or hydraulics.

Unit tests (108), river validation, built assets and the full browser suite pass. The earlier
RP5 browser failure was an asynchronous test-readiness race, now resolved by waiting for the
map/optical layers in setup. Desktop high/low-flow and mobile Map renders were inspected;
synthetic fixture discharge stays test-only. The updated preview was opened in Firefox on
port 5174. Native Chrome in the available user session could not create a graphics context;
software Chrome verification passes, but target hardware performance remains unmeasured.
No push, merge or publication; the active reservoir checkout remains separate.

## Hacienda authored scene — RP5

`task/RP5` in `/tmp/waterscape-rp2` replaces the misleading Gauge flyover with Bridge and
Hacienda Beach. Map retains source terrain and adds symbolic moving flow pulses when the
selected eligible discharge is positive. The photo-informed local setting has a gray steel
camelback, concrete approaches, continuous left-pier rock outcrop, gray pebble beach,
layered mixed woodland and greener, less transparent water. Shore walking stays bounded
at eye height. Local geometry is authored, not surveyed: coordinate/elevation labels and
the compass are Map-only. Timeline/scientific selection is independent of the static beach.
See [authored-scene notes](../../river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/README.md) for evidence, licenses and limits.
The user accepted this visual baseline after reviewing Firefox: "not perfect but
recognizable." Keep the current composition, gray steel/stone, left-pier outcrop and
greener water. Further visual polish is optional; technical verification remains open.
Historical RP5 verification stopped after its second failure (resolved in RP6): the data-outage check
reads `riverPulseMapFlow.mesh` before the asynchronous layer exists (line 265). The first
failure exposed a missing caption element, since repaired. Unit tests (104), river
validation and production build checks passed. RP6 subsequently passes the complete browser suite.
This remains an approximate reconstruction; reused tree meshes and planar optics still
limit photographic realism. The isolated preview is served on port 5174; nothing is pushed,
merged or published, and the active reservoir checkout remains separate.

## Hacienda bank materials — RP4

`task/RP4` integrates the selected local Poly Haven pebble and rock maps into Hacienda's
modeled bed and near-bank setting. A new Shoreline composition puts the camera at the
terrain-constrained water edge, with a shallow depth mapping, foreground pebbles, bank
rocks and grouped lightweight Douglas-fir meshes reused from the committed W2 biome.
The river's sourced terrain and scientific data selection remain unchanged. See
[authored-water notes](../../river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/README.md#rp4-bank-material-integration) for
asset provenance and visual assumptions. The bridge remains the subsequent authored
architecture task. This work is isolated from the active reservoir checkout and not published.

## Hacienda scene materials — RP3

The user selected Poly Haven **Ganges River Pebbles** for the beach/shallow bed and
**Rock Boulder Dry** for large exposed bank rocks. Source and CC0 links are saved in the
[resource library](../../resources/README.md#terrain-rocks--ground-materials). River Small Rocks
is an optional gravel variation. These are selected candidates, not downloaded/integrated
materials or a geological identification. Use a shared dry/wet pebble material and some
foreground pebble geometry in the next authored scene pass. The bridge, large rocks,
pebble beach and water-edge Shoreline camera remain the requested next scene work.
`task/RP3` builds on RP2; no push or merge.

## River Pulse authored water — RP2

`task/RP2` in `/tmp/waterscape-rp2` adds a first local optical water preview in Hacienda's
Gauge and new Shallows cameras. Valley remains cartographic. The preview uses the existing
terrain/mainstem assets, with disclosed illustrative surface/bed geometry, fine ripples,
Fresnel scene reflections, refracted procedural gravel and approximate caustic detail.
Read [authored-water notes](../../river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/README.md) for resource evaluation and limits.
No discharge-to-stage/velocity inference, corridor restoration or Jenner surface is included.
The unfinished W2 checkout was preserved. This branch is for review; it is not published.

## Live now

https://boxwrench.github.io/waterscape/ (GitHub Pages deploys on every push to `main`).

## Hetch Hetchy — 2026-10-03

H1: `data/hetch_hetchy/` with the new `sierra-granite` biome and O'Shaughnessy Dam. The dam,
its outlets and the river below are in `structures.json` (sources inside) and drawn by
`renderer/land/structures.js`; the build floods to the dam face, carves the survey's smeared
dam and the river channel, and writes a full-pool drawdown channel for the bleached band.
Granite is photographed CC0 rock (`renderer/land/granite.js`). Explorer viewpoint buttons now
wrap. Fifth stop on the Hetch Hetchy tour. Open: rock silhouettes stay smooth (10 m lidar); the canyon rock is
paler than photos; the aerial photo could colour the granite tops; Hetch Hetchy has CDEC
storage (`HTH`) for T1/T2.

## Aerial map inset — 2026-09-29

Each reservoir has `aerial.jpg` (USGS NAIP Plus, public domain, fetched by `pipeline/aerial.py`
over exactly the terrain grid; source URL in `aerial.json`). `renderer/minimap.js` shows it with
the camera marked in the explorer's elevation panel and beside the journey's stop list
(following the flyover video or the live camera; hidden on phones). The photographs show
suburbs east of Crystal Springs that the 3D scene draws as woodland. That is deliberate for
now: scenes leave out man-made features. When they are added, the order is dams first, then
adits and outlet structures, and roads and other buildings last, if at all (see ROADMAP).

## Crystal Springs — 2026-09-29

W1 (`pipeline/locate.py`) and W2 are done: Crystal Springs (both upper and lower lakes, via
`extraAnchors`) with a new `peninsula-oak-fir` biome. `land.json` now drives a water body's
look: summer grass palette, tree cover, species weights and stands, fog (with overcast for
the Morning preset) and water optics (`renderer/engine/look.js`, light buffer L[6]–L[11]).
Crystal Springs defaults to spring green, has a foggy overcast Morning and greener water.
W3 adds San Andreas Lake with the same look; W4 puts both on the Hetch Hetchy tour (four stops). Flyovers here were rendered with headless Chrome (no Edge on the
build machine). See [W2](../roadmap/tasks/W2-crystal-springs.md).

## Shoreline contact — 2026-09-29

B1 replaced the straight, grid-aligned waterline with an organic edge. Within ~8 m of the
shoreline `water.cu` models the bank itself and shows water where the surface stands above
it; a slow ebb (scaled by wave energy) moves the edge, and a damp band trails it. Illustrative
binding, recorded in [Making Water Visible](../making-water-visible.md). Flyovers were not
re-recorded (they fly too high for the change to show). See
[B1](../roadmap/tasks/B1-shoreline-contact.md).

## README imagery — 2026-09-29

R3 refreshed the README with actual Calaveras North ridge and Shoreline screenshots,
in that order. Both are 1440x900, captured at high quality with golden-hour light and
summer-gold season. Controls are hidden; the renderer and authored viewpoints are unchanged.
See [R3](../roadmap/tasks/R3-readme-images.md).

## Repository cleanup — 2026-09-29

PR #3's resource library is merged at `d94595c`; its CI and the local merged build passed.
Superseded River Pulse PRs #1 and #2 are closed. Only remote `main` remains; the old
branch heads are preserved as `archive/river-pulse-bootstrap-2026-09-29` (`4a4f04c`)
and `archive/river-pulse-ui-2026-09-29` (`1f7acf9`). The bootstrap archive includes
additional corridor-water prototype commits that were **not** integrated into R1.
They remain available for a separate task; the published interface retains R1's behavior.
R2's Full controls links are deployed at `934a511`.
Cleanup-record Pages workflow `36629221268` passed build and deploy. The earlier
resource-library merge deployment was superseded by this successful run.

## R1 publication verified — 2026-09-29

Implementation and local verification are complete at `58674ce`; publication commit
`13a83e2` is live. [Pages run 36626334290](https://github.com/boxwrench/waterscape/actions/runs/36626334290)
passed both build and deploy jobs. On resuming, all 13 assets checked by
`/tmp/waterscape-r1-live-assets.mjs 13a83e2` matched the verified local build byte-for-byte,
including reservoir controls, grass, water shader, both flyovers and River Pulse interface,
terrain and hydrography. R1 is complete. Windows Chrome/Edge performance remains unmeasured;
see the R1 Result for the local checks and limitations.

## R1 umbrella integration — 2026-09-29

The user explicitly authorized merging and pushing the combined work, overriding the default
agent rule for this task. Remote main's [Making Water Visible](../making-water-visible.md)
principles and the supplied `river-pulse/bootstrap` history are integrated with G2 and P2.

- **One repo/build:** existing reservoir URLs remain; `/river-pulse/` opens Hacienda.
  Navigation joins the experiences. River-specific adapters/state/visual bindings/data stay
  in `river-pulse/`; root vendor, camera/projection utilities, pipeline and scripts are shared.
  The completed `task/river-pulse-ui` controls and scientific-selection fixes are also
  included following the request to publish the latest interface.
- **River Pulse is a prototype:** real Hacienda terrain, discharge/history and seasonal
  context. Jenner is a place manifest and water-level adapter contract, not a 3D scene.
  Current/forecast capabilities do not promise current availability. River water/current
  simulation is not built, and reservoir water must not be presented as river hydrodynamics.
- **Deployment:** Hacienda's sourced 3DEP terrain and 3DHP centerlines are committed. Build validates river
  packages and includes all timeline/seasonal modules and styles. CI runs Python tests,
  registry freshness, built-page checks and River Pulse browser interaction checks as well
  as the existing reservoir checks.
- **G2 accepted:** Codrops-style grass clumps with texture cutouts, chunk culling and distance
  LOD. MIT texture and licence are included. Spring and gold use the existing season control.
- **P2:** defer sky/terrain shading that water overwrites. Three deterministic comparison
  views matched byte-for-byte; measured GPU pass work fell 14–16% on local Firefox. This is
  not a Windows FPS measurement. Windows Chrome/Edge remain the target; no Firefox workaround
  was added. See [P2](../roadmap/tasks/P2-render-cost.md).

The older sections below retain historical context. R1 supersedes their single-experience
scope; G2 supersedes G1's blade counts. See [R1](../roadmap/tasks/R1-waterscape-umbrella.md) for
the final publication result and checks.

- **Front page** (`index.html`, `site/journey.js`): WebGPU browsers open straight into live 3D
  at each reservoir's **Shoreline** viewpoint; the flyover keeps playing until the first
  live-frame report. "Back to video" is remembered for later stops. The embedded 3D hides
  the control panel.
- **Explorer** (`renderer/explore.html`): full controls, opens at Shoreline too. Toggles for
  **3D trees** and **Grass**; auto quality low/medium/high (NVIDIA starts high, others medium).
- **Land (L1 + L2):** CC0 photo ground materials, wind grass, baked ez-tree oak meshes near
  the camera (40/100/200 m by tier), photographed impostor cards beyond (250/900/1500 m),
  procedural shader crowns past that. Lighting presets Morning/Midday/Golden, gold-summer
  season by default.
- **Flyover videos and posters** (`data/<id>/flyover.mp4`, `poster.jpg`) were re-recorded with
  the new land via `npm run flyover -- <id>`.

## P1 deployed

Merged and deployed at the user's request as `ab96848`. P1 keeps video playing until the
first live frame, reports that frame immediately,
loads only far trees on low, and loads full detail after the first frame on medium/high.
Detail failures retain far meshes. Next-video prefetch is deferred to video-only playback;
both return-to-video controls preserve that preference across stops.

`npm test` and `npm run build` pass. `node scripts/measure-startup.mjs` records local Edge
startup and completed resource body bytes, including iframe resources. Single before/after
samples: cold low 16.1 → 14.6 s, next stop 15.6 → 14.2 s; cold resource bodies 26.8 → 15.8 MB.
Tree geometry is 9,815,328 → 1,226,464 bytes (12 → 6 requests). These are local observations,
not wire-transfer totals or a production network benchmark. Engine initialization still
takes about 13 s; P1b proposes profiling this before changing the renderer lifecycle.

## Current direction and D1

The user explicitly prefers close shallow water as the central visual: visible bed,
caustics, ripples and deeper water beyond. Real reservoir data supplies the meaning.
Keep the existing opening cameras; do not prioritize tree-heavy compositions, grass,
shadows or Ultra over water/data/startup work.

D1 is deployed (shipped with G1 in `9489555`, at the user's request; D1 itself was not
separately reviewed): compact source-linked supply and capacity, expandable
reservoir/scene details, acquisition-year labeling for the sampled USGS point, and a clear
distinction between terrain data and modeled bed/waves. Sources were re-fetched; no
current storage claim is added. See [task](../roadmap/tasks/D1-reservoir-context.md).

## G1 deployed (grass)

`9489555`, deployed at the user's request. The grass field is now tufts of 5 splayed blades
(4 / 10 / 14 tufts per m² on low / medium / high), clumped into patches by a slow noise, with
wider blades and a lighter root shadow. Only `renderer/land/grass.js` changed. Green and gold are
the existing Season control (gold default). A "stylized" Breath-of-the-Wild-like option was
tried and removed at the user's request. See [task](../roadmap/tasks/G1-tufted-grass.md).

**Open, deferred as polish:** `node scripts/verify.mjs` fails its low-tier frame-time check
(`low tier median … ms > 33 ms at 768 px`; 52–70 ms on an integrated Intel GPU). It also fails on
the pre-G1 code, so it is not caused by G1, but medium/high now draw more blades: re-measure on
the target hardware and tune `GRASS_TIERS`. CI does not run `verify.mjs`, so it did not block the
deploy, and `verify-site.mjs` did not run behind it.

## Known issues

- **Shadows don't match the 3D trees.** Ground shadows are soft analytic blobs from the old
  procedural crowns. Fix is L2b (sun shadow map).
- **Far-water reflections can look speckled.** Preserve the shallow-water foreground when
  refining them. The water-dominant opening composition is intentional, not a defect.
- **Intel integrated graphics:** low tier is ~27 ms at the overlook but ~37 ms at the shoreline
  (the water fills the frame; grass + trees only add ~2 ms). `scripts/verify.mjs` times the
  33 ms low-tier budget at the overlook on purpose. Frame times on the dev laptop drift a few
  ms day to day with machine load.
- **Tree geometry is 9.8 MB** (`data/biomes/diablo-oak/trees/*.bin` float32), including
  1.2 MB of far meshes. P1 stages geometry loading; compact encoding remains a follow-up.
- User verdict on L2 visuals: "just ok". Grass still reads sparse/pixelated (L1b).

## Next up (user's interest, roughly in order)

1. **D1 reservoir context** — compact information around the current water experience.
2. **P1b startup profiling** — keep GitHub Pages and the per-stop iframe until measurements
   support a different initialization/reuse design.
3. **W1/W2 and T1/T2** — add Crystal Springs using the shared biome, then show sourced storage
   history. Do not conflate storage with a measured water elevation; reconstruction is T3.
4. **Water polish and further reservoirs** — landscape detail and U1 Ultra remain secondary.

## How to work on it

- Read `AGENTS.md` first. `npm test` runs everything (needs Microsoft Edge; ~5–10 min, opens
  real browser windows). `npm run test:site` is the front-page subset.
- Work on a `task/<id>` branch and commit results. Agents never merge or push (AGENTS.md).
  A human reviews, merges and publishes; Pages deploys after a push to `main`.
- Testing is intentionally light on this side project: one full `npm test` before merging.
  Judge visual changes by flying close in the explorer, not from far screenshots.
- Chromium (Chrome/Edge) is the only target for live 3D; others get the video.
- Key files for land work: `renderer/land/` (`scene.js`, `ground.js`, `grass.js`, `trees.js`,
  `impostors.js`, `oak-placement.js`, `pack.js`), `renderer/water.cu` (`render_water`,
  `terrainShade`, `bake_light`), `data/biomes/diablo-oak/biome.json`, and the offline tree bake
  `pipeline/bake-trees.mjs` + `bake-trees.html`.
- After changing how land looks, re-record the front-page videos:
  `npm run flyover -- calaveras` and `npm run flyover -- san_antonio` (needs ffmpeg).
