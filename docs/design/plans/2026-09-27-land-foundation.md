# Land Engine Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** three.js (vendored) renders the lidar terrain on the CUDA WebShader runtime's GPUDevice and hands the water kernel a per-pixel land distance, replacing the per-pixel terrain trace; the sky becomes a physically based sky with drifting clouds; three hand-tuned lighting presets (Morning, Midday, Golden hour) are selectable on the explore page and in the journey's live view. Every reservoir gets a `land.json` profile.

**Architecture:** Each frame: three.js renders the terrain mesh into a colour + depth render target → a small WGSL pass (`pack.js`) turns depth into distance along each pixel's ray and writes it into a runtime storage buffer → `render_water` reads that distance instead of calling `terrainTrace`, then shades land (still in CUDA, so nothing regresses) and water as today. Lighting moves from shader constants into a six-`float4` preset buffer read by the sky, land, water and caustics. The sky model is ported into CUDA (not drawn by three.js) so water reflections see the same sky.

**Tech Stack:** three.js r186 (`WebGPURenderer`, vendored under `vendor/three/`), raw WebGPU compute for the pack pass, CUDA WebShader (CUDA → WGSL), vanilla ES modules, Node 24 `node:test`, Playwright + Microsoft Edge.

**Spec:** `docs/superpowers/specs/2026-09-27-land-engine-design.md` (sub-project 1, Foundation). Evidence: the throwaway spike `spike/land/` in the `voxel-oaks` worktree.

## Departures from the spec (rulings)

- **Sky stays in the CUDA shader** (Preetham + clouds ported from `SkyMesh`) instead of three.js drawing `SkyMesh`: water reflections trace `sky()`, so one implementation keeps sky and reflection identical. Cost if wrong: a later move of the sky to three.js must also feed reflections.
- **Land colour stays in CUDA for the foundation** (`terrainShade` at the reconstructed point); three.js supplies geometry/distance only. Satisfies "nothing regresses"; sub-project 2 switches land colour to three.js materials. Cost if wrong: none for this sub-project.
- **Mirror-rendered land reflections (high tier) move to sub-project 3**, where there are three.js-only objects (oaks, grass) worth reflecting; until then reflections trace the same terrain as today.
- **Per-preset water tint is deferred**; presets set sun, sky, fill, haze, clouds and exposure.
- **`land.json` biome is `diablo-oak`**, the name `terrain.json` already uses, not the spec's example `oak-woodland`.

## Global Constraints

- Work on a feature branch in a worktree (not `main`); commit per task; never push.
- Target browsers: Chromium-based (Chrome, Edge) with WebGPU; no other-browser code paths (others keep the video tier).
- No external browser imports: every browser `import` is relative (`scripts/build.mjs` throws otherwise). three.js is vendored; its one bare import (`three.tsl.js` → `'three/webgpu'`) is rewritten when vendoring.
- Zero GPU→CPU readbacks in the frame loop (`diag.readbackBytes` stays 0).
- Low tier ≤ 33 ms/frame at 768 px on Intel Xe-LPG (`scripts/verify.mjs` asserts it on whatever GPU Edge picks; also measure with `--force_low_power_gpu`).
- Presets: exactly `morning`, `midday`, `golden`; shared by all reservoirs; each bundle's `land.json` lists which it offers and its `defaultPreset`.
- The native Windows host keeps today's land (ray-marched), frozen: it passes `landPass = 0`.
- Testing is proportionate (user preference): one failing-then-passing check per behaviour, one full `npm test` per task, screenshots for visual review. No extra reviewer agents unless asked.
- Coordinates: scene +x = east, +z = south (`latLon` uses `northing = on − z`), +y = up, water surface at y = 0. Camera ray (shader `ray()`): forward `(sin yaw·cos pitch, sin pitch, −cos yaw·cos pitch)`, vertical half-FOV `atan(0.62487)` (64.0° full).

## Review Focus

1. **Resolution change mid-session** (`#quality` select or governor step): the land render target and land buffer must be resized with `hdr`, or `render_water` reads out of bounds. Expect frames to keep coming with no errors — pinned in Task 5 Step 1.
2. **Camera outside the lidar crop / high above it**: beyond the mesh the pack writes "sky"; the painted far ridges must still show and nothing may go NaN — pinned in Task 5 Step 1 (fly 20 km out, frames continue, no errors).
3. **Shoreline**: the mesh must sit *below* the water surface offshore (1:3 bank to 30 m) so water always wins the depth comparison; a flat mesh at y = 0 would flicker — mesh heights pinned in Task 5's unit test; the shore viewpoint is in the Task 5 screenshot set.
4. **Unknown `?preset=` or a preset a bundle doesn't offer**: fall back to the bundle's `defaultPreset`, never crash — pinned in Task 2's unit test.
5. **three.js fails to initialise** (older browser, device quirk): live 3D must keep working with today's traced land (`landPass = 0`) rather than failing — Task 5 wraps land-pass creation and falls back; `diag.land.error` records why.

---

### Task 1: Vendor three.js

**Files:**
- Create: `scripts/vendor-three.mjs`, `vendor/three/` (generated: `three.core.js`, `three.webgpu.js`, `three.tsl.js`, `LICENSE`), `pipeline/tests/vendor-three.test.mjs`
- Modify: `package.json` (devDependency), `scripts/build.mjs` (copy `vendor/three/LICENSE`), `THIRD_PARTY_NOTICES.md`

**Interfaces:**
- Produces: `vendor/three/three.webgpu.js` (ES module, exports the three.js WebGPU API incl. `WebGPURenderer`, `RenderTarget`, `DepthTexture`, `MeshBasicNodeMaterial`), `vendor/three/three.tsl.js` (TSL, imports `./three.webgpu.js`).

- [ ] **Step 1: Write the failing test**

`pipeline/tests/vendor-three.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = ["three.core.js", "three.webgpu.js", "three.tsl.js"];

test("vendored three.js r186 has only relative imports", async () => {
  for (const f of files) {
    const src = await readFile(new URL(`../../vendor/three/${f}`, import.meta.url), "utf8");
    for (const m of src.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g))
      assert.ok(m[1].startsWith("."), `${f} imports ${m[1]}`);
  }
  const core = await readFile(new URL("../../vendor/three/three.core.js", import.meta.url), "utf8");
  assert.match(core, /const REVISION = '186'/);
  await readFile(new URL("../../vendor/three/LICENSE", import.meta.url), "utf8");
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `node --test pipeline/tests/vendor-three.test.mjs`
Expected: FAIL — `ENOENT` for `vendor/three/three.core.js`.

- [ ] **Step 3: Implement**

Add to `package.json` `devDependencies`: `"three": "0.186.1"`, then run `npm install`.

`scripts/vendor-three.mjs`:

```js
// Copies the three.js WebGPU build into vendor/three/ (the site allows no bare imports).
// Usage: node scripts/vendor-three.mjs   (after npm install; pins the version in package.json)
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const from = "node_modules/three",
  to = "vendor/three";
