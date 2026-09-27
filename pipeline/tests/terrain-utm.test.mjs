import { test } from "node:test";
import assert from "node:assert/strict";
import { Terrain, utmInverse } from "../../renderer/terrain.js";

test("false easting sits on the zone's central meridian", () => {
  assert.ok(Math.abs(utmInverse(500000, 4400000, 13)[1] - -105) < 1e-9);
  assert.ok(Math.abs(utmInverse(500000, 4400000, 10)[1] - -123) < 1e-9);
});

test("bundles without utmZone are zone 10", () => {
  const meta = { width: 2, height: 2, cell: [10, 10], gridOrigin: [0, 0], waterLevel: 0, originUTM: [500000, 4400000] },
    t = new Terrain(meta, new Float32Array(16));
  assert.ok(Math.abs(t.latLon(0, 0)[1] - -123) < 1e-9);
});
