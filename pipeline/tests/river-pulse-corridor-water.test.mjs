import { test } from "node:test";
import assert from "node:assert/strict";
import { quantity } from "../../river-pulse/data-model/quantity.js";
import {
  CORRIDOR_CONDITION_COLORS,
  CORRIDOR_DISPLAY_MODES,
  corridorWaterBinding,
} from "../../river-pulse/visual-bindings/corridor-water.js";

function state(value) {
  return {
    selected_quantities: [
      quantity({
        quantity_id: `discharge:${value}`,
        feature_id: "USGS-11467000",
        phenomenon: "discharge",
        value,
        unit: "ft^3/s",
        evidence_type: "observation",
        time: { valid_start: "2026-09-28T16:00:00Z" },
      }),
    ],
  };
}

const condition = {
  kind: "normal",
  thresholds: { p10: 80, p25: 120, p75: 240, p90: 320 },
};

test("corridor flow-width mode widens monotonically between seasonal low/high anchors", () => {
  const low = corridorWaterBinding(state(80), condition),
    middle = corridorWaterBinding(state(160), condition),
    high = corridorWaterBinding(state(320), condition);
  assert.equal(low.mode, CORRIDOR_DISPLAY_MODES.FLOW_WIDTH);
  assert.equal(low.width_m, 12);
  assert.equal(high.width_m, 42);
  assert.ok(middle.width_m > low.width_m && middle.width_m < high.width_m);
  assert.ok(middle.motion_rate > low.motion_rate && middle.motion_rate < high.motion_rate);
  assert.equal(low.representation, "illustrative");
});

test("corridor width saturates beyond the 10th/90th seasonal anchors", () => {
  assert.equal(corridorWaterBinding(state(20), condition).width_m, 12);
  assert.equal(corridorWaterBinding(state(1000), condition).width_m, 42);
});

test("seasonal-color mode keeps a fixed illustrative width and maps the condition class", () => {
  const above = corridorWaterBinding(
    state(260),
    { ...condition, kind: "above-normal" },
    CORRIDOR_DISPLAY_MODES.SEASONAL_COLOR,
  );
  assert.equal(above.width_m, 24);
  assert.equal(above.color, CORRIDOR_CONDITION_COLORS["above-normal"]);
  assert.match(above.note, /seasonal-condition/);
});

test("missing hydrology falls back without inventing a flow value", () => {
  const binding = corridorWaterBinding(
    { selected_quantities: [] },
    { kind: "not-ranked", thresholds: null },
  );
  assert.equal(binding.source_quantity_id, null);
  assert.equal(binding.relative_flow, null);
  assert.equal(binding.width_m, 20);
  assert.equal(binding.motion_rate, 0.12);
});
