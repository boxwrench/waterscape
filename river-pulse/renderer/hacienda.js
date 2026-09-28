import * as THREE from "../../vendor/three/three.webgpu.js";
import { fly, viewRay } from "../../renderer/engine/camera.js";
import { fetchLatestContinuous } from "../adapters/usgs.js";
import { riverState } from "../data-model/river-state.js";
import { latestAtOrBeforePolicy } from "../data-model/selection.js";
import { observedFlowStatus } from "../visual-bindings/flow-status.js";
import { loadRiverTerrain } from "./terrain.js";
import { buildRiverTerrainGrid } from "./terrain-mesh.js";

const canvas = document.querySelector("#scene"),
  status = document.querySelector("#status"),
  coords = document.querySelector("#coords"),
  elevation = document.querySelector("#elevation"),
  agl = document.querySelector("#agl"),
  inspectTitle = document.querySelector("#inspect-title"),
  sourceDetail = document.querySelector("#source-detail"),
  gaugeId = document.querySelector("#gauge-id"),
  gaugeWorldLabel = document.querySelector("#gauge-world-label"),
  flowValue = document.querySelector("#flow-value"),
  flowTime = document.querySelector("#flow-time"),
  flowQuality = document.querySelector("#flow-quality"),
  sceneState = document.querySelector("#scene-state"),
  loading = document.querySelector("#loading"),
  errorBox = document.querySelector("#error"),
  overviewButton = document.querySelector("#overview"),
  bridgeButton = document.querySelector("#bridge"),
  TERRAIN_BASE = "../data/russian_river/places/hacienda_bridge/terrain",
  SOURCE_URL = "../data/russian_river/places/hacienda_bridge/source.json";

const keys = new Set(),
  currentFlowPolicy = latestAtOrBeforePolicy({ maximumAgeMs: 45 * 60 * 1000 });
let dragging = false,
  downX = 0,
  downY = 0,
  lastX = 0,
  lastY = 0,
  selected = null;

function fail(error) {
  console.error(error);
  status.textContent = "Terrain unavailable";
  sceneState.textContent = "Build required";
  loading.classList.add("ready");
  errorBox.hidden = false;
  errorBox.textContent =
    `Hacienda terrain could not be loaded.\n\n${String(error)}\n\n` +
    "Generate it with:\npython pipeline/build_river_terrain.py river-pulse/data/russian_river/places/hacienda_bridge/source.json";
}

function setActiveView(kind) {
  overviewButton.classList.toggle("active", kind === "overview");
  bridgeButton.classList.toggle("active", kind === "bridge");
}

function pose(state, terrain, kind) {
  selected = null;
  inspectTitle.textContent = "Camera position";
  setActiveView(kind);
  if (kind === "bridge") {
    Object.assign(state, {
      x: -120,
      z: 180,
      y: terrain.ground(-120, 180) + 55,
      yaw: 2.65,
      pitch: -0.22,
      speed: 12,
    });
  } else {
    Object.assign(state, {
      x: -900,
      z: 650,
      y: terrain.ground(-900, 650) + 520,
      yaw: 2.45,
      pitch: -0.68,
      speed: 55,
    });
  }
}

function formatLatLon([lat, lon]) {
  return `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`;
}

function setFlowPresentation(presentation) {
  flowValue.textContent = presentation.headline;
  flowTime.textContent = presentation.detail;
  flowQuality.className = `flow-quality ${presentation.kind}`;
  flowQuality.textContent = presentation.badge;
}

