import * as THREE from "../../../../../../vendor/three/three.webgpu.js";
import { fetchLatestContinuous, fetchDailyValues } from "../../../../../core/adapters/usgs.js";
import { loadPlaceFromRegistry } from "../../../../../core/data-model/place-registry.js";
import { freeportDischarge } from "./freeport-discharge.js";
import { flowDisplay } from "../../../../../core/visual-bindings/flow-status.js";
import { dailyHydrograph } from "../../../../../core/visual-bindings/hydrograph.js";
import { matchingSeries } from "../../../../../core/data-model/binding-series.js";
import { FREEPORT_VIEWS, constrainFreeportCamera } from "./freeport-layout.js";
import { createFreeportSetting } from "./freeport-setting.js";
import { createFreeportWater, createFreeportSky } from "./freeport-water.js";
import { createJennerNoise } from "../../../../../scene-kit/water-noise.js";
import { loadBankMaterials } from "../../../../../scene-kit/bank-materials.js";
import { loadRiverTerrain } from "../../../../../scene-kit/terrain.js";
import { buildRiverTerrainGrid } from "../../../../../scene-kit/terrain-mesh.js";
import { loadHydrography } from "../../../../../scene-kit/hydrography.js";
import { FREEPORT_BRIDGE_ANGLES, freeportBridgeCamera } from "./freeport-bridge-layout.js";

const $ = selector => document.querySelector(selector), canvas = $("#scene"), keys = new Set(),
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)"), state = { ...FREEPORT_VIEWS.bridge },
  base = "./data/";
let activeView = "bridge", paused = false, dragging = null, terrain = null, world = null, manifest = null, portraitView = innerWidth < 600;
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
  activeView = view; Object.assign(state, { fov: 55 }, FREEPORT_VIEWS[view]); keys.clear(); constrainFreeportCamera(state, view, terrain);
  $("#bridge-angle-control").hidden = view !== "bridge";
  if (view === "bridge") setBridgeAngle($("#bridge-angle").value);
  if (innerWidth < 600 && view === "bank") { state.yaw = -2.86; state.pitch = -0.04; }
  for (const button of document.querySelectorAll("[data-view]")) {
    const active = button.dataset.view === view; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
  }
  if (world) { world.setting.visible = view !== "terrain"; world.water.mesh.visible = view !== "terrain"; world.map.visible = view === "terrain"; }
  if (view !== "bridge") $("#scene-state").textContent = FREEPORT_VIEWS[view].label;
}
function setBridgeAngle(angle) {
  Object.assign(state, { fov: 55 }, freeportBridgeCamera(angle, innerWidth < 600), { angle, speed: angle === "above" ? 16 : ["east", "west", "underside"].includes(angle) ? 4 : 8 });
  constrainFreeportCamera(state, "bridge"); keys.clear();
  const target = state.target, dx = target.x - state.x, dz = target.z - state.z;
  state.yaw = Math.atan2(dx, -dz); state.pitch = Math.atan2(target.y - state.y, Math.hypot(dx, dz));
  $("#scene-state").textContent = `${FREEPORT_BRIDGE_ANGLES[angle].label} · Reference reconstruction`;
}
$("#bridge-angle").onchange = e => setBridgeAngle(e.target.value);
for (const button of document.querySelectorAll("[data-view]")) button.onclick = () => setView(button.dataset.view);

async function refreshDischarge() {
  try {
    if (!manifest) manifest = (await loadPlaceFromRegistry({ registryUrl: "../../../../../registry.json", riverPack: "sacramento_river", placeId: "freeport" })).manifest;
    const binding = manifest.data_bindings.find(b => b.phenomenon === "discharge"),
      result = await fetchLatestContinuous(binding.feature_id, binding.parameter_code,
        (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) })),
      observed = freeportDischarge(result.quantities, binding, new Date().toISOString()), view = observed.presentation;
    const shown = flowDisplay(view);
    $("#flow-value").textContent = shown.value; $("#flow-value").classList.toggle("stale", shown.muted);
    $("#flow-quality").textContent = view.badge; $("#flow-time").textContent = shown.note;
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
// Thirty days of tidally filtered daily discharge: a separate product from the instantaneous card value.
async function loadHistory() {
  try {
    if (!manifest) manifest = (await loadPlaceFromRegistry({ registryUrl: "../../../../../registry.json", riverPack: "sacramento_river", placeId: "freeport" })).manifest;
    const binding = manifest.data_bindings.find(b => b.phenomenon === "tidally_filtered_discharge"),
      end = new Date(), start = new Date();
    end.setUTCDate(end.getUTCDate() - 1); start.setTime(end.getTime()); start.setUTCDate(start.getUTCDate() - 29);
    const result = await fetchDailyValues(binding.feature_id, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10),
        binding.parameter_code, binding.statistic_id, (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) })),
      chart = dailyHydrograph(matchingSeries(result.quantities, binding), { width: 300, height: 56, padding: 4, phenomenon: binding.phenomenon });
    if (chart.kind === "empty") return;
    const ns = "http://www.w3.org/2000/svg", svg = $("#flow-chart"), path = document.createElementNS(ns, "path");
    path.setAttribute("d", chart.path); svg.replaceChildren(path);
    svg.setAttribute("aria-label", `${chart.points.length} daily means, from ${chart.min.toLocaleString()} to ${chart.max.toLocaleString()} ft³/s`);
    $("#flow-chart-note").textContent = `30-day daily mean, tidally filtered · ${chart.min.toLocaleString()}–${chart.max.toLocaleString()} ft³/s`;
    $("#flow-history").hidden = false;
  } catch { /* the instantaneous card and source record remain available */ }
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
  const sun = new THREE.DirectionalLight(0xfff1d0, 2.5); sun.position.set(-500, 700, 170);
  sun.target.position.set(0, 0, -180); scene.add(sun.target); sun.castShadow = true;
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
  function resize() {
    renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    const portrait = innerWidth < 600;
    if (portrait !== portraitView && activeView === "bridge") setBridgeAngle($("#bridge-angle").value);
    portraitView = portrait;
  }
  window.addEventListener("resize", resize); resize();
  window.freeportScene = { renderer, scene, camera, terrain, state, ...world, get view() { return activeView; }, get paused() { return paused; } };
  let previous = performance.now(), seconds = 0, firstFrame = true;
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - previous) / 1000); previous = now; if (document.hidden) return;
    if (!paused && !reducedMotion.matches) seconds += dt;
    const forward = Number(keys.has("w") || keys.has("ArrowUp")) - Number(keys.has("s") || keys.has("ArrowDown")),
      strafe = Number(keys.has("d") || keys.has("ArrowRight")) - Number(keys.has("a") || keys.has("ArrowLeft"));
    if (forward || strafe) { const length = Math.hypot(forward, strafe); move(forward / length * state.speed * dt, strafe / length * state.speed * dt); }
    if (camera.fov !== state.fov) { camera.fov = state.fov; camera.updateProjectionMatrix(); }
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
loadHistory();