await mkdir(to, { recursive: true });
for (const f of ["three.core.js", "three.webgpu.js"]) await copyFile(`${from}/build/${f}`, `${to}/${f}`);
// three.tsl.js re-exports from the bare specifier 'three/webgpu'.
const tsl = await readFile(`${from}/build/three.tsl.js`, "utf8");
await writeFile(`${to}/three.tsl.js`, tsl.replaceAll("from 'three/webgpu'", "from './three.webgpu.js'"));
await copyFile(`${from}/LICENSE`, `${to}/LICENSE`);
console.log("Vendored three.js into vendor/three/.");
```

Run: `node scripts/vendor-three.mjs`

In `scripts/build.mjs`, in the copied-files array, after `'vendor/cuda-webshader/LICENSE'` add `'vendor/three/LICENSE'`.

In `THIRD_PARTY_NOTICES.md`, append:

```markdown
## three.js

`vendor/three/` is three.js r186 (https://github.com/mrdoob/three.js), MIT License,
Copyright © 2010-2025 three.js authors; see `vendor/three/LICENSE`. The sky model in
`renderer/clearwater.cu` (`sky()`) is ported from three.js's `SkyMesh` (MIT), itself based
on Preetham et al. 1999 and the work of Simon Wallner, Martin Upitis and zz85.
```

- [ ] **Step 4: Run the test**

Run: `node --test pipeline/tests/vendor-three.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/vendor-three.mjs vendor/three pipeline/tests/vendor-three.test.mjs package.json package-lock.json scripts/build.mjs THIRD_PARTY_NOTICES.md
git commit -m "Vendor three.js r186 for the land renderer"
```

---

### Task 2: Lighting presets and land profiles

**Files:**
- Create: `renderer/land/presets.js`, `pipeline/tests/presets.test.mjs`, `data/calaveras/land.json`, `data/san_antonio/land.json`
- Modify: `pipeline/validate-bundles.mjs`, `pipeline/tests/validate-bundles.test.mjs`

**Interfaces:**
- Produces (from `renderer/land/presets.js`):
  - `PRESET_NAMES = ["morning", "midday", "golden"]`
  - `PRESETS: Record<name, { label, sun: [x,y,z] (unit, y > 0), sunColor: [r,g,b], fill: [r,g,b], skyGain, turbidity, rayleigh, mieCoefficient, mieG, cloudCoverage, cloudDensity, cloudScale, cloudSpeed, haze: [r,g,b], hazeDensity, exposure }>`
  - `presetBuffer(preset): Float32Array(24)` — layout (six float4): `[0]` sun.xyz, cloudCoverage · `[1]` sunColor.rgb, cloudDensity · `[2]` fill.rgb, skyGain · `[3]` turbidity, rayleigh, mieCoefficient, mieG · `[4]` haze.rgb, hazeDensity · `[5]` cloudScale, cloudSpeed, exposure, 0
  - `choosePreset(requested: string|null, profile: {presets, defaultPreset}|null): string`
- `data/<id>/land.json`: `{ biome, vegetation: { density, species }, grass: { spring, summer }, presets: string[], defaultPreset }`.

- [ ] **Step 1: Write the failing tests**

`pipeline/tests/presets.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, PRESET_NAMES, choosePreset, presetBuffer } from "../../renderer/land/presets.js";

test("three presets, suns above the horizon and normalised", () => {
  assert.deepEqual(Object.keys(PRESETS).sort(), [...PRESET_NAMES].sort());
  for (const name of PRESET_NAMES) {
    const [x, y, z] = PRESETS[name].sun;
    assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-6, name);
    assert.ok(y > 0, name);
  }
  // Morning sun in the east (+x), golden hour in the west (−x), midday high.
  assert.ok(PRESETS.morning.sun[0] > 0.5 && PRESETS.golden.sun[0] < -0.5);
  assert.ok(PRESETS.midday.sun[1] > 0.8);
});

test("preset buffer layout matches the shader's six float4s", () => {
  const p = PRESETS.golden, b = presetBuffer(p);
  assert.equal(b.length, 24);
  assert.deepEqual([...b.slice(0, 3)], p.sun.map(Math.fround));
  assert.equal(b[3], Math.fround(p.cloudCoverage));
  assert.equal(b[11], Math.fround(p.skyGain));
  assert.equal(b[19], Math.fround(p.hazeDensity));
  assert.equal(b[22], Math.fround(p.exposure));
});

test("unknown or unoffered presets fall back to the bundle default", () => {
  const profile = { presets: ["golden", "midday"], defaultPreset: "golden" };
  assert.equal(choosePreset("midday", profile), "midday");
  assert.equal(choosePreset("morning", profile), "golden");
  assert.equal(choosePreset("sunset", profile), "golden");
  assert.equal(choosePreset(null, profile), "golden");
  assert.equal(choosePreset("midday", null), "midday");
  assert.equal(choosePreset(null, null), "golden");
});
```

In `pipeline/tests/validate-bundles.test.mjs`, add to the `good` object (after `"story.json": {…},`):

```js
  "land.json": {
    biome: "diablo-oak", vegetation: { density: 1, species: { "coast-live": 1 } },
    grass: { spring: "green", summer: "gold" }, presets: ["golden"], defaultPreset: "golden",
  },
