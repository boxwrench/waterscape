import { riverDestination, overviewRiverOrder } from "./data-model/overview-navigation.js";

const map = document.querySelector("#state-map"), list = document.querySelector("#river-list"),
  statusLabels = { available: "Places to explore", in_development: "In development", planned: "Planned river" },
  svgNS = "http://www.w3.org/2000/svg";

async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Map asset ${response.status}`);
  return response.json();
}
function svg(tag, attributes = {}, text = null) {
  const node = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  return node;
}
function htmlLink(label, href) {
  const link = document.createElement("a"); link.textContent = label; link.href = href; return link;
}
function setPreview(river) {
  document.querySelector("#preview-title").textContent = river.name;
  document.querySelector("#preview-status").textContent = statusLabels[river.status];
  document.querySelector("#preview-description").textContent = river.summary;
  const destination = riverDestination(river), open = document.querySelector("#open-river");
  open.href = destination;
  open.replaceChildren(document.createTextNode(`${river.status === "available" ? "Explore" : "Open"} ${river.name} `));
  const arrow = document.createElement("span"); arrow.textContent = "↗"; arrow.setAttribute("aria-hidden", "true"); open.append(arrow);
  const places = document.querySelector("#place-links"); places.replaceChildren();
  for (const scene of river.scenes ?? []) places.append(htmlLink(scene.name, new URL(scene.entry,
    new URL(`./data/${river.id}/river.json`, location.href))));
  for (const node of document.querySelectorAll("[data-river]")) node.classList.toggle("is-active", node.dataset.river === river.id);
}

function drawMap(geography, rivers) {
  const compact = window.matchMedia("(max-width: 760px)").matches;
  const root = svg("svg", { viewBox: `0 0 ${geography.width} ${geography.height}`, role: "group",
    "aria-label": "California relief map. Select one of six rivers to open its page." });
  const defs = svg("defs");
  // Authored cartographic styling: geographic positions remain from the source bundle.
  defs.innerHTML = `<filter id="state-shadow" x="-30%" y="-30%" width="170%" height="170%"><feDropShadow dx="10" dy="20" stdDeviation="18" flood-color="#06141f" flood-opacity=".6"/></filter>
    <filter id="river-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="terrain-tone"><feColorMatrix type="matrix" values=".66 .15 .03 0 .04 .03 .68 .08 0 .04 .03 .16 .62 0 .02 0 0 0 1 0"/></filter>
    <linearGradient id="land-light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ede3ba" stop-opacity=".08"/><stop offset="1" stop-color="#152f3f" stop-opacity=".17"/></linearGradient>`;
  const clip = svg("clipPath", { id: "california-clip" });
  clip.append(svg("path", { d: geography.state_path, "fill-rule": "evenodd", "clip-rule": "evenodd" })); defs.append(clip); root.append(defs);
  root.append(svg("path", { d: geography.state_path, class: "state-crust", transform: "translate(0 11)", filter: "url(#state-shadow)", "fill-rule": "evenodd" }));
  root.append(svg("path", { d: geography.state_path, class: "state-outline", "fill-rule": "evenodd" }));
  const land = svg("g", { "clip-path": "url(#california-clip)", "aria-hidden": "true" });
  land.append(svg("image", { href: `./data/${geography.relief}`, x: 0, y: 0, width: geography.width, height: geography.height,
    preserveAspectRatio: "none", class: "terrain-image" }));
  land.append(svg("rect", { width: geography.width, height: geography.height, fill: "url(#land-light)" })); root.append(land);
  root.append(svg("path", { d: geography.state_path, class: "state-edge", "fill-rule": "evenodd" }));
  root.append(svg("text", { x: 180, y: 720, class: "map-ocean", transform: "rotate(-29 180 720)", "aria-hidden": "true" }, "Pacific Ocean"));
  root.append(svg("text", { x: 575, y: 245, class: "map-region", "aria-hidden": "true" }, "Nevada"));
  // Labels are placed for readable state-scale navigation; connectors end on source vertices.
  const labels = {
    eel_river: [90, 235], russian_river: [100, 425], sacramento_river: [465, 295],
    american_river: [530, 405], tuolumne_river: [590, 515], san_joaquin_river: [535, 635],
  };
  for (const shape of geography.rivers) {
    const river = rivers.find(r => r.id === shape.id); if (!river) continue;
    const group = svg("a", { href: riverDestination(river), class: "river-map-link", "data-river": river.id,
      "aria-label": `${river.name} — ${statusLabels[river.status]}`, tabindex: 0 });
    group.append(svg("title", {}, `${river.name}: ${statusLabels[river.status]}`));
    const paths = svg("g", { "clip-path": "url(#california-clip)" });
    for (const className of ["river-glow", "river-line", "river-hit"]) paths.append(svg("path", { d: shape.path, class: className }));
    group.append(paths);
    const [x, y] = labels[river.id], [anchorX, anchorY] = shape.anchor,
      labelWidth = Math.round(river.name.length * (compact ? 14 : 10) + 45), labelHeight = compact ? 100 : 42, leftSide = x < anchorX,
      endX = leftSide ? x + labelWidth : x;
    group.append(svg("path", { d: `M${anchorX},${anchorY} L${endX},${y + labelHeight / 2}`, class: "label-connector" }));
    group.append(svg("circle", { cx: anchorX, cy: anchorY, r: 3.5, class: "label-dot" }));
    group.append(svg("rect", { x, y, width: labelWidth, height: labelHeight, rx: compact ? 8 : 4, class: "label-back" }));
    group.append(svg("text", { x: x + 12, y: y + (compact ? 61 : 28) }, river.name));
    group.append(svg("text", { x: x + labelWidth - 23, y: y + (compact ? 61 : 28), class: "label-arrow", "aria-hidden": "true" }, "↗"));
    for (const event of ["pointerenter", "focus"]) group.addEventListener(event, () => setPreview(river));
    group.addEventListener("keydown", event => {
      if (event.key === " ") { event.preventDefault(); location.href = group.getAttribute("href"); }
    });
    root.append(group);
  }
  map.replaceChildren(root); map.setAttribute("aria-busy", "false");
}

try {
  const registry = await json("./data/registry.json"),
    rivers = await Promise.all(overviewRiverOrder(registry.rivers).map(entry => json(`./data/${entry.manifest}`)));
  list.replaceChildren();
  for (const river of rivers) {
    const choice = htmlLink("", riverDestination(river));
    choice.className = "river-choice"; choice.dataset.river = river.id; choice.dataset.status = river.status;
    choice.setAttribute("aria-label", `${river.name} — ${statusLabels[river.status]}`);
    const dot = document.createElement("span"); dot.className = "dot"; dot.setAttribute("aria-hidden", "true");
    choice.append(dot, document.createTextNode(river.name));
    for (const event of ["pointerenter", "focus"]) choice.addEventListener(event, () => setPreview(river));
    list.append(choice);
  }
  setPreview(rivers.find(r => r.id === "russian_river") ?? rivers[0]);
  try {
    const geography = await json("./data/california-overview.json");
    const render = () => {
      drawMap(geography, rivers);
      const active = rivers.find(r => r.name === document.querySelector("#preview-title").textContent) ?? rivers[0];
      setPreview(active);
    };
    render();
    window.matchMedia("(max-width: 760px)").addEventListener("change", render);
    const sources = document.querySelector("#map-sources"); sources.replaceChildren();
    for (const source of geography.sources) {
      const link = htmlLink(source.label, source.url); link.target = "_blank"; link.rel = "noopener"; sources.append(link);
    }
    const note = document.createElement("p"); note.textContent = "Generalized state boundary and named river reaches. Relief colors represent elevation, not land cover. River width, color and glow emphasize navigation and do not show current flow. American River forks are included."; sources.append(note);
  } catch (error) {
    map.replaceChildren(Object.assign(document.createElement("p"), { className: "map-loading", textContent: "The map could not load. Choose a river from the river links." }));
    map.setAttribute("aria-busy", "false");
  }
} catch (error) {
  list.textContent = "River navigation could not load. Reload to try again, or open Hacienda Bridge above.";
  map.textContent = "California map unavailable."; map.setAttribute("aria-busy", "false");
}
