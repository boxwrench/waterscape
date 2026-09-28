import { test } from "node:test";
import assert from "node:assert/strict";
import { quantity } from "../../river-pulse/data-model/quantity.js";
import { latestAtOrBefore, latestAtOrBeforePolicy } from "../../river-pulse/data-model/selection.js";
import {
  DAILY_MEAN_STATISTIC_ID,
  DISCHARGE_PARAMETER_CODE,
  dailyValuesUrl,
  latestContinuousUrl,
  parseDailyFeature,
  parseDailyValues,
  parseLatestContinuous,
  parseLatestContinuousFeature,
} from "../../river-pulse/adapters/usgs.js";

function observed(time, value = 100, id = `q:${time}:${value}`) {
  return quantity({
    quantity_id: id,
    feature_id: "USGS-11467000",
    phenomenon: "discharge",
    value,
    unit: "ft^3/s",
    evidence_type: "observation",
    time: { valid_start: time },
    source_approval: "provisional",
  });
}

function usgsFeature(overrides = {}) {
  return {
    id: "record-1",
    type: "Feature",
    geometry: { type: "Point", coordinates: [-122.9277, 38.5085] },
    properties: {
      time_series_id: "series-1",
      monitoring_location_id: "USGS-11467000",
      parameter_code: DISCHARGE_PARAMETER_CODE,
      statistic_id: "00011",
      time: "2026-09-13T18:00:00+00:00",
      value: "142",
      unit_of_measure: "ft^3/s",
      approval_status: "Provisional",
      qualifier: "None",
      last_modified: "2026-09-13T18:07:00+00:00",
      ...overrides,
    },
  };
}

function dailyFeature(overrides = {}) {
  return {
    id: "daily-1",
    type: "Feature",
    geometry: { type: "Point", coordinates: [-122.9277, 38.5085] },
    properties: {
      time_series_id: "daily-series-1",
      monitoring_location_id: "USGS-11467000",
      parameter_code: DISCHARGE_PARAMETER_CODE,
      statistic_id: DAILY_MEAN_STATISTIC_ID,
      time: "2026-09-12",
      value: "151",
      unit_of_measure: "ft^3/s",
      approval_status: "Approved",
      qualifier: null,
      last_modified: "2026-09-13T06:00:00+00:00",
      ...overrides,
    },
  };
}

test("scientific quantity carries no presentation metadata", () => {
  const q = observed("2026-09-27T12:00:00Z");
  assert.equal(q.evidence_type, "observation");
  assert.equal(q.time.valid_start, "2026-09-27T12:00:00Z");
  assert.equal("presentation" in q, false);
  assert.equal("visual_state" in q, false);
});

test("latest-at-or-before never selects a future observation", () => {
  const values = [
    observed("2026-09-27T11:45:00Z", 90),
    observed("2026-09-27T12:00:00Z", 100),
    observed("2026-09-27T12:15:00Z", 120),
  ];
  const result = latestAtOrBefore(values, "2026-09-27T12:05:00Z", { maximumAgeMs: 30 * 60 * 1000 });
  assert.equal(result.status, "selected");
  assert.equal(result.quantity.value, 100);
  assert.equal(result.age_ms, 5 * 60 * 1000);
});

test("latest-at-or-before breaks equal-time ties by quantity identity, not input order", () => {
  const time = "2026-09-27T12:00:00Z",
    a = observed(time, 101, "a"),
    b = observed(time, 102, "b"),
    first = latestAtOrBefore([b, a], "2026-09-27T12:05:00Z"),
    second = latestAtOrBefore([a, b], "2026-09-27T12:05:00Z");
  assert.equal(first.quantity.quantity_id, "a");
  assert.equal(second.quantity.quantity_id, "a");
});

test("latest-at-or-before exposes stale data rather than silently using it", () => {
  const q = observed("2026-09-27T10:00:00Z", 80),
    result = latestAtOrBefore([q], "2026-09-27T12:00:00Z", { maximumAgeMs: 30 * 60 * 1000 });
  assert.equal(result.status, "missing");
  assert.equal(result.reason, "stale");
  assert.equal(result.stale_quantity, q);
});

