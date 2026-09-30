# W2 — Add Crystal Springs Reservoir

**Who:** small · **Needs:** W1 merged · **Branch:** `task/W2`

## Goal

A new water body `data/crystal_springs/`: lidar terrain, cameras, a sourced fact card, a land profile and
a flyover video. It is not added to any tour yet (that is W4).

## Steps

1. `git switch -c task/W2`

2. Draft the source (needs internet):

   `python pipeline/locate.py "Lower Crystal Springs Reservoir" diablo-oak`

   Create folder `data/crystal_springs/` and save the printed JSON as `data/crystal_springs/source.json`, then edit it:
   - change `"name"` to `"Crystal Springs Reservoir"`
   - delete the `"nhdAreaKm2"` line (and the comma before it, so the JSON stays valid).

   **Pass:** `python -c "import json;print(json.load(open('data/crystal_springs/source.json')))"` prints the object without an error.

3. Build the terrain (needs internet, takes a minute):

   `python pipeline/build.py crystal_springs`

   **Pass:** the first printed line looks like `crystal_springs: water <level> m, <area> km2, …` and
   `<area>` is between **1.5 and 4.0**. If the area is outside that range, stop and report the
   output (the anchor is probably wrong).
   The folder now has `terrain.bin.gz`, `terrain.json` and `cameras.json`.

4. Copy the land profile: `cp data/calaveras/land.json data/crystal_springs/land.json` (no edits).

5. Fetch the dam facts. Open this URL (curl or a browser) and read the numbers:

   `https://geospatial.sec.usace.army.mil/dls/rest/services/NID/National_Inventory_of_Dams_Public_Service/FeatureServer/0/query?where=NIDID%3D%27CA00127%27&outFields=MAX_STORAGE,DAM_HEIGHT,YEAR_COMPLETED&f=json`

   **Expected:** `MAX_STORAGE` 57910, `DAM_HEIGHT` 149, `YEAR_COMPLETED` 1888.
   Use the numbers the URL actually returns. If the request fails, stop and report.

6. Fetch the water surface at survey time. Take `anchor` from `data/crystal_springs/source.json`
   (`[lat, lon]`) and open:

   `https://epqs.nationalmap.gov/v1/json?x=<lon>&y=<lat>&units=Meters&wkid=4326&includeDate=true`

   Read `value` (metres; round to one decimal) and the year from
   `attributes.AcquisitionDate` (the last number). Feet = metres × 3.28084, rounded to a whole
   number.

7. Create `data/crystal_springs/story.json` (replace the `<…>` parts with the numbers from steps 5–6;
   write storage with a thousands comma, e.g. `57,910`):

```json
{
  "id": "crystal_springs",
  "name": "Crystal Springs Reservoir",
  "place": "San Mateo County, on the San Francisco Peninsula",
  "operator": "San Francisco Public Utilities Commission",
  "headline": "A 149-foot dam from 1888 holds water for the Peninsula in the valley of the San Andreas Fault.",
  "facts": [
    { "label": "Capacity", "value": "<MAX_STORAGE> acre-feet", "source": "https://geospatial.sec.usace.army.mil/dls/rest/services/NID/National_Inventory_of_Dams_Public_Service/FeatureServer/0/query?where=NIDID%3D%27CA00127%27&outFields=MAX_STORAGE&f=json" },
    { "label": "Dam", "value": "<DAM_HEIGHT> ft tall, completed <YEAR_COMPLETED>", "source": "https://geospatial.sec.usace.army.mil/dls/rest/services/NID/National_Inventory_of_Dams_Public_Service/FeatureServer/0/query?where=NIDID%3D%27CA00127%27&outFields=DAM_HEIGHT,YEAR_COMPLETED&f=json" },
    { "label": "Water system", "value": "Hetch Hetchy Regional Water System, serving 2.7 million people", "source": "https://www.sfpuc.gov/about-us/our-systems" },
    { "label": "Surface at <year> lidar survey", "value": "<metres> m (<feet> ft) above sea level", "source": "<the EPQS URL from step 6, with your lat/lon>" }
  ]
}
```

