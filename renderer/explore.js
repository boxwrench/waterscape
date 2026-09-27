import { GpuRuntime } from "../vendor/cuda-webshader/runtime/runtime.js";
import { formatElevation, formatLatLon, loadTerrain } from "./terrain.js";
import { QualityGovernor, TIER_NAMES, forcedTier, startingLevel } from "./quality.js";
import { PRESETS, choosePreset, presetBuffer } from "./land/presets.js";
import { createLandPass } from "./land/scene.js";
const $ = (id) => document.getElementById(id),
  canvas = $("water"),
  q = new URLSearchParams(location.search);
// The reservoir bundle (data/<id>/) supplies terrain and named viewpoints.
const reservoirId = q.get("reservoir") || "calaveras",
  bundleBase = new URL(`../data/${reservoirId}/`, import.meta.url),
  embedded = q.has("embed");
if (embedded) document.body.classList.add("embed");
let VIEWPOINTS = {};
let terrain = null;
function viewpoint(name) {
  const { x, z, above, yaw, pitch, speed } = VIEWPOINTS[name];
  return { x, z, y: terrain.ground(x, z) + above, yaw, pitch, speed };
}
// The shader adds up to ~1.4 m of sub-grid relief on top of the lidar surface.
function terrainClearance(x, z) {
  return terrain.ground(x, z) + 2.5;
}
// Flight speed scales with height above the ground, like a map fly-through: precise when
// skimming the grass, kilometres in seconds once you climb. 1× below 25 m, 20× at 500 m.
function altitudeFactor() {
  const above = state.y - terrain.ground(state.x, state.z);
  return Math.min(80, Math.max(1, above / 25));
}
// Same camera ray as ray() in renderer/clearwater.cu, so picking matches the image.
function viewRay(sx, sy, aspect, yaw, pitch) {
  const cy = Math.cos(yaw),
    syaw = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    f = 0.62487,
    d = [
      syaw * cp + sx * aspect * f * cy - sy * f * syaw * sp,
      sp + sy * f * cp,
      -cy * cp + sx * aspect * f * syaw + sy * f * cy * sp,
    ],
    l = Math.hypot(...d);
  return d.map((v) => v / l);
}
window.waterscapeModel = {
  get terrain() {
    return terrain;
  },
  get viewpoints() {
    return VIEWPOINTS;
  },
  viewpoint,
};
const state = {
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  speed: 40,
  quality: 2,
  preset: "golden",
  viewpoint: "overlook",
  time: q.has("t") ? Number(q.get("t")) : 0,
  playing: !q.has("t"),
  frames: 0,
};
const diag = (window.clearwaterDiagnostics = {
  ready: false,
  errors: [],
  state,
  frames: 0,
  cascades: [4.6, 37, 293],
  fftSize: 256,
  location: reservoirId,
});
let rt,
  ctx,
  k = {},
  seed,
  scales,
  rows,
  fft,
  surface,
  rip,
  ripNormals,
  photons,
  caustics,
  pebbles,
  terrainCells,
  hdr,
  bloom,
  pixels,
  width = 0,
  height = 0,
  ripIndex = 0,
  centerX = 0,
  centerZ = 0,
  resizePending = true,
  lensKernel,
  lensFFT,
  last = 0,
  accumulator = 0,
  tap = null,
  lightBuf,
  landPass = null,
  landProfile = null,
  governor = null,
  failed = false,
  locked = false;
const keys = new Set(),
  WG = [32, 32, 3],
  RG = [32, 32, 1];
