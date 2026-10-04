import { loadPlaceFromRegistry } from "./data-model/place-registry.js";
import { fetchLatestContinuous, fetchDailyValues } from "./adapters/usgs.js";
import { latestAtOrBefore } from "./data-model/selection.js";
import { riverState } from "./data-model/river-state.js";
import { observedFlowStatus } from "./visual-bindings/flow-status.js";
import { dailyHydrograph } from "./visual-bindings/hydrograph.js";
import { matchingSeries } from "./data-model/binding-series.js";

const list = document.querySelector("#river-list"), detail = document.querySelector("#river-detail"),
  statuses = { available: "Explore places", in_development: "In development", planned: "Planned river" };
let generation = 0, registry;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
const networkFetch = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
async function json(url) {
  const response = await networkFetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return response.json();
}
function link(label, url, external = false) {
  const node = element("a", label); node.href = url;
  if (external) { node.target = "_blank"; node.rel = "noopener"; }
  return node;
}
function evidence(parent, title, payload, sourceUrl) {
  const drawer = element("details"); drawer.append(element("summary", title));
  if (sourceUrl) drawer.append(link("Open USGS source response", sourceUrl, true));
  drawer.append(element("pre", JSON.stringify(payload, null, 2))); parent.append(drawer);
}

async function loadGaugePlace(river, token) {
  const observations = element("section", null, "observation"), current = element("div"), daily = element("div");
  observations.setAttribute("aria-label", "Freeport observations");
  observations.append(element("h3", "First place: Freeport"),
    element("p", "This observation belongs to Freeport, south of Sacramento. The local 3D setting is still to come.", "note"));
  for (const node of [current, daily]) { node.setAttribute("aria-live", "polite"); node.append(element("p", "Loading USGS observations…")); }
  observations.append(current, daily); detail.append(observations);
  const loaded = await loadPlaceFromRegistry({ registryUrl: "./data/registry.json", riverPack: river.id,
    placeId: river.first_place, fetchImpl: networkFetch });
  if (token !== generation) return;
  const manifest = loaded.manifest, currentBinding = manifest.data_bindings.find(b => b.phenomenon === "discharge"),
    dailyBinding = manifest.data_bindings.find(b => b.phenomenon === "tidally_filtered_discharge");
  observations.insertBefore(link("USGS 11447650 station", manifest.references[0].url, true), current);
  await Promise.all([
    (async () => {
      try {
        const result = await fetchLatestContinuous(currentBinding.feature_id, currentBinding.parameter_code, networkFetch),
          validTime = new Date().toISOString(),
          selection = latestAtOrBefore(matchingSeries(result.quantities, currentBinding), validTime,
            { maximumAgeMs: currentBinding.maximum_age_minutes * 60000 }),
          state = riverState({ validTime, features: { gauges: [{ id: currentBinding.feature_id }], authored_places: [manifest] },
            selections: [{ feature_id: currentBinding.feature_id, phenomenon: "discharge",
              policy_id: "freeport_latest_at_or_before_45_minutes", result: selection }] }),
          status = observedFlowStatus(state, currentBinding.feature_id);
        if (token !== generation) return;
        current.replaceChildren(element("h3", "Instantaneous discharge"), element("p", status.headline, "reading"),
          element("p", `${status.badge}. ${status.detail}`, "note"));
        evidence(current, "Inspect observation and selection", { binding_class: "exact", binding: currentBinding,
          request: state.request, selection, quantity: status.quantity, retrieval_time: result.retrieval_time }, result.url);
      } catch (error) {
        if (token !== generation) return;
        current.replaceChildren(element("h3", "Instantaneous discharge"), element("p", "Observation unavailable", "reading"),
          element("p", "USGS could not be reached. Use the station link or reload to try again.", "note"));
        evidence(current, "Inspect source error", { error: error.message, binding: currentBinding });
      }
    })(),
    (async () => {
      const end = new Date(); end.setUTCDate(end.getUTCDate() - 1);
      const start = new Date(end); start.setUTCDate(start.getUTCDate() - 29);
      const startDate = start.toISOString().slice(0, 10), endDate = end.toISOString().slice(0, 10);
      try {
        const result = await fetchDailyValues(dailyBinding.feature_id, startDate, endDate,
          dailyBinding.parameter_code, dailyBinding.statistic_id, networkFetch),
          quantities = matchingSeries(result.quantities, dailyBinding),
          chart = dailyHydrograph(quantities, { width: 600, height: 180, padding: 12, phenomenon: dailyBinding.phenomenon });
        if (token !== generation) return;
        daily.replaceChildren(element("h3", "Tidally filtered daily discharge"),
          element("p", `${startDate} to ${endDate}. A separate daily mean product, not the instantaneous reading above.`, "note"));
        if (chart.kind === "empty") daily.append(element("p", "No daily records are available in this window."));
        else {
          const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
          svg.setAttribute("viewBox", "0 0 600 180"); svg.setAttribute("class", "chart"); svg.setAttribute("role", "img");
          svg.setAttribute("aria-label", `${chart.points.length} daily means, from ${chart.min} to ${chart.max} ft³/s. Gaps are not connected.`);
          for (const y of [12, 90, 168]) {
            const grid = document.createElementNS(ns, "line");
            for (const [key, value] of Object.entries({ x1: 12, x2: 588, y1: y, y2: y })) grid.setAttribute(key, value);
            svg.append(grid);
          }
          const path = document.createElementNS(ns, "path"); path.setAttribute("d", chart.path); svg.append(path);
          for (const segment of chart.segments) if (segment.length === 1) {
            const dot = document.createElementNS(ns, "circle");
            dot.setAttribute("cx", segment[0].x); dot.setAttribute("cy", segment[0].y); dot.setAttribute("r", "3"); svg.append(dot);
          }
          const labels = element("div", null, "chart-labels");
          labels.append(element("span", chart.first_time.slice(0, 10)), element("span", chart.last_time.slice(0, 10)));
          daily.append(element("p", `Range: ${chart.min.toLocaleString()}–${chart.max.toLocaleString()} ft³/s`, "note"), svg, labels);
        }
        evidence(daily, "Inspect daily records and source", { binding_class: "exact", binding: dailyBinding,
          retrieval_time: result.retrieval_time, quantities }, result.url);
      } catch (error) {
        if (token !== generation) return;
        daily.replaceChildren(element("h3", "Tidally filtered daily discharge"), element("p", "Daily history unavailable. Use the station link or reload to try again."));
        evidence(daily, "Inspect source error", { error: error.message, binding: dailyBinding });
      }
    })(),
  ]);
}