```

and append:

```js
test("land.json must match the terrain biome and name known presets", async () => {
  const dir = await bundle({ "land.json": { biome: "sierra", presets: ["golden", "dusk"], defaultPreset: "midday" } });
  assert.deepEqual(await validateBundle(dir), [
    "test: land.json biome sierra differs from terrain.json diablo-oak",
    "test: land.json names unknown preset dusk",
    "test: land.json defaultPreset midday is not in its presets",
  ]);
  await rm(path.dirname(dir), { recursive: true });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `node --test "pipeline/tests/*.test.mjs"`
Expected: FAIL — `presets.js` not found; the new validator test fails (no land.json checks).

- [ ] **Step 3: Implement**

`renderer/land/presets.js`:

```js
// Lighting presets shared by every reservoir: hand-tuned rather than a free time-of-day, so
// each can be made to look right. Scene axes: +x east, +y up, +z south. Radiances are in the
// renderer's HDR units (today's sun was (2.0, 1.83, 1.55), sky fill (.36, .46, .62)).
// skyGain scales the Preetham sky (whose raw brightness falls ~10x from midday to a low sun)
// to those units; see sky() in clearwater.cu.
const unit = (v) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};

export const PRESET_NAMES = ["morning", "midday", "golden"];

export const PRESETS = {
  morning: {
    label: "Morning",
    sun: unit([0.93, 0.28, 0.24]),
    sunColor: [2.2, 1.8, 1.35],
    fill: [0.34, 0.42, 0.56],
    skyGain: 1.3,
    turbidity: 3, rayleigh: 1.2, mieCoefficient: 0.006, mieG: 0.82,
    cloudCoverage: 0.3, cloudDensity: 0.4, cloudScale: 0.0002, cloudSpeed: 0.00002,
    haze: [0.72, 0.72, 0.74], hazeDensity: 0.00024,
    exposure: 0.85,
  },
  midday: {
    label: "Midday",
    sun: unit([0.05, 0.91, 0.41]),
    sunColor: [2.1, 2.0, 1.9],
    fill: [0.36, 0.46, 0.62],
    skyGain: 0.3,
    turbidity: 2.5, rayleigh: 1.0, mieCoefficient: 0.004, mieG: 0.8,
    cloudCoverage: 0.35, cloudDensity: 0.45, cloudScale: 0.0002, cloudSpeed: 0.00002,
    haze: [0.6, 0.7, 0.82], hazeDensity: 0.00016,
    exposure: 0.75,
  },
  golden: {
    label: "Golden hour",
    sun: unit([-0.95, 0.17, 0.26]),
    sunColor: [2.4, 1.55, 0.85],
    fill: [0.3, 0.34, 0.44],
    skyGain: 2.0,
    turbidity: 4, rayleigh: 1.4, mieCoefficient: 0.005, mieG: 0.85,
    cloudCoverage: 0.4, cloudDensity: 0.5, cloudScale: 0.0002, cloudSpeed: 0.00002,
    haze: [0.78, 0.66, 0.55], hazeDensity: 0.0002,
    exposure: 0.85,
  },
};

// Six float4s, read by the shader as `const float4 *light` (see the comment above sky()).
export function presetBuffer(p) {
  return new Float32Array([
    ...p.sun, p.cloudCoverage,
    ...p.sunColor, p.cloudDensity,
    ...p.fill, p.skyGain,
    p.turbidity, p.rayleigh, p.mieCoefficient, p.mieG,
    ...p.haze, p.hazeDensity,
    p.cloudScale, p.cloudSpeed, p.exposure, 0,
  ]);
}

// The requested preset if the bundle offers it, else the bundle's default.
export function choosePreset(requested, profile) {
  const offered = profile?.presets ?? PRESET_NAMES;
  if (requested && offered.includes(requested) && PRESETS[requested]) return requested;
  return profile?.defaultPreset ?? "golden";
}
```

`data/calaveras/land.json` and `data/san_antonio/land.json` (identical):

```json
{
  "biome": "diablo-oak",
  "vegetation": { "density": 1.0, "species": { "coast-live": 0.5, "blue": 0.3, "valley": 0.2 } },
  "grass": { "spring": "green", "summer": "gold" },
  "presets": ["morning", "midday", "golden"],
  "defaultPreset": "golden"
}
```

In `pipeline/validate-bundles.mjs`:
- Add `import { PRESET_NAMES } from "../renderer/land/presets.js";` after the `node:url` import.
- Change `REQUIRED` to add `"land.json"` after `"story.json"`.
- Change the JSON load to also read `land.json`:

```js
  const [terrain, cameras, story, land] = await Promise.all(
    ["terrain.json", "cameras.json", "story.json", "land.json"].map(json),
  );
```

- Before `return errors;` add:

```js
  if (land.biome !== terrain.biome)
    errors.push(`${id}: land.json biome ${land.biome} differs from terrain.json ${terrain.biome}`);
  for (const name of land.presets ?? [])
    if (!PRESET_NAMES.includes(name)) errors.push(`${id}: land.json names unknown preset ${name}`);
  if (!land.presets?.includes(land.defaultPreset))
    errors.push(`${id}: land.json defaultPreset ${land.defaultPreset} is not in its presets`);
```

Ruling recorded here: the spec's example `"biome": "oak-woodland"` becomes `"diablo-oak"`, the name the bundles' `terrain.json` already uses.

- [ ] **Step 4: Run the tests**

Run: `node --test "pipeline/tests/*.test.mjs" && node pipeline/validate-bundles.mjs`
Expected: all pass; `Bundles valid.`

- [ ] **Step 5: Commit**

```bash
git add renderer/land/presets.js pipeline/tests/presets.test.mjs pipeline/tests/validate-bundles.test.mjs pipeline/validate-bundles.mjs data/calaveras/land.json data/san_antonio/land.json
git commit -m "Add lighting presets and per-bundle land profiles"
```

---

### Task 3: Preset lighting and the new sky in the renderer

**Files:**
- Modify: `renderer/clearwater.cu`, `renderer/explore.js`, `Native/main.cu`
- Test: `scripts/verify.mjs`

**Interfaces:**
- Consumes: `PRESETS`, `presetBuffer`, `choosePreset` (Task 2).
- Produces: kernel parameter `const float4 *light` on `render_water` (after `terrain`) and `trace_caustics` (after `photons`); `state.preset` (string); `diag.preset` (string); `applyPreset(name)` inside `explore.js` (used by Task 4); `lightBuf` runtime buffer (24 floats).

- [ ] **Step 1: Write the failing test**

In `scripts/verify.mjs`, right after `assert.equal(noReadback, 0, "render loop must stay GPU resident");` add:

```js
  // Lighting comes from a preset (the bundle's default: golden hour).
  assert.equal(await page.evaluate(() => window.clearwaterDiagnostics.preset), "golden");
```

- [ ] **Step 2: Run to confirm failure**

Run: `node scripts/verify.mjs`
Expected: FAIL — `undefined !== 'golden'`.

- [ ] **Step 3: Shader — light buffer, sky, haze**

In `renderer/clearwater.cu`:

a) Delete the line `__device__ float3 sunDir() { return v3(-.860f, .450f, .240f); }`.

b) Replace the whole `skyHorizon`, `aerial` and `sky` functions (from `__device__ float3 skyHorizon(int season) {` through the closing `}` of `sky`) with:

