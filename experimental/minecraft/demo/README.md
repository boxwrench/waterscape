# Hetch Hetchy dam demo

[Download the demo world](Hetch-Hetchy-Dam-Demo.zip) (about 21 MB). The archive contains a
single Java Edition save named `Hetch Hetchy - Pool and Roads`. It includes no player profile or
Distant Horizons cache. This is an experimental block interpretation of a real landscape.

## Open it

1. Close Minecraft and the world you intend to use.
2. Extract the archive. Copy the extracted `Hetch Hetchy - Pool and Roads` folder into the `saves`
   folder of the desired Minecraft Java installation. On Windows the default location is
   `%appdata%\.minecraft\saves`, but launcher profiles can have a separate game directory.
3. Start the matching Minecraft Java profile and choose **Singleplayer → Hetch Hetchy - Pool and
   Roads**. This demo is intended for Java 26.2; the base save originated in Java 1.21.4 and
   Minecraft may offer to upgrade the copied world. Accepting the upgrade changes that copy.
4. The world is creative with commands enabled. To view Kolana Rock from over the lake, enable
   flight and enter `/tp @s 1534 110 778 -42 10`.

No mods are needed for the blocks, but the [recommended client setup](../README.md#recommended-client-setup)
includes Distant Horizons for long views and optional controller and flight controls.

## What the demo represents

The scene covers the western reservoir, O'Shaughnessy Dam, the canyon below it and Kolana Rock.
Waterscape's 3DEP-derived terrain and shoreline supply the shape; its Sierra biome informs the
block palette and procedural pine-like and oak-like trees. The shoreline band, tree placement,
dam cross-section, synthetic lake bottom and the cut below the dam are approximations. The
original terrain grid is roughly 10 m; the world uses about 2 horizontal metres per block and
4 vertical metres per block. This makes the mountains vertically compressed.

The marked sloping mass downstream was removed from the demo in response to visual review; the
near-vertical dam and water were preserved in the offline block comparison. Granite-like blocks
replace soil in the canyon, and the revealed floor receives a stone palette. An illustrative
plunge pool with an uneven bottom and low rock rim connects to the downstream river at the water
level given by `structures.json`. These are artistic corrections, not measured geology or
bathymetry.

The original Arnis base was terrain-only and had no roads or buildings. The demo now adds mapped
road and trail ways, the dam service route and simple building shells using the same OpenStreetMap
data Arnis uses. The converter placed approximately 7,371 road/trail cells from 21 mapped ways
and planned 23 building shells; it skipped 19 road cells over water or missing terrain. Roads
follow the Minecraft ground and may have abrupt steps; the generic buildings are not detailed
Arnis models. Check mapped features in-game before assuming they are navigable or accurate.

Road and building data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
available under the Open Database License. The [cropped source extract](hetch-osm-features.json)
was obtained using Arnis 3.4.0's OSM tile archive (built 2026-10-25). The ZIP includes attribution.

The ZIP was checked for corruption, the intended 24 region files and absence of an embedded
player profile. The edited world was compared block by block against the preceding world: existing
water and dam concrete were preserved, and the new pool connected to the mapped river in a 2D
water check. Affected surface heightmaps were checked in the local Java 26.2 working copy.
**The edited demo has not yet been opened and visually checked in Minecraft**; lighting,
navigation, world upgrading, mods and frame rate still need an in-game review. The earlier
terrain was viewed in-game before the most recent edits.

See [the parent workflow](../README.md) and [`data/hetch_hetchy`](../../../data/hetch_hetchy)
for the source data, provenance and limitations.
