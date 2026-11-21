# Calaveras Reservoir Minecraft world

Task: [MC2](../../docs/roadmap/tasks/MC2-calaveras.md). A fresh Java 26.3 world built in one step
from the Calaveras [terrain](../../data/calaveras/terrain.json),
[land settings](../../data/calaveras/land.json) and [camera positions](../../data/calaveras/cameras.json),
with constants in the [site file](sites/calaveras.json) and blocks in the
[Diablo oak palette](palettes/diablo-oak.json).

## What is real and what is approximate

- **From data:** terrain and shoreline (USGS 3DEP via the bundle, about 10 m cells), the lake
  level, the dam's crest line, crest elevation and spillway (traced on a 1 m USGS NAIP image and
  3DEP, with the URLs in the site file), its type, height and length (National Inventory of Dams).
- **From the browser's rules:** where grass, soil and rock go (`renderer/land/ground.js`) and
  where every oak stands (`renderer/land/oak-placement.js`, ported exactly: the same 9 m lattice,
  hash and density). Species follow `land.json` (coast live 50 %, blue 30 %, valley 20 %).
- **Approximate or illustrative:** block choices and the summer-gold grass colour, the block
  shape of each oak, the lake bed (synthetic, from the bank slope and depth cap), the dam's
  faces (generic 3:1 upstream, 2.7:1 downstream slopes over the surveyed embankment), the crest
  width, and the spillway's walls and stilling basin. The spillway is dry, with a little still
  water in the basin.
- **One departure from the browser:** its bare-soil bank (up to 3 to 6 m above the water) is kept
  within 80 m of the shore; the browser would also colour the creek canyon below the dam as soil.

Scale: 4 m per block on every axis (true proportions); the crop is 6.0 × 6.7 km
(1,504 × 1,664 blocks). Water is at y = 65; the dam crest at y = 68.

## Build

From the repository root, with `numpy`, `scipy`, `Pillow` and `nbtlib`, pass any Java 26.3 save as
the header template and a new output folder. `--server-jar` (the 26.3 server jar) adds the datapack
that colours the grass summer gold; without it the grass keeps vanilla savanna colours.

```text
python experimental/minecraft/build_reservoir.py --site experimental/minecraft/sites/calaveras.json \
    --template "<Java 26.3 save>" --out "<new save folder>" --server-jar ~/mc-server/versions/26.3/server-26.3.jar
```

It takes about half a minute. It writes fresh 26.3 chunks (no upgrade needed), checks that no lake
water has a lower dry neighbour (refusing to write if any does), decodes a sample of chunks back
and compares them block for block, and writes `waterscape-build.json` (inputs, commit, scale,
dam, tree counts, viewpoints) into the world and an overhead preview beside it. Normal Minecraft
terrain can generate beyond the crop.

## Review

Open the world in Java 26.3 as a creative world. It starts at the north ridge.

| View | Command |
|---|---|
| North ridge | `/tp @s 217 101 194 -25.9 6.9` |
| West ridge | `/tp @s 192 129 1169 -106.1 8.6` |
| Shoreline | `/tp @s 394 67 1011 -90 24.1` |
| Dam and spillway, from the stilling basin | `/tp @s 600 62 245 45 -5` |
| Along the dam crest | `/tp @s 497 70 304 -90 10` |

## Result

2026-11-20: rebuilt after the first attempt's review (see the task file). Offline: 9,776 chunks,
105 decoded and compared block for block, lake leaks 0; 250,420 oaks (coast live 124,891, blue
75,164, valley 50,365); dam crest y 68, spillway 520 cells, basin floor y 51. Loaded on a Fabric
26.3 server with no errors in its log and the `file/waterscape-diablo` datapack enabled.
Overhead and isometric renders were compared with the NAIP aerial. In-game review by the
maintainer is pending.
