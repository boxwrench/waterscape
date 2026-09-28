import { test } from "node:test";
import assert from "node:assert/strict";
import { quantity } from "../../river-pulse/data-model/quantity.js";
import {
  dayOfYearStatisticsUrl,
  parseDayOfYearStatistics,
} from "../../river-pulse/adapters/usgs-statistics.js";
import {
  MINIMUM_RANKING_SAMPLE_COUNT,
  streamflowCondition,
} from "../../river-pulse/visual-bindings/streamflow-condition.js";

function current(value) {
  return quantity({
    quantity_id: `current:${value}`,
    feature_id: "USGS-11467000",
    phenomenon: "discharge",
    value,
    unit: "ft^3/s",
    evidence_type: "observation",
    time: { valid_start: "2026-09-27T18:00:00Z" },
  });
}

function statsPayload(sampleCount = 84) {
  const base = {
    monitoring_location_id: "USGS-11467000",
    parameter_code: "00060",
    unit_of_measure: "ft^3/s",
    normal_type: "DOY",
    parent_time_series_id: "daily-mean-series",
    parent_statistics_id: "stats-1",
  };
  return [
    {
      ...base,
      computation: "minimum",
      values: [{ time_of_year: "09-27", value: "40", sample_count: sampleCount }],
    },
    {
      ...base,
      computation: "percentile",
      values: [{
        time_of_year: "09-27",
        values: ["60", "80", "120", "180", "240", "280", "310"],
        percentiles: [5, 10, 25, 50, 75, 90, 95],
        sample_count: sampleCount,
      }],
    },
    {
      ...base,
      computation: "maximum",
      values: [{ time_of_year: "09-27", value: "410", sample_count: sampleCount }],
    },
  ];
}

test("day-of-year statistics URL requests the official seasonal threshold inputs", () => {
  const url = new URL(dayOfYearStatisticsUrl("USGS-11467000", "09-27"));
  assert.equal(url.origin, "https://api.waterdata.usgs.gov");
  assert.equal(url.pathname, "/statistics/v0/observationNormals");
  assert.equal(url.searchParams.get("normal_type"), "DOY");
  assert.equal(url.searchParams.get("start_date"), "09-27");
  assert.equal(url.searchParams.get("end_date"), "09-27");
  assert.equal(url.searchParams.get("parameter_code"), "00060");
  assert.deepEqual(url.searchParams.getAll("computation_type"), ["minimum", "maximum", "percentile"]);
});

test("USGS observationNormals normalize to derived scientific quantities", () => {
  const quantities = parseDayOfYearStatistics(statsPayload(), {
    validDate: "2026-09-27",
    retrievalTime: "2026-09-27T18:05:00Z",
  });
  assert.equal(quantities.length, 9);
  const p25 = quantities.find((q) => q.method.percentile === 25);
  assert.equal(p25.value, 120);
  assert.equal(p25.phenomenon, "discharge_day_of_year_statistic");
  assert.equal(p25.evidence_type, "derived_statistic");
  assert.equal(p25.method.normal_type, "DOY");
  assert.equal(p25.method.sample_count, 84);
  assert.equal(p25.time.valid_start, "2026-09-27T00:00:00.000Z");
  assert.equal(p25.provenance.beta, true);
  assert.equal("presentation" in p25, false);
});

test("streamflow condition follows USGS day-of-year category thresholds", () => {
  const stats = parseDayOfYearStatistics(statsPayload(), { validDate: "2026-09-27" });
  assert.equal(streamflowCondition(current(35), stats).kind, "all-time-low");
  assert.equal(streamflowCondition(current(70), stats).kind, "much-below-normal");
  assert.equal(streamflowCondition(current(100), stats).kind, "below-normal");
  assert.equal(streamflowCondition(current(180), stats).kind, "normal");
  assert.equal(streamflowCondition(current(260), stats).kind, "above-normal");
  assert.equal(streamflowCondition(current(320), stats).kind, "much-above-normal");
  assert.equal(streamflowCondition(current(450), stats).kind, "all-time-high");
  assert.equal(streamflowCondition(current(0), stats).kind, "not-flowing");
});

test("streamflow condition is not ranked with fewer than 20 historical values", () => {
  const stats = parseDayOfYearStatistics(statsPayload(MINIMUM_RANKING_SAMPLE_COUNT - 1), {
      validDate: "2026-09-27",
    }),
    condition = streamflowCondition(current(180), stats);
  assert.equal(condition.rankable, false);
  assert.equal(condition.kind, "not-ranked");
  assert.match(condition.detail, /20 are required/);
});

test("streamflow condition reports a percentile band, not an invented exact percentile", () => {
  const stats = parseDayOfYearStatistics(statsPayload(), { validDate: "2026-09-27" }),
    condition = streamflowCondition(current(100), stats);
  assert.equal(condition.label, "Below normal");
  assert.equal(condition.percentile_band, "10th to <25th percentile band");
  assert.equal("percentile" in condition, false);
});