```cpp
// Preset lighting (renderer/land/presets.js presetBuffer): six float4s.
// L[0] sun direction xyz, cloud coverage · L[1] sun radiance rgb, cloud density
// L[2] sky fill rgb, sky gain · L[3] turbidity, rayleigh, mie coefficient, mie g
// L[4] haze rgb, haze density · L[5] cloud scale, cloud speed, exposure, unused
__device__ float3 lightSun(const float4 *L) { return v3(L[0].x, L[0].y, L[0].z); }
__device__ float3 lightRad(const float4 *L) { return v3(L[1].x, L[1].y, L[1].z); }
__device__ float3 lightFill(const float4 *L) { return v3(L[2].x, L[2].y, L[2].z); }
__device__ float3 lightHaze(const float4 *L) { return v3(L[4].x, L[4].y, L[4].z); }
// Aerial perspective shared by land and water so both recede into the same air.
__device__ float3 aerial(const float4 *L, float3 col, float distance) {
  float haze = 1.0f - expf(-distance * L[4].w);
  return mix3(col, mul(lightHaze(L), 1.05f), haze * .82f);
}
// Signed fbm in about [-1, 1] for the cloud layer; per-octave drift makes clouds billow.
__device__ float cloudFbm(float x, float z, float drift) {
  float r = 0.0f, a = 1.0f;
  for (int i = 0; i < 4; i++) {
    r += a * (2.0f * noise(x, z) - 1.0f);
    a *= .5f;
    x = x * 2.0f + drift;
    z = z * 2.0f + drift;
  }
  return r;
}
// Preetham daylight sky with a drifting cloud layer, ported from three.js SkyMesh (MIT), then
// the painted far ridges beyond the lidar crop. d is a unit view direction.
__device__ float3 sky(const float4 *L, float3 d, int season, float time) {
  float3 sun = lightSun(L);
  float turbidity = L[3].x, rayleigh = L[3].y, mieCoefficient = L[3].z, g = L[3].w;
  float sunE = 1000.0f * fmaxf(0.0f, 1.0f - expf(-(1.6110731556870734f -
                                                  acosf(fminf(fmaxf(sun.y, -1.0f), 1.0f))) /
                                                 1.5f));
  float3 betaR = mul(v3(5.804542996261093e-6f, 1.3562911419845635e-5f, 3.0265902468824876e-5f),
                     rayleigh);
  float3 betaM = mul(v3(1.8399918514433978e14f, 2.7798023919660528e14f, 4.0790479543861094e14f),
                     .434f * .2f * turbidity * 10e-18f * mieCoefficient);
  float zenith = acosf(fmaxf(0.0f, d.y));
  float inv = 1.0f / (cosf(zenith) + .15f * powf(93.885f - zenith * 57.2957795f, -1.253f));
  float3 Fex = exp3(mul(add(mul(betaR, 8.4e3f * inv), mul(betaM, 1.25e3f * inv)), -1.0f));
  float cosT = dot3(d, sun), g2 = g * g;
  float rPhase = .0596831f * (1.0f + powf(cosT * .5f + .5f, 2.0f));
  float mPhase = .0795775f * (1.0f - g2) / powf(1.0f - 2.0f * g * cosT + g2, 1.5f);
  float3 inS = mul(v3((betaR.x * rPhase + betaM.x * mPhase) / (betaR.x + betaM.x),
                      (betaR.y * rPhase + betaM.y * mPhase) / (betaR.y + betaM.y),
                      (betaR.z * rPhase + betaM.z * mPhase) / (betaR.z + betaM.z)),
                   sunE);
  float3 Lin = v3(powf(inS.x * (1.0f - Fex.x), 1.5f), powf(inS.y * (1.0f - Fex.y), 1.5f),
                  powf(inS.z * (1.0f - Fex.z), 1.5f));
  float low = sat(powf(1.0f - sun.y, 5.0f));
  Lin = prod(Lin, mix3(v3(1, 1, 1),
                       v3(sqrtf(inS.x * Fex.x), sqrtf(inS.y * Fex.y), sqrtf(inS.z * Fex.z)), low));
  float3 L0 = mul(Fex, .1f);
  float disc = sat((cosT - .9999566769464484f) * 50000.0f);
  float3 discC = mul(v3(fminf(sunE * Fex.x, 80.0f), fminf(sunE * Fex.y, 80.0f),
                        fminf(sunE * Fex.z, 80.0f)),
                     760.0f * disc);
  float3 col = add(add(mul(add(Lin, L0), .04f), discC), v3(0, .0003f, .00075f));
  if (d.y > 0.0f && L[0].w > 0.0f) {
    // Cloud plane at SkyMesh's default elevation (0.5 -> 0.55).
    float u = d.x / (d.y * .55f) * L[5].x + time * L[5].y,
          w = d.z / (d.y * .55f) * L[5].x + time * L[5].y;
    float cn = sat(cloudFbm(u * 1000.0f, w * 1000.0f, time * L[5].y * 300.0f) * .7f + .5f);
    float region = (2.0f * noise(u * 300.0f, w * 300.0f) - 1.0f) * .37f + .5f;
    float thr = 1.0f - sat(L[0].w + (region - .5f) * .6f);
    float horizon = smooth(0.0f, .06f, d.y);
    float mask = smooth(thr, thr + .3f, cn) * horizon;
    float3 sunC = mul(Fex, sunE * .0088f), amb = add(mul(Lin, .04f), v3(0, .0003f, .00075f));
    float depth = fmaxf(0.0f, cn - thr), beer = expf(-4.0f * depth), powder = 1.0f - beer * beer;
    float shade = lerp(.45f, 1.0f, sat(beer * powder * 2.6f));
    float silver = fminf(3.0f, .51f / powf(1.49f - 1.4f * cosT, 1.5f)),
          edge = mask * (1.0f - mask) * 4.0f;
    float3 cc = mul(add(amb, mul(sunC, shade + silver * edge * .6f)),
                    fmaxf(smooth(-.08f, .3f, sun.y), .03f));
    float alpha = (1.0f - expf(-depth * L[1].w * 12.0f)) * horizon;
    col = sub(col, mul(add(mul(L0, .04f), discC), alpha));
    float3 through = v3(lerp(col.x, cc.x, Fex.x), lerp(col.y, cc.y, Fex.y), lerp(col.z, cc.z, Fex.z));
    col = mix3(col, through, alpha);
  }
  col = mul(col, L[2].w);
  // Distant, hazy ridgelines beyond the lidar crop: two layers at different depths.
  float e = d.y, a = atan2f(d.z, d.x);
  float far = .050f + .018f * sinf(a * 2.0f + .8f) + .012f * sinf(a * 5.0f - .5f) +
              .006f * sinf(a * 11.0f + 2.2f) + .003f * (noise(a * 90.0f, 3.0f) - .5f);
  float nearR = .030f + .014f * sinf(a * 3.0f - 1.3f) + .008f * sinf(a * 8.0f + .4f) +
                .004f * (fbm(a * 40.0f, 1.0f) - .5f);
  float3 hills = mix3(v3(.13f, .20f, .10f), v3(.24f, .20f, .10f), season == 0 ? 0.0f : 1.0f);
  float3 farCol = mix3(hills, lightHaze(L), .72f), nearCol = mix3(hills, lightHaze(L), .52f);
  col = mix3(col, farCol, smooth(far + .0015f, far - .0015f, e));
  return mix3(col, nearCol, smooth(nearR + .0015f, nearR - .0015f, e));
}
```

(`noise`, `fbm`, `smooth`, `sat`, `lerp`, `exp3`, `prod`, `mix3` already exist in the file.)

c) `terrainShadow`: change `__device__ float terrainShadow(const float4 *T, float3 p, int steps) {` to `__device__ float terrainShadow(const float4 *T, float3 p, float3 sun, int steps) {` and delete its first line `  float3 sun = sunDir();`.

