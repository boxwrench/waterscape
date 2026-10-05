import * as THREE from "../../../../../../vendor/three/three.webgpu.js";
import { fetchLatestContinuous, STREAM_LEVEL_NAVD88_PARAMETER_CODE } from "../../../../../core/adapters/usgs.js";
import { loadPlaceFromRegistry } from "../../../../../core/data-model/place-registry.js";
import { JENNER_GAUGE, jennerLevelState, jennerLevelPresentation } from "./jenner-level.js";
import { JENNER_VIEWS, constrainJennerCamera } from "./jenner-layout.js";
import { createJennerNoise } from "../../../../../scene-kit/water-noise.js";
import { createJennerSetting, createJennerSky } from "./jenner-setting.js";
import { createJennerWater } from "./jenner-water.js";
import { loadBankMaterials } from "../../../../../scene-kit/bank-materials.js";

const $ = selector => document.querySelector(selector), canvas = $("#scene"), keys = new Set(),
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)"), state = { ...JENNER_VIEWS.lookout };
let activeView = "lookout", paused = false, dragging = null;

function inspect(open) {
  $("#inspector").hidden = !open; $("#inspect").setAttribute("aria-expanded", String(open));
  if (open) $("#inspect-close").focus(); else $("#inspect").focus();
}
$("#inspect").onclick = () => inspect($("#inspector").hidden);
$("#inspect-close").onclick = () => inspect(false);
$("#explore").onclick = () => {
  const exploring = document.body.classList.toggle("exploring");
  $("#explore").setAttribute("aria-pressed", String(exploring));
};
function motionLabel() {
  $("#pause").textContent = reducedMotion.matches ? "Reduced motion" : paused ? "Resume water" : "Pause water";
  $("#pause").setAttribute("aria-pressed", String(paused || reducedMotion.matches));
  $("#pause").disabled = reducedMotion.matches;
}
$("#pause").onclick = () => { paused = !paused; motionLabel(); };
reducedMotion.addEventListener("change", motionLabel); motionLabel();
for (const button of document.querySelectorAll("[data-view]")) button.onclick = () => {
  activeView = button.dataset.view; Object.assign(state, JENNER_VIEWS[activeView]); keys.clear();
  if (innerWidth < 600 && JENNER_VIEWS[activeView].mobileYaw != null) state.yaw = JENNER_VIEWS[activeView].mobileYaw;
  for (const b of document.querySelectorAll("[data-view]")) {
    const active = b === button; b.classList.toggle("active", active); b.setAttribute("aria-pressed", String(active));
  }
  if (window.jennerScene) $("#scene-state").textContent = JENNER_VIEWS[activeView].label;
};

function showEvidence(quantities, error = null) {
  const selected = jennerLevelState(quantities, new Date().toISOString()), view = jennerLevelPresentation(selected),
    q = selected.selected_quantities[0], stale = selected.missing_quantities[0]?.stale_quantity;
  $("#level-value").textContent = view.value; $("#level-quality").textContent = view.quality;
  $("#level-time").textContent = error ? "USGS connection unavailable. Source record remains available." :
    view.time ? `${view.quality === "Stale" ? "Last record · " : ""}${new Date(view.time).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}` : "No eligible current water-level record.";
  const evidence = $("#evidence"); evidence.replaceChildren();
  for (const [label, value] of [
    ["Status", error ?? view.quality], ["Station", "USGS 11467270 · Highway 1 Bridge"],
    ["Quantity", "Water surface elevation · ft NAVD88"], ["Valid time", view.time ?? "Unavailable"],
    ["Selection", "Latest at or before now; maximum age 45 minutes"],
    ["Source flags", (q ?? stale)?.source_flags?.join(", ") || "None reported"],
    ["Scene", view.note],
  ]) {
    const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = label; dd.textContent = value;
    evidence.append(dt, dd);
  }
  $("#record").textContent = JSON.stringify({ selected, last_received_records: quantities }, null, 2);
  window.jennerData = { state: selected, presentation: view, error };
}
async function refreshLevel() {
  try {
    const result = await fetchLatestContinuous(JENNER_GAUGE, STREAM_LEVEL_NAVD88_PARAMETER_CODE,
      (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(12000) }));
    showEvidence(result.quantities);
  } catch (error) { showEvidence([], String(error.message)); }
}
// Data and its controls start independently of graphics and asset loading.
refreshLevel();
setInterval(() => { if (!document.hidden) refreshLevel(); }, 60000);

