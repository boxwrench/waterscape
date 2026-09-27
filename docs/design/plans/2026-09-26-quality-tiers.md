# Quality Tiers and GPU Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live 3D picks and adapts a quality level automatically, shows which GPU it is running on, and tells visitors on integrated graphics how to give the browser their faster GPU; the journey's "struggling" notice appears only when even the lowest level is too slow.

**Architecture:** The CUDA renderer gains an integer `quality` tier (0 low, 1 medium, 2 high = today) that scales its step budgets. A small pure module (`renderer/quality.js`) owns the level ladder (tier × render width) and a frame-time governor; `renderer/explore.js` feeds it frame times, applies its decisions, shows a GPU chip and tip, and reports `tier`/`struggling` in its frame messages. The journey reacts to `struggling` instead of computing its own median.

**Tech Stack:** CUDA source compiled to WGSL by the vendored cuda-webshader; vanilla ES modules; Node 24 `node:test`; Playwright with Microsoft Edge.

**Spec:** `docs/superpowers/specs/2026-09-26-land-and-scene-design.md` (sub-project 1 only). Parent constraints: `docs/superpowers/specs/2026-09-26-waterscape-design.md`.

## Global Constraints

- Tiers: `quality` 0 low, 1 medium, 2 high; **high equals today's settings**; low must reach **≤ 33 ms/frame at 768 px wide** on this laptop's Intel Xe-LPG.
- Starting tier: `adapter.info.vendor === "nvidia"` starts at high; every other vendor (intel, amd, apple, unknown) starts at medium.
- Governor: after the first frame, measure ~2 s; median > 33 ms → step down a level (tier, then resolution); median < 16 ms for 4 s at a lower level → step up **once**. `?quality=low|medium|high` forces a tier (no automatic changes).
- The journey's struggling notice appears only when the lowest level's median is still above 60 ms.
- GPU chip in 3D mode (journey live view and explore page) shows vendor/architecture and tier. The tip shows when vendor is `intel` or the tier is low, with exactly this text: "Running on integrated graphics. If this computer has a faster graphics card, let your browser use it:" followed by two collapsible instructions — "Windows: Settings → System → Display → Graphics → your browser → Options → High performance, then fully quit and reopen the browser." and "Chrome or Edge: open chrome://flags (or edge://flags), search "high performance GPU", enable it, relaunch." Dismissable, remembered in localStorage (wrapped in try/catch).
- Static site; no external browser imports (build rejects them). Flyover videos render at `quality=high`.
- Work in `C:\github\waterscape` on a feature branch (not `main`); commit per task; never push.

---

### Task 1: `quality` tier in the renderer

