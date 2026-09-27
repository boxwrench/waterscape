# Waterscape — repository architecture for many water bodies — design

Date: 2026-09-27 · Status: approved in conversation, pending spec review
Context: first public release is live (https://boxwrench.github.io/waterscape/). Before land
sub-projects 2–4, restructure so anyone can add their own water body and assets are reusable.
Parent constraints still bind: public government data, static hosting, no external browser
imports, Chromium-based browsers for live 3D, journey never blocks on 3D.

## Decisions

| Question | Decision |
|---|---|
| Water types | **Still water only**: reservoirs, lakes, ponds — one water level inside a shoreline (fits the current water model). Rivers and coasts are out of scope. |
| Approach | Moderate restructure keeping top-level folders (`renderer/`, `data/`, `pipeline/`, `site/`). Not a rewrite; no npm packaging. |
| Unit of contribution | One folder per water body: `data/<id>/` holds its inputs (`source.json`) and outputs. |
| Reusable assets | Organised by biome: `data/biomes/<biome>/biome.json` (+ asset files from land sub-projects 2–3). |
| Journeys | Tours: `data/tours/<tour>.json`; journey page takes `?tour=` (default `hetch-hetchy`). |
| Location | Any UTM zone in the northern hemisphere (USGS 3DEP is US-only); zone stored per bundle. |
| URLs | Existing URLs keep working (`/`, `renderer/explore.html?reservoir=<id>`). |
| Repo size | Plain git (≈6 MB per water body); revisit Git LFS at ~20 bodies. |

## Engine split (no behaviour change)

`renderer/explore.js` (859 lines) becomes a thin page over `renderer/engine/`:

| Module | Responsibility |
|---|---|
| `engine/waterscape.js` | Runtime creation, kernel compile, GPU buffers, resize, waves, ripples, lens, render, per-frame step. `createWaterscape(canvas, body, options)` → `{ state, diag, step(dt), resize(width), setPreset(name), lab }` |
| `engine/camera.js` | `viewRay`, `altitudeFactor`, `terrainClearance`, flight integration |
| `engine/body.js` | `loadBody(id)` → `{ id, terrain, viewpoints, flyover, land, biome }` from `data/<id>/` and `data/biomes/<biome>/` |
| `engine/presets.js`, `engine/quality.js` | Moved from `renderer/land/presets.js` and `renderer/quality.js` unchanged |
| `renderer/land/` | Unchanged (three.js land pass) |
| `renderer/water.cu` | Renamed from `clearwater.cu` |
| `renderer/explore.js` | Page only: panel controls, keyboard/drag input, survey readout, GPU chip/tip, journey messaging, PNG export |

Globals become `window.waterscapeDiagnostics` and `window.waterscapeLab` (tests and
`render-flyover.mjs` updated; no aliases — nothing external uses them).

## Data layout

```
data/
  <id>/
    source.json     inputs: name, biome, anchor [lat, lon], bbox [w, s, e, n], size [w, h],
                    optional viewpoints (moved from pipeline/reservoirs.json, which is deleted)
    story.json      facts with https sources
    land.json       presets offered, defaultPreset, defaultSeason, vegetation
    terrain.bin.gz, terrain.json (+ "utmZone"), cameras.json, flyover.mp4, poster.jpg  (generated)
  biomes/<biome>/biome.json   { id, name, description } now; assets added by land sub-projects
  tours/<tour>.json           { title, stops: [{ id, caption }] }  (was journey.json)
```

Validation (`pipeline/validate-bundles.mjs`): `biomes/` and `tours/` are not bundles; every
bundle has `source.json`; its biome exists under `data/biomes/`; `source.json`,
`terrain.json` and `land.json` agree on biome; every tour stop names an existing bundle.

## Location

- `pipeline/geo.py`: `utm(lat, lon, zone)` and `utm_zone(lon) = floor((lon + 180) / 6) + 1`;
  `build.py` (renamed from `build_bundle.py`) reads `data/<id>/source.json`, picks the zone
  from the anchor, writes `utmZone` and `crs = EPSG:326<zone>` into `terrain.json`.
- `renderer/terrain.js`: inverse UTM uses `meta.utmZone` (default 10 for older bundles).
- Existing bundles gain `"utmZone": 10`; no re-download.

## Docs

- `README.md`: concept first — what Waterscape is; how a frame is made (three.js land + CUDA
  water on one GPU device; video for everyone else); screenshot; "Make your own waterscape"
  in five steps linking the guide; run locally; architecture link; credits and licences.
- `docs/make-a-waterscape.md`: what qualifies (US, still water, 3DEP coverage); choosing
  bbox and anchor; `source.json`; `python pipeline/build.py <id>`; `story.json` facts with
  sources; `land.json` presets and season; flyover render; adding to a tour; `npm test`;
  publishing from a fork with GitHub Pages.
- `docs/architecture.md`: engine, data flow, frame anatomy, quality tiers, native host; replaces
  `HANDOFF.md` (deleted).
- `docs/superpowers/` → `docs/design/` (specs and plans history).
- Explore intro no longer says "a spring study"; it follows the selected season.

## Cleanup

- Delete `previews/clearwater.png`, `previews/clearwater-ui.png`, `previews/open-water.png`
  (upstream leftovers) once unreferenced.
- `previews/verification.json` gitignored (regenerated each run).
- Delete the local `voxel-oaks` worktree and branch; delete remote
  `claude/water-usage-alternatives-ctk0dz` (confirm with the user at that step).
- Keep `START.bat`, `Native/`.

## Testing

Existing suite green after each move. New: UTM zone for a zone-12 point (pytest); validator
cases for missing biome, biome mismatch and unknown tour stop; journey loads `?tour=`.
One before/after screenshot of the overlook confirms no visual change.

## Out of scope

Rivers and coasts; non-US elevation sources; Git LFS; land sub-projects 2–4 themselves.
