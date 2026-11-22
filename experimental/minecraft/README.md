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
| Show the map to people without Minecraft (3D in a browser, with a first-person view) | [Web map](map/README.md) |
| Work on this as an agent | [Agents: start here](#agents-start-here), then [AGENTS.md](AGENTS.md) |

## Agents: start here

1. **Find your task file** in [`docs/roadmap/tasks/`](../../docs/roadmap/tasks/) (`MC*`). Its
   **Needs** line lists what must exist first. If there is no task file for what you were asked,
   or a need is missing, stop and report. Do not work around it. A world shipped without its dam
   because no file described the dam is the mistake to avoid.
2. **Read** this folder's [AGENTS.md](AGENTS.md) and the repository [AGENTS.md](../../AGENTS.md).
3. **Look at the targets before writing code:** the bundle's `aerial.jpg` (the real ground) and
   `poster.jpg` (the browser scene). The world must resemble both.
4. **Translate the browser's rules, do not invent new ones.** Ground: `renderer/land/ground.js`.
   Trees: `renderer/land/oak-placement.js`, in metres, then converted to blocks. Blocks: the
   site's palette file in [`palettes/`](palettes). Constants: the site file in [`sites/`](sites).
5. **Prove it with pictures.** An overhead render beside the aerial crop, an isometric render of
   the dam, and in-game screenshots from the bundle's viewpoints when you can open the game. A
   structural check (NBT, heightmaps) says the file is valid, not that it looks right.

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
  Iris needs OpenGL. On a Linux Wayland desktop, 26.3 can fail to start OpenGL through XWayland
  and fall back to Vulkan; with Iris installed the game then aborts at start-up (exit code 6,
  `No context is current` in `launcher_log.txt`). Start the launcher with native Wayland instead:
  `SDL_VIDEO_DRIVER=wayland minecraft-launcher`, or put `env SDL_VIDEO_DRIVER=wayland` in front of
  `minecraft-launcher` on the `Exec=` line of a copy of its menu entry in `~/.local/share/applications/`.

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
| Boat ramp and fishing dock | `/tp @s 738 83 1382 180 15` |
| Tunnel from the dam's north end | `/tp @s 527 85 1316 154 5` |
| Tunnel exit onto the trail | `/tp @s 493 85 1198 -6 5` |
| Spillway drum gates, from the road bridge | `/tp @s 591 84 1405 -125 12` |

## Join the server

The Hetch Hetchy world can also be played together on a small private server.

1. Use **Minecraft Java Edition 26.3** on Windows, macOS or Linux (the launcher's default release).
   Bedrock (Microsoft Store, Xbox, phones) cannot join. Mods are optional; a plain 26.3 game is
   enough, and Fabric with Distant Horizons adds the long views.
2. Access is by whitelist; see the next step for how to ask.
3. In Minecraft choose **Multiplayer → Add Server** and enter the address. The Hetch Hetchy server
   is `dedication-care.tun.ply.gg` (no port needed). The whitelist is the request: try to join once
   (you will be turned away), then ask the maintainer to approve you; the host sees who tried.
4. When you join, the server offers the **Waterscape resource pack** (about 54 KB): choose Yes. It
   turns the stand-in animals into black bears, mountain lions and rainbow trout, dresses the
   hikers, and makes the rock and trees look like Sierra granite and pines. It is used only on this
   server.

## Host a server

What the Hetch Hetchy server uses, for anyone setting up their own:

- **Server:** Fabric server 26.3 (loader 0.20.1, `fabric-server-launch.jar` from
  `https://meta.fabricmc.net/v2/versions/loader/26.3/0.20.1/1.1.2/server/jar`) on Java 25, 2–4 GB
  of memory, with Fabric API and Distant Horizons (server-side level-of-detail for players who
  have it), WorldEdit and Ledger. Leave **Chunky off the server**: with Distant Horizons 3.3.4 its hook can
  crash the server when chunks load right after a start, and a finished world needs no
  pre-generation.
- **Settings:** `online-mode=true`, `white-list=true`, `enforce-whitelist=true`, creative,
  peaceful, no PvP, `view-distance=12`, `simulation-distance=6`, a handful of players.
- **Upgrade the world fully.** Distant Horizons reads saved chunks directly and only understands
  the current format, so chunks still in an older format give wrong or missing far terrain (its
  log says "Unable to deserialize blocks"). After copying in a world, start once with
  `--forceUpgrade`, then check every chunk's `DataVersion`. Once (of two runs) it silently skipped
  the chunks the scripts had rewritten; force-loading and saving those fixed it: `forceload add`
  over the area in blocks of at most 256 chunks, `save-all flush`, `forceload remove all`. Delete Distant Horizons' database afterwards if it was
  already built.
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
- **Building and undo:** players in creative can build anywhere, so keep a way back. A pristine
  copy of the published world plus nightly compressed snapshots (about 32 MB each here) give a
  full reset; [Ledger](https://modrinth.com/mod/ledger), a server-only logging mod (it needs
  Fabric Language Kotlin), records who changed each block and can roll back one player's changes
  in an area without touching anyone else's.
- **Look:** put the datapack in `world/datapacks/` (restart to apply) and set `resource-pack`,
  `resource-pack-sha1`, `require-resource-pack` and `resource-pack-prompt` in `server.properties`
  to offer the resource pack; see [`pack/`](pack/README.md).
- **Animals and hikers:** summoned entities can be killed or moved by players in creative. Keep
  the summon list; removing everything tagged `waterscape_wildlife` and summoning the list again
  restores them.
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

**Calaveras** and **Crystal Springs** are built fresh in one step instead (no base world), by
[`build_reservoir.py`](build_reservoir.py) with the site's file from [`sites/`](sites). See the
[Calaveras notes](calaveras.md) (task [MC2](../../docs/roadmap/tasks/MC2-calaveras.md)) and the
[Crystal Springs notes](crystal_springs.md) (task [MC6](../../docs/roadmap/tasks/MC6-crystal-springs.md);
the Pulgas Water Temple, task [MC7](../../docs/roadmap/tasks/MC7-pulgas-temple.md)).

**Sunol Valley** (task [MC8](../../docs/roadmap/tasks/MC8-sunol-valley.md)) spans two reservoirs, so
its terrain is made first by [`make_valley_terrain.py`](make_valley_terrain.py) (3DEP: 1 m lidar
around each lake, 10 m elsewhere, both lakes at their own levels) and its creek lines by
[`fetch_creeks.py`](fetch_creeks.py) (OpenStreetMap); then `build_reservoir.py` builds it as usual.
It is 4 m per block across and 3 m up, so Calaveras stands 27 blocks above San Antonio:

```
python experimental/minecraft/make_valley_terrain.py --site experimental/minecraft/sites/sunol_valley.json
python experimental/minecraft/fetch_creeks.py --site experimental/minecraft/sites/sunol_valley.json   # once; the result is kept
python experimental/minecraft/build_reservoir.py --site experimental/minecraft/sites/sunol_valley.json \
    --template "<Java 26.3 save>" --out "<new folder>" --server-jar ~/mc-server/versions/26.3/server-26.3.jar
```

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
     --biome ../../../data/biomes/sierra-granite/biome.json --face-drop 1.5 --close-gap shift [--apply]
   ```
   `--face-drop` steepens the downstream face, in blocks dropped per block outward. Without it the
   face follows the browser's gravity profile (0.75 m out per metre down), which at 2 m across and
   4 m up per block shows as a gentle 34°; 1.5 looks like the real dam. The steeper face frees a
   band where the lidar recorded only the dam. `--close-gap shift` slides the canyon below
   upstream into it ([`warp.py`](prototype/warp.py)): the full gap (about 19 blocks) at the dam,
   fading to nothing 180 blocks downstream, in one direction square to the crest, so the canyon is
   stretched by about 10% with no seam. Dry ground within 10 blocks of the face that sits below
   river level is raised to it, so there is no pit at the toe. `--close-gap pool` instead fills
   the band with a plunge pool. Hetch Hetchy's world uses 1.5 with `shift`; run
   `osm_structures.py` with `--shift-face-drop 1.5` so mapped roads and buildings move with it.
2. **Roads, dam crest and buildings** — [`osm_structures.py`](prototype/osm_structures.py) removes
   the demo's flat road lines and box shells and replaces them. Roads are graded along their length
   with widths by class and lanes, half-slabs, cuts, fill with stone guard walls, and tunnels or
   bridge decks where needed. The dam crest gets parapets on both edges. Buildings get foundations,
   windows, a door toward the nearest road and hip roofs.
   ```text
   python osm_structures.py --world "<copy>" --osm ../demo/hetch-osm-features.json \
     --structures ../../../data/hetch_hetchy/structures.json --shift-face-drop 1.5 [--apply]
   ```

3. **Fishing extras (gameplay, not data)** — [`add_fishing.py`](prototype/add_fishing.py) adds
   docks with a moored spruce boat, a chest of four fishing rods, a bench and a lantern at gentle
   shore spots, and schools of fish in the lake. Minecraft has no trout, so the fish are salmon
   (trout are in the salmon family), marked as bucket-caught so they do not despawn. Fishing
   with a rod works anywhere on the water. The real reservoir allows fishing from the shore only,
   with no boats; the boats are a game liberty.
   ```text
   python add_fishing.py --world "<copy>" --spot 738,1376 --fish 150 [--apply]
   ```
4. **Places from photos** — three scripts for features the maintainer marked on a map and
   photographed, placed by hand rather than from data:
   [`add_ramp.py`](prototype/add_ramp.py) lays a concrete boat ramp from a road into the lake
   (graded, with half-slabs, continuing under water), and
   [`add_tunnel.py`](prototype/add_tunnel.py) cuts a walking tunnel along a route: rough rock
   walls, a gravel floor, lanterns hanging from the ceiling on one side, concrete portals, and a
   trail mapped over the rock turned back to rock. At the world's vertical scale the hill above
   is thin near the trail end, so the script adds rock over the tunnel with sloped sides.
   [`add_spillway.py`](prototype/add_spillway.py) builds a gated spillway beside a dam: drum
   gates between round-nosed piers with railings, a stepped spill face, and a dry rock channel
   that narrows towards the far end to stay clear of the road. The channel passes under the dam
   road through an arched opening in a concrete headwall and runs out down the rock in a gully
   that drops in ledges. Where the dam's downstream face reaches past the real face's edge (the
   generic gravity profile runs the full traced crest), the script turns that part into a granite
   slope rising to the ground beyond. Lake water cut off behind the gates becomes ground, and the
   script refuses to write if the lake would leak. The gates are drawn closed and the spillway dry.
   Hetch Hetchy's are the ramp at the south-shore cove (the fishing dock sits beside it), the
   tunnel from the dam's north end to the Wapama Falls trail, and O'Shaughnessy Dam's spillway
   with its three drum gates at the road end of the dam (the gate line and the dam face's edge traced from the
   [USGS NAIP image](https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage?bbox=254900,4203450,255150,4203650&bboxSR=32611&imageSR=32611&size=1000,800&format=jpg&bandIds=0,1,2&f=image);
   sizes and heights are illustrative):
   ```text
   python add_ramp.py --world "<copy>" --from 713,1392 --to 729,1384 [--apply]
   python add_tunnel.py --world "<copy>" --from 524,1310 --via 501,1263 --to 495,1206 [--apply]
   python add_spillway.py --world "<copy>" --gates-from 594,1401.5 --gates-to 626,1389.5 \
       --portal 587.5,1409 --face-edge 587,1403 --face-edge 565,1373.5 \
       --falls 578,1406 --falls 567,1399 [--apply]
   ```

5. **Wildlife and hikers (gameplay, area-appropriate)** — [`plan_animals.py`](prototype/plan_animals.py)
   reads a world and prints server commands that summon persistent animals in fitting places, so
   the game writes them in its own format. Minecraft has no Sierra animals, so these are the
   closest models: brush rabbit → brown rabbit (brushy gentle slopes), gray fox → fox (near trees),
   coyote → chestnut wolf (in pairs), Pacific chorus frog → temperate frog (lake shore and
   riverbank), black bear → polar bear (forest, smaller), mountain lion → ocelot (rocky
   backcountry, summoned 1.6 times larger), bats roosting in the tunnel, and pack mules and horses
   beside the stable; rainbow trout are the salmon from step 3. Bears and lions keep 70 blocks from
   the dam, roads, dock and trail. Hikers: standing figures (mannequins, which have no AI and cost
   almost nothing) at the dam, tunnel, trail, ramp and dock, and four walking hikers (silent
   villagers with no trades) near the stable. Mule deer, bobcats, squirrels and rattlesnakes have
   no fitting model and are left out; Sierra bighorn live far higher, so no goats. Without the
   resource pack (step 6) everything still works but looks like the vanilla animals.
   ```text
   python plan_animals.py --world "<world>" > animals.txt   # then send the lines to the console
   python plan_animals.py --world "<world>" --only "black bear,mountain lion,hikers"   # just those
   ```
6. **Look and names (datapack and resource pack)** — [`pack/`](pack/README.md). A server-side
   datapack gives the world's biome Sierra colours (blue-green water, dry summer grass, olive
   leaves, deeper sky); players need nothing for it. A small resource pack (about 54 KB, all
   textures painted from code) repaints the polar bear as a black bear, the ocelot as a mountain
   lion and the salmon as a rainbow trout, dresses the hikers and renames them in game, and turns
   the stand-in rock, soil and trees into Sierra granite, decomposed-granite soil, ponderosa pine
   and black oak. The server offers it when players join.

All of these use [`world_columns.py`](prototype/world_columns.py), which loads chunks as full block columns,
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
| [`prototype/add_ramp.py`](prototype/add_ramp.py), [`add_tunnel.py`](prototype/add_tunnel.py), [`add_spillway.py`](prototype/add_spillway.py) | Upgrade 4: a boat ramp, a walking tunnel and the dam's gated spillway, placed from photos, a map and an aerial image |
| [`prototype/plan_animals.py`](prototype/plan_animals.py) | Upgrade 5: area-appropriate wildlife and hikers, summoned through the server |
| [`pack/`](pack/README.md) | Upgrade 6: biome colours (datapack) and the animals-and-hikers resource pack, built from code |
| [`map/`](map/README.md) | The web map workflow: any built world as a 3D browser map (overview and first person), and how to host it |
| [`build_reservoir.py`](build_reservoir.py) | A fresh world in one step from a site file and its bundle: [Calaveras](calaveras.md) (task [MC2](../../docs/roadmap/tasks/MC2-calaveras.md)), [Crystal Springs](crystal_springs.md) (task [MC6](../../docs/roadmap/tasks/MC6-crystal-springs.md)), Sunol Valley (task [MC8](../../docs/roadmap/tasks/MC8-sunol-valley.md): several lakes and dams, a vertical scale, creeks) |
| [`make_valley_terrain.py`](make_valley_terrain.py), [`fetch_creeks.py`](fetch_creeks.py) | Terrain for a world spanning several reservoirs (lidar at the lakes, blended into 10 m), and creek centre lines from OpenStreetMap (task [MC8](../../docs/roadmap/tasks/MC8-sunol-valley.md)) |
| [`sites/`](sites), [`palettes/`](palettes) | Per-site settings (crop, scale, water level, traced dam with sources) and per-biome block palettes |
| [`landmarks.py`](landmarks.py) | Landmarks from a site file's `landmarks` list, at their own scale: the Pulgas Water Temple with its pool, cypress and canal (task [MC7](../../docs/roadmap/tasks/MC7-pulgas-temple.md)); plain placeholders on real footprints (task [MC8](../../docs/roadmap/tasks/MC8-sunol-valley.md)) |
| [`prototype/warp.py`](prototype/warp.py) | The gentle canyon stretch that fills the gap a steeper dam face leaves |
| [`prototype/world_columns.py`](prototype/world_columns.py) | Shared world read/write for edits (full columns, palettes, heightmaps, entities, chests) |
| [`prototype/region_edit.py`](prototype/region_edit.py) | Low-level region and chunk read/write helpers |
| [`prototype/build_waterscape_biome.py`](prototype/build_waterscape_biome.py), [`inspect_hetch.py`](prototype/inspect_hetch.py) | How the base world was made (reference; not portable) |
| [`prototype/archive/`](prototype/archive/README.md) | Superseded one-shot edits; do not run on current worlds |

No generated worlds (other than the curated demo), mod JARs, game files or Python environments are
kept here. Not an official Minecraft product; not approved by or associated with Mojang or
Microsoft.
