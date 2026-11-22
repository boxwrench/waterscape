# MC8: Sunol Valley: San Antonio and Calaveras reservoirs in one Minecraft world

**Who:** capable · **Needs:** the San Antonio and Calaveras bundles, MC2's builder
(`build_reservoir.py`) and palette (`diablo-oak`) · **Branch:** `task/MC8-sunol-valley`

## Goal

One playable Java 26.3 world from the Sunol Water Temple (its western edge) east across the Sunol
Valley to both reservoirs, with Alameda Creek between them. Natural features first: terrain, the
two lakes at their own levels, the creeks, oak woodland and grass, both dams. Then placeholders
(plain structures on the real footprints) for the Sunol Water Temple, the Sunol Valley Water
Treatment Plant and the Sunol Valley Chloramination Facility.

## Maintainer decisions (2026-11-22)

- 4 m per block across; 3 m per block up (hills 1.33× taller), so Calaveras stands 27 blocks
  above San Antonio (82 m: 223.7 against 141.7 m in the bundles).
- Lidar detail at the reservoirs; generally accurate GIS terrain elsewhere.
- Natural features first, placeholders for the three structures.
- Hosting later: the same server, as a second world (a datapack dimension), after the
  maintainer's in-game look.

## Stop rules

- Terrain from USGS 3DEP (URLs recorded): 1 to 2 m lidar windows around both lakes, 10 m
  elsewhere, blended. Lake outlines and levels from the lidar's flattened water at each bundle's
  anchor. Lake beds are synthetic (each bundle's `land.json` bank slope and depth cap).
- Dams from the NID records and traced on NAIP; creek lines from OpenStreetMap; footprints from
  OpenStreetMap or traced on NAIP. Heights of placeholders are illustrative and marked so.
- Calaveras and Crystal Springs must still build byte for byte the same.
- Never edit a live or open world; build into a new folder.

## Steps

1. `make_valley_terrain.py`: fetch and blend the terrain into a bundle-format grid at 4 m with
   both lakes (`build/sunol_valley/`, not committed; the script records its sources).
2. `build_reservoir.py`: several lakes with their own levels, several dams, a vertical scale;
   creeks; footprint placeholders. `sites/sunol_valley.json` holds the crop, lakes, dams, creeks
   and structures with their sources.
3. Build, check (leaks, creek containment, NBT audit), overhead render beside the aerial,
   install a review save; the maintainer's look.

## Sources gathered

- Turner Dam (San Antonio): NID CA00132, earth, 193 ft, 2,160 ft long, 1964:
  https://geospatial.sec.usace.army.mil/dls/rest/services/NID/National_Inventory_of_Dams_Public_Service/FeatureServer/0/query?where=NIDID%3D%27CA00132%27&outFields=NAME,NIDID,PRIMARY_DAM_TYPE,NID_HEIGHT,DAM_LENGTH,YEAR_COMPLETED&f=json
- Sunol Water Temple: OpenStreetMap way 1002107868 (a round footprint about 12 m across).
- Sunol Valley Water Treatment Plant: 28 acres about 3 miles south of Calaveras Road and I-680
  (CEQA SCH 2007082014, https://ceqanet.lci.ca.gov/2007082014/8); footprint traced on NAIP.
- Sunol Valley Chloramination Facility: 5555 Calaveras Rd, Sunol (SFPUC bid WD-2893,
  https://webapps.sfpuc.org/bids/BidDetail.aspx?bidid=4464); no footprint found, location to be
  confirmed with the maintainer.
- Creeks: OpenStreetMap ways named Alameda Creek, Calaveras Creek and San Antonio Creek.

## Result
- Status: natural features and two of three placeholders built; the maintainer's in-game look
  pending; the chloramination facility waits for its location.
- Commit: see the branch (this Result is in the same commit).
- Checks:
  - `make_valley_terrain.py`: San Antonio 204,833 cells at 141.7 m and Calaveras 210,844 at
    223.7 m from the lidar, each matching its bundle; Calaveras's north arm (65,815 cells,
    flattened at 221.5 m in another 3DEP survey) joined to it; heights 7.8 to 824.2 m.
  - `build_reservoir.py --site sites/sunol_valley.json`: 55,277 chunks (601 decoded and
    compared), 1,552,071 trees, lakes at y 40 and y 67, lake leaks 0, creek spills 0 (17,846
    creek cells, deepest cut 6 blocks, banks raised at most 3 blocks), in 2 min 41 s.
  - Calaveras and Crystal Springs rebuilt with the changed builder: region files and overview
    images byte for byte identical to builds from the previous code.
  - Overhead render beside the NAIP image of the same area: lakes, dams, the treatment plant
    and the valley line up; Calaveras now reaches its dam as in the photograph.
  - `node --test "pipeline/tests/*.test.mjs"` → `ℹ fail 0`; `node scripts/check-doc-links.mjs` →
    `Documentation links valid (148 Markdown files).`
  - Not yet opened in the game client.
- Notes:
  - Terrain: 2 m 3DEP (1 m lidar here) averaged to the 4 m blocks in two lake windows, feathered
    over 400 m into 10 m 3DEP; fetched in 1,024 px tiles (the service fails on larger requests).
  - Calaveras in the lidar is lower than in recent photographs (the survey dates from the dam's
    rebuilding); the world follows the lidar, as the browser bundle does.
  - Tree density follows the browser's oak rules (as in the Calaveras world); the photographs
    show more open grass on south-facing slopes.
  - Creek lines are from OpenStreetMap (ODbL, attributed in `sites/sunol_valley.creeks.json`);
    USGS NHD is the public-domain alternative.
  - The terrain grid and lidar cache are in `experimental/minecraft/build/` (not committed).
