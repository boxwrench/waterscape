# River Pulse: code map

A Waterscape experience for understanding rivers through terrain, authoritative observations, time selection and declared
visual bindings. This page is the map of the code. The guides are in [`docs/river-pulse/`](../docs/river-pulse/README.md):
start with the [Structure guide](../docs/river-pulse/structure.md), then [Make a river](../docs/river-pulse/make-a-river.md).

## Run

From the repository root:

```sh
npm ci
npm start
```

Open http://localhost:5173/river-pulse/ in a recent Chrome or Edge (WebGPU and WebGL2 are supported). The atlas opens first;
choose a river to reach its home, then one of its scenes. Live gauge history and seasonal statistics call public USGS APIs.

## Layout

```
river-pulse/
  index.html  river.html      entry pages (stable URLs)
  registry.json               generated index of rivers and places (pipeline/build_river_registry.py)
  app/                        atlas and river-home code, plus the state overview data (app/data/)
  core/                       adapters/, data-model/, visual-bindings/: no DOM, no 3D
  scene-kit/                  shared 3D: terrain, water, banks, materials, centerline, reservoir reuse
  ui/                         tokens.css and shared scene chrome
  rivers/<river>/             one folder per river
    river.json  README.md
    scenes/<slot>/<place>/    slot = start | middle | end | extra
      scene.json  README.md  index.html  <scene code>  thumb.jpg  notes/  data/
```

| Rivers today | Built scenes | Planned |
|---|---|---|
| [Russian](rivers/russian_river/README.md) (reference) | East Fork (start), Hacienda Bridge (middle), Jenner Estuary (end), plus its river map | none |
| [Sacramento](rivers/sacramento_river/README.md) | Freeport (middle) | Headwaters Park (start), Delta confluence (end) |
| [Eel](rivers/eel_river/README.md) | Scotia Bluffs (middle) | Lake Pillsbury (start), Eel estuary (end) |
| [Tuolumne](rivers/tuolumne_river/README.md) | Poopenaut Valley (start) | middle, end |
| [San Joaquin](rivers/san_joaquin_river/README.md), [American](rivers/american_river/README.md) | none | all slots |

Root `vendor/`, the camera and projection utilities in `renderer/engine/`, `pipeline/`, `scripts/` and dependency installation are shared with
the reservoir experience. Do not add another `.git`, vendor copy or npm project here. River behaviour must not reuse still-water
assumptions as scientific claims.

## Build and check

```sh
python pipeline/build_river_registry.py            # regenerate registry.json (then add --check)
npm run validate                                   # reservoir bundles and river packages
node --test "pipeline/tests/*.test.mjs"            # unit tests
python -m pytest pipeline/tests -q                 # pipeline tests
npm run test:build                                 # production build and artifact check
node scripts/check-doc-links.mjs                   # Markdown links
```

Rebuild terrain and centerlines only deliberately: the builders fetch USGS data. See the
[Data guide](../docs/river-pulse/data-guide.md) for the commands and what they record.

The principle behind everything here is [Making Water Visible](../docs/making-water-visible.md); the full scientific-state design is the
[implementation contract](../docs/river-pulse/reference/implementation-contract.md).
