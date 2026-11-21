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
