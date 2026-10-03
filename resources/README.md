# Waterscape resource library

A working notebook of web graphics, simulation, rendering, data-visualization and visual-development resources that may be useful to Waterscape.

This is primarily a practical memory aid for the project: what a resource is, why it was saved, whether Waterscape already uses it, what visual value it offers for its likely runtime cost, and what its upstream licence allows. It is public so other people can follow the same references.

## How this catalog is organized

This is intentionally a **potential-resource library**, not a shortlist. Multiple approaches to the same problem are useful because Waterscape may want a cheap illustrative effect in one scene and a more expensive high-end treatment in another.

Resources are grouped by their primary use:

- [Water surfaces, fluids & caustics](#water-surfaces-fluids--caustics)
- [Rivers, currents & coastal flow](#rivers-currents--coastal-flow)
- [Terrain, rocks & ground materials](#terrain-rocks--ground-materials)
- [Vegetation, trees & wind](#vegetation-trees--wind)
- [Atmosphere, weather & volumetrics](#atmosphere-weather--volumetrics)
- [Lighting & high-end rendering](#lighting--high-end-rendering)
- [WebGPU & rendering architecture](#webgpu--rendering-architecture)
- [Data storytelling & interaction](#data-storytelling--interaction)
- [Workflows & visual development](#workflows--visual-development)

`Status` uses four loose labels: **Used** means Waterscape already relies on it; **Candidate** is something worth trying; **Foundational** is an older or general technique still worth retaining because the idea remains useful; **Reference** is primarily something to study rather than import directly.

`Visual / cost` is deliberately qualitative (`low`, `medium`, `high`). It is an architectural estimate for comparison, **not a benchmark**. If Waterscape evaluates a resource directly, replace the estimate with measured notes.

For candidates and references, the description should also say **how Waterscape could use the idea**. The goal is not only to remember that a project exists, but to make future retrieval actionable.

Where an upstream repository README already contains a useful representative image, the catalog can show a small **Preview** thumbnail in the table. These are hot-linked to the upstream image rather than copied into Waterscape; they are only a browsing aid and remain subject to the upstream project's availability and terms.

Older work is not excluded merely for being old. Keep it when it still teaches a distinct technique, offers unusually good quality per millisecond, or explains an idea that current implementations still use. Do not keep obsolete near-duplicates when a current resource clearly supersedes them without losing anything useful.

## Licence rule

**Every resource keeps its original upstream licence.** Listing something here does not relicense it under Waterscape's MIT licence and does not imply that it is safe to copy into this repository. Check the linked upstream licence before reuse.

The licence/status column is a quick working note, not legal advice. `Reference only` means the source is useful to study or remember, but this catalog has not established permission to copy its implementation or assets. Licence status below was checked on **2026-10-02**.

For redistribution details and pinned snapshots of code/assets actually included in Waterscape, see [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

## Water surfaces, fluids & caustics

| Resource | Preview | Status | Why it matters | Visual / cost | Upstream licence / reuse |
|---|---|---|---|---|---|
| [Clearwater](https://github.com/Aureliengmz/clearwater) · [demo](https://aureliengmz.github.io/clearwater/) | <img src="https://raw.githubusercontent.com/Aureliengmz/clearwater/main/media/landscape.png" width="160" alt="Clearwater shallow-water scene"> | **Used** | Aurélien / Lumaris's single-file WebGL2 shallow-water renderer: FFT waves, refraction and caustics. Primary visual/optical reference for Waterscape reservoir water. | **High / medium** | **MIT** |
| [SamG-Coder/clearwater](https://github.com/SamG-Coder/clearwater) · [demo](https://samg-coder.github.io/clearwater/) | <img src="https://raw.githubusercontent.com/SamG-Coder/clearwater/main/previews/clearwater-ui.png" width="160" alt="Clearwater CUDA ocean preview"> | **Used** | CUDA/WebGPU reimplementation and extension of Clearwater; bridge to the CUDA-authored/WebGPU renderer used by Waterscape. | **High / medium** | **MIT** |
| [Three.js Particle Fluids](https://github.com/dgreenheck/threejs-particle-fluids) · [demo](https://dgreenheck.github.io/threejs-particle-fluids/) | <img src="https://raw.githubusercontent.com/dgreenheck/threejs-particle-fluids/main/public/previews/cover.png" width="160" alt="Three.js Particle Fluids wave chamber"> | **Candidate** | GPU particle physics for Three.js/WebGPU: liquids, soft bodies, cloth and smoke, with fluid surface rendering and useful splash/runoff demos. **Waterscape use:** local splashes, spray, runoff or interactive secondary water effects rather than large-scale hydrodynamics. | **High / medium-high** | **MIT** |
| [dli/fluid](https://github.com/dli/fluid) · [demo](http://david.li/fluid) | — | **Foundational** | GPU PIC/FLIP particle-based 3D fluid simulation with particle rendering. The copy on emmelleppi's profile is a fork, so this entry points to the canonical upstream. **Waterscape use:** localized high-energy fluid volumes, splash experiments, and a different solver family to compare with current PBF resources; not a primary river/reservoir solver. | **High / high** | **MIT** |
| [Tidewater](https://github.com/dgreenheck/tidewater) · [demo](https://dgreenheck.github.io/tidewater/) | <img src="https://raw.githubusercontent.com/dgreenheck/tidewater/main/docs/screenshot-beach.jpg" width="160" alt="Tidewater beach and shoreline"> | **Used / Candidate** | Full WebGPU ocean/island reference with four-cascade FFT water, depth-aware breaking waves, whitewater, spray, foam lace, shallow-water swash on sand, wakes, caustics, underwater/above-water transitions and refraction. **Waterscape use:** shoreline contact, surf/foam behavior and higher-end coastal scenes. | **Very high / high** | **MIT** code; third-party assets retain their own licences as documented upstream |
| [Reality.js — the shoreline](https://github.com/aiimpl/reality-js) · [demo](https://aiimpl.github.io/reality-js/) | — | **Candidate** | Shader-built shoreline with swell, breaking whitewater, run-up, drain-back, foam lace, wet-sand film and sun glints. **Waterscape use:** study its shared sand/water height logic and run-up cycle for believable reservoir or coastal water contact without needing a full fluid simulation. | **Very high / medium-high** | **MIT** |
| [caustic-volume](https://github.com/ScottieFox/caustic-volume) · [demo](https://scottiefox.github.io/caustic-volume/) | <img src="https://raw.githubusercontent.com/ScottieFox/caustic-volume/main/docs/lite.jpg" width="160" alt="CAUSTIC LITE water and caustics"> | **Candidate** | Focused browser reference for moving water caustics, with lightweight and fuller sandbox approaches. **Waterscape use:** improve shallow-water readability and choose between a cheap caustic treatment and a much richer GPU treatment. | **High / low-medium** | **MIT** |
| [Three.js flowing water / Water2Mesh](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Water2Mesh.js) | — | **Reference — Map RP7** | Advected surface normals with Fresnel reflection/refraction. Useful lightweight water-detail approach for a ribbon. RP7 uses existing vendored TSL noise for irregular surface detail, with no copied example code or normal-map assets. | **Medium-high / low-medium** (estimate; target GPU unmeasured) | **[MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE)** code; separately verify texture provenance before importing example assets |
| [Codrops RainEffect](https://github.com/codrops/RainEffect) · [demo](https://tympanus.net/Development/RainEffect/) | — | **Candidate** | Screen-space/WebGL rain and water-drop effects. **Waterscape use:** inexpensive rain/wet-camera layer for weather scenes without adding fluid simulation. | **Medium-high / low-medium** | **Codrops custom licence**: integration/build-upon allowed for personal or commercial projects; do not redistribute or sell as-is. Verify current upstream terms before use. |

Hacienda authored-water evaluation (RP2): [implementation and resource notes](../docs/river-pulse/authored-water.md).
The first local pass reuses existing Three/TSL reflection machinery and uses multi-directional
wave detail informed by the CAUSTIC//VOLUME explanation. Clearwater and Tidewater remain
optical/full-system references; no new upstream code or assets were copied in RP2.

Jenner coastal evaluation (RP9): [scene and resource notes](../docs/river-pulse/jenner-scene.md).
The periodic noise generator from Tidewater’s `SeaDetail.js` is adapted under MIT at pinned
revision `4811ba48d795197de5621985f404e765c0b7c0ef`; the license ships in the Jenner package.
Its surf/foam techniques informed independently authored TSL. The full FFT engine remains a
candidate; none of Tidewater’s third-party assets are imported. Existing CC0 rock/pebble/grass
and MIT vegetation resources are reused.

## Rivers, currents & coastal flow

| Resource | Status | Why it matters | Visual / cost | Upstream licence / reuse |
|---|---|---|---|---|
| [Currents in HDRP's Water System](https://anisb.github.io/2026/09/26/currents-in-hdrps-water-system/) | **Reference** | Useful visual/technical reference for current maps, foam and directional flow. Especially relevant to River Pulse even though Waterscape is not a Unity project. | **High / varies** | **Reference only** — no reusable-code licence established here |
| [Shiomachi](https://github.com/aiimpl/shiomachi) · [demo](https://aiimpl.github.io/shiomachi/) | **Candidate** | Three.js inland-sea sailing scene with Gerstner wind waves and swell, GPU iWave wakes, 12.4-hour tides, fast tidal channels, tide lines, wind bands, reflection and atmospheric haze. **Waterscape use:** borrow the visual vocabulary for currents—dark wind bands, tide seams and wake interaction—and study the shared JS/GLSL wave formulation for lightweight moving-water scenes. | **High / medium-high** | **MIT** |
| [Sakura-kudari](https://github.com/aiimpl/sakura-kudari) · [demo](https://aiimpl.github.io/sakura-kudari/) | **Reference** | Code-generated river journey with terrain, grass, trees, water, people, weather and procedural sound in a compact Three.js application. **Waterscape use:** River Pulse reference for making a river corridor feel inhabited and atmospheric without a large external asset pipeline. | **High / medium** | **Reference only** — no project-level licence detected; bundled third-party components retain their own licences |
| [Funaikusa](https://github.com/aiimpl/funaikusa) · [demo](https://aiimpl.github.io/funaikusa/) | **Candidate** | Extends the Shiomachi sea/tide/island system with many vessels, multiple wakes, impact ripples, spray, fast currents, smoke/fire and heavy instancing. **Waterscape use:** stress-case reference for layering many localized water disturbances and dense effects while keeping draw counts controlled. | **High / medium-high** | **MIT** |
| [hajimetwi3-prompt-okiba](https://github.com/hajimetwi3/hajimetwi3-prompt-okiba) | **Candidate** | Includes real-time coastal and tsunami-inundation prompt/demos; useful both as scene references and as examples of rapidly exploring flow visualization. | **Varies / varies** | **MIT** |

## Terrain, rocks & ground materials

| Resource | Status | Why it matters | Visual / cost | Upstream licence / reuse |
|---|---|---|---|---|
| [ambientCG](https://ambientcg.com/) | **Used** | PBR ground materials; Waterscape uses these in the `diablo-oak` biome. | **High / low-medium** | **CC0 1.0** |
| [Ganges River Pebbles](https://polyhaven.com/a/ganges_river_pebbles) | **Used — Hacienda RP4/RP5** | Rounded mixed stones and grit for the pebble beach and shallow underwater bed. Use one material across the dry/wet transition, with a few foreground pebble meshes. Locally bundled color, normal and roughness maps; RP5 grades the albedo toward the gray reference beach. Selection is visual, not an identification of Hacienda geology. | **High / low-medium** (cost estimate; hardware performance not measured) | **[CC0](https://polyhaven.com/license)**; color, normal, roughness, AO and displacement available |
| [Rock Boulder Dry](https://polyhaven.com/a/rock_boulder_dry) | **Used — Hacienda RP4/RP5** | Weathered sandy-gray surface for large exposed bank rocks; authored rock meshes supply the silhouette. Locally bundled color, normal and roughness maps; RP5 uses triplanar sampling on the continuous left-pier outcrop. | **High / low-medium** (cost estimate; hardware performance not measured) | **[CC0](https://polyhaven.com/license)**; color, normal, roughness, AO and displacement available |
| [River Small Rocks](https://polyhaven.com/a/river_small_rocks) | **Candidate** | Optional rougher gravel variation around exposed bank rocks. Keep Ganges River Pebbles as the main beach/bed material. | **High / low-medium** (estimate; not integrated or measured) | **[CC0](https://polyhaven.com/license)** |
| [Hai no Michi](https://github.com/aiimpl/hai-no-michi) · [demo](https://aiimpl.github.io/hai-no-michi/) | **Candidate** | Procedural/eroded caldera terrain with crater lake, shoreline roads, baked ground detail and 12 km far terrain. **Waterscape use:** reference for offline terrain generation, erosion, road/shore integration and keeping a large landscape visually rich while the browser receives mostly baked data. | **High / medium** | **MIT** |
| [100K Procedural Rocks](https://codepen.io/the-red-reddington/full/EayLxYZ) · [GitHub mirror](https://github.com/red-reddington/web-demos/tree/main/threejs-procedural-rocks-100k) | **Candidate** | Procedural rock generation plus instancing/LOD aimed at very large populations. Potential fit for shoreline boulders and terrain detail without a large authored asset library. | **High / low-medium for density** | Upstream README carries an **MIT badge**, but GitHub does not currently detect a standard licence file; verify before copying code. |

## Vegetation, trees & wind

| Resource | Preview | Status | Why it matters | Visual / cost | Upstream licence / reuse |
|---|---|---|---|---|---|
| [FluffyGrass](https://github.com/thebenezer/FluffyGrass) · [tutorial](https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/) | — | **Used** | Splayed-card grass technique and mask texture; basis/reference for Waterscape's clumped grass cards. | **High / low-medium** | **MIT** for the repository; see upstream/tutorial terms for tutorial text |
| [ez-tree](https://github.com/dgreenheck/ez-tree) · [demo](https://www.eztree.dev/) | <img src="https://github.com/user-attachments/assets/cb5f5edd-3e1b-453d-925f-734965126b17" width="160" alt="EZ-Tree procedural trees"> | **Used** | Procedural Three.js tree generator. Waterscape already bakes ez-tree oak geometry for its current landscape pipeline. | **High / offline generation + runtime LOD dependent** | **MIT** |
| [Procedural instanced forest](https://codepen.io/the-red-reddington/full/JoXxmzY) · [GitHub mirror](https://github.com/red-reddington/web-demos/tree/main/threejs-procedural-forest) | — | **Candidate** | High-performance instanced trees, procedural variation and LOD-oriented forest rendering. Useful as a runtime-population reference alongside Waterscape's baked trees/impostors. | **High / low-medium for density** | Upstream README carries an **MIT badge**, but GitHub does not currently detect a standard licence file; verify before copying code. |
| [SeedThree](https://github.com/SkyeShark/SeedThree) | <img src="https://raw.githubusercontent.com/SkyeShark/SeedThree/main/docs/media/hero_temperate.png" width="160" alt="SeedThree procedural White Oak"> | **Candidate** | Current Three.js/WebGPU procedural tree and plant generator with a modern species/LOD direction. Useful as a comparison to ez-tree rather than an automatic replacement. | **High / medium, LOD dependent** | **MIT** |
| [Inkwell WebGPU Trees](https://github.com/siliconjungle/inkwell-webgpu-trees) | <img src="https://raw.githubusercontent.com/siliconjungle/inkwell-webgpu-trees/main/docs/screenshots/highland-pine-moonlit.png" width="160" alt="Inkwell WebGPU highland pine"> | **Candidate** | Procedural forest/WebGPU tree lab with useful emphasis on dense forests, horizon populations and performance/memory measurement. | **High / medium, architecture dependent** | **MIT** |
| [Fluffy Tree — Anime Style](https://discourse.threejs.org/t/fluffy-tree-anime-style/86626) · [code](https://github.com/leoawen/fluffytree-threejs) | <img src="https://raw.githubusercontent.com/leoawen/fluffytree-threejs/main/images/fluffy-tree-screenshot.png" width="160" alt="Fluffy Tree anime-style canopy"> | **Candidate** | Newer canopy-cluster/tuft treatment with grass, wind and shadow ideas. The stylized look is optional; the canopy construction technique is reusable. | **Medium-high / low-medium** | **MIT** |
| [Creating fluffy trees with Three.js](https://douges.dev/blog/threejs-trees-1) | — | **Foundational** | 2022 explanation of view-space foliage deformation/billboard-like canopy cards. Keep for the technique even though newer implementations exist. | **Medium-high / low** | **Reference only** for article/code snippets unless upstream terms establish otherwise |
| [GPU Gems 3: GPU-Generated Procedural Wind Animations for Trees](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-6-gpu-generated-procedural-wind-animations-trees) | — | **Foundational** | Vertex-shader wind, instancing and **simulation LOD**: distant trees can use simpler trunk motion while nearby trees add branch motion. Old, but the quality-per-compute principle remains highly relevant. | **High / low** | **Reference only** — NVIDIA publication; do not treat chapter text/code as Waterscape-licensed material |
| [Hai no Michi forest/LOD system](https://github.com/aiimpl/hai-no-michi) | — | **Candidate** | Four conifer species in two geometry LODs plus octahedral impostors (8×8 view directions) beyond about 190 m, with screen-door dithering. **Waterscape use:** direct comparison point for distant forest rendering around reservoirs where tree count matters more than close-up geometry. | **High / low-medium for scale** | **MIT** |

## Atmosphere, weather & volumetrics

| Resource | Status | Why it matters | Visual / cost | Upstream licence / reuse |
|---|---|---|---|---|
| [High-Performance Ground Fog](https://codepen.io/the-red-reddington/full/wBGQQwO) · [GitHub mirror](https://github.com/red-reddington/web-demos/tree/main/threejs-ground-fog) | **Candidate** | Cheap height/FBM-style ground fog; useful when atmosphere is needed without paying for true volumetric integration. | **Medium-high / low** | Upstream README carries an **MIT badge**, but GitHub does not currently detect a standard licence file; verify before copying code. |
| [Complete Sky System](https://codepen.io/the-red-reddington/full/MYKRZNN) · [GitHub mirror](https://github.com/red-reddington/web-demos/tree/main/threejs-complete-sky-system) | **Candidate** | Day/night, sun/moon, clouds, stars and lens-flare reference. Waterscape already has a sky system, but this remains useful as an alternate cheap implementation and feature reference. | **Medium-high / low** | Upstream README carries an **MIT badge**, but GitHub does not currently detect a standard licence file; verify before copying code. |
| [Volumetric lighting in WebGPU](https://discourse.threejs.org/t/volumetric-lighting-in-webgpu/87959) | **Reference** | Froxel/3D-texture volumetric lighting, atmosphere and scattering. Valuable high-end counterpart to cheap height fog, with explicit discussion of avoiding per-pixel raymarch cost. | **Very high / medium** | **Reference only** — forum/research implementation; no reusable licence established here |
| [three.js WebGPU volumetric lighting example](https://threejs.org/examples/webgpu_volume_lighting.html) | **Candidate** | Current upstream Three.js baseline for WebGPU volumetric lighting; useful for comparing native/current approaches against custom froxel research. | **High / medium-high** | **MIT** as part of three.js |

## Lighting & high-end rendering

| Resource | Preview | Status | Why it matters | Visual / cost | Upstream licence / reuse |
|---|---|---|---|---|---|
| [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) · [demo](https://gkjohnson.github.io/three-gpu-pathtracer/index.html) | <img src="https://raw.githubusercontent.com/gkjohnson/three-gpu-pathtracer/main/docs/banner.webp" width="160" alt="three-gpu-pathtracer rendered scene"> | **Candidate** | High-quality path-traced reference rendering for Three.js scenes. Useful for beauty/reference frames, material/lighting comparisons and ideas that can later be approximated in real time. | **Very high / high** | **MIT** |
| [LudoGL](https://github.com/emmelleppi/LudoGL) · [demo](https://ludo-gl.netlify.app/) | <img src="https://raw.githubusercontent.com/emmelleppi/LudoGL/main/LudoGL.jpg" width="160" alt="LudoGL deferred renderer"> | **Reference** | From-scratch WebGL2 deferred renderer with G-buffer, IBL, TAA/FXAA, GTAO, SSR, bloom, motion blur and a substantial output/post stack. Upstream explicitly describes it as educational rather than production-ready. **Waterscape use:** study individual quality/performance techniques—especially GTAO, temporal AA, SSR and post processing—and translate useful ideas into the Three/WebGPU renderer rather than adopting LudoGL itself. | **High / medium-high** | **No licence detected** — reference only |
| [Codrops R3F Mirrors](https://github.com/emmelleppi/codrops-r3f-mirrors) · [demo](https://tympanus.net/Tutorials/Mirrors/) | <img src="https://raw.githubusercontent.com/emmelleppi/codrops-r3f-mirrors/master/screenshot.jpg" width="160" alt="React Three Fiber mirror scene"> | **Candidate** | Compact Three.js/react-three-fiber mirror tutorial. **Waterscape use:** lightweight planar-reflection/render-to-texture reference for calm water, pools and architectural water surfaces when a full water-reflection system is unnecessary. | **High / low-medium** | **MIT** |
| [MatCaps collection](https://github.com/emmelleppi/matcaps) | <img src="https://raw.githubusercontent.com/emmelleppi/matcaps/master/resources/repository-open-graph.jpg" width="160" alt="MatCaps material preview"> | **Reference** | Large MatCap collection plus a useful explanation of the camera-relative technique, which is exceptionally cheap because lighting/reflections are encoded in a lookup texture. **Waterscape use:** technique reference for intentionally illustrative low-cost materials or debug/shape-readable views; use self-authored or clearly licensed MatCaps rather than assuming the bundled textures are reusable. | **Medium-high / very low** | **Reference only** — upstream notes mixed/unclear texture provenance |
| [Nissokan](https://github.com/aiimpl/nissokan) | — | **Candidate** | Hybrid baked/runtime lighting study: Cycles bakes expensive sunset illumination while Three.js adds view-dependent highlights, atmospheric haze, pond reflection, ripple distortion and solar glints. **Waterscape use:** model for reserving expensive lighting work for an offline bake while preserving dynamic water, atmosphere and camera-dependent highlights at runtime. | **Very high / low-medium runtime + offline bake** | **MIT** |
| [three-rc](https://github.com/CodyJasonBennett/three-rc) | <img src="https://github.com/user-attachments/assets/c3ca3123-0724-4945-8098-ba3845658b49" width="160" alt="three-rc radiance cascades Sponza preview"> | **Reference** | 3D Radiance Cascades global-illumination experiments; especially interesting for volumetric lighting, clouds and multiple-scattering ideas. | **Very high / medium-high** | **No licence detected** — **reference only** |

## WebGPU & rendering architecture

| Resource | Status | Why it matters | Visual / cost | Upstream licence / reuse |
|---|---|---|---|---|
| [cuda-webshader](https://github.com/SamG-Coder/cuda-webshader) · [demo](https://samg-coder.github.io/cuda-webshader/) | **Used** | CUDA-to-WebGPU compiler/runtime vendored by Waterscape to compile CUDA-authored water kernels for the browser. | **Enabler / workload dependent** | **MIT** |
| [three.js](https://github.com/mrdoob/three.js) | **Used** | Waterscape's browser 3D/rendering foundation, vendored at r186. Its current WebGPU examples are also useful baselines when evaluating custom techniques. | **Enabler / workload dependent** | **MIT** |

## Data storytelling & interaction

| Resource | Status | Why it matters | Visual / cost | Upstream licence / reuse |
|---|---|---|---|---|
| [River Bend](https://sael.net/river-bend/) | **Reference** | Strong reference for a visually led river experience: real data as backbone, editorial visual interpretation to make the system legible and compelling. | **High / varies** | **Reference only** — implementation/assets licence not established here |
| [Itsumono-michi](https://github.com/aiimpl/itsumono-michi) · [demo](https://aiimpl.github.io/itsumono-michi/) | **Reference** | Turns real government vector tiles, DEM, aerial imagery and place search into a generated Three.js world. **Waterscape use:** pattern for converting authoritative geographic data into a simplified, explorable visual world while clearly separating measured inputs from inferred/stylized details. | **Medium-high / medium** | **Reference only** — no project-level licence detected; data sources retain their own terms |
| [Nathan Wilbanks visual reference](https://x.com/NathanWilbanks_/status/2103966250405892270) | **Reference** | Programmatic-visual-development reference saved during Waterscape exploration. | **Varies / varies** | **Reference only** — no source-code licence established here |

## Workflows & visual development

| Resource | Status | Why it matters | Visual / cost | Upstream licence / reuse |
|---|---|---|---|---|
| [emmelleppi projects](https://github.com/emmelleppi) | **Reference / source family** | Web-graphics experiments spanning planar reflections, refraction/transmission, materials, post-processing, React Three Fiber/Three.js and a newer from-scratch renderer. **Waterscape use:** mine individual techniques and compare cheap older effects against current Three/WebGPU equivalents; prefer canonical upstream when a repository is a fork. | **Workflow / varies** | Licence varies by repository; verify each project before reuse |
| [Open-Shaders](https://github.com/emmelleppi/Open-Shaders) | **Reference / index** | Cross-engine collection/index of GLSL/HLSL/CG shaders from Three.js, Babylon.js, Filament, Unity, Godot and others. **Waterscape use:** discovery tool when looking for alternate implementations of SSR, AO, volume rendering, lighting or post effects; follow through to the original project and licence before copying. | **Workflow / n/a** | Licence varies by source/directory; upstream explicitly says to check each one |
| [aiimpl projects](https://github.com/aiimpl) | **Reference / source family** | A useful family of compact Three.js experiments combining procedural worlds, offline Blender/Python generation, browser shaders, deterministic systems, LOD/impostors and film-style presentation. **Waterscape use:** mine individual projects for implementation patterns and quality-per-compute ideas rather than treating the profile as one reusable library. | **Workflow / varies** | Licence varies by repository; verify each project before reuse |
| [vgpu agent skill](https://github.com/vercel-labs/vgpu) · [Blender asset guide](https://github.com/vercel-labs/vgpu/blob/canary/skills/vgpu/blender/index.md) · [reference post](https://x.com/matiNotFound/status/2106051894624047547) | **Candidate** | Agent-oriented WebGPU skill whose current default-branch guidance covers Blender modeling, high/low-poly workflows, normal/AO baking, LODs, asset validation and runtime integration. Install/reference command: `npx skills add vercel-labs/vgpu`. **Waterscape use:** candidate workflow for authored rocks, infrastructure, props and scene assets: establish visual references first, block the asset, review matched renders from intended runtime cameras, then add detail, bake/optimize, export and validate actual runtime cost rather than judging only the Blender viewport. | **Workflow / high authoring leverage; runtime cost asset-dependent** | **MIT** |
| [hajimetwi3-prompt-okiba](https://github.com/hajimetwi3/hajimetwi3-prompt-okiba) | **Candidate** | Useful workflow pattern: generate visual references, critique, constrain GPU-heavy parallel work, judge, improve and repeat. Also contains water/coast-oriented prompt experiments. | **Workflow / n/a** | **MIT** |

### Current Waterscape agent-assisted asset loop

For modeling tasks, the current Waterscape preference is to use **Astra** for the Blender authoring pass. Start by searching for visual references or generating concept images, then build a simple blockout. Render the target shots and major parts, visually inspect them, and confirm that silhouette, proportions and assembly read correctly before spending time on detail. Iterate detail through rendered checks rather than accepting the model from code or viewport state alone. Once the form is working, bake or transfer detail where useful, build LODs/optimize, export the runtime asset, and validate it in the browser with measured geometry, texture and draw costs. Generated concept art guides the design; actual Blender/runtime renders validate the implementation.

This lines up well with vgpu's current Blender guidance: the first blockout is treated as an implementation baseline, intended runtime cameras are part of review, and high/low-poly, baking, delivery and runtime cost are checked as one asset pipeline rather than separate concerns.

## How to add something

A resource belongs here when it is likely to help with Waterscape's web visuals, simulation, terrain, vegetation, water, lighting, atmosphere, data storytelling, interaction, performance, or development workflow. Prefer the canonical repository or project page over a social post whenever one can be identified.

For each entry, record:

- the canonical source and, when useful, a live demo;
- its primary category;
- whether it is `Used`, `Candidate`, `Foundational`, or `Reference`;
- what it actually does and why it matters to Waterscape;
- how Waterscape could plausibly use the technique or workflow;
- a rough visual-payoff/runtime-cost tradeoff when that is meaningful;
- the upstream licence, or `Reference only` when permission is unclear;
- a small upstream README preview image when one is already available and representative.

Do not remove something just because it is old. Remove or demote it when a current resource clearly supersedes it **and** the older item no longer contributes a distinct technique, explanation, compatibility point or quality/performance tradeoff.

Screenshots and social posts are good intake material, but this catalog should normally link to the original project rather than republish somebody else's screenshot.

## Useful tags for future growth

`water` · `river` · `reservoir` · `coast` · `fluids` · `PIC/FLIP` · `foam` · `caustics` · `rain` · `particles` · `terrain` · `rocks` · `vegetation` · `trees` · `grass` · `wind` · `GIS` · `Three.js` · `WebGPU` · `WebGL` · `shaders` · `reflection` · `SSR` · `TAA` · `GTAO` · `post-processing` · `MatCap` · `lighting` · `volumetrics` · `atmosphere` · `data-viz` · `interaction` · `performance` · `LOD` · `Blender` · `3D-assets` · `GLB` · `baking` · `agent-workflow` · `workflow`