function fail(e) {
  failed = true;
  diag.errors.push(String(e.message || e));
  console.error(e);
  $("error").hidden = false;
  $("error").textContent = diag.errors.at(-1);
  $("loading").hidden = true;
  $("status").textContent = "UNAVAILABLE";
  if (embedded)
    parent.postMessage({ type: "waterscape:failed", reservoir: reservoirId }, location.origin);
}
function labels() {
  for (const id of ["energy", "depth", "exposure"])
    $(id + "Value").textContent =
      Number($(id).value).toFixed(1) + (id === "depth" ? " m" : "");
}
for (const id of ["energy", "depth", "exposure"]) $(id).oninput = labels;
$("quality").onchange = () => {
  // A visitor's own resolution choice wins over automatic quality.
  governor = null;
  if (diag.quality) diag.quality.auto = false;
  resizePending = true;
};
addEventListener("resize", () => (resizePending = true));
function liveLabel() {
  return terrain ? `LIVE / ${terrain.meta.name.toUpperCase()}` : "LIVE";
}
function play(value) {
  state.playing = value;
  $("pause").textContent = value ? "Ⅱ Pause" : "▶ Resume";
  $("status").textContent = value ? liveLabel() : "PAUSED";
}
$("pause").onclick = () => play(!state.playing);
$("toggle").onclick = () => {
  document.body.classList.toggle("clean");
  $("toggle").textContent = document.body.classList.contains("clean")
    ? "Show controls ↙"
    : "Hide controls ↗";
};
$("reset").onclick = () => Object.assign(state, viewpoint(state.viewpoint));
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
// Elevation readouts from the lidar surface: camera, ground below, and whatever the cursor
// is over (picked along the same ray the renderer casts for that pixel).
let hover = null;
canvas.addEventListener("pointermove", (e) => (hover = e));
canvas.addEventListener("pointerleave", () => (hover = null));
// GPU chip and the "use your faster GPU" tip (browsers on dual-GPU laptops default to the
// integrated GPU and ignore a page's powerPreference, so only the visitor can change it).
// Lighting preset: the shader reads six float4s (sun, radiance, fill, sky, haze, clouds).
function applyPreset(name) {
  state.preset = choosePreset(name, landProfile);
  const p = PRESETS[state.preset];
  rt.write(lightBuf, presetBuffer(p));
  $("exposure").value = String(p.exposure);
  $("exposure").dispatchEvent(new Event("input"));
  diag.preset = state.preset;
}
// The journey's live view picks presets from outside the iframe.
addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.data?.type !== "waterscape:preset" || !lightBuf) return;
  applyPreset(e.data.name);
  $("preset").value = state.preset;
});
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

