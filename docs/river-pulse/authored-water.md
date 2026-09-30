# Hacienda Map and authored beach

RP5 separates two representations. **Map** retains the sourced USGS 3DEP terrain and
3DHP centerlines and adds an animated symbolic river stroke. **Bridge** and **Hacienda
Beach** open an authored local scene composed from the user's two contemporary photos.
The previous Gauge camera was an elevated terrain flyover, not a finished authored scene.
It has been replaced. RP2/RP4's terrain-clipped optical preview remains in history and its
geometry tests; it is no longer the geometry used by the authored beach.

## Map flow and scientific state

`map-flow.js` places a fixed-width display stroke over the bundled Russian River mainstem.
Its seasonal color follows the same selected-condition binding as the previous centerline.
Traveling light pulses indicate positive, eligible selected discharge. Missing, invalid and
zero quantities stop motion; reduced motion freezes the clock. The timeline controls this
selection, including historical daily means, through the existing gauge/time policy.

Stroke width, pulse speed and source-line travel direction are illustrative display choices.
They are not measured bank width, inundation, local velocity or a surveyed current vector.
Positive discharge does not determine authored beach stage, optical clarity or currents.
The original scientific quantities, sources and evidence UI are unchanged.

## Photo-informed local setting

`beach-layout.js` defines a curved gravel spit, steeper forested banks and a bend behind the
bridge. Ground and water share the same bank curves and bed-height model. This local stage
uses authored metre dimensions for scale; it is deliberately separate from the georeferenced
map. Its ground, shoreline, level and underwater depth are modeled estimates, not 3DEP
measurements, a survey or gauge stage. The UI replaces coordinates/NAVD88 and compass claims
with authored-setting labels in these views. Source terrain assets are unchanged.

Travel stays on a narrow dry-bank walking area, at 1.8 m eye height, within the finished
reach. The two compositions look from the waterline toward the bridge. Switching between
Map and the local stage cuts between coordinate systems; walking between the two authored
cameras eases normally. This avoids flying through unfinished geometry.

The gray steel camelback model has seven panels. Its 61 m span and 7.71 m roadway width
come from [HistoricBridges' Hacienda documentation](https://historicbridges.org/bridges/browser/?bridgebrowser=california/riverroadrussianriver/),
fetched 2026-09-29. Its height, member sizes, concrete pier profiles, approaches and placement
are photo-informed estimates, not surveyed engineering geometry. The left support meets a
continuous fractured rock outcrop; it no longer stands beside a scattering of separate
boulders. A small riverside house and layered mixed woodland support the composition.

Reference checks included the user's two photos, the local
[Hacienda history collection](https://hacienda-cosmo.com/page-5/), and a contemporary
[close view of the pier and underside](https://s.hdnux.com/photos/01/53/62/25/28255615/3/ratio3x2_1920.jpg).
Search results also included historic and other bridges; those captions were not treated as
reliable current Hacienda evidence. Reference photographs are not distributed as textures.
The scene is an approximation of the photographed place, not a photogrammetric reconstruction.

## Materials, woodland and lighting

The six RP4 Poly Haven 1K JPG maps remain unmodified and retain their upstream MD5 manifest:
[Ganges River Pebbles](https://polyhaven.com/a/ganges_river_pebbles) and
[Rock Boulder Dry](https://polyhaven.com/a/rock_boulder_dry), both CC0. The pebble albedo is
graded toward the cool gray stone in the photographs, consistently on dry beach and submerged
bed. Wet ground darkens and smooths; foreground instanced pebbles add geometric relief.
Exposed rock uses triplanar color sampling to avoid stretched cliff textures.

Two fir variants from committed reservoir W2 (`af0bb6c`) and three lightweight oak variants
from the existing Diablo assets form overlapping bankside stands, taller fir groups behind,
and low broadleaf cover near the water. Their manifests retain source biome and ez-tree MIT
provenance. The oak silhouettes are general broadleaf Setting assets, not a local species
census. No reservoir runtime or placement logic is changed. A daylight sky, architectural
shadows and asymmetric bank shading are photographic composition choices, not measured light.

## Water optics and clarity

Nine traveling normal directions provide ripples, with pixel-derivative filtering at distance.
Schlick Fresnel blends the underwater contribution and a planar Three TSL reflection at 65%
resolution. Snell refraction addresses the photographic gray gravel bed. Exponential
attenuation fades bed detail into a muted green body color beyond the shallow margin. This
clarity/color and a mild reflection grade follow the user's photo feedback; neither is a
measurement of turbidity, sediment, chlorophyll or water quality. Analytic caustic detail and
sun glints are illustrative. Reduced motion freezes wave and caustic clocks.

These optics consume modeled surface/bed and authored light. The water remains a presentation
model: no local current field, surveyed bathymetry, flood model, click-ripple simulation or
Jenner surface is added. Timeline changes do not move this photograph-inspired shoreline.

## Resilience and limits

River toggles water/river symbols while leaving the authored bank visible. Elevation tint is
available on Map. A hydrology outage leaves the authored place available and stops the map
flow cue. Texture failure retains procedural-bed water and fallback ground/rock materials;
woodland failure retains the bridge and beach. The inspector explains those representations.

Visual review catches problems beyond passing tests. The reconstruction now supplies the
major composition, but the reused tree meshes, approximate caustics, modeled bank geometry
and planar reflections still limit photographic realism. Native WebGPU and target Windows
GPU frame rates remain unmeasured. Browser interaction checks use Chrome WebGL2/SwiftShader
and synthetic intercepted hydrology only in tests, never in production.

## Resource evaluation

The [resource library](../../resources/README.md) guided the implementation. Existing Three
r186/TSL and [ReflectorNode](https://threejs.org/docs/pages/ReflectorNode.html) were reused
without vendor changes. [CAUSTIC//VOLUME](https://github.com/ScottieFox/caustic-volume) informed
varied wave directions and refracted bed optics; no code was copied and its ray-focused
caustics are not implemented. [Tidewater](https://github.com/dgreenheck/tidewater) was reviewed
as a larger coastal-system candidate. Reservoir Clearwater lineage remains an optics
reference, not river geometry. The HDRP current-map article did not fetch in RP2, so no
velocity claims or code were based on it.
