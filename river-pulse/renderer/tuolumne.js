import * as THREE from "../../vendor/three/three.webgpu.js";
import { loadRiverTerrain } from "./terrain.js";
import { buildRiverTerrainGrid } from "./terrain-mesh.js";
import { createTuolumneDam, damContactPositions } from "./tuolumne-dam.js";

const $ = id => document.getElementById(id), base = "../data/tuolumne_river/foundation/poopenaut/", started = performance.now();
const requestedView = new URLSearchParams(location.search).get("view");
let active = ["overview", "primary", "eye", "shore", "dam", "dam-close", "below", "lake"].includes(requestedView) ? requestedView : "overview";
if (new URLSearchParams(location.search).get("mode") === "plain") $("mode").value = "plain";
$("evidence").onclick = () => {
  $("sources").hidden = !$("sources").hidden;
  $("evidence").setAttribute("aria-expanded", String(!$("sources").hidden));
};
$("close").onclick = () => { $("sources").hidden = true; $("evidence").setAttribute("aria-expanded", "false"); $("evidence").focus(); };
window.addEventListener("keydown", event => { if (event.key === "Escape") $("close").click(); });
$("clean").onclick = () => $("clean").setAttribute("aria-pressed", String(document.body.classList.toggle("clean")));

async function json(file) {
  const response = await fetch(base + file);
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  return response.json();
}

function stateMap(state, source) {
  const features = state.hydrologicUnit.data.features, rings = [];
  for (const feature of features) {
    const g = feature.geometry, polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const polygon of polygons) rings.push(...polygon);
  }
  const factor = Math.cos(source.anchor[0] * Math.PI / 180), points = rings.flat(),
    west = Math.min(...points.map(p => p[0] * factor)), east = Math.max(...points.map(p => p[0] * factor)),
    south = Math.min(...points.map(p => p[1])), north = Math.max(...points.map(p => p[1])),
    scale = Math.min(250 / (east - west), 100 / (north - south)),
    xy = (lon, lat) => [10 + (lon * factor - west) * scale, 10 + (north - lat) * scale];
  const add = (tag, attrs) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    $("watershed").append(element); return element;
  };
  for (const ring of rings) add("path", { d: ring.map((p, i) => `${i ? "L" : "M"}${xy(...p).join(",")}`).join(" ") + "Z", fill: "none", stroke: "#9ad8c5", "stroke-width": 1.4 });
  const [w, s, e, n] = source.bbox, [x, y] = xy(w, n), [ex, sy] = xy(e, s);
  add("rect", { x, y, width: ex - x, height: sy - y, fill: "none", stroke: "#ebc77c", "stroke-width": 2 });
}

function riverGuide(layout, terrain) {
  const points = [], xmin = terrain.x0, zmin = terrain.z0,
    xmax = xmin + (terrain.width - 1) * terrain.cellX, zmax = zmin + (terrain.height - 1) * terrain.cellZ,
    inside = ([x, z]) => x >= xmin && x <= xmax && z >= zmin && z <= zmax;
  for (const line of layout.lines) for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i]; if (!inside(a) || !inside(b)) continue;
    points.push(a[0], terrain.ground(...a) + 3.5, a[1], b[0], terrain.ground(...b) + 3.5, b[1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x277d80, depthWrite: false }));
}

