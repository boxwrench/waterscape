import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeRiverTerrain, RIVER_TERRAIN_SCHEMA } from "../../river-pulse/scene-kit/terrain.js";
import { buildRiverTerrainGrid } from "../../river-pulse/scene-kit/terrain-mesh.js";

function encode(values, width, height, codec) {
  const quantized = values.map((v) => Math.max(0, Math.min(65535, Math.round((v - codec.offset) / codec.scale)))),
    out = new ArrayBuffer(width * height * 2),
    view = new DataView(out);
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++) {
      const i = r * width + c,
        previous = r ? quantized[(r - 1) * width + c] : 0,
        delta = (quantized[i] - previous + 65536) & 0xffff;
      view.setUint16(i * 2, delta, true);
    }
  return out;
}

function fixture() {
  const codec = { offset: -250, scale: 0.05 },
    meta = {
      schemaVersion: RIVER_TERRAIN_SCHEMA,
      width: 3,
      height: 2,
      cell: [10, 20],
      gridOrigin: [-10, -20],
      originUTM: [500000, 4400000],
      utmZone: 10,
      verticalDatum: "NAVD88 metres (3DEP)",
      verticalOrigin: { type: "absolute", datum: "NAVD88", units: "metres" },
      channels: { elevation: codec },
    },
    values = [10, 20, 30, 40, 50, 60];
  return decodeRiverTerrain(meta, encode(values, meta.width, meta.height, codec));
}

test("river terrain preserves absolute elevation and non-square cells", () => {
  const terrain = fixture();
  assert.equal(terrain.sampleElevation(-10, -20), 10);
  assert.equal(terrain.sampleElevation(0, -20), 20);
  // Sampling clamps just inside the outermost cell so bilinear lookup never reads past the grid.
  assert.ok(Math.abs(terrain.sampleElevation(-10, 0) - 40) < 0.05);
  assert.equal(terrain.elevation(terrain.ground(-10, -20)), 10);
  assert.equal(terrain.cellX, 10);
  assert.equal(terrain.cellZ, 20);
});

test("river terrain local coordinates retain UTM georeference", () => {
  const terrain = fixture(),
    [, lon] = terrain.latLon(0, 0);
  assert.ok(Math.abs(lon - -123) < 1e-9);
});

test("river terrain supports camera clearance, picking, and generic GPU cells", () => {
  const terrain = fixture(),
    hit = terrain.pick(-10, 100, -20, 0, -1, 0);
  assert.ok(hit);
  assert.ok(Math.abs(hit.elevation - 10) < 1e-3);
  assert.equal(terrain.gpuCells().length, terrain.width * terrain.height * 4 + 8);
});

test("river terrain mesh never requires shoreline semantics", () => {
  const terrain = fixture(),
    grid = buildRiverTerrainGrid(terrain, { skirt: 100 });
  assert.equal(grid.count, (terrain.width + 2) * (terrain.height + 2));
  assert.equal(grid.indices.length, (terrain.width + 1) * (terrain.height + 1) * 6);
  assert.ok(grid.positions.every(Number.isFinite));
  assert.equal("shoreDistance" in terrain, false);
});