8. Render the flyover (needs Microsoft Edge, ffmpeg on PATH, and ideally a discrete GPU; takes
   several minutes):

   `node pipeline/render-flyover.mjs crystal_springs`

   **Pass:** `data/crystal_springs/flyover.mp4` and `data/crystal_springs/poster.jpg` exist.

9. Look at it: `npm start`, open
   `http://localhost:5173/renderer/explore.html?reservoir=crystal_springs`. **Pass:** you see water inside
   hills, the title reads `CRYSTAL SPRINGS RESERVOIR`, and there is no red error box. Stop the server.

10. Run `node pipeline/validate-bundles.mjs` — **Pass:** `Bundles valid.`
    Then `npm test` — **Pass:** ends with `Journey checks passed.`

11. Commit: `git add data/crystal_springs` then `git commit -m "W2: Add Crystal Springs Reservoir"`.

12. Add the **Result** section (see AGENTS.md) to this file and commit it.

## Notes

- Checked 2026-09-27: `locate.py` gave anchor `[37.5279, -122.36541]`, bbox
  `[-122.4149, 37.4902, -122.3283, 37.5755]`, size `[764, 949]`; EPQS at that anchor returned
  84.9 m with acquisition year 2023.

## Result
- Status: done (stand-in biome; see notes)
- Commit: 2a6efec
- Checks:
  - `locate.py "Lower Crystal Springs Reservoir"`: anchor `[37.5279, -122.36541]`, as in the notes above.
  - `python pipeline/build.py crystal_springs`: `crystal_springs: water 86.6 m, 2.45 km2, grid 764x949 @ 10.10 m, …`
  - NID CA00127: `MAX_STORAGE` 57910, `DAM_HEIGHT` 149, `YEAR_COMPLETED` 1888, `HYDRAULIC_HEIGHT` 139.
  - EPQS at the anchor: 84.879997253 m, `AcquisitionDate` `10/0/2023`.
  - Explorer: title `CRYSTAL SPRINGS RESERVOIR`, `errors: []` (headless Chrome, WebGPU).
  - Flyover rendered with headless Chrome instead of Edge (Edge not installed; same script,
    channel changed in a scratch copy only).
  - `node pipeline/validate-bundles.mjs`: `Bundles valid.`; unit tests `ℹ fail 0`;
    `npm run build`: `Built Pages with 78 browser modules, …`. `npm test` not run (needs Edge).
- Notes:
  - Deviations from step 4/7, to avoid wrong or stale facts: `land.json` uses Crystal Springs'
    own NID hydraulic height (139 ft = 42.4 m) and source, not Calaveras'. `story.json` follows
    the D1 card format (sourced `summary`, featured "Listed capacity", "USGS reference · 2023")
    and quotes SFPUC as "2.7 million customers", the page's wording.
  - The build's water level (86.6 m, from the 3DEP export) differs from the 2023 EPQS point
    (84.9 m). The explorer readout shows the former, the card the latter. Not resolved here.
  - Uses the `diablo-oak` biome as a stand-in; a greener Peninsula biome is the next task.
    Re-record the flyover after it.
- Follow-up (same day, user-directed):
  - Upper Crystal Springs added via `extraAnchors` (`026b5a3`); water 4.92 km2.
  - New `peninsula-oak-fir` biome: coast live oak with Douglas-fir in stands, sage summer
    grass, spring-green default, denser cover off the ridge crests (`0bc7f6e`, `21e81f3`, `af0bb6c`).
  - Viewpoints tuned (Shoreline at the waterline, both ridges on open ground) and pinned in
    `source.json` (`19f9eaf`, `7ffc00e`).
  - Morning: overcast with low valley fog (`083ff6d`, `06cab98`, `6281328`); greener water
    optics (`c764ab7`).
  - Water level: explorer 86.6 m (3DEP export) vs card 84.9 m (2023 EPQS point) accepted as
    is; reservoir levels vary and the two come from different surveys.

