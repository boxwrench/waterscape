import { watershedMap } from "./eel-state-layout.js";

const base = "../data/eel_river/places/scotia_bluffs/", ns = "http://www.w3.org/2000/svg";

function svgElement(name, attributes, text = null) {
  const element = document.createElementNS(ns, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== null) element.textContent = text;
  return element;
}

async function context() {
  const [unit, area, source] = await Promise.all(["calwater-unit.geojson", "calwater-area.geojson", "source.json"].map(async file => {
    const response = await fetch(base + file);
    if (!response.ok) throw new Error(`California context ${file}: ${response.status}`);
    return response.json();
  }));
  const map = watershedMap(unit, area, source), svg = document.getElementById("watershed-map"), [x, y] = map.anchor;
  svg.append(
    svgElement("path", { d: map.unitPath, class: "watershed-unit", "fill-rule": "evenodd" }),
    svgElement("path", { d: map.areaPath, class: "watershed-area", "fill-rule": "evenodd" }),
    svgElement("path", { d: map.extentPath, class: "watershed-extent" }),
    svgElement("circle", { cx: x, cy: y, r: 4, class: "watershed-anchor" }),
    svgElement("path", { d: `M${x + 6},${y}h16`, class: "watershed-leader" }),
    svgElement("text", { x: x + 26, y: y + 4, class: "watershed-label" }, "Scotia"),
    svgElement("text", { x: 314, y: 23, class: "watershed-label" }, "N ↑"),
  );
  document.getElementById("watershed-caption").textContent = `${map.areaName} · area ${map.areaCode} within ${map.unitName} · unit ${map.unitCode}. Dot: station anchor. Dashed box: selected study extent.`;
  document.getElementById("state-status").textContent = "California Water Boards · CalWater 2.2.1";
}

// Source context remains available independently of graphics initialization.
context().catch(error => {
  document.getElementById("watershed-caption").textContent = `California watershed map unavailable: ${error.message}`;
});
