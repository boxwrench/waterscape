// The explore page: controls, input and readouts around the engine (renderer/engine/).
import { formatElevation, formatLatLon } from "./terrain.js";
import { QualityGovernor, TIER_NAMES, forcedTier, startingLevel } from "./engine/quality.js";
import { loadBody, viewpoint } from "./engine/body.js";
import { fly, viewRay } from "./engine/camera.js";
import { createWaterscape } from "./engine/waterscape.js";
const $ = (id) => document.getElementById(id),
  canvas = $("water"),
  q = new URLSearchParams(location.search);
// The water body (data/<id>/) supplies terrain, named viewpoints and its land profile.
const bodyId = q.get("reservoir") || "calaveras",
  embedded = q.has("embed");
if (embedded) document.body.classList.add("embed");
let body = null,
  ws = null,
  governor = null,
  failed = false,
  last = 0,
  hover = null,
  drag = null,
  // Until the engine exists this holds load errors; then it is the engine's diagnostics.
  diag = (window.waterscapeDiagnostics = { ready: false, errors: [], location: bodyId });
const keys = new Set();
window.waterscapeModel = {
  get terrain() {
    return body?.terrain;
  },
  get viewpoints() {
    return body?.viewpoints ?? {};
  },
  viewpoint: (name) => viewpoint(body, name),
};
function fail(e) {
  failed = true;
  diag.errors.push(String(e.message || e));
  console.error(e);
  $("error").hidden = false;
  $("error").textContent = diag.errors.at(-1);
  $("loading").hidden = true;
  $("status").textContent = "UNAVAILABLE";
  if (embedded) parent.postMessage({ type: "waterscape:failed", reservoir: bodyId }, location.origin);
}
function labels() {
  $("energyValue").textContent = Number($("energy").value).toFixed(1);
}
$("energy").oninput = labels;
// The controls are the source of truth; the engine reads a copy each frame. Depth comes from the
// water body (land.json) and exposure from the light preset, so neither is a control.
function syncSettings() {
  Object.assign(ws.settings, {
    energy: +$("energy").value,
    view: +$("view").value,
    season: +$("season").value,
    glare: $("glare").checked,
    trees: $("trees").checked,
    grass: $("grass").checked,
  });
}
// The summer label follows the water body's grass (land.json): gold hills, or Peninsula sage.
const summerLabel = () => (body.land.grass?.summer === "sage" ? "Summer sage" : "Summer gold");
function intro() {
  $("intro").textContent =
    `${+$("season").value ? summerLabel() : "Spring green"} at ${body.terrain.meta.name}, from USGS lidar terrain.`;
}
$("season").addEventListener("change", () => body && intro());
$("quality").onchange = () => {
  // A visitor's own resolution choice wins over automatic quality.
  governor = null;
  if (diag.quality) diag.quality.auto = false;
  ws?.resize(+$("quality").value);
};
addEventListener("resize", () => ws?.resize(+$("quality").value));
function liveLabel() {
  return body ? `LIVE / ${body.terrain.meta.name.toUpperCase()}` : "LIVE";
}
function play(value) {
  if (ws) ws.state.playing = value;
  $("pause").textContent = value ? "Ⅱ Pause" : "▶ Resume";
  $("status").textContent = value ? liveLabel() : "PAUSED";
}
$("pause").onclick = () => play(!ws.state.playing);
$("toggle").onclick = () => {
  document.body.classList.toggle("clean");
  $("toggle").textContent = document.body.classList.contains("clean")
    ? "Show controls ↙"
    : "Hide controls ↗";
};
$("reset").onclick = () => Object.assign(ws.state, viewpoint(body, ws.state.viewpoint));
function selectViewpoint(name) {
  ws.state.viewpoint = name;
  Object.assign(ws.state, viewpoint(body, name));
  $("energy").value = name === "shore" ? 0.3 : 0.38;
  document
    .querySelectorAll("[data-preset]")
    .forEach((b) => b.classList.toggle("active", b.dataset.preset === name));
  labels();
}
function buildViewpoints() {
  document.querySelector(".presets").replaceChildren(
    ...Object.entries(body.viewpoints).map(([name, v]) => {
      const b = document.createElement("button");
      b.dataset.preset = name;
      b.textContent = v.label;
      b.classList.toggle("active", name === ws.state.viewpoint);
      b.onclick = () => selectViewpoint(name);
      return b;
    }),
  );
}
// Lighting preset: the engine writes the light (and exposure); the page mirrors the picker.
function applyPreset(name) {
  const chosen = ws.setPreset(name);
  $("preset").value = chosen;
}
// The journey's live view picks presets from outside the iframe.
addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.data?.type !== "waterscape:preset" || !ws) return;
  applyPreset(e.data.name);
});
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
    arch = ws.rt.describe().architecture;
  $("gpuChip").textContent = `${vendor}${arch ? " " + arch : ""} · ${TIER_NAMES[tier]} · ${width} px`;
  $("gpuTip").hidden = tipDismissed() || !(vendor === "intel" || tier === 0);
}
$("gpuTipDismiss").onclick = () => {
  try {
    localStorage.setItem("waterscape.gpuTipDismissed", "1");
  } catch {}
  $("gpuTip").hidden = true;
};
// Elevation readouts from the lidar surface: camera, ground below, and whatever the cursor
// is over (picked along the same ray the renderer casts for that pixel).
canvas.addEventListener("pointermove", (e) => (hover = e));
canvas.addEventListener("pointerleave", () => (hover = null));
function survey() {
  const { terrain } = body,
    { state } = ws,
    ground = terrain.ground(state.x, state.z);
  $("elevCamera").textContent =
    `${formatElevation(terrain.elevation(state.y))} · ${Math.round(state.y - ground)} m up`;
  $("elevGround").textContent =
    terrain.shoreDistance(state.x, state.z) < 0 ? "Over water" : formatElevation(terrain.elevation(ground));
  $("elevPosition").textContent = formatLatLon(terrain.latLon(state.x, state.z));
  let cursor = "Point at the land";
  if (hover && !drag) {
    const rect = canvas.getBoundingClientRect(),
      sx = (2 * (hover.clientX - rect.left)) / rect.width - 1,
      sy = 1 - (2 * (hover.clientY - rect.top)) / rect.height,
      [dx, dy, dz] = viewRay(sx, sy, ws.width / ws.height, state.yaw, state.pitch),
      hit = terrain.pick(state.x, state.y, state.z, dx, dy, dz);
    if (hit) {
      const away =
        hit.distance < 1000 ? `${Math.round(hit.distance)} m away` : `${(hit.distance / 1000).toFixed(1)} km away`;
      cursor = hit.water ? `Water surface · ${away}` : `${formatElevation(terrain.elevation(hit.y))} · ${away}`;
    } else cursor = "Sky";
  }
  $("elevCursor").textContent = cursor;
}
canvas.onpointerdown = (e) => {
  drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY };
  canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove = (e) => {
  if (!drag || !ws) return;
  ws.state.yaw += (e.clientX - drag.x) * 0.003;
  ws.state.pitch = Math.max(-1.55, Math.min(1.55, ws.state.pitch - (e.clientY - drag.y) * 0.003));
  drag.x = e.clientX;
  drag.y = e.clientY;
};
canvas.onpointerup = (e) => {
  if (drag && ws && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6)
    ws.tap((e.clientX / innerWidth) * 2 - 1, 1 - (e.clientY / innerHeight) * 2);
  drag = null;
};
canvas.onpointercancel = () => (drag = null);
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (!ws) return;
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    ws.state.speed = Math.max(0.1, Math.min(1000, ws.state.speed * Math.exp(-delta * 0.002)));
  },
  { passive: false },
);
addEventListener("keydown", (e) => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  keys.add(e.code);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.code === "Space" && !e.repeat && ws) play(!ws.state.playing);
  if (e.code === "KeyH" && !e.repeat) $("toggle").click();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
