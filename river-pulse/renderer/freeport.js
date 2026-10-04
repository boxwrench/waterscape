import * as THREE from "../../vendor/three/three.webgpu.js";
import { fetchLatestContinuous } from "../adapters/usgs.js";
import { loadPlaceFromRegistry } from "../data-model/place-registry.js";
import { freeportDischarge } from "../visual-bindings/freeport-discharge.js";
import { FREEPORT_VIEWS, constrainFreeportCamera } from "./freeport-layout.js";
import { createFreeportSetting } from "./freeport-setting.js";
import { createFreeportWater, createFreeportSky } from "./freeport-water.js";
import { createJennerNoise } from "./jenner-noise.js";
import { loadBankMaterials } from "./bank-materials.js";
import { loadRiverTerrain } from "./terrain.js";
import { buildRiverTerrainGrid } from "./terrain-mesh.js";
import { loadHydrography } from "./hydrography.js";

const $ = selector => document.querySelector(selector), canvas = $("#scene"), keys = new Set(),
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)"), state = { ...FREEPORT_VIEWS.bridge },
  base = "../data/sacramento_river/places/freeport/";
let activeView = "bridge", paused = false, dragging = null, terrain = null, world = null, manifest = null;
constrainFreeportCamera(state, activeView);

function inspect(open) {
  $("#inspector").hidden = !open; $("#inspect").setAttribute("aria-expanded", String(open));
  (open ? $("#inspect-close") : $("#inspect")).focus();
}
$("#inspect").onclick = () => inspect($("#inspector").hidden);
$("#inspect-close").onclick = () => inspect(false);
$("#explore").onclick = () => $("#explore").setAttribute("aria-pressed", String(document.body.classList.toggle("exploring")));
function motionLabel() {
  $("#pause").textContent = reducedMotion.matches ? "Reduced motion" : paused ? "Resume water" : "Pause water";
  $("#pause").setAttribute("aria-pressed", String(paused || reducedMotion.matches)); $("#pause").disabled = reducedMotion.matches;
}
$("#pause").onclick = () => { paused = !paused; motionLabel(); };
reducedMotion.addEventListener("change", motionLabel); motionLabel();
function setView(view) {
  activeView = view; Object.assign(state, FREEPORT_VIEWS[view]); keys.clear(); constrainFreeportCamera(state, view, terrain);
  if (innerWidth < 600 && view !== "terrain") { state.yaw = view === "bridge" ? -0.34 : -0.30; state.pitch = -0.025; }
  for (const button of document.querySelectorAll("[data-view]")) {
    const active = button.dataset.view === view; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
  }
  if (world) { world.setting.visible = view !== "terrain"; world.water.mesh.visible = view !== "terrain"; world.map.visible = view === "terrain"; }
  $("#scene-state").textContent = FREEPORT_VIEWS[view].label;
}
for (const button of document.querySelectorAll("[data-view]")) button.onclick = () => setView(button.dataset.view);

async function refreshDischarge() {
  try {
    if (!manifest) manifest = (await loadPlaceFromRegistry({ registryUrl: "../data/registry.json", riverPack: "sacramento_river", placeId: "freeport" })).manifest;
    const binding = manifest.data_bindings.find(b => b.phenomenon === "discharge"),
      result = await fetchLatestContinuous(binding.feature_id, binding.parameter_code,
        (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) })),
      observed = freeportDischarge(result.quantities, binding, new Date().toISOString()), view = observed.presentation;
    $("#flow-value").textContent = view.headline; $("#flow-quality").textContent = view.badge; $("#flow-time").textContent = view.detail;
    $("#evidence-summary").textContent = `${view.badge}. ${view.detail}. Latest at or before now; 45-minute freshness policy. Station, parameter, series, statistic, unit and evidence type must all match.`;
    $("#record").textContent = JSON.stringify({ binding, source_url: result.url, retrieval_time: result.retrieval_time, ...observed }, null, 2);
    window.freeportData = { ...observed, error: null };
  } catch (error) {
    $("#flow-value").textContent = "Observation unavailable"; $("#flow-quality").textContent = "Unavailable";
    $("#flow-time").textContent = "USGS could not be reached. The source record remains available.";
    $("#evidence-summary").textContent = "USGS connection unavailable. No current observation is substituted.";
    $("#record").textContent = JSON.stringify({ error: error.message }, null, 2);
    window.freeportData = { error: error.message };
  }
}
// Scientific data starts independently; graphics failure cannot suppress it.
refreshDischarge(); setInterval(() => { if (!document.hidden) refreshDischarge(); }, 60000);

