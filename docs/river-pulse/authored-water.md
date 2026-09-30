# First Hacienda authored water pass

RP2 gives Gauge and Shallows a local optical preview while Valley retains the cartographic
centerline. The river-layer switch controls both representations. Shallows is enabled only
when the bundled 3DHP mainstem supports a nonempty local surface. DWR fallback stays a
centerline; it does not create an invented surface.

## Geometry and meaning

The local patch is bounded to 420 m around the mainstem point nearest the configured gauge.
Its lateral envelope is an authored maximum of 42 m either side of the centerline, sampled
on a 1.5 m grid and clipped where terrain rises above the preview surface. Surface elevation
interpolates sampled centerline terrain plus 0.24 m for visual separation. This is an
illustrative mesh, not measured width, stage, inundation or a hydraulic reconstruction.
The coarse DEM and triangle clipping limit bank detail. Terrain assets are unchanged.

Optical depth ranges from 0.12 m at the lateral envelope to 2.72 m at the centerline, through
a power curve. This is a modeled optical bed, not surveyed bathymetry. It can remain deeper
at a terrain-clipped edge. Discharge is not converted to water elevation or current speed.
Data outages leave this disclosed optical preview available while observation labels
continue to report unavailable data.

## Optics

Nine traveling directions perturb surface normals. Pixel derivatives attenuate unresolved
waves. Reduced motion freezes the wave/caustic clock. Schlick Fresnel blends the modeled bed
with a Three TSL reflection pass at 35% resolution; its horizontal reflection plane is an
approximation of the locally varying surface. Snell refraction addresses procedural gravel
on the modeled bed. Exponential attenuation gives the shallow/deep transition. Caustic detail
is an animated analytic pattern, not photon-traced or derived from wave focusing. Sun glints
use the scene's lighting direction. These optics consume illustrative inputs; the UI explains
the preview in Read the representation.

## Resources considered

Read the project library at [resources/README.md](../../resources/README.md), including its
original-license rule, before selecting this approach.

- Existing Three r186 / TSL: reused the vendored renderer, shader nodes and reflector;
  [ReflectorNode documentation](https://threejs.org/docs/pages/ReflectorNode.html) and
  [WaterMesh](https://threejs.org/docs/pages/WaterMesh.html) informed the optical architecture.
  No vendor changes or new copied addon code/assets.
- [CAUSTIC//VOLUME](https://github.com/ScottieFox/caustic-volume): reviewed the upstream
  explanation of varied wave directions, shared surface normals, refracted bed and ray
  focusing. The initial parallel-wave screenshot prompted multi-directional detail. No code
  copied; full ray-focused caustics are a future refinement, not implemented here.
- Clearwater / CUDA Clearwater: existing reservoir lineage remains relevant for optics;
  did not reuse its still-water basin or synthetic reservoir bathymetry as river geometry.
- [Tidewater](https://github.com/dgreenheck/tidewater): reviewed as a fuller coastal-system
  candidate. Ocean/surf architecture is beyond this local first pass; no imported assets.
- HDRP current-map article: retained as a river-current reference. Its upstream page did not
  fetch during this task; no implementation or velocity claims were based on it.

## Limits and next visual work

This is a first local water pass. Surrounding terrain still uses the existing elevation tint;
there are no authored bridge, vegetation or bank assets. Local mesh edges can show the coarse
terrain/grid constraint. The bed is procedural and the caustics approximate. There is no
current field, foam model, click-ripple simulation, flood model, measured stage or Jenner
surface. Native WebGPU and target Windows GPU performance need separate measurement.
