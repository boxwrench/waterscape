import test from "node:test";
import assert from "node:assert/strict";
import { buildEelOpticalGrid } from "../../river-pulse/rivers/eel_river/scenes/middle/scotia_bluffs/eel-water-depth.js";

const terrain = (width, height, cellX = 1, cellZ = 1) => ({
  width, height, x0: -2, z0: -3, cellX, cellZ,
});

function mesh(points) {
  return {
    positions: new Float32Array(points.flat()),
    indices: new Uint32Array([0, 1, 2]),
  };
}

test("preserves clipped geometry arrays, upward winding, and selects focus at a mesh vertex", () => {
  const t = terrain(5, 5), field = new Float32Array(25).fill(0.9),
    input = mesh([[0, 14, 0], [0, 14, 1], [1, 14, 0]]),
    withUnreferenced = new Float32Array([...input.positions, 0.9, 99, 0.1]),
    result = buildEelOpticalGrid(t, field, withUnreferenced, input.indices,
      { focusXZ: [0.9, 0.1] });
  assert.strictEqual(result.positions, withUnreferenced);
  assert.strictEqual(result.indices, input.indices);
  assert.equal(result.focus.x, 1);
  assert.equal(result.focus.y, 14);
  assert.equal(result.focus.z, 0);
  const [a, b, c] = [0, 1, 2].map((i) => [
    input.positions[i * 3], input.positions[i * 3 + 1], input.positions[i * 3 + 2],
  ]), crossY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  assert.ok(crossY > 0, "input upward-facing winding remains unchanged");
  assert.equal(result.representation.includes("not bathymetry"), true);
});

test("sets depth to zero at interpolated shoreline crossings", () => {
  const field = new Float32Array([0.25, 0.75, 0.25, 0.25, 0.75, 0.25]),
    input = mesh([[ -1.5, 10, -2.5], [ -1, 10, -2.5], [ -1.5, 10, -2]]),
    result = buildEelOpticalGrid(terrain(3, 2), field, input.positions, input.indices,
      { focusXZ: [-1, -2.5] });
  assert.equal(result.depths[0], 0);
  assert.ok(Math.abs(result.depths[1] - 0.04) < 1e-7);
});

test("zeros a clipped vertex on Eel's diagonal triangle contour", () => {
  const field = new Float32Array([0.9, 0.1, 0.9, 0.9]),
    input = mesh([[-1.5, 6, -2.5], [-1, 6, -2.5], [-1.5, 6, -2]]),
    result = buildEelOpticalGrid(terrain(2, 2), field, input.positions, input.indices,
      { focusXZ: [-1.5, -2.5] });
  // At the b-c diagonal midpoint the triangle field is exactly 0.5; bilinear interpolation
  // across all four cell values would instead produce 0.7.
  assert.equal(result.depths[0], 0);
});

test("accepts Float32-rounded negative terrain-edge vertices", () => {
  const t = { width: 3, height: 3, x0: -1000.124, z0: -2000.456, cellX: 1, cellZ: 1 },
    field = new Float32Array(9).fill(0.9),
    input = mesh([[t.x0, 5, t.z0], [t.x0 + 1, 5, t.z0], [t.x0, 5, t.z0 + 1]]);
  assert.ok(input.positions[0] < t.x0);
  assert.doesNotThrow(() => buildEelOpticalGrid(t, field, input.positions, input.indices));
});

test("dry islands and holes reduce depth relative to wet interior", () => {
  const field = new Float32Array(49).fill(0.9);
  field[3 * 7 + 3] = 0.1;
  const input = mesh([[0, 8, 0], [-1, 8, 0], [0, 8, -1]]),
    result = buildEelOpticalGrid(terrain(7, 7), field, input.positions, input.indices,
      { focusXZ: [0, 0], maxDepth: 20 });
  assert.ok(result.depths[0] < result.depths[1]);
});

test("shore distance uses anisotropic horizontal cell sizes", () => {
  const width = 5, height = 5, field = new Float32Array(width * height).fill(0.9);
  for (let j = 0; j < height; j++) field[j * width] = 0.1;
  const input = mesh([[2, 3, 0], [2, 3, 1], [2, 3, 0.5]]),
    result = buildEelOpticalGrid(terrain(width, height, 3, 1), field,
      input.positions, input.indices, { maxDepth: 20, focusXZ: [2, 0] });
  assert.ok(Math.abs(result.depths[0] - 0.2) < 1e-6);
});

test("depth output is deterministic and inputs are not mutated", () => {
  const t = terrain(5, 5), field = new Float32Array(25).fill(0.9);
  for (let j = 0; j < 5; j++) field[j * 5] = 0.1;
  const input = mesh([[-1, 4, -1], [0, 4, -1], [-1, 4, 0]]),
    beforeField = field.slice(), beforePositions = input.positions.slice(), beforeIndices = input.indices.slice(),
    a = buildEelOpticalGrid(t, field, input.positions, input.indices),
    b = buildEelOpticalGrid(t, field, input.positions, input.indices);
  assert.deepEqual(a.depths, b.depths);
  assert.deepEqual(field, beforeField);
  assert.deepEqual(input.positions, beforePositions);
  assert.deepEqual(input.indices, beforeIndices);
});

test("rejects invalid dimensions, nonfinite inputs, and out-of-range indices", () => {
  const t = terrain(3, 3), field = new Float32Array(9).fill(0.9),
    input = mesh([[0, 0, 0], [1, 0, 0], [0, 0, 1]]);
  assert.throws(() => buildEelOpticalGrid({ ...t, cellX: -1 }, field,
    input.positions, input.indices), /positive cells/);
  const badField = field.slice(); badField[2] = NaN;
  assert.throws(() => buildEelOpticalGrid(t, badField, input.positions,
    input.indices), /finite Float32 wet field/);
  const badPositions = input.positions.slice(); badPositions[0] = Infinity;
  assert.throws(() => buildEelOpticalGrid(t, field, badPositions,
    input.indices), /finite clipped Float32 positions/);
  assert.throws(() => buildEelOpticalGrid(t, field, input.positions,
    new Uint32Array([0, 1, 3])), /valid clipped Uint32 triangle indices/);
  const outside = input.positions.slice(); outside[0] = 20;
  assert.throws(() => buildEelOpticalGrid(t, field, outside,
    input.indices), /outside terrain bounds/);
});
