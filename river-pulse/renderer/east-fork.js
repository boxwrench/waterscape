import * as THREE from "../../vendor/three/three.webgpu.js";
import { loadPlaceFromRegistry } from "../data-model/place-registry.js";
import { FORK_VIEWS, constrainForkCamera, forkWaterGrid } from "./east-fork-layout.js";
import { uniform } from "../../vendor/three/three.tsl.js";
import { createJennerNoise } from "./jenner-noise.js";
import { createForkSetting } from "./east-fork-setting.js";
import { createJennerSky } from "./jenner-setting.js";
import { createAuthoredWater } from "./authored-water.js";
import { loadBankMaterials } from "./bank-materials.js";

const $ = selector => document.querySelector(selector), canvas = $("#scene"), keys = new Set(),
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)"), state = { ...FORK_VIEWS.shore };
let activeView = "shore", paused = false, dragging = null;

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
  activeView = button.dataset.view; Object.assign(state, FORK_VIEWS[activeView]); keys.clear();
  if (innerWidth < 600 && FORK_VIEWS[activeView].mobileYaw != null) state.yaw = FORK_VIEWS[activeView].mobileYaw;
  for (const b of document.querySelectorAll("[data-view]")) {
    const active = b === button; b.classList.toggle("active", active); b.setAttribute("aria-pressed", String(active));
  }
  if (window.eastForkScene) $("#scene-state").textContent = FORK_VIEWS[activeView].label;
};

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
  constrainForkCamera(state, activeView, previous);
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
  await loadPlaceFromRegistry({ registryUrl: "../data/registry.json", riverPack: "russian_river", placeId: "east_fork" });
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: !navigator.gpu });
  await renderer.init(); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  // Diffuse coastal daylight; rocks and logs cast contact shadows.
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb7cfd7);
  scene.fog = new THREE.FogExp2(0xb7cfd7, 0.0008);
  scene.add(new THREE.HemisphereLight(0xddeaf0, 0x6f6045, 1.1));
  const sun = new THREE.DirectionalLight(0xfff4dc, 2.1); sun.position.set(-140, 220, 110);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -300, right: 300, top: 350, bottom: -350, near: 1, far: 1500 });
  sun.shadow.normalBias = 0.4; scene.add(sun);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 24000); camera.rotation.order = "YXZ";
  const noise = createJennerNoise();
  $("#status").textContent = "Preparing earthfill, rock and river water…";
  const maps = await loadBankMaterials(), clock = uniform(0),
    water = createAuthoredWater(null, null, maps, forkWaterGrid()),
    setting = await createForkSetting(noise, maps, clock);
  water.mesh.visible = true; water.mesh.name = "East Fork illustrative water";
  scene.add(createJennerSky(noise), setting, water.mesh);
  const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  window.addEventListener("resize", resize); resize();
  window.eastForkScene = { renderer, scene, camera, water, setting, state, clock, get view() { return activeView; } };
  let previous = performance.now(), seconds = 0, firstFrame = true;
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - previous) / 1000); previous = now;
    if (document.hidden) return;
    if (!paused && !reducedMotion.matches) seconds += dt;
    const forward = Number(keys.has("w") || keys.has("ArrowUp")) - Number(keys.has("s") || keys.has("ArrowDown")),
      strafe = Number(keys.has("d") || keys.has("ArrowRight")) - Number(keys.has("a") || keys.has("ArrowLeft"));
    if (forward || strafe) { const length = Math.hypot(forward, strafe); move(forward / length * state.speed * dt, strafe / length * state.speed * dt); }
    camera.position.set(state.x, state.y, state.z); camera.rotation.set(state.pitch, -state.yaw, 0);
    water.update(seconds, reducedMotion.matches); clock.value = reducedMotion.matches ? 0 : seconds;
    try {
      renderer.render(scene, camera);
      if (firstFrame) { firstFrame = false; $("#loading").hidden = true; $("#scene-state").textContent = FORK_VIEWS[activeView].label; }
    } catch (error) { renderer.setAnimationLoop(null); fail(error); }
  });
}
function fail(error) {
  console.error("East Fork graphics unavailable", error); $("#loading").hidden = true;
  $("#scene-state").textContent = "Graphics unavailable";
  $("#error").hidden = false; $("#error").textContent = "The East Fork scene could not start on this browser. The river map and source references remain available.";
}
main().catch(fail);
