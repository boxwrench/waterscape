import { test } from "node:test";
import assert from "node:assert/strict";
import { centerlineConditionStyle } from "../../river-pulse/core/visual-bindings/condition-centerline.js";

test("centerline seasonal styles are deterministic categorical encodings", () => {
  const low = centerlineConditionStyle({ kind: "much-below-normal" }),
    normal = centerlineConditionStyle({ kind: "normal" }),
    high = centerlineConditionStyle({ kind: "much-above-normal" });
  assert.notEqual(low.color, normal.color);
  assert.notEqual(normal.color, high.color);
  assert.equal(low.representation, "categorical-centerline-overlay");
  assert.match(low.note, /not channel width, depth, velocity, or water surface/);
});

test("not-ranked and unavailable remain visually distinct from ranked normal", () => {
  const notRanked = centerlineConditionStyle({ kind: "not-ranked" }),
    unavailable = centerlineConditionStyle(null),
    normal = centerlineConditionStyle({ kind: "normal" });
  assert.ok(notRanked.opacity < normal.opacity);
  assert.ok(unavailable.opacity < normal.opacity);
  assert.equal(unavailable.kind, "unavailable");
});

test("unknown condition kinds fail soft to unavailable style", () => {
  const style = centerlineConditionStyle({ kind: "future-category" });
  assert.equal(style.kind, "future-category");
  assert.equal(style.opacity, 0.5);
});
