# MC6: Crystal Springs Reservoir as a Minecraft world

**Who:** capable · **Needs:** the Crystal Springs bundle (`data/crystal_springs/`, done), the dam in
the site file (step 2) and MC2's builder · **Branch:** `task/MC6-crystal-springs`

## Goal

A Minecraft Java 26.3 world of Crystal Springs Reservoir that someone who knows the place
recognises: the long lake in the San Andreas Fault valley, green Peninsula hills with coast live
oak woodland and stands of Douglas-fir, and Lower Crystal Springs Dam, the 1888 concrete
gravity dam with its stepped downstream face. Built from the bundle and the browser's own rules,
never hand-sculpted; then a BlueMap web map and a card on the HetchyCraft front page, as for
Calaveras.

The world is built by [`experimental/minecraft/build_reservoir.py`](../../../experimental/minecraft/build_reservoir.py),
MC2's Calaveras builder made to read any site file (`--site`), not a copy of it. Calaveras still
builds byte for byte the same. MC1 (one builder for every bundle) remains open: sites still need a
hand-traced dam and a palette.

## Stop rules

As in [MC2](MC2-calaveras.md#stop-rules-read-before-you-write-code): no task file, no work; a
missing input is a stop, not a workaround; every number has a source URL in the site file; no
worlds or zips in the repository.

## Read first

- [AGENTS.md](../../../AGENTS.md), [experimental/minecraft/README.md](../../../experimental/minecraft/README.md)
  and its [AGENTS.md](../../../experimental/minecraft/AGENTS.md), and [MC2](MC2-calaveras.md).
- The browser rules: [`renderer/land/ground.js`](../../../renderer/land/ground.js) (spring grass, the
  default season in `land.json`), [`renderer/land/oak-placement.js`](../../../renderer/land/oak-placement.js)
  (`oakSite`, `cover`, `standPick`), [`renderer/engine/look.js`](../../../renderer/engine/look.js).
- [`data/crystal_springs/poster.jpg`](../../../data/crystal_springs/poster.jpg) and
  [`aerial.jpg`](../../../data/crystal_springs/aerial.jpg).

## Steps

1. **Scale:** 4 m per block on every axis, as for Calaveras. The crop holds both lakes, the dam and
   the three browser viewpoints (1,776 × 2,272 blocks).
2. **Site file** [`sites/crystal_springs.json`](../../../experimental/minecraft/sites/crystal_springs.json):
   the dam's type, height and length from the National Inventory of Dams (CA00127); its crest
   traced on a 1 m NAIP image and moved onto the 3DEP ridge (the photo leans: the crest shows
   about 10 m east of the lidar ridge); crest elevation from 3DEP; the stilling basin traced on
   the same image. URLs recorded.
3. **Palette** [`palettes/peninsula-oak-fir.json`](../../../experimental/minecraft/palettes/peninsula-oak-fir.json):
   green grass (the browser's spring palette) through a datapack; soil and rock by the same
   rules as MC2; coast live oak in dark oak blocks, Douglas-fir as spruce cones; green-tinted
   water for the bundle's `green` optics.
4. **Trees:** `oakSite` as in MC2, with `land.json`'s `cover` (woodland on all but the crests) and
   `stands` (`standPick`: Douglas-fir in groups). The species list comes from the biome's
   `biome.json`, as the browser takes it.
5. **Causeway:** the highway between the upper and lower lakes is missing from the bundle (its
   10 m grid and water outline run the lakes together; reported by the maintainer on the first
   map). Traced on NAIP with its top from 1 m 3DEP into the site file's `causeways`; the builder
   lays a road on fill there.
6. **The dam:** a gravity profile: a level crest straight up from the lake, a stepped face at
   0.75 horizontal to 1 vertical down to the creek, the spillway as the part of the face above
   the stilling basin, and the basin with a little contained water. Lake watertight.
7. **Web map and front page:** render with `map/render_map.sh` (`map/sites/crystal_springs.json`),
   add `--map crystal_springs=...` to `map/make_front.py`, and host as for Calaveras.

## Acceptance

As in MC2: an overhead beside the same crop of `aerial.jpg` (woodland continuous in the ravines,
grass on the spurs), an isometric render and an in-game view of the dam (curved level crest, a
stepped face, spillway and basin), offline checks with their final lines, and a clean load on a
26.3 server.

## Result
- Status: done offline; in-game acceptance by the maintainer pending.
- Commit: 7c584d1 (world, builder, docs); this Result in the next commit.
- Checks:
  - Calaveras rebuilt with `build_reservoir.py`: all 12 region files byte-identical to MC2's build;
  - Crystal Springs: `15762 chunks, 170 decoded and compared, 591025 trees`; lake leaks 0;
  - loaded on a Fabric 26.3 server (`map/render_map.sh` lighting pass): no errors, datapack
    `file/waterscape-peninsula` enabled;
  - `node scripts/check-doc-links.mjs` → `Documentation links valid (142 Markdown files).`
- Notes:
  - Dam: crest y 67 (95.6 m), toe y 55, stepped face 564 cells, spillway 116, stilling basin 72
    cells with water. A gravity dam's columns are masonry all the way down.
  - The causeway between the lakes was missing from the bundle; the maintainer spotted it on the
    first web map. It is now traced into the site file. The browser scene still lacks it (a
    bundle task).
  - Douglas-fir is about a quarter of the trees: the browser's `standPick` with `stands` 1 pushes
    picks past the 0.9 threshold. Faithful to the browser; adjust `land.json` if that is wrong.
  - Web map: 457 MB (more trees than Calaveras).
