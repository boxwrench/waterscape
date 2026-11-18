# Experimental Minecraft Java landscapes

This experiment translates Waterscape reservoir data into Minecraft Java worlds made
of ordinary blocks. The aim is a recognizable landscape and long views from real landmarks,
without reshaping the geography merely to fit Minecraft's render distance. It is a prototype,
not an automatic exporter: a [Hetch Hetchy demo world](demo/README.md) is included, and the
archived scripts here need adaptation before someone else can run them.

For an agent implementing or continuing the work, start with [AGENTS.md](AGENTS.md). The parent
repository instructions still apply. See [the prototype notes](#prototype-code) before running
any script.

## What comes from Waterscape

Use the reservoir's own `data/<id>/` bundle as the primary input:

- `terrain.json` and `terrain.bin.gz`: elevation, shoreline distance and valley fields; some
  bundles add a drawdown field. Metadata describes the coordinate system, grid and quantization.
  See [the terrain decoder](../../renderer/terrain.js) and [data packer](../../pipeline/dem.py).
- `source.json` and `land.json`: location, biome, season, vegetation, shoreline treatment and
  other settings. Biome assets live under [`data/biomes`](../../data/biomes).
- `structures.json`, where present: mapped or authored structures, such as O'Shaughnessy Dam.
  Not every reservoir has this file.
- `aerial.json` and `detail.json`, where present: imagery provenance and local detail. Hetch
  Hetchy's detail images encode normals and local relief for rendering, not a complete 1 m
  elevation grid. Their metadata links to the underlying elevation sources.

Waterscape's [ground material](../../renderer/land/ground.js) and
[tree placement](../../renderer/land/oak-placement.js) use terrain and procedural rules. The
prototype approximates these in blocks; it does not reproduce the web shader or tree meshes.
Satellite land cover such as ESA WorldCover is an **optional alternative** for mapping broad
land-cover classes. It is not needed for the Waterscape-driven version.

Terrain and shoreline originate in mapped data, but Minecraft applies horizontal resampling,
vertical compression and block choices. Tree placement and species-shaped trees are procedural;
the dam cross-section and lake bottom are approximations. Land-cover classes are not a survey of
individual trees or rock types. Do not describe the modelled lake floor as measured bathymetry.
Record sources, scales and assumptions with every new world.

## Hetch Hetchy comparison

The two local experiments cover the same area, including the dam and Kolana Rock:

| World | Surface approach |
|---|---|
| `Hetch Hetchy - Granite Valley` | ESA-guided land cover plus slope; spruce-like trees. |
| `Hetch Hetchy - Waterscape Biome` | Waterscape-inspired slope, valley, shoreline and procedural vegetation; pale drawdown band and pine-like / oak-like trees. |

Both use the same terrain, water, dam and bounds: latitude 37.938–37.972 and longitude
−119.801–−119.742. One horizontal block represents approximately 2 m; a vertical block
represents approximately 4 m, so the mountains are vertically compressed. Water is at y=80;
the synthetic lake floor is generally 8–32 blocks below the surface with low-frequency
variation. The downstream river has a separate shallower channel. The result is a 3D terrain
test, not a measured lake-bottom survey or a full recreation of the reservoir.

The included `Hetch Hetchy - Pool and Roads` demo adds granite-like rock, an illustrative
plunge pool and the mapped downstream river; it also removes the separate slope identified in
the user's screenshot. Mapped OSM roads and approximate building shells are added separately;
they were not in the terrain-only Arnis base. The cut preserves dam concrete and existing water;
it is interpretive rather than surveyed. Its blocks and archive have been checked offline, but
the changed world has not yet been visually verified in Minecraft.

The Waterscape settings describe a Sierra granite setting with ponderosa pine and California
black oak. The prototype approximates these with diorite/andesite and spruce/dark-oak blocks; it
uses calcite for a pale shoreline band. It uses a coarser tree spacing than the web renderer and
does not match the web scene tree for tree. The old Minecraft Java `granite` block is notably
pink, so its name alone does not make it the closest visual match.

For comparison, enable creative flight and use the same camera in each world:

```text
/tp @s 1534 110 778 -42 10
```

This location is over the water; enable flight first. It looks toward the Kolana area. The
prototype outputs a material-plan image as well, but a plan is not an in-game screenshot. Both
worlds need in-game visual and performance review; the no-ESA version has not yet been verified
in-game by the agent that generated it.

## Suggested conversion workflow

1. Pick a reservoir, the landmark and a bounded area. Review its `source.json`, terrain metadata,
   `land.json`, biome assets and any structure data; check geographic coverage before generation.
2. Choose the horizontal and vertical scales deliberately. Convert between the bundle's local
   east/south coordinates, its projected coordinates, geographic coordinates and the Java
   world's block coordinates; check known landmarks and source-grid bounds. Preserve a record
   of the transform and any height clipping.
3. Create a **new, disposable base Java world** for that bounding box. A terrain-only
   [Arnis](https://github.com/louis-e/arnis) world supplied the base-world structure and
   geographic metadata for the prototypes. The conversion replaces the base terrain; it does
   not need Arnis land cover for the Waterscape-driven surface.
4. Decode and sample Waterscape's elevation, shoreline and optional channels. Build block
   columns, water, estimated lake bed and any sourced structures. Translate the selected biome
   settings into a block palette and plausible procedural trees. Keep actual map data separate
   from artistic rules and synthetic underwater terrain.
5. Generate to a new world directory while Minecraft is closed for that world. Never write over
   an existing save. Update chunk palettes, heightmaps and lighting information as needed for
   the target Java version; inspect sample chunks and check paths and coordinates.
6. Open a **copy** in the matching Minecraft Java profile. Verify landmarks, shore, water,
   cliffs, tree density, chunk boundaries, lighting and whether the player can navigate. Take
   comparable in-game screenshots from fixed positions, and report any unverified behavior.
7. Test view distance and frame rate before increasing detail. Document the game, loader and mod
   versions, hardware, settings, generation time and provenance; keep large generated worlds,
   downloads, caches and credentials out of the repository.

The current Hetch Hetchy converter does not yet support other reservoirs automatically.
Calaveras and San Antonio specify a Diablo oak setting with golden summer grass, while Crystal
Springs specifies an oak/fir setting. Reuse the workflow, but implement and verify each biome,
dam and crop from its own bundle rather than reusing Hetch Hetchy constants.

## Recommended client setup

This is a Java Edition workflow. Select versions for **the exact Minecraft version and Fabric
loader** in use, and install dependencies listed on each mod's version page. Do not assume a
version compatible with one release works on the next. The local experiment used Minecraft
26.2 and Fabric; the world-generation and in-game compatibility of other versions need testing.

| Tool | Why use it |
|---|---|
| [Fabric Loader](https://fabricmc.net/use/installer/) and [Fabric API](https://modrinth.com/mod/fabric-api) | Loader and shared API for the Fabric mod setup. |
| [Sodium](https://modrinth.com/mod/sodium) | Rendering performance. |
| [Distant Horizons](https://modrinth.com/mod/distanthorizons) | Simplified distant terrain, useful for seeing cliffs without fully rendering every intervening chunk. |
| [Controlify](https://modrinth.com/mod/controlify) | Controller support, if desired. |
| [Creative Fly](https://modrinth.com/mod/creative-fly) | Faster creative flight; its [Mod Menu](https://modrinth.com/mod/modmenu) configuration is useful without a mouse wheel. |
| [Iris](https://modrinth.com/mod/iris) | Optional shader loader. Use a shader pack explicitly compatible with Distant Horizons if combining them. |

Dependencies vary by version: for example, the local Creative Fly 26.2 version requires
[Cloth Config API](https://modrinth.com/mod/cloth-config), and Controlify may require
[YetAnotherConfigLib](https://modrinth.com/mod/yacl). Confirm the version page instead of
assuming this list is exhaustive. Mods are optional for the generated blocks themselves.

For the Hetch Hetchy crop, the dam-to-Kolana summit distance is approximately 1,265 Minecraft
blocks, or 79 chunks, at the prototype's horizontal scale. A useful starting experiment is
12–16 normal render chunks and 96 Distant Horizons chunks, increasing the latter modestly if
needed. These are **starting settings, not measured performance guarantees**. Distant Horizons
may need time to build its cache or prior exploration; shader support depends on the pack. Test
with shaders off first and adjust to the machine.

## Prototype code

The [`prototype`](prototype) folder preserves the local experiment's scripts for reference:

- `inspect_hetch.py` decodes the Hetch Hetchy terrain into a NumPy archive and draws an overview.
- `build_waterscape_biome.py` is the Waterscape-inspired conversion; `build_east.py` is the
  ESA-guided comparison.
- `region_edit.py` contains shared offline Java region/NBT helpers.
- `granite_canyon.py` is a localized Hetch Hetchy soil-to-stone edit, with a dry run by default.
  It needs explicit world and structures paths; `--apply` writes to the supplied **offline copy**.
- `remove_dam_slope.py` removes the identified downstream slope from a world copy, with a dry run
  by default. It preserves dam and water blocks and updates heightmaps and lighting. It is tied
  to this crop and needs the same explicit paths. The cut is a one-shot edit: do not rerun it on
  an edited world, because its blended edges would be cut further.
- `add_dam_pool.py` adds the illustrative pool and rocky rim; `add_osm_features.py` translates a
  cropped OSM extract into mapped road/trail blocks and generic building shells. Both default to
  a dry run and require an explicit offline world copy. The source extract and OSM attribution
  are documented with the [demo](demo/README.md).

**These snapshots are not a portable pipeline.** They assume a specific sibling-directory
layout, external Python packages (`numpy`, `scipy`, `Pillow`, `pyproj`, `nbtlib`), a prepared
Arnis base world and copied source files. The builders edit the world at their configured path
in place. They also contain Hetch Hetchy-specific bounds, water level, dam and tree logic.
They must be reviewed and adapted to explicit input/output paths before reuse. No generated
world, ESA imagery, downloaded mod JAR or Python environment is included here.
