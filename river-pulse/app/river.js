import { loadPlaceFromRegistry } from "../core/data-model/place-registry.js";
import { fetchLatestContinuous, fetchDailyValues } from "../core/adapters/usgs.js";
import { latestAtOrBefore } from "../core/data-model/selection.js";
import { riverState } from "../core/data-model/river-state.js";
import { observedFlowStatus } from "../core/visual-bindings/flow-status.js";
import { dailyHydrograph } from "../core/visual-bindings/hydrograph.js";
import { matchingSeries } from "../core/data-model/binding-series.js";
import { loadRiver, SLOT_LABELS } from "../core/data-model/river-package.js";

const list = document.querySelector("#river-list"), detail = document.querySelector("#river-detail"),
  crumb = document.querySelector("#crumb-river"),
  statuses = { available: "Explore places", in_development: "In development", planned: "Planned river" },
  svgNS = "http://www.w3.org/2000/svg";
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
function reading(status) {
  const node = element("p", null, "reading"), q = status.quantity;
  if (q && (status.kind === "current" || status.kind === "stale")) {
    node.append(Number(q.value).toLocaleString("en-US", { maximumFractionDigits: 2 }),
      element("small", String(q.unit ?? "").replace("ft^3/s", "ft³/s")));
    if (status.kind === "stale") node.classList.add("stale");
  } else node.textContent = status.headline;
  return node;
}
function hydrograph(chart, labelText) {
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 600 180"); svg.setAttribute("class", "chart"); svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", labelText);
  for (const y of [12, 90, 168]) {
    const grid = document.createElementNS(svgNS, "line");
    for (const [key, value] of Object.entries({ x1: 12, x2: 588, y1: y, y2: y })) grid.setAttribute(key, value);
    svg.append(grid);
  }
  const path = document.createElementNS(svgNS, "path"); path.setAttribute("d", chart.path); svg.append(path);
  for (const segment of chart.segments) if (segment.length === 1) {
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", segment[0].x); dot.setAttribute("cy", segment[0].y); dot.setAttribute("r", "3"); svg.append(dot);
  }
  return svg;
}

