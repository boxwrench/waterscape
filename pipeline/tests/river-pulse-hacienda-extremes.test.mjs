import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIDGE_UNDERSIDE_M, HACIENDA_EXTREMES, sceneWaterLevel } from "../../river-pulse/visual-bindings/hacienda-extremes.js";

test("extremes carry a source URL for every number", () => {
  for (const [name, e] of Object.entries({ low: HACIENDA_EXTREMES.low, high: HACIENDA_EXTREMES.high })) {
    assert.match(e.source, /^https:\/\/api\.waterdata\.usgs\.gov\//, name);
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.match(HACIENDA_EXTREMES.high.dischargeSource, /parameter_code=00060/);
});

test("scene water level is zero at the baseline, falls gently below it and rises above it", () => {
  assert.equal(sceneWaterLevel(100), 0);
  assert.ok(sceneWaterLevel(1000) > sceneWaterLevel(100));
  assert.ok(Math.abs(sceneWaterLevel(10) + 1.1) < 1e-9);
  assert.ok(sceneWaterLevel(90100) > sceneWaterLevel(9000));
});

test("the record low empties the channel and the record high reaches the bridge underside, not the deck", () => {
  const low = sceneWaterLevel(HACIENDA_EXTREMES.low.dischargeCfs), high = sceneWaterLevel(HACIENDA_EXTREMES.high.dischargeCfs);
  assert.ok(low < -2 && low > -2.8, `low ${low}`);
  assert.equal(high, BRIDGE_UNDERSIDE_M);
  assert.ok(high < 13 - 0.8, "below the authored deck line, in the steel");
  assert.equal(sceneWaterLevel(1e7), BRIDGE_UNDERSIDE_M, "flows above the record stay at the underside");
});

test("missing or invalid discharge falls back to the baseline and values below record low are floored", () => {
  assert.equal(sceneWaterLevel(null), 0);
  assert.equal(sceneWaterLevel(Number.NaN), 0);
  assert.equal(sceneWaterLevel(-5), 0);
  assert.equal(sceneWaterLevel(0), sceneWaterLevel(HACIENDA_EXTREMES.low.dischargeCfs));
});
