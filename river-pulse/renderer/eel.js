import * as THREE from "../../vendor/three/three.webgpu.js";
import { cameraPosition, color, dot, float, mix, normalize, positionWorld, pow, sin, uniform, vec3 } from "../../vendor/three/three.tsl.js";
import { loadRiverTerrain } from "./terrain.js";
import { buildRiverTerrainGrid } from "./terrain-mesh.js";
import { EEL_CAMERAS, reviewCamera, clippedWaterTriangle } from "./eel-layout.js";
import { createEelSetting } from "./eel-setting.js";

const $ = id => document.getElementById(id), base = "../data/eel_river/places/scotia_bluffs/",
  started = performance.now(), reduced = matchMedia("(prefers-reduced-motion: reduce)");
let active = "overview", paused = reduced.matches, mode = "study", pass = "refined", measure = null, settingPass = "detail";
$("evidence").onclick = () => {
  $("sources").hidden = !$("sources").hidden;
  $("evidence").setAttribute("aria-expanded", String(!$("sources").hidden));
};
$("close").onclick = () => { $("sources").hidden = true; $("evidence").setAttribute("aria-expanded", "false"); $("evidence").focus(); };
$("state-credit").onclick = () => {
  $("sources").hidden = false; $("sources").scrollTop = 0;
  $("evidence").setAttribute("aria-expanded", "true"); $("close").focus();
};
window.addEventListener("keydown", event => { if (event.key === "Escape") $("close").click(); });
$("clean").onclick = () => $("clean").setAttribute("aria-pressed", String(document.body.classList.toggle("clean")));
function pauseLabel() {
  $("pause").textContent = paused ? "Resume highlights" : "Pause highlights";
  $("pause").setAttribute("aria-pressed", String(paused));
}
$("pause").onclick = () => { paused = !paused; pauseLabel(); };
reduced.addEventListener("change", () => { paused = reduced.matches; pauseLabel(); }); pauseLabel();

async function json(file) {
  const response = await fetch(base + file);
  if (!response.ok) throw new Error(`Scene source ${file}: ${response.status}`);
  return response.json();
}

function geometry(positions, indices, colors = null, uv = null) {
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (colors) out.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  if (uv) out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  if (indices) out.setIndex(new THREE.Uint32BufferAttribute(indices, 1));
  out.computeVertexNormals(); out.computeBoundingSphere(); return out;
}

function classify(terrain, image, waterbodies) {
  const { width: w, height: h } = terrain, photo = document.createElement("canvas");
  photo.width = w; photo.height = h;
  const pc = photo.getContext("2d", { willReadFrequently: true }); pc.drawImage(image, 0, 0, w, h);
  const pixels = pc.getImageData(0, 0, w, h).data, mask = document.createElement("canvas"); mask.width = w; mask.height = h;
  const mc = mask.getContext("2d", { willReadFrequently: true }); mc.fillStyle = "white";
  for (const polygon of waterbodies.polygons.filter(p => p.properties.featuretypelabel === "River")) {
    const path = new Path2D();
    for (const ring of polygon.rings) {
      ring.forEach(([x, z], i) => {
        const u = (x - terrain.x0) / terrain.cellX + 0.5, v = (z - terrain.z0) / terrain.cellZ + 0.5;
        if (i === 0) path.moveTo(u, v); else path.lineTo(u, v);
      }); path.closePath();
    }
    mc.fill(path, "evenodd");
  }
  const footprint = mc.getImageData(0, 0, w, h).data, wet = new Float32Array(w * h), colors = new Float32Array(w * h * 3), tint = new THREE.Color();
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, r = pixels[k * 4] / 255, g = pixels[k * 4 + 1] / 255, b = pixels[k * 4 + 2] / 255,
      luma = (r + g + b) / 3, mapped = footprint[k * 4 + 3] > 127;
    wet[k] = mapped ? Math.max(0, Math.min(1, (Math.max(g, b) - r) * 6 + (0.39 - luma) * 3)) : 0;
    // Coarse cover colors preserve the photographic relationships without hiding geometry.
    if (mapped && wet[k] < 0.5) tint.setRGB(0.48 + luma * 0.22, 0.47 + luma * 0.21, 0.40 + luma * 0.20, THREE.SRGBColorSpace);
    else if (g > r * 1.1 && luma < 0.4) tint.setRGB(0.18 + luma * 0.3, 0.26 + luma * 0.36, 0.20 + luma * 0.24, THREE.SRGBColorSpace);
    else tint.setRGB(0.34 + luma * 0.42, 0.34 + luma * 0.40, 0.26 + luma * 0.35, THREE.SRGBColorSpace);
    colors.set([tint.r, tint.g, tint.b], k * 3);
  }
  return { wet, colors, pixels, mapped: Uint8Array.from({ length: w * h }, (_, k) => footprint[k * 4 + 3] > 127 ? 1 : 0) };
}