d) `terrainShade`: change its signature line `__device__ float3 terrainShade(const float4 *T, float3 p, float3 rd, float distance, int season,` to `__device__ float3 terrainShade(const float4 *T, const float4 *L, float3 p, float3 rd, float distance, int season,`. Inside it:
- `float3 sun = sunDir(), n = terrainNormal(T, p.x, p.z, distance);` → `float3 sun = lightSun(L), n = terrainNormal(T, p.x, p.z, distance);`
- `float shadow = shadowSteps > 0 ? terrainShadow(T, add(p, mul(n, .6f)), shadowSteps) : 1.0f;` → `float shadow = shadowSteps > 0 ? terrainShadow(T, add(p, mul(n, .6f)), sun, shadowSteps) : 1.0f;`
- `float3 sunC = mul(v3(1.30f, 1.18f, 1.00f), 1.55f), skyC = v3(.36f, .46f, .62f),` → `float3 sunC = lightRad(L), skyC = lightFill(L),`
- `return aerial(lit, distance, season);` → `return aerial(L, lit, distance);`

e) `environment`: replace the function with

```cpp
__device__ float3 environment(const float4 *T, const float4 *L, float3 ro, float3 rd, int steps,
                              int season, float time) {
  float t = terrainTrace(T, ro, rd, steps, 16000.0f);
  if (t > 0)
    return terrainShade(T, L, add(ro, mul(rd, t)), rd, t, season, 0, 0.0f, time);
  return sky(L, rd, season, time);
}
```

f) `trace_caustics`: signature `__global__ void trace_caustics(const float4 *surface, unsigned *photons, float depth) {` → `__global__ void trace_caustics(const float4 *surface, unsigned *photons, const float4 *light, float depth) {`; `float3 n = norm(v3(-a.y, 1, -a.z)), sun = sunDir();` → `float3 n = norm(v3(-a.y, 1, -a.z)), sun = lightSun(light);`.

g) `render_water`:
- signature: `const float4 *pebbles, const float4 *terrain, float4 *hdr, int width,` → `const float4 *pebbles, const float4 *terrain, const float4 *light, float4 *hdr, int width,`
- `ro = v3(camX, camY, camZ), sun = sunDir(),` → `ro = v3(camX, camY, camZ), sun = lightSun(light),`
- `SUN = v3(6, 5.4f, 4.44f), col = sky(rd, season);` → `SUN = mul(lightRad(light), 2.9f), col = sky(light, rd, season, time);`
- `col = terrainShade(terrain, add(ro, mul(rd, landT)), rd, landT, season, shadowSteps, treeNear,` → `col = terrainShade(terrain, light, add(ro, mul(rd, landT)), rd, landT, season, shadowSteps, treeNear,`
- `environment(terrain, add(P, v3(0, .3f, 0)), rr, reflectSteps, season, time)` → `environment(terrain, light, add(P, v3(0, .3f, 0)), rr, reflectSteps, season, time)`
- `col = aerial(col, t, season);` → `col = aerial(light, col, t);`

Run: `npm run check` — expect all 20 kernels compile. Any leftover `sunDir`/`skyHorizon` use fails compilation; fix by the same substitutions.

- [ ] **Step 4: Host wiring**

In `renderer/explore.js`:
- Add import: `import { PRESETS, choosePreset, presetBuffer } from "./land/presets.js";`
- In `const state = {`, add `preset: "golden",` after `quality: 2,`.
- Add `lightBuf,` and `landProfile = null,` to the big `let rt, …` list (before `governor = null,`).
- Add near `updateGpu()`:

```js
// Lighting preset: the shader reads six float4s (sun, radiance, fill, sky, haze, clouds).
function applyPreset(name) {
  state.preset = choosePreset(name, landProfile);
  const p = PRESETS[state.preset];
  rt.write(lightBuf, presetBuffer(p));
  $("exposure").value = String(p.exposure);
  $("exposure").dispatchEvent(new Event("input"));
  diag.preset = state.preset;
}
```

- In the startup block, right after `terrainCells = rt.createBuffer(terrain.gpuCells());` add:

```js
  landProfile = await (await fetch(new URL("land.json", bundleBase))).json();
  lightBuf = rt.createBuffer(24 * 4);
  applyPreset(q.get("preset"));
```

- In `render()`: `k.trace_caustics.bind({ surface, photons }, { depth: +$("depth").value })` → `k.trace_caustics.bind({ surface, photons, light: lightBuf }, { depth: +$("depth").value })`; in the `render_water.bind` resources object add `light: lightBuf,` after `terrain: terrainCells,`.

If `$("exposure")` has no `input` listener that updates its readout, the `dispatchEvent` is harmless; keep it.

In `Native/main.cu`:
- Member list: `ripNormals,caustics,pebbles,terrain,hdr,` → `ripNormals,caustics,pebbles,terrain,light,hdr,`
- In `initGpu()`, right after `decodeTerrain();` insert `decodeLight();` and add this method before `void transform(`:

```cpp
 // Golden-hour preset (renderer/land/presets.js presetBuffer): the native host keeps one light.
 void decodeLight(){
  const float golden[24]={-0.9416f,0.1685f,0.2577f,0.4f, 2.4f,1.55f,0.85f,0.5f, 0.3f,0.34f,0.44f,2.0f,
   4.0f,1.4f,0.005f,0.85f, 0.78f,0.66f,0.55f,0.0002f, 0.0002f,0.00002f,0.85f,0.0f};
  light.alloc(6);check(cudaMemcpy(light.p,golden,sizeof golden,cudaMemcpyHostToDevice));
 }
```

- `trace_caustics<<<dim3(128,128,1),block>>>(surface.p,photons.p,depth)` → `trace_caustics<<<dim3(128,128,1),block>>>(surface.p,photons.p,light.p,depth)`
- in the `render_water<<<grid,block>>>(…)` call: `terrain.p,hdr.p,` → `terrain.p,light.p,hdr.p,`

(The native host is not built in this plan; `npm run check` compiles the shared `.cu` for WebGPU.)

- [ ] **Step 5: Run and calibrate by eye**

Run: `node scripts/verify.mjs`
Expected: PASS (preset `golden`, FFT/caustics/readback/tier checks unchanged).

Screenshot `renderer/explore.html?quality=high&preset=golden`, `…preset=midday`, `…preset=morning` (overlook, 1440×900) with a throwaway Playwright script in the scratchpad; read the PNGs. The sky 45° up should read as a clear mid-blue comparable to `previews/calaveras-overlook.png` (golden warmer near the sun, midday deeper blue); clouds visible and soft. If a preset's sky is washed out or dark, scale only that preset's `skyGain` in `presets.js` (and the golden value in `Native/main.cu` if golden changes) and re-shoot. Record the final gains in the commit message.

- [ ] **Step 6: Commit**

```bash
git add renderer/clearwater.cu renderer/explore.js Native/main.cu scripts/verify.mjs previews
git commit -m "Light the scene from presets; Preetham sky with drifting clouds"
```