async function frame(now) {
  if (failed) return;
  try {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!ws.locked && !document.hidden) {
      const { state } = ws,
        boost = fly(state, { keys, cruise: $("cruise").checked }, dt, body.terrain);
      syncSettings();
      await ws.step(dt);
      if (governor) {
        const next = governor.sample(diag.frameMs, performance.now());
        if (next) {
          state.quality = next.tier;
          $("quality").value = String(next.width);
          ws.resize(next.width);
        }
      }
      Object.assign(diag.quality, { tier: state.quality, width: ws.width, struggling: !!governor?.struggling });
      $("loading").hidden = true;
      $("status").textContent = state.playing ? liveLabel() : "PAUSED";
      const firstFrame = diag.startup.firstFrameMs === null;
      if (firstFrame) diag.startup.firstFrameMs = performance.now();
      if (state.frames % 15 === 0) {
        const speed = state.speed * boost;
        $("metrics").textContent =
          `${Math.round(1 / dt)} FPS · ${ws.width} × ${ws.height} · SPEED ${speed < 100 ? speed.toFixed(1) : Math.round(speed).toLocaleString()} m/s · ${formatElevation(body.terrain.elevation(state.y))}`;
        survey();
        updateGpu();
      }
      // Hand off immediately after the first completed frame, then keep periodic telemetry.
      if (embedded && (firstFrame || state.frames % 15 === 0))
        parent.postMessage(
          {
            type: "waterscape:frame",
            ms: diag.frameMs,
            reservoir: bodyId,
            tier: state.quality,
            struggling: diag.quality.struggling,
          },
          location.origin,
        );
    }
    requestAnimationFrame(frame);
  } catch (e) {
    fail(e);
  }
}
$("capture").onclick = async () => {
  const { data, width, height } = await ws.lab.readPixels(),
    c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(data.buffer), width, height), 0, 0);
  c.toBlob((blob) => {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${body.terrain.meta.name.replaceAll(" ", "-")}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
};
try {
  const progress = (text) => ($("loadText").textContent = text),
    bodyStarted = performance.now();
  body = await loadBody(bodyId, progress);
  const bodyLoaded = performance.now();
  ws = await createWaterscape(canvas, body, {
    onError: fail,
    onProgress: progress,
    time: q.has("t") ? Number(q.get("t")) : 0,
    playing: !q.has("t"),
  });
  // From here the engine's diagnostics are the page's; load errors carry over.
  ws.diag.errors.push(...diag.errors);
  diag = window.waterscapeDiagnostics = ws.diag;
  diag.startup = {
    bodyMs: bodyLoaded - bodyStarted,
    engineMs: performance.now() - bodyLoaded,
    firstFrameMs: null, // milliseconds since this iframe's navigation, including module loading
  };
  const vendor = ws.rt.describe().vendor,
    forced = forcedTier(q.get("quality"));
  if (forced === null) {
    governor = new QualityGovernor(startingLevel(vendor));
    ws.state.quality = governor.current.tier;
    $("quality").value = String(governor.current.width);
  } else ws.state.quality = forced;
  diag.quality = { tier: ws.state.quality, width: +$("quality").value, auto: !!governor, vendor, struggling: false };
  window.waterscapeLab = {
    ...ws.lab,
    state: ws.state,
    pause: () => play(false),
    resume: () => play(true),
    seek: async (t) => {
      play(false);
      return ws.lab.seek(t);
    },
  };
  updateGpu();
  applyPreset(q.get("preset"));
  // The bundle's usual look: Diablo Range hills are gold most of the year.
  $("season").value = body.land.defaultSeason === "spring" ? "0" : "1";
  $("season").options[1].textContent = summerLabel();
  // Only the presets this water body offers, default selected.
  for (const opt of [...$("preset").options]) opt.hidden = !body.land.presets.includes(opt.value);
  $("preset").value = ws.state.preset;
  $("preset").onchange = () => applyPreset($("preset").value);
  const { terrain } = body;
  document.title = `${terrain.meta.name} · Waterscape`;
  $("place").textContent = terrain.meta.name.toUpperCase();
  $("coords").textContent = formatLatLon(terrain.latLon(0, 0));
  intro();
  // Open at the waterline, where the shallow water and the land read best.
  if (body.viewpoints.shore) {
    ws.state.viewpoint = "shore";
    $("energy").value = 0.3;
  }
  buildViewpoints();
  const pose = q.get("pose")?.split(",").map(Number);
  if (pose?.length === 5 && pose.every(Number.isFinite))
    Object.assign(ws.state, { x: pose[0], y: pose[1], z: pose[2], yaw: pose[3], pitch: pose[4] });
  else Object.assign(ws.state, viewpoint(body, ws.state.viewpoint));
  $("waterLevel").textContent = formatElevation(terrain.waterLevel);
  $("dataLink").href = terrain.meta.service;
  labels();
  ws.resize(+$("quality").value);
  requestAnimationFrame(frame);
} catch (e) {
  fail(e);
}
