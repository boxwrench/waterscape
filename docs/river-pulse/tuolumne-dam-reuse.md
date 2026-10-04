# Tuolumne dam reuse

The Tuolumne scene reuses the Hetch Hetchy O’Shaughnessy Dam record and the shared
`renderer/land/structures.js` geometry and concrete texture. Its original crest UTM
coordinates, crest elevation, NID height/type/length, source URLs, and source notes remain
unchanged in `data/hetch_hetchy/structures.json`. The renderer translates the crest directly
from EPSG:32611 into the Poopenaut terrain frame. The crest falls at about x=3490–3621 m,
z=−2055 to −1836 m, inside the native DEM. Both datasets use NAVD88 metres; the dam top uses
the river terrain’s absolute vertical offset (zero in this bundle), not the reservoir’s
1151.7 m water level.

The reused gravity profile is a generic interpretation of a gravity dam, not an as-built
section. Its concrete material retains the existing weathering, joints, and staining treatment.
The source record’s outlet locations remain metadata, but this scene draws no outlet jets or
river ribbon. It imports no reservoir terrain edits, bathymetry, water level, or reservoir
water surface. The authored contact adjustment follows the bounded clearance principle in
`pipeline/dem.py:carve_dams`: when the dam is shown, it lowers only nearby render-mesh vertices
where the native DEM pierced the face. It does not alter the source elevation cells. The dam
comparison toggle restores the original native mesh when the dam is off; aerial mode also uses
that native mesh. The local cut is an authored display adjustment, not a new terrain source.

The original five `poopenaut-runtime-v3` review cameras remain. A separate
`oshaughnessy-dam-reuse-v1` camera provides a close view aimed at the crest; both camera sets
are authored compositions, not surveyed access points or matched photographs. The renderer
chooses the profile’s dry side using a signed projection toward the source-mapped downstream
river reference. This is a side-selection aid, not a shoreline-distance or water-level model.

At 980×820 WebGPU, DPR about 1, the original RP21 baseline measured 788,995 triangles,
3 draw calls, 21.11 MiB geometry, and 8 MiB estimated textures. With the dam visible, the
scene measured 790,251 triangles, 4 calls, 25.69 MiB geometry, and 13.33 MiB estimated
textures: +1,256 triangles, one call, 4.58 MiB geometry, and 5.33 MiB texture estimate.
The native baseline in the same loaded page was 788,995 / 3 / 25.69 MiB / 13.33 MiB because
dam assets remain resident while hidden. Warm first frame was 272 ms. These are scene
accounting figures, not GPU timing, FPS, or full browser-memory comparisons.

The six desktop and six phone views have been visually reviewed. The dam reads in the close composition; coarse DEM
terrain and bank contact remain visible at close range, and the surroundings are bare. Plain Form, native Source aerial, dam/guide toggles, Evidence open/close and the
featured state map were exercised. Final phone framing widens the close camera to
84° so the full crest fits; 44 px camera buttons and 390 px document width were
verified. The review panel clears the footer label. Browser errors are empty.
No animation or moving water is introduced. This pass is ready for human review,
not final acceptance.

[Actual before/after gallery](../../previews/tuolumne/rp22/review.html) preserves
native and reused-dam close/transition comparisons, original five views, plain
form/source presentations and phone evidence. The shared renderer defaults retain
reservoir jets and shaded packing tags; only the river adapter opts out. Five
focused Node checks pass, the source validator and river package checks pass,
and the full build validates 117 browser modules.
