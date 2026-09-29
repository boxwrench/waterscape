# Shoreline contact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the straight, grid-aligned waterline with an organic edge that ebbs and flows with the wave energy control, at no measurable frame cost.

**Architecture:** Inside a ±6 m contact zone around the lidar shoreline, `water.cu` models the bank itself (noise-warped shore distance, 1:10 slope, fine relief). The water/land decision there compares surface height (FFT damped by depth, plus an analytic ebb) with that bank, instead of thresholding the shore-distance grid. The same functions drive the land height, the bed seen through water and a wet band on recently covered ground.

**Tech Stack:** CUDA subset compiled to WGSL by the vendored cuda-webshader (`renderer/water.cu`), WebGPU engine (`renderer/engine/waterscape.js`), optional native Windows host (`Native/main.cu`).

**Spec:** `docs/design/specs/2026-09-29-shoreline-contact-design.md`

## Global Constraints

- Permitted edits: `renderer/water.cu`, `renderer/engine/waterscape.js` (pass `energy` only), `Native/main.cu` (append the new argument only), docs. Not `vendor/`, `pipeline/`, bundles, `renderer/land/ground.js`.
- Outside the contact zone (`|shoreDistance| >= 6`) every existing formula must return exactly what it does today.
- Warp amplitude at most 1.5 m. Ebb a few centimetres at the default energy 0.38, period ~5–8 s.
- No new passes, buffers, textures or dispatches. Timing check is light (user request): median `diag.frameMs` at a forced tier, before and after, same view.
- Style: 2-space indent, `f`-suffixed float literals, short comments like the surrounding shader.

## Review Focus

