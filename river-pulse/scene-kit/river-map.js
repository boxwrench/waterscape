import { loadPlaceRegistry, loadPlaceManifest } from "../core/data-model/place-registry.js";

const NS = "http://www.w3.org/2000/svg", panel = document.createElement("aside"),
  current = document.body.dataset.riverPlace ?? "hacienda_bridge", localMap = document.querySelector("#overview"),
  toggle = document.querySelector("[data-river-map-toggle]");
panel.id = "river-place-map"; panel.className = "river-place-map";
panel.setAttribute("aria-label", "Russian River geographic overview and places");
// Links are built from this module's location so they work from any scene page.
const sceneHref = (slot, id) => new URL(`../rivers/russian_river/scenes/${slot}/${id}/index.html`, import.meta.url).href;
panel.innerHTML = `<header><strong>Russian River places</strong><button aria-label="Close river map">×</button></header><div class="map-fallback"><a href="${sceneHref("start", "east_fork")}">East Fork · Lake Mendocino</a><a href="${sceneHref("middle", "hacienda_bridge")}">Hacienda Bridge</a><a href="${sceneHref("end", "jenner")}">Jenner · Pacific coast</a></div>`;
panel.hidden = !localMap; document.body.append(panel);
function open(value) { panel.hidden = !value; toggle?.setAttribute("aria-expanded", String(value)); }
panel.querySelector("button").onclick = () => { open(false); (toggle ?? localMap)?.focus(); };
if (toggle) toggle.onclick = () => open(panel.hidden);
if (localMap) {
  new MutationObserver(() => open(localMap.getAttribute("aria-pressed") === "true"))
    .observe(localMap, { attributes: true, attributeFilter: ["aria-pressed"] });
}
addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) { open(false); (toggle ?? localMap)?.focus(); } });
const element = (name, attributes) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attributes)) node.setAttribute(k, v);
  return node;
};
async function draw() {
  const base = new URL("../registry.json", import.meta.url), registry = await loadPlaceRegistry(base),
    entries = registry.places.filter(p => p.river_pack === "russian_river"),
    places = await Promise.all(entries.map(async entry => {
      const url = new URL(entry.manifest, base), manifest = await loadPlaceManifest(url);
      return { ...manifest, url };
    })), response = await fetch(new URL("../rivers/russian_river/map/overview.json", import.meta.url));
  if (!response.ok) throw new Error(`River overview: ${response.status}`);
  const data = await response.json(), svg = element("svg", { viewBox: "0 0 210 260", role: "group", "aria-label": "Map pins: East Fork, Hacienda Bridge and Jenner" }),
    project = (lon, lat) => [(lon + 123.32) * 258 + 8, (39.42 - lat) * 220 + 10];
  for (const path of data.paths) {
    if (!path.every(([lon, lat]) => lon > -123.6 && lon < -122.4 && lat > 38.2 && lat < 39.6)) continue;
    svg.append(element("path", { class: "river-path", d: path.map(([lon, lat], i) => {
      const [x, y] = project(lon, lat); return `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" "), "aria-hidden": "true" }));
  }
  const labels = { east_fork: "East Fork", hacienda_bridge: "Hacienda", jenner: "Jenner" };
  for (const place of places) {
    const [x, y] = project(place.anchor.longitude, place.anchor.latitude),
      href = place.authored_scene ? new URL(place.authored_scene.entry, place.url).href : sceneHref("middle", "hacienda_bridge"),
      link = element("a", { href, class: "river-pin", "aria-label": `Open ${place.name}`, tabindex: "0" });
    if (place.id === current) link.setAttribute("aria-current", "location");
    link.append(element("circle", { cx: x, cy: y, r: 6 }));
    const label = element("text", { x: x + 11, y: y + 3 }); label.textContent = labels[place.id] ?? place.name;
    link.append(label); svg.append(link);
  }
  const north = element("text", { class: "map-north", x: 8, y: 18 }); north.textContent = "↑ N"; svg.append(north);
  panel.querySelector(".map-fallback").replaceWith(svg);
  const note = document.createElement("p"); note.className = "map-context";
  note.append("Geographic overview · select a place. ");
  if (localMap) note.append("The 3D terrain behind this inset covers Hacienda only. ");
  const source = document.createElement("a"); source.href = data.source_url; source.target = "_blank"; source.rel = "noopener";
  source.textContent = "USGS centerlines ↗"; note.append(source); panel.append(note);
  window.riverPlaceMap = { places, source: data.source_url };
}
draw().catch(error => console.warn("Geographic map unavailable; place links retained", error));
