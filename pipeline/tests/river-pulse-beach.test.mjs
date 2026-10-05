import test from "node:test";
import assert from "node:assert/strict";
import { bankEdges, beachGround, beachWaterGrid, constrainBeachCamera } from "../../river-pulse/renderer/beach-layout.js";
import { mapFlowIsMoving } from "../../river-pulse/visual-bindings/map-flow.js";

test("Map flow stops for missing, invalid and zero selected discharge", () => {
  const state = (value, availability = "present") => ({ selected_quantities:
    [{ phenomenon: "discharge", value, availability }] });
  for (const value of [null, undefined, NaN, -1, 0, Infinity])
    assert.equal(mapFlowIsMoving(state(value)), false);
  assert.equal(mapFlowIsMoving(state(120)), true);
  assert.equal(mapFlowIsMoving(state(120, "missing")), false);
  assert.equal(mapFlowIsMoving(null), false);
});

test("Authored water is wet only inside its modeled banks at the baseline, and spreads over them only when raised", () => {
  const grid = beachWaterGrid();
  let wet = 0, flood = 0;
  for (let i = 0; i < grid.positions.length; i += 3) {
    const [x, y, z] = grid.positions.subarray(i, i + 3), e = bankEdges(z), bed = beachGround(x, z);
    assert.equal(y, 0);
    assert.ok(Math.abs(grid.beds[i / 3] - bed) < 1e-5);
    if (bed < 0) {
      wet++;
      assert.ok(x >= e.left - 0.0001 && x <= e.right + 0.0001, "baseline water stays inside the banks");
      assert.ok(grid.depths[i / 3] > 0 && grid.depths[i / 3] <= 3);
    } else if (bed < 3.2) flood++;
  }
  assert.ok(wet > 1000, "channel has wet vertices");
  assert.ok(flood > 1000, "banks below the record-high level have vertices to flood");
  for (let i = 0; i < grid.indices.length; i += 3) {
    const [a, b, c] = grid.indices.subarray(i, i + 3), p = grid.positions,
      crossY = (p[b * 3 + 2] - p[a * 3 + 2]) * (p[c * 3] - p[a * 3]) -
        (p[b * 3] - p[a * 3]) * (p[c * 3 + 2] - p[a * 3 + 2]);
    assert.ok(crossY > 0);
  }
});

test("Beach walking stays on dry bank within the authored reach at eye height", () => {
  for (const x of [-1000, 0, 1000]) for (const z of [-1000, 0, 1000]) {
    const state = { x, z, y: 500, pitch: 2, speed: 100 };
    constrainBeachCamera(state);
    const e = bankEdges(state.z);
    assert.ok(state.z >= -35 && state.z <= 70);
    assert.ok(state.x >= e.left - 9 && state.x <= e.left - 0.5);
    assert.ok(beachGround(state.x, state.z) > 0);
    assert.ok(Math.abs(state.y - beachGround(state.x, state.z) - 1.8) < 0.0001);
  }
});