canvas.addEventListener("pointerdown", e => { dragging = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.focus(); });
canvas.addEventListener("pointermove", e => {
  if (!dragging || dragging.id !== e.pointerId) return;
  state.yaw -= (e.clientX - dragging.x) * 0.003; state.pitch = Math.max(-1.25, Math.min(0.4, state.pitch - (e.clientY - dragging.y) * 0.003));
  dragging.x = e.clientX; dragging.y = e.clientY;
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(event, () => { dragging = null; });
function move(forward, strafe) {
  state.x += Math.sin(state.yaw) * forward + Math.cos(state.yaw) * strafe;
  state.z += -Math.cos(state.yaw) * forward + Math.sin(state.yaw) * strafe;
  if (activeView === "terrain") state.y += -Math.sin(state.pitch) * forward;
  constrainFreeportCamera(state, activeView, terrain);
}
canvas.addEventListener("wheel", e => { e.preventDefault(); move(Math.max(-1, Math.min(1, -e.deltaY / 150)) * state.speed * 2, 0); }, { passive: false });
window.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("#inspector").hidden) inspect(false);
  if (document.activeElement !== canvas) return;
  if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) { keys.add(e.key); e.preventDefault(); }
});
window.addEventListener("keyup", e => keys.delete(e.key)); window.addEventListener("blur", () => { keys.clear(); dragging = null; });
document.addEventListener("visibilitychange", () => { if (document.hidden) { keys.clear(); dragging = null; } });

function terrainMap(terrain, document, aerial) {
  const group = new THREE.Group(), grid = buildRiverTerrainGrid(terrain), geometry = new THREE.BufferGeometry(), uv = new Float32Array(grid.count * 2);
  for (let i = 0; i < grid.count; i++) {
    uv.set([(grid.positions[i * 3] - terrain.x0 + terrain.cellX / 2) / (terrain.width * terrain.cellX),
      1 - (grid.positions[i * 3 + 2] - terrain.z0 + terrain.cellZ / 2) / (terrain.height * terrain.cellZ)], i * 2);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(grid.positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1)); geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry, new THREE.MeshBasicNodeMaterial({ map: aerial })));
  const points = [];
  for (const feature of document.features.filter(f => f.name === "Sacramento River")) for (const line of feature.lines) for (let i = 1; i < line.length; i++) {
    for (const [x, z] of [line[i - 1], line[i]]) points.push(x, terrain.ground(x, z) + 1.5, z);
  }
  const lineGeometry = new THREE.BufferGeometry(); lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  group.add(new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: 0xc8eee5 })));
  group.name = "Sourced 3DEP terrain and 3DHP Sacramento centerline";
  group.userData = { bindingClass: "exact", elevationExaggeration: 1, mainstem: "Sacramento River" };
  return group;
}

async function main() {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: !navigator.gpu });
  await renderer.init(); renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 600 ? 1.2 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.03; renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xc9dce1); scene.fog = new THREE.FogExp2(0xc9dce1, 0.00018);
  scene.add(new THREE.HemisphereLight(0xdceaf1, 0x5b5942, 2));
  const sun = new THREE.DirectionalLight(0xfff1d0, 2.5); sun.position.set(-500, 700, 350); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = 0.25;
  Object.assign(sun.shadow.camera, { left: -350, right: 350, top: 350, bottom: -350, near: 1, far: 1600 }); scene.add(sun);
  const noise = createJennerNoise(), [maps, loadedTerrain, hydrography, aerial] = await Promise.all([
    loadBankMaterials(), loadRiverTerrain(`${base}terrain`), loadHydrography(`${base}hydrography.json`),
    new THREE.TextureLoader().loadAsync(`${base}aerial.jpg`),
  ]);
  aerial.colorSpace = THREE.SRGBColorSpace; aerial.anisotropy = 8;
  terrain = loadedTerrain; $("#status").textContent = "Lighting the bridge and riverbanks…";
  const water = createFreeportWater(noise), setting = await createFreeportSetting(noise, maps), map = terrainMap(terrain, hydrography, aerial);
  scene.add(createFreeportSky(noise), setting, water.mesh, map); world = { setting, water, map }; setView(activeView);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 16000); camera.rotation.order = "YXZ";
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  window.addEventListener("resize", resize); resize();
  window.freeportScene = { renderer, scene, camera, terrain, state, ...world, get view() { return activeView; }, get paused() { return paused; } };
  let previous = performance.now(), seconds = 0, firstFrame = true;
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - previous) / 1000); previous = now; if (document.hidden) return;
    if (!paused && !reducedMotion.matches) seconds += dt;
    const forward = Number(keys.has("w") || keys.has("ArrowUp")) - Number(keys.has("s") || keys.has("ArrowDown")),
      strafe = Number(keys.has("d") || keys.has("ArrowRight")) - Number(keys.has("a") || keys.has("ArrowLeft"));
    if (forward || strafe) { const length = Math.hypot(forward, strafe); move(forward / length * state.speed * dt, strafe / length * state.speed * dt); }
    camera.position.set(state.x, state.y, state.z); camera.rotation.set(state.pitch, -state.yaw, 0); water.update(seconds, reducedMotion.matches);
    try { renderer.render(scene, camera); if (firstFrame) { firstFrame = false; $("#loading").hidden = true; } }
    catch (error) { renderer.setAnimationLoop(null); fail(error); }
  });
}
function fail(error) {
  console.error("Freeport graphics unavailable", error); $("#loading").hidden = true; $("#scene-state").textContent = "Graphics unavailable";
  $("#error").hidden = false; $("#error").textContent = "The river scene could not start in this browser. Discharge, history and source evidence remain available.";
}
main().catch(fail);
