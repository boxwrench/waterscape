// Historical extremes at USGS-11467000 (Russian River near Guerneville, Hacienda) and the
// Illustrative mapping from discharge to the authored scene's water surface height.
// Values were fetched from the USGS Water Data OGC API on 2026-10-02; each carries its URL
// (see docs/roadmap/tasks/RP11-hacienda-high-low.md).

const API = "https://api.waterdata.usgs.gov/ogcapi/v1/collections";

export const HACIENDA_EXTREMES = Object.freeze({
  gauge: "USGS-11467000",
  low: Object.freeze({
    label: "Record low flow",
    dischargeCfs: 0.75,
    date: "1977-05-06",
    note: "Lowest daily mean discharge of record. USGS publishes no stage for this day.",
    source: `${API}/daily/items?monitoring_location_id=USGS-11467000&parameter_code=00060&statistic_id=00003&limit=1&sortby=value&f=json`,
  }),
  high: Object.freeze({
    label: "Record high stage",
    stageFt: 49.7,
    dischargeCfs: 90100,
    date: "1955-12-23",
    note: "Highest annual-peak gage height of record (86 annual peaks, 1940 to 2025).",
    source: `${API}/peaks/items?monitoring_location_id=USGS-11467000&parameter_code=00065&limit=500&f=json`,
    dischargeSource: `${API}/peaks/items?monitoring_location_id=USGS-11467000&parameter_code=00060&limit=500&f=json`,
  }),
});

// The authored scene's water surface (y = 0) is its summer baseline of about 100 ft³/s. Height
// above or below it follows the logarithm of discharge: 1.1 m per tenfold change. The real
// swing from 1 ft to 49.7 ft of stage is about 15 m; the scene shows 5.5 m of it.
export const SCENE_BASELINE_CFS = 100;
export const METRES_PER_DECADE = 1.1;

export function sceneWaterLevel(dischargeCfs) {
  if (dischargeCfs == null) return 0;
  const q = Number(dischargeCfs);
  if (!Number.isFinite(q) || q < 0) return 0;
  const floor = HACIENDA_EXTREMES.low.dischargeCfs;
  return Math.log10(Math.max(q, floor) / SCENE_BASELINE_CFS) * METRES_PER_DECADE;
}
