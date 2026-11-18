# Minecraft maps (experimental)

Waterscape's water-body data can also become a world you walk and fly through in **Minecraft Java
Edition**: the lidar terrain, shoreline, dam and river, the biome's rock and trees, and mapped roads
and buildings from OpenStreetMap, all in ordinary blocks. The aim is a recognisable landscape with
long views from real landmarks, without reshaping the geography to fit Minecraft.

Hetch Hetchy is the first and only map so far. The long-term goal is that anyone who can
[make a waterscape](../../docs/make-a-waterscape.md) can make the matching map from the same
`data/<id>/` bundle. That is planned work ([track MC](../../docs/roadmap/README.md#track-mc--playable-minecraft-maps)),
not something these scripts do yet.

| I want to… | Go to |
|---|---|
| Play the Hetch Hetchy map | [Install guide](#install-guide-linux-and-windows), then the [demo](demo/README.md) |
| Know what is real and what is approximate | [How a world is made](#how-a-world-is-made) |
| Rebuild or improve the Hetch Hetchy world | [Build or update a world](#build-or-update-a-world) |
| Work on this as an agent | [AGENTS.md](AGENTS.md), plus the repository [AGENTS.md](../../AGENTS.md) |

## Status

As of 2026-11-18:

- **Demo download** — [`demo/Hetch-Hetchy-Dam-Demo.zip`](demo/README.md) is the earlier version
  ("Pool and Roads"): flat road lines, box buildings and a hand-cut canyon below the dam. It has
  been opened in Java 26.2.
- **Improved version** — the [optional upgrades](#2-optional-upgrades) rebuild the canyon, dam face
  and river from the browser's own inputs and add graded roads, dam-crest parapets and proper
  buildings. Checked offline (block sections, water edges, wall connections, renders); an in-game
  check comes next, then the demo zip is refreshed with it.
- **Not yet a builder** — making a world still starts from a prepared base world and
  Hetch Hetchy-specific scripts. A one-command builder for any bundle is task
  [MC1](../../docs/roadmap/tasks/MC1-minecraft-builder.md).
- **Version** — Minecraft Java **26.2** with Fabric Loader 0.20.1. Other versions are untested.

## Install guide (Linux and Windows)

Checked on 2026-11-18 against Minecraft Java **26.2** (the launcher may offer a newer release;
do not use it for this world, because the first open of a world in a newer version upgrades it
one way). Versions below came from the Fabric and Modrinth APIs on that date; re-check each
project's version page for 26.2 before reusing them. Mods are optional: the world is ordinary
blocks and opens in plain 26.2.

| Piece | Version for 26.2 | What it is for |
|---|---|---|
| Fabric Loader | 0.20.1 (installer 1.1.2) | all mods |
| [Fabric API](https://modrinth.com/mod/fabric-api) | 0.161.0+26.2 | all mods |
| [Sodium](https://modrinth.com/mod/sodium) | 0.9.2 | performance |
| [Distant Horizons](https://modrinth.com/mod/distanthorizons) | 3.3.3 | long views of the canyon walls |
| [Creative Fly](https://modrinth.com/mod/creative-fly) | 2.0.0 | faster flight |
| [Cloth Config](https://modrinth.com/mod/cloth-config) | 26.2.155 | needed by Creative Fly |
| [Mod Menu](https://modrinth.com/mod/modmenu) | 20.0.3 | Creative Fly settings without a mouse wheel |
| [Placeholder API](https://modrinth.com/mod/placeholder-api) | 3.1.0-beta.1+26.2 | needed by Mod Menu |

Also available for 26.2 and useful here:

- **Exploring and editing:** [Xaero's World Map](https://modrinth.com/mod/xaeros-world-map)
  fabric-26.2-1.47.2 (a full map with coordinates, for finding places and reporting them),
  [Chunky](https://modrinth.com/mod/chunky) 1.5.66 (pre-generates chunks so Distant Horizons has
  the whole map) and [WorldEdit](https://modrinth.com/mod/worldedit) 7.4.5 (hand edits in game).
- **Extras:** [Controlify](https://modrinth.com/mod/controlify) 3.5.3 for controllers (needs
  [YACL](https://modrinth.com/mod/yacl) 3.9.7) and [Iris](https://modrinth.com/mod/iris) 1.11.4
  for shaders (pick a pack that supports Distant Horizons; try without shaders first).

### 1. Install the launcher

- **Linux (Debian/Ubuntu):** download the official `Minecraft.deb` from minecraft.net, then
  `sudo apt install ./Minecraft.deb` (run it from the folder holding the file; a warning about the
  `_apt` user is harmless). Start `minecraft-launcher`, sign in and click Play once so
  `~/.minecraft` exists.
- **Windows:** install the Minecraft Launcher from minecraft.net, sign in and click Play once.
  The game folder is `%appdata%\.minecraft`.

### 2. Install Fabric for 26.2

Download the installer jar from <https://fabricmc.net/use/installer/>. Close the launcher, then:

- **Any system with Java 17 or newer:**
  ```text
  java -jar fabric-installer-1.1.2.jar client -mcversion 26.2 -loader 0.20.1
  ```
  Add `-dir <game folder>` for a non-default folder.
- **Windows, graphical:** double-click the `.jar` (or the `.exe` build), choose Minecraft 26.2 and
  loader 0.20.1, keep "Create profile" ticked and click Install.

Start the launcher: a `fabric-loader-26.2` profile appears under Installations. Play it once
without mods so the game downloads, then close it.

### 3. Add the mods

Download the jars (Modrinth's Versions tab, filter by Fabric and 26.2) and put them in the `mods`
folder: `~/.minecraft/mods` on Linux, `%appdata%\.minecraft\mods` on Windows. Check each
download's sha512 against Modrinth's page. Remove any mod jar built for another version.

### 4. Add the world

Extract [the demo world](demo/Hetch-Hetchy-Dam-Demo.zip) so the folder `Hetch Hetchy - Pool and
Roads` sits inside `saves` (`~/.minecraft/saves` or `%appdata%\.minecraft\saves`). Keep the zip
as the pristine copy; work on the extracted folder, and copy it before big edits.

### 5. Play and check

Launch the `fabric-loader-26.2` profile, open Singleplayer and choose the world. It is creative
with commands on; double-tap jump to fly. In Video Settings start with about 12–16 render chunks,
and set the Distant Horizons render distance to about 96 chunks (the dam-to-Kolana distance is
about 1,265 blocks, or 79 chunks). These are starting settings, not measured guarantees. If the
game fails to start, remove mods one at a time, newest first, and read `logs/latest.log` in the
game folder.

Viewpoints, matching the browser version's cameras where they exist:

| Place | Command |
|---|---|
| Over the lake, toward Kolana Rock | `/tp @s 1534 110 778 -42 10` |
| Below the dam, looking up at it (browser "Below the dam") | `/tp @s 493 61 1401 -113 -14` |
| Dam overlook (browser "O'Shaughnessy Dam") | `/tp @s 471 101 1305 -62 21` |
| High over the dam, down the canyon | `/tp @s 680 168 1262 45 26` |
| Dam crest walkway | `/tp @s 560 86 1330 -60 10` |
| South-shore buildings | `/tp @s 830 102 1480 0 35` |
| Ranger station and parking | `/tp @s 650 100 1600 0 35` |

## How a world is made

**Inputs, all from Waterscape** (`data/<id>/` and the browser's rules):

- `terrain.json` and `terrain.bin.gz`: the 3DEP elevation grid (about 10 m), shoreline distance,
  valley field and drawdown field. Decoded as in [`renderer/terrain.js`](../../renderer/terrain.js)
  and [`pipeline/dem.py`](../../pipeline/dem.py).
- `source.json`, `land.json` and the biome under [`data/biomes`](../../data/biomes): the look —
  rock share, drawdown band, tree species mix. The block choices follow the browser's
  [ground](../../renderer/land/ground.js) and [tree](../../renderer/land/oak-placement.js) rules.
- `structures.json`, where present: dams (crest line, crest elevation, height, type) and traced
  rivers (centre line, widths, surface). The dam's cross-section is the browser's generic gravity
  profile ([`structures.js`](../../renderer/land/structures.js)). Only Hetch Hetchy has this file
  so far.
- Optionally an OpenStreetMap extract for roads and buildings (© OpenStreetMap contributors,
  ODbL; the Hetch Hetchy extract is [`demo/hetch-osm-features.json`](demo/hetch-osm-features.json)).

**Scale and coordinates (Hetch Hetchy):** about 2 m per block horizontally and 4 m per block
vertically, so mountains are vertically compressed and the canyon looks about half as deep as in
the browser. The lake surface (1151.7 m) is at y = 80. The world covers latitude 37.938–37.972 and
longitude −119.801 to −119.742 (2,587 × 1,891 blocks), mapped linearly from longitude and latitude.

**Real and approximate.** From data: terrain shape, shoreline, lake level, river line and level,
dam crest and height, road lines and classes, building footprints and storeys. Approximate or
illustrative: block choices, the lake bed (the lidar cannot see under water; it is synthetic, not
bathymetry), the river bed and boulders, trees (procedural stands of pine-like and oak-like trees,
not surveyed trees), the dam cross-section, road cuts and guard walls, and building materials and
roofs. Buildings use playable height (3 blocks per storey); at the world's vertical scale a cabin
would be one block tall. Building footprints are laid square to the block grid.

**One rule:** when the world and the browser disagree, rebuild that area from the browser's inputs
and rules. Every hand-sculpted fix in this world's history drifted; every rebuild from the bundle
came out right.

## Build or update a world

Always work on a **copy** of a world, with Minecraft closed for that copy. Every script is a dry run
unless `--apply` is given, prints what it would change, and the newer ones refuse to run twice on
the same world. Python 3 with `numpy`, `scipy`, `Pillow`, `pyproj` and `nbtlib` (a virtual
environment is easiest). Run the scripts from [`prototype/`](prototype).

### 1. The base world (Hetch Hetchy only, not yet portable)

The base world was made in two steps, kept for reference until MC1 replaces them:

1. A terrain-only [Arnis](https://github.com/louis-e/arnis) world for the bounding box supplied the
   world structure and geographic metadata (`metadata.json`).
2. [`inspect_hetch.py`](prototype/inspect_hetch.py) decoded the bundle's terrain, and
   [`build_waterscape_biome.py`](prototype/build_waterscape_biome.py) rewrote every chunk from it:
   terrain, synthetic lake bed, water, a simple dam wall, river, biome ground, drawdown band and
   trees.

Both expect the original local folder layout (a `source/` folder with copied bundle files, a named
world folder beside the script) and Hetch Hetchy constants. To get a base world today, start from
the demo zip instead.

### 2. Optional upgrades

Run in this order on a copy of the base world (the demo works):

1. **Canyon below the dam** — [`rebuild_downstream.py`](prototype/rebuild_downstream.py) rebuilds
   the area below O'Shaughnessy Dam from the browser's inputs: unmodified terrain, the traced river
   (`structures.json` centre line, widths and surface), the dam's downstream face from the gravity
   profile, and the granite ground rules for rock and canyon stone. It replaces the demo's slope
   cut, canyon stone and plunge pool, keeps the reservoir watertight, and keeps the dam's upstream
   half and the buildings.
   ```text
   python rebuild_downstream.py --world "<copy>" --data ../../../data/hetch_hetchy \
     --biome ../../../data/biomes/sierra-granite/biome.json [--apply]
   ```
2. **Roads, dam crest and buildings** — [`osm_structures.py`](prototype/osm_structures.py) removes
   the demo's flat road lines and box shells and replaces them. Roads are graded along their length
   with widths by class and lanes, half-slabs, cuts, fill with stone guard walls, and tunnels or
   bridge decks where needed. The dam crest gets parapets on both edges. Buildings get foundations,
   windows, a door toward the nearest road and hip roofs.
   ```text
   python osm_structures.py --world "<copy>" --osm ../demo/hetch-osm-features.json \
     --structures ../../../data/hetch_hetchy/structures.json [--apply]
   ```

Both use [`world_columns.py`](prototype/world_columns.py), which loads chunks as full block columns,
keeps every block state, recomputes heightmaps and leaves lighting for the game to redo on load
(expect a short pause the first time each area loads).

### 3. Check it

Before opening a world, check it offline: no water next to lower dry ground, the dam crest
continuous at its height, walls joined. Then open the copy in the 26.2 profile, visit the
viewpoints above and report what you see: an overhead render is not a screenshot.

## Files

| Path | What it is |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Rules for agents working on this experiment |
| [`demo/`](demo/README.md) | The Hetch Hetchy demo world (zip), its OSM extract and notes |
| [`prototype/rebuild_downstream.py`](prototype/rebuild_downstream.py) | Upgrade 1: canyon, dam face and river below the dam |
| [`prototype/osm_structures.py`](prototype/osm_structures.py) | Upgrade 2: graded roads, dam parapets, buildings |
| [`prototype/world_columns.py`](prototype/world_columns.py) | Shared world read/write for edits (full columns, palettes, heightmaps) |
| [`prototype/region_edit.py`](prototype/region_edit.py) | Low-level region and chunk read/write helpers |
| [`prototype/build_waterscape_biome.py`](prototype/build_waterscape_biome.py), [`inspect_hetch.py`](prototype/inspect_hetch.py) | How the base world was made (reference; not portable) |
| [`prototype/archive/`](prototype/archive/README.md) | Superseded one-shot edits; do not run on current worlds |

No generated worlds (other than the curated demo), mod JARs, game files or Python environments are
kept here. Not an official Minecraft product; not approved by or associated with Mojang or
Microsoft.
