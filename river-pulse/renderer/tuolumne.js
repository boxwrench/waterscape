import * as THREE from "../../vendor/three/three.webgpu.js";
import { loadRiverTerrain } from "./terrain.js";
import { buildRiverTerrainGrid } from "./terrain-mesh.js";

const $ = id => document.getElementById(id), base = "../data/tuolumne_river/foundation/poopenaut/", started = performance.now();
let active = "overview";
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
  const [terrain, layout, presets, aerial] = await Promise.all([loadRiverTerrain(base + "terrain"), json("layout.json"), json("review-cameras.json"), new THREE.TextureLoader().loadAsync(base + "aerial.jpg")]);
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
  const camera = new THREE.PerspectiveCamera(48, 1, 1, 20000), geometryBytes = [geometry, guide.geometry].reduce((sum, g) => sum + Object.values(g.attributes).reduce((n, a) => n + a.array.byteLength, 0) + (g.index?.array.byteLength ?? 0), 0);
  let firstMs = null;
  function render() {
    renderer.render(scene, camera); firstMs ??= performance.now() - started;
    $("loading").hidden = true;
    $("metrics").textContent = `${renderer.info.render.triangles.toLocaleString()} triangles · ${renderer.info.render.drawCalls} draw calls · ${(geometryBytes / 1048576).toFixed(2)} MiB CPU geometry buffers\nSource texture 1536×1024; RGBA+mips estimate 8.0 MiB · First frame ${firstMs.toFixed(0)} ms\nStatic scene rendered on view/control changes. GPU timing, full browser/GPU memory and foreground FPS are unmeasured.`;
  }
  function view(id) {
    active = id; const preset = presets.cameras.find(c => c.id === id);
    if (!preset) throw new Error(`Unknown review camera ${id}`);
    const [x, z] = preset.positionXZ, [tx, tz] = preset.targetXZ;
    camera.position.set(x, terrain.ground(x, z) + preset.groundClearance, z);
    camera.lookAt(tx, terrain.ground(tx, tz) + preset.targetGroundClearance, tz);
    camera.near = ["overview", "primary", "dam"].includes(id) ? 10 : 0.5;
    camera.fov = innerWidth < 600 && id === "overview" ? 65 : preset.fov; camera.updateProjectionMatrix();
    $("view-label").textContent = preset.label;
    for (const button of document.querySelectorAll("[data-camera]")) button.setAttribute("aria-pressed", String(button.dataset.camera === id));
    $("environment").textContent = `${renderer.backend.isWebGPUBackend ? "WebGPU" : "WebGL2"} · ${innerWidth}×${innerHeight} · DPR ${renderer.getPixelRatio()} · ${presets.version}`;
    render();
  }
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; view(active); }
  for (const button of document.querySelectorAll("[data-camera]")) button.onclick = () => view(button.dataset.camera);
  $("mode").onchange = () => { land.material = $("mode").value === "aerial" ? photo : form; render(); };
  $("guide").onchange = () => { guide.visible = $("guide").checked; render(); };
  window.addEventListener("resize", resize); resize();
}
main().catch(error => { $("loading").textContent = `This form study could not start: ${error.message}. Evidence remains available.`; console.error(error); });
