import { test } from "node:test";
import assert from "node:assert/strict";
import { quantity } from "../../river-pulse/data-model/quantity.js";
import {
  GAUGE_TIME_MODES,
  resolveGaugeDischargeState,
} from "../../river-pulse/data-model/gauge-time-state.js";

function q({ id, start, end = start, value, evidence = "observation" }) {
  return quantity({
    quantity_id: id,
    feature_id: "USGS-11467000",
    phenomenon: "discharge",
    value,
    unit: "ft^3/s",
    evidence_type: evidence,
    time: { valid_start: start, valid_end: end },
  });
}

test("current mode uses continuous latest-at-or-before policy", () => {
  const state = resolveGaugeDischargeState({
    featureId: "USGS-11467000",
    validTime: "2026-09-27T12:10:00Z",
    mode: GAUGE_TIME_MODES.CURRENT_CONTINUOUS,
    maximumCurrentAgeMs: 30 * 60 * 1000,
    continuousQuantities: [
      q({ id: "now", start: "2026-09-27T12:00:00Z", value: 150 }),
      q({ id: "future", start: "2026-09-27T12:15:00Z", value: 170 }),
    ],
  });
  assert.equal(state.selected_quantities[0].quantity_id, "now");
  assert.equal(state.selection_results[0].policy_id, "latest-at-or-before");
});

test("historical mode uses daily interval and never substitutes current observation", () => {
  const state = resolveGaugeDischargeState({
    featureId: "USGS-11467000",
    validTime: "1990-09-12T12:00:00Z",
    mode: GAUGE_TIME_MODES.HISTORICAL_DAILY,
    continuousQuantities: [q({ id: "live", start: "2026-09-27T12:00:00Z", value: 150 })],
    dailyQuantities: [
      q({
        id: "daily-1990-09-12",
        start: "1990-09-12T00:00:00Z",
        end: "1990-09-13T00:00:00Z",
        value: 92,
        evidence: "derived_statistic",
      }),
    ],
  });
  assert.equal(state.selected_quantities[0].quantity_id, "daily-1990-09-12");
  assert.equal(state.selection_results[0].policy_id, "covering-interval");
});

test("historical mode returns missing rather than falling back across a data gap", () => {
  const state = resolveGaugeDischargeState({
    featureId: "USGS-11467000",
    validTime: "1990-09-13T12:00:00Z",
    mode: GAUGE_TIME_MODES.HISTORICAL_DAILY,
    dailyQuantities: [
      q({
        id: "daily-1990-09-12",
        start: "1990-09-12T00:00:00Z",
        end: "1990-09-13T00:00:00Z",
        value: 92,
        evidence: "derived_statistic",
      }),
    ],
  });
  assert.equal(state.selected_quantities.length, 0);
  assert.equal(state.missing_quantities[0].reason, "no_covering_interval");
});

test("as-of time is preserved independently from valid time", () => {
  const state = resolveGaugeDischargeState({
    featureId: "USGS-11467000",
    validTime: "1990-09-12T12:00:00Z",
    asOfTime: "2026-09-27T00:00:00Z",
    mode: GAUGE_TIME_MODES.HISTORICAL_DAILY,
    dailyQuantities: [],
  });
  assert.equal(state.request.valid_time, "1990-09-12T12:00:00Z");
  assert.equal(state.request.as_of_time, "2026-09-27T00:00:00Z");
});
