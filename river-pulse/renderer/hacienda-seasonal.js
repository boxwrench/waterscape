import { fetchDayOfYearStatistics } from "../adapters/usgs-statistics.js";
import { streamflowCondition } from "../visual-bindings/streamflow-condition.js";

const conditionLabel = document.querySelector("#condition-label"),
  conditionDetail = document.querySelector("#condition-detail"),
  conditionCard = document.querySelector("#seasonal-condition"),
  SOURCE_URL = "../data/russian_river/places/hacienda_bridge/source.json";

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

async function waitForCurrentObservation(monitoringLocationId, timeoutMs = 6000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const q = window.riverPulseState?.selected_quantities?.find(
      (candidate) => candidate.feature_id === monitoringLocationId && candidate.phenomenon === "discharge",
    );
    if (q) return q;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return null;
}

function render(condition, monthDay) {
  conditionCard.dataset.condition = condition.kind;
  conditionLabel.textContent = condition.label;
  conditionDetail.textContent = condition.rankable
    ? `${condition.detail} · ${condition.sample_count} historical day-of-year observations for ${monthDay}`
    : condition.detail;
  window.riverPulseSeasonalCondition = condition;
}

async function main() {
  try {
    const sourceResponse = await fetch(SOURCE_URL);
    if (!sourceResponse.ok) throw new Error(`Source manifest ${sourceResponse.status}`);
    const source = await sourceResponse.json(),
      agency = source.gauge?.agency ?? "USGS",
      site = source.gauge?.id ?? "11467000",
      monitoringLocationId = `${agency}-${site}`,
      timeZone = source.timeZone ?? "America/Los_Angeles",
      { validDate, monthDay } = zonedDateParts(new Date(), timeZone),
      observation = await waitForCurrentObservation(monitoringLocationId);

    if (!observation) {
      render(streamflowCondition(null, []), monthDay);
      return;
    }

    const stats = await fetchDayOfYearStatistics(monitoringLocationId, monthDay, validDate),
      condition = streamflowCondition(observation, stats.quantities);
    render(condition, monthDay);
  } catch (error) {
    console.warn("Seasonal streamflow context unavailable", error);
    conditionCard.dataset.condition = "unavailable";
    conditionLabel.textContent = "Seasonal context unavailable";
    conditionDetail.textContent = "USGS day-of-year statistics could not be loaded";
  }
}

main();
