# Eel reference data and elevation audit — RP18

The user's "looks good" accepts RP17's first form baseline. RP18 adds source context
and a state watershed map while preserving its terrain, water and five fixed cameras.

## Inputs actually used

| Input | Origin / host | Use and limit |
| --- | --- | --- |
| 3DEP elevation | USGS National Map | 384 × 384 service export, 14.05296785 m cells; NAVD88 metres, UTM10 EPSG:32610. No exaggeration. Not a downloaded native 1 m DEM. |
| River flowlines / waterbody polygons | USGS 3DHP | Geographic channel context; mapped footprint is not today's wetted channel. |
| Aligned 1536 × 1536 aerial | USGS / USDA NAIP mosaic | Source aerial mode and authored cover/wet-color classification. Mosaic acquisition dates have not been resolved; retrieval date is not survey date. |
| USGS 11477000 station | USGS Water Data | Geographic anchor only, not current stage or surface elevation. |
| CalWater unit / area | California Interagency Watershed Mapping Committee / State Water Boards | Actual Eel River unit 1111 and Lower Eel area 11111 in the inset, with station and selected extent. State agencies and federal partners credited. |
| Scotia Bluffs 2016 photograph | Ellin Beltz / Wikimedia Commons, CC BY-SA 4.0 | Inspected visual reference, not distributed and not a measured camera match. |

Full source URLs and retrieval times accompany local geography. Primary services:
[3DEP](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer),
[3DHP](https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer),
[NAIP](https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer),
[station](https://waterdata.usgs.gov/monitoring-location/USGS-11477000/),
[CalWater](https://gispublic.waterboards.ca.gov/arcgis/rest/services/Hydrography/CalWater_Boundaries/MapServer),
[photograph](https://commons.wikimedia.org/wiki/File:Scotia_Bluffs_Railroad_Bridge_2016.jpg).

CalWater's boundaries were finalized in 1999; 2.2.1 attribution/documentation updated
in May 2004. Some boundaries are administrative rather than pure drainage divides.
The inset is geographic context, not legal jurisdiction, inundation or current flow.
Its north-up local equirectangular projection retains source vertices and holes;
the dashed rectangle is the author-selected request extent, not an exact terrain
cell-edge footprint. Full queried WGS84 polygons and service metadata are local.

## What “1 m LiDAR” currently means

**No 1 m DEM or LAS/LAZ point cloud is bundled for this scene.** The local cached
3DEP TIFF is the same roughly 14 m sampled export, not raw LiDAR. A 0.05 m encoding
increment describes elevation quantization, not spatial resolution or accuracy.
The general 3DEP mosaic's individual source project has not been resolved here.

- The checked [DWR NoCAL Wildfires B5a 2018 service](https://gis.water.ca.gov/arcgisimg/rest/services/elevation/CA_NoCAL_Wildfires_B5a_2018/ImageServer)
  advertises a 1 m grid, but its catalog returned **zero intersecting footprints**
  for this study request. This excludes that project only. It is state-hosted
  USGS-origin data, not automatically state-acquired survey data.
- [CA09_Perkins metadata](https://portal.opentopography.org/datasetMetadata?otCollectionID=OT.092012.26910.4)
  documents airborne LiDAR collected September 4, 2009, published October 23, 2012,
  by NCALM for UC Santa Cruz investigator Jonathan Perkins, funded by NSF. Its
  bare-earth raster is 1 m, NAD83(CORS96) / UTM10N metres (reported EPSG:26910),
  NAVD88 GEOID03 metres, CC BY 4.0. This is research data, not California state data.
- The actual [raster survey footprint](https://raw.githubusercontent.com/OpenTopography/Data_Catalog_Spatial_Boundaries/main/OpenTopography_Raster/CA09_Perkins.geojson)
  contains the Scotia station but misses three request corners and the primary,
  eye-level, shoreline and bend review targets. Its bounding rectangle alone would
  misleadingly imply wider coverage. The downloaded footprint is bundled for audit.
- The [bare-earth VRT](https://opentopography.s3.sdsc.edu/raster/CA09_Perkins/CA09_Perkins_be.vrt)
  independently confirms 1 × 1 m spacing. A northern raster tile is approximately
  246 MB with extensive NoData; it has not been downloaded. Raw point clouds are a
  separate product from this bare-earth DEM; neither provides submerged bathymetry.
- The National Map 1 m catalog request failed with a TLS connection reset.
  `usgs-1m-catalog.json` records the attempted URL and **unverified** status.
  Full-study 1 m coverage is therefore unknown, not disproved.

Reproduce deliberate acquisitions with `python pipeline/build_eel_state_sources.py`.
The browser loads bundled CalWater files and never calls external data APIs.
A future finer-terrain pass must validate footprint, source datum/units and NoData,
then use camera comparisons and LOD rather than render every source cell blindly.
Do not upsample the generic mosaic and label that a 1 m LiDAR acquisition.

## Review of the state context pass

The visible California data button opens the state inset at the top of Evidence.
No 3D mesh, camera, terrain, image classification or optical material changed.
The actual overview and state inset were inspected at 980 × 876 and 390 × 844.
State entry/Evidence controls, source links and terrain-resolution disclosure work;
phone document width is 390 px with no browser errors. Five focused tests, river
package validation and the 117-module build pass. Actual screenshots:
[desktop state inset](../../../../../../../previews/eel/rp18-desktop-state.png),
[phone state inset](../../../../../../../previews/eel/rp18-phone-state.png),
[phone entry](../../../../../../../previews/eel/rp18-phone.png).
The two full watershed files add approximately 1.23 MiB uncompressed source data
to the page. The map adds DOM/SVG work; it does not add Three.js geometry or textures.
Frame cost and total browser memory have not been remeasured for this UI pass.
