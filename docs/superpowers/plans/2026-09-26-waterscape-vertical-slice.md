# Waterscape Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hosted "follow the water" journey with two stops (Calaveras, San Antonio): pre-rendered flyover video and sourced story cards for everyone, and the live WebGPU renderer as an opt-in upgrade.

**Architecture:** The repo is restructured into `renderer/` (today's live app, now bundle-driven), `pipeline/` (Python terrain/camera baking plus Node flyover rendering), `data/<id>/` (one self-contained bundle per reservoir) and `site/` (the journey shell, served from the root `index.html`). The journey and the renderer meet at a URL: `renderer/explore.html?reservoir=<id>&embed=1&pose=x,y,z,yaw,pitch`, embedded in an iframe only when the visitor asks for 3D. The terrain buffer becomes self-describing (a two-texel header), so the shader has no reservoir-specific constants.

**Tech Stack:** CUDA source compiled to WGSL by the vendored cuda-webshader; vanilla ES modules (no framework, no external browser imports); Python 3 with numpy, scipy, Pillow, pytest; Node 24 (`node:test`); Playwright driving Microsoft Edge; ffmpeg 8 (libx264).

**Spec:** `docs/superpowers/specs/2026-09-26-waterscape-design.md`

## Global Constraints

- Public government data only: USGS 3DEP (terrain), DWR CDEC and SWRCB/DDW (later steps). Every figure shown to visitors links to its public source.
- Static hosting only (GitHub Pages): no server-side component, no accounts.
- No external browser imports or CDNs; `scripts/build.mjs` rejects non-relative imports and must keep doing so.
- Visuals are first class on every device; the journey never blocks on 3D (video and poster always work without WebGPU).
- Tagline (provisional): "Hydrology, simulated."
- Keep all third-party notices (Clearwater MIT, cuda-webshader MIT, USGS credit) in the repo and in `dist/`.
- Work in `C:\github\waterscape`. Commit after every task; do not push unless the user asks.
- Line endings: files are written with LF; Git on this machine converts on checkout. Ignore the "LF will be replaced by CRLF" warnings.

## File structure after this plan

```
index.html                    journey page (was the live app)            [Task 7]
journey.json                  ordered stops                              [Task 7]
site/journey.js               journey shell: stops, cards, media, nav    [Task 7, 8]
site/journey.css              journey styling                            [Task 7]
site/device.js                live-tier capability check                 [Task 8]
site/flyover-path.js          poseAt(): shared by site and pipeline      [Task 6]
renderer/explore.html         live 3D page (was index.html)              [Task 1, 3]
renderer/explore.js           live 3D host (was app.js)                  [Task 1, 2, 3]
renderer/explore.css          (was style.css)                            [Task 1, 3]
renderer/terrain.js           terrain decode/sample/pick (was terrain.js)[Task 1, 2]
renderer/clearwater.cu        shared CUDA source (was src/clearwater.cu) [Task 1, 2]
renderer/assets/seabed.jpg    (was assets/seabed.jpg)                    [Task 1]
data/calaveras/               terrain.bin.gz terrain.json cameras.json story.json flyover.mp4 poster.jpg
data/san_antonio/             same set                                   [Task 4-6]
pipeline/reservoirs.json      per-reservoir config                       [Task 4]
pipeline/geo.py               UTM zone 10N projection                    [Task 4]
pipeline/dem.py               fetch, water detection, channels, packing  [Task 4]
pipeline/cameras.py           line-of-sight viewpoints, flyover keys     [Task 4]
pipeline/build_bundle.py      CLI: python pipeline/build_bundle.py <id>  [Task 1, 4]
pipeline/validate-bundles.mjs bundle + journey schema checks             [Task 5, 6, 7]
pipeline/render-flyover.mjs   CLI: node pipeline/render-flyover.mjs <id> [Task 6]
pipeline/tests/               pytest + node:test suites                  [Task 4-6]
scripts/verify.mjs            renderer browser checks (self-served)      [Task 1-3]
scripts/verify-site.mjs       journey browser checks                     [Task 7, 8]
```

---

### Task 1: Restructure into renderer/, data/, pipeline/

Pure moves plus path fixes. Behaviour is unchanged; the root `index.html` temporarily redirects to the explore page until Task 7 replaces it. The browser checks start their own static server so a second terminal is no longer needed.

**Files:**
- Move: `src/clearwater.cu` → `renderer/clearwater.cu`; `app.js` → `renderer/explore.js`; `index.html` → `renderer/explore.html`; `style.css` → `renderer/explore.css`; `terrain.js` → `renderer/terrain.js`; `assets/seabed.jpg` → `renderer/assets/seabed.jpg`; `assets/calaveras-terrain.bin.gz` → `data/calaveras/terrain.bin.gz`; `assets/calaveras-terrain.json` → `data/calaveras/terrain.json`; `scripts/build-terrain.py` → `pipeline/build_bundle.py`
- Create: `index.html` (temporary redirect)
- Modify: `renderer/explore.html`, `renderer/explore.js`, `renderer/terrain.js`, `scripts/check.mjs`, `scripts/build.mjs`, `scripts/verify.mjs`, `pipeline/build_bundle.py`, `Native/main.cu`, `.gitignore`, `.github/workflows/pages.yml`, `package.json`

**Interfaces:**
- Produces: `loadTerrain(base: string): Promise<Terrain>` in `renderer/terrain.js` (no default; `base` is a URL prefix without extension, e.g. `…/data/calaveras/terrain`). Bundle files are named `terrain.bin.gz` and `terrain.json`.
- Produces: `scripts/verify.mjs` serves the repo itself on an ephemeral port; `npm test` runs it with no other setup.

- [ ] **Step 1: Make the browser check self-served and point it at the new page (failing test)**

In `scripts/verify.mjs`, add the import after the existing imports:

```js
import { createStaticServer } from "./serve.mjs";
```

Replace the browser launch line `const browser = await chromium.launch({` with:

```js
const server = createStaticServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
```

Replace `await page.goto("http://127.0.0.1:5186/");` with:

```js
  await page.goto(`${base}/renderer/explore.html`);
```

Replace the final block

```js
} finally {
  await browser.close();
}
```

with

```js
} finally {
  await browser.close();
  server.close();
}
```

In `package.json`, keep `"test": "node scripts/verify.mjs"` (it no longer needs port 5186).

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL, the page at `/renderer/explore.html` returns 404 (the browser errors list or the `ready` wait times out).

- [ ] **Step 3: Move the files**

```bash
mkdir -p renderer/assets data/calaveras pipeline
git mv src/clearwater.cu renderer/clearwater.cu
git mv app.js renderer/explore.js
git mv index.html renderer/explore.html
git mv style.css renderer/explore.css
git mv terrain.js renderer/terrain.js
git mv assets/seabed.jpg renderer/assets/seabed.jpg
git mv assets/calaveras-terrain.bin.gz data/calaveras/terrain.bin.gz
git mv assets/calaveras-terrain.json data/calaveras/terrain.json
git mv scripts/build-terrain.py pipeline/build_bundle.py
```

- [ ] **Step 4: Fix the page and module paths**

`renderer/explore.html`: replace `href="./style.css"` with `href="./explore.css"` and `src="./app.js"` with `src="./explore.js"`.

`renderer/explore.js`: replace

```js
import { GpuRuntime } from "./vendor/cuda-webshader/runtime/runtime.js";
```

with

```js
import { GpuRuntime } from "../vendor/cuda-webshader/runtime/runtime.js";
```

Replace `const source = await (await fetch("./src/clearwater.cu")).text();` with

```js
  const source = await (await fetch(new URL("./clearwater.cu", import.meta.url))).text();
```

Replace `terrain = await loadTerrain();` with

```js
  terrain = await loadTerrain(new URL("../data/calaveras/terrain", import.meta.url).href);
```

Replace `await (await fetch("./assets/seabed.jpg")).blob(),` with

```js
      await (await fetch(new URL("./assets/seabed.jpg", import.meta.url))).blob(),
```

`renderer/terrain.js`: replace `export async function loadTerrain(base = "./assets/calaveras-terrain") {` with

```js
export async function loadTerrain(base) {
```

Create the temporary root `index.html`:

```html
<!doctype html>
<meta charset="utf-8" />
<title>Waterscape</title>
<meta http-equiv="refresh" content="0; url=./renderer/explore.html" />
<a href="./renderer/explore.html">Open Waterscape</a>
```

- [ ] **Step 5: Fix the scripts, CI and native host**

`scripts/check.mjs`: replace `new URL("../src/clearwater.cu", import.meta.url),` with `new URL("../renderer/clearwater.cu", import.meta.url),`.

`scripts/build.mjs`: replace the two lines starting at `await moduleGraph(path.join(root,'app.js'));` through the `for(const file of [...modules,...[` list with:

```js
await moduleGraph(path.join(root,'renderer/explore.js'));
for(const file of [...modules,...['index.html','renderer/explore.html','renderer/explore.css','renderer/clearwater.cu','renderer/assets/seabed.jpg','LICENSE','THIRD_PARTY_NOTICES.md','vendor/cuda-webshader/LICENSE'].map(f=>path.join(root,f))]){
```

and after that loop's closing `}` add:

```js
// Reservoir bundles ship whole; the uncompressed native twin never does.
await cp(path.join(root,'data'),path.join(out,'data'),{recursive:true,filter:(src)=>!src.endsWith('terrain.bin')});
```

`.github/workflows/pages.yml`: replace `- run: node --check app.js` with `- run: node --check renderer/explore.js`.

`pipeline/build_bundle.py`: replace `OUT = ROOT / "assets"` with `OUT = ROOT / "data" / "calaveras"`; replace every `"calaveras-terrain.bin.gz"` with `"terrain.bin.gz"`, `"calaveras-terrain.bin"` with `"terrain.bin"` and `"calaveras-terrain.json"` with `"terrain.json"`; replace `cache = ROOT / "scripts" / ".cache-3dep.tif"` with `cache = ROOT / "pipeline" / ".cache" / "calaveras.tif"` and add `cache.parent.mkdir(exist_ok=True)` on the next line. (`ROOT = Path(__file__).resolve().parent.parent` is still the repo root.)

`.gitignore`: replace the lines `scripts/.cache-3dep.tif` and `assets/calaveras-terrain.bin` with:

```
pipeline/.cache/
data/*/terrain.bin
__pycache__/
```

`Native/main.cu`: replace `#include "../src/clearwater.cu"` with `#include "../renderer/clearwater.cu"`. In `paths()`, replace each `L"assets/seabed.jpg"` with `L"renderer/assets/seabed.jpg"` (three candidates). In `decodeTerrain()`, replace each `L"assets/calaveras-terrain.bin"` with `L"data/calaveras/terrain.bin"` (three candidates) and replace the error text `run python scripts/build-terrain.py --native` with `run python pipeline/build_bundle.py calaveras --native`.

- [ ] **Step 6: Run the checks**

Run: `npm run check && npm run build && npm test`
Expected: `check` prints 20 kernels; `build` prints "Built Pages …"; `npm test` ends with the verification JSON, exit code 0. Also confirm `ls dist/data/calaveras` lists `terrain.bin.gz` and `terrain.json`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Restructure into renderer/, data/ and pipeline/

Pure moves plus path fixes; the root index.html redirects to the live
explore page until the journey replaces it. Browser checks now serve the
repo themselves on an ephemeral port."
```

---

### Task 2: Self-describing terrain buffer (no reservoir constants in the shader)

**Files:**
- Modify: `renderer/clearwater.cu` (terrain block near `#define TERRAIN_W`, and `terrainHeight`)
- Modify: `renderer/terrain.js` (add `gpuCells()`, delete `checkShaderGrid`)
- Modify: `renderer/explore.js` (use `gpuCells()`, drop `checkShaderGrid`)
- Modify: `Native/main.cu` (`decodeTerrain` writes the header)
- Test: `scripts/verify.mjs`

**Interfaces:**
- Consumes: `Terrain` fields `width`, `height`, `x0`, `z0`, `cell`, `cells` (Float32Array, 4 floats per cell).
- Produces: `Terrain.gpuCells(): Float32Array`, layout `[width, height, x0, z0, cell, 0, 0, 0, ...cells]`. Shader contract: `T[0] = (width, height, x0, z0)`, `T[1].x = cell`, cell `(row, col)` at `T[2 + row * width + col]`.

- [ ] **Step 1: Write the failing test**

In `scripts/verify.mjs`, add `readFile` to the fs import (`import { mkdir, readFile, writeFile } from "node:fs/promises";`) and, right after `await mkdir("previews", { recursive: true });`, add:

```js
// Reservoir grids come from the bundle at runtime, never from shader constants.
const cudaSource = await readFile("renderer/clearwater.cu", "utf8");
assert.ok(!/#define TERRAIN_/.test(cudaSource), "shader must not hard-code a terrain grid");
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL with `AssertionError: shader must not hard-code a terrain grid`.

- [ ] **Step 3: Make the shader read the grid from the buffer**

In `renderer/clearwater.cu`, replace the block from the comment `// Real terrain: USGS 3DEP lidar elevation packed by scripts/build-terrain.py (metadata in` down to the end of `terrainSample` (the `#define TERRAIN_*` lines included) with:

```cpp
// Real terrain: USGS 3DEP lidar packed by pipeline/build_bundle.py into data/<id>/terrain.*.
// The buffer describes itself: T[0] = (width, height, x0, z0), T[1].x = cell size, and cell
// (row, col) is T[2 + row * width + col] = (height, signed shoreline distance, valley, 0).
// Local metres: x east, z south, y up from the reservoir surface.
__device__ float4 terrainSample(const float4 *T, float x, float z) {
  float4 g = T[0];
  float cell = T[1].x;
  int w = (int)g.x;
  float u = fminf(fmaxf((x - g.z) / cell, 0.0f), g.x - 1.001f),
        v = fminf(fmaxf((z - g.w) / cell, 0.0f), g.y - 1.001f);
  int iu = (int)u, iv = (int)v, i = 2 + iv * w + iu;
  float fu = u - (float)iu, fv = v - (float)iv;
  return mix4(mix4(T[i], T[i + 1], fu), mix4(T[i + w], T[i + w + 1], fu), fv);
}
// Metres outside the surveyed grid (negative inside).
__device__ float terrainOutside(const float4 *T, float x, float z) {
  float4 g = T[0];
  float cell = T[1].x;
  return fmaxf(fmaxf(g.z - x, x - (g.z + (g.x - 1.0f) * cell)),
               fmaxf(g.w - z, z - (g.w + (g.y - 1.0f) * cell)));
}
```

In `terrainHeight`, replace

```cpp
  float outside = fmaxf(fmaxf(TERRAIN_X0 - x, x - (TERRAIN_X0 + (TERRAIN_W - 1) * TERRAIN_CELL)),
                        fmaxf(TERRAIN_Z0 - z, z - (TERRAIN_Z0 + (TERRAIN_H - 1) * TERRAIN_CELL)));
  return s.x + detail * smooth(0.0f, 25.0f, s.y) - .25f * fmaxf(0.0f, outside);
```

with

```cpp
  return s.x + detail * smooth(0.0f, 25.0f, s.y) - .25f * fmaxf(0.0f, terrainOutside(T, x, z));
```

- [ ] **Step 4: Upload the header from the host**

In `renderer/terrain.js`, inside `class Terrain`, after the constructor add:

```js
  // GPU layout read by terrainSample() in clearwater.cu: two header texels
  // (width, height, x0, z0) and (cell, 0, 0, 0), then the cells.
  gpuCells() {
    const out = new Float32Array(this.cells.length + 8);
    out.set([this.width, this.height, this.x0, this.z0, this.cell, 0, 0, 0]);
    out.set(this.cells, 8);
    return out;
  }
```

Delete the whole `checkShaderGrid` function and its preceding comment line (`// The shader hard-codes the grid; refuse to render if it disagrees with the asset.`).

In `renderer/explore.js`: change the import to `import { formatElevation, formatLatLon, loadTerrain } from "./terrain.js";`, delete the line `checkShaderGrid(source, terrain);`, and replace `terrainCells = rt.createBuffer(terrain.cells);` with `terrainCells = rt.createBuffer(terrain.gpuCells());`.

- [ ] **Step 5: Keep the native host in step**

In `Native/main.cu` `decodeTerrain()`, replace

```cpp
  const float scale[3]={.05f,.25f,1.f/65472},offset[3]={-250.f,-4000.f,0.f};std::vector<float4> cells(n,make_float4(0,0,0,0));std::vector<uint16_t> row(w);
```

with

```cpp
  // Header texels as in data/calaveras/terrain.json (width, height, gridOrigin, cell); the
  // native host renders Calaveras only.
  const float scale[3]={.05f,.25f,1.f/65472},offset[3]={-250.f,-4000.f,0.f};std::vector<float4> cells(n+2,make_float4(0,0,0,0));std::vector<uint16_t> row(w);
  cells[0]=make_float4((float)w,(float)h,-5097.1276f,-6581.1548f);cells[1]=make_float4(10.4616285f,0,0,0);
```

replace `float4& cell=cells[(size_t)r*w+i];` with `float4& cell=cells[2+(size_t)r*w+i];`, and replace `terrain.alloc(n);check(cudaMemcpy(terrain.p,cells.data(),n*sizeof(float4),cudaMemcpyHostToDevice));` with `terrain.alloc(n+2);check(cudaMemcpy(terrain.p,cells.data(),(n+2)*sizeof(float4),cudaMemcpyHostToDevice));`.

(If Task 4 regenerates Calaveras with a different `gridOrigin` or `cell`, update these two header lines to the new `terrain.json` values in that task.)

- [ ] **Step 6: Run the checks**

Run: `npm run check && npm test`
Expected: PASS. The model checks (center on water, viewpoints on land, lat/lon on Calaveras) prove the header is read correctly.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Make the terrain buffer self-describing

The grid (size, origin, cell) travels in two header texels, so the
shader has no reservoir constants and any bundle renders."
```

---

### Task 3: Bundle-driven explore page (reservoir, viewpoints, pose, embed)

**Files:**
- Create: `data/calaveras/cameras.json` (viewpoints only; Task 4 regenerates it with a flyover)
- Modify: `data/calaveras/terrain.json` (add `"name"` and `"biome"`; Task 4 writes these from config)
- Modify: `renderer/explore.js`, `renderer/explore.html`, `renderer/explore.css`
- Test: `scripts/verify.mjs`

**Interfaces:**
- Consumes: `data/<id>/terrain.json` gains `name: string`, `biome: string`; `data/<id>/cameras.json` = `{ viewpoints: { overlook, ridge, shore }, flyover? }`, each viewpoint `{ x, z, above, yaw, pitch, speed, label }` (local metres; `above` = metres over ground/water; yaw 0 looks north, forward = (sin yaw, −cos yaw)).
- Produces: explore URL parameters: `reservoir=<id>` (default `calaveras`), `pose=x,y,z,yaw,pitch` (absolute scene metres/radians), `embed=1` (hides all chrome and posts `{ type: "waterscape:frame", ms, reservoir }` to `parent` every 15 frames, target origin `location.origin`). Global `window.waterscapeModel = { terrain, viewpoints, viewpoint(name) }` (replaces `window.calaverasModel`).

- [ ] **Step 1: Write the failing tests**

In `scripts/verify.mjs`:

1. Replace every `window.calaverasModel` with `window.waterscapeModel`.
2. Immediately after the `model` assertions (the block ending with the lat/lon `assert.ok`), add:

```js
  // Viewpoint buttons come from the bundle's cameras.json.
  const presets = await page.$$eval("[data-preset]", (b) =>
    b.map((x) => [x.dataset.preset, x.textContent]),
  );
  assert.deepEqual(presets, [
    ["overlook", "North ridge"],
    ["ridge", "West ridge"],
    ["shore", "Shoreline"],
  ]);
```

3. Just before `const result = {`, add a second page for the embed contract:

```js
  const embed = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await embed.goto(
    `${base}/renderer/explore.html?reservoir=calaveras&embed=1&pose=-1200,420,-2600,2.5,-0.1`,
  );
  await embed.evaluate(() => {
    window.frameMessages = [];
    addEventListener("message", (e) => window.frameMessages.push(e.data));
  });
  await embed.waitForFunction(() => window.clearwaterDiagnostics?.ready, null, {
    timeout: 120000,
  });
  await embed.waitForFunction(() => window.frameMessages.length > 0, null, {
    timeout: 30000,
  });
  const embedState = await embed.evaluate(() => ({
    header: getComputedStyle(document.querySelector("header")).display,
    panel: getComputedStyle(document.getElementById("panel")).display,
    x: window.clearwaterLab.state.x,
    z: window.clearwaterLab.state.z,
    message: window.frameMessages[0],
  }));
  assert.equal(embedState.header, "none");
  assert.equal(embedState.panel, "none");
  assert.ok(Math.abs(embedState.x + 1200) < 1 && Math.abs(embedState.z + 2600) < 1, JSON.stringify(embedState));
  assert.equal(embedState.message.type, "waterscape:frame");
  assert.equal(embedState.message.reservoir, "calaveras");
  await embed.close();
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: FAIL, `window.waterscapeModel` is undefined (TypeError in page.evaluate).

- [ ] **Step 3: Add the bundle files for Calaveras**

Create `data/calaveras/cameras.json`:

```json
{
  "viewpoints": {
    "overlook": { "x": -1500, "z": -3000, "above": 3, "yaw": 2.69, "pitch": -0.12, "speed": 40, "label": "North ridge" },
    "ridge": { "x": -1600, "z": 900, "above": 3, "yaw": 1.29, "pitch": -0.15, "speed": 40, "label": "West ridge" },
    "shore": { "x": -740, "z": 300, "above": 1.6, "yaw": 1.571, "pitch": -0.04, "speed": 4, "label": "Shoreline" }
  }
}
```

In `data/calaveras/terrain.json`, add two top-level fields after `"source"`:

```json
  "name": "Calaveras Reservoir",
  "biome": "diablo-oak",
```

- [ ] **Step 4: Load the bundle in explore.js**

Replace the `VIEWPOINTS` constant and its preceding comment (the block starting `// Viewpoints on the real (USGS 3DEP lidar) terrain` through the closing `};`) with:

```js
// The reservoir bundle (data/<id>/) supplies terrain and named viewpoints.
const reservoirId = q.get("reservoir") || "calaveras",
  bundleBase = new URL(`../data/${reservoirId}/`, import.meta.url),
  embedded = q.has("embed");
let VIEWPOINTS = {};
```

Note `q` is defined on the first lines of the file; move the line `q = new URLSearchParams(location.search);` so `q` is declared before this block if it is not already (it is part of the first `const` statement, which comes first).

Replace

```js
window.calaverasModel = {
```

with

```js
window.waterscapeModel = {
```

and inside that object replace `viewpoints: VIEWPOINTS,` with

```js
  get viewpoints() {
    return VIEWPOINTS;
  },
```

Replace the `location` and `coordinates` entries in `diag` with `location: reservoirId,` (the real name is filled in after loading).

Replace the preset loop

```js
for (const button of document.querySelectorAll("[data-preset]"))
  button.onclick = () => {
    const name = button.dataset.preset;
    state.viewpoint = name;
    Object.assign(state, viewpoint(name));
    $("energy").value = name === "shore" ? 0.30 : 0.38;
    $("depth").value = 18;
    document
      .querySelectorAll("[data-preset]")
      .forEach((b) => b.classList.toggle("active", b === button));
    labels();
  };
```

with

```js
function selectViewpoint(name) {
  state.viewpoint = name;
  Object.assign(state, viewpoint(name));
  $("energy").value = name === "shore" ? 0.3 : 0.38;
  $("depth").value = 18;
  document
    .querySelectorAll("[data-preset]")
    .forEach((b) => b.classList.toggle("active", b.dataset.preset === name));
  labels();
}
function buildPresets() {
  document.querySelector(".presets").replaceChildren(
    ...Object.entries(VIEWPOINTS).map(([name, v]) => {
      const b = document.createElement("button");
      b.dataset.preset = name;
      b.textContent = v.label;
      b.classList.toggle("active", name === state.viewpoint);
      b.onclick = () => selectViewpoint(name);
      return b;
    }),
  );
}
```

In the frame loop, inside `if (state.frames % 15 === 0) {`, after `survey();` add:

```js
        if (embedded)
          parent.postMessage(
            { type: "waterscape:frame", ms: diag.frameMs, reservoir: reservoirId },
            location.origin,
          );
```

In the capture handler replace `a.download = "Calaveras-Reservoir.png";` with

```js
      a.download = `${terrain.meta.name.replaceAll(" ", "-")}.png`;
```

In the startup `try` block, replace

```js
  terrain = await loadTerrain(new URL("../data/calaveras/terrain", import.meta.url).href);
  terrainCells = rt.createBuffer(terrain.gpuCells());
  Object.assign(state, viewpoint(state.viewpoint));
```

with

```js
  if (embedded) document.body.classList.add("embed");
  terrain = await loadTerrain(new URL("terrain", bundleBase).href);
  VIEWPOINTS = (await (await fetch(new URL("cameras.json", bundleBase))).json()).viewpoints;
  terrainCells = rt.createBuffer(terrain.gpuCells());
  diag.location = terrain.meta.name;
  diag.coordinates = terrain.latLon(0, 0);
  document.title = `${terrain.meta.name} · Waterscape`;
  $("place").textContent = terrain.meta.name.toUpperCase();
  $("coords").textContent = formatLatLon(terrain.latLon(0, 0));
  $("intro").textContent = `A spring study of ${terrain.meta.name}, from USGS lidar terrain.`;
  buildPresets();
  const pose = q.get("pose")?.split(",").map(Number);
  if (pose?.length === 5 && pose.every(Number.isFinite))
    Object.assign(state, { x: pose[0], y: pose[1], z: pose[2], yaw: pose[3], pitch: pose[4] });
  else Object.assign(state, viewpoint(state.viewpoint));
```

- [ ] **Step 5: Generic markup and embed styling**

In `renderer/explore.html`:
- Replace `<title>Calaveras Reservoir · Water study</title>` with `<title>Waterscape</title>`.
- Replace `<strong>CALAVERAS</strong><small>RESERVOIR STUDY</small>` with `<strong>WATERSCAPE</strong><small id="place">RESERVOIR</small>`.
- Replace `<p class="eyebrow">37°28′42.5″N / 121°49′21.5″W</p>` with `<p class="eyebrow" id="coords"></p>`.
- Replace `<h1>Water held<br />by the hills.</h1>` with `<h1>Hydrology,<br />simulated.</h1>`.
- Replace the `<p class="intro">…</p>` element with `<p class="intro" id="intro"></p>`.
- Replace the three hard-coded preset buttons inside `<div class="presets">` with nothing (`<div class="presets"></div>`); `buildPresets()` fills it.
- In the canvas `aria-label`, replace `Interactive Calaveras Reservoir study.` with `Interactive reservoir study.`

Append to `renderer/explore.css`:

```css
/* Embedded in the journey: the view only, no chrome. */
.embed header,
.embed #panel,
.embed .survey,
.embed footer,
.embed .credit,
.embed #toggle {
  display: none;
}
```

- [ ] **Step 6: Run the checks**

Run: `npm test`
Expected: PASS, including the presets and embed assertions; the PNG export filename is still `Calaveras-Reservoir.png`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Drive the explore page from a reservoir bundle

?reservoir= picks the bundle, viewpoint buttons come from cameras.json,
?pose= sets the camera and ?embed=1 hides the chrome and reports frame
times to the parent page."
```

---

### Task 4: Per-reservoir pipeline; San Antonio bundle

Split the terrain script into small modules, add camera generation, and build both bundles from `pipeline/reservoirs.json`.

**Files:**
- Create: `pipeline/reservoirs.json`, `pipeline/geo.py`, `pipeline/dem.py`, `pipeline/cameras.py`, `pipeline/tests/conftest.py`, `pipeline/tests/test_geo.py`, `pipeline/tests/test_cameras.py`
- Rewrite: `pipeline/build_bundle.py`
- Generate: `data/calaveras/{terrain.bin.gz,terrain.json,cameras.json}`, `data/san_antonio/{terrain.bin.gz,terrain.json,cameras.json}`
- Modify: `package.json`, `Native/main.cu` (header values, only if they changed)

**Interfaces:**
- Consumes: bundle formats from Tasks 2-3.
- Produces: `python pipeline/build_bundle.py <id> [--native]`; `cameras.json.flyover = { duration: number, keys: [{ t, x, y, z, yaw, pitch }] }` with absolute `y` (scene metres), `t` strictly increasing from 0 to `duration`.
- Produces (Python): `geo.utm10(lat, lon) -> (east, north)`; `cameras.Grid(height, sdf, x0, z0, cell)` with `.ground(x, z)`; `cameras.visible_count(grid, x, z, eye, targets) -> int`; `cameras.search_viewpoints(grid) -> dict`; `cameras.flyover_keys(grid, viewpoint, duration=10.0, count=5, clearance=25.0) -> dict`.

- [ ] **Step 1: Write the failing tests**

`pipeline/tests/conftest.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
```

`pipeline/tests/test_geo.py`:

```python
from geo import utm10


def test_central_meridian_on_equator_is_false_easting():
    east, north = utm10(0.0, -123.0)
    assert abs(east - 500000.0) < 1e-6
    assert abs(north) < 1e-6


def test_matches_renderer_inverse_at_calaveras_origin():
    # terrain.js latLon(0, 0) for the committed Calaveras bundle returned this point;
    # the forward projection must land back on its UTM origin.
    east, north = utm10(37.472608030037705, -121.81815953185885)
    assert abs(east - 604503.06) < 0.5
    assert abs(north - 4147958.17) < 0.5
```

`pipeline/tests/test_cameras.py`:

```python
import math

import numpy as np

from cameras import Grid, flyover_keys, search_viewpoints, visible_count, water_targets


def bowl(wall=False):
    """A round reservoir (radius 800 m) in a bowl rising 0.15 m/m to 300 m."""
    n, cell = 200, 20.0
    x0 = z0 = -n * cell / 2
    rows, cols = np.mgrid[0:n, 0:n]
    x, z = x0 + cols * cell, z0 + rows * cell
    r = np.hypot(x, z)
    height = np.where(r < 800, 0.0, np.clip((r - 800) * 0.15, 0.1, 300.0))
    if wall:
        height = np.where((r > 850) & (r < 900), 500.0, height)
    return Grid(height, r - 800, x0, z0, cell)


def test_rim_sees_the_whole_bowl():
    g = bowl()
    targets = water_targets(g)
    assert visible_count(g, 0.0, 1400.0, 3.0, targets) == len(targets[0])


def test_wall_blocks_the_view():
    g = bowl(wall=True)
    assert visible_count(g, 0.0, 1400.0, 3.0, water_targets(g)) == 0


def test_search_places_three_distinct_viewpoints():
    g = bowl()
    v = search_viewpoints(g)
    assert set(v) == {"overlook", "ridge", "shore"}
    assert g.shore(v["overlook"]["x"], v["overlook"]["z"]) > 0
    assert g.shore(v["ridge"]["x"], v["ridge"]["z"]) > 0
    assert g.shore(v["shore"]["x"], v["shore"]["z"]) < 0
    gap = math.hypot(v["overlook"]["x"] - v["ridge"]["x"], v["overlook"]["z"] - v["ridge"]["z"])
    assert gap >= 1500
    for p in v.values():
        assert {"x", "z", "above", "yaw", "pitch", "speed", "label"} <= set(p)


def test_flyover_keeps_clearance_and_ordered_times():
    g = bowl()
    fly = flyover_keys(g, search_viewpoints(g)["overlook"])
    keys = fly["keys"]
    assert keys[0]["t"] == 0 and keys[-1]["t"] == fly["duration"]
    assert all(b["t"] > a["t"] for a, b in zip(keys, keys[1:]))
    for a, b in zip(keys, keys[1:]):
        for f in np.linspace(0, 1, 20):
            x = a["x"] + (b["x"] - a["x"]) * f
            z = a["z"] + (b["z"] - a["z"]) * f
            y = a["y"] + (b["y"] - a["y"]) * f
            assert y - float(g.ground(x, z)) >= 24.9
```

- [ ] **Step 2: Run to confirm failure**

Run: `python -m pytest pipeline/tests -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'geo'`.

- [ ] **Step 3: Implement the modules**

`pipeline/geo.py`: move the `utm10` function out of `pipeline/build_bundle.py` verbatim (the whole `def utm10(lat, lon):` body), with this header:

```python
"""WGS84 -> UTM zone 10N (EPSG:32610), Snyder's series; sub-millimetre here."""
import math
```

`pipeline/dem.py`:

```python
"""USGS 3DEP elevation: fetch, reservoir detection, derived channels and packing."""

import gzip
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SERVICE = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"
HEIGHT = {"offset": -250.0, "scale": 0.05}  # -250 .. 3026 m at 5 cm
SHORE = {"offset": -4000.0, "scale": 0.25}  # -4000 .. 12383 m at 25 cm
VALLEY = {"offset": 0, "scale": 1 / 65472}


def fetch_dem(rid, bbox, size, cache_dir):
    """Float32 UTM 10N elevation grid; returns (dem, cell_x, cell_y, left, top)."""
    cache = Path(cache_dir) / f"{rid}.tif"
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        url = (
            f"{SERVICE}/exportImage?bbox={bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}&bboxSR=4326"
            f"&imageSR=32610&size={size[0]},{size[1]}&format=tiff&pixelType=F32"
            "&noDataInterpretation=esriNoDataMatchAny&interpolation=RSP_BilinearInterpolation&f=image"
        )
        with urllib.request.urlopen(url, timeout=120) as r:
            cache.write_bytes(r.read())
    img = Image.open(cache)
    scale, tie = img.tag_v2[33550], img.tag_v2[33922]
    return np.array(img, dtype=np.float32), float(scale[0]), float(scale[1]), tie[3], tie[4]


def detect_water(dem, min_area_cells=5000):
    """Lidar hydro-flattens water: the reservoir is the largest connected region at the
    most common elevation. Returns (mask, water_level)."""
    vals, counts = np.unique(np.round(dem * 10) / 10, return_counts=True)
    level = float(vals[counts.argmax()])
    labels, _ = ndimage.label(np.abs(dem - level) < 0.15)
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    water = ndimage.binary_closing(labels == sizes.argmax(), iterations=2)
    if water.sum() < min_area_cells:
        raise ValueError(f"no reservoir found (largest flat region {int(water.sum())} cells)")
    return water, level


def channels(dem, water, level, cell):
    """(height above water, signed shoreline distance in metres, valley-ness 0..1)."""
    sdf = ndimage.distance_transform_edt(~water) * cell - ndimage.distance_transform_edt(water) * cell
    height = dem - level
    height[water] = 0.0
    lap = ndimage.laplace(ndimage.gaussian_filter(height, 6.0)) / (cell * cell)
    spread = np.percentile(np.abs(lap[~water]), 95)
    valley = np.clip(0.5 + 0.5 * lap / spread, 0.0, 1.0)
    return height, sdf, valley


def pack(height, sdf, valley):
    """Planar uint16 channels, each row delta-coded from the row above (mod 65536)."""
    planes = [
        np.clip(np.round((height - HEIGHT["offset"]) / HEIGHT["scale"]), 0, 65535).astype(np.int64),
        np.clip(np.round((sdf - SHORE["offset"]) / SHORE["scale"]), 0, 65535).astype(np.int64),
        np.round(valley * 1023).astype(np.int64) * 64,
    ]
    body = b""
    for plane in planes:
        delta = plane.copy()
        delta[1:] = (plane[1:] - plane[:-1]) % 65536
        body += delta.astype("<u2").tobytes()
    return body


def write_gzip(path, body):
    with gzip.GzipFile(path, "wb", compresslevel=9, mtime=0) as g:
        g.write(body)
```

`pipeline/cameras.py`:

```python
"""Camera placement on a reservoir bundle: line-of-sight viewpoints and flyover keys.

Conventions match the renderer: local metres, x east, z south, y up from the water
surface; yaw 0 looks north (-z) and forward is (sin yaw, -cos yaw)."""

import math

import numpy as np

COMPASS = ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"]


class Grid:
    def __init__(self, height, sdf, x0, z0, cell):
        self.h = np.where(sdf < 0, 0.0, height)  # the water surface where flooded
        self.sdf, self.x0, self.z0, self.cell = sdf, x0, z0, cell
        self.rows, self.cols = height.shape

    def ground(self, x, z):
        """Bilinear ground/water height, clamped at the grid edge (as the renderer does)."""
        u = np.clip((np.asarray(x, float) - self.x0) / self.cell, 0, self.cols - 1.001)
        v = np.clip((np.asarray(z, float) - self.z0) / self.cell, 0, self.rows - 1.001)
        iu, iv = u.astype(int), v.astype(int)
        fu, fv = u - iu, v - iv
        h = self.h
        top = h[iv, iu] * (1 - fu) + h[iv, iu + 1] * fu
        bottom = h[iv + 1, iu] * (1 - fu) + h[iv + 1, iu + 1] * fu
        return top * (1 - fv) + bottom * fv

    def shore(self, x, z):
        c = int(np.clip(round((x - self.x0) / self.cell), 0, self.cols - 1))
        r = int(np.clip(round((z - self.z0) / self.cell), 0, self.rows - 1))
        return float(self.sdf[r, c])

    def xz(self, rows, cols):
        return self.x0 + np.asarray(cols) * self.cell, self.z0 + np.asarray(rows) * self.cell


def yaw_towards(x, z, tx, tz):
    return math.atan2(tx - x, -(tz - z))


def turn(a, b):
    """Signed shortest rotation from angle a to angle b."""
    return math.atan2(math.sin(b - a), math.cos(b - a))


def water_targets(grid, count=150, seed=1):
    rows, cols = np.nonzero(grid.sdf < -30)
    pick = np.random.default_rng(seed).choice(len(rows), min(count, len(rows)), replace=False)
    return grid.xz(rows[pick], cols[pick])


def water_centroid(grid):
    rows, cols = np.nonzero(grid.sdf < 0)
    x, z = grid.xz(rows.mean(), cols.mean())
    return float(x), float(z)


def visible_count(grid, x, z, eye, targets):
    """How many water targets the eye (eye metres above ground at x, z) can see."""
    y0 = float(grid.ground(x, z)) + eye
    tx, tz = targets
    s = np.linspace(0, 1, 64)[1:-1]
    px = x + np.outer(tx - x, s)
    pz = z + np.outer(tz - z, s)
    py = y0 * (1 - s)  # straight line down to the water surface at each target
    return int(np.all(py[None, :] > grid.ground(px, pz) + 0.5, axis=1).sum())


def _viewpoint(grid, x, z, label, above=3.0, speed=40):
    cx, cz = water_centroid(grid)
    rise = float(grid.ground(x, z)) + above
    pitch = -min(0.25, max(0.04, math.atan2(rise, math.hypot(cx - x, cz - z))))
    return {
        "x": round(float(x)), "z": round(float(z)), "above": above,
        "yaw": round(yaw_towards(x, z, cx, cz), 3), "pitch": round(pitch, 3),
        "speed": speed, "label": label,
    }


def _compass_label(grid, x, z):
    cx, cz = water_centroid(grid)
    bearing = math.degrees(yaw_towards(cx, cz, x, z)) % 360  # direction from water to point
    return f"{COMPASS[int((bearing + 22.5) // 45) % 8]} ridge"


def search_viewpoints(grid, step=150.0, eye=3.0):
    """Overlook = land point seeing the most open water; ridge = best point at least
    1500 m away looking from a direction at least 60 degrees different; shore = 40-80 m
    offshore, nearest the overlook, facing the open water."""
    targets = water_targets(grid)
    cx, cz = water_centroid(grid)
    stride = max(1, int(step / grid.cell))
    scored = []
    for r in range(0, grid.rows, stride):
        for c in range(0, grid.cols, stride):
            if not 150 <= grid.sdf[r, c] <= 3000:
                continue
            x, z = (float(v) for v in grid.xz(r, c))
            if float(grid.ground(x, z)) < 40:
                continue
            scored.append((visible_count(grid, x, z, eye, targets), x, z))
    if not scored:
        raise ValueError("no land within 3 km of the water rises 40 m above it")
    scored.sort(key=lambda s: -s[0])
    _, ox, oz = scored[0]
    look = yaw_towards(ox, oz, cx, cz)
    ridge = next(
        (s for s in scored[1:]
         if math.hypot(s[1] - ox, s[2] - oz) >= 1500
         and abs(turn(look, yaw_towards(s[1], s[2], cx, cz))) >= math.radians(60)),
        None,
    ) or next((s for s in scored[1:] if math.hypot(s[1] - ox, s[2] - oz) >= 1500), None)
    if ridge is None:
        raise ValueError("no second viewpoint 1500 m from the overlook")
    rows, cols = np.nonzero((grid.sdf <= -40) & (grid.sdf >= -80))
    xs, zs = grid.xz(rows, cols)
    i = int(np.argmin(np.hypot(xs - ox, zs - oz)))
    return {
        "overlook": _viewpoint(grid, ox, oz, _compass_label(grid, ox, oz)),
        "ridge": _viewpoint(grid, ridge[1], ridge[2], _compass_label(grid, ridge[1], ridge[2])),
        "shore": _viewpoint(grid, xs[i], zs[i], "Shoreline", above=1.6, speed=4) | {"pitch": -0.04},
    }


def flyover_keys(grid, vp, duration=10.0, count=5, clearance=25.0):
    """Glide from a viewpoint 35% of the way toward the water centroid, rising 40 m and
    turning to face the water; every point on the path stays `clearance` above ground."""
    cx, cz = water_centroid(grid)
    x0, z0 = vp["x"], vp["z"]
    y0 = float(grid.ground(x0, z0)) + max(vp["above"], clearance)
    yaw_end = vp["yaw"] + turn(vp["yaw"], yaw_towards(x0, z0, cx, cz))
    keys = []
    for i in range(count):
        f = i / (count - 1)
        x, z = x0 + (cx - x0) * 0.35 * f, z0 + (cz - z0) * 0.35 * f
        keys.append({"t": duration * f, "x": x, "y": y0 + 40.0 * f, "z": z,
                     "yaw": vp["yaw"] + (yaw_end - vp["yaw"]) * f, "pitch": vp["pitch"]})
    deficit = 0.0
    for a, b in zip(keys, keys[1:]):
        for f in np.linspace(0, 1, 20):
            x, z = a["x"] + (b["x"] - a["x"]) * f, a["z"] + (b["z"] - a["z"]) * f
            y = a["y"] + (b["y"] - a["y"]) * f
            deficit = max(deficit, clearance - (y - float(grid.ground(x, z))))
    for k in keys:
        k["y"] += deficit
    return {
        "duration": duration,
        "keys": [{k: round(v, 4 if k in ("yaw", "pitch") else 1) for k, v in key.items()} for key in keys],
    }
```

`pipeline/reservoirs.json`:

```json
{
  "calaveras": {
    "name": "Calaveras Reservoir",
    "biome": "diablo-oak",
    "bbox": [-121.875, 37.435, -121.77, 37.53],
    "size": [900, 1050],
    "viewpoints": {
      "overlook": { "x": -1500, "z": -3000, "above": 3, "yaw": 2.69, "pitch": -0.12, "speed": 40, "label": "North ridge" },
      "ridge": { "x": -1600, "z": 900, "above": 3, "yaw": 1.29, "pitch": -0.15, "speed": 40, "label": "West ridge" },
      "shore": { "x": -740, "z": 300, "above": 1.6, "yaw": 1.571, "pitch": -0.04, "speed": 4, "label": "Shoreline" }
    }
  },
  "san_antonio": {
    "name": "San Antonio Reservoir",
    "biome": "diablo-oak",
    "bbox": [-121.881, 37.535, -121.778, 37.624],
    "size": [870, 950]
  }
}
```

(San Antonio: 2.69 km² of lidar-flattened water at 141.7 m, centred at 37.5798°N 121.8292°W, found while planning; the bbox is about 9 × 10 km around it.)

Rewrite `pipeline/build_bundle.py` completely:

```python
"""Build one reservoir bundle in data/<id>/ from USGS 3DEP elevation (public domain).

  terrain.bin.gz  planar uint16 channels (height, shoreline distance, valley), rows
                  delta-coded; scales/offsets in terrain.json
  terrain.json    grid, datum, water level, origin, channel codecs, name, biome
  cameras.json    viewpoints (pinned in reservoirs.json or searched) and flyover keys

Local axes: x east, z south, y up from the reservoir surface, origin at the water centroid.
Requires numpy, scipy, Pillow.  Usage:  python pipeline/build_bundle.py <id> [--native]
--native also writes the uncompressed terrain.bin (gitignored) for the native CUDA host.
"""

import json
import sys
from pathlib import Path

import numpy as np

import cameras
import dem as demlib

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "pipeline"


def build(rid, native=False):
    config = json.loads((PIPELINE / "reservoirs.json").read_text())[rid]
    dem, sx, sy, left, top = demlib.fetch_dem(rid, config["bbox"], config["size"], PIPELINE / ".cache")
    water, level = demlib.detect_water(dem)
    height, sdf, valley = demlib.channels(dem, water, level, sx)
    rows, cols = np.nonzero(water)
    origin_e = left + (float(cols.mean()) + 0.5) * sx
    origin_n = top - (float(rows.mean()) + 0.5) * sy
    grid_origin = [left + 0.5 * sx - origin_e, origin_n - (top - 0.5 * sy)]

    out = ROOT / "data" / rid
    out.mkdir(parents=True, exist_ok=True)
    body = demlib.pack(height, sdf, valley)
    demlib.write_gzip(out / "terrain.bin.gz", body)
    if native:
        (out / "terrain.bin").write_bytes(body)
    h, w = dem.shape
    meta = {
        "source": "USGS National Map 3D Elevation Program (3DEP), public domain",
        "name": config["name"],
        "biome": config["biome"],
        "service": demlib.SERVICE,
        "bbox_lonlat": config["bbox"],
        "crs": "EPSG:32610",
        "verticalDatum": "NAVD88 metres (3DEP)",
        "encoding": "gzip; 3 planar uint16 channels; rows delta-coded from the row above",
        "width": w,
        "height": h,
        "cell": [sx, sy],
        "waterLevel": level,
        "originUTM": [origin_e, origin_n],
        "gridOrigin": grid_origin,
        "channels": {"height": demlib.HEIGHT, "shoreDistance": demlib.SHORE, "valley": demlib.VALLEY},
    }
    (out / "terrain.json").write_text(json.dumps(meta, indent=2) + "\n")

    grid = cameras.Grid(height, sdf, grid_origin[0], grid_origin[1], sx)
    views = config.get("viewpoints") or cameras.search_viewpoints(grid)
    cams = {"viewpoints": views, "flyover": cameras.flyover_keys(grid, views["overlook"])}
    (out / "cameras.json").write_text(json.dumps(cams, indent=2) + "\n")
    area = water.sum() * sx * sy / 1e6
    print(f"{rid}: water {level:.1f} m, {area:.2f} km2, grid {w}x{h} @ {sx:.2f} m, origin {grid_origin}")
    print(f"{rid}: viewpoints {', '.join(v['label'] for v in views.values())}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: python pipeline/build_bundle.py <id> [--native]")
    build(sys.argv[1], native="--native" in sys.argv)
```

In `package.json` `scripts`, add:

```json
    "bundle": "python pipeline/build_bundle.py",
    "test:pipeline": "python -m pytest pipeline/tests -q",
```

- [ ] **Step 4: Run the unit tests**

Run: `python -m pytest pipeline/tests -q`
Expected: 6 passed.

- [ ] **Step 5: Build both bundles**

Run: `python pipeline/build_bundle.py calaveras && python pipeline/build_bundle.py san_antonio`
Expected output includes `calaveras: water 223.7 m, 4.68 km2` and `san_antonio: water 141.7 m` with roughly `2.7 km2`. (The first run downloads each DEM into `pipeline/.cache/`.)

Check Calaveras is unchanged where it matters:

```bash
git diff --stat data/calaveras
python -c "import json;m=json.load(open('data/calaveras/terrain.json'));print(m['width'],m['height'],m['gridOrigin'],m['cell'][0],m['waterLevel'])"
```

Expected: `900 1050`, `gridOrigin` within 1 m of `[-5097.13, -6581.15]`, cell ≈ 10.4616, water level 223.7. If the USGS service returned identical data, `terrain.bin.gz` shows no diff. If `gridOrigin` or `cell` differ at all, update the two header lines added to `Native/main.cu` in Task 2 to the new values.

- [ ] **Step 6: Look at San Antonio in the live renderer**

Run: `npm start`, then open `http://localhost:5173/renderer/explore.html?reservoir=san_antonio` and click each viewpoint button.
Expected: real hills around San Antonio Reservoir from the overlook and ridge, water in front from the shoreline view. If a searched viewpoint faces a hillside, pin better viewpoints for `san_antonio` in `pipeline/reservoirs.json` (same shape as Calaveras) and rebuild.

Run: `npm test`
Expected: PASS (Calaveras bundle still satisfies every renderer check).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Build reservoir bundles from a per-reservoir pipeline

Split terrain baking into geo/dem/cameras modules with pytest coverage,
generate viewpoints by line-of-sight search and a flyover path per
bundle, and add the San Antonio Reservoir bundle."
```

---

### Task 5: Story cards and the bundle validator

**Files:**
- Create: `data/calaveras/story.json`, `data/san_antonio/story.json`, `pipeline/validate-bundles.mjs`, `pipeline/tests/validate-bundles.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `story.json = { id, name, place, operator, headline, facts: [{ label, value, source }] }`, `source` an `https://` URL.
- Produces: `validateBundle(dir: string): Promise<string[]>` and `validateAll(root: string): Promise<string[]>` from `pipeline/validate-bundles.mjs`; exported `REQUIRED: string[]` (file names every bundle must have). Running the file directly validates `data/` and exits 1 on any error.

- [ ] **Step 1: Write the failing test**

`pipeline/tests/validate-bundles.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { REQUIRED, validateBundle } from "../validate-bundles.mjs";

const view = { x: 0, z: 0, above: 3, yaw: 0, pitch: -0.1, speed: 40, label: "View" };
const good = {
  "terrain.json": {
    name: "Test Reservoir", biome: "diablo-oak", width: 2, height: 2, cell: [10, 10],
    gridOrigin: [0, 0], waterLevel: 100, originUTM: [0, 0], channels: {},
  },
  "cameras.json": {
    viewpoints: { overlook: view, ridge: view, shore: view },
    flyover: { duration: 10, keys: [{ t: 0 }, { t: 10 }] },
  },
  "story.json": {
    id: "test", name: "Test Reservoir", operator: "Someone", headline: "Hello.",
    facts: [{ label: "Capacity", value: "1 acre-foot", source: "https://example.gov/" }],
  },
};

async function bundle(overrides = {}, drop = []) {
  const dir = path.join(await mkdtemp(path.join(os.tmpdir(), "bundle-")), "test");
  await mkdir(dir);
  for (const file of REQUIRED) {
    if (drop.includes(file)) continue;
    const body = file.endsWith(".json") ? JSON.stringify({ ...good[file], ...overrides[file] }) : "";
    await writeFile(path.join(dir, file), body);
  }
  return dir;
}

test("a complete bundle has no errors", async () => {
  const dir = await bundle();
  assert.deepEqual(await validateBundle(dir), []);
  await rm(path.dirname(dir), { recursive: true });
});

test("a missing file is reported", async () => {
  const dir = await bundle({}, ["story.json"]);
  assert.deepEqual(await validateBundle(dir), ["test: missing story.json"]);
});

test("a fact without an https source is reported", async () => {
  const dir = await bundle({
    "story.json": { facts: [{ label: "Capacity", value: "1", source: "" }] },
  });
  assert.deepEqual(await validateBundle(dir), ["test: fact 0 (Capacity) has no https source"]);
});

test("flyover keys must end at the duration", async () => {
  const dir = await bundle({ "cameras.json": { flyover: { duration: 12, keys: [{ t: 0 }, { t: 10 }] } } });
  assert.deepEqual(await validateBundle(dir), ["test: last flyover key must be at duration"]);
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `node --test "pipeline/tests/*.test.mjs"`
Expected: FAIL, `Cannot find module '…/pipeline/validate-bundles.mjs'`.

- [ ] **Step 3: Implement the validator**

`pipeline/validate-bundles.mjs`:

```js
// Schema checks for reservoir bundles in data/<id>/ (and, from Task 7, journey.json).
// Usage: node pipeline/validate-bundles.mjs   (exits 1 and lists problems on failure)
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED = ["terrain.bin.gz", "terrain.json", "cameras.json", "story.json"];

export async function validateBundle(dir) {
  const id = path.basename(dir),
    errors = [];
  for (const file of REQUIRED)
    await stat(path.join(dir, file)).catch(() => errors.push(`${id}: missing ${file}`));
  if (errors.length) return errors;
  const json = async (file) => JSON.parse(await readFile(path.join(dir, file), "utf8"));
  const [terrain, cameras, story] = await Promise.all(
    ["terrain.json", "cameras.json", "story.json"].map(json),
  );
  for (const key of ["name", "biome", "width", "height", "cell", "gridOrigin", "waterLevel", "originUTM", "channels"])
    if (terrain[key] === undefined) errors.push(`${id}: terrain.json lacks ${key}`);
  for (const name of ["overlook", "ridge", "shore"]) {
    const v = cameras.viewpoints?.[name];
    if (!v) errors.push(`${id}: cameras.json lacks viewpoint ${name}`);
    else
      for (const key of ["x", "z", "above", "yaw", "pitch", "speed", "label"])
        if (v[key] === undefined) errors.push(`${id}: viewpoint ${name} lacks ${key}`);
  }
  const keys = cameras.flyover?.keys ?? [];
  if (keys.length < 2) errors.push(`${id}: flyover needs at least 2 keys`);
  keys.forEach((k, i) => {
    if (i && !(k.t > keys[i - 1].t)) errors.push(`${id}: flyover key ${i} is out of order`);
  });
  if (keys.length >= 2 && Math.abs(keys.at(-1).t - cameras.flyover.duration) > 1e-6)
    errors.push(`${id}: last flyover key must be at duration`);
  if (story.id !== id) errors.push(`${id}: story.json id is ${story.id}`);
  for (const key of ["name", "operator", "headline"])
    if (!story[key]) errors.push(`${id}: story.json lacks ${key}`);
  if (!story.facts?.length) errors.push(`${id}: story.json has no facts`);
  (story.facts ?? []).forEach((f, i) => {
    if (!f.label || !f.value) errors.push(`${id}: fact ${i} needs a label and a value`);
    if (!/^https:\/\//.test(f.source ?? ""))
      errors.push(`${id}: fact ${i} (${f.label}) has no https source`);
  });
  return errors;
}

export async function validateAll(root) {
  const dirs = (await readdir(path.join(root, "data"), { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => path.join(root, "data", d.name));
  return (await Promise.all(dirs.map(validateBundle))).flat();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await validateAll(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  for (const e of errors) console.error(e);
  console.log(errors.length ? `${errors.length} bundle problem(s)` : "Bundles valid.");
  process.exitCode = errors.length ? 1 : 0;
}
```

- [ ] **Step 4: Run the unit tests**

Run: `node --test "pipeline/tests/*.test.mjs"`
Expected: 4 passing tests.

- [ ] **Step 5: Write the story cards (the data run should now fail)**

Run: `node pipeline/validate-bundles.mjs`
Expected: FAIL, `calaveras: missing story.json` and `san_antonio: missing story.json`.

Create `data/calaveras/story.json`:

```json
{
  "id": "calaveras",
  "name": "Calaveras Reservoir",
  "place": "Alameda and Santa Clara counties, east of Milpitas",
  "operator": "San Francisco Public Utilities Commission",
  "headline": "Rebuilt so it keeps holding water after a major earthquake on the fault beside it.",
  "facts": [
    { "label": "Capacity", "value": "96,850 acre-feet", "source": "https://en.wikipedia.org/wiki/Calaveras_Reservoir" },
    { "label": "New dam", "value": "220 ft tall, completed 2019", "source": "https://hetchhetchy.org/wp-content/uploads/2022/10/CALAVERAS-DAM-REPLACEMENT-PROJECT.pdf" },
    { "label": "Calaveras Fault", "value": "0.3 miles from the dam", "source": "https://hetchhetchy.org/wp-content/uploads/2022/10/CALAVERAS-DAM-REPLACEMENT-PROJECT.pdf" },
    { "label": "Water system", "value": "Hetch Hetchy Regional Water System, serving 2.7 million people", "source": "https://www.sfpuc.gov/about-us/our-systems" },
    { "label": "Surface at lidar survey", "value": "224 m (734 ft) above sea level", "source": "https://www.usgs.gov/3d-elevation-program" }
  ]
}
```

Create `data/san_antonio/story.json` (use the water level printed by Task 4 for the last fact; 141.7 m = 465 ft):

```json
{
  "id": "san_antonio",
  "name": "San Antonio Reservoir",
  "place": "Alameda County, about three miles east-southeast of Sunol",
  "operator": "San Francisco Public Utilities Commission",
  "headline": "Surveyed by the USGS in 2018: half a century of sediment had taken 1.5% of its storage.",
  "facts": [
    { "label": "Capacity", "value": "50,500 acre-feet as built", "source": "https://en.wikipedia.org/wiki/San_Antonio_Reservoir" },
    { "label": "Dam", "value": "James H. Turner Dam, completed 1965", "source": "https://en.wikipedia.org/wiki/San_Antonio_Reservoir" },
    { "label": "Lost to sediment, 1965–2018", "value": "733 acre-feet (1.5%)", "source": "https://www.usgs.gov/publications/storage-capacity-and-sedimentation-characteristics-san-antonio-reservoir-california" },
    { "label": "Water system", "value": "Hetch Hetchy Regional Water System, serving 2.7 million people", "source": "https://www.sfpuc.gov/about-us/our-systems" },
    { "label": "Surface at lidar survey", "value": "142 m (465 ft) above sea level", "source": "https://www.usgs.gov/3d-elevation-program" }
  ]
}
```

- [ ] **Step 6: Verify every fact against its source**

Open each `source` URL and confirm the value appears there as written (Calaveras: 96,850; 220 ft and 2019; 0.3 miles; 2.7 million. San Antonio: 50,500; James H. Turner, 1965; 733 acre-feet and 1.5%; three miles east-southeast of Sunol; the counties in `place`). If a value is not supported by its page, correct the value to what the page says or delete the fact. Do not ship a fact whose source does not state it.

- [ ] **Step 7: Wire into the test run and check**

In `package.json` `scripts`, set:

```json
    "validate": "node pipeline/validate-bundles.mjs",
    "test": "node --test \"pipeline/tests/*.test.mjs\" && node pipeline/validate-bundles.mjs && node scripts/verify.mjs",
```

Run: `npm run validate && npm test`
Expected: `Bundles valid.`; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add sourced story cards and a bundle validator

Every fact on a card carries an https source; the validator enforces
bundle completeness, viewpoint and flyover shape, and runs in npm test."
```

---

### Task 6: Pre-rendered flyovers (video tier assets)

**Files:**
- Create: `site/flyover-path.js`, `pipeline/tests/flyover-path.test.mjs`, `pipeline/render-flyover.mjs`
- Generate: `data/calaveras/{flyover.mp4,poster.jpg}`, `data/san_antonio/{flyover.mp4,poster.jpg}`
- Modify: `pipeline/validate-bundles.mjs` (`REQUIRED`), `package.json`

**Interfaces:**
- Consumes: `cameras.json.flyover` (Task 4); explore URL contract and `window.clearwaterLab.{state, seek(t)}` (Task 3; `seek` pauses, sets wave time and renders one frame).
- Produces: `poseAt(flyover: {duration, keys}, t: number) => {t, x, y, z, yaw, pitch}` in `site/flyover-path.js` (browser and Node). `node pipeline/render-flyover.mjs <id> [--seconds N] [--fps N]` writes `data/<id>/flyover.mp4` (H.264, yuv420p, 1280×720, faststart) and `data/<id>/poster.jpg` (first frame).

- [ ] **Step 1: Write the failing test**

`pipeline/tests/flyover-path.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { poseAt } from "../../site/flyover-path.js";

const flyover = {
  duration: 10,
  keys: [
    { t: 0, x: 0, y: 100, z: 0, yaw: 3.1, pitch: -0.1 },
    { t: 5, x: 50, y: 120, z: -50, yaw: -3.1, pitch: -0.1 },
    { t: 10, x: 100, y: 140, z: -100, yaw: -3.0, pitch: -0.2 },
  ],
};

test("starts and ends on the first and last keys", () => {
  assert.equal(poseAt(flyover, 0).x, 0);
  assert.equal(poseAt(flyover, 10).x, 100);
  assert.equal(poseAt(flyover, 99).y, 140);
});

test("eases in and out but moves steadily through the middle", () => {
  const early = poseAt(flyover, 1).x, mid = poseAt(flyover, 5).x;
  assert.ok(early < 10, `eases in (x=${early})`);
  assert.ok(Math.abs(mid - 50) < 1e-9, `midpoint on the middle key (x=${mid})`);
});

test("turns the short way across ±π", () => {
  const yaw = poseAt(flyover, 2.5).yaw;
  assert.ok(Math.abs(Math.abs(yaw) - Math.PI) < 0.1, `yaw=${yaw}`);
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `node --test "pipeline/tests/*.test.mjs"`
Expected: FAIL, cannot find `site/flyover-path.js`.

- [ ] **Step 3: Implement poseAt**

`site/flyover-path.js`:

```js
// Camera pose along a bundle's flyover (cameras.json). Time is eased once over the whole
// flight (smooth start and stop) and positions interpolate linearly between keys, so the
// camera never pauses at a key. Yaw turns the short way. Shared by the journey and the
// flyover renderer.
export function poseAt(flyover, t) {
  const { duration, keys } = flyover,
    f = Math.min(1, Math.max(0, t / duration)),
    u = duration * f * f * (3 - 2 * f);
  if (u <= keys[0].t) return { ...keys[0], t };
  if (u >= keys.at(-1).t) return { ...keys.at(-1), t };
  let i = 1;
  while (keys[i].t < u) i++;
  const a = keys[i - 1],
    b = keys[i],
    s = (u - a.t) / (b.t - a.t),
    mix = (k) => a[k] + (b[k] - a[k]) * s,
    turn = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
  return { t, x: mix("x"), y: mix("y"), z: mix("z"), yaw: a.yaw + turn * s, pitch: mix("pitch") };
}
```

- [ ] **Step 4: Run the unit tests**

Run: `node --test "pipeline/tests/*.test.mjs"`
Expected: all pass (7 tests).

- [ ] **Step 5: Implement the flyover renderer**

`pipeline/render-flyover.mjs`:

```js
// Render a reservoir's flyover with the live renderer: data/<id>/flyover.mp4 + poster.jpg.
// Usage: node pipeline/render-flyover.mjs <id> [--seconds N] [--fps N]
// Needs Microsoft Edge (Playwright channel "msedge") and ffmpeg on PATH.
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStaticServer } from "../scripts/serve.mjs";
import { poseAt } from "../site/flyover-path.js";

const root = path.resolve(import.meta.dirname, ".."),
  args = process.argv.slice(2),
  id = args[0],
  option = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i < 0 ? fallback : Number(args[i + 1]);
  };
if (!id) throw new Error("Usage: node pipeline/render-flyover.mjs <id> [--seconds N] [--fps N]");
const bundle = path.join(root, "data", id),
  { flyover } = JSON.parse(await readFile(path.join(bundle, "cameras.json"), "utf8")),
  fps = option("fps", 30),
  seconds = Math.min(option("seconds", flyover.duration), flyover.duration),
  frames = Math.round(seconds * fps),
  tmp = await mkdtemp(path.join(os.tmpdir(), `flyover-${id}-`)),
  server = createStaticServer(root);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
// On hybrid laptops Edge otherwise picks the integrated GPU (~7x slower).
const browser = await chromium.launch({
  channel: "msedge",
  headless: false,
  args: ["--enable-unsafe-webgpu", "--force_high_performance_gpu"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(
    `http://127.0.0.1:${server.address().port}/renderer/explore.html?reservoir=${id}&embed=1`,
  );
  await page.waitForFunction(
    () => window.clearwaterDiagnostics?.ready || window.clearwaterDiagnostics?.errors.length,
    null,
    { timeout: 180000 },
  );
  const errors = await page.evaluate(() => window.clearwaterDiagnostics.errors);
  if (errors.length) throw new Error(errors.join("\n"));
  await page.evaluate(() => {
    const q = document.getElementById("quality");
    q.value = "1536";
    q.dispatchEvent(new Event("change"));
  });
  await page.waitForFunction(() => window.clearwaterDiagnostics.width === 1536, null, {
    timeout: 30000,
  });
  for (let i = 0; i < frames; i++) {
    const pose = poseAt(flyover, i / fps);
    await page.evaluate(
      async ({ pose, t }) => {
        const { state, seek } = window.clearwaterLab;
        Object.assign(state, { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, pitch: pose.pitch });
        await seek(t);
      },
      { pose, t: 5 + i / fps },
    );
    await page.screenshot({ path: path.join(tmp, `frame_${String(i).padStart(5, "0")}.png`) });
    if (i % fps === 0) console.log(`${id}: frame ${i}/${frames}`);
  }
} finally {
  await browser.close();
  server.close();
}
const ffmpeg = (a) => {
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${a.join(" ")}`);
};
ffmpeg([
  "-framerate", String(fps), "-i", path.join(tmp, "frame_%05d.png"),
  "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", path.join(bundle, "flyover.mp4"),
]);
ffmpeg(["-i", path.join(tmp, "frame_00000.png"), "-q:v", "3", path.join(bundle, "poster.jpg")]);
await rm(tmp, { recursive: true });
console.log(`${id}: wrote ${frames} frames to data/${id}/flyover.mp4 and poster.jpg`);
```

In `package.json` `scripts`, add `"flyover": "node pipeline/render-flyover.mjs",`.

- [ ] **Step 6: Smoke-render one second**

Run: `node pipeline/render-flyover.mjs calaveras --seconds 1`
Then: `ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of default=nw=1 data/calaveras/flyover.mp4`
Expected: `codec_name=h264`, `width=1280`, `height=720`, `duration=1.000000` (±0.05). Open `data/calaveras/poster.jpg` and confirm it shows the North ridge view with no UI chrome.

- [ ] **Step 7: Require media in every bundle, then render both**

In `pipeline/validate-bundles.mjs` replace the `REQUIRED` line with:

```js
export const REQUIRED = ["terrain.bin.gz", "terrain.json", "cameras.json", "story.json", "flyover.mp4", "poster.jpg"];
```

Run: `node pipeline/render-flyover.mjs calaveras && node pipeline/render-flyover.mjs san_antonio`
Expected: each prints `wrote 300 frames`. Watch both videos: the camera glides toward the water without clipping into a hill. If a path clips, raise `clearance` for that reservoir by passing a larger value in `flyover_keys` (Task 4) and rebuild the bundle and video.

Check sizes: `ls -la data/*/flyover.mp4` should be under 12 MB each; if larger, re-run with `-crf 26` in `render-flyover.mjs`.

Run: `npm test`
Expected: PASS (validator now requires the media).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Render flyover videos and posters from the live renderer

poseAt() eases a bundle's flyover; render-flyover drives the explore page
frame by frame on the discrete GPU and encodes H.264 with ffmpeg."
```

---

### Task 7: The journey shell (video tier)

**Files:**
- Replace: `index.html` (the journey page)
- Create: `journey.json`, `site/journey.js`, `site/journey.css`, `scripts/verify-site.mjs`
- Modify: `pipeline/validate-bundles.mjs` (journey check), `scripts/build.mjs`, `package.json`

**Interfaces:**
- Consumes: bundle files `story.json`, `cameras.json`, `poster.jpg`, `flyover.mp4`.
- Produces: `journey.json = { title, stops: [{ id, caption }] }`; `window.waterscapeJourney = { stops, index }` (stops carry loaded `story` and `cameras`, or `null` when they failed to load); DOM ids `stage`, `poster`, `flyover`, `card`, `stopIndex`, `stopName`, `operator`, `headline`, `facts`, `prev`, `next`, `systemMap`; the URL hash `#stop=<id>` selects and records the stop; `?tier=video|live` is reserved for Task 8.

- [ ] **Step 1: Write the failing browser test**

`scripts/verify-site.mjs`:

```js
// Journey checks: cards, media, navigation, prefetch and failure fallback.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createStaticServer } from "./serve.mjs";

const server = createStaticServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  channel: "msedge",
  headless: false,
  args: ["--enable-unsafe-webgpu"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/?tier=video`);
  await page.waitForFunction(() => document.getElementById("stopName").textContent.length > 0);

  // Stop 1: card, sourced facts, poster, playing video, next stop prefetched.
  assert.equal(await page.textContent("#stopName"), "Calaveras Reservoir");
  const links = await page.$$eval("#facts a", (a) => a.map((x) => x.href));
  assert.ok(links.length >= 3 && links.every((h) => h.startsWith("https://")), JSON.stringify(links));
  await page.waitForFunction(() => document.getElementById("poster").naturalWidth > 0);
  await page.waitForFunction(() => document.getElementById("flyover").currentTime > 0.2, null, {
    timeout: 15000,
  });
  assert.ok((await page.getAttribute("#flyover", "src")).endsWith("data/calaveras/flyover.mp4"));
  const prefetched = await page.$$eval("link[rel=prefetch]", (l) => l.map((x) => x.href));
  assert.ok(prefetched.some((h) => h.endsWith("data/san_antonio/flyover.mp4")), JSON.stringify(prefetched));

  // Navigation: keyboard, hash, map state, buttons at the ends.
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.textContent("#stopName"), "San Antonio Reservoir");
  assert.equal(new URL(page.url()).hash, "#stop=san_antonio");
  assert.deepEqual(
    await page.$$eval("#systemMap li", (li) => li.map((x) => x.classList.contains("active"))),
    [false, true],
  );
  assert.equal(await page.isDisabled("#next"), true);
  await page.click("#prev");
  assert.equal(await page.textContent("#stopName"), "Calaveras Reservoir");

  // Deep link.
  await page.goto(`${base}/?tier=video#stop=san_antonio`);
  await page.waitForFunction(() => document.getElementById("stopName").textContent === "San Antonio Reservoir");

  // Broken video: the poster and card carry the stop.
  const broken = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await broken.route("**/flyover.mp4", (r) => r.abort());
  await broken.goto(`${base}/?tier=video`);
  await broken.waitForFunction(() => document.getElementById("stage").classList.contains("video-failed"));
  assert.ok(await broken.evaluate(() => document.getElementById("poster").naturalWidth > 0));
  assert.equal(await broken.textContent("#stopName"), "Calaveras Reservoir");
  await broken.close();

  assert.deepEqual(errors, []);
  console.log("Journey checks passed.");
} finally {
  await browser.close();
  server.close();
}
```

In `package.json` `scripts`, add `"test:site": "node scripts/verify-site.mjs",` and append ` && node scripts/verify-site.mjs` to the end of `"test"`.

- [ ] **Step 2: Run to confirm failure**

Run: `node scripts/verify-site.mjs`
Expected: FAIL, the redirect page has no `#stopName` (timeout on the first `waitForFunction`).

- [ ] **Step 3: Add the journey data and page**

`journey.json`:

```json
{
  "title": "Follow the water",
  "stops": [
    { "id": "calaveras", "caption": "Hetch Hetchy Regional Water System" },
    { "id": "san_antonio", "caption": "Hetch Hetchy Regional Water System" }
  ]
}
```

Replace `index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="theme-color" content="#173d42" />
    <meta
      name="description"
      content="Follow California's water through real lidar landscapes: the reservoirs, who they serve, and the public data behind them."
    />
    <link rel="icon" href="data:," />
    <title>Waterscape · Hydrology, simulated.</title>
    <link rel="stylesheet" href="./site/journey.css" />
  </head>
  <body>
    <section id="stage" aria-label="Reservoir view">
      <img id="poster" alt="" />
      <video id="flyover" muted playsinline loop preload="auto" aria-hidden="true"></video>
    </section>
    <header class="brand">
      <span class="mark">≈</span>
      <div><strong>WATERSCAPE</strong><small>Hydrology, simulated.</small></div>
    </header>
    <article id="card" aria-live="polite">
      <p class="eyebrow" id="stopIndex"></p>
      <h1 id="stopName"></h1>
      <p class="operator" id="operator"></p>
      <p class="headline" id="headline"></p>
      <dl id="facts"></dl>
      <div class="nav">
        <button id="prev" aria-label="Previous stop">←</button
        ><button id="next">Next stop →</button>
      </div>
    </article>
    <nav id="systemMap" aria-label="Journey stops"><ol></ol></nav>
    <p class="credit">
      Terrain:
      <a href="https://www.usgs.gov/3d-elevation-program" target="_blank" rel="noopener">USGS 3DEP lidar</a>
      · Water optics after
      <a href="https://github.com/Aureliengmz/clearwater" target="_blank" rel="noopener">Clearwater</a>
    </p>
    <script type="module" src="./site/journey.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Implement the journey**

`site/journey.js`:

```js
// Waterscape journey: one stop per reservoir bundle in data/<id>/. Every stop works from
// its poster and flyover video alone; the journey never waits on 3D.
const $ = (id) => document.getElementById(id);
const state = { stops: [], index: 0 };
window.waterscapeJourney = state;
const dataUrl = (id, file) => `./data/${id}/${file}`;

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function loadJourney() {
  const journey = await json("./journey.json");
  state.stops = await Promise.all(
    journey.stops.map(async (stop) => {
      const [story, cameras] = await Promise.all([
        json(dataUrl(stop.id, "story.json")).catch(() => null),
        json(dataUrl(stop.id, "cameras.json")).catch(() => null),
      ]);
      return { ...stop, story, cameras };
    }),
  );
}

function renderMap() {
  $("systemMap")
    .querySelector("ol")
    .replaceChildren(
      ...state.stops.map((stop, i) => {
        const li = document.createElement("li"),
          b = document.createElement("button");
        b.textContent = stop.story?.name ?? stop.id;
        b.onclick = () => show(i);
        li.append(b);
        return li;
      }),
    );
}

function renderCard(stop, i) {
  $("stopIndex").textContent = `Stop ${i + 1} of ${state.stops.length} · ${stop.caption}`;
  $("stopName").textContent = stop.story?.name ?? stop.id;
  $("operator").textContent = stop.story?.operator ?? "";
  $("headline").textContent =
    stop.story?.headline ?? "Details for this stop are unavailable right now.";
  $("facts").replaceChildren(
    ...(stop.story?.facts ?? []).flatMap((fact) => {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd"),
        a = document.createElement("a");
      dt.textContent = fact.label;
      a.textContent = fact.value;
      a.href = fact.source;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = "Source";
      dd.append(a);
      return [dt, dd];
    }),
  );
}

function showMedia(stop) {
  const video = $("flyover");
  $("stage").classList.remove("playing", "video-failed");
  $("poster").src = dataUrl(stop.id, "poster.jpg");
  $("poster").alt = `${stop.story?.name ?? stop.id} from the air`;
  video.src = dataUrl(stop.id, "flyover.mp4");
  video.play().catch(() => {}); // autoplay can be refused; the poster stays up
}

function prefetch(i) {
  document.querySelectorAll("link[data-prefetch]").forEach((l) => l.remove());
  const next = state.stops[i + 1];
  if (!next) return;
  for (const file of ["poster.jpg", "flyover.mp4"]) {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = dataUrl(next.id, file);
    link.dataset.prefetch = "";
    document.head.append(link);
  }
}

function show(i) {
  i = Math.max(0, Math.min(state.stops.length - 1, i));
  state.index = i;
  const stop = state.stops[i];
  renderCard(stop, i);
  showMedia(stop);
  prefetch(i);
  $("prev").disabled = i === 0;
  $("next").disabled = i === state.stops.length - 1;
  $("systemMap")
    .querySelectorAll("li")
    .forEach((li, j) => li.classList.toggle("active", j === i));
  history.replaceState(null, "", `${location.search}#stop=${stop.id}`);
}

$("flyover").addEventListener("playing", () => $("stage").classList.add("playing"));
$("flyover").addEventListener("error", () => $("stage").classList.add("video-failed"));
$("prev").onclick = () => show(state.index - 1);
$("next").onclick = () => show(state.index + 1);
addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "PageDown") show(state.index + 1);
  if (e.key === "ArrowLeft" || e.key === "PageUp") show(state.index - 1);
});
let wheelLock = 0;
addEventListener(
  "wheel",
  (e) => {
    if (Math.abs(e.deltaY) < 30 || performance.now() < wheelLock) return;
    wheelLock = performance.now() + 900;
    show(state.index + Math.sign(e.deltaY));
  },
  { passive: true },
);

await loadJourney();
renderMap();
const wanted = new URLSearchParams(location.hash.slice(1)).get("stop");
show(Math.max(0, state.stops.findIndex((s) => s.id === wanted)));
```

`site/journey.css`:

```css
:root {
  --ink: #eef6f2;
  --muted: #bcd3cf;
  --glass: linear-gradient(130deg, #183f46b8, #15363f80);
  --line: #ffffff2e;
}
* {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: #173d42;
  color: var(--ink);
  font: 13px/1.5 system-ui, "Segoe UI", sans-serif;
}
#stage,
#stage > * {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 0;
}
#flyover {
  opacity: 0;
  transition: opacity 0.6s;
}
#stage.playing #flyover {
  opacity: 1;
}
#stage.video-failed #flyover {
  display: none;
}
.brand {
  position: fixed;
  top: 32px;
  left: 38px;
  display: flex;
  gap: 12px;
  align-items: center;
  letter-spacing: 3px;
  text-shadow: 0 1px 8px #0006;
}
.brand .mark {
  font-size: 28px;
}
.brand small {
  display: block;
  letter-spacing: 1px;
  color: var(--muted);
}
#card {
  position: fixed;
  left: 38px;
  bottom: 38px;
  width: min(360px, calc(100vw - 32px));
  padding: 22px 22px 16px;
  background: var(--glass);
  backdrop-filter: blur(20px);
  border: 1px solid var(--line);
  border-radius: 4px;
}
.eyebrow {
  margin: 0 0 8px;
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--muted);
}
h1 {
  margin: 0;
  font: 30px/1.1 Georgia, serif;
}
.operator {
  margin: 4px 0 10px;
  color: var(--muted);
  font-size: 11px;
}
.headline {
  margin: 0 0 14px;
  font-size: 14px;
}
#facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 5px 14px;
  margin: 0 0 16px;
  font-size: 12px;
}
#facts dt {
  color: var(--muted);
}
#facts dd {
  margin: 0;
}
#facts a {
  color: var(--ink);
  text-decoration: underline dotted #ffffff80;
  text-underline-offset: 3px;
}
.nav {
  display: flex;
  gap: 6px;
}
button {
  font: inherit;
  color: inherit;
  cursor: pointer;
  background: #12333d40;
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 8px 12px;
}
button:hover:not(:disabled) {
  background: #e4f3e826;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
.nav #next {
  flex: 1;
}
#systemMap {
  position: fixed;
  top: 32px;
  right: 38px;
}
#systemMap ol {
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
#systemMap li button {
  font-size: 11px;
  padding: 6px 10px;
  background: var(--glass);
}
#systemMap li.active button {
  border-color: #ffffffa0;
}
.credit {
  position: fixed;
  right: 38px;
  bottom: 24px;
  margin: 0;
  font-size: 10px;
  color: var(--muted);
}
.credit a {
  color: var(--muted);
}
@media (max-width: 700px) {
  .brand {
    top: 18px;
    left: 16px;
  }
  #systemMap {
    top: 70px;
    left: 16px;
    right: 16px;
  }
  #card {
    left: 16px;
    bottom: 40px;
  }
  .credit {
    left: 16px;
    right: 16px;
    bottom: 12px;
  }
}
```

- [ ] **Step 5: Validate the journey, and ship it in the build**

In `pipeline/validate-bundles.mjs`, add before `validateAll`:

```js
export async function validateJourney(root) {
  const journey = JSON.parse(await readFile(path.join(root, "journey.json"), "utf8")),
    errors = [];
  if (!journey.stops?.length) errors.push("journey.json has no stops");
  for (const stop of journey.stops ?? []) {
    if (!stop.caption) errors.push(`journey.json: stop ${stop.id} has no caption`);
    await stat(path.join(root, "data", stop.id)).catch(() =>
      errors.push(`journey.json: no bundle for stop ${stop.id}`),
    );
  }
  return errors;
}
```

and change the last line of `validateAll` to:

```js
  return [...(await Promise.all(dirs.map(validateBundle))).flat(), ...(await validateJourney(root))];
