# W3 — Add San Andreas Lake

**Who:** small · **Needs:** W1 merged · **Branch:** `task/W3`

## Goal

A new water body `data/san_andreas/`: lidar terrain, cameras, a sourced fact card, a land profile and
a flyover video. It is not added to any tour yet (that is W4).

## Steps

1. `git switch -c task/W3`

2. Draft the source (needs internet):

   `python pipeline/locate.py "San Andreas Lake" diablo-oak`

   Create folder `data/san_andreas/` and save the printed JSON as `data/san_andreas/source.json`, then edit it:
   - change `"name"` to `"San Andreas Lake"`
   - delete the `"nhdAreaKm2"` line (and the comma before it, so the JSON stays valid).

   **Pass:** `python -c "import json;print(json.load(open('data/san_andreas/source.json')))"` prints the object without an error.

3. Build the terrain (needs internet, takes a minute):

   `python pipeline/build.py san_andreas`

   **Pass:** the first printed line looks like `san_andreas: water <level> m, <area> km2, …` and
   `<area>` is between **1.5 and 4.0**. If the area is outside that range, stop and report the
   output (the anchor is probably wrong).
   The folder now has `terrain.bin.gz`, `terrain.json` and `cameras.json`.

4. Copy the land profile: `cp data/calaveras/land.json data/san_andreas/land.json` (no edits).

5. Fetch the dam facts. Open this URL (curl or a browser) and read the numbers:

   `https://geospatial.sec.usace.army.mil/dls/rest/services/NID/National_Inventory_of_Dams_Public_Service/FeatureServer/0/query?where=NIDID%3D%27CA00129%27&outFields=MAX_STORAGE,DAM_HEIGHT,YEAR_COMPLETED&f=json`

   **Expected:** `MAX_STORAGE` 19027, `DAM_HEIGHT` 107, `YEAR_COMPLETED` 1870.
   Use the numbers the URL actually returns. If the request fails, stop and report.

6. Fetch the water surface at survey time. Take `anchor` from `data/san_andreas/source.json`
   (`[lat, lon]`) and open:

   `https://epqs.nationalmap.gov/v1/json?x=<lon>&y=<lat>&units=Meters&wkid=4326&includeDate=true`

   Read `value` (metres; round to one decimal) and the year from
   `attributes.AcquisitionDate` (the last number). Feet = metres × 3.28084, rounded to a whole
   number.

7. Create `data/san_andreas/story.json` (replace the `<…>` parts with the numbers from steps 5–6;
   write storage with a thousands comma, e.g. `57,910`):

```json
{
  "id": "san_andreas",
  "name": "San Andreas Lake",
  "place": "San Mateo County, on the San Francisco Peninsula",
  "operator": "San Francisco Public Utilities Commission",
  "headline": "The valley this lake floods gave the San Andreas Fault its name.",
  "facts": [
    { "label": "Capacity", "value": "<MAX_STORAGE> acre-feet", "source": "https://geospatial.sec.usace.army.mil/dls/rest/services/NID/National_Inventory_of_Dams_Public_Service/FeatureServer/0/query?where=NIDID%3D%27CA00129%27&outFields=MAX_STORAGE&f=json" },
    { "label": "Dam", "value": "<DAM_HEIGHT> ft tall, completed <YEAR_COMPLETED>", "source": "https://geospatial.sec.usace.army.mil/dls/rest/services/NID/National_Inventory_of_Dams_Public_Service/FeatureServer/0/query?where=NIDID%3D%27CA00129%27&outFields=DAM_HEIGHT,YEAR_COMPLETED&f=json" },
    { "label": "Water system", "value": "Hetch Hetchy Regional Water System, serving 2.7 million people", "source": "https://www.sfpuc.gov/about-us/our-systems" },
    { "label": "Surface at <year> lidar survey", "value": "<metres> m (<feet> ft) above sea level", "source": "<the EPQS URL from step 6, with your lat/lon>" }
  ]
}
```

8. Render the flyover (needs Microsoft Edge, ffmpeg on PATH, and ideally a discrete GPU; takes
   several minutes):

   `node pipeline/render-flyover.mjs san_andreas`

   **Pass:** `data/san_andreas/flyover.mp4` and `data/san_andreas/poster.jpg` exist.

9. Look at it: `npm start`, open
   `http://localhost:5173/renderer/explore.html?reservoir=san_andreas`. **Pass:** you see water inside
   hills, the title reads `SAN ANDREAS LAKE`, and there is no red error box. Stop the server.

10. Run `node pipeline/validate-bundles.mjs` — **Pass:** `Bundles valid.`
    Then `npm test` — **Pass:** ends with `Journey checks passed.`

11. Commit: `git add data/san_andreas` then `git commit -m "W3: Add San Andreas Lake"`.

12. Add the **Result** section (see AGENTS.md) to this file and commit it.

## Notes

- The NHD name is exactly `San Andreas Lake` (checked 2026-09-27: 1.97 km²).

## Result
- Status: done
- Commit: ae8d02d
- Checks:
  - `locate.py "San Andreas Lake"`: anchor `[37.59082, -122.42208]`; build: `san_andreas: water 136.4 m, 1.90 km2, grid 676x783 @ 10.07 m, …`
  - NID CA00129: `MAX_STORAGE` 19027, `DAM_HEIGHT` 107, `YEAR_COMPLETED` 1870, `HYDRAULIC_HEIGHT` 97. EPQS: 134.350006104 m, 2023.
  - `node pipeline/validate-bundles.mjs`: `Bundles valid.`; unit tests `ℹ fail 0`.
  - Explorer: title `SAN ANDREAS LAKE`, `errors: []`; flyover rendered (headless Chrome with WebGPU flags; no Edge here).
- Notes: uses Crystal Springs' look (`peninsula-oak-fir`, sage summer, spring default, morning fog,
  green water) rather than a copy of Calaveras' land.json, and San Andreas' own hydraulic height
  (97 ft = 29.6 m). Viewpoints tuned for tree cover and pinned in `source.json`; the second
  ridge is now "South ridge". Card uses the D1 format and SFPUC's "customers" wording.