// "Right now": one observed reading and its recent history. Nothing here is modelled or invented.
function nowPanel(river, token) {
  const panel = element("section", null, "now");
  panel.setAttribute("aria-label", `${river.name} observations`);
  if (!river.live_data_scene) {
    panel.classList.add("empty-now");
    const cell = element("div");
    cell.append(element("p", river.status === "planned" ? "Not yet in the atlas" : "No live gauge yet", "eyebrow"),
      element("p", river.status === "planned"
        ? "This river has a reserved place in the atlas. Its gauges, terrain and scenes are still to come."
        : "No USGS gauge is bound to this river yet, so nothing on this page is a measured river condition. The scenes below show terrain and illustrative water only."));
    panel.append(cell); return { panel, ready: Promise.resolve() };
  }
  const current = element("div"), daily = element("div");
  for (const node of [current, daily]) { node.setAttribute("aria-live", "polite"); node.append(element("p", "Loading USGS observations…", "note")); }
  panel.append(current, daily);
  const ready = (async () => {
    const loaded = await loadPlaceFromRegistry({ registryUrl: "./registry.json", riverPack: river.id,
      placeId: river.live_data_scene, fetchImpl: networkFetch });
    if (token !== generation) return;
    const manifest = loaded.manifest, name = manifest.name.replace(/ visual study$/, ""),
      binding = manifest.data_bindings.find(b => b.phenomenon === "discharge"),
      filteredBinding = manifest.data_bindings.find(b => b.phenomenon === "tidally_filtered_discharge"),
      // A binding with a time series is matched exactly; one without is matched on station and quantity only.
      exact = Boolean(binding.time_series_id), maximumAgeMinutes = binding.maximum_age_minutes ?? 120,
      keep = (quantities, b) => exact ? matchingSeries(quantities, b)
        : quantities.filter(q => q.feature_id === b.feature_id && q.phenomenon === b.phenomenon);
    const station = manifest.references?.find(r => /usgs/i.test(r.label ?? "") || /waterdata\.usgs\.gov/.test(r.url));
    await Promise.all([
      (async () => {
        try {
          const result = await fetchLatestContinuous(binding.feature_id, binding.parameter_code, networkFetch),
            validTime = new Date().toISOString(),
            selection = latestAtOrBefore(keep(result.quantities, binding), validTime, { maximumAgeMs: maximumAgeMinutes * 60000 }),
            state = riverState({ validTime, features: { gauges: [{ id: binding.feature_id }], authored_places: [manifest] },
              selections: [{ feature_id: binding.feature_id, phenomenon: "discharge",
                policy_id: `${binding.id}_latest_at_or_before_${maximumAgeMinutes}_minutes`, result: selection }] }),
            status = observedFlowStatus(state, binding.feature_id);
          if (token !== generation) return;
          const badge = element("span", status.badge, `badge ${status.kind}`);
          current.replaceChildren(element("p", `Right now · ${name}`, "eyebrow"), reading(status),
            element("p", null, "note"));
          current.lastChild.append(badge, status.kind === "stale"
            ? `No current reading. Last value ${status.detail.replace(/^Latest [^·]*· /, "")}` : status.detail);
          if (station) current.append(link("USGS station page", station.url, true));
          evidence(current, "Inspect observation and selection", { binding_class: exact ? "exact" : "station_and_quantity",
            binding, request: state.request, selection, quantity: status.quantity, retrieval_time: result.retrieval_time }, result.url);
        } catch (error) {
          if (token !== generation) return;
          current.replaceChildren(element("p", `Right now · ${name}`, "eyebrow"), element("p", "Unavailable", "reading"),
            element("p", "USGS could not be reached. Reload to try again.", "note"));
          evidence(current, "Inspect source error", { error: error.message, binding });
        }
      })(),
      (async () => {
        const end = new Date(); end.setUTCDate(end.getUTCDate() - 1);
        const start = new Date(end); start.setUTCDate(start.getUTCDate() - 29);
        const startDate = start.toISOString().slice(0, 10), endDate = end.toISOString().slice(0, 10),
          dailyBinding = filteredBinding ?? { ...binding, phenomenon: "discharge", parameter_code: binding.parameter_code, statistic_id: "00003" },
          title = filteredBinding ? "Tidally filtered daily discharge" : "Daily mean discharge";
        try {
          const result = await fetchDailyValues(dailyBinding.feature_id, startDate, endDate,
            dailyBinding.parameter_code, dailyBinding.statistic_id ?? "00003", networkFetch),
            quantities = keep(result.quantities, dailyBinding),
            chart = dailyHydrograph(quantities, { width: 600, height: 180, padding: 12, phenomenon: dailyBinding.phenomenon });
          if (token !== generation) return;
          daily.replaceChildren(element("p", `${title} · last 30 days`, "eyebrow"));
          if (chart.kind === "empty") daily.append(element("p", "No daily records are available in this window.", "note"));
          else {
            const labels = element("div", null, "chart-labels");
            labels.append(element("span", chart.first_time.slice(0, 10)),
              element("span", `${chart.min.toLocaleString()}–${chart.max.toLocaleString()} ft³/s`), element("span", chart.last_time.slice(0, 10)));
            daily.append(hydrograph(chart, `${chart.points.length} daily means, from ${chart.min} to ${chart.max} ft³/s. Gaps are not connected.`), labels,
              element("p", filteredBinding ? "A separate daily mean product, not the instantaneous reading." : "Daily mean from the same station.", "note"));
          }
          evidence(daily, "Inspect daily records and source", { binding_class: exact ? "exact" : "station_and_quantity",
            binding: dailyBinding, retrieval_time: result.retrieval_time, quantities }, result.url);
        } catch (error) {
          if (token !== generation) return;
          daily.replaceChildren(element("p", title, "eyebrow"), element("p", "Daily history unavailable. Reload to try again.", "note"));
          evidence(daily, "Inspect source error", { error: error.message, binding: dailyBinding });
        }
      })(),
    ]);
  })();
  return { panel, ready };
}

function sceneCard(scene) {
  const planned = scene.status !== "built",
    card = planned ? element("div", null, "scene planned") : link("", scene.entryUrl);
  if (!planned) { card.className = "scene"; card.setAttribute("aria-label", `Explore ${scene.name}`); }
  if (scene.thumbUrl) { const img = element("img"); img.src = scene.thumbUrl; img.alt = ""; img.loading = "lazy"; card.append(img); }
  else card.append(element("div", planned ? "Planned" : "", "placeholder"));
  const body = element("div", null, "scene-body");
  body.append(element("p", SLOT_LABELS[scene.slot], "slot"), element("h4", scene.name));
  if (planned) body.append(element("p", "This slot is reserved. No scene, data or geography is implied yet.", "fidelity"));
  else {
    if (scene.fidelity) body.append(element("p", scene.fidelity, "fidelity"));
    if (scene.views?.length) {
      const views = element("ul", null, "views"); views.setAttribute("aria-label", "Viewpoints");
      for (const view of scene.views) views.append(element("li", view));
      body.append(views);
    }
    body.append(element("span", "Explore →", "open"));
  }
  card.append(body);
  return card;
}