```

In `scripts/build.mjs`, replace `await moduleGraph(path.join(root,'renderer/explore.js'));` with

```js
for(const entry of ['renderer/explore.js','site/journey.js'])await moduleGraph(path.join(root,entry));
```

and add `'journey.json','site/journey.css',` to the start of the copied-file list (before `'index.html'`).

- [ ] **Step 6: Run the checks**

Run: `npm run validate && node scripts/verify-site.mjs && npm run build`
Expected: `Bundles valid.`, `Journey checks passed.`, build succeeds and `dist/` contains `index.html`, `journey.json`, `site/journey.js`, `site/flyover-path.js` is absent until Task 8 imports it (fine).

Open `http://localhost:5173/` (after `npm start`) and look at both stops on a desktop window and at 400 px wide (browser dev tools). The card, map and credit must not overlap.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add the Waterscape journey (video tier)

The root page now walks journey.json stops: poster and flyover video,
story card with sourced facts, system map, keyboard/wheel/button
navigation, deep links and next-stop prefetch. A failed video leaves
the poster and card in place."
```

---

### Task 8: Live tier: "Explore in 3D"

**Files:**
- Create: `site/device.js`
- Modify: `index.html`, `site/journey.js`, `site/journey.css`, `scripts/verify-site.mjs`

**Interfaces:**
- Consumes: `poseAt` (Task 6); explore URL contract and `waterscape:frame` messages (Task 3).
- Produces: `liveCapable(tier?: string): Promise<boolean>` in `site/device.js` (`tier` defaults to the `?tier=` URL parameter; `"video"` forces false, `"live"` forces true, otherwise WebGPU with an adapter). `window.waterscapeJourney.live = { id, pose, frameTimes, started } | null`. DOM ids `explore` (toggle button), `slowNotice`, `slowBack`, `liveFrame` (the iframe while live).

- [ ] **Step 1: Write the failing tests**

In `scripts/verify-site.mjs`, before `assert.deepEqual(errors, []);` add:

```js
  // Video tier: no 3D offer.
  assert.equal(await page.isVisible("#explore"), false);

  // Live tier: the iframe opens at the flyover pose and reports frame times.
  const live = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await live.goto(`${base}/?tier=live`);
  await live.waitForSelector("#explore", { state: "visible" });
  await live.click("#explore");
  const frame = await (await live.waitForSelector("#liveFrame")).contentFrame();
  await frame.waitForFunction(() => window.clearwaterDiagnostics?.ready, null, { timeout: 120000 });
  await live.waitForFunction(() => window.waterscapeJourney.live?.frameTimes.length > 0, null, {
    timeout: 30000,
  });
  const expected = await live.evaluate(() => window.waterscapeJourney.live.pose),
    actual = await frame.evaluate(() => ({ ...window.clearwaterLab.state }));
  assert.ok(Math.abs(actual.x - expected.x) < 1 && Math.abs(actual.z - expected.z) < 1,
    JSON.stringify({ expected, actual }));
  assert.equal(await live.textContent("#explore"), "Back to video");
  await live.click("#explore");
  assert.equal(await live.$("#liveFrame"), null);
  // Changing stop while live also closes the renderer.
  await live.click("#explore");
  await live.waitForSelector("#liveFrame");
  await live.keyboard.press("ArrowRight");
  assert.equal(await live.$("#liveFrame"), null);
  await live.close();