function survey() {
  const ground = terrain.ground(state.x, state.z);
  $("elevCamera").textContent =
    `${formatElevation(terrain.elevation(state.y))} · ${Math.round(state.y - ground)} m up`;
  $("elevGround").textContent =
    terrain.shoreDistance(state.x, state.z) < 0
      ? "Over water"
      : formatElevation(terrain.elevation(ground));
  $("elevPosition").textContent = formatLatLon(terrain.latLon(state.x, state.z));
  let cursor = "Point at the land";
  if (hover && !drag) {
    const rect = canvas.getBoundingClientRect(),
      sx = (2 * (hover.clientX - rect.left)) / rect.width - 1,
      sy = 1 - (2 * (hover.clientY - rect.top)) / rect.height,
      [dx, dy, dz] = viewRay(sx, sy, width / height, state.yaw, state.pitch),
      hit = terrain.pick(state.x, state.y, state.z, dx, dy, dz);
    if (hit) {
      const away =
        hit.distance < 1000
          ? `${Math.round(hit.distance)} m away`
          : `${(hit.distance / 1000).toFixed(1)} km away`;
      cursor = hit.water
        ? `Water surface · ${away}`
        : `${formatElevation(terrain.elevation(hit.y))} · ${away}`;
    } else cursor = "Sky";
  }
  $("elevCursor").textContent = cursor;
}
let drag = null;
canvas.onpointerdown = (e) => {
  drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY };
  canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove = (e) => {
  if (!drag) return;
  state.yaw += (e.clientX - drag.x) * 0.003;
  state.pitch = Math.max(
    -1.55,
    Math.min(1.55, state.pitch - (e.clientY - drag.y) * 0.003),
  );
  drag.x = e.clientX;
  drag.y = e.clientY;
};
canvas.onpointerup = (e) => {
  if (drag && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6)
    tap = [(e.clientX / innerWidth) * 2 - 1, 1 - (e.clientY / innerHeight) * 2];
  drag = null;
};
canvas.onpointercancel = () => (drag = null);
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const delta =
      e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    state.speed = Math.max(
      0.1,
      Math.min(1000, state.speed * Math.exp(-delta * 0.002)),
    );
  },
  { passive: false },
);
addEventListener("keydown", (e) => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  keys.add(e.code);
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (e.code === "Space" && !e.repeat) play(!state.playing);
  if (e.code === "KeyH" && !e.repeat) $("toggle").click();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
async function resize() {
  if (!resizePending) return;
  resizePending = false;
  await rt.idle();
  width = +$("quality").value;
  height = Math.ceil((width * innerHeight) / innerWidth / 8) * 8;
  canvas.width = width;
  canvas.height = height;
  for (const b of [hdr, ...(bloom || []), pixels]) if (b) rt.destroyBuffer(b);
  hdr = rt.createBuffer(width * height * 16);
  bloom = [
    rt.createBuffer(width * height * 16),
    rt.createBuffer(width * height * 16),
  ];
  pixels = rt.createBuffer(width * height * 4);
  landPass?.resize(width, height);
  ctx.configure({
    device: rt.device,
    format: "rgba8unorm",
    alphaMode: "opaque",
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  Object.assign(diag, { width, height });
}
function waves(batch) {
  batch.dispatch(
    k.evolve_spectrum.bind(
      { seed, scales, output: fft[0] },
      { time: state.time, sea: +$("energy").value, depth: +$("depth").value },
    ),
    WG,
  );
  let src = 0;
  for (let axis = 0; axis < 2; axis++)
    for (let p = 1; p < 256; p *= 2) {
      batch.dispatch(
        k.fft_pass.bind(
          { input: fft[src], output: fft[1 - src] },
          { p, axis, sign: 1 },
        ),
        WG,
      );
      src = 1 - src;
    }
  batch.dispatch(k.resolve_surface.bind({ input: fft[src], surface }), WG);
}
function ripples(batch, dt) {
  accumulator = Math.min(0.1, accumulator + dt);
  const steps = Math.floor(accumulator * 120);
  accumulator -= steps / 120;
  for (let i = 0; i < steps; i++) {
    const nx = Math.round(state.x * 16) / 16,
      nz = Math.round(state.z * 16) / 16,
      shiftX = Math.round((nx - centerX) * 16),
      shiftZ = Math.round((nz - centerZ) * 16);
    centerX = nx;
    centerZ = nz;
    batch.dispatch(
      k.ripple_step.bind(
        { previous: rip[ripIndex], next: rip[1 - ripIndex] },
        {
          shiftX,
          shiftZ,
          centerX,
          centerZ,
          camX: state.x,
          camZ: state.z,
          camY: state.y,
          yaw: state.yaw,
          pitch: state.pitch,
          aspect: width / height,
          tapX: tap?.[0] || 0,
          tapY: tap?.[1] || 0,
          drop: tap ? 1 : 0,
        },
      ),
      RG,
    );
    tap = null;
    ripIndex = 1 - ripIndex;
  }
  batch.dispatch(
    k.ripple_normals.bind({ input: rip[ripIndex], output: ripNormals }),
    RG,
  );
}
function transform(batch, pair, sign) {
  let src = 0;
  for (let axis = 0; axis < 2; axis++)
    for (let p = 1; p < 256; p *= 2) {
      batch.dispatch(
        k.fft_pass.bind(
          { input: pair[src], output: pair[1 - src] },
          { p, axis, sign },
        ),
        WG,
      );
      src = 1 - src;
    }
  return pair[src];
}
function setupLens() {
  const batch = rt.batch();
  batch.dispatch(k.lens_aperture.bind({ output: lensFFT[0] }), WG);
  transform(batch, lensFFT, -1);
  batch
    .dispatch(k.lens_power.bind({ amplitude: lensFFT[0], psf: lensFFT[1] }), WG)
    .dispatch(k.lens_rows.bind({ psf: lensFFT[1], sums: rows }), [12, 1, 1])
    .dispatch(
      k.lens_normalize.bind({
        psf: lensFFT[1],
        sums: rows,
        output: lensFFT[0],
      }),
      WG,
    );
  transform(batch, lensFFT, -1);
  batch.submit();
  const enc = rt.device.createCommandEncoder();
  enc.copyBufferToBuffer(
    lensFFT[0].gpuBuffer,
    0,
    lensKernel.gpuBuffer,
    0,
    3 * 65536 * 16,
  );
  rt.device.queue.submit([enc.finish()]);
}
function render() {
  landPass?.render(state);
  const batch = rt.batch(),
    grid = [width / 8, height / 8, 1];
  batch
    .dispatch(k.clear_caustics.bind({ photons }), [64, 64, 1])
    .dispatch(
      k.trace_caustics.bind({ surface, photons, light: lightBuf }, { depth: +$("depth").value }),
      [128, 128, 1],
    )
    .dispatch(k.filter_caustics.bind({ photons, caustics }), [64, 64, 1]);
  batch.dispatch(
    k.render_water.bind(
      { surface, rip: ripNormals, caustics, pebbles, terrain: terrainCells, light: lightBuf, land: landPass ? landPass.buffer : terrainCells, hdr },
      {
        width,
        height,
        camX: state.x,
        camZ: state.z,
        camY: state.y,
        yaw: state.yaw,
        pitch: state.pitch,
        centerX,
        centerZ,
        depth: +$("depth").value,
        time: state.time,
        view: +$("view").value,
        season: +$("season").value,
        quality: state.quality,
        landPass: landPass ? 1 : 0,
      },
    ),
    grid,
  );
  if ($("glare").checked) {
    batch.dispatch(
      k.glare_source.bind({ hdr, output: lensFFT[0] }, { width, height }),
      WG,
    );
    transform(batch, lensFFT, -1);
    batch.dispatch(
      k.glare_multiply.bind({
        input: lensFFT[0],
        kernel: lensKernel,
        output: lensFFT[1],
      }),
      WG,
    );
    transform(batch, [lensFFT[1], lensFFT[0]], 1);
  }
  batch
    .dispatch(
      k.bloom_pass.bind(
        { input: hdr, output: bloom[0] },
        { width, height, axis: 0 },
      ),
      grid,
    )
    .dispatch(
      k.bloom_pass.bind(
        { input: bloom[0], output: bloom[1] },
        { width, height, axis: 1 },
      ),
      grid,
    )
    .dispatch(
      k.present.bind(
        { hdr, bloom: bloom[1], diffraction: lensFFT[1], image: pixels },
        {
          width,
          height,
          exposure: +$("exposure").value,
          glare: $("glare").checked ? 1 : 0,
        },
      ),
      grid,
    )
    .submit();
  const enc = rt.device.createCommandEncoder();
  enc.copyBufferToTexture(
    { buffer: pixels.gpuBuffer, bytesPerRow: width * 4, rowsPerImage: height },
    { texture: ctx.getCurrentTexture() },
    [width, height],
  );
  rt.device.queue.submit([enc.finish()]);
}
async function frame(now) {
  if (failed) return;
  try {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!locked && !document.hidden) {
      await resize();
      const start = performance.now(),
        boost =
          (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 6 : 1) * altitudeFactor(),
        speed = state.speed * boost * dt;
      state.yaw +=
        ((keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0)) *
        dt;
      state.pitch = Math.max(
        -1.55,
        Math.min(
          1.55,
          state.pitch +
            ((keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0)) *
              dt,
        ),
      );
      let forward =
          (keys.has("KeyW") ? 1 : 0) -
          (keys.has("KeyS") ? 1 : 0) +
          ($("cruise").checked ? 1 : 0),
        side = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
        up = (keys.has("KeyE") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0);
      const length = Math.max(1, Math.hypot(forward, side, up));
      forward /= length;
      side /= length;
      up /= length;
      state.x +=
        speed *
        (Math.sin(state.yaw) * Math.cos(state.pitch) * forward +
          Math.cos(state.yaw) * side);
      state.z +=
        speed *
        (-Math.cos(state.yaw) * Math.cos(state.pitch) * forward +
          Math.sin(state.yaw) * side);
      state.y = Math.max(
        terrainClearance(state.x, state.z),
        state.y + speed * (Math.sin(state.pitch) * forward + up),
      );
      if (state.playing) state.time += dt;
      const batch = rt.batch();
      waves(batch);
      ripples(batch, state.playing ? dt : 0);
      batch.submit();
      render();
      await rt.idle();
      diag.frameMs = performance.now() - start;
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
      diag.frames = ++state.frames;
      diag.ready = true;
      diag.readbackBytes = rt.stats.readbackBytes;
      $("loading").hidden = true;
      $("status").textContent = state.playing ? liveLabel() : "PAUSED";
      if (state.frames % 15 === 0) {
        $("metrics").textContent =
          `${Math.round(1 / dt)} FPS · ${width} × ${height} · SPEED ${state.speed * boost < 100 ? (state.speed * boost).toFixed(1) : Math.round(state.speed * boost).toLocaleString()} m/s · ${formatElevation(terrain.elevation(state.y))}`;
        survey();
        updateGpu();
        if (embedded)
          parent.postMessage(
            {
              type: "waterscape:frame",
              ms: diag.frameMs,
              reservoir: reservoirId,
              tier: state.quality,
              struggling: diag.quality.struggling,
            },
            location.origin,
          );
      }
    }
    requestAnimationFrame(frame);
  } catch (e) {
    fail(e);
  }
}
async function exclusive(fn) {
  locked = true;
  try {
    await rt.idle();
    return await fn();
  } finally {
    locked = false;
  }
}
window.clearwaterLab = {
  state,
  pause: () => play(false),
  resume: () => play(true),
  async inspect() {
    return exclusive(async () => {
      const a = await rt.read(surface),
        r = await rt.read(rip[ripIndex]);
      let min = Infinity,
        max = -Infinity,
        sum = 0,
        finite = true,
        ripplePeak = 0;
      for (let i = 0; i < a.length; i++) {
        finite &&= Number.isFinite(a[i]);
        if (i % 4 === 0) {
          min = Math.min(min, a[i]);
          max = Math.max(max, a[i]);
          sum += a[i] * a[i];
        }
      }
      for (let i = 0; i < r.length; i += 4)
        ripplePeak = Math.max(ripplePeak, Math.abs(r[i]));
      return {
        finite,
        min,
        max,
        rms: Math.sqrt(sum / (3 * 65536)),
        ripplePeak,
        adapter: rt.describe(),
        errors: diag.errors,
        stats: { ...rt.stats },
      };
    });
  },
  async seek(t) {
    return exclusive(async () => {
      state.time = t;
      play(false);
      const b = rt.batch();
      waves(b);
      b.submit();
      render();
      await rt.idle();
    });
  },
  async fftTest() {
    return exclusive(async () => {
      const n = 256,
        data = new Float32Array(n * n * 3 * 4);
      const modes = [
        { x: 1, z: 0, re: 0.5, im: 0, c: 0, f: 0 },
        { x: 255, z: 0, re: 0.5, im: 0, c: 0, f: 0 },
        { x: 3, z: 7, re: 0.3, im: -0.2, c: 1, f: 0 },
        { x: 11, z: 253, re: -0.4, im: 0.15, c: 2, f: 2 },
        { x: 51, z: 89, re: 0.07, im: 0.11, c: 0, f: 2 },
      ];
      for (const m of modes) {
        const i = (m.c * n * n + m.z * n + m.x) * 4 + m.f;
        data[i] = m.re;
        data[i + 1] = m.im;
      }
      const a = rt.createBuffer(data),
        b = rt.createBuffer(data.byteLength),
        batch = rt.batch();
      transform(batch, [a, b], 1);
      batch.submit();
      const out = await rt.read(a);
      let maxError = 0;
      for (let c = 0; c < 3; c++)
        for (let z = 0; z < n; z++)
          for (let x = 0; x < n; x++)
            for (let f = 0; f < 4; f += 2) {
              let re = 0,
                im = 0;
              for (const m of modes) {
                if (m.c !== c || m.f !== f) continue;
                const angle = (2 * Math.PI * (m.x * x + m.z * z)) / n;
                re += m.re * Math.cos(angle) - m.im * Math.sin(angle);
                im += m.re * Math.sin(angle) + m.im * Math.cos(angle);
              }
              const id = (c * n * n + z * n + x) * 4 + f;
              maxError = Math.max(
                maxError,
                Math.abs(out[id] - re),
                Math.abs(out[id + 1] - im),
              );
            }
      const back = rt.batch();
      transform(back, [a, b], -1);
      back.submit();
      const round = await rt.read(a);
      let roundtripError = 0;
      for (let i = 0; i < data.length; i++)
        roundtripError = Math.max(
          roundtripError,
          Math.abs(round[i] / (n * n) - data[i]),
        );
      rt.destroyBuffer(a);
      rt.destroyBuffer(b);
      return {
        maxError,
        roundtripError,
        modes: modes.length,
        axes: 2,
        cascades: 3,
        complexFields: 2,
      };
    });
  },
  async inspectOptics() {
    return exclusive(async () => {
      const ca = await rt.read(caustics),
        im = await rt.read(hdr),
        psf = await rt.read(lensKernel),
        gl = await rt.read(lensFFT[1]);
      const means = [0, 0, 0];
      for (let i = 0; i < ca.length; i += 4)
        for (let c = 0; c < 3; c++) means[c] += ca[i + c] / (512 * 512);
      return {
        causticMean: means,
        hdrFinite: im.every(Number.isFinite),
        glareFinite: gl.every(Number.isFinite),
        psfEnergy: [0, 1, 2].map((c) => psf[c * 65536 * 4] * 65536),
      };
    });
  },
};

$("capture").onclick = () =>
  exclusive(async () => {
    const data = await rt.read(pixels, Uint32Array),
      c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    c.getContext("2d").putImageData(
      new ImageData(new Uint8ClampedArray(data.buffer), width, height),
      0,
      0,
    );
    c.toBlob((blob) => {
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `${terrain.meta.name.replaceAll(" ", "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
  });
try {
  if (!/^[a-z0-9_]+$/.test(reservoirId))
    throw new Error(`Invalid reservoir id: ${reservoirId}`);
  rt = await GpuRuntime.create({ onError: fail });
  const vendor = rt.describe().vendor,
    forced = forcedTier(q.get("quality"));
  if (forced === null) {
    governor = new QualityGovernor(startingLevel(vendor));
    state.quality = governor.current.tier;
    $("quality").value = String(governor.current.width);
  } else state.quality = forced;
  diag.quality = { tier: state.quality, width: +$("quality").value, auto: !!governor, vendor, struggling: false };
  updateGpu();
  ctx = canvas.getContext("webgpu");
  const source = await (await fetch(new URL("./clearwater.cu", import.meta.url))).text();
  $("loadText").textContent = "Loading USGS lidar terrain…";
  terrain = await loadTerrain(new URL("terrain", bundleBase).href);
  VIEWPOINTS = (await (await fetch(new URL("cameras.json", bundleBase))).json()).viewpoints;
  terrainCells = rt.createBuffer(terrain.gpuCells());
  landProfile = await (await fetch(new URL("land.json", bundleBase))).json();
  lightBuf = rt.createBuffer(24 * 4);
  applyPreset(q.get("preset"));
  // Only the presets this reservoir offers, default selected.
  for (const opt of [...$("preset").options]) opt.hidden = !landProfile.presets.includes(opt.value);
  $("preset").value = state.preset;
  $("preset").onchange = () => applyPreset($("preset").value);
  // Land from three.js on our device; if it cannot start, keep today's traced land.
  try {
    landPass = await createLandPass(rt, terrain);
    if (width) landPass.resize(width, height);
    diag.land = { shared: landPass.shared, error: null };
  } catch (e) {
    landPass = null;
    diag.land = { shared: false, error: String(e) };
  }
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
  $("waterLevel").textContent = formatElevation(terrain.waterLevel);
  $("dataLink").href = terrain.meta.service;
  for (const name of [...source.matchAll(/__global__ void (\w+)/g)].map(
    (m) => m[1],
  )) {
    $("loadText").textContent = `Compiling ${name.replaceAll("_", " ")}…`;
    k[name] = await rt.kernel(source, {
      entry: name,
      workgroupSize: ["spectrum_rows", "spectrum_norm", "lens_rows"].includes(
        name,
      )
        ? [64, 1, 1]
        : [8, 8, 1],
    });
  }
  lensKernel = rt.createBuffer(3 * 65536 * 16);
  lensFFT = [rt.createBuffer(3 * 65536 * 16), rt.createBuffer(3 * 65536 * 16)];
  seed = rt.createBuffer(3 * 65536 * 8);
  rows = rt.createBuffer(768 * 4);
  scales = rt.createBuffer(3 * 4);
  fft = [rt.createBuffer(3 * 65536 * 16), rt.createBuffer(3 * 65536 * 16)];
  surface = rt.createBuffer(3 * 65536 * 16);
  rip = [rt.createBuffer(65536 * 16), rt.createBuffer(65536 * 16)];
  ripNormals = rt.createBuffer(65536 * 16);
  photons = rt.createBuffer(512 * 512 * 3 * 4);
  caustics = rt.createBuffer(512 * 512 * 16);
  // Asset decoding only: the source asset is converted to linear floats once.
  const bitmap = await createImageBitmap(
      await (await fetch(new URL("./assets/seabed.jpg", import.meta.url))).blob(),
    ),
    off = new OffscreenCanvas(1024, 1024),
    dc = off.getContext("2d");
  dc.drawImage(bitmap, 0, 0, 1024, 1024);
  const rgba = dc.getImageData(0, 0, 1024, 1024).data,
    linear = new Float32Array(1024 * 1024 * 4);
  for (let i = 0; i < rgba.length; i++)
    linear[i] = i % 4 === 3 ? 1 : Math.pow(rgba[i] / 255, 2.2);
  pebbles = rt.createBuffer(linear);
  bitmap.close();
  rt.batch()
    .dispatch(k.seed_spectrum.bind({ seed }, { seedValue: 7 }), WG)
    .dispatch(k.spectrum_rows.bind({ seed, rows }), [12, 1, 1])
    .dispatch(k.spectrum_norm.bind({ rows, scales }), [1, 1, 1])
    .submit();
  await rt.idle();
  setupLens();
  await rt.idle();
  labels();
  requestAnimationFrame(frame);
} catch (e) {
  fail(e);
}
