# Make a waterscape

This guide turns a real lake, reservoir or pond into a Waterscape stop: a lidar terrain bundle,
a flyover video, a fact card and a live 3D scene. Everything a water body needs lives in one
folder, `data/<id>/`.

## What qualifies

- **Still water**: one water level inside a shoreline — reservoirs, natural lakes, ponds,
  quarry lakes. Rivers and coasts are not supported.
- **In the United States** with **USGS 3DEP lidar** coverage. Check at
  <https://apps.nationalmap.gov/lidar-explorer/>. Lidar flattens water surfaces, which is how
  the pipeline finds the shoreline.
- Big enough to read from the hills — a few hundred metres across or more.

## 1. Choose an id, a box and an anchor

- **id**: lowercase letters, digits and underscores, e.g. `lake_berryessa`.
- **bbox** `[west, south, east, north]` in degrees: the water plus 1–3 km of surrounding hills.
  About 9 × 11 km worked well for Calaveras.
- **size** `[width, height]` in grid cells: roughly the box size in metres divided by 10
  (≈10 m cells). Calaveras is `[900, 1050]`.
- **anchor** `[lat, lon]`: any point on the open water. The pipeline grows the water body from
  it, so pick somewhere well away from the shore.

The UTM zone is chosen from the anchor's longitude, so any US location works.

## 2. Write `data/<id>/source.json`

```json
{
  "name": "Calaveras Reservoir",
  "biome": "diablo-oak",
  "anchor": [37.47261, -121.81816],
  "bbox": [-121.875, 37.435, -121.77, 37.53],
  "size": [900, 1050],
  "viewpoints": {
    "overlook": { "x": -1500, "z": -3000, "above": 3, "yaw": 2.69, "pitch": -0.12, "speed": 40, "label": "North ridge" },
    "ridge": { "x": -1600, "z": 900, "above": 3, "yaw": 1.29, "pitch": -0.15, "speed": 40, "label": "West ridge" },
    "shore": { "x": -740, "z": 300, "above": 1.6, "yaw": 1.571, "pitch": -0.04, "speed": 4, "label": "Shoreline" }
  }
}
```

| Field | Meaning |
|---|---|
| `name` | Shown on the fact card and in 3D |
| `biome` | A folder in `data/biomes/` — the landscape's shared assets and look |
| `anchor`, `bbox`, `size` | As above |
| `viewpoints` | Optional. Three named views (`overlook`, `ridge`, `shore`) in local metres (x east, z south, origin at the water's centre), height `above` the ground, heading `yaw` and `pitch` in radians, flight `speed` in m/s. Leave it out and the pipeline searches for good views; pin them once you like them. |

**Biomes.** `diablo-oak` is California oak woodland (gold grass, coast live, blue and valley
oaks). A water body in different country — Sierra granite and conifers, desert, eastern
forest — needs a new `data/biomes/<biome>/biome.json` (`id`, `name`, `description`) and, as the
land engine grows, its own ground, grass and tree assets.

## 3. Build the bundle

```
pip install numpy scipy Pillow
python pipeline/build.py <id>
```

This downloads the elevation from the USGS 3DEP service, finds the water, and writes
`terrain.bin.gz`, `terrain.json` (grid, UTM zone, water level) and `cameras.json` (viewpoints and
flyover path) into `data/<id>/`. `--native` also writes the uncompressed `terrain.bin` for the
native Windows host.

## 4. Write the story and land profile

`data/<id>/story.json` is the fact card. Every fact needs an https source; prefer government
records (USACE National Inventory of Dams, USGS, state water agencies, the operator).

```json
{
  "id": "calaveras",
  "name": "Calaveras Reservoir",
  "place": "Alameda and Santa Clara counties, east of Milpitas",
  "operator": "San Francisco Public Utilities Commission",
  "headline": "Rebuilt so it keeps holding water after a major earthquake on the fault beside it.",
  "facts": [
    { "label": "Capacity", "value": "96,850 acre-feet", "source": "https://…" }
  ]
}
```

`data/<id>/land.json` sets the look:

```json
{
  "biome": "diablo-oak",
  "vegetation": { "density": 1.0, "species": { "coast-live": 0.5, "blue": 0.3, "valley": 0.2 } },
  "grass": { "spring": "green", "summer": "gold" },
  "presets": ["morning", "midday", "golden"],
  "defaultPreset": "golden",
  "defaultSeason": "summer"
}
```

`presets` lists the light presets this place offers (`morning`, `midday`, `golden`);
`defaultSeason` is `spring` or `summer`. `biome` must match `source.json`.

## 5. Look at it

`npm start`, then open `http://localhost:5173/renderer/explore.html?reservoir=<id>`. Fly around,
adjust the viewpoints in `source.json` if you want, and rebuild.

## 6. Render the flyover

```
node pipeline/render-flyover.mjs <id>
```

Needs Microsoft Edge and ffmpeg, and runs best on a discrete GPU. Writes `flyover.mp4` and
`poster.jpg` — what every visitor sees first, including those without WebGPU.

## 7. Add it to a tour

Tours live in `data/tours/<tour>.json`:

```json
{
  "title": "Follow the water",
  "stops": [
    { "id": "calaveras", "caption": "Hetch Hetchy Regional Water System" },
    { "id": "<id>", "caption": "Your water system" }
  ]
}
```

Add a stop to an existing tour, or create a new tour file and open `/?tour=<tour>`.

## 8. Check and publish

```
npm test
```

The validator checks every file, that the biome exists, that facts have sources and that tour
stops exist; the browser checks render your water body's tour. To publish your own copy: fork
the repository, enable **Settings → Pages → Source: GitHub Actions**, and push to `main` —
the included workflow tests, builds and deploys the site.
