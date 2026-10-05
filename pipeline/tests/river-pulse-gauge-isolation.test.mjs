import { test } from "node:test";
import assert from "node:assert/strict";
import { quantity } from "../../river-pulse/core/data-model/quantity.js";
import {
  resolveGaugeDischargeState,
  GAUGE_TIME_MODES,
} from "../../river-pulse/core/data-model/gauge-time-state.js";

const validTime = "2026-09-27T12:10:00Z",
  featureId = "USGS-11467000";
function record(overrides = {}) {
  return quantity({
    quantity_id: "original",
    feature_id: featureId,
    phenomenon: "discharge",
    value: 100,
    unit: "ft^3/s",
    evidence_type: "observation",
    time: {
      valid_start: "2026-09-27T12:00:00Z",
      as_of_time: "2026-09-27T12:05:00Z",
    },
    ...overrides,
  });
}
function current(records, options = {}) {
  return resolveGaugeDischargeState({
    featureId,
    validTime,
    mode: GAUGE_TIME_MODES.CURRENT_CONTINUOUS,
    continuousQuantities: records,
    ...options,
  });
}
test("mixed stations, phenomena, units and evidence never leak into selected gauge", () => {
  for (const other of [
    { feature_id: "USGS-other" },
    { phenomenon: "water_surface_elevation" },
    { unit: "m^3/s" },
    { evidence_type: "model_output" },
  ]) {
    assert.equal(current([record(other)]).selected_quantities.length, 0);
  }
  assert.equal(
    current([record({ feature_id: "other", quantity_id: "a" }), record()])
      .selected_quantities[0].feature_id,
    featureId,
  );
});
test("as-of excludes later and unknown availability without inventing it", () => {
  assert.equal(
    current([record()], { asOfTime: "2026-09-27T12:01:00Z" })
      .selected_quantities.length,
    0,
  );
  const unknown = record({ time: { valid_start: "2026-09-27T12:00:00Z" } });
  assert.equal(
    current([unknown], { asOfTime: validTime }).selected_quantities.length,
    0,
  );
  assert.equal(current([unknown]).selected_quantities.length, 1);
});
test("revisions resolve to the newest eligible explicit availability regardless of order", () => {
  const first = record(),
    revised = record({
      quantity_id: "revision",
      value: 110,
      time: {
        valid_start: first.time.valid_start,
        as_of_time: "2026-09-28T00:00:00Z",
      },
    });
  for (const records of [
    [first, revised],
    [revised, first],
  ]) {
    assert.equal(
      current(records, { asOfTime: validTime }).selected_quantities[0].value,
      100,
    );
    assert.equal(current(records).selected_quantities[0].value, 110);
  }
});
test("explicit missing latest sample does not revive an older measurement", () => {
  const missing = record({
    quantity_id: "missing",
    value: null,
    availability: "missing",
    time: { valid_start: "2026-09-27T12:09:00Z" },
  });
  assert.equal(
    current([record(), missing]).missing_quantities[0].reason,
    "source_reported_missing",
  );
});
test("daily selection also enforces station isolation and as-of availability", () => {
  const daily = record({
    evidence_type: "derived_statistic",
    time: {
      valid_start: "2026-09-27T00:00:00Z",
      valid_end: "2026-09-28T00:00:00Z",
      as_of_time: "2026-09-29T00:00:00Z",
    },
  });
  const state = resolveGaugeDischargeState({
    featureId,
    validTime,
    asOfTime: validTime,
    mode: GAUGE_TIME_MODES.HISTORICAL_DAILY,
    dailyQuantities: [daily],
  });
  assert.equal(state.selected_quantities.length, 0);
});