**Files:**
- Modify: `renderer/clearwater.cu` (`terrainShade` signature and its two `distance < 260.0f` tests; `environment`'s call; `render_water` signature and body)
- Modify: `renderer/explore.js` (state, `?quality=` parsing, kernel binding)
- Modify: `Native/main.cu` (`render_water` call)
- Test: `scripts/verify.mjs`

**Interfaces:**
- Produces: kernel parameter `quality` (int 0–2) on `render_water`; `window.clearwaterLab.state.quality` (int); `window.clearwaterDiagnostics.quality = { tier, width, auto, vendor }` (in this task `auto` is always `false`; Task 3 adds the governor). URL `?quality=low|medium|high` forces the tier; without it the tier is 2 in this task.

- [ ] **Step 1: Write the failing tests**

In `scripts/verify.mjs`, change the main page load `await page.goto(\`${base}/renderer/explore.html\`);` to

```js
  // The main suite pins today's settings; automatic quality has its own checks below.
  await page.goto(`${base}/renderer/explore.html?quality=high`);
```

Just before `const result = {`, add:

```js
  // Forced tiers render and report themselves; low meets its frame budget at 768 px.
  const tiers = {};
  for (const [name, tier] of [["low", 0], ["medium", 1], ["high", 2]]) {
    const tp = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await tp.goto(`${base}/renderer/explore.html?quality=${name}`);
    await tp.waitForFunction(() => window.clearwaterDiagnostics?.ready, null, { timeout: 120000 });
    const q = await tp.evaluate(() => window.clearwaterDiagnostics.quality);
    assert.equal(q.tier, tier, JSON.stringify(q));
    assert.equal(await tp.evaluate(() => window.clearwaterLab.state.quality), tier);
    if (name === "low") {
      await tp.selectOption("#quality", "768");
      await tp.waitForFunction(() => window.clearwaterDiagnostics.width === 768);
      await tp.waitForTimeout(1500);
      const samples = [];
      for (let i = 0; i < 40; i++) {
        samples.push(await tp.evaluate(() => window.clearwaterDiagnostics.frameMs));
        await tp.waitForTimeout(50);
      }
      samples.sort((a, b) => a - b);
      tiers.lowMedianMs = samples[samples.length >> 1];
      assert.ok(tiers.lowMedianMs <= 33, `low tier median ${tiers.lowMedianMs} ms > 33 ms at 768 px`);
    }
    await tp.close();
  }
```

and add `tiers,` to the `result` object (after `readout,`).

- [ ] **Step 2: Run to confirm failure**

Run: `node scripts/verify.mjs`
Expected: FAIL — `window.clearwaterDiagnostics.quality` is undefined (TypeError reading `tier`).

- [ ] **Step 3: Add the tier to the shader**

In `renderer/clearwater.cu`, change the `terrainShade` signature

```cpp
__device__ float3 terrainShade(const float4 *T, float3 p, float3 rd, float distance, int season,
                               int shadowSteps, float time) {
```

to

```cpp
// treeNear: distance within which trees get individual 3D crown tests (0 = never; reflections).
__device__ float3 terrainShade(const float4 *T, float3 p, float3 rd, float distance, int season,
                               int shadowSteps, float treeNear, float time) {
```

Inside `terrainShade`, replace both occurrences of `distance < 260.0f` with `distance < treeNear`.

In `environment`, replace `return terrainShade(T, add(ro, mul(rd, t)), rd, t, season, 0, time);` with

```cpp
    return terrainShade(T, add(ro, mul(rd, t)), rd, t, season, 0, 0.0f, time);
```

Change the end of the `render_water` signature from `float centerZ, float depth, float time, int view, int season) {` to

```cpp
                             float centerZ, float depth, float time, int view, int season,
                             int quality) {
```

Immediately after the line that computes `sx`/`sy` in `render_water` (the first statement after the bounds `return`), add:

```cpp
  // Quality tier (0 low, 1 medium, 2 high = the original budgets): scales the costliest loops.
  int traceSteps = quality >= 2 ? 128 : (quality == 1 ? 96 : 64),
      shadowSteps = quality >= 2 ? 10 : (quality == 1 ? 6 : 0),
      reflectSteps = quality >= 2 ? 24 : (quality == 1 ? 16 : 10);
  float treeNear = quality >= 2 ? 260.0f : (quality == 1 ? 160.0f : 80.0f);
```

Replace `float landT = terrainTrace(terrain, ro, rd, 128, 16000.0f);` with `float landT = terrainTrace(terrain, ro, rd, traceSteps, 16000.0f);`.

Replace `col = terrainShade(terrain, add(ro, mul(rd, landT)), rd, landT, season, 10, time);` with

```cpp
    col = terrainShade(terrain, add(ro, mul(rd, landT)), rd, landT, season, shadowSteps, treeNear,
                       time);
```

Replace `environment(terrain, add(P, v3(0, .3f, 0)), rr, 24, season, time)` with `environment(terrain, add(P, v3(0, .3f, 0)), rr, reflectSteps, season, time)`.

Run: `npm run check` — expect all 20 kernels compile.

- [ ] **Step 4: Plumb it through the host**

In `renderer/explore.js`, in `const state = {`, add `quality: 2,` after `speed: 40,`.

In the startup `try` block, right after `rt = await GpuRuntime.create({ onError: fail });`, add:

```js
  const vendor = rt.describe().vendor;
  const forcedQuality = ["low", "medium", "high"].indexOf(q.get("quality"));
  if (forcedQuality >= 0) state.quality = forcedQuality;
  diag.quality = { tier: state.quality, width: +$("quality").value, auto: false, vendor };
```

In the frame loop, right after `diag.frameMs = performance.now() - start;`, add:

```js
      diag.quality.tier = state.quality;
      diag.quality.width = width;
```

In `render()`, in the `render_water.bind(...)` uniforms object, add `quality: state.quality,` after `season: +$("season").value,`.

In `Native/main.cu`, in the `render_water<<<grid,block>>>(…)` call, replace the final `view,0);` with `view,0,2);` (native keeps the high tier).

- [ ] **Step 5: Calibrate the low tier**

Run: `node scripts/verify.mjs`. If it fails only on `low tier median … > 33 ms`, lower the low-tier numbers (the `quality == 0` branches in Step 3) in this order, re-running after each: `reflectSteps` 10→6; `traceSteps` 64→48; `treeNear` 80→40. Stop at the first setting that passes. Do not change medium or high. If all three are exhausted and it still fails, report BLOCKED with the measured medians. Record the final low values and the measured median in the report.

Expected at the end: PASS, `tiers.lowMedianMs` ≤ 33 in `previews/verification.json`; the other checks (FFT, caustics, zero readback, controls) still pass with `?quality=high`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add a quality tier to the renderer

render_water takes quality 0-2 (2 = the original budgets) scaling the
terrain trace, shadow and reflection steps and the near-tree distance.
?quality= forces it; the low tier meets 33 ms at 768 px on Intel Xe."
```

---

### Task 2: Level ladder and frame-time governor

**Files:**
- Create: `renderer/quality.js`
- Test: `pipeline/tests/quality.test.mjs` (matched by the existing `node --test "pipeline/tests/*.test.mjs"` glob)

**Interfaces:**
- Produces (all exported from `renderer/quality.js`):
  - `LEVELS: { tier: number, width: number }[]` = `[{0,768},{0,1152},{1,1152},{2,1152}]`, cheapest first.
  - `TIER_NAMES = ["low", "medium", "high"]`.
  - `startingLevel(vendor: string): number` → index into LEVELS (3 for `"nvidia"`, else 2).
  - `forcedTier(param: string | null): number | null` → 0–2 for a tier name, else `null`.
  - `class QualityGovernor { constructor(level: number); get current(): {tier,width}; level: number; struggling: boolean; sample(ms: number, now: number): {tier,width} | null }` — `sample` returns the new level when it changes, otherwise `null`.
  - `medianOf(values: number[]): number`.

- [ ] **Step 1: Write the failing tests**

`pipeline/tests/quality.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, QualityGovernor, forcedTier, startingLevel } from "../../renderer/quality.js";

