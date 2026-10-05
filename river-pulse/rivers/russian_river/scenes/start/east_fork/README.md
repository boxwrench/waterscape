# East Fork — below Coyote Valley Dam

<!-- scene-card: generated from scene.json; edit scene.json, then run node scripts/sync-river-readmes.mjs -->
> **Scene card**
>
> | | |
> |---|---|
> | River / slot | `russian_river` / `start` |
> | Place id | `east_fork` |
> | Fidelity | Photo-informed setting; no live gauge (the nearby USGS station's record ended in 2011) |
> | Data | geography only |
> | Views | Riverbank, Below the outlet, Map |
> | Open locally | <http://localhost:5173/river-pulse/rivers/russian_river/scenes/start/east_fork/index.html> |
> | Layout | page `index.html`, scene code beside it, sourced data in `data/`, notes in `notes/` |
<!-- /scene-card -->


The upstream authored place of the Russian River journey is the East Fork below Lake
Mendocino. This is a local preview, not a rebuilt reservoir bundle. LM1's lake-side earthfill
and intake renderer pieces remain on their separate branch; the intake is behind the
embankment from these downstream bank views.

## References inspected October 1, 2026

- [UC San Diego outlet photograph](https://today.ucsd.edu/news_uploads/CoyoteValleyDam_05_705_1.jpg),
  from its [FIRO article](https://today.ucsd.edu/story/new-forecast-informed-decision-making-tool-implemented-at-lake-mendocino):
  broad earthen face, crest, paired concrete openings, sloped wing walls, service railings and
  grey riprap. This photograph shows a release under greener seasonal conditions; it is not
  today's operations or season.
- [User-selected dam gallery](https://rs.locationshub.com/Home/LocationDetail?rsLocationId=050-10120170),
  including its [intake photograph](https://ca.reel-scout.com/up_images/9/md/3355839.jpg): dry
  oak-covered hills, concrete tower and metal walkway. The downstream setting uses a dry
  grass palette; neither photo is redistributed.
- [USGS 11462000](https://waterdata.usgs.gov/monitoring-location/USGS-11462000/): manifest/map
  anchor copied from station coordinates; the continuous record ends in 2011. This branch
  adds no live discharge or stage binding and no Low/High reconstruction from discharge.
- [USACE operations report](https://www.spk-wc.usace.army.mil/fcgi-bin/monthly.py?report=coy)
  is linked for dam operations; its changing records are not silently bundled as current.

## Representation

| Element | Class | Meaning |
|---|---|---|
| Dam, outlet, banks, dry grass, oaks and bounded cameras | Setting | Photo-informed authored display sizes and local coordinates, not as-built dimensions or surveyed banks. Buildings are omitted. |
| Green water, ripples, fixed surface, modeled bed, outlet foam | Illustrative | Visible water detail and release concept; not measured flow, turbidity, bathymetry, stage or current operations. |
| Water reflections, refraction and approximate caustics | Derived | Computed by the existing authored-water module from illustrative surface/bed/light inputs. |
| Geographic map centerlines and pins | Exact to source geometry / projected | USGS cartographic lines, simplified by the service; manifest anchors. No inferred channel width. |

The Riverbank view starts on dry ground beside the modeled shoreline at eye height. Below
the outlet moves closer to the concrete works. Movement remains in a small dry-bank area;
water and grass motion pause together, and reduced motion freezes both.

## Resources and map

The existing local CC0 Poly Haven rock/pebble materials, MIT ez-tree oak meshes, MIT grass
cutouts and reservoir grass-color image are reused. See `THIRD_PARTY_NOTICES.md`. Periodic
noise and sky reuse the Jenner modules; their Tidewater MIT attribution is unchanged.

The compact map uses `rivers/russian_river/map/overview.json`, fetched from USGS 3DHP
when DWR's service returned "Service ... not started". The exact request, date, CRS and
simplification are recorded in that file. Pins load from the package registry and link to
all three authored places. Hacienda's underlying 3D map retains its sourced local terrain;
the inset is not an aerial photograph or a whole-river DEM.

Lake Mendocino's separate reservoir outline remains unresolved after another NHD timeout.
No storage values, synthetic lake outline or lake terrain are added here.
