import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPoint } from "../../renderer/minimap.js";

test("scene x/z map onto the aerial image, which spans the grid's cell edges", () => {
  const meta = { cell: [10, 10], gridOrigin: [-95, -45], width: 20, height: 10 };
  assert.deepEqual(mapPoint(meta, -100, -50), [0, 0]);
  assert.deepEqual(mapPoint(meta, 100, 50), [1, 1]);
  assert.deepEqual(mapPoint(meta, 0, 0), [0.5, 0.5]);
});
