# California river overview — RP12

`/river-pulse/` now opens a statewide relief atlas. Named river geometry and its labels
are native links: Russian River opens Hacienda, and Sacramento, San Joaquin, Eel,
Tuolumne and American open `river.html?river=<id>`. Russian River's preview also links
to Jenner. Details and observations from RP11 are preserved in `river.js`/`river.css`.

Hover or keyboard focus highlights a river and changes the preview. Enter follows the
link; touch follows the map label or river-list link. The map renders entirely from
committed local assets. Gauge fetches begin only on the separate data page. Keyboard
outlines, a skip link and source disclosure remain available; there is no autonomous
animation, and stroke transitions respect reduced motion.

## Geography and processing

- [Census TIGERweb generalized 2022 state boundaries](https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2022/State_County/MapServer/7): California `STATE='06'`, 1:500,000 scale.
- [USGS 3DHP flowline service](https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer/50): queries for the six exact river names, plus North/Middle/South Fork American River, in the California bounding envelope. Pagination consumed all 6,477 returned features, including source segments through water bodies. This service can include legacy hydrography.
- [USGS 3DEP elevation service](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer): `Hillshade Elevation Tinted` raster function, 900 × 1100 JPEG export over the same projected extent.

`pipeline/build_california_overview.py` records every query and retrieval time in the
compact overview JSON. DWR's Major Rivers service reported that it was not started, so
this pass uses the authoritative USGS source instead. The first larger shaded-relief
image URL timed out; the smaller direct export succeeded. Regeneration is deliberate,
not part of ordinary builds and does not require a service connection for viewing.

Source geometry is requested in EPSG:3857. A uniform transform maps eastings to SVG x
and northings to inverted SVG y, preserving north up. Source extent is expanded to the
raster aspect ratio, with no independent stretching. The service generalizes flowlines
by 200 projected metres; SVG coordinates round to hundredths of a display unit. State
polygons use even-odd clipping and retain islands. Disconnected river segments remain
disconnected. Connector anchors are actual source vertices; label placement is authored.

This is not a full river network or a completeness audit. The displayed named reaches
are sufficient for navigation; dams, diversions, unnamed connecting reaches and the
Delta can leave source gaps. Line width and glow make rivers legible, not measured
channel banks. Selection gold is interface state, not flow magnitude. The terrain ramp
shows elevation, not vegetation or land cover. The floating edge/shadow is decorative,
not a height extrusion of the DEM or surveyed ocean bathymetry. No current-flow or
hydraulic meaning is assigned to the overview.

## Visual direction and saved references

The user requested inspiration from the existing detailed reservoir/Russian River work
and their [saved resource library](../../resources/README.md). Calaveras overlook and
Jenner coastal previews were inspected. The overview carries forward terrain depth,
muted green/gold land, teal water and restrained atmospheric separation. Clearwater
and Tidewater inform readable water/shore contrast; Hai no Michi informs terrain detail;
River Bend informs geography-led storytelling. These are visual references: no new
upstream code, textures or reference photos are copied into this map.

Desktop keeps the whole California silhouette visible. Mobile uses larger SVG label
boxes and a stacked map, preview and river list. The existing local 3D scenes retain
their own rendering and water systems. Sacramento still has a data foundation, not a
finished local terrain/3D scene.