```

- [ ] **Step 2: Run to confirm failure**

Run: `node scripts/verify-site.mjs`
Expected: FAIL, `#explore` never becomes visible (it does not exist yet).

- [ ] **Step 3: Implement device detection and the live toggle**

`site/device.js`:

```js
// Should the journey offer the live renderer? `?tier=video` or `?tier=live` forces it;
// otherwise WebGPU must hand out an adapter. Frame-time monitoring after entering 3D
// (journey.js) catches devices that have WebGPU but are too slow.
export async function liveCapable(tier = new URLSearchParams(location.search).get("tier")) {
  if (tier === "video") return false;
  if (tier === "live") return true;
  if (!navigator.gpu) return false;
  try {
    return !!(await navigator.gpu.requestAdapter({ powerPreference: "high-performance" }));
  } catch {
    return false;
  }
}
```

In `index.html`, replace

```html
        <button id="prev" aria-label="Previous stop">←</button
        ><button id="next">Next stop →</button>
```

with

```html
        <button id="prev" aria-label="Previous stop">←</button
        ><button id="explore" hidden>Explore in 3D</button
        ><button id="next">Next stop →</button>
      </div>
      <p id="slowNotice" hidden>
        This device is struggling with live 3D.
        <button id="slowBack">Back to video</button>
```

