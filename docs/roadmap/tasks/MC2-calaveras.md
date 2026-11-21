# MC2: Calaveras Reservoir as a Minecraft world

**Who:** capable · **Needs:** the Calaveras bundle (`data/calaveras/`, done) and the dam in the site
file (step 2) · **Branch:** `task/MC2-calaveras`

## Goal

A Minecraft Java 26.3 world of Calaveras Reservoir that someone who knows the place recognises:
golden grass hills, dark oak woodland in the ravines and on north-facing slopes, the lake, and
Calaveras Dam with its crest, rock-armoured upstream face and spillway. It is built from the
bundle and the browser's own rules, never hand-sculpted.

MC1 (one builder for every bundle) is still open. Until it lands, Calaveras is built by
[`experimental/minecraft/build_reservoir.py`](../../../experimental/minecraft/build_reservoir.py)
(first written as `build_calaveras.py`), which reads its constants from a site file and a palette
file so MC1 can absorb it. Do not copy it for another reservoir: give it a site file
(`--site`), as [MC6](MC6-crystal-springs.md) does for Crystal Springs.

## Stop rules (read before you write code)

- **No task file, no work.** If a user asks for a reservoir that has no task file here, write
  one from this template first and ask for it to be checked, or stop and report.
- **A missing input is a stop, not a workaround.** If the bundle, the dam geometry or a fact
  you need is missing, stop and report what is missing and where it would come from. Do not
  ship a world without its dam because no file described it (the first attempt did).
- **Every number has a source URL** next to it in the site file (root AGENTS.md rule 3).
- **Do not commit worlds or zips** unless the maintainer asks for a reviewed demo.

## Read first

- [AGENTS.md](../../../AGENTS.md), [Making Water Visible](../../making-water-visible.md),
  [experimental/minecraft/README.md](../../../experimental/minecraft/README.md) and its
  [AGENTS.md](../../../experimental/minecraft/AGENTS.md).
- The browser rules this world translates: [`renderer/land/ground.js`](../../../renderer/land/ground.js)
  (ground blend), [`renderer/land/oak-placement.js`](../../../renderer/land/oak-placement.js)
  (where every oak stands), [`renderer/engine/look.js`](../../../renderer/engine/look.js)
  (summer gold palette, species weights).
- What it should look like: [`data/calaveras/poster.jpg`](../../../data/calaveras/poster.jpg)
  (the browser scene) and [`data/calaveras/aerial.jpg`](../../../data/calaveras/aerial.jpg)
  (NAIP, the real ground).

## Steps

1. **Scale (a maintainer decision, recorded in the site file).** 4 m per block on all three axes
   keeps true proportions and fits the 6 × 6.7 km crop in 1,504 × 1,664 blocks. Hetch Hetchy uses
   2 m horizontally and 4 m vertically: twice the detail, four times the area. Use 4 m unless the
   maintainer says otherwise.
2. **Site file** [`experimental/minecraft/sites/calaveras.json`](../../../experimental/minecraft/sites/calaveras.json):
   crop, scale, water block y, seed, palette, and the dam:
   - crest line (UTM), traced on a NAIP image whose `exportImage` URL is recorded;
   - crest elevation, the 3DEP maximum along that line (URL recorded);
   - type, height and length from the National Inventory of Dams (URL recorded);
   - the spillway's centre line and width, traced on the same NAIP image.

   The dam lives here, not in `data/calaveras/structures.json`: the browser draws every
   `structures.json` dam with a concrete gravity profile, which is wrong for an earth dam. Moving it
   there needs an embankment profile in `renderer/land/structures.js` first (a browser task).
3. **Palette file** [`experimental/minecraft/palettes/diablo-oak.json`](../../../experimental/minecraft/palettes/diablo-oak.json)
   maps the browser's materials to blocks:
   - **Grass is the ground.** `grass_block` everywhere the browser shows grass, coloured summer
     gold by a datapack that redefines the world's biome (as Hetch Hetchy's `pack/` does), with
     dry-grass plants on top. Not dirt, terracotta or mud: they read as bare earth or orange clay.
   - **Soil only where the browser puts soil:** the bank within 3 to 6 m above the water, and
     small patches (its `patch` noise above 0.72 to 0.86, at most 60 per cent strength).
   - **Rock only where the browser's slope rule puts it** (`0.34` to `0.55` on slope plus noise,
     reduced in valleys).
   - **Oaks per species:** coast live oak dark leaves on dark oak logs, blue oak pale grey-green
     leaves, valley oak ordinary oak leaves.