test("selection policy records its deterministic rule", () => {
  const policy = latestAtOrBeforePolicy({ maximumAgeMs: 15 * 60 * 1000 });
  assert.equal(policy.id, "latest-at-or-before");
  assert.equal(policy.future_values, "forbidden");
  assert.equal(policy.tie_break, "latest_explicit_availability_then_quantity_id_ascending");
  assert.equal(policy.maximum_age_ms, 15 * 60 * 1000);
});

test("USGS adapter normalizes latest-continuous discharge without inventing as-of time", () => {
  const payload = { type: "FeatureCollection", features: [usgsFeature()] },
    [q] = parseLatestContinuous(payload, { retrievalTime: "2026-09-27T12:00:00Z" });
  assert.equal(q.feature_id, "USGS-11467000");
  assert.equal(q.phenomenon, "discharge");
  assert.equal(q.value, 142);
  assert.equal(q.unit, "ft^3/s");
  assert.equal(q.source_approval, "provisional");
  assert.equal(q.time.as_of_time, null);
  assert.equal(q.provenance.source_feature_id, "USGS-11467000");
  assert.equal(q.provenance.last_modified, "2026-09-13T18:07:00+00:00");
});

test("USGS adapter preserves source qualifier flags and normalizes approval case", () => {
  const q = parseLatestContinuousFeature(usgsFeature({ approval_status: "APPROVED", qualifier: ["Ice", "A"] }));
  assert.equal(q.source_approval, "approved");
  assert.deepEqual(q.source_flags, ["Ice", "A"]);
  assert.equal(q.method.method_id, "usgs_continuous");
});

test("USGS adapter rejects a non-finite reported value", () => {
  assert.throws(
    () => parseLatestContinuousFeature(usgsFeature({ value: "not-a-number" })),
    /non-finite value/,
  );
});

test("USGS daily values are derived statistics, not instantaneous observations", () => {
  const q = parseDailyFeature(dailyFeature(), { retrievalTime: "2026-09-27T12:00:00Z" });
  assert.equal(q.feature_id, "USGS-11467000");
  assert.equal(q.phenomenon, "discharge");
  assert.equal(q.value, 151);
  assert.equal(q.evidence_type, "derived_statistic");
  assert.equal(q.method.method_id, "usgs_daily_mean");
  assert.equal(q.method.statistic_id, "00003");
  assert.equal(q.time.valid_start, "2026-09-12T00:00:00.000Z");
  assert.equal(q.time.valid_end, "2026-09-13T00:00:00.000Z");
  assert.equal(q.source_approval, "approved");
});

test("USGS daily parser preserves stable input order as normalized quantities", () => {
  const payload = {
      type: "FeatureCollection",
      features: [dailyFeature({ time: "2026-09-11", value: "149" }), dailyFeature()],
    },
    quantities = parseDailyValues(payload, { retrievalTime: "2026-09-27T12:00:00Z" });
  assert.deepEqual(quantities.map((q) => q.value), [149, 151]);
});

test("USGS adapter uses modern v1 continuous and daily endpoints", () => {
  const current = new URL(latestContinuousUrl("USGS-11467000")),
    daily = new URL(dailyValuesUrl("USGS-11467000", "2026-08-15", "2026-09-28"));
  assert.equal(current.pathname, "/ogcapi/v1/collections/latest-continuous/items");
  assert.equal(current.searchParams.get("monitoring_location_id"), "USGS-11467000");
  assert.equal(current.searchParams.get("parameter_code"), "00060");
  assert.equal(current.searchParams.get("f"), "json");

  assert.equal(daily.pathname, "/ogcapi/v1/collections/daily/items");
  assert.equal(daily.searchParams.get("monitoring_location_id"), "USGS-11467000");
  assert.equal(daily.searchParams.get("parameter_code"), "00060");
  assert.equal(daily.searchParams.get("statistic_id"), "00003");
  assert.equal(daily.searchParams.get("datetime"), "2026-08-15/2026-09-28");
});
