import { test } from "node:test";
import assert from "node:assert/strict";
import { quantity } from "../../river-pulse/data-model/quantity.js";
import { streamflowCondition } from "../../river-pulse/visual-bindings/streamflow-condition.js";

function discharge(value) {
  return quantity({
    quantity_id: `observed:${value}`,
    feature_id: "USGS-11467000",
    phenomenon: "discharge",
    value,
    unit: "ft^3/s",
    evidence_type: "observation",
    time: { valid_start: "2026-09-27T18:00:00Z" },
  });
}

function statistic({ value, computation = "percentile", percentile }) {
  return quantity({
    quantity_id: `stat:${computation}:${percentile ?? "na"}`,
    feature_id: "USGS-11467000",
    phenomenon: "discharge_day_of_year_statistic",
    value,
    unit: "ft^3/s",
    evidence_type: "derived_statistic",
    time: {
      valid_start: "2026-09-27T00:00:00Z",
      valid_end: "2026-09-28T00:00:00Z",
    },
    method: {
      method_id: "usgs_day_of_year_statistic",
      computation,
      percentile,
      sample_count: 84,
    },
  });
}

const statistics = [
  statistic({ value: 40, computation: "minimum", percentile: 0 }),
  statistic({ value: 80, percentile: 10 }),
  statistic({ value: 120, percentile: 25 }),
  statistic({ value: 240, percentile: 75 }),
  statistic({ value: 280, percentile: 90 }),
  statistic({ value: 410, computation: "maximum", percentile: 100 }),
];

test("USGS seasonal-condition boundary values stay on the documented side of each threshold", () => {
  // USGS NWD: normal is 25th-75th inclusive; above normal is >75th through 90th;
  // much above is >90th. Below normal includes the 10th percentile; much below is <10th.
  assert.equal(streamflowCondition(discharge(80), statistics).kind, "below-normal");
  assert.equal(streamflowCondition(discharge(120), statistics).kind, "normal");
  assert.equal(streamflowCondition(discharge(240), statistics).kind, "normal");
  assert.equal(streamflowCondition(discharge(280), statistics).kind, "above-normal");
});

test("USGS seasonal-condition extrema and zero-flow precedence are deterministic", () => {
  assert.equal(streamflowCondition(discharge(40), statistics).kind, "all-time-low");
  assert.equal(streamflowCondition(discharge(410), statistics).kind, "all-time-high");
  assert.equal(streamflowCondition(discharge(0), statistics).kind, "not-flowing");
});