function waterGeometry(terrain, wet, refined) {
  const { width: w, height: h } = terrain, positions = [], indices = [], field = new Float32Array(wet);
  if (refined) {
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
      const k = j * w + i; field[k] = (wet[k] * 4 + wet[k - 1] + wet[k + 1] + wet[k - w] + wet[k + w]) / 8;
    }
  }
  function add(poly) {
    if (poly.length < 3) return;
    const start = positions.length / 3;
    for (const v of poly) positions.push(v.x, (refined ? v.y : terrain.ground(v.x, v.z)) + 0.18, v.z);
    for (let i = 1; i < poly.length - 1; i++) indices.push(start, start + i, start + i + 1);
  }
  const vertex = (i, j) => {
    const x = terrain.x0 + i * terrain.cellX, z = terrain.z0 + j * terrain.cellZ;
    return { x, z, y: terrain.ground(x, z), w: field[j * w + i] };
  };
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const a = vertex(i, j), b = vertex(i, j + 1), c = vertex(i + 1, j), d = vertex(i + 1, j + 1);
    if (refined) { add(clippedWaterTriangle([a, b, c])); add(clippedWaterTriangle([c, b, d])); }
    else if ((a.w + b.w + c.w + d.w) / 4 >= 0.5) add([a, b, d, c]);
  }
  return geometry(positions, indices);
}

function authoredWater(clock) {
  const p = positionWorld, n = normalize(vec3(sin(p.x.mul(0.13).add(p.z.mul(0.07)).add(clock)).mul(0.025), 1,
    sin(p.z.mul(0.21).sub(clock.mul(0.8))).mul(0.018))),
    facing = dot(n, normalize(cameraPosition.sub(p))).clamp(0, 1), fresnel = pow(float(1).sub(facing), 4),
    glint = pow(dot(n, normalize(normalize(cameraPosition.sub(p)).add(normalize(vec3(-0.3, 0.8, 0.5))))).max(0), 180);
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  material.colorNode = mix(color(0x28524d), color(0xb8cfca), fresnel.mul(0.6)).add(color(0xe5dec6).mul(glint.mul(0.35)));
  return material;
}

