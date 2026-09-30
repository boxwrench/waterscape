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

RP4 replaces the original lateral-width depth curve with a modeled depth from distance to
the clipped surface boundary: 0.12 m plus 0.18 times edge distance in metres, capped at
2.72 m. A two-pass grid distance approximation keeps the terrain-clipped margin shallow. This is a modeled optical bed, not surveyed bathymetry.  Discharge is not converted to water elevation or current speed.
Data outages leave this disclosed optical preview available while observation labels
continue to report unavailable data.

## Optics

Nine traveling directions perturb surface normals. Pixel derivatives attenuate unresolved
waves. Reduced motion freezes the wave/caustic clock. Schlick Fresnel blends the modeled bed
with a Three TSL reflection pass at 35% resolution; its horizontal reflection plane is an
approximation of the locally varying surface. Snell refraction addresses the locally bundled Ganges River Pebbles color and normal maps
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
the bridge has not yet been modeled. RP4 adds local gravel, rocks and conifer stands. Local mesh edges can show the coarse
terrain/grid constraint. The bed geometry is modeled, its material is photographed, and caustics remain approximate. There is no
current field, foam model, click-ripple simulation, flood model, measured stage or Jenner
surface. Native WebGPU and target Windows GPU performance need separate measurement.

## RP4 bank material integration

Ganges River Pebbles colors the local exposed bank and refracted modeled bed at the asset's
2.2 m tile scale. The bank overlay follows the original terrain triangles, lifted by 0.055 m
to avoid coplanar overlap. Wetness darkens the bank and lowers roughness within 0.8 m of
relative preview-surface height. This is an authored visual transition, not observed wetness.
Rock Boulder Dry textures a dozen varied rock meshes on the near bank; small instanced
pebbles add relief near the camera. Placement, silhouettes and pebble beach extent are
Setting informed by the user's photos, not surveyed geometry or local geological claims.

The **Shoreline** camera sits 0.8 m beyond a terrain/surface crossing, at 1.8 m above the
bank, and looks along the reach. The terrain clearance in this authored view allows a
minimum 1.7 m eye height; other cameras keep their prior clearance. Shallow-bed depth now
follows the clipped shore distance rather than only the centerline envelope.

Forty-eight candidate sites form eight irregular conifer stands, with any site below the
preview surface plus 1 m or above the local bank range rejected. Hacienda's bundled terrain
accepts 43 sites. The two lightweight Douglas-fir variants and textures are reused from the
reservoir's committed Peninsula assets (`af0bb6c`); no reservoir runtime or placement logic
is changed. These are generic Setting assets, not surveyed individual trees. The local
manifest and third-party notices preserve the source and MIT license.

All six material maps are unmodified 1K JPGs fetched from Poly Haven's official download
manifest and verified against the published MD5 values. They and the fir assets total about
6 MiB and ship inside the place package. The scene uses no external asset requests for
these materials. Material failures retain the original procedural-water preview; a fir
failure retains bank rocks and gravel. Data selection remains independent of these assets.

The bridge is still the next architecture task. Coarse underlying terrain, the local patch
boundary, and the approximate reflection plane remain visible limitations of this pass.
