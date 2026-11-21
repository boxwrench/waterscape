# MC7: Pulgas Water Temple in the Crystal Springs world

**Who:** capable · **Needs:** MC6's world and builder (done), the maintainer's temple model
([boxwrench/water_temple](https://github.com/boxwrench/water_temple)) · **Branch:** `task/MC7-pulgas-temple`

## Goal

The Pulgas Water Temple, the Hetch Hetchy Aqueduct's 1934 terminus, in the Crystal Springs
world: the ring of ten Corinthian columns under its stone drum on round steps, the open well,
the reflecting pool in front lined by Italian cypress on both sides, and the canal behind it
down to Upper Crystal Springs Reservoir. Built by the same one-step builder from the site file,
never hand-placed.

## Scale (maintainer's choice, 2026-11-21)

The world is 4 m per block, which would make the temple a 3-block ring. The maintainer chose a
**landmark at 1 m per block**: the temple, pool, cypress rows and forecourt are four times the
land around them. The complex is centred on its real middle and slid back along its axis to stay inside the
bundle (which ends just east of the pool), so the temple sits about 104 m (26 blocks)
west-southwest of its true spot, on its true axis, and the canal, which runs along
the same axis, is shorter than the real 240 m. Everything else in the world stays at 4 m per block.

## Stop rules

As in [MC2](MC2-calaveras.md#stop-rules-read-before-you-write-code): every measured number has a
source URL in the site file; no worlds or zips in the repository.

## Steps

1. **Locate and measure** on a 0.6 m USGS NAIP image and 1 m 3DEP: the temple centre (matches
   Wikipedia's coordinates within 2 m), the pool (centre, axis, length, width), the cypress
   spacing, the canal line, ground elevations.
2. **Proportions** from the maintainer's model (`assets/temple.glb`, Blender reconstruction):
   heights and radii of steps, landing, column ring, shafts, capitals, architrave, drum, cornice
   and well, in model units; one model unit set by the drum's diameter measured on NAIP.
3. **Setting** from photographs: turquoise pool with white coping, cypress with bare grey
   trunks taller than the temple, lavender beds either side of the front steps, a paved
   forecourt between the pool and the temple.
4. **Builder:** a `landmarks` list in the site file and `landmarks.py`; the builder levels a
   terrace, lays the forecourt, pool and cypress, builds the temple, and cuts the canal with
   water stepping down to the lake. Lake and pool watertight.

## Acceptance

An overhead beside the NAIP image, isometric renders of the temple and pool, the offline checks
(chunks compared, leaks 0), a clean load on a 26.3 server, and the maintainer's look in game.

## Result
- Status: done offline; in-game acceptance by the maintainer pending.
- Commit: a746f8b (landmark, builder, docs, map places); this Result in the next commit.
- Checks:
  - Crystal Springs: `15762 chunks, 170 decoded and compared, 590254 trees`; lake leaks 0; the
    landmark's own check (every pool, well and canal water cell held in) passed;
  - Calaveras rebuilt with the changed builder: all 12 region files byte-identical;
  - loaded on a Fabric 26.3 server (`map/render_map.sh` lighting pass): no errors; web map
    re-rendered (457 MB) and checked in the browser (overview, pool, front path, canal);
  - `node scripts/check-doc-links.mjs` → `Documentation links valid (143 Markdown files).`
- Notes:
  - Temple centre block (1710, 2105); lawn terrace y 67, landing y 68, cornice top y 77; ten
    columns; pool 494 cells; 24 cypress; canal 89 blocks, water at y 66 then 65.
  - The bundle ends just east of the pool, so the complex is slid 6.5 m back along its axis:
    the temple stands about 104 m from its true spot.
  - The bundle's shoreline lies about 50 blocks west of the real canal mouth (its 10 m data has
    flat land at lake level there), so the canal follows the traced line to the real mouth, then
    turns to the nearest lake water.
  - At 1 m per block the 7.6 m drum is a rough octagon; a finer temple would need its own,
    larger scale.
