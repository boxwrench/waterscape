# Hetch Hetchy dam demo

[Download the demo world](Hetch-Hetchy-Dam-Demo.zip) (about 21 MB). The archive contains a
single Java Edition save named `Hetch Hetchy - Pool and Roads`. It includes no player profile or
Distant Horizons cache. This is an experimental block interpretation of a real landscape.

> **This is the earlier version.** A better one exists: the canyon below the dam, the dam face and
> the river rebuilt from the browser version's own inputs, with graded roads, dam-crest parapets
> and proper buildings. You can make it from this zip with the
> [optional upgrades](../README.md#2-optional-upgrades); the zip will be replaced with it after an
> in-game check. What is described below is what this zip contains.

## Open it

Set up Minecraft Java 26.3 first with the [install guide](../README.md#install-guide-linux-and-windows).

1. Close Minecraft.
2. Extract the archive. Copy the extracted `Hetch Hetchy - Pool and Roads` folder into the `saves`
   folder of your Minecraft Java installation (`~/.minecraft/saves` on Linux,
   `%appdata%\.minecraft\saves` on Windows; launcher profiles can have their own game folder).
3. Start Minecraft 26.3 and choose **Singleplayer → Hetch Hetchy - Pool and Roads**. The save was
   first made in Java 1.21.4; 26.3 upgrades the copy when it first opens it (this changes that copy
   only; keep the zip as the original).
4. The world is creative with commands enabled. Turn on flight and use the
   [viewpoints](../README.md#5-play-and-check), for example `/tp @s 1534 110 778 -42 10` over the
   lake toward Kolana Rock.

No mods are needed for the blocks; Distant Horizons helps with long views.

## What this version contains

The scene covers the western reservoir, O'Shaughnessy Dam, the canyon below it and Kolana Rock.
Waterscape's 3DEP-derived terrain and shoreline supply the shape; its Sierra biome informs the
block palette and procedural pine-like and oak-like trees. The original terrain grid is roughly
10 m; the world uses about 2 horizontal metres per block and 4 vertical metres per block, so the
mountains are vertically compressed. The lake bed is synthetic, not measured bathymetry.

Below the dam, this version has hand edits that the newer version replaces: a sloping mass was cut
away (it turned out to be the dam's own downstream face, which the lidar records as ground), soil
in the canyon was swapped for stone in a checkerboard pattern, and an illustrative plunge pool with
a rock rim was added. These are artistic corrections, not measured geology.

Roads and buildings are simple: mapped road and trail lines laid flat on the ground (about 7,371
cells from 21 ways; roads step abruptly on slopes), the dam crest marked with raised blocks, and
23 generic box shells with flat roofs at the building footprints.

Road and building data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
available under the Open Database License. The [cropped source extract](hetch-osm-features.json)
was obtained using Arnis 3.4.0's OSM tile archive (built 2026-10-25). The ZIP includes attribution.

## Checks

The ZIP was checked for corruption, the intended 24 region files and the absence of a player
profile. It was opened in Java 26.2 on 2026-11-18, which upgraded the save without errors (26.3 upgrades
it the same way); a full
visual review of this version was not done, since the newer version replaces its edits.

See [the parent README](../README.md) and [`data/hetch_hetchy`](../../../data/hetch_hetchy) for the
source data, provenance and limitations.