4. **Trees in world units.** Port `oakSite` exactly (same hash, the same 9 m lattice,
   `OAK_CELL`), so each Minecraft oak stands where the browser draws one. Convert metres to
   blocks only when placing: crown radius 3.4 to 6.6 m, about 1 to 1.6 blocks at 4 m per block.
   Woodland must close into a canopy in ravines and on north-facing slopes, as in the aerial.
5. **The dam.** The 10 m lidar already holds the embankment as a smooth hill. Dress it from the
   site file:
   - a level crest at its elevation, with a road;
   - riprap (rock) on the upstream face from the crest down to the water;
   - grass and no trees on the downstream face;
   - the spillway chute with walls, and its stilling basin.

   Keep the lake watertight: no water cell may have a lower dry neighbour.
6. **Datapack and level.dat.** Write the biome-colour datapack into the world's `datapacks/`
   folder and enable it in `level.dat`, so the gold shows in single player as well as on a
   server.

## Acceptance (all of these, with pictures in the Result)

- **Side by side with the aerial.** An overhead render of the world next to the same crop of
  `aerial.jpg`. Pass: golden grass dominates the open ground; woodland forms continuous dark
  patches where the aerial has them (ravines, north-facing slopes), not an even sprinkle; no
  large blotches that follow no landform.
- **The dam.** An isometric render and an in-game screenshot of the dam. Pass: a straight, level
  crest across the north end of the lake, a grey rock band above the water on the lake side, a
  bare grassed face downstream, and the spillway chute running down the west side.
- **The browser viewpoints.** In-game screenshots from the three viewpoints in `cameras.json`
  next to the browser's view from each. An overhead raster is not a Minecraft screenshot; if you
  cannot open the game, say so and leave this to the maintainer.
- **Offline checks.** Chunk NBT round trip, heightmaps match blocks, water level, and the leak
  check, each with its final output line.
- **Loads cleanly.** The world opens in a 26.3 server or client with no errors in `latest.log`.

## Result

### First attempt (Codex, branch `task/calaveras-minecraft-build`)

Built a structurally valid world with the right terrain, shoreline and viewpoints, but:

- **Ground:** random orange and brown blotches of terracotta, packed mud and coarse dirt; the
  browser's base is grass.
- **Trees:** one tree per 28 m against the browser's 9 m lattice, so the woodland never closed.
- **Dam:** none; there was no dam in any file, and the build went ahead without one.
- **Code:** a one-off script with hard-coded constants, plus a 13 MB world zip in the commit.

Cause: there was no task file, so the roadmap prerequisites were not enforced, and no Minecraft
palette existed for the biome. The only visual check was its own overhead picture. This file
exists so the next attempt has the rules in writing.

### Repair (2026-11-20)

- Status: offline checks done; in-game acceptance by the maintainer pending.
- Builder now reads [`sites/calaveras.json`](../../../experimental/minecraft/sites/calaveras.json)
  and [`palettes/diablo-oak.json`](../../../experimental/minecraft/palettes/diablo-oak.json).
- **Ground:** `ground.js` translated (grass base, gold via the `waterscape-diablo` datapack; soil on
  the bank within 80 m of the shore and in patches; rock on steep ground).
- **Trees:** `oakSite` ported exactly. 252,950 sites, 250,420 oaks placed (the rest on the dam,
  the spillway or viewpoints); crowns sized to the browser's radii.
- **Dam:** traced from NAIP and 3DEP (crest 372 m at 237.4 m, against NID's 1,210 ft). Crest at
  y 68, riprap face, grassed downstream face, spillway chute and a contained stilling basin.
- **Checks:**
  - lake leaks 0;
  - 9,776 chunks written, 105 decoded and compared block for block;
  - loaded on a Fabric 26.3 server: no errors, datapack enabled;
  - `node scripts/check-doc-links.mjs` → `Documentation links valid (140 Markdown files).`;
  - the refactored `pack/build_datapack.py` reproduces the live Hetch Hetchy datapack
    byte for byte.
- Renders: overhead beside the aerial crop, and isometric views of the dam (kept out of the repository).
