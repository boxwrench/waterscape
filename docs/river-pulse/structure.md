# Structure guide

How River Pulse is organised, and the rule for where every file goes. The layout follows the
river template: **river → slot → place**.

## The template

Every river has a **map view** (planned in every river so far) and these scene slots:

| Slot | Meaning | Russian River (reference) |
|---|---|---|
| `start` | Headwaters or upper river | East Fork near Lake Mendocino: **planned** |
| `middle` | The scenic middle | Hacienda Bridge: Map, Bridge, Hacienda Beach |
| `end` | Mouth or lower river | Jenner Estuary: Estuary lookout, River shore, Pacific beach |
| `extra` | Optional fourth scene | none |

Each scene has a few **views**, which are fixed cameras within the same place. A view is not another place.
A slot with nothing built yet is a **planned** placeholder. It blocks out structure and shows an honest
"planned" card. It never carries invented content or invented geography.

Slot assignment is an editorial choice recorded in the river's folder. If a scene fits another slot
better, rename its slot folder, update `river.json` and `scene.json`, and run the registry builder.

## Folder map

```
river-pulse/
  index.html  river.html         entry pages (stable URLs)
  registry.json                  generated; never edit by hand
  app/                           atlas (statewide map) and river-home code; app/data/ = state overview
  core/                          no DOM, no 3D
    adapters/                    USGS and DWR clients; normalise sources, keep provenance
    data-model/                  quantities, selection, RiverState, place and river package loaders
    visual-bindings/             scientific state -> labels, charts, styling
  scene-kit/                     shared 3D: terrain, water, banks, materials, centerline, reservoir reuse
  ui/                            shared design tokens (tokens.css) and scene chrome
  rivers/<river>/
    river.json  README.md
    scenes/<slot>/<place_id>/
      scene.json                 the scene's identity: slot, name, status, views, data flags
      README.md  notes/          what this place is, how it was built, review records
      index.html + code          the page and its scene-specific modules and styles
      thumb.jpg                  card image (a clean capture of the real scene)
      data/                      place.json, source.json, terrain, hydrography, setting assets
```

## Where does this file go?

1. **Only this scene uses it** → in the scene folder, next to `index.html`.
2. **Two or more scenes use it** → `scene-kit/` (3D and rendering) or `ui/` (CSS and chrome).
3. **No DOM, no 3D, useful for any river** (a data client, a selection rule, a chart mapping) → `core/`.
4. **Sourced data for a place** → that scene's `data/`. State-level data → `app/data/`.
5. **Notes about one place** → that scene's `README.md` or `notes/`. Cross-cutting rules → these guides.

If a scene-specific file starts being imported by a second scene, promote it to `scene-kit/` in the same change.

## The manifests

| File | Purpose | Key fields |
|---|---|---|
| `rivers/<river>/river.json` | The river: ordered slots and sources | `id`, `name`, `status`, `summary`, `map`, `scenes[{slot,id}]`, `live_data_scene`, `references`, `next_steps` |
| `…/<slot>/<id>/scene.json` | One scene | `id`, `river`, `slot`, `name`, `status` (`built` or `planned`), `fidelity`, `views`, `data` flags, `entry`, `thumb` |
| `…/<id>/data/place.json` | The data model's view of a place | `id`, `river_pack`, `anchor`, `horizontal_crs`, `supported_capabilities`, `data_bindings` |
| `registry.json` | Generated index of rivers and places | built by `pipeline/build_river_registry.py` |

`scene.json` `data` flags describe what the scene may show. They are independent, so new kinds of data
can be added without redefining a tier ladder:

| Flag | Meaning | Presented with |
|---|---|---|
| `live_gauge` | A current observation is bound | the data card (current / stale / missing) |
| `history` | A daily series is shown | a hydrograph or sparkline |
| `condition` | Seasonal or historical context | the condition band |
| `fine_terrain` | Terrain finer than ~7-14 m, such as lidar | hero cameras that earn the detail |

## Rules the tools enforce

- A place's folder name equals its `id`, and its `river_pack` equals the river folder. A built scene has
  `index.html` and `thumb.jpg`. Every folder under `scenes/` is listed in `river.json`.
  These checks run in `npm run validate` (`pipeline/validate-river-packages.mjs`) and in the registry builder.
- `pipeline/build_river_registry.py --check` fails if `registry.json` is stale.
- The build (`npm run build`) finds scenes by walking `rivers/*/scenes/*/*/index.html`. There is no per-river list to maintain.
- Browser code uses relative imports only, with no CDNs. Never edit `vendor/`, `renderer/water.cu` or `renderer/engine/waterscape.js`.

## Reservoirs

Reservoirs use the older, flatter layout: `data/<id>/` plus the shared engine in `renderer/`. See
[Make a waterscape](../make-a-waterscape.md). River Pulse borrows from it
through `scene-kit/reservoir-context.js` (see [reservoir renderer reuse](./reference/reservoir-renderer-reuse.md)),
but the two data models stay separate: a river has no single still-water level.
