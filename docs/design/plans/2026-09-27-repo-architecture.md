# Repository Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Waterscape so anyone can add their own still-water body as one data folder, assets are reusable per biome, journeys are tours, any US UTM zone works, the renderer engine is separate from its page, and the docs lead with the concept and a make-your-own guide.

**Architecture:** Data moves to `data/<id>/source.json` (inputs) + generated files, `data/biomes/<biome>/`, `data/tours/<tour>.json`; the validator enforces the links. `pipeline/geo.py` and `renderer/terrain.js` take the UTM zone from the bundle. `renderer/explore.js` splits into `renderer/engine/` (runtime, kernels, frame, camera, body loading) and a thin page. No behaviour change for visitors; existing URLs keep working.

**Tech Stack:** vanilla ES modules, CUDA WebShader, three.js (vendored), Python 3 (numpy/scipy/Pillow) pipeline, Node 24 `node:test`, pytest, Playwright + Edge.

**Spec:** `docs/superpowers/specs/2026-09-27-repo-architecture-design.md` (moves to `docs/design/specs/` in Task 1).

## Global Constraints

- Still water only (reservoirs, lakes, ponds); USGS 3DEP (US) elevation; northern-hemisphere UTM zones.
- Existing URLs keep working: `/`, `/renderer/explore.html?reservoir=<id>&embed=1&pose=…&quality=…&preset=…`.
- No external browser imports; Chromium-based browsers; zero readbacks in the frame loop.
- Globals renamed without aliases: `window.clearwaterDiagnostics` → `window.waterscapeDiagnostics`, `window.clearwaterLab` → `window.waterscapeLab`.
- Work in a worktree on branch `repo-architecture`; commit per task; push only when the user says.
- Testing proportionate: each task ends with `npm test` green (plus `python -m pytest pipeline/tests -q` where the pipeline changes).

## Review Focus

1. **A body whose biome folder is missing or misspelt** → validator names the body and biome (Task 2 test).
2. **A tour naming a body that doesn't exist** → validator error, journey never shows a dead stop (Task 2 test).
3. **A water body east of −120° longitude** (zone 11+) → correct lat/lon readout and DEM request (Task 3 tests: zone from longitude; inverse at a zone-13 central meridian).
4. **An old bundle without `utmZone`** → treated as zone 10 (Task 3 test).
5. **Page code reaching into engine internals after the split** → the explore page only uses the `createWaterscape` interface; verified by the full browser suite (Task 4).

---

### Task 1: Clean up and move design history

**Files:**
- Move: `docs/superpowers/` → `docs/design/`
- Delete: `previews/clearwater.png`, `previews/clearwater-ui.png`, `previews/open-water.png`
- Modify: `.gitignore` (add `previews/verification.json`), untrack `previews/verification.json`

- [ ] **Step 1:** `git mv docs/superpowers docs/design`; `git rm previews/clearwater.png previews/clearwater-ui.png previews/open-water.png`; append `previews/verification.json` to `.gitignore`; `git rm --cached previews/verification.json`.
- [ ] **Step 2:** `git grep -n "docs/superpowers\|clearwater.png\|clearwater-ui.png\|open-water.png" -- ':!HANDOFF.md' ':!docs/design'` — Expected: no output (HANDOFF.md is deleted in Task 5).
- [ ] **Step 3:** `npm test` — Expected: PASS.
- [ ] **Step 4:** Commit `"Clean up: design history under docs/design, drop upstream previews, stop tracking verification.json"`.

---

### Task 2: One folder per water body; biomes and tours

**Files:**
- Create: `data/calaveras/source.json`, `data/san_antonio/source.json`, `data/biomes/diablo-oak/biome.json`, `data/tours/hetch-hetchy.json`
- Delete: `pipeline/reservoirs.json`, `journey.json`
- Rename: `pipeline/build_bundle.py` → `pipeline/build.py` (reads `data/<id>/source.json`)
- Modify: `pipeline/validate-bundles.mjs`, `pipeline/tests/validate-bundles.test.mjs`, `site/journey.js`, `scripts/build.mjs`, `package.json` (`"bundle"` script), `Native/main.cu` (comment/error text), `renderer/clearwater.cu` (comment)

