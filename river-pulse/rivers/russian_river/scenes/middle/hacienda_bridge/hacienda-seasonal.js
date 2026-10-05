import { fetchDayOfYearStatistics } from "../../../../../core/adapters/usgs-statistics.js";
import { streamflowCondition } from "../../../../../core/visual-bindings/streamflow-condition.js";

const conditionLabel = document.querySelector("#condition-label"),
  conditionDetail = document.querySelector("#condition-detail"),
  conditionCard = document.querySelector("#seasonal-condition"),
  SOURCE_URL = "./data/source.json";

let sourceConfig = null,
  requestSequence = 0,
  debounceTimer = null;

function zonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date),
    byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    validDate: `${byType.year}-${byType.month}-${byType.day}`,
    monthDay: `${byType.month}-${byType.day}`,
  };
}

function datePartsForState(state, observation, timeZone) {
  if (observation?.method?.method_id === "usgs_daily_mean") {
    const validDate = observation.time.valid_start.slice(0, 10);
    return { validDate, monthDay: validDate.slice(5) };
  }
  return zonedDateParts(new Date(state.request.valid_time), timeZone);
}

function selectedDischarge(state, monitoringLocationId) {
  return (
    state?.selected_quantities?.find(
      (candidate) =>
        candidate.feature_id === monitoringLocationId &&
        candidate.phenomenon === "discharge",
    ) ?? null
  );
}

function publish(condition, monthDay) {
  conditionCard.dataset.condition = condition.kind;
  conditionLabel.textContent = condition.label;
  conditionDetail.textContent = condition.rankable
    ? `${condition.detail} · ${condition.sample_count} historical day-of-year observations for ${monthDay}`
    : condition.detail;
  window.riverPulseSeasonalCondition = condition;
  window.dispatchEvent(
    new CustomEvent("river-pulse-condition-change", {
      detail: { condition, monthDay },
    }),
  );
}

function publishUnavailable(
  message = "USGS day-of-year statistics could not be loaded",
) {
  const condition = {
    kind: "unavailable",
    label: "Seasonal context unavailable",
    detail: message,
    rankable: false,
    representation: "historical-context",
  };
  publish(condition, "—");
}

async function updateForState(state) {
  if (!sourceConfig || !state) return;
  const { monitoringLocationId, timeZone } = sourceConfig,
    observation = selectedDischarge(state, monitoringLocationId),
    { validDate, monthDay } = datePartsForState(state, observation, timeZone),
    sequence = ++requestSequence;

  if (!observation) {
    publish(streamflowCondition(null, []), monthDay);
    return;
  }

  conditionCard.dataset.condition = "checking";
  conditionLabel.textContent = "Checking historical context…";
  conditionDetail.textContent = `USGS day-of-year statistics for ${monthDay}`;
  window.dispatchEvent(
    new CustomEvent("river-pulse-condition-change", {
      detail: { condition: { kind: "checking" }, monthDay },
    }),
  );

  try {
    const stats = await fetchDayOfYearStatistics(
      monitoringLocationId,
      monthDay,
      validDate,
    );
    if (sequence !== requestSequence) return;
    publish(streamflowCondition(observation, stats.quantities), monthDay);
  } catch (error) {
    if (sequence !== requestSequence) return;
    console.warn("Seasonal streamflow context unavailable", error);
    publishUnavailable();
  }
}

function scheduleUpdate(state) {
  requestSequence++;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => updateForState(state), 180);
}

async function main() {
  const sourceResponse = await fetch(SOURCE_URL);
  if (!sourceResponse.ok)
    throw new Error(`Source manifest ${sourceResponse.status}`);
  const source = await sourceResponse.json(),
    agency = source.gauge?.agency ?? "USGS",
    site = source.gauge?.id ?? "11467000";
  sourceConfig = {
    monitoringLocationId: `${agency}-${site}`,
    timeZone: source.timeZone ?? "America/Los_Angeles",
  };

  window.addEventListener("river-pulse-state-change", (event) =>
    scheduleUpdate(event.detail?.state),
  );

  // The time controller may have emitted its initial state before this module attached.
  // Reading the shared selected state makes startup order deterministic either way.
  if (window.riverPulseState) scheduleUpdate(window.riverPulseState);
}

main().catch((error) => {
  console.warn("Seasonal streamflow context unavailable", error);
  publishUnavailable();
});
