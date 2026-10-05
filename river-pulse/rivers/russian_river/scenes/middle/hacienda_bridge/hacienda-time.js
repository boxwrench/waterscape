import {
  GAUGE_TIME_MODES,
  resolveGaugeDischargeState,
} from "../../../../../core/data-model/gauge-time-state.js";
import { observedFlowStatus, flowDisplay } from "../../../../../core/visual-bindings/flow-status.js";

const slider = document.querySelector("#time-range"),
  label = document.querySelector("#time-selection-label"),
  heading = document.querySelector("#timeline-heading"),
  value = document.querySelector("#flow-value"),
  time = document.querySelector("#flow-time"),
  quality = document.querySelector("#flow-quality"),
  cursor = document.querySelector("#history-cursor"),
  play = document.querySelector("#history-play"),
  now = document.querySelector("#return-now");
let currentState = window.riverPulseCurrentState ?? null,
  graph = window.riverPulseHistory ?? null,
  featureId = currentState?.features.gauges[0]?.id,
  live = true,
  timer = null,
  offline = false;

function date(iso) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}
function stop() {
  clearInterval(timer);
  timer = null;
  play.textContent = "Play history";
  play.setAttribute("aria-pressed", "false");
}
function publish(state, mode) {
  window.riverPulseState = state;
  dispatchEvent(
    new CustomEvent("river-pulse-state-change", {
      detail: { state, mode, monitoringLocationId: featureId },
    }),
  );
}
function apply(index) {
  const points = graph?.points ?? [],
    count = points.length;
  live = index >= count;
  if (live) {
    cursor.hidden = true;
    label.textContent = "Now";
    heading.textContent = "Latest continuous observation";
    slider.value = String(count);
    slider.setAttribute("aria-valuetext", "Now");
    if (!currentState) return;
    const presentation = observedFlowStatus(currentState, featureId);
    const shown = flowDisplay(presentation);
    value.textContent = shown.value;
    value.classList.toggle("stale", shown.muted);
    time.textContent = offline
      ? "USGS is unavailable. Saved history can still be explored."
      : shown.note;
    quality.className = `flow-quality ${presentation.kind}`;
    quality.textContent = offline ? "Offline" : presentation.badge;
    publish(currentState, GAUGE_TIME_MODES.CURRENT_CONTINUOUS);
    return;
  }
  const point = points[index],
    q = point.quantity,
    start = Date.parse(q.time.valid_start),
    end = Date.parse(q.time.valid_end),
    state = resolveGaugeDischargeState({
      featureId: q.feature_id,
      validTime: new Date(start + (end - start) / 2).toISOString(),
      mode: GAUGE_TIME_MODES.HISTORICAL_DAILY,
      dailyQuantities: points.map((p) => p.quantity),
    }),
    selected = state.selected_quantities[0];
  featureId = q.feature_id;
  value.textContent = selected
    ? `${Number(selected.value).toLocaleString("en-US", { maximumFractionDigits: 2 })} ft³/s`
    : "No daily value";
  time.textContent = `${date(q.time.valid_start)} · daily mean · ${q.source_approval}`;
  quality.className = "flow-quality historical";
  quality.textContent = "History";
  label.textContent = date(q.time.valid_start);
  heading.textContent = "Historical daily mean";
  slider.setAttribute("aria-valuetext", date(q.time.valid_start));
  cursor.setAttribute("cx", point.x.toFixed(2));
  cursor.setAttribute("cy", point.y.toFixed(2));
  cursor.hidden = false;
  publish(state, GAUGE_TIME_MODES.HISTORICAL_DAILY);
}
function updateGraph(next) {
  const previous = graph?.points?.[Number(slider.value)]?.time;
  graph = next;
  const count = graph?.points?.length ?? 0;
  slider.min = "0";
  slider.max = String(count);
  slider.disabled = count === 0;
  play.disabled = count === 0;
  now.disabled = !currentState;
  const oldIndex = graph?.points?.findIndex((p) => p.time === previous) ?? -1;
  slider.value = String(live || oldIndex < 0 ? count : oldIndex);
  apply(Number(slider.value));
}
addEventListener("river-pulse-current-change", (event) => {
  currentState = event.detail.state;
  featureId = event.detail.monitoringLocationId;
  offline = Boolean(event.detail.offline);
  now.disabled = false;
  if (live) apply(graph?.points?.length ?? 0);
});
addEventListener("river-pulse-history-change", (event) =>
  updateGraph(event.detail.graph),
);
slider.addEventListener("input", () => {
  stop();
  apply(Number(slider.value));
});
now.addEventListener("click", () => {
  stop();
  apply(graph?.points?.length ?? 0);
});
play.addEventListener("click", () => {
  if (timer) return stop();
  if (live) {
    slider.value = "0";
    apply(0);
  }
  play.textContent = "Pause history";
  play.setAttribute("aria-pressed", "true");
  timer = setInterval(() => {
    const index = Number(slider.value) + 1,
      count = graph?.points?.length ?? 0;
    slider.value = String(index);
    apply(index);
    if (index >= count) stop();
  }, 1200);
});
addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
updateGraph(graph);