**Interfaces:**
- `source.json`: `{ name, biome, anchor: [lat, lon], bbox: [west, south, east, north], size: [w, h], viewpoints? }` (exactly the old `reservoirs.json` entry).
- `biome.json`: `{ id, name, description }`.
- Tour: `{ title, stops: [{ id, caption }] }`; journey page reads `data/tours/${tour}.json`, `tour` from `?tour=` (default `hetch-hetchy`, must match `/^[a-z0-9-]+$/`).
- `validateAll(root)` skips `data/biomes` and `data/tours`; `validateBundle(dir)` also requires `source.json`; new `validateTours(root)` replaces `validateJourney`.

- [ ] **Step 1: Failing tests.** In `pipeline/tests/validate-bundles.test.mjs`: add `"source.json"` to the `good` fixture:

```js
  "source.json": {
    name: "Test Reservoir", biome: "diablo-oak", anchor: [37.5, -121.8],
    bbox: [-121.9, 37.4, -121.7, 37.6], size: [2, 2],
  },
```

and make `bundle()` also create `<tmp>/biomes/diablo-oak/biome.json` (so biome lookups resolve relative to the bundle's parent):

```js
  await mkdir(path.join(path.dirname(dir), "biomes", "diablo-oak"), { recursive: true });
  await writeFile(path.join(path.dirname(dir), "biomes", "diablo-oak", "biome.json"),
    JSON.stringify({ id: "diablo-oak", name: "Diablo Range oak woodland", description: "x" }));
```

Append:

```js
test("the body's biome must exist and agree across files", async () => {
  const dir = await bundle({ "source.json": { biome: "sierra" } });
  assert.deepEqual(await validateBundle(dir), [
    "test: biome sierra has no data/biomes/sierra/biome.json",
    "test: source.json biome sierra differs from terrain.json diablo-oak",
  ]);
  await rm(path.dirname(dir), { recursive: true });
});

test("tour stops must name existing bodies", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "tours-"));
  await mkdir(path.join(root, "data", "tours"), { recursive: true });
  await mkdir(path.join(root, "data", "calaveras"), { recursive: true });
  await writeFile(path.join(root, "data", "tours", "t.json"),
    JSON.stringify({ title: "T", stops: [{ id: "calaveras", caption: "c" }, { id: "nowhere", caption: "n" }] }));
  assert.deepEqual(await validateTours(root), ["tour t: no bundle for stop nowhere"]);
  await rm(root, { recursive: true });
});
```

(import `validateTours` alongside `validateBundle`). Run `node --test pipeline/tests/validate-bundles.test.mjs` — Expected: FAIL (`validateTours` not exported; missing-biome not reported).

- [ ] **Step 2: Data.** Create `data/<id>/source.json` from each `pipeline/reservoirs.json` entry verbatim (Calaveras keeps its `viewpoints`). Create `data/biomes/diablo-oak/biome.json`:

```json
{
  "id": "diablo-oak",
  "name": "Diablo Range oak woodland",
  "description": "Rolling annual grassland, gold most of the year and green after winter rain, with coast live, blue and valley oaks in ravines, on north-facing slopes and in groves. Assets for its ground, grass and oaks are added by the land sub-projects."
}
```

`git mv journey.json data/tours/hetch-hetchy.json`; `git rm pipeline/reservoirs.json`.

- [ ] **Step 3: Validator.** In `pipeline/validate-bundles.mjs`:
  - `REQUIRED` gains `"source.json"`; the JSON load also reads `source.json` (as `source`).
  - Before `return errors;` add:

```js
  const biomeFile = path.join(path.dirname(dir), "biomes", source.biome ?? "", "biome.json");
  await stat(biomeFile).catch(() => errors.push(`${id}: biome ${source.biome} has no data/biomes/${source.biome}/biome.json`));
  if (source.biome !== terrain.biome)
    errors.push(`${id}: source.json biome ${source.biome} differs from terrain.json ${terrain.biome}`);
```

  - Replace `validateJourney(root)` with:

```js
// Tours (data/tours/<tour>.json): ordered stops, each an existing water body.
export async function validateTours(root) {
  const dir = path.join(root, "data", "tours"), errors = [];
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json"))) {
    const tour = JSON.parse(await readFile(path.join(dir, file), "utf8")), name = file.slice(0, -5);
    if (!tour.title) errors.push(`tour ${name}: no title`);
    if (!tour.stops?.length) errors.push(`tour ${name}: no stops`);
    for (const stop of tour.stops ?? []) {
      if (!stop.caption) errors.push(`tour ${name}: stop ${stop.id} has no caption`);
      await stat(path.join(root, "data", stop.id)).catch(() => errors.push(`tour ${name}: no bundle for stop ${stop.id}`));
    }
  }
  return errors;
}
```

  - `validateAll`: filter `d.isDirectory() && !["shared", "biomes", "tours"].includes(d.name)` and call `validateTours(root)` instead of `validateJourney(root)`. Update the header comment to describe bodies, biomes and tours.

- [ ] **Step 4: Consumers.**
  - `site/journey.js`: replace `const journey = await json("./journey.json");` with

```js
    const tourId = new URLSearchParams(location.search).get("tour") || "hetch-hetchy";
    if (!/^[a-z0-9-]+$/.test(tourId)) throw new Error(`Invalid tour: ${tourId}`);
    const journey = await json(`./data/tours/${tourId}.json`);
```

  - `scripts/build.mjs`: remove `'journey.json',` from the copied list (the `data/` tree is copied whole).
  - `git mv pipeline/build_bundle.py pipeline/build.py`; in it read `config = json.loads((ROOT / "data" / rid / "source.json").read_text())`, update the docstring/usage text to `python pipeline/build.py <id>` and "viewpoints (pinned in source.json or searched)". `package.json` `"bundle": "python pipeline/build.py"`. Update the two mentions in `Native/main.cu` and the comment in `renderer/clearwater.cu` to `pipeline/build.py`.

- [ ] **Step 5:** `node --test "pipeline/tests/*.test.mjs" && node pipeline/validate-bundles.mjs && python -m pytest pipeline/tests -q && npm test` — Expected: all pass, `Bundles valid.`, `Journey checks passed.`
- [ ] **Step 6:** Commit `"One folder per water body: source.json, biomes and tours"`.

---

### Task 3: Any UTM zone

**Files:**
- Modify: `pipeline/geo.py`, `pipeline/dem.py`, `pipeline/build.py`, `pipeline/tests/test_geo.py`, `renderer/terrain.js`, `data/calaveras/terrain.json`, `data/san_antonio/terrain.json`
- Create: `pipeline/tests/terrain-utm.test.mjs`

**Interfaces:**
- Python: `utm_zone(lon) -> int`; `utm(lat, lon, zone) -> (east, north)`; `utm10(lat, lon)` kept as `utm(lat, lon, 10)`.
- `dem.fetch_dem(rid, bbox, size, cache_dir, zone)` requests `imageSR=326{zone:02d}`.
- `terrain.json` gains `"utmZone"`; `crs` = `EPSG:326{zone:02d}`.
- JS: `export function utmInverse(east, north, zone)` in `renderer/terrain.js`; `Terrain.latLon` uses `this.meta.utmZone ?? 10`.

- [ ] **Step 1: Failing tests.** Append to `pipeline/tests/test_geo.py`:

```python
from geo import utm, utm_zone


def test_zone_from_longitude():
    assert utm_zone(-121.8) == 10
    assert utm_zone(-111.9) == 12  # Utah
    assert utm_zone(-105.0) == 13  # Colorado


def test_zone_12_central_meridian_is_false_easting():
    east, north = utm(40.0, -111.0, 12)
    assert abs(east - 500000.0) < 1e-6
    assert north > 4.4e6
```

`pipeline/tests/terrain-utm.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { Terrain, utmInverse } from "../../renderer/terrain.js";

test("false easting sits on the zone's central meridian", () => {
  assert.ok(Math.abs(utmInverse(500000, 4400000, 13)[1] - -105) < 1e-9);
  assert.ok(Math.abs(utmInverse(500000, 4400000, 10)[1] - -123) < 1e-9);
});

test("bundles without utmZone are zone 10", () => {
  const meta = { width: 2, height: 2, cell: [10, 10], gridOrigin: [0, 0], waterLevel: 0, originUTM: [500000, 4400000] },
    t = new Terrain(meta, { height: new Float32Array(4), shoreDistance: new Float32Array(4), valley: new Float32Array(4) });
  assert.ok(Math.abs(t.latLon(0, 0)[1] - -123) < 1e-9);
});
```

Before writing it, read `Terrain`'s constructor and whether `Terrain` is exported; if the constructor needs a different `cells` shape, build the minimal object it reads (only `latLon` is exercised). If `Terrain` is not exported, export it.

Run both — Expected: FAIL (`utm_zone`, `utmInverse` missing).

- [ ] **Step 2: Implement.**
  - `geo.py`: rename the function to `utm(lat, lon, zone)` with `lam0 = math.radians(-183.0 + 6.0 * zone)`; add `def utm_zone(lon): return int((lon + 180.0) // 6) + 1` and `def utm10(lat, lon): return utm(lat, lon, 10)`; docstring: "WGS84 -> UTM (northern hemisphere), Snyder's series".
  - `dem.py`: `fetch_dem(..., cache_dir, zone)` and `imageSR=326{zone:02d}`; include the zone in the cache key if the cache file name is derived from `rid` only (read the function; append `_z{zone}` to the cache name).
  - `build.py`: `zone = geo.utm_zone(anchor_lon)` before the fetch; pass it to `fetch_dem`; `geo.utm(anchor_lat, anchor_lon, zone)`; meta gains `"utmZone": zone` and `"crs": f"EPSG:326{zone:02d}"`.
  - `renderer/terrain.js`: rename `utm10Inverse(east, north)` → exported `utmInverse(east, north, zone)` with the central meridian `-183 + 6 * zone` replacing both `-123`s; `latLon` calls `utmInverse(oe + x, on - z, this.meta.utmZone ?? 10)`. Update the comment.
  - Both `terrain.json` files: add `"utmZone": 10,` after `"crs"`.

- [ ] **Step 3:** `python -m pytest pipeline/tests -q && node --test "pipeline/tests/*.test.mjs" && npm test` — Expected: PASS.
- [ ] **Step 4:** Commit `"Any UTM zone: zone from the anchor's longitude, stored per bundle"`.

---

### Task 4: Engine split

**Files:**
- Create: `renderer/engine/waterscape.js`, `renderer/engine/camera.js`, `renderer/engine/body.js`
- Move: `renderer/quality.js` → `renderer/engine/quality.js`; `renderer/land/presets.js` → `renderer/engine/presets.js`; `renderer/clearwater.cu` → `renderer/water.cu`
- Modify: `renderer/explore.js` (page only), `Native/main.cu` (`#include "../renderer/water.cu"`), `pipeline/validate-bundles.mjs` + tests importing presets, `pipeline/tests/quality.test.mjs`, `pipeline/tests/presets.test.mjs`, `scripts/verify.mjs`, `scripts/verify-site.mjs`, `pipeline/render-flyover.mjs` (global renames), `README.md`/docs mentions of `clearwater.cu` are handled in Task 5.

**Interfaces (produced):**
- `engine/camera.js`:
  - `viewRay(sx, sy, aspect, yaw, pitch) → [x, y, z]` (moved verbatim)
  - `altitudeFactor(state, terrain) → number`
  - `fly(state, input, dt, terrain) → { boost }` — input `{ keys: Set<string>, cruise: boolean }`; body = the yaw/pitch/position integration now in `frame()` (lines "boost =" … "state.y = Math.max(…)"), clamping with `terrain.ground(x, z) + 2.5`.
- `engine/body.js`: `loadBody(id, onProgress?) → { id, base: URL, terrain, viewpoints, land, biome }`; validates `id` against `/^[a-z0-9_]+$/`; loads `terrain` (via `loadTerrain`), `cameras.json` viewpoints, `land.json`, and `../biomes/<terrain.meta.biome>/biome.json`; `viewpoint(body, name) → { x, y, z, yaw, pitch, speed }`.
- `engine/waterscape.js`: `createWaterscape(canvas, body, { onError, onProgress }) → Promise<ws>` where `ws` is:
  - `rt`, `state` (same fields as today), `diag` (assigned to `window.waterscapeDiagnostics` by the page), `settings = { energy, depth, exposure, view, season, glare }` (plain numbers/booleans the page keeps in sync with its controls)
  - `setPreset(name) → chosenName` (writes the light buffer, sets `settings.exposure`)
  - `resize(width)` — marks a resize to `width` (height derived from the window aspect as today, multiple of 8)
  - `tap(sx, sy)` — queue a ripple drop
  - `async step(dt) → frameMs` — resize if pending, waves, ripples, land pass, render, present, `await rt.idle()`; updates `diag.width/height/frames/readbackBytes`
  - `lab` — `{ inspect, seek, fftTest, inspectOptics, readPixels }` (today's `clearwaterLab` bodies; `play/pause/resume` stay in the page, which builds `window.waterscapeLab = { state, pause, resume, ...ws.lab }`)
  - `landPass` status in `diag.land` (as today)
- `renderer/explore.js` keeps: `$`, URL parsing, `fail`, labels, panel handlers (writing into `ws.settings`), viewpoint buttons, preset picker + message listener (calling `ws.setPreset`), GPU chip/tip, survey (using `viewRay` from `engine/camera.js`), pointer/keyboard input, governor (calling `ws.resize(width)`), the rAF loop (`fly` → `ws.step` → governor → UI), journey `postMessage`, PNG export (`ws.lab.readPixels()`), and `window.waterscapeModel`.

- [ ] **Step 1:** `git mv renderer/clearwater.cu renderer/water.cu`, `git mv renderer/quality.js renderer/engine/quality.js`, `git mv renderer/land/presets.js renderer/engine/presets.js`; fix imports (`explore.js`, `pipeline/validate-bundles.mjs`, `pipeline/tests/quality.test.mjs`, `pipeline/tests/presets.test.mjs`) and the fetch of `./clearwater.cu` → `./water.cu`; `Native/main.cu` include. Rename globals in `scripts/verify.mjs`, `scripts/verify-site.mjs`, `pipeline/render-flyover.mjs`: `clearwaterDiagnostics` → `waterscapeDiagnostics`, `clearwaterLab` → `waterscapeLab`, and the same two in `explore.js`. Run `npm test` — Expected: PASS (pure renames).
- [ ] **Step 2:** Create `engine/camera.js` and `engine/body.js` by moving code verbatim (sources named in Interfaces), then `engine/waterscape.js` by moving `rt`/buffer/kernel state, `resize`, `waves`, `ripples`, `transform`, `setupLens`, `render`, `exclusive`, the lab bodies, the seabed decode and the kernel compile loop, replacing every DOM read with `settings`:

| explore.js today | engine |
|---|---|
| `+$("energy").value` | `settings.energy` |
| `+$("depth").value` | `settings.depth` |
| `+$("exposure").value` | `settings.exposure` |
| `+$("view").value` | `settings.view` |
| `+$("season").value` | `settings.season` |
| `$("glare").checked` | `settings.glare` |
| `+$("quality").value` (in `resize`) | the `width` passed to `ws.resize(width)` |
| `$("loadText").textContent = …` | `onProgress(text)` |

The page then wires controls: `oninput`/`onchange` handlers copy values into `ws.settings`; the governor and `#quality` call `ws.resize(width)`; the initial `ws.resize(+$("quality").value)` happens after creation.
- [ ] **Step 3:** `npm test` — Expected: PASS (all browser checks unchanged). Screenshot `renderer/explore.html?quality=high&t=5` (overlook, 1440×900) with a scratchpad Playwright script and compare against the same shot taken on `main` before the split — Expected: visually identical.
- [ ] **Step 4:** Commit `"Split the engine out of the explore page"`.

---

### Task 5: Docs — concept first, make your own

**Files:**
- Rewrite: `README.md`
- Create: `docs/make-a-waterscape.md`, `docs/architecture.md`
- Delete: `HANDOFF.md`
- Modify: `renderer/explore.js` (season-aware intro), `THIRD_PARTY_NOTICES.md` (path mentions if any)

- [ ] **Step 1: Intro text.** In the page, replace the fixed `A spring study of …` with a function called on load and on season change:

```js
function intro() {
  $("intro").textContent = `${settings.season ? "Summer gold" : "Spring green"} at ${body.terrain.meta.name}, from USGS lidar terrain.`;
}
```

(using the page's references to `ws.settings` and `body`).

- [ ] **Step 2: README.md** — sections, in order:
  1. Title + one-paragraph concept: real US lakes and reservoirs rebuilt from public lidar and public-record facts; a journey of pre-rendered flyovers for any device, and live WebGPU 3D (Chrome/Edge) where the water is simulated and lit in real time. Live link `https://boxwrench.github.io/waterscape/`.
  2. Screenshot (`previews/calaveras-overlook.png`).
  3. "How a frame is made" — five bullets: lidar terrain mesh drawn by three.js; its per-pixel distance handed to a CUDA water shader compiled to WebGPU (FFT waves, ripples, refraction, caustics, reflections); Preetham sky and presets; automatic quality tiers; video fallback.
  4. "Make your own waterscape" — five steps (create `data/<id>/source.json`; `python pipeline/build.py <id>`; write `story.json` + `land.json`; `node pipeline/render-flyover.mjs <id>`; add to a tour and `npm test`) linking `docs/make-a-waterscape.md`.
  5. "Run locally" (`npm install`, `npm start`, `START.bat`), "Repository layout" (table: `renderer/engine`, `renderer/land`, `renderer/water.cu`, `renderer/explore.*`, `site/`, `data/<id>`, `data/biomes`, `data/tours`, `pipeline/`, `vendor/`, `Native/`, `docs/`), "Tests", "Credits and licences" (upstream Clearwater/SamG-Coder, cuda-webshader, three.js, USGS 3DEP, USACE NID; MIT).
- [ ] **Step 3: docs/make-a-waterscape.md** — what qualifies (US, still water, 3DEP lidar coverage; check at apps.nationalmap.gov); choosing the bbox (reservoir plus 1–3 km of hills, ≈10 m cells, `size` ≈ bbox metres / 10) and an on-water `anchor`; `source.json` field reference with the Calaveras file as the example; picking or proposing a biome; running `pipeline/build.py` (Python deps, what it writes, `--native`); `story.json` rules (every fact an https source, prefer government records); `land.json` (presets, defaultPreset, defaultSeason); rendering the flyover (Edge, ffmpeg, discrete GPU); adding a stop to `data/tours/<tour>.json` or a new tour (`?tour=`); `npm test`; publishing: fork, enable Pages ("GitHub Actions" source), push to `main`.
- [ ] **Step 4: docs/architecture.md** — engine modules and their interfaces (from Task 4), frame anatomy (land pass → pack → waves/ripples/caustics → render_water → bloom/glare/present), data flow (source.json → build.py → bundle → body.js), quality tiers and governor, presets and the light buffer, native host (frozen, traced land), design history pointer (`docs/design/`). Then `git rm HANDOFF.md`.
- [ ] **Step 5:** `npm test` and `git grep -n "HANDOFF\|build_bundle\|reservoirs.json\|journey.json\|clearwater.cu" -- ':!docs/design'` — Expected: PASS; no stale references (upstream project names "Clearwater" in credits are fine).
- [ ] **Step 6:** Commit `"Docs: concept-first README, make-a-waterscape guide, architecture"`.

---

### Task 6: Branch cleanup

- [ ] **Step 1:** From the main checkout: `git worktree remove --force .worktrees/voxel-oaks` (it holds only the superseded port and the throwaway spike) and `git branch -D voxel-oaks`.
- [ ] **Step 2:** Ask the user to confirm deleting the remote branch `claude/water-usage-alternatives-ctk0dz` (superseded cloud-session voxel oaks); on yes: `git push origin --delete claude/water-usage-alternatives-ctk0dz`.
- [ ] **Step 3:** `git branch -a` — Expected: only `main`, `repo-architecture` (until merged), `remotes/origin/main`.