// Feed frames of `ms` duration back to back from `start` until `until`; return level changes.
function run(gov, ms, start, until) {
  const changes = [];
  for (let now = start; now < until; now += ms) {
    const next = gov.sample(ms, now);
    if (next) changes.push({ at: now, level: gov.level, ...next });
  }
  return changes;
}

test("starting level: NVIDIA high, everything else medium", () => {
  assert.deepEqual(LEVELS[startingLevel("nvidia")], { tier: 2, width: 1152 });
  for (const v of ["intel", "amd", "apple", "", "not exposed"])
    assert.deepEqual(LEVELS[startingLevel(v)], { tier: 1, width: 1152 });
});

test("forced tier names", () => {
  assert.equal(forcedTier("low"), 0);
  assert.equal(forcedTier("medium"), 1);
  assert.equal(forcedTier("high"), 2);
  assert.equal(forcedTier("ultra"), null);
  assert.equal(forcedTier(null), null);
});

test("slow frames step down one level at a time, after settling and a 2 s window", () => {
  const gov = new QualityGovernor(2);
  assert.deepEqual(run(gov, 40, 0, 2900), [], "no change before 1 s settle + 2 s window");
  const changes = run(gov, 40, 2900, 9000);
  assert.deepEqual(changes.map((c) => c.level), [1, 0]);
  assert.ok(changes[1].at - changes[0].at >= 3000, "each step waits for a fresh window");
  assert.equal(gov.level, 0, "never below the cheapest level");
});