- Land-pass mesh hit in the zone that is a real bank lip in front of water: must still occlude (only ignore the mesh where the ray passes above the shader's own bank).
- Grass blades and tree meshes at the waterline (pack.js kinds 1 and 2): must still occlude water exactly as today.
- Wave energy at the slider minimum (0.10) and maximum (1.60): edge nearly still vs. clearly lapping, never flooding past ~2 m inland.
- Far views (overlook, ridge): the zone is sub-pixel; no shimmer or new seams at the 6 m zone boundary.
- Native host: still compiles with the extra `render_water` argument (cannot be built here; check the call by reading).

There is no shader unit-test harness in this repo. The test cycle for shader tasks is `npm run check` (every kernel compiles to WGSL) plus visual inspection in the explorer.

---

### Task 1: Pass wave energy to the water kernel

**Files:**
- Modify: `renderer/water.cu` (`terrainShade` signature, `environment`, `render_water` signature and its two `terrainShade` calls)
- Modify: `renderer/engine/waterscape.js` (render_water params)
- Modify: `Native/main.cu:122` (append argument)

**Interfaces:**
- Produces: `render_water(..., float meshNear, float energy)`; `terrainShade(..., float time, float energy)`.

- [ ] **Step 1: Add `float energy` as the last parameter of `terrainShade`**

```c
__device__ float3 terrainShade(const float4 *T, const float4 *L, float3 p, float3 rd, float distance, int season,
                               int shadowSteps, float treeNear, const float4 *B, int bakeStride,
                               float4 given, float meshNear, float time, float energy) {
```

- [ ] **Step 2: Reflections pass no ebb** — in `environment`, append `0.0f` to the `terrainShade` call (a wet band in a reflection is not visible):

```c
    return terrainShade(T, L, add(ro, mul(rd, t)), rd, t, season, 0, 0.0f, T, 0,
                        make_float4(0.0f, 0.0f, 0.0f, 0.0f), 0.0f, time, 0.0f);
```

- [ ] **Step 3: Add `float energy` after `float meshNear` in `render_water`**, and append `energy` to the `terrainShade` call at the end of `render_water`:

```c
                             int quality, int landPass, int bakeStride,
                             float meshNear, float energy) {
...
      col = terrainShade(terrain, light, lp, rd, landT, season, shadowSteps, treeNear, baked,
                         bakeStride, given, meshNear, time, energy);
```

- [ ] **Step 4: Engine** — in `renderer/engine/waterscape.js`, render_water params, after `meshNear: landPass?.treeRange ?? 0,` add:

```js
          energy: settings.energy,
```

- [ ] **Step 5: Native** — in `Native/main.cu:122` change the tail `...,0,2,0,0,0.0f);` to `...,0,2,0,0,0.0f,energy);` (`energy` is the host's slider value).

- [ ] **Step 6: Compile** — Run: `npm run check`. Expected: one `<kernel>: N WGSL bytes` line per kernel, no error.

- [ ] **Step 7: Commit** — `git commit -am "B1: Pass wave energy to the water kernel"` (with the co-author trailer).

### Task 2: Contact-zone bank, ebb, and land/bed heights

**Files:**
- Modify: `renderer/water.cu` (new functions after `bedDepth`; `terrainHeight`; `floorDepth`)

**Interfaces:**
- Consumes: `noise`, `smooth`, `lerp`, `bedDepth`, `shoreDistance`.
- Produces:
  - `float contactShore(float shore, float x, float z)` — warped shore distance (m).
  - `float contactHeight(float shore, float x, float z, float outside)` — bank height (m, water surface 0) blended into `outside` by the zone edge; returns `outside` exactly when `|shore| >= 6`.
  - `float contactEbb(float s, float x, float z, float time, float energy)` — mean-surface offset (m).

- [ ] **Step 1: Add the functions after `bedDepth`**

```c
// Shoreline contact (B1, Illustrative). Within 6 m of the lidar shoreline the bank is modelled
// here, so the waterline is wherever the surface meets it, not a contour of the 10 m grid.
// Warped shore distance: the lidar contour moved up to ~1.4 m either way at 4-40 m scales.
__device__ float contactShore(float shore, float x, float z) {
  return shore + 1.6f * (.9f * (noise(x * .025f + 31.0f, z * .025f - 17.0f) - .5f) +
                         .6f * (noise(x * .09f - 5.0f, z * .09f + 11.0f) - .5f) +
                         .3f * (noise(x * .31f + 2.0f, z * .31f + 7.0f) - .5f));
}
// The contact bank: 1:10 through the waterline with a few centimetres of relief, blended
// into `outside` (the lidar bank or modelled bed) between 3 and 6 m from the shoreline.
__device__ float contactHeight(float shore, float x, float z, float outside) {
  float k = smooth(3.0f, 6.0f, fabsf(shore));
  if (k >= 1.0f)
    return outside;
  float bank = .1f * contactShore(shore, x, z) + .06f * (noise(x * 1.7f, z * 1.7f) - .5f) +
               .03f * (noise(x * 4.3f + 9.0f, z * 4.3f) - .5f);
  return lerp(bank, outside, k);
}
// Ebb and flow at the bank (m): a slow swash running shoreward, its phase broken along the
// shore so the edge never pulses in unison. Scales with the wave energy control.
__device__ float contactEbb(float s, float x, float z, float time, float energy) {
  float phase = .9f * s - 1.0f * time + 6.0f * noise(x * .012f + 3.0f, z * .012f - 8.0f),
        group = .6f + .4f * noise(x * .03f - time * .05f, z * .03f);
  return .08f * energy * group * (sinf(phase) + .25f * sinf(2.0f * phase + 1.0f));
}
```

- [ ] **Step 2: `terrainHeight` uses the contact bank on both sides**

```c
__device__ float terrainHeight(const float4 *T, float x, float z) {
  float4 s = terrainSample(T, x, z);
  if (s.y < 0)
    return contactHeight(s.y, x, z, -bedDepth(-s.y, 40.0f, .35f));
  // Sub-grid relief the 10 m lidar grid cannot hold, faded out at the waterline.
  float detail = 2.2f * (fbm(x * .045f + 5.0f, z * .045f) - .5f) +
                 .5f * (noise(x * .21f, z * .21f) - .5f);
  // Past the edge of the survey the clamped lookup would smear the last row into a plateau;
  // let the land fall away under the haze so the painted far ridges take over instead.
  return contactHeight(s.y, x, z,
                       s.x + detail * smooth(0.0f, 25.0f, s.y) - .25f * fmaxf(0.0f, terrainOutside(T, x, z)));
}
```

- [ ] **Step 3: `floorDepth` uses it offshore**

```c
__device__ float floorDepth(const float4 *T, float x, float z, float depth, float slope) {
  // Floor meets the surface at the waterline so the bank shows through shallow water.
  float shore = shoreDistance(T, x, z), offshore = fmaxf(0, -shore);
  float fade = smooth(0.0f, 12.0f, offshore);
  return -contactHeight(shore, x, z,
                        -(bedDepth(offshore, depth, slope) + .18f * (noise(x * .12f, z * .12f) - .5f) * fade +
                          .08f * (noise(x * .55f + 7, z * .55f + 7) - .5f) * fade));
}
```

- [ ] **Step 4: Compile** — Run: `npm run check`. Expected: every kernel compiles.

- [ ] **Step 5: Commit** — `git commit -am "B1: Contact-zone bank for land and bed heights"`.

### Task 3: Waterline from heights, mesh occlusion, wave settling

**Files:**
- Modify: `renderer/water.cu` (`render_water`, from the land-pass block to the `onReservoir` test)

**Interfaces:**
- Consumes: `contactShore`, `contactHeight`, `contactEbb`, `terrainHeight`, `floorDepth` (Task 2); `energy` (Task 1).

- [ ] **Step 1: Keep the land-pass marker** — declare `float landKind = 0.0f;` beside `float landT = -1.0f;` and, inside `if (landPass)`, assign `landKind = kind;` after `kind` is computed.

- [ ] **Step 2: Replace the `onReservoir` line**

```c
    float shoreP = shoreDistance(terrain, P.x, P.z);
    bool onReservoir = shoreP < -.5f && (landT < 0 || t < landT);
    // Contact zone: water where the surface stands above the modelled bank. Waves settle
    // to nothing as the depth does; the ebb lifts and lowers the mean surface.
    bool contact = fabsf(shoreP) < 6.0f;
    if (contact) {
      float bank = shoreP > 0 ? terrainHeight(terrain, P.x, P.z)
                              : -floorDepth(terrain, P.x, P.z, depth, bankSlope),
            settle = smooth(0.0f, 1.5f, -bank);
      a.x *= settle;
      a.y *= settle;
      a.z *= settle;
      float surfaceY = a.x + contactEbb(contactShore(shoreP, P.x, P.z), P.x, P.z, time, energy);
      // Plain ground from the land pass hides the water only where the shader's own bank
      // rises into the ray; its 10 m triangles would otherwise cut the waterline straight.
      bool hidden = landT > 0 && t >= landT;
      if (hidden && landKind == 0.0f) {
        float3 H = add(ro, mul(rd, landT));
        if (fabsf(shoreDistance(terrain, H.x, H.z)) < 6.0f && H.y > terrainHeight(terrain, H.x, H.z))
          hidden = false;
      }
      onReservoir = surfaceY > bank && !hidden;
      // Bank above the surface here: show this bank, not whatever the land pass found behind.
      if (!onReservoir && !hidden) {
        landT = t;
        given.w = 0.0f;
      }
    }
    if (onReservoir) {
```

(The existing `if (onReservoir) {` line is replaced by the block above ending in it.)

- [ ] **Step 3: Compile** — Run: `npm run check`. Expected: every kernel compiles.

- [ ] **Step 4: Look** — `npm start`, open `http://localhost:5173/renderer/explore.html?reservoir=calaveras` (Shoreline viewpoint is the default). Expected: the waterline curves irregularly instead of running in straight segments; the edge creeps a few tens of cm in and out; no dry patches in open water, no water on the hillside, no seam at 6 m. Repeat for `?reservoir=san_antonio`.

- [ ] **Step 5: Commit** — `git commit -am "B1: Waterline from surface and bank heights"`.

### Task 4: Wet band on recently covered ground

**Files:**
- Modify: `renderer/water.cu` (`terrainShade`, before `float3 lit = mix3(groundLit, ...)`)

- [ ] **Step 1: Darken ground the ebb covered in the last ~2 s**

```c
  // Contact zone: ground the ebb covered in the last couple of seconds is darker, drying out.
  if (fabsf(shore) < 6.0f && energy > 0.0f) {
    float sw = contactShore(shore, p.x, p.z), wetted = 0.0f;
    for (int k = 0; k < 4; k++) {
      float reach = contactEbb(sw, p.x, p.z, time - .6f * (float)k, energy);
      wetted = fmaxf(wetted, (1.0f - .22f * (float)k) * smooth(.02f, -.01f, p.y - reach));
    }
    groundLit = mul(groundLit, 1.0f - .45f * wetted);
  }
```

- [ ] **Step 2: Compile** — Run: `npm run check`. Expected: every kernel compiles.

- [ ] **Step 3: Look** — reload the explorer at the Shoreline view: a darker band trails the retreating edge and fades over ~2 s; at wave energy 0.10 the band is nearly still.

- [ ] **Step 4: Commit** — `git commit -am "B1: Wet band behind the ebb"`.

### Task 5: Tune, time, document, finish

**Files:**
- Modify: `renderer/water.cu` (constants only, if tuning needs it)
- Modify: `docs/making-water-visible.md` (table)
- Modify: `docs/roadmap/tasks/B1-shoreline-contact.md` (Result)

- [ ] **Step 1: Tune by eye** at both reservoirs' Shoreline views, energy 0.10 / 0.38 / 1.60. Adjust only the constants in `contactShore`, `contactHeight`, `contactEbb` and the wet band.

- [ ] **Step 2: Light timing** — at the Shoreline view with `&quality=medium`, read `window.waterscapeDiagnostics.frameMs` over ~5 s on `main` and on `task/B1`; record both medians. If the branch is clearly slower, restrict the contact work to `t < 400` m and re-check.

- [ ] **Step 3: Docs** — in `docs/making-water-visible.md`, append to the "Water surface and shoreline" note: `Within ~6 m of the shoreline the drawn edge is illustrative: it follows this shoreline to within about 1.5 m of modelled relief, plus the ebb.` and add the row:

```markdown
| Shoreline contact (edge relief, ebb and flow, wet band) | Illustrative | Modeled / interactive | Organic waterline, a slow ebb and a darkened wet band within ~6 m of the shoreline. Amplitude follows the hand-set wave energy, not measured wind or water level. |
```

- [ ] **Step 4: Checks** — Run `node --test "pipeline/tests/*.test.mjs"` (`ℹ fail 0`), `node pipeline/validate-bundles.mjs` (`Bundles valid.`), `npm run check`, `npm run build` (`Built Pages with …`), `git diff --check` (no output).

- [ ] **Step 5: Result and commit** — append the `## Result` section to the task file (status, commit, each check's last line, timings, screenshots taken, limitations: no Windows Chrome/Edge timing, native host not built), then `git commit -am "B1: Organic shoreline contact with ebb and flow"`. Do not push or merge.
