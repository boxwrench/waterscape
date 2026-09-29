# Waterscape resource library

A working notebook of web graphics, simulation, rendering, data-visualization and visual-development resources that may be useful to Waterscape.

This is primarily a practical memory aid for the project: what a resource is, why it was saved, whether Waterscape already uses it, and what its upstream licence allows. It is public so other people can follow the same references.

## Licence rule

**Every resource keeps its original upstream licence.** Listing something here does not relicense it under Waterscape's MIT licence and does not imply that it is safe to copy into this repository. Check the linked upstream licence before reuse.

The licence/status column is a quick working note, not legal advice. `Reference only` means the source is useful to study or remember, but this catalog has not established permission to copy its implementation or assets. Licence status below was checked on **2026-09-29**.

## Already used in Waterscape

| Resource | What it is | Waterscape use | Upstream licence / reuse |
|---|---|---|---|
| [Clearwater](https://github.com/Aureliengmz/clearwater) · [demo](https://aureliengmz.github.io/clearwater/) | Aurélien / Lumaris's single-file WebGL2 shallow-water renderer: FFT waves, refraction and caustics | Primary visual/optical reference for the reservoir water; the original design and seabed asset are credited in `THIRD_PARTY_NOTICES.md` | **MIT** |
| [SamG-Coder/clearwater](https://github.com/SamG-Coder/clearwater) · [demo](https://samg-coder.github.io/clearwater/) | CUDA/WebGPU reimplementation and extension of Clearwater | Bridge from the original water work to the CUDA-authored/WebGPU renderer used by Waterscape | **MIT** |
| [cuda-webshader](https://github.com/SamG-Coder/cuda-webshader) · [demo](https://samg-coder.github.io/cuda-webshader/) | CUDA-to-WebGPU compiler/runtime | Vendored compiler/runtime used to compile Waterscape's CUDA water kernels for the browser | **MIT** |
| [three.js](https://github.com/mrdoob/three.js) | Browser 3D/rendering library | Vendored at r186; land/terrain and scene rendering | **MIT** |
| [ambientCG](https://ambientcg.com/) | PBR textures and materials | Ground materials used by the `diablo-oak` biome | **CC0 1.0** |
| [FluffyGrass](https://github.com/thebenezer/FluffyGrass) · [tutorial](https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/) | Three.js splayed-card grass technique and mask texture | Basis/reference for Waterscape's clumped grass cards; upstream mask is retained with attribution | **MIT** for the repository; see upstream/tutorial terms for tutorial text |

For redistribution details and pinned snapshots of code/assets actually included in Waterscape, see [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md). This page is broader: it also tracks things worth studying even when no code is copied.

## Saved for exploration

### Water, fluids and caustics

| Resource | Why it is interesting for Waterscape | Stack / type | Upstream licence / reuse |
|---|---|---|---|
| [Three.js Particle Fluids](https://github.com/dgreenheck/threejs-particle-fluids) · [demo](https://dgreenheck.github.io/threejs-particle-fluids/) | Particle-based fluids for splashes, spray, interactive water, soft bodies and related effects. Potentially useful for illustrative motion or close interaction; not a substitute for river/reservoir hydrodynamics. | Three.js, WebGPU, TypeScript, PBF | **MIT** |
| [caustic-volume](https://github.com/ScottieFox/caustic-volume) · [demo](https://scottiefox.github.io/caustic-volume/) | Focused browser reference for moving water caustics, including a lightweight and a fuller sandbox version. Useful for studying readable shallow-water light patterns. | Three.js / browser caustics | **MIT** |
| [Currents in HDRP's Water System](https://anisb.github.io/2026/09/26/currents-in-hdrps-water-system/) | Useful visual/technical reference for representing currents, current maps, foam and directional flow. Especially relevant to River Pulse even though Waterscape is not a Unity project. | Article / Unity HDRP reference | **Reference only** — no reusable-code licence established here |

### Rendering, lighting and atmosphere

| Resource | Why it is interesting for Waterscape | Stack / type | Upstream licence / reuse |
|---|---|---|---|
| [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) · [demo](https://gkjohnson.github.io/three-gpu-pathtracer/index.html) | High-quality path-traced reference rendering for Three.js scenes. Useful for beauty/reference frames, material/lighting comparisons and ideas that can later be approximated in real time. WebGPU work is active upstream. | Three.js, BVH, path tracing | **MIT** |
| [three-rc](https://github.com/CodyJasonBennett/three-rc) | 3D Radiance Cascades global illumination experiments. The related work is especially interesting for volumetric lighting, clouds and multiple-scattering ideas. | Three.js, three-mesh-bvh, radiance cascades | **No licence / all rights reserved** upstream — **reference only** |

### Workflows and visual-development references

| Resource | Why it is interesting for Waterscape | Type | Upstream licence / reuse |
|---|---|---|---|
| [hajimetwi3-prompt-okiba](https://github.com/hajimetwi3/hajimetwi3-prompt-okiba) | Contains one-shot prompts/demos for a real-time coastal simulator and tsunami inundation simulator. The accompanying workflow is also useful: generate visual references, critique the result, constrain GPU-heavy parallel work, judge, improve and repeat. | Prompt/workflow repository | **MIT** |
| [River Bend](https://sael.net/river-bend/) | Strong reference for a visually led river experience: use real data as the backbone while allowing editorial visual interpretation to make the system legible and compelling. | Interactive web reference | **Reference only** — implementation/assets licence not established here |
| [Nathan Wilbanks visual reference](https://x.com/NathanWilbanks_/status/2103966250405892270) | Saved as a programmatic-visual-development reference from the Waterscape exploration work. | Social/demo reference | **Reference only** — no source-code licence established here |

## How to add something

A resource belongs here when it is likely to help with Waterscape's web visuals, simulation, terrain, water, lighting, data storytelling, interaction, or development workflow. Prefer the canonical repository or project page over a social post whenever one can be identified.

For each entry, record:

- the canonical source and, when useful, a live demo;
- what it actually does;
- why it matters to Waterscape;
- the important stack/tags;
- the upstream licence, or `Reference only` when permission is unclear;
- whether it is **already used** or merely **saved for exploration**.

Screenshots and social posts are good intake material, but this catalog should normally link to the original project rather than republish somebody else's screenshot.

## Useful tags for future growth

`water` · `river` · `reservoir` · `coast` · `fluids` · `foam` · `caustics` · `particles` · `terrain` · `GIS` · `Three.js` · `WebGPU` · `WebGL` · `shaders` · `lighting` · `volumetrics` · `atmosphere` · `data-viz` · `interaction` · `workflow`
