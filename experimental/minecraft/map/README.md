# Web map (BlueMap)

A 3D map of the Minecraft world that anyone can explore in a browser, without Minecraft.
[BlueMap](https://bluemap.bluecolored.de/) (MIT licence) draws the world from its region files,
with our resource pack, into a folder of static files.

| File | What it is |
|---|---|
| `render_map.sh` | Lights a copy of the world, then renders it into `build/run/web` |
| `bluemap/` | BlueMap settings: Hetch Hetchy map, sky colour, no usage reports |
| `waterscape.js` | On-map panel: description, a first-person button with how-to, and credits (OpenStreetMap's licence asks for visible attribution) |
| `Caddyfile.example` | Caddy site that serves the folder correctly |

## Render

You need Java 25, a **spare** Fabric server folder for the world's Minecraft version (never the
live server), and two jars: the BlueMap CLI (`bluemap-<version>-cli.jar` from the
[releases](https://github.com/BlueMap-Minecraft/BlueMap/releases); 5.29 handles 26.3) and Chunky
for Fabric.

```
./render_map.sh --world ~/.minecraft/saves/"Hetch Hetchy - Preview" \
  --server ~/spare-server --chunky Chunky-Fabric-1.5.66.jar --bluemap bluemap-5.29-cli.jar --serve
```

Then open http://127.0.0.1:8100. Hetch Hetchy takes about 3 minutes and makes about 160 MB.

Why the spare server: our builders leave lighting to the game (it lights a chunk the first time
the chunk loads), but BlueMap reads chunks straight from disk and skips any without light data.
The script loads every existing chunk once with Chunky (`forceLoadExistingChunks`, pattern
`world`), the fix BlueMap recommends ([Fixing world lighting](https://bluemap.bluecolored.de/community/FixLighting.html)).
It copies the world first, restores the spare server's `server.properties` afterwards and
removes Chunky again if it added it. Lighting the outermost chunks makes the game start
generating chunks just outside the map; the render mask in `bluemap/maps/hetch_hetchy.conf`
leaves those out.

The map shows blocks only: no animals or hikers.

## Host

The tiles are stored gzip-compressed, so the web server has to send `*.prbm.gz` and
`textures.json.gz` with `Content-Encoding: gzip`. GitHub Pages cannot; Caddy, nginx and Apache
can ([BlueMap's guide](https://bluemap.bluecolored.de/wiki/webserver/ExternalWebserversFile.html)),
and so can Cloudflare R2 with rewrite rules ([guide](https://bluemap.bluecolored.de/community/CloudflareR2.html)).
Unpacked it would be about 3 GB.

With Caddy:

1. Copy the site: `rsync -a --delete build/run/web/ HOST:/srv/waterscape-map/`
2. Add the block from `Caddyfile.example` (your domain and folder), then
   `caddy validate --config /etc/caddy/Caddyfile` and reload Caddy.
3. Point the domain at that machine (a DNS A or CNAME record).
4. Check: `curl -sI https://YOUR-DOMAIN/maps/hetch_hetchy/textures.json` shows
   `content-encoding: gzip`, and the map opens in a browser.

To update after the world changes, render again and repeat step 1.