async function main() {
  const [state, source] = await Promise.all([json("calwater.json"), json("source.json")]); stateMap(state, source);
  const renderer = new THREE.WebGPURenderer({ canvas: $("scene"), antialias: true, forceWebGL: !navigator.gpu });
  await renderer.init(); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  const [terrain, layout, presets, aerial, structures, damPresets] = await Promise.all([
    loadRiverTerrain(base + "terrain"), json("layout.json"), json("review-cameras.json"),
    new THREE.TextureLoader().loadAsync(base + "aerial.jpg"),
    fetch("../../data/hetch_hetchy/structures.json").then(response => {
      if (!response.ok) throw new Error(`Reservoir dam metadata: ${response.status}`);
      return response.json();
    }),
    json("dam-review-cameras.json"),
  ]);
  aerial.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xc2d6dc);
  scene.add(new THREE.HemisphereLight(0xe5eef0, 0x69624e, 0.8));
  const sun = new THREE.DirectionalLight(0xffeed3, 2.2); sun.position.set(-1600, 2300, 700); scene.add(sun);
  const grid = buildRiverTerrainGrid(terrain), geometry = new THREE.BufferGeometry(), uv = new Float32Array(grid.count * 2);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(grid.positions, 3));
  geometry.setIndex(new THREE.Uint32BufferAttribute(grid.indices, 1));
  for (let j = 0; j < terrain.height + 2; j++) for (let i = 0; i < terrain.width + 2; i++) {
    const gi = Math.max(0, Math.min(terrain.width - 1, i - 1)), gj = Math.max(0, Math.min(terrain.height - 1, j - 1)), k = j * (terrain.width + 2) + i;
    uv.set([(gi + 0.5) / terrain.width, 1 - (gj + 0.5) / terrain.height], k * 2);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const form = new THREE.MeshStandardNodeMaterial({ color: 0x958e82, roughness: 1 }),
    photo = new THREE.MeshBasicNodeMaterial({ map: aerial }), land = new THREE.Mesh(geometry, form), guide = riverGuide(layout, terrain);
  scene.add(land, guide);
  const dam = await createTuolumneDam(terrain, structures, sun), damMeshes = [],
    plainDam = new THREE.MeshStandardNodeMaterial({ color: 0xaaa193, roughness: 1, side: THREE.DoubleSide });
  dam.group.traverse(mesh => { if (mesh.isMesh) { damMeshes.push(mesh); mesh.userData.studyMaterial = mesh.material; } });
  scene.add(dam.group);
  const nativePosition = geometry.getAttribute("position"),
    contactPosition = new THREE.BufferAttribute(damContactPositions(grid.positions, terrain, structures), 3);
  geometry.setAttribute("position", contactPosition); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const camera = new THREE.PerspectiveCamera(48, 1, 1, 20000),
    geometryBytes = nativePosition.array.byteLength + [geometry, guide.geometry, ...damMeshes.map(mesh => mesh.geometry)].reduce((sum, g) => sum + Object.values(g.attributes).reduce((n, a) => n + a.array.byteLength, 0) + (g.index?.array.byteLength ?? 0), 0),
    concrete = dam.textures[0], concreteMiB = concrete.image.width * concrete.image.height * 4 * 4 / 3 / 1048576;
  const nativeReadyMs = performance.now() - started;
  let context = null, contextLoading = null, full = false, fullFailed = false;
  function reservoirFailed(error) {
    fullFailed = true; full = false; context?.hide(); $("reservoir-scene").hidden = true;
    document.body.classList.remove("reservoir-context");
    $("reservoir-controls").hidden = true; $("native-controls").hidden = false;
    $("disclosure").textContent = "Previous dam study · Symbolic river guide · Reservoir renderer unavailable";
    $("environment").textContent = `Reservoir renderer unavailable: ${error.message}. Showing the previous dam study.`;
    $("loading").hidden = true; render(); console.error(error);
  }
  async function showReservoir(pose) {
    contextLoading ??= import("./reservoir-context.js").then(({ reservoirContext }) => {
      context = reservoirContext($("reservoir-scene"), {
        onProgress: message => { if (full) $("loading").textContent = message; },
        onMetrics: message => { if (full) $("metrics").textContent = message; },
        onReady: () => { if (full) $("loading").hidden = true; },
        onError: reservoirFailed,
      });
      $("motion").textContent = context.playing ? "Pause water" : "Resume water";
      $("motion").setAttribute("aria-pressed", String(!context.playing));
      return context;
    });
    try {
      const loaded = await contextLoading;
      if (full) await loaded.show(pose);
    } catch (error) { reservoirFailed(error); }
  }
  function render() {
    if (full) return;
    renderer.render(scene, camera);
    $("loading").hidden = true;
    $("metrics").textContent = `${renderer.info.render.triangles.toLocaleString()} triangles · ${renderer.info.render.drawCalls} draw calls · ${(geometryBytes / 1048576).toFixed(2)} MiB CPU geometry buffers\nResident texture RGBA+mips estimate ${(8 + concreteMiB).toFixed(2)} MiB (aerial 8.0 + concrete ${concreteMiB.toFixed(2)}) · Native initialization ${nativeReadyMs.toFixed(0)} ms (cache-dependent)\nStatic scene rendered on view/control changes. GPU timing, full browser/GPU memory and foreground FPS are unmeasured. A lazily loaded reservoir engine stays resident after visiting its views.`;
  }
  function view(id) {
    active = id;
    const nativeId = ["below", "lake"].includes(id) ? "dam-close" : id,
      preset = [...presets.cameras, ...damPresets.cameras].find(c => c.id === nativeId);
    if (!preset) throw new Error(`Unknown review camera ${id}`);
    const [x, z] = preset.positionXZ, [tx, tz] = preset.targetXZ;
    camera.position.set(x, terrain.ground(x, z) + preset.groundClearance, z);
    camera.lookAt(tx, preset.targetElevation ?? terrain.ground(tx, tz) + preset.targetGroundClearance, tz);
    camera.near = ["overview", "primary", "dam"].includes(id) ? 10 : 0.5;
    camera.fov = innerWidth < 600 ? (preset.phoneFov ?? (id === "overview" ? 65 : preset.fov)) : preset.fov; camera.updateProjectionMatrix();
    document.body.classList.toggle("dam-focus", ["dam-close", "below", "lake"].includes(id));
    $("view-label").textContent = id === "below" ? "O’Shaughnessy Dam · Original downstream viewpoint" : id === "lake" ? "Hetch Hetchy · Original reservoir shoreline viewpoint" : preset.label;
    for (const button of document.querySelectorAll("[data-camera]")) button.setAttribute("aria-pressed", String(button.dataset.camera === id));
    $("environment").textContent = `${renderer.backend.isWebGPUBackend ? "WebGPU" : "WebGL2"} · ${innerWidth}×${innerHeight} · DPR ${renderer.getPixelRatio()} · ${id === "dam-close" ? damPresets.version : presets.version}`;
    full = !fullFailed && ["dam", "dam-close", "below", "lake"].includes(id) && $("mode").value === "study";
    if (!full && ["below", "lake"].includes(id)) $("view-label").textContent = `${preset.label} · Reservoir context unavailable`;
    document.body.classList.toggle("reservoir-context", full);
    $("reservoir-scene").hidden = !full;
    $("reservoir-controls").hidden = !full; $("native-controls").hidden = full;
    $("disclosure").textContent = full ? "Hetch Hetchy reservoir context · Illustrative water and release · Development scene" : "Reused dam · Symbolic river guide · Development scene";
    if (full) {
      $("environment").textContent = "Hetch Hetchy reservoir context · Original renderer · Fixed 64° field of view · RP23";
      $("loading").textContent = "Preparing the original Hetch Hetchy reservoir…"; $("loading").hidden = false;
      const target = [tx, preset.targetElevation ?? terrain.ground(tx, tz) + preset.targetGroundClearance, tz];
      showReservoir(["below", "lake"].includes(id) ? { named: id === "below" ? "below" : "shore" } :
        { position: camera.position.toArray(), target, meta: terrain.meta });
    } else { context?.hide(); render(); }
  }
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; context?.resize(); view(active); }
  for (const button of document.querySelectorAll("[data-camera]")) button.onclick = () => {
    if (["below", "lake"].includes(button.dataset.camera) && $("mode").value !== "study") {
      $("mode").value = "study"; presentation();
    }
    view(button.dataset.camera);
  };
  function presentation() {
    const mode = $("mode").value;
    land.material = mode === "aerial" ? photo : form;
    dam.group.visible = $("dam").checked && mode !== "aerial";
    const position = dam.group.visible ? contactPosition : nativePosition;
    if (geometry.getAttribute("position") !== position) {
      geometry.setAttribute("position", position); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    }
    for (const mesh of damMeshes) mesh.material = mode === "form" ? plainDam : mesh.userData.studyMaterial;
    if (["below", "lake"].includes(active) && mode !== "study") active = "dam-close";
    view(active);
  }
  $("mode").onchange = presentation;
  $("dam").onchange = presentation;
  $("guide").onchange = () => { guide.visible = $("guide").checked; render(); };
  $("motion").onclick = () => {
    if (!context) return;
    context.setPlaying(!context.playing); $("motion").textContent = context.playing ? "Pause water" : "Resume water";
    $("motion").setAttribute("aria-pressed", String(!context.playing));
  };
  $("light").onchange = () => context?.setPreset($("light").value);
  document.addEventListener("visibilitychange", () => context?.visibility());
  window.addEventListener("resize", resize); resize();
}
main().catch(error => { $("loading").textContent = `This form study could not start: ${error.message}. Evidence remains available.`; console.error(error); });