async function selectRiver(id) {
  const token = ++generation, entry = registry.rivers.find(r => r.id === id);
  for (const choice of list.querySelectorAll("a")) {
    if (choice.dataset.river === id) choice.setAttribute("aria-current", "page"); else choice.removeAttribute("aria-current");
  }
  detail.replaceChildren(element("p", "Loading river…", "note"));
  try {
    const river = await loadRiver(`./${entry.manifest}`, json);
    if (token !== generation) return;
    document.title = `${river.name} · River Pulse · Waterscape`; crumb.textContent = river.name;
    const built = river.scenes.filter(scene => scene.status === "built"), sceneCount = built.length, hero = element("section", null, "hero"), copy = element("div", null, "hero-copy"),
      title = element("h2", river.name), status = element("span", statuses[river.status], "status"), facts = element("ul", null, "facts");
    title.id = "river-name"; status.dataset.status = river.status;
    if (built[0]?.thumbUrl) { const img = element("img"); img.src = built[0].thumbUrl; img.alt = ""; hero.append(img); }
    facts.append(element("li", sceneCount ? `${sceneCount} of ${river.scenes.length} scenes built` : "No scenes built yet"),
      element("li", river.live_data_scene ? "Live USGS discharge" : "No live gauge yet"));
    copy.append(status, title, element("p", river.summary, "summary"), facts); hero.append(copy);
    detail.replaceChildren(hero);

    const nowHead = element("div", null, "section-head"), now = nowPanel(river, token);
    nowHead.append(element("h3", "What the river is doing"),
      element("p", river.live_data_scene ? "Observed by USGS, with the time and approval status shown." : "Only observed or sourced values appear here."));
    detail.append(nowHead, now.panel);

    {
      const head = element("div", null, "section-head"), scenes = element("div", null, "scenes");
      head.append(element("h3", "From start to end"),
        element("p", "Each river has a start, a middle and an end. Open a built scene, then choose a viewpoint."));
      for (const scene of river.scenes) scenes.append(sceneCard(scene));
      detail.append(head, scenes);
    }
    if (river.next_steps?.length && river.status !== "available") {
      const head = element("div", null, "section-head"), steps = element("ul", null, "next");
      head.append(element("h3", "What comes next"));
      for (const step of river.next_steps) steps.append(element("li", step));
      detail.append(head, steps);
    }
    const references = element("details"), sources = element("ul", null, "references");
    references.append(element("summary", "River sources"));
    for (const ref of river.references) { const item = element("li"); item.append(link(ref.label, ref.url, true)); sources.append(item); }
    references.append(sources); detail.append(references);
    await now.ready;
  } catch (error) {
    if (token !== generation) return;
    detail.append(element("p", "River details could not load. Reload to try again.", "note"));
  }
}
function selectedId() {
  const id = new URL(location.href).searchParams.get("river") ?? "sacramento_river";
  return registry.rivers.some(r => r.id === id) ? id : "sacramento_river";
}
try {
  registry = await json("./registry.json");
  const order = ["russian_river", "sacramento_river", "san_joaquin_river", "eel_river", "tuolumne_river", "american_river"];
  list.replaceChildren();
  const rivers = [...registry.rivers].sort((a, b) => {
    const rank = id => order.includes(id) ? order.indexOf(id) : order.length;
    return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name);
  });
  for (const river of rivers) {
    const choice = link("", `?river=${river.id}`); choice.className = "river-choice"; choice.dataset.river = river.id; choice.dataset.status = river.status;
    const dot = element("span", null, "dot"); dot.setAttribute("aria-hidden", "true");
    choice.append(dot, element("span", river.name), element("small", ` · ${statuses[river.status]}`));
    choice.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault(); history.pushState(null, "", choice.href); selectRiver(river.id);
    });
    list.append(choice);
  }
  window.addEventListener("popstate", () => selectRiver(selectedId()));
  await selectRiver(selectedId());
} catch (error) {
  list.replaceChildren(element("p", "River list unavailable.", "note"));
  detail.replaceChildren(element("p", "The river atlas could not load. Reload to try again, or return to the California overview.", "note"));
}
