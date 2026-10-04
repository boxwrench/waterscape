# Sacramento at Freeport — RP13 / RP14

The user's next step after the accepted California overview is the first detailed
Sacramento place. Freeport already supplies a pinned USGS discharge series and separate
tidally filtered daily history, making it a useful first local scene. The overview and
river page now link to `/river-pulse/renderer/freeport.html`. Work is local, not published.

## Visual direction

The reservoir and Russian River scenes inform reflective water, textured banks,
depth in the landscape and an unobtrusive data card. The user's saved Clearwater,
Tidewater and tree resources informed this pass; the scene uses the repository's own
Three/TSL machinery, existing CC0 stone maps and MIT ez-tree broadleaf bakes. Jenner's
already licensed Tidewater noise adaptation supplies irregular optical detail.
No new upstream rendering code or photographic asset is imported.

The [Dicklyon Freeport photograph](https://commons.wikimedia.org/wiki/File:Freeport_Bridge_from_Freeport.jpg)
(CC BY-SA 4.0, reference only) was inspected for green steel, approach shape and foliage.
The [HistoricBridges side view](https://historicbridges.org/bridges/browser/?bridgebrowser=california/freeportbridge/)
was inspected for the low closed leaves, counterweight towers, piers and reflected bridge.
Neither photo is redistributed. RP14 replaces the generic crossing with a detailed
multi-angle reconstruction: tapered bascule leaves, laced fixed counterweight trusses,
upper links/trunnions, exposed concrete weights, east Warren pony approach, west stringers,
rounded piers and timber fenders. Railings, riveted gussets, overhead/under-deck bracing,
catwalks, signals and a hip-roof tender house support close inspection. Fixed roof braces
leave the counterweight bays open. Original procedural textures supply weathering.
Geometry is batched by material to avoid thousands of draw calls.

Close-up top-strut review uses Holth's [open paired roof braces](https://historicbridges.org/california/freeportbridge/day3_freeportbridge02997.jpg),
[lattice headers and sway frames](https://historicbridges.org/california/freeportbridge/day3_freeportbridge02984.jpg)
and [upper links/platform](https://historicbridges.org/california/freeportbridge/day3_freeportbridge03008.jpg).
The roof X members have cross ties, center plates and transverse struts; header lacing
faces vertically, while the portal sway diagonals use angle members. The tower platform
has a floor and two-tier rails. These component dimensions remain photo-fitted.

The [archived 2012 NBI sheet](https://historicbridges.org/california/freeportbridge/nbisheet.pdf)
provides total length 198.9 m, main span 68.9 m, roadway 6.4 m and deck 6.8 m.
The [Caltrans historic inventory](https://historicbridges.org/california/freeportbridge/24C0001.pdf)
and Nathan Holth's original gallery supply arrangement and visual evidence. The documented
101-foot east pony span is converted to metres. Remaining span splits, deck/steel elevations,
sections, weight sizes, link pivots, pier/fender sizes and placement are photo-fitted estimates.
This is not a surveyed engineering/as-built model, and no numerical photogrammetric accuracy
is claimed. Background town, vegetation and material condition are not fully reconstructed.
Portal signs copy archival photos and are not current clearance information.
The two tree mesh variants convey broadleaf cover, not a botanical census.

## Two coordinate frames

Bridge and Riverbank share an authored x-east/z-south metre frame with water near y=0.
A slightly bending fixed channel, bank profile, synthetic bed and bounded dry-ground
cameras belong to this setting. Coordinates are not shown as geographic readings.
The bridge remains closed. Afternoon sky/light and green-brown water are Setting and
illustrative optical choices, not current weather, water quality or measured turbidity.

Terrain uses a separate sourced frame anchored at the USGS station:

- [USGS station 11447650](https://waterdata.usgs.gov/monitoring-location/USGS-11447650/)
  supplies the WGS84 anchor in `source.json`/`place.json`.
- [USGS 3DEP](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer)
  supplies absolute NAVD88 elevations in UTM zone 10, EPSG:32610. The authored crop is
  resampled to 384 × 480 cells at about 7.73 m/cell and quantized at 0.05 m. No vertical
  exaggeration, stage assumption or reservoir-style water detection is applied.
- [USGS 3DHP](https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer/50)
  returned 28 crop-intersecting flowlines, including Sacramento River and Morrison Creek.
  All are retained in `hydrography.json`, with its exact request; the terrain view draws
  named Sacramento River source segments in the same local frame. Gaps stay open.
- [USGS/USDA NAIP Plus](https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer)
  supplies a 1024 × 1280 JPEG over the outer terrain-cell edges. `aerial.json` records
  exact UTM extent, URL, CRS and retrieval time. UVs account for half-cell margins and
  north/south image orientation. This service mosaic is not a current photograph.

Regenerate deliberately with `build_river_terrain.py <source.json>`,
`build_river_hydrography.py <source.json>` and `build_freeport_imagery.py`. The ordinary
site build uses bundled files and never acquires geography. Terrain elevations include
the survey's hydro-flattened surface; they are not underwater bathymetry. Imagery and
DEM can differ in acquisition date. Source line width is a cartographic choice.

## Water and data

The surface has Fresnel-weighted planar reflections, irregular advected noise normals
and sun highlights. Its fixed width, level, clarity and ripple motion have no hydraulic
interpretation. Pause stops the optical clock; reduced motion stops it automatically.
The scene does not infer local current direction from discharge in this tidally influenced
reach. No discharge-to-stage, bank flooding, velocity or bathymetry mapping is made.

The observation uses the same pinned station, parameter, statistic, unit, evidence type
and series match as RP11, then latest-at-or-before selection with 45-minute display
freshness. Future, competing and daily filtered records cannot substitute for current
instantaneous discharge. Provisional flags and time remain visible. History keeps the
separate 72137 daily product on `river.html?river=sacramento_river`.
Data initialization and refresh run independently of renderer initialization. Evidence,
history and station links remain usable when graphics fail. API outages never produce
synthetic display readings. Tests use clearly isolated synthetic fixtures only.

## Controls and limits

Bridge, Riverbank and Terrain buttons reset bounded cameras and disclose their frame.
Bridge angle adds four bank sides, east/west road approaches, underside and above.
The same complete model renders every angle. Drag looks; wheel/WASD moves.
Bank cameras stay on the selected bank at ground-relative eye height; approach cameras
stay inside the deck at deck-relative height. Underside is a bounded river-level inspection
camera; Above stays above the model. Terrain stays inside the loaded DEM at least 50 m
above ground. Keyboard movement is canvas-only and clears on blur/visibility changes.
Explore hides the title/card; Escape closes Evidence. Phone bank views frame the nearest
counterweight assembly; the overhead camera looks along the bridge to keep it in portrait.
Crossing the phone breakpoint reframes the selected bridge angle. Phone views retain the angle selector;
controls retain keyboard focus and touch targets. No native-GPU performance guarantee
is implied by browser visual checks.
