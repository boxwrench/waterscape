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
| Play together on the server | [Join the server](#join-the-server); hosts see [Host a server](#host-a-server) |
| Work on this as an agent | [AGENTS.md](AGENTS.md), plus the repository [AGENTS.md](../../AGENTS.md) |

## Status

As of 2026-11-18:

- **Demo download** — [`demo/Hetch-Hetchy-Dam-Demo.zip`](demo/README.md) is the earlier version
  ("Pool and Roads"): flat road lines, box buildings and a hand-cut canyon below the dam.
- **Improved version** — the [optional upgrades](#2-optional-upgrades) rebuild the canyon, dam face
  and river from the browser's own inputs and add graded roads, dam-crest parapets, proper
  buildings and fishing spots. Checked offline (block sections, water edges, wall connections,
  renders); an in-game check comes next, then the demo zip is refreshed with it.
- **Not yet a builder** — making a world still starts from a prepared base world and
  Hetch Hetchy-specific scripts. A one-command builder for any bundle is task
  [MC1](../../docs/roadmap/tasks/MC1-minecraft-builder.md).
- **Version** — Minecraft Java **26.3** (the current release) with Fabric Loader 0.20.1. Worlds
  saved by 26.2 open in 26.3 and are upgraded on first open; the scripts read and write both the
  26.2 and the 26.3 chunk formats.

## Install guide (Linux and Windows)

Checked on 2026-11-18 against Minecraft Java **26.3**, the launcher's current release. Versions
below came from the Fabric and Modrinth APIs on that date; when a newer Minecraft release comes
out, use the matching version of each mod (or stay on 26.3 with a pinned installation). Mods are
optional: the world is ordinary blocks and opens in plain 26.3. Opening a world in a newer release
upgrades that copy one way, so keep a copy before trying one.

| Piece | Version for 26.3 | What it is for |
|---|---|---|
| Fabric Loader | 0.20.1 (installer 1.1.2) | all mods |
| [Fabric API](https://modrinth.com/mod/fabric-api) | 0.166.2+26.3 | all mods |
| [Sodium](https://modrinth.com/mod/sodium) | 0.9.2 | performance |
| [Distant Horizons](https://modrinth.com/mod/distanthorizons) | 3.3.4 | long views of the canyon walls |
| [Creative Fly](https://modrinth.com/mod/creative-fly) | 2.0.0 | faster flight |
| [Cloth Config](https://modrinth.com/mod/cloth-config) | 26.3.159 | needed by Creative Fly |
| [Mod Menu](https://modrinth.com/mod/modmenu) | 21.0.1 | Creative Fly settings without a mouse wheel |
| [Placeholder API](https://modrinth.com/mod/placeholder-api) | 3.2.0+26.3 | needed by Mod Menu |

Also available for 26.3 and useful here:

- **Exploring and editing:** [Xaero's World Map](https://modrinth.com/mod/xaeros-world-map)
  fabric-26.3-1.47.2 (a full map with coordinates, for finding places and reporting them),
  [Chunky](https://modrinth.com/mod/chunky) 1.5.66 (pre-generates chunks so Distant Horizons has
  the whole map; single-player only, see [hosting](#host-a-server)) and
  [WorldEdit](https://modrinth.com/mod/worldedit) 7.4.6 (hand edits in game).
- **Extras:** [Controlify](https://modrinth.com/mod/controlify) 3.5.3 for controllers (needs
  [YACL](https://modrinth.com/mod/yacl) 3.9.7) and [Iris](https://modrinth.com/mod/iris) 1.11.7
  for shaders (pick a pack that supports Distant Horizons; try without shaders first).

### 1. Install the launcher

- **Linux (Debian/Ubuntu):** download the official `Minecraft.deb` from minecraft.net, then
  `sudo apt install ./Minecraft.deb` (run it from the folder holding the file; a warning about the
  `_apt` user is harmless). Start `minecraft-launcher`, sign in and click Play once so
  `~/.minecraft` exists.
- **Windows:** install the Minecraft Launcher from minecraft.net, sign in and click Play once.
  The game folder is `%appdata%\.minecraft`. Make sure it is **Java Edition**: "Minecraft for
  Windows" from the Microsoft Store is Bedrock, which cannot open these worlds or join the server.

### 2. Install Fabric for 26.3 (only if you want mods)

Download the installer jar from <https://fabricmc.net/use/installer/>. Close the launcher, then:

- **Any system with Java 17 or newer:**
  ```text
  java -jar fabric-installer-1.1.2.jar client -mcversion 26.3 -loader 0.20.1
  ```
  Add `-dir <game folder>` for a non-default folder.
- **Windows, graphical:** double-click the `.jar` (or the `.exe` build), choose Minecraft 26.3 and
  loader 0.20.1, keep "Create profile" ticked and click Install.

Start the launcher: a `fabric-loader-26.3` profile appears under Installations. Play it once
without mods so the game downloads, then close it.

### 3. Add the mods

Download the jars (Modrinth's Versions tab, filter by Fabric and 26.3) and put them in the `mods`
folder: `~/.minecraft/mods` on Linux, `%appdata%\.minecraft\mods` on Windows. Check each
download's sha512 against Modrinth's page. The folder is shared by all installations, so move out
any jar built for another Minecraft version.

### 4. Add the world

Extract [the demo world](demo/Hetch-Hetchy-Dam-Demo.zip) so the folder `Hetch Hetchy - Pool and
Roads` sits inside `saves` (`~/.minecraft/saves` or `%appdata%\.minecraft\saves`). Keep the zip
as the pristine copy; work on the extracted folder, and copy it before big edits. To play on the
shared server instead, see [Join the server](#join-the-server).

### 5. Play and check

Launch the `fabric-loader-26.3` profile (or plain 26.3), open Singleplayer and choose the world.
It is creative with commands on; double-tap jump to fly. In Video Settings start with about 12–16
render chunks, and set the Distant Horizons render distance to about 96 chunks (the dam-to-Kolana
distance is about 1,265 blocks, or 79 chunks). These are starting settings, not measured
guarantees. If the game fails to start, remove mods one at a time, newest first, and read
`logs/latest.log` in the game folder.

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
| South-shore fishing dock (after upgrade 3) | `/tp @s 733 82 1390 180 15` |
| North-shore fishing dock by the dam (after upgrade 3) | `/tp @s 509 83 1228 -90 15` |

## Join the server

The Hetch Hetchy world can also be played together on a small private server.

1. Use **Minecraft Java Edition 26.3** on Windows, macOS or Linux (the launcher's default release).
   Bedrock (Microsoft Store, Xbox, phones) cannot join. Mods are optional; a plain 26.3 game is
   enough, and Fabric with Distant Horizons adds the long views.
2. Ask the host for access: they add your Minecraft username to the whitelist.
3. In Minecraft choose **Multiplayer → Add Server** and enter the address the host gives you.

## Host a server

What the Hetch Hetchy server uses, for anyone setting up their own:

- **Server:** Fabric server 26.3 (loader 0.20.1, `fabric-server-launch.jar` from
  `https://meta.fabricmc.net/v2/versions/loader/26.3/0.20.1/1.1.2/server/jar`) on Java 25, 2–4 GB
  of memory, with Fabric API and Distant Horizons (server-side level-of-detail for players who
  have it) and WorldEdit. Leave **Chunky off the server**: with Distant Horizons 3.3.4 its hook can
  crash the server when chunks load right after a start, and a finished world needs no
  pre-generation.
- **Settings:** `online-mode=true`, `white-list=true`, `enforce-whitelist=true`, creative,
  peaceful, no PvP, `view-distance=12`, `simulation-distance=6`, a handful of players.
- **The world:** copy a finished world folder in as `world` with the server stopped. Edit copies,
  never the server's world; to update it, stop the server, back up `world`, copy the new one in and
  start again.
- **Running it:** start it in a detached `tmux` session so console commands can be sent
  (`tmux send-keys -t mc "whitelist add NAME" Enter`), and stop it with the `stop` command so it
  saves.
- **Reaching it from outside:** a tunnel such as [playit.gg](https://playit.gg) gives an address
  without opening a router port or showing your home IP (Tailscale Funnel does not carry Minecraft
  traffic). For a few known players, a private network such as Tailscale also works. If you
  forward port 25565 on a router instead, keep the whitelist and online mode on.
- **The EULA:** running a server means accepting the [Minecraft EULA](https://aka.ms/MinecraftEULA)
  (`eula=true`); do that yourself.

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

3. **Fishing extras (gameplay, not data)** — [`add_fishing.py`](prototype/add_fishing.py) adds
   docks with a moored spruce boat, a chest of four fishing rods, a bench and a lantern at gentle
   shore spots, and schools of fish in the lake. Minecraft has no trout, so the fish are salmon
   (trout are in the salmon family), marked as bucket-caught so they do not despawn. Fishing
   with a rod works anywhere on the water. The real reservoir allows fishing from the shore only,
   with no boats; the boats are a game liberty.
   ```text
   python add_fishing.py --world "<copy>" --spot 731,1386 --spot 513,1228 --fish 150 [--apply]
   ```

All three use [`world_columns.py`](prototype/world_columns.py), which loads chunks as full block columns,
keeps every block state, recomputes heightmaps and leaves lighting for the game to redo on load
(expect a short pause the first time each area loads).

### 3. Check it

Before opening a world, check it offline: no water next to lower dry ground, the dam crest
continuous at its height, walls joined. Then open the copy in 26.3, visit the
viewpoints above and report what you see: an overhead render is not a screenshot.

## Files

| Path | What it is |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Rules for agents working on this experiment |
| [`demo/`](demo/README.md) | The Hetch Hetchy demo world (zip), its OSM extract and notes |
| [`prototype/rebuild_downstream.py`](prototype/rebuild_downstream.py) | Upgrade 1: canyon, dam face and river below the dam |
| [`prototype/osm_structures.py`](prototype/osm_structures.py) | Upgrade 2: graded roads, dam parapets, buildings |
| [`prototype/add_fishing.py`](prototype/add_fishing.py) | Upgrade 3: fishing docks, boats, rods and fish (gameplay extras) |
| [`prototype/world_columns.py`](prototype/world_columns.py) | Shared world read/write for edits (full columns, palettes, heightmaps, entities, chests) |
| [`prototype/region_edit.py`](prototype/region_edit.py) | Low-level region and chunk read/write helpers |
| [`prototype/build_waterscape_biome.py`](prototype/build_waterscape_biome.py), [`inspect_hetch.py`](prototype/inspect_hetch.py) | How the base world was made (reference; not portable) |
| [`prototype/archive/`](prototype/archive/README.md) | Superseded one-shot edits; do not run on current worlds |

No generated worlds (other than the curated demo), mod JARs, game files or Python environments are
kept here. Not an official Minecraft product; not approved by or associated with Mojang or
Microsoft.