async function selectRiver(id) {
  const token = ++generation, entry = registry.rivers.find(r => r.id === id);
  for (const choice of list.querySelectorAll("a")) {
    if (choice.dataset.river === id) choice.setAttribute("aria-current", "page"); else choice.removeAttribute("aria-current");
  }
  detail.replaceChildren(element("p", "Loading river…"));
  try {
    const river = await json(new URL(entry.manifest, new URL("./data/registry.json", location.href)));
    if (token !== generation) return;
    const title = element("h2", river.name); title.id = "river-name";
    detail.replaceChildren(element("span", statuses[river.status], "status"), title, element("p", river.summary, "summary"));
    document.title = `${river.name} · River Pulse · Waterscape`;
    if (river.scenes?.length) {
      const scenes = element("div", null, "scene-links");
      for (const scene of river.scenes) scenes.append(link(`Explore ${scene.name}`,
        new URL(scene.entry, new URL(`./data/${entry.manifest}`, location.href))));
      detail.append(scenes);
    }
    if (river.status === "planned") detail.append(element("p", "This river has a reserved place in the atlas. Its gauges, terrain and scenes are still to come.", "note"));
    const references = element("details"), sources = element("ul", null, "references");
    references.append(element("summary", "River sources"));
    for (const ref of river.references) { const item = element("li"); item.append(link(ref.label, ref.url, true)); sources.append(item); }
    references.append(sources); detail.append(references);
    if (river.first_place) await loadGaugePlace(river, token);
  } catch (error) {
    if (token !== generation) return;
    detail.append(element("p", "River details could not load. Reload to try again."));
  }
}
function selectedId() {
  const id = new URL(location.href).searchParams.get("river") ?? "sacramento_river";
  return registry.rivers.some(r => r.id === id) ? id : "sacramento_river";
}
try {
  registry = await json("./data/registry.json");
  const order = ["russian_river", "sacramento_river", "san_joaquin_river", "eel_river", "tuolumne_river", "american_river"];
  list.replaceChildren();
  const rivers = [...registry.rivers].sort((a, b) => {
    const rank = id => order.includes(id) ? order.indexOf(id) : order.length;
    return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name);
  });
  for (const river of rivers) {
    const choice = link("", `?river=${river.id}`); choice.className = "river-choice"; choice.dataset.river = river.id;
    choice.append(element("strong", river.name), element("small", statuses[river.status]));
    choice.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault(); history.pushState(null, "", choice.href); selectRiver(river.id);
    });
    list.append(choice);
  }
  window.addEventListener("popstate", () => selectRiver(selectedId()));
  await selectRiver(selectedId());
} catch (error) {
  list.replaceChildren(element("p", "River list unavailable."));
  detail.replaceChildren(element("p", "The river atlas could not load. Reload to try again, or open Hacienda or Jenner above."));
}
