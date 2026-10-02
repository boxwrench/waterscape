# RP11: Hacienda historical high and low water

Close-ups show a historical high and low so viewers can judge scale (see
[River structure](../../river-pulse/river-structure.md)). Gauge: USGS-11467000, Russian River
near Guerneville (Hacienda). Facts fetched 2026-10-02 from the USGS Water Data OGC API
(`https://api.waterdata.usgs.gov/ogcapi/v1`).

## What the API gives for gage height (parameter 00065, ft)

| Quantity | Value | Source |
|---|---|---|
| Highest annual-peak gage height of record | **49.7 ft**, 1955-12-23 | `.../collections/peaks/items?monitoring_location_id=USGS-11467000&parameter_code=00065&limit=500&f=json` (86 annual peaks, 1940-02-28 to 2025-02-05) |
| Highest annual peak since 2007 | 47.55 ft, 2019-02-28 | same |
| Lowest annual peak | 7.31 ft, 2021-02-03 (an annual maximum, not a low-water stage) | same |
| Continuous record begins | 2025-10-02 (about one year) | `.../collections/continuous/items?monitoring_location_id=USGS-11467000&parameter_code=00065&limit=1&sortby=time&f=json` |
| Lowest stage in that year | **0.79 ft**, 2026-07-02 | `.../collections/continuous/items?...&parameter_code=00065&limit=2&sortby=value&f=json` |
| Highest stage in that year | 9.99 ft, 2026-03-05 | same with `sortby=-value` |
| Latest | 1.07 ft, 2026-10-02 13:15 UTC | `.../collections/latest-continuous/items?monitoring_location_id=USGS-11467000&parameter_code=00065&f=json` |

Related discharge facts: lowest daily mean discharge of record 0.75 ft³/s on 1977-05-06
(`.../collections/daily/items?monitoring_location_id=USGS-11467000&parameter_code=00060&statistic_id=00003&limit=1&sortby=value&f=json`);
highest annual peak discharge 102,000 ft³/s on 1986-02-18, qualified REGULATED
(peaks collection, parameter 00060).

## Gaps

- **No long-term low stage.** USGS publishes no daily gage height for this gauge, and the
  continuous stage record is only about a year long. A "historical low" of record is not
  available as stage. The honest options are the past-year low (0.79 ft) labelled as such, or
  the 1977 record-low discharge shown as discharge.
- **The high is an annual peak** (the highest instantaneous value in a water year), not a
  daily value.
- **Scale.** Latest stage is 1.07 ft and the record peak 49.7 ft: a 48.6 ft (14.8 m) swing,
  close to the authored bridge's 13 m deck line. The record high is mapped to the underside of
  the bridge steel (11.7 m), as the user confirmed the great floods reach it; below the baseline
  the level falls 1.1 m per decade of discharge. Declared Illustrative, with the real values shown.
