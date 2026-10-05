import * as THREE from "../../vendor/three/three.webgpu.js";
import { fly, viewRay } from "../../renderer/engine/camera.js";
import {
  fetchMajorRiverGeometry,
  RUSSIAN_RIVER_NAME,
} from "../adapters/dwr-hydrography.js";
import { fetchDailyValues, fetchLatestContinuous } from "../adapters/usgs.js";
import {
  resolveGaugeDischargeState,
  GAUGE_TIME_MODES,
} from "../data-model/gauge-time-state.js";
import { loadPlaceFromRegistry } from "../data-model/place-registry.js";
import { observedFlowStatus } from "../visual-bindings/flow-status.js";
import { dailyHydrograph } from "../visual-bindings/hydrograph.js";
import { buildRiverCenterlineSegments } from "./river-centerline.js";
import { loadRiverTerrain } from "./terrain.js";
import { buildRiverTerrainGrid } from "./terrain-mesh.js";
import { elevationColors } from "./terrain-style.js";
import { loadHydrography, createHydrographyLayer } from "./hydrography.js";
import { loadBankMaterials } from "./bank-materials.js";
import { createHaciendaBeach } from "./hacienda-beach.js";
import { beachGround, constrainBeachCamera } from "./beach-layout.js";
import { HACIENDA_EXTREMES, sceneWaterLevel } from "../visual-bindings/hacienda-extremes.js";
import { createMapFlow } from "./map-flow.js";
import { createAuthoredWater } from "./authored-water.js";
import { centerlineConditionStyle } from "../visual-bindings/condition-centerline.js";

const canvas = document.querySelector("#scene"),
  status = document.querySelector("#status"),
  coords = document.querySelector("#coords"),
  elevation = document.querySelector("#elevation"),
  agl = document.querySelector("#agl"),
  inspectTitle = document.querySelector("#inspect-title"),
  sourceDetail = document.querySelector("#source-detail"),
  gaugeId = document.querySelector("#gauge-id"),
  gaugeWorldLabel = document.querySelector("#gauge-world-label"),
  historyLine = document.querySelector("#history-line"),
  historyArea = document.querySelector("#history-area"),
  historyEmpty = document.querySelector("#history-empty"),
  historyStatus = document.querySelector("#history-status"),
  historyStart = document.querySelector("#history-start"),
  historyRange = document.querySelector("#history-range"),
  historyEnd = document.querySelector("#history-end"),
  sceneState = document.querySelector("#scene-state"),
  loading = document.querySelector("#loading"),
  errorBox = document.querySelector("#error"),
  overviewButton = document.querySelector("#overview"),
  bridgeButton = document.querySelector("#bridge"),
  shallowsButton = document.querySelector("#shallows"),
  TERRAIN_BASE = "../data/russian_river/places/hacienda_bridge/terrain",
  SOURCE_URL = "../data/russian_river/places/hacienda_bridge/source.json";

const keys = new Set();
let dragging = false,
  downX = 0,
  downY = 0,
  lastX = 0,
  lastY = 0,
  selected = null,
  cameraTransition = null,
  activeView = "overview",
  authoredWater = null,
  bankSetting = null,
  mapFlow = null,
  mapObjects = null;

function fail(error) {
  console.error(error);
  status.textContent = "Terrain unavailable";
  sceneState.textContent = "3D view unavailable";
  loading.classList.add("ready");
  errorBox.hidden = false;
  errorBox.replaceChildren();
  const title = document.createElement("strong"),
    detail = document.createElement("span"),
    retry = document.createElement("button");
  title.textContent = "The landscape couldn't load";
  detail.textContent =
    "You can still explore river observations and history. Try reloading to restore the 3D view.";
  retry.textContent = "Try again";
  retry.addEventListener("click", () => location.reload());
  errorBox.append(title, detail, retry);
}

function setActiveView(kind) {
  activeView = kind;
  shallowsButton.classList.toggle("active", kind === "shallows");
  shallowsButton.setAttribute("aria-pressed", String(kind === "shallows"));
  updateWaterVisibility();
  overviewButton.classList.toggle("active", kind === "overview");
  bridgeButton.classList.toggle("active", kind === "bridge");
  overviewButton.setAttribute("aria-pressed", String(kind === "overview"));
  bridgeButton.setAttribute("aria-pressed", String(kind === "bridge"));
}