test("fast frames step up once only", () => {
  const gov = new QualityGovernor(1);
  const changes = run(gov, 10, 0, 30000);
  assert.deepEqual(changes.map((c) => c.level), [2]);
});

test("struggling only at the cheapest level above 60 ms", () => {
  const slow = new QualityGovernor(0);
  run(slow, 80, 0, 4000);
  assert.equal(slow.struggling, true);
  const ok = new QualityGovernor(0);
  run(ok, 40, 0, 4000);
  assert.equal(ok.struggling, false, "over budget but not struggling");
  const high = new QualityGovernor(3);
  run(high, 80, 0, 2900);
  assert.equal(high.struggling, false, "not at the cheapest level");
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `node --test "pipeline/tests/*.test.mjs"`
Expected: FAIL — cannot find module `renderer/quality.js`.

- [ ] **Step 3: Implement**

`renderer/quality.js`:

```js
// Automatic quality for the live renderer. A level is a shader tier (0 low, 1 medium,
// 2 high — see render_water in clearwater.cu) at a render width in pixels, cheapest first.
export const LEVELS = [
  { tier: 0, width: 768 },
  { tier: 0, width: 1152 },
  { tier: 1, width: 1152 },
  { tier: 2, width: 1152 },
];
export const TIER_NAMES = ["low", "medium", "high"];

const BUDGET_MS = 33, // over this (median) we step down
  FAST_MS = 16, // under this for UP_WINDOW_MS we may step up once
  STRUGGLE_MS = 60, // over this at the cheapest level the device is struggling
  SETTLE_MS = 1000, // ignore frames right after start or a change (shader warm-up, resize)
  DOWN_WINDOW_MS = 2000,
  UP_WINDOW_MS = 4000;

// Browsers do not say whether a GPU is discrete: NVIDIA starts at high, everything else at medium.
export function startingLevel(vendor) {
  return vendor === "nvidia" ? 3 : 2;
}

export function forcedTier(param) {
  const i = TIER_NAMES.indexOf(param);
  return i < 0 ? null : i;
}

export function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
}

export class QualityGovernor {
  constructor(level) {
    this.level = level;
    this.struggling = false;
    this.steppedUp = false;
    this.samples = [];
    this.since = null;
  }

  get current() {
    return LEVELS[this.level];
  }

  // Feed one frame time (ms) at time `now` (ms); returns the new level when it changes.
  sample(ms, now) {
    if (this.since === null) this.since = now;
    if (now - this.since < SETTLE_MS) return null;
    this.samples.push({ ms, now });
    this.samples = this.samples.filter((s) => now - s.now <= UP_WINDOW_MS);
    const span = now - this.samples[0].now,
      median = medianOf(this.samples.map((s) => s.ms));
    this.struggling = this.level === 0 && span >= DOWN_WINDOW_MS && median > STRUGGLE_MS;
    if (span >= DOWN_WINDOW_MS && median > BUDGET_MS && this.level > 0) return this.#move(-1, now);
    if (span >= UP_WINDOW_MS - 1 && median < FAST_MS && !this.steppedUp && this.level < LEVELS.length - 1) {
      this.steppedUp = true;
      return this.#move(1, now);
    }
    return null;
  }

  #move(step, now) {
    this.level += step;
    this.samples = [];
    this.since = now;
    this.struggling = false;
    return this.current;
  }
}
```

(The `UP_WINDOW_MS - 1` tolerates the window filter keeping samples at most `UP_WINDOW_MS` old.)

- [ ] **Step 4: Run the tests**

Run: `node --test "pipeline/tests/*.test.mjs"`
Expected: all pass (the 7 existing tests plus 5 new).

- [ ] **Step 5: Commit**

```bash
git add renderer/quality.js pipeline/tests/quality.test.mjs
git commit -m "Add the quality level ladder and frame-time governor

Pure module: NVIDIA starts high, others medium; a median over 33 ms
steps down a level, under 16 ms for 4 s steps up once; struggling means
the cheapest level is still over 60 ms."
```

---

### Task 3: Automatic quality in the explore page

**Files:**
- Modify: `renderer/explore.js`
- Modify: `pipeline/render-flyover.mjs` (force `quality=high`)
- Test: `scripts/verify.mjs`

**Interfaces:**
- Consumes: `LEVELS`, `QualityGovernor`, `forcedTier`, `startingLevel` from `renderer/quality.js` (Task 2); `state.quality`, `diag.quality` (Task 1).
- Produces: `diag.quality = { tier, width, auto, vendor, struggling }` kept current every frame; frame messages become `{ type: "waterscape:frame", ms, reservoir, tier, struggling }`. Choosing a resolution in `#quality` turns automatic quality off (`auto: false`).

- [ ] **Step 1: Write the failing tests**

In `scripts/verify.mjs`, extend the existing embed-page block: after `const embedState = await embed.evaluate(...)` and its assertions, add:

```js
  assert.equal(typeof embedState.message.tier, "number");
  assert.equal(typeof embedState.message.struggling, "boolean");
```

Just before `const result = {`, add:

```js
  // Automatic quality: on by default, starts from the vendor, off after a manual resolution pick.
  const auto = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await auto.goto(`${base}/renderer/explore.html`);
  await auto.waitForFunction(() => window.clearwaterDiagnostics?.ready, null, { timeout: 120000 });
  const autoStart = await auto.evaluate(() => ({ ...window.clearwaterDiagnostics.quality }));
  assert.equal(autoStart.auto, true, JSON.stringify(autoStart));
  assert.equal(autoStart.tier, autoStart.vendor === "nvidia" ? 2 : 1, JSON.stringify(autoStart));
  assert.equal(typeof autoStart.struggling, "boolean");
  await auto.selectOption("#quality", "1536");
  assert.equal(await auto.evaluate(() => window.clearwaterDiagnostics.quality.auto), false);
  await auto.close();
```

- [ ] **Step 2: Run to confirm failure**

Run: `node scripts/verify.mjs`
Expected: FAIL — `embedState.message.tier` is undefined (or `autoStart.auto` is false).

- [ ] **Step 3: Wire in the governor**

In `renderer/explore.js`:

Add to the imports:

```js
import { LEVELS, QualityGovernor, forcedTier, startingLevel } from "./quality.js";
```

Add `governor = null,` to the big `let rt, ctx, …` declaration list (before `failed = false,`).

Replace `$("quality").onchange = () => (resizePending = true);` with

```js
$("quality").onchange = () => {
  // A visitor's own resolution choice wins over automatic quality.
  governor = null;
  if (diag.quality) diag.quality.auto = false;
  resizePending = true;
};
```

Replace the startup block added in Task 1

```js
  const vendor = rt.describe().vendor;
  const forcedQuality = ["low", "medium", "high"].indexOf(q.get("quality"));
  if (forcedQuality >= 0) state.quality = forcedQuality;
  diag.quality = { tier: state.quality, width: +$("quality").value, auto: false, vendor };
```

with

```js
  const vendor = rt.describe().vendor,
    forced = forcedTier(q.get("quality"));
  if (forced === null) {
    governor = new QualityGovernor(startingLevel(vendor));
    state.quality = governor.current.tier;
    $("quality").value = String(governor.current.width);
  } else state.quality = forced;
  diag.quality = { tier: state.quality, width: +$("quality").value, auto: !!governor, vendor, struggling: false };
```

Replace the frame-loop lines added in Task 1

```js
      diag.quality.tier = state.quality;
      diag.quality.width = width;
```

with

```js
      if (governor) {
        const next = governor.sample(diag.frameMs, performance.now());
        if (next) {
          state.quality = next.tier;
          $("quality").value = String(next.width);
          resizePending = true;
        }
      }
      Object.assign(diag.quality, {
        tier: state.quality,
        width,
        struggling: !!governor?.struggling,
      });
```

In the frame message (`parent.postMessage({ type: "waterscape:frame", ms: diag.frameMs, reservoir: reservoirId }, location.origin)`), replace the message object with

```js
            {
              type: "waterscape:frame",
              ms: diag.frameMs,
              reservoir: reservoirId,
              tier: state.quality,
              struggling: diag.quality.struggling,
            },
```

`LEVELS` is imported for Task 4's chip text; if your linter complains about an unused import in this task, leave it — Task 4 uses it.

In `pipeline/render-flyover.mjs`, in the `page.goto(...)` URL, replace `&embed=1` with `&embed=1&quality=high` (videos always render at today's settings).

- [ ] **Step 4: Run the checks**

Run: `node --test "pipeline/tests/*.test.mjs" && node scripts/verify.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Adapt live 3D quality automatically

The explore page starts from the GPU vendor's level, steps tier and
resolution with the governor, stops when the visitor picks a resolution,
and reports tier and struggling to the journey. Flyovers render at
quality=high."
```

---

### Task 4: GPU chip and high-performance tip

**Files:**
- Modify: `renderer/explore.html`, `renderer/explore.css`, `renderer/explore.js`
- Test: `scripts/verify.mjs`

**Interfaces:**
- Consumes: `diag.quality` (Tasks 1, 3); `TIER_NAMES` from `renderer/quality.js`.
- Produces: DOM `#gpu` (always visible, including embed mode) containing `#gpuChip` (text `"<vendor> <architecture> · <tier name> · <width> px"`) and `#gpuTip` (hidden unless vendor is `intel` or tier is 0, and not dismissed) with a `#gpuTipDismiss` button; localStorage key `waterscape.gpuTipDismissed` = `"1"` when dismissed.

- [ ] **Step 1: Write the failing test**

In `scripts/verify.mjs`, just before `const result = {`, add:

```js
  // GPU chip everywhere in 3D; the tip on Intel (the test browser's default GPU) until dismissed.
  const gpu = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await gpu.goto(`${base}/renderer/explore.html?embed=1`);
  await gpu.evaluate(() => localStorage.removeItem("waterscape.gpuTipDismissed"));
  await gpu.reload();
  await gpu.waitForFunction(() => window.clearwaterDiagnostics?.ready, null, { timeout: 120000 });
  await gpu.waitForFunction(() => document.getElementById("gpuChip").textContent.includes("·"));
  const gpuState = await gpu.evaluate(() => ({
    chip: document.getElementById("gpuChip").textContent,
    shown: getComputedStyle(document.getElementById("gpu")).display !== "none",
    tip: !document.getElementById("gpuTip").hidden,
    vendor: window.clearwaterDiagnostics.quality.vendor,
    tier: window.clearwaterDiagnostics.quality.tier,
  }));
  assert.ok(gpuState.shown, "chip visible in embed mode");
  assert.ok(gpuState.chip.includes(gpuState.vendor), JSON.stringify(gpuState));
  assert.equal(gpuState.tip, gpuState.vendor === "intel" || gpuState.tier === 0, JSON.stringify(gpuState));
  if (gpuState.tip) {
    assert.match(await gpu.textContent("#gpuTip"), /Running on integrated graphics/);
    assert.match(await gpu.textContent("#gpuTip"), /chrome:\/\/flags/);
    await gpu.click("#gpuTipDismiss");
    assert.equal(await gpu.evaluate(() => document.getElementById("gpuTip").hidden), true);
    await gpu.reload();
    await gpu.waitForFunction(() => window.clearwaterDiagnostics?.ready, null, { timeout: 120000 });
    assert.equal(await gpu.evaluate(() => document.getElementById("gpuTip").hidden), true, "dismissal remembered");
  }
  await gpu.evaluate(() => localStorage.removeItem("waterscape.gpuTipDismissed"));
  await gpu.close();
```

- [ ] **Step 2: Run to confirm failure**

Run: `node scripts/verify.mjs`
Expected: FAIL — `#gpuChip` does not exist (null in `waitForFunction`).

- [ ] **Step 3: Markup and styles**

In `renderer/explore.html`, immediately before `<aside id="survey" class="survey" aria-label="Elevation readout">`, add:

```html
    <aside id="gpu" class="gpu" aria-label="Graphics and quality">
      <span id="gpuChip"></span>
      <div id="gpuTip" hidden>
        <p>Running on integrated graphics. If this computer has a faster graphics card, let your browser use it:</p>
        <details>
          <summary>Windows setting</summary>
          <p>Windows: Settings → System → Display → Graphics → your browser → Options → High performance, then fully quit and reopen the browser.</p>
        </details>
        <details>
          <summary>Chrome or Edge flag</summary>
          <p>Chrome or Edge: open chrome://flags (or edge://flags), search "high performance GPU", enable it, relaunch.</p>
        </details>
        <button id="gpuTipDismiss">Got it</button>
      </div>
    </aside>
```

Append to `renderer/explore.css`:

```css
/* GPU and quality chip: shown in both the explore page and the journey's live view. */
.gpu {
  position: fixed;
  right: 38px;
  bottom: 120px;
  max-width: 300px;
  padding: 8px 12px;
  font-size: 11px;
  background: linear-gradient(130deg, #183f469e, #15363f61);
  backdrop-filter: blur(22px);
  border: 1px solid #ffffff26;
  border-radius: 3px;
}
.gpu p {
  margin: 8px 0;
  line-height: 1.45;
}
.gpu summary {
  cursor: pointer;
}
.gpu button {
  margin-top: 6px;
  font-size: 11px;
  padding: 5px 10px;
}
.embed .gpu {
  right: 16px;
  bottom: 56px;
}
.clean:not(.embed) .gpu {
  display: none;
}
```

- [ ] **Step 4: Behaviour**

In `renderer/explore.js`, change the quality import to also bring in the names:

```js
import { LEVELS, QualityGovernor, TIER_NAMES, forcedTier, startingLevel } from "./quality.js";
```

Remove `LEVELS` from that import if it is still unused after this task (it is not needed for the chip).

Add, near `survey()`:

```js
// GPU chip and the "use your faster GPU" tip (browsers on dual-GPU laptops default to the
// integrated GPU and ignore a page's powerPreference, so only the visitor can change it).
function tipDismissed() {
  try {
    return localStorage.getItem("waterscape.gpuTipDismissed") === "1";
  } catch {
    return false;
  }
}
function updateGpu() {
  const { vendor, tier, width } = diag.quality,
    arch = rt.describe().architecture;
  $("gpuChip").textContent = `${vendor}${arch ? " " + arch : ""} · ${TIER_NAMES[tier]} · ${width} px`;
  $("gpuTip").hidden = tipDismissed() || !(vendor === "intel" || tier === 0);
}
$("gpuTipDismiss").onclick = () => {
  try {
    localStorage.setItem("waterscape.gpuTipDismissed", "1");
  } catch {}
  $("gpuTip").hidden = true;
};
```

Call `updateGpu();` at the end of the startup block that sets `diag.quality` (after the `diag.quality = { … }` line), and inside the frame loop's `if (state.frames % 15 === 0) {` block (after `survey();`).

- [ ] **Step 5: Run the checks and look at it**

Run: `node scripts/verify.mjs`
Expected: PASS.

Visual check: with a throwaway Playwright script in your system temp dir (not the repo), screenshot `/renderer/explore.html` (1440×900) and `/?tier=live` after clicking "Explore in 3D" (1280×800 and 400×800), Read the PNGs, and confirm the chip and tip do not overlap the explore panel, survey card, journey card, system map or credit. Adjust only the `.gpu` / `.embed .gpu` positions if they overlap, and say what you changed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Show the GPU and quality, and how to use a faster GPU

A chip names the adapter and tier in 3D; on Intel graphics (or the low
tier) a dismissable tip explains the Windows graphics setting and the
Chrome/Edge flag, since browsers ignore a page's GPU preference."
```

---

### Task 5: Journey uses the renderer's struggling signal; docs

**Files:**
- Modify: `site/journey.js`
- Modify: `README.md`
- Test: `scripts/verify-site.mjs`

**Interfaces:**
- Consumes: frame messages `{ type: "waterscape:frame", ms, reservoir, tier, struggling }` (Task 3).
- Produces: `#slowNotice` shows only after a frame message with `struggling: true`; the journey forwards its own `?quality=` URL parameter to the live iframe.

- [ ] **Step 1: Write the failing test**

In `scripts/verify-site.mjs`, change the live-tier page load `await live.goto(\`${base}/?tier=live\`);` to

```js
  await live.goto(`${base}/?tier=live&quality=low`);
```

Right after the line `assert.equal(await live.textContent("#explore"), "Back to video");`, add:

```js
  // The journey forwards ?quality= and trusts the renderer's struggling flag, not raw frame times.
  assert.ok((await live.getAttribute("#liveFrame", "src")).includes("quality=low"));
  await frame.evaluate(() =>
    parent.postMessage({ type: "waterscape:frame", ms: 250, reservoir: "calaveras", tier: 0, struggling: false }, location.origin),
  );
  await live.waitForTimeout(300);
  assert.equal(await live.isVisible("#slowNotice"), false, "slow frames alone do not show the notice");
  await frame.evaluate(() =>
    parent.postMessage({ type: "waterscape:frame", ms: 250, reservoir: "calaveras", tier: 0, struggling: true }, location.origin),
  );
  await live.waitForSelector("#slowNotice", { state: "visible" });
```

- [ ] **Step 2: Run to confirm failure**

Run: `node scripts/verify-site.mjs`
Expected: FAIL — the iframe src lacks `quality=low`.

- [ ] **Step 3: Implement**

In `site/journey.js`:

Delete the lines

```js
// Median frame time above this for 2 s means the device should stay on video.
const SLOW_MS = 60;
```

In `enterLive()`, replace

```js
  frame.src =
    `./renderer/explore.html?reservoir=${encodeURIComponent(stop.id)}&embed=1&pose=` +
    [pose.x, pose.y, pose.z, pose.yaw, pose.pitch].map((v) => v.toFixed(3)).join(",");
  state.live = { id: stop.id, pose, frameTimes: [], started: performance.now(), firstFrame: false };
```

with

```js
  const forcedQuality = new URLSearchParams(location.search).get("quality");
  frame.src =
    `./renderer/explore.html?reservoir=${encodeURIComponent(stop.id)}&embed=1&pose=` +
    [pose.x, pose.y, pose.z, pose.yaw, pose.pitch].map((v) => v.toFixed(3)).join(",") +
    (forcedQuality ? `&quality=${encodeURIComponent(forcedQuality)}` : "");
  state.live = { id: stop.id, pose, frameTimes: [], firstFrame: false };
```

In the `message` listener, replace

```js
  const times = state.live.frameTimes;
  times.push(e.data.ms);
  const median = [...times].sort((a, b) => a - b)[times.length >> 1];
  if (performance.now() - state.live.started > 2000 && times.length >= 4 && median > SLOW_MS)
    $("slowNotice").hidden = false;
```

with

```js
  state.live.frameTimes.push(e.data.ms);
  // The renderer already adapts its quality; it says "struggling" only when its cheapest
  // level is still too slow.
  if (e.data.struggling === true) $("slowNotice").hidden = false;
```

In `README.md`, in the section describing the live 3D view (search for "Explore in 3D"), add this paragraph after it:

```markdown
Live 3D adapts its quality automatically: NVIDIA GPUs start at the high tier, others at medium, and the renderer steps its tier and resolution to stay near 30 fps. `?quality=low|medium|high` on the journey or the explore page pins a tier. A chip in 3D names the GPU in use; on laptops with two GPUs, Chrome and Edge give pages the integrated GPU unless the visitor switches the browser to High performance (the chip's tip explains how).
```

- [ ] **Step 4: Full verification**

Run each and confirm:

```bash
node --test "pipeline/tests/*.test.mjs"   # all pass
npm run check                              # 20 kernels
npm test                                   # "Bundles valid.", renderer JSON, "Journey checks passed."
npm run build                              # dist/ includes renderer/quality.js
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Let the renderer decide when a device is struggling

The journey shows its notice only on the renderer's struggling flag and
forwards ?quality= to the live view; README documents automatic quality
and the GPU tip."
```
