# River Pulse — Waterscape reuse audit

This audit identifies which parts of the current Waterscape implementation should be reused, adapted, or deliberately left behind when bootstrapping River Pulse.

## Summary

River Pulse should reuse a meaningful amount of Waterscape, but it should not become “Waterscape with a river substituted for the reservoir.” The cleanest path is to retain mature geospatial/rendering infrastructure while replacing still-water assumptions with river-specific state, data, current fields, package semantics, and scale-specific presentation.

Visual quality is a first-class River Pulse requirement. The reuse target is therefore not only plumbing: Waterscape's optics and real-time rendering work are valuable, especially at authored places, as long as their visual technique is kept separate from unsupported river science.

## Reuse map

| Area | Decision | River Pulse use |
|---|---|---|
| USGS 3DEP acquisition | Reuse | Directly or with minimal wrapper changes |
| WGS84 ↔ UTM utilities | Reuse | Directly |
| Packed terrain transport | Adapt | Keep transport idea; change river semantics |
| Reservoir water detection | Do not reuse | Fundamentally still-water-specific |
| Build/package pipeline | Reuse pattern | Generalize into river/place packages |
| Bundle validation | Reuse pattern/code | Replace reservoir schema with pack schemas |
| Three.js/WebGPU land pass | Reuse | Strong candidate |
| CUDA-WebShader runtime plumbing | Reuse | Strong candidate |
| Adaptive quality governor | Reuse/adapt | Keep mechanism; improve vendor neutrality |
| Free-flight camera | Reuse | Directly useful |
| Automatic reservoir viewpoints | Do not reuse | Reservoir-centric |
| Authored viewpoint format | Reuse | Good fit for Hacienda/Jenner |
| Pre-rendered fallback | Adapt | Useful fallback pattern; dynamic data needs more |
| FFT reservoir waves | Do not use as river model | Possible surface-detail layer only |
| Ripple system | Reuse/adapt | Local interaction/detail layer |
| Water optics | Reuse/adapt strongly | Hero-place rendering |
| Caustics | Reuse/adapt | Close-water effect for authored places |
| Procedural reservoir bed | Do not reuse scientifically | Wrong geometry model for rivers |
| Current/flow system | New | Waterscape does not provide longitudinal river flow |

## 1. Terrain and geospatial pipeline

### Reuse

`pipeline/dem.py` already provides the generic part River Pulse needs: fetch a projected USGS 3DEP Float32 elevation grid, cache it, and return cell spacing/georeferencing.

`pipeline/geo.py` cleanly separates WGS84 → UTM conversion.

`renderer/terrain.js` already provides useful browser-side behavior:

- compressed terrain decoding
- bilinear sampling
- ground collision/picking
- scene position → latitude/longitude
- elevation readout
- GPU terrain packing

These are all valuable River Pulse foundations.

### Replace

Waterscape detects reservoirs by exploiting lidar hydro-flattening: it finds one flat connected water surface, establishes one reservoir level, derives height relative to that level, and computes signed shoreline distance.

That is exactly the wrong abstraction for a river corridor.

River Pulse terrain should preserve absolute elevation and attach river-specific geometry separately, likely including:

```text
absolute terrain elevation
river centerline / reaches
channel or bank geometry
distance-to-channel
reach association
water-surface elevation by reach when available
```

For a long river corridor, terrain should also be designed with tiling/LOD in mind rather than assuming one reservoir-sized rectangle forever.

### Proposed action

Create a River Pulse terrain bundle format derived from Waterscape's transport/metadata design but without flat-water detection, one-water-level semantics, or reservoir-centroid assumptions.

## 2. Package/build system

Waterscape already demonstrates the right contributor ergonomics:

```text
source.json
    ↓
build.py
    ↓
terrain.bin.gz
terrain.json
cameras.json

+

story.json
land.json
assets
flyover
poster
```

The renderer then loads a content folder by ID, and the validator scans every bundle for required files and field consistency.

This should be generalized rather than replaced.

### Candidate shared concepts

```text
pack identity
schema version
engine compatibility
CRS
vertical datum
attribution
terrain
cameras
assets
validation
```

### Waterscape-specific concepts to keep separate

```text
still-water configuration
single reservoir surface
reservoir biome/shoreline assumptions
reservoir optics defaults
```

### River Pulse-specific concepts

```text
hydrography
reaches
gauges
time/data bindings
selection policies
visual bindings
place capabilities
model bindings
```

Do not create a shared library immediately. First prove River Pulse with a small adapted implementation. Extract common code only after duplication is real and stable.

## 3. Renderer and WebGPU plumbing

Waterscape has already solved a valuable integration problem: Three.js WebGPU and the CUDA-WebShader runtime share a GPU device. Three.js renders lidar terrain; the water pipeline consumes the resulting land/depth information on the GPU.

Reuse the infrastructure pattern.

### Keep

```text
GPU runtime setup
shared WebGPU device pattern
Three.js land pass
terrain GPU upload
canvas presentation
no routine GPU→CPU readback
quality adaptation
camera/runtime controls
```

### Do not mutate `createWaterscape()` into River Pulse

The current renderer is centered on one still water body and one reservoir-oriented water kernel. River Pulse should instead extract or reimplement the generic pieces behind river-specific renderers.

Candidate split:

```text
graphics/
  gpu-runtime
  terrain
  land-pass
  camera
  quality
  presentation

river-renderer/
  corridor-water
  current-fields
  hero-water
  weather-effects
  visual-bindings
```

## 4. Camera and authored places

### Reuse runtime navigation

