# MC1: One builder — a fresh Minecraft world from `data/<id>/`

**Who:** capable · **Needs:** MC0 (`task/minecraft-accuracy`) merged · **Branch:** `task/MC1`

## Goal

One command writes a new, playable Minecraft Java 26.2 world for a water body from its
Waterscape bundle, with no hand edits and no Arnis base world:

```text
python experimental/minecraft/build.py hetch_hetchy --out "<new world folder>" [--upgrades roads]
```

Hetch Hetchy is the first site. The result must match or beat today's curated world
(`Hetch Hetchy - Structures test`): the canyon below the dam, the dam face and crest, the river,
the reservoir and the roads and buildings. This is the foundation for other people's reservoirs
(MC2) and for the guide (MC3).

## Why

The Hetch Hetchy world was made by a chain of one-shot scripts on copies of an Arnis world
(`build_waterscape_biome.py`, then the slope cut, plunge pool and OSM v1, then MC0's rebuild and
structures). Each later fix was a rebuild from the bundle's own inputs, and each hand edit had
drifted from the browser. A single builder makes that the only path.

## Read first

- [AGENTS.md](../../../AGENTS.md), [Making Water Visible](../../making-water-visible.md),
  [experimental/minecraft/README.md](../../../experimental/minecraft/README.md) and its
  [AGENTS.md](../../../experimental/minecraft/AGENTS.md).
- The MC0 scripts: `prototype/rebuild_downstream.py` (terrain resampling, river ribbon, gravity
  dam face, granite ground rules, trees, watertight shore), `prototype/osm_structures.py`
  (graded roads, parapets, buildings) and `prototype/world_columns.py` (full-column load/save,
  palettes, heightmaps, relight).
- `prototype/build_waterscape_biome.py` (whole-world terrain, lake bed, drawdown band) and the
  browser rules it approximates: `renderer/land/ground.js`, `renderer/land/oak-placement.js`,
  `renderer/land/structures.js`, `pipeline/dem.py`, `renderer/terrain.js`.

## Scope

1. **Empty template world.** Add a minimal Java 26.2 template (`level.dat`, no regions, no
   player data) under `experimental/minecraft/template/`, or generate `level.dat` in code.
   Record its `DataVersion`. Write every chunk from scratch (full NBT skeleton: `DataVersion`,
   `xPos`/`zPos`/`yPos`, `Status` full, sections with biomes and block states, heightmaps,
   empty entity/tick lists, light omitted so the game relights). Confirm against a chunk the
   game itself wrote; never rely on Arnis.
2. **Site settings.** A small JSON per site, e.g. `experimental/minecraft/sites/hetch_hetchy.json`:
   crop (lon/lat box), horizontal and vertical metres per block, the water's block y, world
   spawn and named viewpoints, biome palette name, and the optional upgrades (OSM extract path).
   Every Hetch Hetchy constant now in the prototypes moves here or is derived from the bundle.
3. **Stages, in order, each a module with explicit inputs:** terrain and lake bed (labelled
   synthetic); ground materials and drawdown band from the biome rules; trees; dams from
   `structures.json` by `type` (gravity profile now; leave a clear hook for embankment dams in
   MC2); rivers from `structures.json`; water and watertight shores; optional OSM roads, crest
   parapets and buildings. Reuse MC0's code rather than copying it; keep `world_columns.py`
   as the shared I/O layer.
4. **Biome palettes.** `sierra-granite` now, as a data file (block shares for rock, canyon rock,
   soil, plants, tree species → log/leaf blocks), so MC2 adds `diablo-oak` and
   `peninsula-oak-fir` without code changes.
5. **Provenance.** Write `waterscape-build.json` into each world: bundle id and commit, site
   settings, Minecraft and DataVersion, stages run, source links (3DEP, NID, OSM with ODbL
   attribution) and what is illustrative.
6. **Checks (offline, scripted).** Water edges with no lower dry neighbour; dam crest
   continuous at the crest height; river surface at `structures.json` levels; heightmaps match
   the blocks; wall/fence connection states; chunk NBT round-trips through `nbtlib`. Make
   overhead and isometric renders at fixed places (the dam, the canyon, the south-shore
   buildings) and compare them with the MC0 world and the browser's top-down view.
7. **Docs.** Update the experiment README (builder usage, site settings, stages; replace its
   "Build or update a world" section). The superseded one-shot edits are already in
   `prototype/archive/`; move `build_waterscape_biome.py`, `inspect_hetch.py` and the upgrade
   scripts there too once the builder covers them, and update the archive README. Keep the
   install guide and its anchors (the main README links to it).

Out of scope: other reservoirs (MC2), the make-a-waterscape guide (MC3), servers (MC4), rivers,
new mods, changing the browser renderer.

## Acceptance

- `build.py hetch_hetchy` creates a new world in a few minutes on this machine, from a clean
  checkout plus the Python packages already listed (`numpy`, `scipy`, `Pillow`, `pyproj`,
  `nbtlib`).
- It opens in Minecraft Java 26.2 with no upgrade prompt and no errors in `latest.log`; a human
  confirms the dam, canyon, river, lake and buildings in game from the README viewpoints.
- The offline checks above pass and their output is recorded in the task Result.
- No Hetch Hetchy constant remains in builder code; it is all in the site file or the bundle.
- Generated worlds, renders and caches stay out of the commit.

## Result

(Append when done: status, commit, checks with their final lines, notes.)
