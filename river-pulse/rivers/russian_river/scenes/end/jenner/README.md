# Jenner estuary and Pacific shoreline — RP9

<!-- scene-card: generated from scene.json; edit scene.json, then run node scripts/sync-river-readmes.mjs -->
> **Scene card**
>
> | | |
> |---|---|
> | River / slot | `russian_river` / `end` |
> | Place id | `jenner` |
> | Fidelity | Authored setting |
> | Data | live gauge |
> | Views | Estuary lookout, River shore, Pacific beach |
> | Open locally | <http://localhost:5173/river-pulse/rivers/russian_river/scenes/end/jenner/index.html> |
> | Layout | page `index.html`, scene code beside it, sourced data in `data/`, notes in `notes/` |
<!-- /scene-card -->


Open `river-pulse/renderer/jenner.html` from a built local server. The Hacienda header also
links to Jenner. The user accepted this as a good starting point and authorized publication
in RP10. The public entry is [Jenner estuary](https://boxwrench.github.io/waterscape/river-pulse/renderer/jenner.html);
see [RP10](../../../../../../docs/roadmap/tasks/RP10-publish-jenner.md) for publication verification.

## Photographic composition

Two actual photographs were fetched and inspected: [Xaven's Russian River mouth](https://commons.wikimedia.org/wiki/File:Russian_River_mouth_on_California_coast.jpeg)
(CC BY-SA 1.0) and [BookOfDisquiet's Jenner Headlands](https://commons.wikimedia.org/wiki/File:Wildlands_Jenner_Headlands_Russian_River.jpg)
(CC BY-SA 4.0). They inform the long gray-brown spit, muted green estuary, teal Pacific,
white shore surf, grass-covered bluffs, weathered Goat Rock silhouette, driftwood and inland
woodland groups. Reference photos are not redistributed. The palette, credits, resource pin
and asset manifests are in the package's `setting/references.json`.

Estuary lookout frames river, spit and Pacific together. River shore starts at the dry water
edge; Pacific beach looks along the surf toward Goat Rock. Drag to look, scroll or focused
WASD/arrow keys to walk. Each view has local bounds, rejects underwater moves and maintains
1.8 m eye height. Explore hides the title/gauge card; Inspect retains source evidence.
Pause water freezes its phase and the wind/wet-band clock; reduced motion freezes them by
default. Mobile keeps all three views and the evidence drawer.

## Rendering and resources

The coast is an authored height field shared by land and displaced water on a 6 m grid.
Its local x/east, z/south, y/up coordinates do not correspond to the manifest's survey/USGS
anchor. No new DEM, surveyed bank, real bathymetry or georeferenced infrastructure is claimed.
The fixed open-mouth composition is a **Setting**, and is not today's observed mouth status.
[Sonoma Water](https://www.sonomawater.org/russian-river-estuary) describes a barrier beach
that can close the mouth; this scene does not infer closure from a water-level record.

Water uses four directional authored swells, shallow-depth attenuation, an alongshore-warped
breaker crest, noisy foam rafts with smaller holes, swash and a darkened wet shore. Color and
clarity contrast calm green estuary water with teal Pacific surf. Fresnel, planar reflections,
modeled shallow bed transmission and specular light consume these authored surfaces. They
are optical calculations over illustrative inputs, not measured currents, tide, wind, wave
height, water quality, sediment transport or ocean exchange. No estuary discharge conversion
or shoreline animation is driven by the gauge.

The resource library's [Tidewater](https://github.com/dgreenheck/tidewater) was evaluated at
`4811ba48d795197de5621985f404e765c0b7c0ef`. Its `SeaDetail.js` periodic gradient-FBm texture
generator is adapted into a deterministic RGBA byte Three DataTexture in `jenner-noise.js`.
The full upstream MIT notice is shipped in `setting/LICENSE-tidewater` and acknowledged in
`THIRD_PARTY_NOTICES.md`. Its depth-aware surf and foam techniques were studied; Jenner's
swell/foam TSL is independently authored. This does **not** import Tidewater's FFT engine,
WebGPU framework, island geometry, audio or third-party assets.

Existing local resources supply CC0 Poly Haven rock/pebble maps, CC0 ambientCG Grass004,
MIT FluffyGrass mask and MIT ez-tree broadleaf meshes/textures. Their existing manifests and
licenses remain authoritative. Grass clumps, clustered trees, bleached logs and shore stones
are plausible Setting details, not mapped individual plants or a species inventory. Texture
or vegetation loading failure retains a simpler coastal scene.

## Scientific state

Jenner loads through the same registry/place mechanism as Hacienda. The existing adapter
fetches latest-continuous parameter **63160** for **USGS-11467270**. Eligible observations must
be in ft, at this feature, with NAVD88 datum and observation evidence. Latest-at-or-before
selection prohibits future records and applies a 45-minute age limit. Stale records stay in
the evidence drawer and show **Unavailable / Stale** on the current card; missing values do
not fall back to older present values. Source flags, valid time, retrieval time, normalized
quantity and selection policy remain inspectable. The station is at Highway 1 Bridge,
upstream of the pictured mouth. The gauge card is an **Exact** quantity presentation.

Data starts independently of the graphics pipeline, refreshes once a minute when visible,
and remains usable after GPU failure. Network failure displays unavailable evidence and a
link to the USGS source. No synthetic observations ship in the package.

## Focused verification

`node --test pipeline/tests/jenner.test.mjs` checks eligibility, stale/missing/future evidence
and bounded dry camera positions. `npm run test:build` checks deployable assets and packages.
`node scripts/verify-jenner.mjs` uses synthetic test-only USGS interception and software
WebGL2 to exercise three views, animation/pause/reduced motion, desktop/mobile, data outage
and GPU failure. Screenshots are local QA artifacts, not observation records. Use
`RIVER_PULSE_BROWSER=/path/to/chromium` to select an installed browser. Hardware performance
and the WebGPU backend are not established by software WebGL2 checks.
