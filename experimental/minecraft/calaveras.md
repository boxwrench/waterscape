# Calaveras Reservoir Minecraft prototype

The build uses the Calaveras [terrain](../../data/calaveras/terrain.json),
[summer land settings](../../data/calaveras/land.json) and [camera positions](../../data/calaveras/cameras.json).
It covers the full source shoreline and enough of the surrounding Diablo Range to include all
three browser viewpoints. The crop spans 6.016 km east to west and 6.656 km north to south, at
four metres per block along each axis. The source grid is spaced about 10.46 metres apart.

Terrain and shoreline come from the bundle. The dam uses the embankment present in that terrain.
The source bundle has no separate dam, road or building geometry for this site. The golden ground
palette and the three oak variants follow the browser's summer look and tree placement rules.
The lake bottom uses the bundle's modeled bank slope and depth cap with small variations.

## Build

From the repository root, with `numpy`, `scipy`, `Pillow` and `nbtlib` installed, pass a Java
26.3 save as the header template and choose a new output directory.

```text
python experimental/minecraft/build_calaveras.py --template "<Java 26.3 save>" --out "<new save folder>"
```

The builder takes version keys and dimension generator settings from the template. It writes
fresh chunks in the 26.3 format, with a new seed and no template player data. The result includes
`waterscape-build.json` with the input commit, projection, scale, seed, assumptions and viewpoint
coordinates. The generated save and overhead map are local outputs. Normal Minecraft terrain can
generate beyond the crop.

## Review

Open **Calaveras Reservoir - Waterscape** in Java 26.3 as a singleplayer creative world. It
starts at the north ridge. Use the following positions to review the same parts of the landscape
as the browser scene.

| View | Command |
|---|---|
| North ridge | `/tp @s 217 101 194 -25.9 6.9` |
| West ridge | `/tp @s 192 129 1169 -106.1 8.6` |
| Shoreline | `/tp @s 394 67 1011 -90 24.1` |

## Result

Built 9,776 chunks from Waterscape `3f89424`. The builder reopened all 12 region indexes and
decoded 92 sampled chunks to verify their version, section count, bedrock, water level and
surface heightmap. Minecraft Java 26.3's own save reader parsed the creative world header and
900 sampled chunks from the installed copy. The overhead preview was compared with the bundle's
aerial image. Visual review in Minecraft is pending.