canvas.addEventListener("pointerdown", e => { dragging = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.focus(); });
canvas.addEventListener("pointermove", e => {
  if (!dragging || dragging.id !== e.pointerId) return;
  state.yaw -= (e.clientX - dragging.x) * 0.003;
  state.pitch = Math.max(-0.85, Math.min(0.55, state.pitch - (e.clientY - dragging.y) * 0.003));
  dragging.x = e.clientX; dragging.y = e.clientY;
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(event, () => { dragging = null; });
function move(forward, strafe) {
  const previous = { ...state };
  state.x += Math.sin(state.yaw) * forward + Math.cos(state.yaw) * strafe;
  state.z += -Math.cos(state.yaw) * forward + Math.sin(state.yaw) * strafe;
  constrainJennerCamera(state, activeView, previous);
}
canvas.addEventListener("wheel", e => { e.preventDefault(); move(Math.max(-12, Math.min(12, -e.deltaY * 0.025)), 0); }, { passive: false });
window.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("#inspector").hidden) inspect(false);
  if (document.activeElement !== canvas) return;
  if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) { keys.add(e.key); e.preventDefault(); }
});
window.addEventListener("keyup", e => keys.delete(e.key));
window.addEventListener("blur", () => { keys.clear(); dragging = null; });
document.addEventListener("visibilitychange", () => { if (document.hidden) keys.clear(); });

async function main() {
  await loadPlaceFromRegistry({ registryUrl: "../../../../../registry.json", riverPack: "russian_river", placeId: "jenner" });
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: !navigator.gpu });
  await renderer.init(); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  // Diffuse coastal daylight; rocks and logs cast contact shadows.
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xc5d6d7);
  scene.fog = new THREE.FogExp2(0xc5d6d7, 0.00014);
  scene.add(new THREE.HemisphereLight(0xddeaf0, 0x635e48, 2.0));
  const sun = new THREE.DirectionalLight(0xfff4dc, 2.1); sun.position.set(-700, 1000, 470);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -1400, right: 1400, top: 1500, bottom: -1500, near: 1, far: 3500 });
  sun.shadow.normalBias = 0.4; scene.add(sun);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 24000); camera.rotation.order = "YXZ";
  const noise = createJennerNoise();
  $("#status").textContent = "Preparing sand, rock and coastal water…";
  const maps = await loadBankMaterials().catch(error => { console.warn("Coastal bank textures unavailable", error); return null; }),
    water = createJennerWater(noise, maps), setting = await createJennerSetting(noise, maps, water.clock);
  scene.add(createJennerSky(noise), setting, water.group);
  const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  window.addEventListener("resize", resize); resize();
  window.jennerScene = { renderer, scene, camera, water, setting, state, get view() { return activeView; } };
  let previous = performance.now(), seconds = 0, firstFrame = true;
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - previous) / 1000); previous = now;
    if (document.hidden) return;
    if (!paused && !reducedMotion.matches) seconds += dt;
    const forward = Number(keys.has("w") || keys.has("ArrowUp")) - Number(keys.has("s") || keys.has("ArrowDown")),
      strafe = Number(keys.has("d") || keys.has("ArrowRight")) - Number(keys.has("a") || keys.has("ArrowLeft"));
    if (forward || strafe) { const length = Math.hypot(forward, strafe); move(forward / length * state.speed * dt, strafe / length * state.speed * dt); }
    camera.position.set(state.x, state.y, state.z); camera.rotation.set(state.pitch, -state.yaw, 0);
    water.update(seconds, reducedMotion.matches);
    try {
      renderer.render(scene, camera);
      if (firstFrame) { firstFrame = false; $("#loading").hidden = true; $("#scene-state").textContent = JENNER_VIEWS[activeView].label; }
    } catch (error) { renderer.setAnimationLoop(null); fail(error); }
  });
}
function fail(error) {
  console.error("Jenner graphics unavailable", error); $("#loading").hidden = true;
  $("#scene-state").textContent = "Graphics unavailable";
  $("#error").hidden = false; $("#error").textContent = "The coastal scene could not start on this browser. Water observations and source evidence remain available.";
}
main().catch(fail);
