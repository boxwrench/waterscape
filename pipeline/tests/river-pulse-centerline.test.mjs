import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRiverCenterlineSegments,
  projectedToScene,
} from "../../river-pulse/scene-kit/river-centerline.js";

function terrain() {
  return {
    meta: { originUTM: [500000, 4260000], utmZone: 10 },
    x0: -100,
    z0: -100,
    width: 21,
    height: 21,
    cellX: 10,
    cellZ: 10,
    ground(x, z) {
      return 20 + x * 0.01 + z * 0.02;
    },
  };
}

test("projected coordinates map to x east and z south of place origin", () => {
  assert.deepEqual(projectedToScene(terrain(), [500120, 4259920]), { x: 120, z: 80 });
});

test("river centerline clips to terrain neighborhood and drapes to terrain", () => {
  const t = terrain(),
    layer = {
      horizontal_crs: "EPSG:32610",
      features: [
        {
          feature_id: "reach-a",
          paths: [
            [
              [499850, 4260000],
              [500000, 4260000],
              [500150, 4260000],
            ],
          ],
        },
      ],
    },
    mapped = buildRiverCenterlineSegments(layer, t, { lift: 2, margin: 0 });

  assert.equal(mapped.segment_count, 2);
  assert.equal(mapped.positions.length, 12);
  assert.deepEqual(mapped.feature_ids, ["reach-a", "reach-a"]);
  // First endpoint is clipped to x=-100. Its scene height follows terrain + lift.
  assert.equal(mapped.positions[0], -100);
  assert.equal(mapped.positions[1], t.ground(-100, 0) + 2);
  assert.equal(mapped.representation, "authoritative-centerline-draped-to-terrain");
});

test("river centerline rejects a projected CRS that does not match terrain zone", () => {
  assert.throws(
    () =>
      buildRiverCenterlineSegments(
        { horizontal_crs: "EPSG:4326", features: [] },
        terrain(),
      ),
    /does not match terrain/,
  );
});
