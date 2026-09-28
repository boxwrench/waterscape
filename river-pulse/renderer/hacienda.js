import * as THREE from "../../vendor/three/three.webgpu.js";
import { fly } from "../../renderer/engine/camera.js";
import { loadRiverTerrain } from "./terrain.js";
import { buildRiverTerrainGrid } from "./terrain-mesh.js";

const canvas = document.querySelector("#scene"),
  status = document.querySelector("#status"),
  coords = document.querySelector("#coords"),
  elevation = document.querySelector("#elevation"),
  errorBox = document.querySelector("#error"),
  overviewButton = document.querySelector("#overview"),
  bridgeButton = document.querySelector("#bridge"),
  TERRAIN_BASE = "../data/russian_river/places/hacienda_bridge/terrain";

const keys = new Set();
let dragging = false,
  lastX = 0,
  lastY = 0;

function fail(error) {
  console.error(error);
  status.textContent = "Terrain unavailable";
  errorBox.hidden = false;
  errorBox.textContent =
    `Hacienda terrain could not be loaded.\n\n${String(error)}\n\n` +
    "Generate it with:\npython pipeline/build_river_terrain.py river-pulse/data/russian_river/places/hacienda_bridge/source.json";
}

function pose(state, terrain, kind) {
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

async function main() {
  if (!navigator.gpu) throw new Error("WebGPU is required for the live terrain spike.");
  const terrain = await loadRiverTerrain(TERRAIN_BASE);
  status.textContent = `${terrain.meta.source} · ${terrain.meta.verticalDatum}`;

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  await renderer.init();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8bfd0);
  scene.fog = new THREE.FogExp2(0xa8bfd0, 0.00018);

  const grid = buildRiverTerrainGrid(terrain),
    geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(grid.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardNodeMaterial({ color: 0x70865a, roughness: 0.92, metalness: 0 });
  const land = new THREE.Mesh(geometry, material);
  scene.add(land);

  const hemi = new THREE.HemisphereLight(0xdcecff, 0x6e5a3d, 2.0),
    sun = new THREE.DirectionalLight(0xfff2d6, 3.2);
  sun.position.set(-3000, 5000, 1500);
  scene.add(hemi, sun);

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

  overviewButton.addEventListener("click", () => pose(state, terrain, "overview"));
  bridgeButton.addEventListener("click", () => pose(state, terrain, "bridge"));

  addEventListener("keydown", (event) => {
    keys.add(event.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  });
  addEventListener("keyup", (event) => keys.delete(event.code));

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
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
    dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener("wheel", (event) => {
    state.speed = Math.max(2, Math.min(250, state.speed * Math.exp(-event.deltaY * 0.001)));
    event.preventDefault();
  }, { passive: false });

  let previous = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now(),
      dt = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    fly(state, { keys, cruise: false }, dt, terrain);

    camera.position.set(state.x, state.y, state.z);
    camera.rotation.set(state.pitch, -state.yaw, 0);

    coords.textContent = formatLatLon(terrain.latLon(state.x, state.z));
    elevation.textContent = `${terrain.elevation(state.y).toFixed(1)} m NAVD88 · ${Math.round(state.y - terrain.ground(state.x, state.z))} m AGL`;
    renderer.render(scene, camera);
  });
}

main().catch(fail);
