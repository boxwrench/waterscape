import test from "node:test";
import assert from "node:assert/strict";
import { parseLatestContinuousFeature } from "../../river-pulse/core/adapters/usgs.js";
import { jennerLevelState, jennerLevelPresentation } from "../../river-pulse/rivers/russian_river/scenes/end/jenner/jenner-level.js";
import { jennerCoast, jennerGround, JENNER_VIEWS, constrainJennerCamera } from "../../river-pulse/rivers/russian_river/scenes/end/jenner/jenner-layout.js";

// Explicit synthetic observations; never shipped as river records.
const now = "2026-09-29T20:00:00Z";
function observation({ time = "2026-09-29T19:45:00Z", value = "1.23", parameter = "63160", station = "USGS-11467270", unit = "ft" } = {}) {
  return parseLatestContinuousFeature({ id: "TEST-JENNER", geometry: null, properties: {
    monitoring_location_id: station, parameter_code: parameter, time, value,
    unit_of_measure: unit, approval_status: "Provisional", qualifier: "TEST FLAG", time_series_id: "TEST-JENNER",
  } }, { retrievalTime: now });
}

test("Jenner presents a fresh source level with its datum and evidence", () => {
  const q = observation(), state = jennerLevelState([q], now), view = jennerLevelPresentation(state);
  assert.equal(view.value, "1.23 ft"); assert.equal(view.datum, "NAVD88"); assert.equal(view.quality, "provisional");
  assert.deepEqual(state.selected_quantities[0].source_flags, ["TEST FLAG"]);
  assert.equal(state.selected_quantities[0].provenance.source_record_id, "TEST-JENNER");
  assert.equal("sceneLevel" in view, false);
});
test("Jenner retains stale evidence without labeling it current", () => {
  const q = observation({ time: "2026-09-29T19:00:00Z" }), state = jennerLevelState([q], now), view = jennerLevelPresentation(state);
  assert.equal(view.value, "Unavailable"); assert.equal(view.quality, "Stale");
  assert.equal(state.missing_quantities[0].stale_quantity, q);
});
test("45-minute boundary is eligible; future, wrong feature, parameter, unit and datum are not", () => {
  assert.equal(jennerLevelState([observation({ time: "2026-09-29T19:15:00Z" })], now).selected_quantities.length, 1);
  const wrongDatum = { ...observation(), spatial: { vertical_datum: "local" } };
  for (const q of [observation({ time: "2026-09-29T20:01:00Z" }), observation({ station: "USGS-11467000" }),
    observation({ parameter: "00065" }), observation({ parameter: "00060", unit: "ft^3/s" }), observation({ unit: "m" }), wrongDatum]) {
    assert.equal(jennerLevelState([q], now).selected_quantities.length, 0);
  }
});
test("A missing latest record cannot fall back to an older present value", () => {
  const state = jennerLevelState([observation({ time: "2026-09-29T19:40:00Z" }), observation({ value: null })], now);
  assert.equal(state.selection_results[0].reason, "source_reported_missing");
  assert.equal(jennerLevelPresentation(state).value, "Unavailable");
});
test("Absent data preserves the station source and does not supply coastal state", () => {
  const view = jennerLevelPresentation(jennerLevelState([], now));
  assert.equal(view.value, "Unavailable"); assert.match(view.source, /11467270/);
  assert.match(view.note, /not today's tide or mouth status/);
});
test("All coastal cameras stand on dry authored ground at eye height", () => {
  for (const camera of Object.values(JENNER_VIEWS)) {
    assert.ok(jennerGround(camera.x, camera.z) >= 0.12);
    assert.ok(Math.abs(camera.y - jennerGround(camera.x, camera.z) - 1.8) < 1e-6);
  }
  for (const name of ["river", "ocean"]) assert.ok(jennerGround(JENNER_VIEWS[name].x, JENNER_VIEWS[name].z) < 0.3);
});
test("Shore walking stays bounded and cannot enter underwater terrain", () => {
  for (const [name, origin] of Object.entries(JENNER_VIEWS)) {
    const state = { ...origin }, bounds = origin.bounds;
    for (let i = 0; i < 150; i++) {
      const previous = { ...state }; state.x += i % 2 ? 80 : -200; state.z += i % 3 ? -170 : 100;
      constrainJennerCamera(state, name, previous);
      assert.ok(state.x >= bounds[0] && state.x <= bounds[1] && state.z >= bounds[2] && state.z <= bounds[3]);
      assert.ok(jennerGround(state.x, state.z) >= 0.12);
    }
  }
});
test("Authored offshore floor, spit and northern bluff have coherent dry/wet sides", () => {
  assert.ok(jennerGround(jennerCoast(650) - 30, 650) < 0);
  assert.ok(jennerGround(jennerCoast(650) + 30, 650) > 0);
  assert.ok(jennerGround(0, -570) > 5);
});