---

### Task 4: Preset picker (explore and journey)

**Files:**
- Modify: `renderer/explore.html`, `renderer/explore.js`, `index.html`, `site/journey.js`, `site/journey.css`
- Test: `scripts/verify.mjs`, `scripts/verify-site.mjs`

**Interfaces:**
- Consumes: `applyPreset(name)` (Task 3), `PRESETS`, `PRESET_NAMES`.
- Produces: `<select id="preset">` on the explore page; `?preset=` URL parameter (explore and journey, forwarded to the live iframe); message `{ type: "waterscape:preset", name }` from the journey to the live iframe; journey `<select id="livePreset">` shown only in live mode.

- [ ] **Step 1: Write the failing tests**

In `scripts/verify.mjs`, after the Task 3 preset assertion add:

```js
  await page.selectOption("#preset", "midday");
  assert.equal(await page.evaluate(() => window.clearwaterDiagnostics.preset), "midday");
  await page.selectOption("#preset", "golden");
```

In `scripts/verify-site.mjs`, right after the Task-5 block that waits for `#slowNotice` to be visible, add:

```js
  // Presets: the journey offers them in live mode and forwards the choice to the renderer.
  assert.equal(await live.isVisible("#livePreset"), true);
  await live.selectOption("#livePreset", "midday");
  await frame.waitForFunction(() => window.clearwaterDiagnostics?.preset === "midday");
```

- [ ] **Step 2: Run to confirm failure**

Run: `node scripts/verify.mjs`
Expected: FAIL — no `#preset` element.

- [ ] **Step 3: Implement**

`renderer/explore.html`: inside the panel row that holds the Season select, add a sibling label after the Season `<label>…</label>`:

```html
<label>Light<select id="preset">
  <option value="morning">Morning</option>
  <option value="midday">Midday</option>
  <option value="golden">Golden hour</option>
</select></label>
```

`renderer/explore.js`:
- After `applyPreset(q.get("preset"));` (Task 3) add:

```js
  // Only the presets this reservoir offers, default selected.
  for (const opt of [...$("preset").options]) opt.hidden = !landProfile.presets.includes(opt.value);
  $("preset").value = state.preset;
  $("preset").onchange = () => applyPreset($("preset").value);
```

- In the existing `addEventListener("message", …)` handler if one exists, else add at top level:

```js
// The journey's live view picks presets from outside the iframe.
addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.data?.type !== "waterscape:preset" || !lightBuf) return;
  applyPreset(e.data.name);
  $("preset").value = state.preset;
});
```

`index.html`: after `><button id="explore" hidden>Explore in 3D</button` insert `><select id="livePreset" hidden aria-label="Light"><option value="morning">Morning</option><option value="midday">Midday</option><option value="golden" selected>Golden hour</option></select` so the buttons stay whitespace-free.

`site/journey.js`:
- In `enterLive()`, change the `frame.src` expression's last line to also forward the preset:

```js
    (forcedQuality ? `&quality=${encodeURIComponent(forcedQuality)}` : "") +
    `&preset=${encodeURIComponent($("livePreset").value)}`;
```

  and after `$("slowNotice").hidden = true;` add `$("livePreset").hidden = false;`.
- In `leaveLive()`, after `$("slowNotice").hidden = true;` add `$("livePreset").hidden = true;`.
- At startup (next to the other `$(…).onclick` wiring), add:

```js
$("livePreset").value = new URLSearchParams(location.search).get("preset") || "golden";
$("livePreset").onchange = () =>
  $("liveFrame")?.contentWindow.postMessage(
    { type: "waterscape:preset", name: $("livePreset").value },
    location.origin,
  );
```

`site/journey.css`: append

```css
#livePreset {
  margin-left: 6px;
  font: inherit;
  padding: 6px 8px;
}
```

- [ ] **Step 4: Run the checks**

Run: `node scripts/verify.mjs && node scripts/verify-site.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add renderer/explore.html renderer/explore.js index.html site/journey.js site/journey.css scripts/verify.mjs scripts/verify-site.mjs previews
git commit -m "Pick the light: presets on the explore page and in the journey's live view"
```

---

### Task 5: three.js land pass on the shared device

**Files:**
- Create: `renderer/land/terrain-mesh.js`, `renderer/land/pack.js`, `renderer/land/scene.js`, `pipeline/tests/terrain-mesh.test.mjs`
- Modify: `renderer/clearwater.cu` (`render_water`), `renderer/explore.js`, `Native/main.cu`
- Test: `scripts/verify.mjs`

**Interfaces:**
- Consumes: `Terrain` (`width`, `height`, `cell`, `x0`, `z0`, `sample(x, z, 0)`, `shoreDistance(x, z)`) from `renderer/terrain.js`; the runtime (`rt.device`, `rt.createBuffer`, `rt.destroyBuffer`, resource `.gpuBuffer`).
- Produces:
  - `buildTerrainGrid(terrain, { sink = 30, skirt = 200 } = {}) → { positions: Float32Array, indices: Uint32Array, count }` — lidar grid plus a one-cell border ring dropped by `skirt`; offshore points on a 1:3 bank down to `-sink`.
  - `createPack(device) → { run(colorTexture, depthTexture, gpuBuffer, width, height, near, far) }`
  - `createLandPass(rt, terrain) → Promise<{ shared: boolean, buffer, resize(width, height), render(state) }>`; `buffer` holds `width*height` float4: rgb = three's colour, w = −(distance along the pixel's ray) for land, 0 for sky.
  - Kernel `render_water` gains `const float4 *land` (after `light`) and `int landPass` (last).
  - `diag.land = { shared, error }`.

- [ ] **Step 1: Write the failing tests**

`pipeline/tests/terrain-mesh.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTerrainGrid } from "../../renderer/land/terrain-mesh.js";

// 3 x 2 grid, 10 m cells, heights 100 + x + z; the point (10, 0) is 6 m offshore.
const terrain = {
  width: 3, height: 2, cell: 10, x0: 0, z0: 0,
  sample: (x, z) => 100 + x + z,
  shoreDistance: (x, z) => (x === 10 && z === 0 ? -6 : 5),
};
const at = (g, i, j) => {
  const k = (j * (terrain.width + 2) + i) * 3;
  return [...g.positions.slice(k, k + 3)];
};

test("grid points follow the lidar; offshore sinks on a 1:3 bank; border drops", () => {
  const g = buildTerrainGrid(terrain);
  assert.equal(g.count, 5 * 4);
  assert.deepEqual(at(g, 3, 2), [20, 130, 10]); // grid (2, 1)
  assert.deepEqual(at(g, 2, 1), [10, -2, 0]); // grid (1, 0), 6 m offshore -> -2
  assert.deepEqual(at(g, 0, 0), [-10, -100, -10]); // border: edge height 100 minus 200
  assert.equal(g.indices.length, 4 * 3 * 6);
  assert.ok(g.indices.every((i) => i < g.count));
});
```

