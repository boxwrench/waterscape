// Presentation mapping for current discharge in the context of USGS day-of-year statistics.
// The input observation and historical statistics remain unchanged scientific quantities.

export const MINIMUM_RANKING_SAMPLE_COUNT = 20;

function statistic(quantities, { computation = null, percentile = null } = {}) {
  return quantities.find((q) => {
    if (q.availability !== "present" || q.phenomenon !== "discharge_day_of_year_statistic") return false;
    if (computation && q.method?.computation !== computation) return false;
    if (percentile != null && Number(q.method?.percentile) !== percentile) return false;
    return true;
  });
}

function notRanked(reason, supporting = []) {
  return {
    kind: "not-ranked",
    label: "Not ranked",
    detail: reason,
    percentile_band: null,
    rankable: false,
    representation: "historical-context",
    supporting_quantities: supporting,
  };
}

export function streamflowCondition(
  observation,
  statistics,
  { minimumSampleCount = MINIMUM_RANKING_SAMPLE_COUNT } = {},
) {
  if (!observation || observation.availability !== "present" || !Number.isFinite(Number(observation.value)))
    return notRanked("Current discharge is unavailable");

  const minimum = statistic(statistics, { computation: "minimum" }) ?? statistic(statistics, { percentile: 0 }),
    p10 = statistic(statistics, { percentile: 10 }),
    p25 = statistic(statistics, { percentile: 25 }),
    p75 = statistic(statistics, { percentile: 75 }),
    p90 = statistic(statistics, { percentile: 90 }),
    maximum = statistic(statistics, { computation: "maximum" }) ?? statistic(statistics, { percentile: 100 }),
    required = [minimum, p10, p25, p75, p90, maximum];

  if (required.some((q) => !q)) return notRanked("Required day-of-year statistics are unavailable", required.filter(Boolean));

  const sampleCounts = required
      .map((q) => Number(q.method?.sample_count))
      .filter(Number.isFinite),
    sampleCount = sampleCounts.length ? Math.min(...sampleCounts) : null;
  if (sampleCount == null || sampleCount < minimumSampleCount)
    return notRanked(
      sampleCount == null
        ? "Historical sample count is unavailable"
        : `Only ${sampleCount} historical daily values are available; ${minimumSampleCount} are required`,
      required,
    );

  const value = Number(observation.value),
    thresholds = {
      minimum: Number(minimum.value),
      p10: Number(p10.value),
      p25: Number(p25.value),
      p75: Number(p75.value),
      p90: Number(p90.value),
      maximum: Number(maximum.value),
    };

  if (Object.values(thresholds).some((v) => !Number.isFinite(v)))
    return notRanked("Historical percentile thresholds are incomplete", required);

  let condition;
  if (value === 0) condition = ["not-flowing", "Not flowing", "0 discharge"];
  else if (value >= thresholds.maximum) condition = ["all-time-high", "All-time high for this day", "At or above the historical daily maximum"];
  else if (value <= thresholds.minimum) condition = ["all-time-low", "All-time low for this day", "At or below the historical daily minimum"];
  else if (value > thresholds.p90) condition = ["much-above-normal", "Much above normal", ">90th percentile band"];
  else if (value > thresholds.p75) condition = ["above-normal", "Above normal", ">75th to 90th percentile band"];
  else if (value >= thresholds.p25) condition = ["normal", "Normal", "25th to 75th percentile band"];
  else if (value >= thresholds.p10) condition = ["below-normal", "Below normal", "10th to <25th percentile band"];
  else condition = ["much-below-normal", "Much below normal", "<10th percentile band"];

  return {
    kind: condition[0],
    label: condition[1],
    detail: condition[2],
    percentile_band: condition[2],
    rankable: true,
    sample_count: sampleCount,
    thresholds,
    representation: "historical-context",
    observation,
    supporting_quantities: required,
  };
}
