import { test } from "node:test";
import assert from "node:assert/strict";
import { quantity } from "../../river-pulse/data-model/quantity.js";
import { dailyHydrograph } from "../../river-pulse/visual-bindings/hydrograph.js";

function daily(date, value, id = date) {
  return quantity({
    quantity_id: id,
    feature_id: "USGS-11467000",
    phenomenon: "discharge",
    value,
    unit: "ft^3/s",
    evidence_type: "derived_statistic",
    time: { valid_start: `${date}T00:00:00Z`, valid_end: `${date}T23:59:59Z` },
    method: { method_id: "usgs_daily_mean", statistic_id: "00003" },
  });
}

test("daily hydrograph sorts values by valid time and maps them to finite SVG coordinates", () => {
  const graph = dailyHydrograph([
    daily("2026-09-12", 150),
    daily("2026-09-10", 100),
    daily("2026-09-11", 125),
  ], { width: 300, height: 80, padding: 5 });

  assert.equal(graph.kind, "series");
  assert.equal(graph.min, 100);
  assert.equal(graph.max, 150);
  assert.deepEqual(graph.points.map((p) => p.value), [100, 125, 150]);
  assert.ok(graph.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.match(graph.path, /^M/);
  assert.equal(graph.evidence_type, "derived_statistic");
  assert.equal(graph.representation, "direct-series");
});

test("daily hydrograph is deterministic for equal-time values", () => {
  const a = daily("2026-09-10", 100, "a"),
    b = daily("2026-09-10", 110, "b"),
    first = dailyHydrograph([b, a]),
    second = dailyHydrograph([a, b]);
  assert.deepEqual(first.points.map((p) => p.quantity.quantity_id), ["a", "b"]);
  assert.deepEqual(second.points.map((p) => p.quantity.quantity_id), ["a", "b"]);
});

test("daily hydrograph explicitly returns empty state", () => {
  assert.deepEqual(dailyHydrograph([]), {
    kind: "empty",
    points: [],
    path: "",
    min: null,
    max: null,
    first_time: null,
    last_time: null,
  });
});

test("daily hydrograph breaks the line across missing days", () => {
  const graph = dailyHydrograph([daily("2026-09-10", 100), daily("2026-09-13", 150)]);
  assert.equal(graph.segments.length, 2);
  assert.equal((graph.path.match(/M/g) ?? []).length, 2);
});