async function updateObservedFlow(monitoringLocationId) {
  try {
    const result = await fetchLatestContinuous(monitoringLocationId),
      validTime = new Date().toISOString(),
      selection = currentFlowPolicy.select(result.quantities, validTime),
      state = riverState({
        validTime,
        features: { gauges: [{ id: monitoringLocationId }] },
        selections: [
          {
            feature_id: monitoringLocationId,
            phenomenon: "discharge",
            policy_id: currentFlowPolicy.id,
            result: selection,
          },
        ],
      }),
      presentation = observedFlowStatus(state, monitoringLocationId);

    // Exposed for inspection/debugging; the page renders the presentation, not raw API records.
    window.riverPulseState = state;
    window.riverPulseFlowPresentation = presentation;
    setFlowPresentation(presentation);
  } catch (error) {
    console.warn("Observed flow unavailable", error);
    setFlowPresentation({
      kind: "unavailable",
      badge: "Offline",
      headline: "Flow data unavailable",
      detail: "Terrain remains available; USGS request could not be completed",
    });
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function main() {
  if (!navigator.gpu) throw new Error("WebGPU is required for the live terrain prototype.");

  const [terrain, source] = await Promise.all([loadRiverTerrain(TERRAIN_BASE), fetchJson(SOURCE_URL)]);
  const gaugeAgency = source.gauge?.agency ?? "USGS",
    gaugeNumber = source.gauge?.id ?? "11467000",
    monitoringLocationId = `${gaugeAgency}-${gaugeNumber}`;
  gaugeId.textContent = `${gaugeAgency} ${gaugeNumber}`;
  gaugeWorldLabel.querySelector("span").textContent = `${gaugeAgency} ${gaugeNumber}`;
  sourceDetail.textContent =
    `${terrain.meta.source}. Horizontal reference ${terrain.meta.crs}; vertical reference ${terrain.meta.verticalDatum}. ` +
    `Scene coordinates preserve the absolute elevation relationship; no reservoir water-level assumption is used.`;
  status.textContent = "Terrain ready";
  sceneState.textContent = "Terrain loaded";

  // Flow is intentionally independent of terrain startup: network/data failure must not prevent exploration.
  updateObservedFlow(monitoringLocationId);

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  await renderer.init();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9bec7);
  scene.fog = new THREE.FogExp2(0xa8bdc3, 0.00016);

  const grid = buildRiverTerrainGrid(terrain),
    geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(grid.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardNodeMaterial({ color: 0x718559, roughness: 0.94, metalness: 0 });
  const land = new THREE.Mesh(geometry, material);
  scene.add(land);

  const hemi = new THREE.HemisphereLight(0xd9e9ee, 0x67573f, 2.1),
    sun = new THREE.DirectionalLight(0xffefd0, 3.4);
  sun.position.set(-3000, 5000, 1500);
  scene.add(hemi, sun);

  // The configured anchor is the USGS Hacienda gauge, so it is local (0, 0) by construction.
  const gaugeGround = terrain.ground(0, 0),
    gaugeMaterial = new THREE.MeshBasicNodeMaterial({ color: 0x8bd7bd }),
    gaugeBeacon = new THREE.Group(),
    gaugePost = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 13, 10), gaugeMaterial),
    gaugeRing = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.18, 10, 40), gaugeMaterial);
  gaugePost.position.y = 6.5;
  gaugeRing.position.y = 13;
  gaugeRing.rotation.x = Math.PI / 2;
  gaugeBeacon.add(gaugePost, gaugeRing);
  gaugeBeacon.position.set(0, gaugeGround + 1, 0);
  scene.add(gaugeBeacon);
  const gaugeLabelPoint = new THREE.Vector3(0, gaugeGround + 16, 0),
    gaugeProjection = new THREE.Vector3();

  const markerMaterial = new THREE.MeshBasicNodeMaterial({ color: 0x8bd7bd }),
    marker = new THREE.Mesh(new THREE.SphereGeometry(3.2, 20, 12), markerMaterial);
  marker.visible = false;
  scene.add(marker);

  const camera = new THREE.PerspectiveCamera(64, 1, 1, 50000);
  camera.rotation.order = "YXZ";
  const state = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 40 };
  pose(state, terrain, "overview");

  function resize() {
    const width = innerWidth,
      height = innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();

  overviewButton.addEventListener("click", () => {
    marker.visible = false;
    pose(state, terrain, "overview");
  });
  bridgeButton.addEventListener("click", () => {
    marker.visible = false;
    pose(state, terrain, "bridge");
  });

  addEventListener("keydown", (event) => {
    keys.add(event.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  });
  addEventListener("keyup", (event) => keys.delete(event.code));

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    downX = lastX = event.clientX;
    downY = lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    state.yaw -= (event.clientX - lastX) * 0.004;
    state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch - (event.clientY - lastY) * 0.004));
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener("pointerup", (event) => {
    const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
    dragging = false;
    canvas.releasePointerCapture(event.pointerId);
    if (moved > 5) return;

    const sx = (event.clientX / innerWidth) * 2 - 1,
      sy = 1 - (event.clientY / innerHeight) * 2,
      ray = viewRay(sx, sy, camera.aspect, state.yaw, state.pitch),
      hit = terrain.pick(state.x, state.y, state.z, ray[0], ray[1], ray[2]);
    if (!hit) return;
    selected = hit;
    inspectTitle.textContent = "Selected terrain";
    marker.position.set(hit.x, hit.y + 2.2, hit.z);
    marker.visible = true;
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      state.speed = Math.max(2, Math.min(250, state.speed * Math.exp(-event.deltaY * 0.001)));
      event.preventDefault();
    },
    { passive: false },
  );

  loading.classList.add("ready");

  let previous = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now(),
      dt = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    fly(state, { keys, cruise: false }, dt, terrain);

    camera.position.set(state.x, state.y, state.z);
    camera.rotation.set(state.pitch, -state.yaw, 0);

    if (selected) {
      coords.textContent = formatLatLon(terrain.latLon(selected.x, selected.z));
      elevation.textContent = `${selected.elevation.toFixed(1)} m NAVD88`;
      agl.textContent = "Terrain surface";
    } else {
      coords.textContent = formatLatLon(terrain.latLon(state.x, state.z));
      elevation.textContent = `${terrain.elevation(state.y).toFixed(1)} m NAVD88`;
      agl.textContent = `${Math.round(state.y - terrain.ground(state.x, state.z))} m`;
    }

    gaugeProjection.copy(gaugeLabelPoint).project(camera);
    const gaugeVisible =
      gaugeProjection.z > -1 &&
      gaugeProjection.z < 1 &&
      Math.abs(gaugeProjection.x) < 1.08 &&
      Math.abs(gaugeProjection.y) < 1.08;
    gaugeWorldLabel.classList.toggle("visible", gaugeVisible);
    if (gaugeVisible) {
      gaugeWorldLabel.style.left = `${(gaugeProjection.x * 0.5 + 0.5) * innerWidth}px`;
      gaugeWorldLabel.style.top = `${(-gaugeProjection.y * 0.5 + 0.5) * innerHeight}px`;
    }

    renderer.render(scene, camera);
  });
}

main().catch(fail);