In `scripts/verify.mjs`, after the Task 4 preset lines add:

```js
  // Land comes from three.js on the runtime's own device.
  const land = await page.evaluate(() => window.clearwaterDiagnostics.land);
  assert.equal(land?.shared, true, JSON.stringify(land));
  // Resolution changes resize the land pass with the frame buffers (Review Focus 1).
  const before = await page.evaluate(() => window.clearwaterDiagnostics.frames);
  await page.selectOption("#quality", "768");
  await page.waitForFunction((n) => window.clearwaterDiagnostics.frames > n + 10, before);
  await page.selectOption("#quality", "1152");
  // Far outside the lidar crop the sky and far ridges still render (Review Focus 2).
  await page.evaluate(() => Object.assign(window.clearwaterLab.state, { x: 20000, z: 20000, y: 400 }));
  const far = await page.evaluate(() => window.clearwaterDiagnostics.frames);
  await page.waitForFunction((n) => window.clearwaterDiagnostics.frames > n + 5, far);
  assert.deepEqual(await page.evaluate(() => window.clearwaterDiagnostics.errors), []);
```

Place this block **after** every screenshot the main page takes (search `page.screenshot(`) so the teleport doesn't change the previews.

- [ ] **Step 2: Run to confirm failure**

Run: `node --test pipeline/tests/terrain-mesh.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: The mesh**

`renderer/land/terrain-mesh.js`:

```js
// The whole lidar grid as one triangle mesh for three.js (~1M vertices at 10 m), built once.
// Offshore it falls on a 1:3 bank (like the shader's bed) to `sink` metres, so the water
// surface is always nearer than the land behind it. A one-cell border ring drops by `skirt`
// so the crop's edge never shows a gap against the sky's painted ridges.
export function buildTerrainGrid(terrain, { sink = 30, skirt = 200 } = {}) {
  const { width: w, height: h, cell, x0, z0 } = terrain,
    W = w + 2,
    H = h + 2,
    positions = new Float32Array(W * H * 3);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const gi = Math.min(Math.max(i - 1, 0), w - 1),
        gj = Math.min(Math.max(j - 1, 0), h - 1),
        border = gi !== i - 1 || gj !== j - 1,
        gx = x0 + gi * cell,
        gz = z0 + gj * cell,
        shore = terrain.shoreDistance(gx, gz),
        y = shore < 0 ? -Math.min(sink, -shore / 3) : terrain.sample(gx, gz, 0),
        k = (j * W + i) * 3;
      positions[k] = x0 + (i - 1) * cell;
      positions[k + 1] = border ? y - skirt : y;
      positions[k + 2] = z0 + (j - 1) * cell;
    }
  const indices = new Uint32Array((W - 1) * (H - 1) * 6);
  let n = 0;
  for (let j = 0; j < H - 1; j++)
    for (let i = 0; i < W - 1; i++) {
      const a = j * W + i;
      indices.set([a, a + W, a + 1, a + 1, a + W, a + W + 1], n);
      n += 6;
    }
  return { positions, indices, count: W * H };
}
```

Run: `node --test pipeline/tests/terrain-mesh.test.mjs` — Expected: PASS.

- [ ] **Step 4: The pack pass**

`renderer/land/pack.js`:

```js
// Turns three.js's land render (colour + depth) into the float4-per-pixel buffer the water
// kernel reads: rgb = colour, w = -(distance along the pixel's camera ray), 0 where no land.
// The ray matches ray() in clearwater.cu (vertical half-FOV atan(0.62487)).
const WGSL = /* wgsl */ `
@group(0) @binding(0) var colorTex: texture_2d<f32>;
@group(0) @binding(1) var depthTex: texture_depth_2d;
@group(0) @binding(2) var<storage, read_write> land: array<vec4f>;
struct Params { width: u32, height: u32, near: f32, far: f32 }
@group(0) @binding(3) var<uniform> p: Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= p.width || id.y >= p.height) { return; }
  let d = textureLoad(depthTex, vec2i(id.xy), 0);
  let c = textureLoad(colorTex, vec2i(id.xy), 0);
  var w = 0.0;
  if (d < 1.0) {
    // WebGPU depth in [0, 1], not reversed: view depth, then distance along the ray.
    let zv = p.near * p.far / (p.far - d * (p.far - p.near));
    let sx = 2.0 * (f32(id.x) + 0.5) / f32(p.width) - 1.0;
    let sy = 1.0 - 2.0 * (f32(id.y) + 0.5) / f32(p.height);
    let a = f32(p.width) / f32(p.height);
    let len = sqrt(1.0 + (sx * a * 0.62487) * (sx * a * 0.62487) + (sy * 0.62487) * (sy * 0.62487));
    w = -zv * len;
  }
  land[id.y * p.width + id.x] = vec4f(c.rgb, w);
}`;

export function createPack(device) {
  const pipeline = device.createComputePipeline({
      label: "land pack",
      layout: "auto",
      compute: { module: device.createShaderModule({ code: WGSL }), entryPoint: "main" },
    }),
    params = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
    words = new ArrayBuffer(16);
  return {
    run(colorTexture, depthTexture, gpuBuffer, width, height, near, far) {
      new Uint32Array(words, 0, 2).set([width, height]);
      new Float32Array(words, 8, 2).set([near, far]);
      device.queue.writeBuffer(params, 0, words);
      // three.js may recreate its textures on resize, so bind them fresh each frame.
      const bind = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: colorTexture.createView() },
            { binding: 1, resource: depthTexture.createView() },
            { binding: 2, resource: { buffer: gpuBuffer } },
            { binding: 3, resource: { buffer: params } },
          ],
        }),
        enc = device.createCommandEncoder({ label: "land pack" }),
        pass = enc.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind);
      pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
      pass.end();
      device.queue.submit([enc.finish()]);
    },
  };
}
```

- [ ] **Step 5: The land scene**

`renderer/land/scene.js`:

```js
// Land pass: three.js draws the lidar terrain on the CUDA WebShader runtime's own GPUDevice,
// then pack.js hands the water kernel a per-pixel land distance. Foundation only: the land's
// colour is still shaded by the kernel (terrainShade), so the mesh material is plain black.
import * as THREE from "../../vendor/three/three.webgpu.js";
import { buildTerrainGrid } from "./terrain-mesh.js";
import { createPack } from "./pack.js";

const NEAR = 1,
  FAR = 40000,
  // Same vertical field of view as ray() in clearwater.cu.
  FOV_Y = (2 * Math.atan(0.62487) * 180) / Math.PI;

