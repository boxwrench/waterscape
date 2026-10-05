import { test } from "node:test";
import assert from "node:assert/strict";
import { quantity } from "../../river-pulse/core/data-model/quantity.js";
import { coveringInterval, coveringIntervalPolicy } from "../../river-pulse/core/data-model/selection.js";

function daily(date, value, id = date) {
  const start = `${date}T00:00:00.000Z`,
    end = new Date(Date.parse(start) + 24 * 60 * 60 * 1000).toISOString();
  return quantity({
    quantity_id: id,
    feature_id: "USGS-11467000",
    phenomenon: "discharge",
    value,
    unit: "ft^3/s",
    evidence_type: "derived_statistic",
    time: { valid_start: start, valid_end: end },
    method: { method_id: "usgs_daily_mean" },
  });
}

test("covering interval selects the daily value that contains requested time", () => {
  const values = [daily("2026-09-25", 100), daily("2026-09-26", 120), daily("2026-09-27", 140)],
    result = coveringInterval(values, "2026-09-26T18:12:00Z");
  assert.equal(result.status, "selected");
  assert.equal(result.quantity.value, 120);
  assert.equal(result.reason, "covering_interval");
});

test("covering interval uses start-inclusive end-exclusive semantics", () => {
  const yesterday = daily("2026-09-26", 120),
    today = daily("2026-09-27", 140),
    result = coveringInterval([yesterday, today], "2026-09-27T00:00:00.000Z");
  assert.equal(result.quantity, today);
});

test("covering interval does not silently use adjacent historical values", () => {
  const result = coveringInterval([daily("2026-09-25", 100)], "2026-09-27T12:00:00Z");
  assert.equal(result.status, "missing");
  assert.equal(result.reason, "no_covering_interval");
});

test("covering interval selection is deterministic when intervals overlap", () => {
  const a = daily("2026-09-27", 100, "a"),
    b = daily("2026-09-27", 110, "b"),
    first = coveringInterval([b, a], "2026-09-27T12:00:00Z"),
    second = coveringInterval([a, b], "2026-09-27T12:00:00Z");
  assert.equal(first.quantity.quantity_id, "a");
  assert.equal(second.quantity.quantity_id, "a");
});

test("covering interval policy declares its temporal semantics", () => {
  const policy = coveringIntervalPolicy();
  assert.equal(policy.id, "covering-interval");
  assert.equal(policy.interval_semantics, "start-inclusive-end-exclusive");
});