function pose(state, terrain, kind, animate = true) {
  selected = null;
  inspectTitle.textContent = "Camera position";
  const switchingWorld = (activeView === "overview") !== (kind === "overview");
  setActiveView(kind);
  let target;
  if (kind === "shallows" && authoredWater) {
    target = bankSetting ? { ...bankSetting.camera } : {
      x: authoredWater.focus.x - 16,
      z: authoredWater.focus.z + 28,
      y: terrain.ground(authoredWater.focus.x - 16, authoredWater.focus.z + 28) + 8,
      yaw: Math.atan2(16, 28), pitch: -0.24, speed: 6,
    };
  } else if (kind === "bridge" && bankSetting) {
    target = { ...bankSetting.bridgeCamera };
  } else {
    target = {
      x: -900,
      z: 650,
      y: terrain.ground(-900, 650) + 520,
      yaw: Math.atan2(900, 650),
      pitch: -0.52,
      speed: 55,
    };
  }
  if (animate && !switchingWorld && !matchMedia("(prefers-reduced-motion: reduce)").matches)
    cameraTransition = { from: { ...state }, target, start: performance.now() };
  else {
    Object.assign(state, target);
    cameraTransition = null;
  }
}

function formatLatLon([lat, lon]) {
  return `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`;
}

function formatDate(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(date);
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function setHistoryPresentation(graph) {
  window.riverPulseHistory = graph;
  dispatchEvent(
    new CustomEvent("river-pulse-history-change", { detail: { graph } }),
  );
  if (graph.kind !== "series") {
    historyLine.setAttribute("d", "");
    historyArea.setAttribute("d", "");
    historyEmpty.hidden = false;
    historyStatus.textContent = "No eligible values";
    historyStart.textContent = "—";
    historyRange.textContent = "—";
    historyEnd.textContent = "—";
    return;
  }

  const bottom = 84,
    areaPath = graph.segments
      .map((points) => {
        const a = points[0],
          b = points.at(-1);
        return (
          `M${a.x.toFixed(2)},${bottom} ` +
          points.map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") +
          ` L${b.x.toFixed(2)},${bottom} Z`
        );
      })
      .join(" ");
  historyLine.setAttribute("d", graph.path);
  historyArea.setAttribute("d", areaPath);
  historyEmpty.hidden = true;
  historyStatus.textContent = `${graph.points.length} daily values`;
  historyStart.textContent = formatDate(graph.first_time);
  historyRange.textContent = `${Math.round(graph.min).toLocaleString()}–${Math.round(graph.max).toLocaleString()} ft³/s`;
  historyEnd.textContent = formatDate(graph.last_time);
}

async function updateObservedFlow(monitoringLocationId) {
  try {
    const result = await fetchLatestContinuous(monitoringLocationId),
      validTime = new Date().toISOString(),
      state = resolveGaugeDischargeState({
        featureId: monitoringLocationId,
        validTime,
        mode: GAUGE_TIME_MODES.CURRENT_CONTINUOUS,
        continuousQuantities: result.quantities,
      }),
      presentation = observedFlowStatus(state, monitoringLocationId);

    window.riverPulseCurrentState = state;
    window.riverPulseFlowPresentation = presentation;
    dispatchEvent(
      new CustomEvent("river-pulse-current-change", {
        detail: { state, monitoringLocationId },
      }),
    );
  } catch (error) {
    console.warn("Observed flow unavailable", error);
    const state = resolveGaugeDischargeState({
      featureId: monitoringLocationId,
      validTime: new Date().toISOString(),
      mode: GAUGE_TIME_MODES.CURRENT_CONTINUOUS,
    });
    window.riverPulseCurrentState = state;
    dispatchEvent(
      new CustomEvent("river-pulse-current-change", {
        detail: { state, monitoringLocationId, offline: true },
      }),
    );
  }
}

async function updateRecentHistory(monitoringLocationId) {
  const end = new Date(),
    start = new Date(end.getTime() - 44 * 24 * 60 * 60 * 1000);
  try {
    const result = await fetchDailyValues(
        monitoringLocationId,
        dateOnly(start),
        dateOnly(end),
      ),
      graph = dailyHydrograph(result.quantities, {
        width: 320,
        height: 86,
        padding: 7,
      });
    setHistoryPresentation(graph);
  } catch (error) {
    console.warn("Historical flow unavailable", error);
    setHistoryPresentation({
      kind: "empty",
      points: [],
      path: "",
      min: null,
      max: null,
      first_time: null,
      last_time: null,
    });
    historyStatus.textContent = "History offline";
  }
}

async function addRiverCenterline(scene, terrain) {
  try {
    try {
      const hydrography = await loadHydrography(
          "../data/russian_river/places/hacienda_bridge/hydrography.json",
        ),
        group = createHydrographyLayer(hydrography, terrain);
      let maps = null;
      try { maps = await loadBankMaterials(); }
      catch (error) {
        console.warn("Keeping optical preview without bank textures", error);
        document.querySelector("#water-disclosure").textContent +=
          " Bank textures are unavailable; the water currently uses a procedural bed.";
      }
      bankSetting = await createHaciendaBeach(maps);
      scene.add(bankSetting.group);
      window.riverPulseBankSetting = bankSetting;
      authoredWater = createAuthoredWater(hydrography, terrain, maps, bankSetting.waterGrid);
      mapFlow = createMapFlow(hydrography, terrain);
      group.add(mapFlow.mesh);
      mapFlow.applyState(window.riverPulseState ?? window.riverPulseCurrentState);
      mapFlow.applyHistory(window.riverPulseHistory);
      addEventListener("river-pulse-history-change", (event) => mapFlow.applyHistory(event.detail.graph));
      addEventListener("river-pulse-state-change", (event) => mapFlow.applyState(event.detail.state));
      window.riverPulseMapFlow = mapFlow;
      if (authoredWater) {
        group.add(authoredWater.mesh);
        shallowsButton.disabled = false;
        bridgeButton.disabled = false;
        window.riverPulseAuthoredWater = authoredWater;
      }
      scene.add(group);
      connectRiverLayer(
        group,
        group.getObjectByName("3DHP Russian River flowline"),
      );
      window.riverPulseHydrography = Object.freeze({
        source: hydrography.source,
        representation: group.userData.representation,
      });
      updateWaterVisibility();
      sourceDetail.textContent += ` River centerlines: ${hydrography.source}. Cartographic context, not measured width or depth.`;
      return;
    } catch {
      /* Generated bundle is optional; fall back to authoritative DWR context. */
    }
    const outWkid = 32600 + Number(terrain.meta.utmZone),
      result = await fetchMajorRiverGeometry(RUSSIAN_RIVER_NAME, { outWkid }),
      mapped = buildRiverCenterlineSegments(result.layer, terrain, {
        lift: 2.2,
        margin: 60,
      });
    if (!mapped.segment_count) {
      console.warn(
        "Russian River centerline returned no segments inside the Hacienda terrain extent",
      );
      return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(mapped.positions, 3),
    );
    const material = new THREE.LineBasicMaterial({
        color: 0x72d2df,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
      line = new THREE.LineSegments(geometry, material);
    line.renderOrder = 2;
    scene.add(line);
    connectRiverLayer(line, line);

    window.riverPulseHydrography = Object.freeze({
      source: result.layer,
      mapped,
      representation:
        "DWR NHD cartographic centerline overlay; not channel width, depth, or water surface",
    });
    sceneState.textContent = "Terrain + river";
    sourceDetail.textContent +=
      " Russian River centerline uses California DWR NHD Major Rivers; the line is a cartographic centerline, not measured channel width, depth, or water-surface geometry.";
  } catch (error) {
    console.warn("River centerline unavailable", error);
  }
}

// Water height in the authored scenes. "selected" follows the timeline's discharge; low and high
// preview the records. Height is an Illustrative compression of discharge (see
// visual-bindings/hacienda-extremes.js); the real feet and ft³/s stay in the readout.
const stage = {
  mode: "selected", cfs: null, level: 0, target: 0,
  discharge() {
    return this.mode === "low" ? HACIENDA_EXTREMES.low.dischargeCfs
      : this.mode === "high" ? HACIENDA_EXTREMES.high.dischargeCfs : this.cfs;
  },
  apply(reducedMotion = false) {
    this.target = sceneWaterLevel(this.discharge());
    if (reducedMotion) this.level = this.target;
    const buttons = { selected: "#stage-selected", low: "#stage-low", high: "#stage-high" };
    for (const [mode, id] of Object.entries(buttons)) {
      const b = document.querySelector(id);
      b?.classList.toggle("active", mode === this.mode);
      b?.setAttribute("aria-pressed", String(mode === this.mode));
    }
    const readout = document.querySelector("#stage-readout"), fmt = (n) => n.toLocaleString("en-US");
    if (!readout) return;
    const e = HACIENDA_EXTREMES;
    readout.textContent = this.mode === "low"
      ? `${e.low.label}: ${e.low.dischargeCfs} ft³/s daily mean, ${e.low.date}. USGS publishes no stage for it.`
      : this.mode === "high"
        ? `${e.high.label}: ${e.high.stageFt} ft (${fmt(e.high.dischargeCfs)} ft³/s), ${e.high.date}.`
        : this.cfs == null ? "No discharge for the selected time; water stays at its baseline."
          : `Selected time: ${fmt(Math.round(this.cfs))} ft³/s.`;
    readout.title = "Water height is a compressed illustration: 1.1 m per tenfold change in discharge. The real change from low to record high is about 15 m.";
    this.update?.();
  },
};
addEventListener("river-pulse-state-change", (event) => {
  const q = event.detail.state?.selected_quantities?.find((v) => v.phenomenon === "discharge" &&
    v.availability === "present" && Number.isFinite(v.value));
  stage.cfs = q ? q.value : null;
  stage.apply();
});

function updateWaterVisibility() {
  const stageControl = document.querySelector("#stage-control");
  if (stageControl) stageControl.hidden = activeView === "overview" || !authoredWater?.stageAware;
  if (authoredWater) authoredWater.mesh.visible = activeView !== "overview";
  const authored = activeView !== "overview" && Boolean(bankSetting);
  if (bankSetting) bankSetting.group.visible = authored;
  if (mapFlow) mapFlow.mesh.visible = !authored;
  if (mapObjects) {
    mapObjects.land.visible = !authored;
    mapObjects.gaugeBeacon.visible = !authored;
    mapObjects.scene.background.setHex(authored ? 0x9ad8f2 : 0xc5d0c8);
    mapObjects.scene.fog.color.setHex(authored ? 0xb8dce7 : 0xc5d0c8);
    mapObjects.scene.fog.density = authored ? 0.001 : 0.00026;
    mapObjects.hemi.intensity = authored ? 1.1 : 1.8;
    mapObjects.sun.intensity = authored ? 2.5 : 2.3;
    mapObjects.sun.castShadow = authored;
    mapObjects.sun.position.set(...(authored ? [110, 120, 30] : [-3000, 5000, 1500]));
    mapObjects.sun.target.position.set(0, 0, authored ? -70 : 0);
  }
  const context = window.riverPulseRiverLayer?.getObjectByName("3DHP context flowlines");
  if (context) context.visible = !authored;
  sceneState.textContent = authored ? "Hacienda · authored scene" : "Map · flow-scaled water ribbon";
  document.querySelector("#scene-reference").textContent = authored ? "Photo-informed setting" : "3DEP / NAVD88";
  document.querySelector(".compass").hidden = authored;
  document.querySelector("#tint-layer").disabled = authored;
  const mainstem = window.riverPulseRiverLayer?.getObjectByName("3DHP Russian River flowline");
  if (mainstem) mainstem.visible = !mapFlow && (activeView === "overview" || !authoredWater);
}

function connectRiverLayer(group, mainstem) {
  function apply(condition) {
    if (!mainstem) return;
    const style = centerlineConditionStyle(condition);
    mainstem.material.color.setHex(style.color);
    mapFlow?.setColor(style.color, style.opacity);
    mainstem.material.opacity = style.opacity;
    mainstem.material.transparent = true;
    group.userData.condition = style.kind;
  }
  group.visible =
    document.querySelector("#river-layer").getAttribute("aria-pressed") ===
    "true";
  addEventListener("river-pulse-layer-change", (event) => {
    if (event.detail.id === "river-layer") {
      group.visible = event.detail.enabled;
    }
  });
  addEventListener("river-pulse-condition-change", (event) =>
    apply(event.detail.condition),
  );
  apply(window.riverPulseSeasonalCondition);
  window.riverPulseRiverLayer = group;
  updateWaterVisibility();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function main() {
  const source = await fetchJson(SOURCE_URL);
  const gaugeAgency = source.gauge?.agency ?? "USGS",
    gaugeNumber = source.gauge?.id ?? "11467000",
    monitoringLocationId = `${gaugeAgency}-${gaugeNumber}`;
  gaugeId.textContent = `${gaugeAgency} ${gaugeNumber}`;
  gaugeWorldLabel.querySelector("span").textContent =
    `${gaugeAgency} ${gaugeNumber}`;
  // Data starts first and survives terrain/GPU failure. Rendering never owns the data lifecycle.
  updateObservedFlow(monitoringLocationId);
  updateRecentHistory(monitoringLocationId);
  setInterval(() => {
    if (!document.hidden) updateObservedFlow(monitoringLocationId);
  }, 60000);
  const [terrain] = await Promise.all([
    loadRiverTerrain(TERRAIN_BASE),
    loadPlaceFromRegistry({
      registryUrl: "../data/registry.json",
      riverPack: "russian_river",
      placeId: "hacienda_bridge",
    }),
  ]);
  sourceDetail.textContent =
    `${terrain.meta.source}. Horizontal reference ${terrain.meta.crs}; vertical reference ${terrain.meta.verticalDatum}. ` +
    `Scene coordinates preserve the absolute elevation relationship; no reservoir water-level assumption is used. ` +
    `Flow values use USGS Water Data; recent history is the USGS daily mean discharge statistic.`;
  status.textContent = "Terrain ready";
  sceneState.textContent = "Terrain loaded";

  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: true,
    forceWebGL: !navigator.gpu,
  });
  await renderer.init();
  document.querySelector("#render-backend").textContent = renderer.backend
    .isWebGPUBackend
    ? "WebGPU"
    : "WebGL2";
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc5d0c8);
  scene.fog = new THREE.FogExp2(0xc5d0c8, 0.00026);

  const grid = buildRiverTerrainGrid(terrain),
    geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(grid.positions, 3),
  );
  geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(elevationColors(grid.positions), 3),
  );
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardNodeMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
  });
  const land = new THREE.Mesh(geometry, material);
  scene.add(land);
  addRiverCenterline(scene, terrain);
  addEventListener("river-pulse-layer-change", (event) => {
    if (event.detail.id === "tint-layer") {
      material.vertexColors = event.detail.enabled;
      material.color.setHex(event.detail.enabled ? 0xffffff : 0x8e9c87);
      material.needsUpdate = true;
    }
  });

  const hemi = new THREE.HemisphereLight(0xc3ddff, 0x384034, 1.8),
    sun = new THREE.DirectionalLight(0xfffcf5, 2.3);
  sun.position.set(-3000, 5000, 1500);
  scene.add(hemi, sun);
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 120, bottom: -100, near: 1, far: 400 });
  sun.position.set(110, 120, 30);
  sun.target.position.set(0, 0, -70);
  sun.shadow.bias = -0.001;
  scene.add(sun.target);

  // The configured anchor is the USGS Hacienda gauge, so it is local (0, 0) by construction.
  const gaugeGround = terrain.ground(0, 0),
    gaugeMaterial = new THREE.MeshBasicNodeMaterial({ color: 0x8bd7bd }),
    gaugeBeacon = new THREE.Group(),
    gaugePost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 13, 10),
      gaugeMaterial,
    ),
    gaugeRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.18, 10, 40),
      gaugeMaterial,
    );
  gaugePost.position.y = 6.5;
  gaugeRing.position.y = 13;
  gaugeRing.rotation.x = Math.PI / 2;
  gaugeBeacon.add(gaugePost, gaugeRing);
  gaugeBeacon.position.set(0, gaugeGround + 1, 0);
  scene.add(gaugeBeacon);
  const gaugeLabelPoint = new THREE.Vector3(0, gaugeGround + 16, 0),
    gaugeProjection = new THREE.Vector3();

  const markerMaterial = new THREE.MeshBasicNodeMaterial({ color: 0x8bd7bd }),
    marker = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 20, 12),
      markerMaterial,
    );
  marker.visible = false;
  scene.add(marker);

  mapObjects = { land, gaugeBeacon, scene, sun, hemi };
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 50000),
    shorelineClearance = { ground: (x, z) => beachGround(x, z) - 0.8 };
  camera.rotation.order = "YXZ";
  const state = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 40 };
  pose(state, terrain, "overview", false);
  window.riverPulseScene = { state, renderer, terrain, material };

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

  for (const [mode, id] of [["selected", "#stage-selected"], ["low", "#stage-low"], ["high", "#stage-high"]])
    document.querySelector(id)?.addEventListener("click", () => {
      stage.mode = mode;
      stage.apply(matchMedia("(prefers-reduced-motion: reduce)").matches);
    });
  const initial = (window.riverPulseState ?? window.riverPulseCurrentState)?.selected_quantities?.find((v) =>
    v.phenomenon === "discharge" && v.availability === "present" && Number.isFinite(v.value));
  if (initial) stage.cfs = initial.value;
  stage.apply(true);
  window.riverPulseStage = stage;
  shallowsButton.addEventListener("click", () => {
    marker.visible = false;
    pose(state, terrain, "shallows");
  });

  addEventListener("keydown", (event) => {
    if (event.target.closest?.("input, button, select, textarea, summary, a"))
      return;
    cameraTransition = null;
    keys.add(event.code);
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
        event.code,
      )
    )
      event.preventDefault();
  });
  addEventListener("keyup", (event) => keys.delete(event.code));
  addEventListener("blur", () => {
    keys.clear();
    dragging = false;
  });

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    cameraTransition = null;
    downX = lastX = event.clientX;
    downY = lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointercancel", () => {
    dragging = false;
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    state.yaw -= (event.clientX - lastX) * 0.004;
    state.pitch = Math.max(
      -1.5,
      Math.min(1.5, state.pitch - (event.clientY - lastY) * 0.004),
    );
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener("pointerup", (event) => {
    const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    if (moved > 5 || activeView !== "overview") return;

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
      cameraTransition = null;
      const direction = viewRay(0, 0, camera.aspect, state.yaw, state.pitch),
        distance = Math.max(-120, Math.min(120, -event.deltaY * 0.25));
      state.x += direction[0] * distance;
      state.z += direction[2] * distance;
      state.y = Math.max(
        (activeView !== "overview" ? Math.max(beachGround(state.x, state.z) + 1.8, stage.level + 1.2) : terrain.ground(state.x, state.z) + 8),
        state.y + direction[1] * distance,
      );
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
    if (cameraTransition) {
      const t = Math.min(1, (now - cameraTransition.start) / 1300),
        blend = t * t * (3 - 2 * t);
      for (const key of ["x", "y", "z", "yaw", "pitch", "speed"])
        state[key] =
          cameraTransition.from[key] +
          (cameraTransition.target[key] - cameraTransition.from[key]) * blend;
      state.y = Math.max(state.y, (activeView !== "overview" ? Math.max(beachGround(state.x, state.z) + 1.8, stage.level + 1.2) : terrain.ground(state.x, state.z) + 8));
      if (t === 1) cameraTransition = null;
    }
    fly(state, { keys, cruise: false }, dt,
      activeView !== "overview" ? shorelineClearance : terrain);
    if (activeView !== "overview") constrainBeachCamera(state, stage.level);

    camera.position.set(state.x, state.y, state.z);
    camera.rotation.set(state.pitch, -state.yaw, 0);
    document.querySelector("#compass-arrow").style.transform =
      `rotate(${state.yaw}rad)`;

    if (activeView !== "overview") {
      coords.textContent = "Hacienda · authored setting";
      elevation.textContent = "Photo-informed ground";
      agl.textContent = "1.8 m eye height";
    } else if (selected) {
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
      activeView === "overview" && gaugeProjection.z > -1 &&
      gaugeProjection.z < 1 &&
      Math.abs(gaugeProjection.x) < 1.08 &&
      Math.abs(gaugeProjection.y) < 1.08;
    gaugeWorldLabel.classList.toggle("visible", gaugeVisible);
    if (gaugeVisible) {
      gaugeWorldLabel.style.left = `${(gaugeProjection.x * 0.5 + 0.5) * innerWidth}px`;
      gaugeWorldLabel.style.top = `${(-gaugeProjection.y * 0.5 + 0.5) * innerHeight}px`;
    }

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (authoredWater?.stageAware) {
      stage.level += (stage.target - stage.level) * (reducedMotion ? 1 : 1 - Math.exp(-3.2 * dt));
      authoredWater.setLevel(stage.level);
    }
    authoredWater?.update(now / 1000, reducedMotion);
    mapFlow?.update(now / 1000, reducedMotion);
    renderer.render(scene, camera);
  });
}

main().catch(fail);
