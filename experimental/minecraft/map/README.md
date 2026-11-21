# Web map (BlueMap): show a reservoir without the game

A 3D map of a Waterscape Minecraft world that anyone can explore in a browser, without owning
Minecraft: an angled overview of the whole valley, and a **Walk around in first person** button
that drops visitors onto the ground to fly around at eye level. A panel explains the reservoir
in a few lines taken from its own data bundle. [BlueMap](https://bluemap.bluecolored.de/)
(MIT licence) draws the world, with our resource pack, into a folder of static files.

| File | What it is |
|---|---|
| `render_map.sh` | The whole workflow: lights a copy of the world, writes the settings, renders into `build/run/web` |
| `make_site.py` | Writes the map settings and panel text for one reservoir (called by `render_map.sh`) |
| `sites/<id>.json` | Per reservoir: viewpoints, which facts to show, what is illustrative |
| `bluemap/` | BlueMap settings and the map template (sky colour, render area, no usage reports) |
| `waterscape.js` | On-map panel: description, the first-person button with how-to, credits |
| `Caddyfile.example` | Caddy site that serves the folder correctly |

## Render

You need Java 25, Python 3, a **spare** Fabric server folder for the world's Minecraft version
(never the live server), and two jars: the BlueMap CLI (`bluemap-<version>-cli.jar` from the
[releases](https://github.com/BlueMap-Minecraft/BlueMap/releases); 5.29 handles 26.3) and Chunky
for Fabric.

```
./render_map.sh --world ~/.minecraft/saves/"Hetch Hetchy - Preview" --site sites/hetch_hetchy.json \
  --server ~/spare-server --chunky Chunky-Fabric-1.5.66.jar --bluemap bluemap-5.29-cli.jar --serve
```

Then open http://127.0.0.1:8100. Hetch Hetchy takes about 3 minutes and makes about 160 MB.

Give each reservoir its own `--work` folder so one render does not replace another, and pass a
pack only when the world was drawn for it (`--pack none` keeps vanilla textures; the Hetch pack
repaints oaks and granite for the Sierra). Calaveras:

```
./render_map.sh --world ~/.minecraft/saves/"Calaveras Reservoir - Waterscape" --site sites/calaveras.json \
  --work build-calaveras --pack none \
  --server ~/spare-server --chunky Chunky-Fabric-1.5.66.jar --bluemap bluemap-5.29-cli.jar --serve
```

What it does:

1. **Lights the world.** Our builders leave lighting to the game (it lights a chunk the first
   time the chunk loads), but BlueMap reads chunks straight from disk and skips any without
   light data, so most of the map would be missing or black. The script loads a copy once on
   the spare server with Chunky, existing chunks only (`forceLoadExistingChunks`, pattern
   `world`): the fix BlueMap recommends
   ([Fixing world lighting](https://bluemap.bluecolored.de/community/FixLighting.html)).
   It restores the spare server's `server.properties` afterwards and removes Chunky again if it
   added it.
2. **Writes the settings** (`make_site.py`): the render area is the rectangle of chunks the
   original world holds (lighting the edge makes the game start generating chunks just outside;
   those stay off the map), and the panel text is the reservoir's name, headline and facts from
   `data/<id>/story.json`, so every number shown has its source recorded there.
3. **Renders** with BlueMap and adds the panel.

The map shows blocks only: no animals, hikers or players, and simpler lighting than the game
(game shader packs do not run in a browser viewer).

## Another reservoir

1. Build its world (see the [Minecraft README](../README.md)).
2. Copy `sites/hetch_hetchy.json` to `sites/<id>.json`, where `<id>` is its `data/` folder.
   `facts` lists `story.json` fact labels to show (leave it out for the featured ones);
   `illustrative` says what is authored rather than measured. `sky` is the sky colour from the
   world's biome datapack (its palette's `minecraft:visual/sky_color`); the default is the Sierra's.
3. Render once with `--serve`, find a good overview and a good eye-level spot in the browser, and
   copy their addresses (the part after `#<id>:`) into `viewpoints`. `start` is optional.
4. Render again and host.

## Host

The tiles are stored gzip-compressed, so the web server has to send `*.prbm.gz` and
`textures.json.gz` with `Content-Encoding: gzip`. GitHub Pages cannot set that header, so it
cannot serve this map as is (unpacked it would be about 3 GB, over Pages' limit). Caddy, nginx
and Apache can ([BlueMap's guide](https://bluemap.bluecolored.de/wiki/webserver/ExternalWebserversFile.html)),
and so can Cloudflare R2 with rewrite rules ([guide](https://bluemap.bluecolored.de/community/CloudflareR2.html)).

With Caddy:

1. Copy the site: `rsync -a --delete build/run/web/ HOST:/srv/waterscape-map/`
2. Add the block from `Caddyfile.example` (your domain and folder), then
   `caddy validate --config /etc/caddy/Caddyfile` and reload Caddy.
3. Point the domain at that machine (a DNS A or CNAME record).
4. Check: `curl -sI https://YOUR-DOMAIN/maps/<id>/textures.json` shows
   `content-encoding: gzip`, and the map opens in a browser.

To update after the world changes, render again and repeat step 1.
