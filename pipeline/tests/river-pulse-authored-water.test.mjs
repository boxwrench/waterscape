import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { buildAuthoredWaterGeometry } from "../../river-pulse/scene-kit/authored-water-geometry.js";
import { decodeRiverTerrain } from "../../river-pulse/scene-kit/terrain.js";

const terrain = { x0: -100, z0: -100, width: 201, height: 201, cellX: 1, cellZ: 1,
  ground(x, z) { return Math.abs(x) < 12 ? 4 : 12; } },
  document = { features: [{ name: "Russian River", lines: [[[0, -80], [0, 80]]] }] };
test("authored surface stays within the local reach, above channel terrain, and off high banks", () => {
  const grid = buildAuthoredWaterGeometry(document, terrain, { radius: 60, halfWidth: 25 });
  assert.ok(grid.indices.length > 0);
  for (let i = 0; i < grid.positions.length; i += 3) {
    const [x, y, z] = grid.positions.slice(i, i + 3);
    assert.ok(Math.abs(x) < 12);
    assert.ok(Math.hypot(x, z) <= 60.001);
    assert.ok(y >= terrain.ground(x, z));
  }
  assert.equal(grid.depths.length, grid.positions.length / 3);
  assert.ok(grid.indices.every((i) => i < grid.depths.length));
  assert.match(grid.representation, /illustrative/);
});
test("absent mainstem has no invented water; invalid mesh settings fail", () => {
  assert.equal(buildAuthoredWaterGeometry({ features: [] }, terrain), null);
  assert.throws(() => buildAuthoredWaterGeometry(document, terrain, { step: 0 }), /positive/);
});
test("bundled Hacienda produces a bounded local water preview without altering terrain", () => {
  const base = new URL("../../river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/data/", import.meta.url),
    meta = JSON.parse(readFileSync(new URL("terrain.json", base))),
    raw = gunzipSync(readFileSync(new URL("terrain.bin.gz", base))),
    actual = decodeRiverTerrain(meta, raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)),
    before = actual.elevationCells.slice(),
    hydrography = JSON.parse(readFileSync(new URL("hydrography.json", base))),
    grid = buildAuthoredWaterGeometry(hydrography, actual);
  assert.ok(grid.indices.length > 100);
  assert.ok(Math.hypot(grid.focus.x, grid.focus.z) < 100);
  assert.deepEqual(actual.elevationCells, before);
});
