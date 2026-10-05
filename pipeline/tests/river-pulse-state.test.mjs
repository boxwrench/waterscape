import { test } from "node:test";
import assert from "node:assert/strict";
import { quantity } from "../../river-pulse/core/data-model/quantity.js";
import { latestAtOrBeforePolicy } from "../../river-pulse/core/data-model/selection.js";
import { riverState } from "../../river-pulse/core/data-model/river-state.js";

function q(time, value) {
  return quantity({
    quantity_id: `${time}:${value}`,
    feature_id: "USGS-11467000",
    phenomenon: "discharge",
    value,
    unit: "ft^3/s",
    evidence_type: "observation",
    time: { valid_start: time },
  });
}

test("RiverState keeps spatial features and selected scientific quantities", () => {
  const policy = latestAtOrBeforePolicy({ maximumAgeMs: 30 * 60 * 1000 }),
    values = [q("2026-09-27T11:45:00Z", 90), q("2026-09-27T12:00:00Z", 100)],
    result = policy.select(values, "2026-09-27T12:10:00Z"),
    state = riverState({
      validTime: "2026-09-27T12:10:00Z",
      features: {
        gauges: [{ id: "USGS-11467000" }],
        authored_places: [{ id: "hacienda_bridge" }],
      },
      selections: [
        {
          feature_id: "USGS-11467000",
          phenomenon: "discharge",
          policy_id: policy.id,
          result,
        },
      ],
    });
  assert.equal(state.features.gauges.length, 1);
  assert.equal(state.features.authored_places.length, 1);
  assert.equal(state.selected_quantities[0].value, 100);
  assert.equal(state.missing_quantities.length, 0);
  assert.equal(state.selection_results[0].policy_id, "latest-at-or-before");
});

test("RiverState preserves stale quantity as evidence for missing-current explanation", () => {
  const policy = latestAtOrBeforePolicy({ maximumAgeMs: 30 * 60 * 1000 }),
    old = q("2026-09-13T18:00:00Z", 142),
    result = policy.select([old], "2026-09-27T12:00:00Z"),
    state = riverState({
      validTime: "2026-09-27T12:00:00Z",
      selections: [
        {
          feature_id: "USGS-11467000",
          phenomenon: "discharge",
          policy_id: policy.id,
          result,
        },
      ],
    });
  assert.equal(state.selected_quantities.length, 0);
  assert.equal(state.missing_quantities[0].reason, "stale");
  assert.equal(state.missing_quantities[0].stale_quantity, old);
});