export async function createLandPass(rt, terrain) {
  const renderer = new THREE.WebGPURenderer({
    canvas: document.createElement("canvas"),
    device: rt.device,
    antialias: false,
  });
  await renderer.init();
  const shared = renderer.backend.device === rt.device;

  const grid = buildTerrainGrid(terrain),
    geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(grid.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1));
  geometry.computeBoundingSphere();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicNodeMaterial({ color: 0x000000 })));

  const camera = new THREE.PerspectiveCamera(FOV_Y, 1, NEAR, FAR);
  camera.rotation.order = "YXZ";
  const pack = createPack(rt.device);
  let target = null,
    buffer = null,
    width = 0,
    height = 0;

  return {
    shared,
    get buffer() {
      return buffer;
    },
    resize(w, h) {
      width = w;
      height = h;
      target?.dispose();
      target = new THREE.RenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true });
      target.depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
      if (buffer) rt.destroyBuffer(buffer);
      buffer = rt.createBuffer(w * h * 16);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    render(state) {
      // Our yaw turns the forward vector (sin yaw, ., -cos yaw); three's camera looks down -z.
      camera.position.set(state.x, state.y, state.z);
      camera.rotation.set(state.pitch, -state.yaw, 0);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const tex = (t) => renderer.backend.get(t).texture;
      pack.run(tex(target.texture), tex(target.depthTexture), buffer.gpuBuffer, width, height, NEAR, FAR);
    },
  };
}
```

- [ ] **Step 6: The kernel reads land distance**

In `renderer/clearwater.cu`, `render_water`:
- signature: `const float4 *pebbles, const float4 *terrain, const float4 *light, float4 *hdr, int width,` → `const float4 *pebbles, const float4 *terrain, const float4 *light, const float4 *land, float4 *hdr, int width,` and the last line `int quality) {` → `int quality, int landPass) {`
- replace `  float landT = terrainTrace(terrain, ro, rd, traceSteps, 16000.0f);` with

```cpp
  // Land along this pixel: from three.js's land pass (w < 0: land at -w, 0: sky), or, in the
  // native host, today's height-field trace. Snap to the shader's surface, which adds
  // sub-grid relief the mesh lacks, so shading and shadows start on the ground.
  float landT = -1.0f;
  if (landPass) {
    float w = land[iy * width + ix].w;
    landT = w < 0.0f ? -w : -1.0f;
  } else
    landT = terrainTrace(terrain, ro, rd, traceSteps, 16000.0f);
```

- replace the two-line block that follows it

```cpp
  if (landT > 0)
    col = terrainShade(terrain, light, add(ro, mul(rd, landT)), rd, landT, season, shadowSteps, treeNear,
                       time);
```

  with

```cpp
  if (landT > 0) {
    float3 lp = add(ro, mul(rd, landT));
    lp.y = terrainHeight(terrain, lp.x, lp.z);
    col = terrainShade(terrain, light, lp, rd, landT, season, shadowSteps, treeNear, time);
  }
```

In `Native/main.cu`, in the `render_water<<<grid,block>>>(…)` call: `terrain.p,light.p,hdr.p,` → `terrain.p,light.p,terrain.p,hdr.p,` (unused land) and the final `view,0,2);` → `view,0,2,0);`.

Run: `npm run check` — expect 20 kernels compile.

- [ ] **Step 7: Wire it into explore.js**

- Add import: `import { createLandPass } from "./land/scene.js";`
- Add `landPass = null,` to the `let rt, …` list.
- In `resize()`, after `pixels = rt.createBuffer(width * height * 4);` add `landPass?.resize(width, height);`.
- In the startup block, after `applyPreset(q.get("preset"));` (and the Task 4 picker lines) add:

```js
  // Land from three.js on our device; if it cannot start, keep today's traced land.
  try {
    landPass = await createLandPass(rt, terrain);
    diag.land = { shared: landPass.shared, error: null };
  } catch (e) {
    landPass = null;
    diag.land = { shared: false, error: String(e) };
  }
```

  Make sure this runs before the first `resize()` call; if the first resize has already happened at that point, call `landPass?.resize(width, height)` right after creating it.
- In `render()`, as its first statement add `landPass?.render(state);`, and in the `render_water.bind` resources add `land: landPass ? landPass.buffer : terrainCells,` after `light: lightBuf,`, and in its uniforms add `landPass: landPass ? 1 : 0,` after `quality: state.quality,`.

- [ ] **Step 8: Run everything, then look**

Run: `node --test "pipeline/tests/*.test.mjs" && npm run check && npm test && npm run build`
Expected: all pass, `Bundles valid.`, `Journey checks passed.`; `dist/vendor/three/three.webgpu.js` exists. Note `tiers.lowMedianMs` from `previews/verification.json`.

Measure on Intel with the existing throwaway approach (`--force_low_power_gpu`, `?quality=low` at 768 px, `medium` and `high` at 1152 px, median of 40 samples of `diag.frameMs`); expected at or below the pre-change numbers (low 30.3, medium 66.8, high 75 ms), since the per-pixel terrain trace is gone.

Screenshots (Playwright, scratchpad script, 1440×900, `?quality=high`): the three viewpoints (North ridge, West ridge, Shoreline) at `preset=golden`, plus North ridge at `midday` and `morning`, plus the knee-height pose used in the spike (`yaw + 0.55`, 140 m in, 1.6 m up). Read every PNG. Check: land silhouettes line up with the sky (no gaps or halo at ridgelines), the shoreline has no dark fringe and no flicker between frames, water reflections still show hills, nothing looks worse than before this plan.

- [ ] **Step 9: Commit**

```bash
git add renderer/land renderer/clearwater.cu renderer/explore.js Native/main.cu pipeline/tests/terrain-mesh.test.mjs scripts/verify.mjs previews
git commit -m "Render land with three.js on the shared device; the water kernel reads its distance

three.js draws the lidar mesh; a WGSL pass packs depth into distance along each
pixel's ray; render_water uses it instead of the per-pixel height-field trace
(landPass 1). Falls back to the trace if three.js cannot start. Native keeps
the trace (landPass 0)."
```

---

### Task 6: Document it

**Files:**
- Modify: `README.md`, `HANDOFF.md` (if it describes the renderer's land)

- [ ] **Step 1: Update the docs**

In `README.md`, after the "Live 3D adapts its quality automatically…" paragraph, add:

```markdown
Land is drawn by three.js (vendored in `vendor/three/`, r186) on the same WebGPU device as the CUDA water: it renders the lidar terrain mesh, and a small pass hands the water shader each pixel's distance to the land, so the shader no longer ray-marches the terrain for the camera. Light comes from three presets — Morning, Midday and Golden hour (`renderer/land/presets.js`) — which set the sun, a Preetham sky with drifting clouds (ported from three.js `SkyMesh`), fill light and haze. Each reservoir's `data/<id>/land.json` lists the presets it offers and its default. `node scripts/vendor-three.mjs` refreshes the vendored copy after changing the pinned version in `package.json`.
```

- [ ] **Step 2: Verify and commit**

Run: `npm test`
Expected: PASS.

```bash
git add README.md HANDOFF.md
git commit -m "Document the land pass and lighting presets"
```
