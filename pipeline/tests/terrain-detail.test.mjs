import { test } from "node:test";
import assert from "node:assert/strict";
import { Terrain } from "../../renderer/terrain.js";
import { buildTerrainGrid } from "../../renderer/land/terrain-mesh.js";

// 6 x 6 grid of 10 m cells, height 10 + x/10, all land; a 2 x 2-cell patch at cell (2, 2),
// 5 sub-cells per cell, raised by 3 m inside and equal to the grid on its edge.
function fixture() {
  const meta = { width: 6, height: 6, cell: [10, 10], gridOrigin: [0, 0], waterLevel: 100 },
    cells = new Float32Array(36 * 4);
  for (let j = 0; j < 6; j++)
    for (let i = 0; i < 6; i++) cells.set([10 + i, 50, 0.5, 0], (j * 6 + i) * 4);
  const n = 11,
    data = new Float32Array(n * n * 4);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const edge = i === 0 || j === 0 || i === n - 1 || j === n - 1,
        x = 20 + i * 2;
      data.set([10 + x / 10 + (edge ? 0 : 3), 50, 0.5, edge ? 0 : 1], (j * n + i) * 4);
    }
  const patch = { view: "shore", i0: 2, j0: 2, n: 2, sub: 5, width: n, height: n, step: 2, x0: 20, z0: 20, data };
  return new Terrain(meta, cells, [patch]);
}

test("sampling uses the patch inside it and the grid elsewhere", () => {
  const t = fixture();
  assert.equal(t.sample(5, 5, 0), 10.5);
  assert.equal(t.sample(30, 30, 0), 16);
  assert.equal(t.coarse(30, 30, 0), 13);
  assert.equal(t.sample(20, 30, 0), 12); // on the patch edge it equals the grid
  assert.equal(t.patchAt(50, 50), null);
});

test("the GPU buffer appends patch descriptors and cells after the grid", () => {
  const t = fixture(),
    g = t.gpuCells(),
    d = 8 + 36 * 4;
  assert.deepEqual([...g.slice(0, 8)], [6, 6, 0, 0, 10, 1, 0, 0]);
  const first = g[d + 3];
  assert.deepEqual([...g.slice(d, d + 8)], [20, 20, 2, first, 11, 11, 0, 0]);
  assert.equal(first, (d + 8) / 4);
  assert.equal(g.length, d + 8 + 11 * 11 * 4);
  assert.equal(g[first * 4 + (5 * 11 + 5) * 4], 16); // patch cell (5, 5) at x = 30
});

test("the mesh leaves a hole for the patch and closes the seam", () => {
  const t = fixture(),
    m = buildTerrainGrid(t);
  assert.equal(m.indices.length, (7 * 7 - 4) * 6);
  const p = m.patches[0],
    y = (i, j) => p.positions[(j * 11 + i) * 3 + 1];
  // Patch edge vertices lie on the grid's cell edges at the grid's heights.
  assert.equal(y(0, 3), 12);
  assert.ok(Math.abs(y(3, 0) - 12.6) < 1e-6);
  assert.ok(Math.abs(y(5, 5) - 16) < 1e-6);
});
