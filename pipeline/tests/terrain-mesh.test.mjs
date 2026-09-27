import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTerrainGrid } from "../../renderer/land/terrain-mesh.js";

// 3 x 2 grid, 10 m cells, heights 100 + x + z; the point (10, 0) is 6 m offshore.
const terrain = {
  width: 3, height: 2, cell: 10, x0: 0, z0: 0,
  sample: (x, z) => 100 + x + z,
  shoreDistance: (x, z) => (x === 10 && z === 0 ? -6 : 5),
};
const at = (g, i, j) => {
  const k = (j * (terrain.width + 2) + i) * 3;
  return [...g.positions.slice(k, k + 3)];
};

test("grid points follow the lidar; offshore sinks on a 1:3 bank; border drops", () => {
  const g = buildTerrainGrid(terrain);
  assert.equal(g.count, 5 * 4);
  assert.deepEqual(at(g, 3, 2), [20, 130, 10]); // grid (2, 1)
  assert.deepEqual(at(g, 2, 1), [10, -2, 0]); // grid (1, 0), 6 m offshore -> -2
  assert.deepEqual(at(g, 0, 0), [-10, -100, -10]); // border: edge height 100 minus 200
  assert.equal(g.indices.length, 4 * 3 * 6);
  assert.ok(g.indices.every((i) => i < g.count));
});