The existing flight/navigation system is a good fit for River Pulse:

- terrain clearance
- altitude-dependent speed
- WASD + vertical movement
- view-ray matching
- fast travel at altitude, precision near the ground

### Replace reservoir-specific automatic viewpoint generation

Waterscape scores overlooks by how much open reservoir water they can see, searches for a second ridge, finds a shoreline location, then flies toward the reservoir centroid.

River Pulse needs river/place semantics instead:

```text
corridor overview
follow-river
bridge approach
river-eye
bank/shore
estuary overview
```

### Reuse the authored viewpoint shape

The current pose format is already suitable:

```text
x
z
above
yaw
pitch
speed
label
```

Hacienda Bridge and Jenner should both use the same place loader while supplying different authored camera sets and capabilities.

## 5. Water, currents, and optics

### Strong reuse: optics

Waterscape already contains sophisticated visual machinery that is useful at authored river locations:

- Fresnel reflection/refraction
- underwater attenuation/scattering
- caustics
- seabed shading
- bloom/post
- local ripple interaction
- multi-scale surface detail

These should be treated as reusable rendering resources, not as River Pulse hydrodynamics.

### Do not reuse Waterscape as the river model

The current water system is built around periodic spectral wave fields and a still-water reservoir surface. The bed is also synthesized from reservoir shoreline distance and configured basin depth.

Those assumptions must not become factual river geometry or current behavior.

### River Pulse split

```text
                 River Pulse
                      │
            ┌─────────┴─────────┐
            │                   │
      SURFACE STATE        WATER OPTICS
            │                   │
      current field        Fresnel
      model/illustration   refraction
      local waves          caustics
      ripples              scattering
      deformation          reflection
      normals              bloom
            │                   │
            └─────────┬─────────┘
                      ↓
                  final water
```

Waterscape provides much of the right-hand column. River Pulse must create the left-hand river/current system.

The external current-field references listed in the implementation contract should be evaluated specifically against this gap.

## 6. Two rendering scales

River Pulse should not pay hero-scene costs across the full Russian River corridor, and it should not reduce authored places to a thick GIS line merely because that representation works overhead.

### Corridor / overhead water

The map-scale visual system should be cheap, readable, animated, and LOD-friendly across many miles.

Initial data-driven encodings:

```text
relative-flow width
seasonal-condition color
downstream directional motion
```

The corridor should support a user-facing toggle between **Flow width** and **Seasonal color** so each encoding remains legible. The same RiverState is underneath both modes.

The width mode is an illustrative mapping of relative flow unless a future source/model supports literal bank/water-extent geometry. It must not inherit scientific meaning from the ribbon's apparent physical size.

### Authored-place / hero water

```text
Hacienda / Jenner
high-detail surface
current-field response
refraction
caustics
foam
local geometry
lighting/composition
```

This representation should pursue much higher visual fidelity. The local water facsimile may be tuned to the phenomenon being communicated and can use Waterscape optical techniques aggressively without adopting its still-reservoir assumptions.

Both scales consume RiverState through visual bindings; they deliberately render it differently.

## 7. Quality and fallback

Waterscape's quality governor is small and reusable. Keep the measured frame-time feedback and tier/resolution ladder, but avoid assuming NVIDIA should always start higher than other vendors.

A warm-up benchmark or conservative start followed by measured adaptation is preferable for an open river engine expected to run on AMD, Intel, NVIDIA, and mobile hardware.

River Pulse quality budgets should also recognize the scale split: corridor water must stay inexpensive over a large world, while hero water can spend more GPU budget near an authored place.

Waterscape's video fallback is also a useful design precedent. River Pulse cannot replace a dynamic timeline with one video, but the principle remains useful:

```text
FULL
WebGPU 3D + timeline + live interaction

REDUCED
2D/map/charts + selected imagery/video + same factual evidence
```

Not required for v0.1, but worth preserving in the architecture.

## 8. Licensing/attribution

Waterscape's relevant reusable components are already tracked with explicit notices:

- repository: MIT
- Clearwater optics lineage: MIT
- cuda-webshader: MIT
- Three.js: MIT
- USGS 3DEP terrain: U.S. Government/public domain source data

Any extracted or copied implementation must retain applicable notices and attribution.

## Concrete extraction plan

Start River Pulse by adapting a narrow subset rather than refactoring Waterscape into a shared framework first.

```text
FROM WATERSCAPE                  RIVER PULSE

pipeline/geo.py              →   REUSE
pipeline/dem.py fetch_dem    →   REUSE
terrain compression          →   ADAPT
renderer/terrain.js          →   ADAPT
renderer/land/*              →   REUSE/ADAPT
engine/camera.js             →   REUSE
engine/quality.js            →   REUSE/ADAPT
GPU runtime pattern          →   REUSE
package validator pattern    →   REUSE
water optics                 →   EXTRACT/ADAPT FOR HERO WATER
FFT reservoir waves          →   OPTIONAL DETAIL ONLY
reservoir water detector     →   NO
reservoir bed model          →   NO
reservoir camera search      →   NO
```

## Decision gate

Do not extract a shared Waterscape/River Pulse library yet.

First prove:

1. Hacienda terrain can be built without reservoir assumptions.
2. The existing land/WebGPU path can render it.
3. The camera system can navigate it.
4. River-specific hydrography can be layered independently.
5. A corridor river visual can respond to selected discharge/seasonal state.
6. A separate authored-place water treatment can reuse Waterscape optics without adopting reservoir science.

If those work and code is genuinely duplicated between both projects, extract the common infrastructure then.