async function main() {
  const renderer = new THREE.WebGPURenderer({ canvas: $("scene"), antialias: true, forceWebGL: !navigator.gpu });
  await renderer.init(); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const [terrain, waterbodies, aerial] = await Promise.all([loadRiverTerrain(base + "terrain"), json("waterbodies.json"), new THREE.TextureLoader().loadAsync(base + "aerial.jpg")]);
  aerial.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xc2d6dc);
  scene.add(new THREE.HemisphereLight(0xe5eef0, 0x69624e, 2.4));
  const sun = new THREE.DirectionalLight(0xffeed3, 2.5); sun.position.set(-1600, 2300, 700); scene.add(sun);
  const grid = buildRiverTerrainGrid(terrain), classified = classify(terrain, aerial.image, waterbodies), colors = new Float32Array(grid.count * 3), uv = new Float32Array(grid.count * 2);
  for (let j = 0; j < terrain.height + 2; j++) for (let i = 0; i < terrain.width + 2; i++) {
    const gi = Math.max(0, Math.min(terrain.width - 1, i - 1)), gj = Math.max(0, Math.min(terrain.height - 1, j - 1)), k = j * (terrain.width + 2) + i;
    colors.set(classified.colors.subarray((gj * terrain.width + gi) * 3, (gj * terrain.width + gi) * 3 + 3), k * 3);
    uv.set([(gi + 0.5) / terrain.width, 1 - (gj + 0.5) / terrain.height], k * 2);
  }
  const landGeometry = geometry(grid.positions, grid.indices, colors, uv),
    studyMaterial = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 1 }),
    formMaterial = new THREE.MeshStandardNodeMaterial({ color: 0xb9b2a3, roughness: 1 }),
    aerialMaterial = new THREE.MeshBasicNodeMaterial({ map: aerial }),
    land = new THREE.Mesh(landGeometry, studyMaterial), clock = uniform(0),
    water = new THREE.Mesh(waterGeometry(terrain, classified.wet, true), authoredWater(clock)),
    baseline = waterGeometry(terrain, classified.wet, false), refined = water.geometry,
    waterForm = new THREE.MeshBasicNodeMaterial({ color: 0x427b80, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), waterStudy = water.material;
  scene.add(land, water);
  const setting = await createEelSetting(terrain, classified, aerial); scene.add(setting.group);
  const camera = new THREE.PerspectiveCamera(48, 1, 1, 15000);
  function setCamera(id) {
    active = id;
    const view = reviewCamera(id, terrain); camera.position.fromArray(view.position); camera.lookAt(...view.target);
    setting.setCamera(view.position, view.target);
    camera.near = ["overview", "bend"].includes(id) ? 10 : 0.5;
    camera.fov = innerWidth < 600 && id === "overview" ? 65 : view.fov; camera.updateProjectionMatrix();
    $("view-label").textContent = view.label;
    for (const button of document.querySelectorAll("[data-camera]")) button.setAttribute("aria-pressed", String(button.dataset.camera === id));
    cancelMeasurement();
  }
  function presentation() {
    mode = $("mode").value; pass = $("pass").value;
    settingPass = $("setting-pass").value;
    land.material = mode === "form" ? formMaterial : mode === "aerial" ? aerialMaterial : settingPass === "detail" ? setting.material : studyMaterial;
    setting.group.visible = mode === "study" && settingPass === "detail";
    water.visible = mode !== "aerial"; water.material = mode === "form" ? waterForm : waterStudy;
    water.geometry = pass === "baseline" ? baseline : refined; cancelMeasurement();
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; setCamera(active);
    $("environment").textContent = `${renderer.backend.isWebGPUBackend ? "WebGPU" : "WebGL2"} · ${innerWidth}×${innerHeight} · DPR ${renderer.getPixelRatio()} · camera presets v1`;
  }
  for (const button of document.querySelectorAll("[data-camera]")) button.onclick = () => setCamera(button.dataset.camera);
  $("mode").onchange = presentation; $("pass").onchange = presentation; $("setting-pass").onchange = presentation; window.addEventListener("resize", resize);
  let loadMs = 0, frame = 0, last = performance.now(), seconds = 0;
  const meshes = setting.group.children, geometries = [landGeometry, baseline, refined, ...meshes.map(mesh => mesh.geometry)],
    geometryBytes = geometries.reduce((sum, g) => sum + Object.values(g.attributes).reduce((n, a) => n + a.array.byteLength, 0) + (g.index?.array.byteLength ?? 0), 0)
      + meshes.reduce((sum, mesh) => sum + mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? mesh.instanceMatrix.count * 12), 0),
    textureBytes = [aerial, ...setting.textures].reduce((sum, map) => sum + map.image.width * map.image.height * 4 * 4 / 3, 0);
  function cancelMeasurement() {
    measure = null; $("measure").disabled = false; $("measure").textContent = "Measure 120 frames";
    $("metrics").textContent = "Select a fixed view, then measure 120 frames. Switching view or presentation resets the sample.";
  }
  $("measure").onclick = () => {
    measure = { intervals: [], cpu: [], warmup: 12, camera: active, mode, pass, settingPass };
    $("measure").disabled = true; $("metrics").textContent = "Warming up, then sampling 120 rendered frames…";
  };
  resize(); presentation();
  renderer.setAnimationLoop(() => {
    const now = performance.now(), interval = now - last; last = now;
    if (document.hidden) { if (measure) cancelMeasurement(); return; }
    if (!paused && mode === "study") seconds += Math.min(interval, 50) / 1000;
    clock.value = seconds; const begin = performance.now(); renderer.render(scene, camera); const cpu = performance.now() - begin;
    if (++frame === 1) { loadMs = performance.now() - started; $("loading").hidden = true; }
    if (measure) {
      if (measure.warmup-- > 0) return;
      measure.intervals.push(interval); measure.cpu.push(cpu);
      $("metrics").textContent = `Sampling ${measure.cpu.length}/120 rendered frames…`;
      if (measure.cpu.length === 120) {
        const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)],
          triangles = renderer.info.render.triangles, calls = renderer.info.render.drawCalls;
        $("metrics").textContent = `${measure.camera} / ${measure.mode} / ${measure.pass} / ${measure.settingPass} · ${innerWidth}×${innerHeight} · DPR ${renderer.getPixelRatio()} · ${renderer.backend.isWebGPUBackend ? "WebGPU" : "WebGL2"}\n` +
          `${triangles.toLocaleString()} rendered triangles · ${calls} draw calls · ${(geometryBytes / 1048576).toFixed(2)} MiB geometry buffers (both passes resident)\n` +
          `Frame interval p50 ${percentile(measure.intervals, 0.5).toFixed(2)} ms / p95 ${percentile(measure.intervals, 0.95).toFixed(2)} ms\n` +
          `CPU render submission p50 ${percentile(measure.cpu, 0.5).toFixed(2)} ms / p95 ${percentile(measure.cpu, 0.95).toFixed(2)} ms\n` +
          `First frame ${loadMs.toFixed(0)} ms · 6 textures, RGBA+mips estimate ${(textureBytes / 1048576).toFixed(1)} MiB\n` +
          `${setting.treeCount} authored tree sites; ${setting.detailCount()} detailed near this camera. GPU time and total browser memory are not measured.`;
        measure = null; $("measure").disabled = false;
      }
    }
  });
}
main().catch(error => { $("loading").textContent = `The visual study could not start: ${error.message}. Geography and source records remain on the Eel river page.`; console.error(error); });
