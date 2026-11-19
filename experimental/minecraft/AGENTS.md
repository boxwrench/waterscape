# Minecraft experiment: agent workflow

Read the repository root [AGENTS.md](../../AGENTS.md),
[Making Water Visible](../../docs/making-water-visible.md), and this folder's
[README](README.md) before changing the experiment. These instructions supplement the root
instructions and the user's request.

1. **Inspect inputs first.** Identify the reservoir, requested landmarks and bounding box.
   Read `data/<id>/terrain.json`, `source.json`, `land.json`, biome metadata and any structure
   metadata. Distinguish measured terrain from authored or procedural setting. Do not assume
   every reservoir includes Hetch Hetchy's dam, biome, drawdown or detail tiles.
2. **Preserve geography.** Record map projection, coordinate conventions, horizontal and vertical
   scales, world height range, clipping, water level and known landmark coordinates. Compare real
   and block distances. Improve distant visibility through appropriate rendering settings before
   distorting horizontal geography, unless the user explicitly wants a stylized scale.
3. **Use Waterscape first.** Decode the terrain channels using the current repository's
   `pipeline/dem.py` and `renderer/terrain.js`; the fourth drawdown channel is optional despite
   some metadata descriptions saying three channels. Translate biome and tree rules into an
   explicitly approximate block palette. ESA WorldCover or imagery can be an optional comparison,
   not a mandatory dependency or an exact record of every tree or surface.
4. **Keep assumptions visible.** The lidar terrain does not establish underwater bathymetry.
   Label synthetic lake bottoms, dam cross-sections, tree models and artistic materials. Do not
   claim the web renderer's 1 m normal/relief textures are a complete high-resolution elevation
   grid. Keep real source data and illustrative details distinguishable.
5. **Protect worlds.** Generate into a new staging directory; never edit a live or open world.
   Back up any existing world before an explicitly requested edit. Verify target paths and game
   version, preserve the original save, and only install a separate copy after validating output.
   Follow the environment's filesystem permissions; a user request does not bypass a sandbox.
6. **Know which scripts are current.** In `prototype/`, `rebuild_downstream.py` and
   `osm_structures.py` take explicit paths, dry-run by default and refuse to run twice;
   `world_columns.py` and `region_edit.py` are shared I/O. `build_waterscape_biome.py` and
   `inspect_hetch.py` record how the base world was made and assume the original local layout.
   `prototype/archive/` holds superseded one-shot edits: never run them on a current world. None
   of this is a supported CLI yet (that is task MC1); still Hetch Hetchy-specific, and none of it
   may point at a user's only save. Generated worlds belong in the repository only when
   explicitly requested as curated, reviewed demos; do not commit player data, mod JARs, caches,
   private location data or credentials.
7. **Verify and report.** Check decoded values, geography, world bounds, chunk/NBT integrity,
   palette, water and heightmaps. Open a copy in the target version when feasible; capture fixed
   in-game viewpoints, test travel and performance, and report what was actually observed.
   An overhead raster is not a Minecraft screenshot. Label any untested step or compatibility.
8. **Make the workflow reusable.** Put portable code, tests and reservoir-specific configuration
   in this experiment rather than copying Hetch Hetchy constants. Record dependencies and
   versions; retain the source links and settings used for each output. Update the README when
   capabilities or limitations change.
9. **Follow the browser, not hand edits.** When the world and the browser disagree, rebuild the
   area from the browser's own inputs and rules (bundle terrain, `structures.json`,
   `renderer/land/*.js`) rather than sculpting a fix; see the README's optional upgrades. Use
   `prototype/world_columns.py` for new edits and check results offline (sections, water edges,
   renders) before anyone opens the world.

For client mods and distance-rendering starting points, use the README's install guide (Java 26.3,
the current release) and confirm compatibility and dependencies on each project's page before installing.
Planned work is [track MC](../../docs/roadmap/README.md#track-mc--playable-minecraft-maps).
