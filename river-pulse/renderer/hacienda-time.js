import {
  GAUGE_TIME_MODES,
  resolveGaugeDischargeState,
} from "../data-model/gauge-time-state.js";
import { observedFlowStatus } from "../visual-bindings/flow-status.js";

const slider = document.querySelector("#time-range"),
  selectionLabel = document.querySelector("#time-selection-label"),
  timelineHeading = document.querySelector("#timeline-heading"),
  flowValue = document.querySelector("#flow-value"),
  flowTime = document.querySelector("#flow-time"),
  flowQuality = document.querySelector("#flow-quality"),
  historyCursor = document.querySelector("#history-cursor"),
  SOURCE_URL = "../data/russian_river/places/hacienda_bridge/source.json";

function unit(value) {
  return value === "ft^3/s" ? "ft³/s" : value ?? "";
}

function number(value) {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatDate(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function currentPresentation(state, featureId) {
  return observedFlowStatus(state, featureId);
}

function historicalPresentation(state) {
  const q = state.selected_quantities[0];
  if (!q)
    return {
      kind: "unavailable",
      badge: "Missing",
      headline: "No daily value",
      detail: "No daily mean covers the selected date",
    };
  return {
    kind: "historical",
    badge: "History",
    headline: `${number(q.value)} ${unit(q.unit)}`,
    detail: `${formatDate(q.time.valid_start)} · daily mean · ${q.source_approval}`,
  };
}

function setFlowPresentation(presentation) {
  flowValue.textContent = presentation.headline;
  flowTime.textContent = presentation.detail;
  flowQuality.className = `flow-quality ${presentation.kind}`;
  flowQuality.textContent = presentation.badge;
}

function dispatchState(state, mode, monitoringLocationId) {
  window.riverPulseState = state;
  window.dispatchEvent(
    new CustomEvent("river-pulse-state-change", {
      detail: { state, mode, monitoringLocationId },
    }),
  );
}

async function waitForHydrology(timeoutMs = 8000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (window.riverPulseState && window.riverPulseHistory?.kind === "series")
      return { currentState: window.riverPulseState, graph: window.riverPulseHistory };
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return null;
}

async function main() {
  const sourceResponse = await fetch(SOURCE_URL);
  if (!sourceResponse.ok) return;
  const source = await sourceResponse.json(),
    agency = source.gauge?.agency ?? "USGS",
    site = source.gauge?.id ?? "11467000",
    featureId = `${agency}-${site}`,
    ready = await waitForHydrology();
  if (!ready || !ready.graph.points.length) return;

  const currentState = ready.currentState,
    graph = ready.graph,
    dailyQuantities = graph.points.map((point) => point.quantity),
    nowIndex = dailyQuantities.length;

  slider.min = "0";
  slider.max = String(nowIndex);
  slider.value = String(nowIndex);
  slider.disabled = false;
  slider.setAttribute("aria-valuemin", "0");
  slider.setAttribute("aria-valuemax", String(nowIndex));
  slider.setAttribute("aria-valuetext", "Now");

  function apply(index) {
    if (index >= nowIndex) {
      historyCursor.hidden = true;
      selectionLabel.textContent = "Now";
      selectionLabel.classList.remove("history-selected");
      timelineHeading.textContent = "Live continuous observation";
      slider.setAttribute("aria-valuetext", "Now");
      setFlowPresentation(currentPresentation(currentState, featureId));
      dispatchState(currentState, GAUGE_TIME_MODES.CURRENT_CONTINUOUS, featureId);
      return;
    }

    const point = graph.points[index],
      q = point.quantity,
      startMs = Date.parse(q.time.valid_start),
      endMs = Date.parse(q.time.valid_end),
      validTime = new Date(startMs + Math.max(1, endMs - startMs) / 2).toISOString(),
      state = resolveGaugeDischargeState({
        featureId,
        validTime,
        mode: GAUGE_TIME_MODES.HISTORICAL_DAILY,
        dailyQuantities,
      });

    historyCursor.setAttribute("cx", point.x.toFixed(2));
    historyCursor.setAttribute("cy", point.y.toFixed(2));
    historyCursor.hidden = false;
    selectionLabel.textContent = formatDate(q.time.valid_start).replace(", 2026", "");
    selectionLabel.classList.add("history-selected");
    timelineHeading.textContent = "Historical daily mean — release or keep scrubbing to compare dates";
    slider.setAttribute("aria-valuetext", formatDate(q.time.valid_start));
    setFlowPresentation(historicalPresentation(state));
    dispatchState(state, GAUGE_TIME_MODES.HISTORICAL_DAILY, featureId);
  }

  slider.addEventListener("input", () => apply(Number(slider.value)));
  apply(nowIndex);
}

main().catch((error) => console.warn("Interactive river time unavailable", error));
