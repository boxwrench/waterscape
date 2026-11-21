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
**landmark at 1 m per block**: the pool, cypress rows and forecourt are four times the
land around them. After seeing it, the maintainer asked for the temple itself at a finer scale for
detail, accepting that it is then out of proportion: **0.5 m per block** (eight times the land,
twice its setting), with the setting moved out along the axis to make room. The complex is centred on its real middle and slid back along its axis to stay inside the
bundle (which ends just east of the pool), so the temple sits about 139 m (35 blocks)
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
- Commits: a746f8b (landmark at 1 m per block), then the temple at 0.5 m per block with this
  Result.
- Checks:
  - Crystal Springs: `15762 chunks, 170 decoded and compared, 589975 trees`; lake leaks 0; the
    landmark's own check (every pool, well and canal water cell held in) passed;
  - Calaveras rebuilt with the changed builder: all 12 region files byte-identical;
  - loaded on a Fabric 26.3 server (`map/render_map.sh` lighting pass): no errors; web map
    re-rendered (457 MB) and checked in the browser (temple close up, front path, down the pool);
  - `node scripts/check-doc-links.mjs` → `Documentation links valid (143 Markdown files).`
- Notes:
  - Temple centre (1702, 2107), on a block corner; lawn terrace y 67, landing y 69, crest top
    y 87. Ten 2×2 columns (moulded base, quartz-pillar shaft, capital flaring to its abacus),
    architrave with a meander face, plain drum, cornice with its moulding and a crest of 40
    ornaments; four half-block step courses with the terracotta ring; the well under an iron
    grate. Pool 492 cells; 24 cypress; canal 74 blocks, water at y 66 then 65.
  - The bundle ends just east of the pool, so the complex is slid 14.5 blocks back along its
    axis: the temple stands about 139 m from its true spot.
  - The bundle's shoreline lies about 50 blocks west of the real canal mouth (its 10 m data has
    flat land at lake level there), so the canal turns from the traced line to the nearest lake
    water.
  - The isometric checker draws slabs and stairs as full blocks; judge the detail on the web map.