(the original closing `</div>` of `.nav` now follows `#slowNotice`'s `</p>`; make sure the result is: `<div class="nav">…buttons…</div><p id="slowNotice" hidden>…</p>`).

In `site/journey.js`, add at the top (after the header comment):

```js
import { liveCapable } from "./device.js";
import { poseAt } from "./flyover-path.js";
```

Add these functions after `prefetch`:

```js
// Median frame time above this for 2 s means the device should stay on video.
const SLOW_MS = 60;

function enterLive() {
  const stop = state.stops[state.index],
    video = $("flyover");
  if (!stop.cameras?.flyover) return;
  const pose = poseAt(stop.cameras.flyover, video.currentTime || 0),
    frame = document.createElement("iframe");
  frame.id = "liveFrame";
  frame.title = `${stop.story?.name ?? stop.id}, live 3D`;
  frame.src =
    `./renderer/explore.html?reservoir=${encodeURIComponent(stop.id)}&embed=1&pose=` +
    [pose.x, pose.y, pose.z, pose.yaw, pose.pitch].map((v) => v.toFixed(3)).join(",");
  state.live = { id: stop.id, pose, frameTimes: [], started: performance.now() };
  $("stage").append(frame);
  $("stage").classList.add("live");
  video.pause();
  $("explore").textContent = "Back to video";
  $("slowNotice").hidden = true;
}

function leaveLive() {
  if (!state.live) return;
  $("liveFrame")?.remove(); // frees the GPU work
  state.live = null;
  $("stage").classList.remove("live");
  $("slowNotice").hidden = true;
  $("explore").textContent = "Explore in 3D";
  $("flyover").play().catch(() => {});
}

addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.data?.type !== "waterscape:frame" || !state.live) return;
  const times = state.live.frameTimes;
  times.push(e.data.ms);
  const median = [...times].sort((a, b) => a - b)[times.length >> 1];
  if (performance.now() - state.live.started > 2000 && times.length >= 4 && median > SLOW_MS)
    $("slowNotice").hidden = false;
});
```

Change `const state = { stops: [], index: 0 };` to `const state = { stops: [], index: 0, live: null };`.

At the start of `show(i)` (first line of the function body) add `leaveLive();`.

After `$("next").onclick = () => show(state.index + 1);` add:

```js
$("explore").onclick = () => (state.live ? leaveLive() : enterLive());
$("slowBack").onclick = leaveLive;
```

Replace the last three lines of the file

```js
await loadJourney();
renderMap();
```

with

```js
await loadJourney();
renderMap();
$("explore").hidden = !(await liveCapable());
```

(the final two lines, `const wanted = …` and `show(…)`, stay as they are).

Append to `site/journey.css`:

```css
#stage.live #flyover,
#stage.live #poster {
  visibility: hidden;
}
#liveFrame {
  background: #173d42;
}
#slowNotice {
  margin: 12px 0 0;
  font-size: 12px;
  color: #ffe2b8;
}
#slowNotice button {
  margin-left: 6px;
  padding: 4px 8px;
}
```

- [ ] **Step 4: Run the checks**

Run: `node scripts/verify-site.mjs`
Expected: `Journey checks passed.`

Manual check on this laptop (Intel GPU picked by default): open `http://localhost:5173/`, click "Explore in 3D", fly with WASD for a few seconds. At Balanced resolution the slow notice should appear (about 75 ms/frame on the Intel GPU); "Back to video" returns to the flyover. With Edge set to High performance in Windows graphics settings, the notice should not appear.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Offer live 3D as an upgrade in the journey

WebGPU-capable devices get Explore in 3D: the explore page opens in an
iframe at the flyover's current pose, reports frame times, and suggests
returning to video when the device is too slow. Leaving the stop or the
3D view removes the renderer."
```

---

### Task 9: Docs, CI and final verification

**Files:**
- Modify: `README.md`, `HANDOFF.md`, `THIRD_PARTY_NOTICES.md`, `.github/workflows/pages.yml`, `package.json`
- Regenerate: `previews/*` (by `npm test`)

- [ ] **Step 1: CI runs the same checks that need no GPU**

In `.github/workflows/pages.yml`, after `- run: npm run check` add:

```yaml
      - run: node --test "pipeline/tests/*.test.mjs"
      - run: node pipeline/validate-bundles.mjs
```

In `package.json`, set `"name": "waterscape"` and keep version `1.0.0` (bumped on release, not here).

- [ ] **Step 2: Update the docs**

`README.md`: replace the title and the first two paragraphs (through the paragraph beginning "The terrain is the real ground") with:

```markdown
# Waterscape

**Hydrology, simulated.** A journey through California's water, starting with the Hetch Hetchy Regional Water System: real lidar landscapes, reservoir optics, and the public data behind each place. Every stop plays a pre-rendered flyover on any device; WebGPU-capable devices can switch to the live renderer and explore.

## Layout

| Path | What it is |
|---|---|
| `index.html`, `site/`, `journey.json` | The journey page (video tier, live-tier switch) |
| `renderer/` | The live CUDA→WGSL→WebGPU renderer (`explore.html?reservoir=<id>`) |
| `data/<id>/` | One bundle per reservoir: terrain, cameras, story, flyover, poster |
| `pipeline/` | Builds bundles: `build_bundle.py` (USGS 3DEP terrain + cameras), `render-flyover.mjs` (video), `validate-bundles.mjs` |

## Adding a reservoir

1. Add an entry to `pipeline/reservoirs.json` (name, biome, lon/lat bbox, grid size).
2. `python pipeline/build_bundle.py <id>` (needs numpy, scipy, Pillow).
3. Write `data/<id>/story.json`; every fact needs an https source.
4. `node pipeline/render-flyover.mjs <id>` (Edge + ffmpeg; uses the discrete GPU).
5. Add the stop to `journey.json`, then `npm test`.
```

and in the "Run locally" section replace any reference to `app.js`/`index.html` as the renderer with `renderer/explore.html`, and replace the two-terminal test instructions with `npm test` (it serves itself). Update the "Scope and tradeoffs" paragraph's script name `scripts/build-terrain.py` to `pipeline/build_bundle.py` and `assets/calaveras-terrain.*` to `data/<id>/terrain.*`.

`HANDOFF.md`: add at the top, under the title:

```markdown
> **Superseded for planning purposes** by `docs/superpowers/specs/2026-09-26-waterscape-design.md` and the plans in `docs/superpowers/plans/`. File paths below predate the restructure: `src/` → `renderer/`, `app.js` → `renderer/explore.js`, `assets/calaveras-terrain.*` → `data/calaveras/terrain.*`.
```

`THIRD_PARTY_NOTICES.md`: replace `assets/calaveras-terrain.bin.gz` with `data/*/terrain.bin.gz` and `assets/calaveras-terrain.json` and `scripts/build-terrain.py` with `data/*/terrain.json` and `pipeline/build_bundle.py`; replace `assets/seabed.jpg` with `renderer/assets/seabed.jpg`.

- [ ] **Step 3: Full verification**

Run each and confirm:

```bash
python -m pytest pipeline/tests -q          # 6 passed
npm run check                               # 20 kernels
npm test                                    # node tests, "Bundles valid.", renderer JSON, "Journey checks passed."
npm run build && ls dist dist/data/*        # index.html journey.json site renderer data/{calaveras,san_antonio}/{flyover.mp4,poster.jpg,…}
```

Then `npm start` and walk the journey at `http://localhost:5173/` on desktop and at 400 px wide.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Document Waterscape's layout and bundle workflow; run schema checks in CI"
```
