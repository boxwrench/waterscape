# Crystal Springs Reservoir Minecraft world

Task: [MC6](../../docs/roadmap/tasks/MC6-crystal-springs.md). A fresh Java 26.3 world built in one
step from the Crystal Springs [terrain](../../data/crystal_springs/terrain.json),
[land settings](../../data/crystal_springs/land.json) and
[camera positions](../../data/crystal_springs/cameras.json), with constants in the
[site file](sites/crystal_springs.json) and blocks in the [Peninsula palette](palettes/peninsula-oak-fir.json).
The builder is the same one as Calaveras ([`build_reservoir.py`](build_reservoir.py)).

## What is real and what is approximate

- **From data:** terrain and shoreline (USGS 3DEP via the bundle, about 10 m cells), the lake
  level, Lower Crystal Springs Dam's crest line and elevation (traced on a 1 m USGS NAIP image and
  moved onto the 3DEP ridge, URLs in the site file), its stilling basin (traced on the same image),
  its type, height and length (National Inventory of Dams), and the highway causeway between the
  upper and lower lakes (traced on NAIP, its top from 1 m 3DEP: the bundle's 10 m grid had run the
  lakes together).
- **From the browser's rules:** where grass, soil and rock go (`renderer/land/ground.js`, spring
  grass) and where every tree stands and which species it is (`renderer/land/oak-placement.js`:
  the 9 m lattice, `cover` 0.55 for the Peninsula's woodland, Douglas-fir grouped in stands).
  The browser's stands rule makes Douglas-fir about a quarter of the trees, although `land.json`
  weights it 0.1.
- **Approximate or illustrative:** block choices and the grass colour, tree shapes (coast live oak
  as dark oak crowns, Douglas-fir as spruce cones), the lake bed (synthetic), the dam's crest
  width and stepped face (0.75 horizontal to 1 vertical), and the spillway, drawn as the part of
  the face above the stilling basin.
- **Pulgas Water Temple** ([MC7](../../docs/roadmap/tasks/MC7-pulgas-temple.md)): built at
  **1 m per block**, four times the land around it (the maintainer's choice: at 4 m per block the
  temple would be a 3-block ring). The temple centre, the pool (38 × 13 m, its axis through the
  temple), the cypress spacing (3.3 m) and the canal line are measured on NAIP; heights and radii
  come from the maintainer's [Blender model](https://github.com/boxwrench/water_temple), one
  model unit being 13.2 m (the landing's terracotta ring, 4.8 m in radius on NAIP); the setting
  (turquoise pool, white coping, lavender either side of the front steps, cypress taller than the
  temple) follows photographs. The complex is centred on its real middle, and slid back along its axis to
  stay inside the bundle, which ends just east of the pool, so the temple stands about 104 m
  west-southwest of its true spot; the canal follows the traced line to its real mouth,
  then crosses the bundle's flat shore to the lake, with water (the temple's own flow was
  diverted in 2004). Blocks are illustrative.
- **Not drawn:** towns, other roads and the I-280 bridge. Both lakes share one water level, as in
  the bundle.

Scale: 4 m per block on every axis (true proportions); the crop is 7.1 × 9.1 km
(1,776 × 2,272 blocks). Water is at y = 65; the dam crest at y = 67, its toe at y = 55.

## Build

From the repository root, with `numpy`, `scipy`, `Pillow` and `nbtlib`:

```text
python experimental/minecraft/build_reservoir.py --site experimental/minecraft/sites/crystal_springs.json \
    --template "<Java 26.3 save>" --out "<new save folder>" --server-jar ~/mc-server/versions/26.3/server-26.3.jar
```

It takes about a minute, checks the lake for leaks, compares a sample of chunks block for block,
and writes `waterscape-build.json` and an overhead preview.

## Review

Open the world in Java 26.3 as a creative world. It starts at the northwest ridge.

| View | Command |
|---|---|
| Northwest ridge | `/tp @s 360 102 855 -94.2 4.5` |
| South ridge | `/tp @s 1030 120 2195 167.9 3.2` |
| Shoreline | `/tp @s 407 67 810 -145 24.1` |
| Dam face, above the creek below it | `/tp @s 768 72 838 90 15` |
| Along the dam crest | `/tp @s 724 69 822 -27 10` |
| Pulgas Water Temple from the end of the reflecting pool | `/tp @s 1766 68 2090 74 6` |
| The temple from its front path, between the lavender | `/tp @s 1724 68 2102 74 -12` |
| The canal behind the temple | `/tp @s 1689 69 2112 -106 12` |

## Result

2026-11-21: 15,762 chunks, 170 decoded and compared block for block, lake leaks 0; 591,025 trees
(coast live oak 450,438, Douglas-fir 140,587); dam crest y 67, 12 blocks above its toe, stepped
face 564 cells, spillway 116, stilling basin 72 cells with water. The overhead was compared with
the NAIP aerial and the dam and causeway with isometric renders; the world loaded on a Fabric 26.3
server with no errors and the `file/waterscape-peninsula` datapack enabled. In-game review by the
maintainer is pending.
