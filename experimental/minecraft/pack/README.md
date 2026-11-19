# Look and names: datapack and resource pack

Optional upgrade 6 for a Waterscape Minecraft world. Both are built from code here; neither
changes the world's blocks, only how they look.

| | What it does | Who needs it |
|---|---|---|
| **Datapack** `waterscape-sierra` | Redefines the world's biome (`minecraft:forest`, the only one in the Hetch Hetchy world) with Sierra colours from [`biome_colours.json`](biome_colours.json): blue-green water, dry summer grass, olive oak leaves, a deeper sky, clearer fog and darker water underneath. Spruce and birch leaves have fixed colours in Minecraft and do not change. | The server only. Players receive the colours when they join. Restart the server to apply (biomes are not reloaded by `/reload`). |
| **Resource pack** `waterscape-hetch-pack.zip` | Repaints models Minecraft has into Sierra animals and hikers, and renames them (English): polar bear → **black bear** (brown, as most Sierra black bears are), ocelot → **mountain lion**, salmon → **rainbow trout**, wolf → **coyote** (name only), villager → **hiker** (four outfits by villager type), mannequin → **hiker** (three skins under `waterscape:entity/hiker_a…c`). Blocks: the world's stand-in rock (diorite, andesite, calcite, stone) becomes warm Sierra granite, andesite with dark water stains; coarse dirt becomes decomposed-granite soil; spruce becomes **ponderosa pine** (cinnamon plated bark, yellow-green needles drawn without Minecraft's fixed spruce tint); dark oak logs become **black oak** bark. These apply wherever the blocks appear, which is fine for a server that only runs this world. | Each player, once: the server offers it on joining. About 54 KB. |

The animals and hikers themselves are summoned by [`../prototype/plan_animals.py`](../prototype/plan_animals.py)
(upgrade 5). Without the pack they still work but look like the vanilla animals, and the standing
hikers show the default skin.

## Build

```text
python build_pack.py                        # -> build/waterscape-hetch-pack.zip and its sha1
python build_datapack.py --server-jar <server-26.3.jar>   # -> build/waterscape-sierra/
python preview.py                           # -> build/preview.png: every model, front and back, and the colours
```

Python 3 with Pillow and numpy. Textures are painted box by box from each model's layout
([`paint.py`](paint.py)); the pack contains no Mojang art. The datapack copies the biome from the
given server jar and changes only its colours, so it always matches that game version; rebuild it
for a new version. The zip is written with fixed dates, so the same code gives the same sha1.

## Use

- **Single player:** copy `build/waterscape-sierra/` into the world's `datapacks/` folder and
  the zip into `.minecraft/resourcepacks/`, then turn the pack on under Options → Resource Packs.
- **Server:** copy the datapack folder into `world/datapacks/`, host the zip at a public URL and set
  in `server.properties`:
  ```text
  resource-pack=<URL of the zip>
  resource-pack-sha1=<contents of build/waterscape-hetch-pack.sha1>
  require-resource-pack=true
  resource-pack-prompt={"text":"Waterscape: Sierra granite, pines, animals and hikers (54 KB)"}
  ```
  Restart. A required pack means a player who declines is disconnected; set it to `false` to make
  it optional.

## Notes

- Pack format 97 (Minecraft 26.3, resource pack 97.1) and data format 121.
- The mountain lion is the ocelot model summoned at 1.6 times its size (`minecraft:scale`), the
  black bear the polar bear at 0.85. Natural spawning is off in the Hetch Hetchy world, so no wild
  polar bears or ocelots appear on their own.
- Walking hikers are unemployed villagers: they wander, do not trade, and are silent. The world has
  no other villagers, so repainting them changes nothing else.
