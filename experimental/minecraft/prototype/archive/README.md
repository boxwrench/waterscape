# Archived Minecraft scripts

Kept for history only. **Do not run these on a current world**: each was a one-shot edit for the
Hetch Hetchy demo, and later scripts replace what they did.

| Script | What it did | Replaced by |
|---|---|---|
| `granite_canyon.py` | Swapped soil for stone in the canyon below the dam | `../rebuild_downstream.py` (canyon rock from the browser's ground rules) |
| `remove_dam_slope.py` | Cut away the sloping mass below the dam | `../rebuild_downstream.py` (the slope was the dam's own face; it is now built from the gravity profile) |
| `add_dam_pool.py` | Added an illustrative plunge pool and rock rim | `../rebuild_downstream.py` (river ribbon from `structures.json`) |
| `add_osm_features.py` | Flat OSM road lines and box building shells | `../osm_structures.py` (graded roads, parapets, buildings) |
| `build_east.py` | An alternative world surfaced from ESA WorldCover land cover, for comparison | `../build_waterscape_biome.py` (Waterscape's own biome rules); ESA data is not needed |

They expect the original local folder layout (a `source/` folder, sibling Arnis folders, named
world folders) and import `region_edit.py` from the parent folder, so they will not run from here
as they are. The demo zip in [`../../demo/`](../../demo/README.md) was made with them; see its
README for what that version contains.
