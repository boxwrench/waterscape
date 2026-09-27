import { test } from "node:test";
import assert from "node:assert/strict";
import { poseAt } from "../../site/flyover-path.js";

const flyover = {
  duration: 10,
  keys: [
    { t: 0, x: 0, y: 100, z: 0, yaw: 3.1, pitch: -0.1 },
    { t: 5, x: 50, y: 120, z: -50, yaw: -3.1, pitch: -0.1 },
    { t: 10, x: 100, y: 140, z: -100, yaw: -3.0, pitch: -0.2 },
  ],
};

test("starts and ends on the first and last keys", () => {
  assert.equal(poseAt(flyover, 0).x, 0);
  assert.equal(poseAt(flyover, 10).x, 100);
  assert.equal(poseAt(flyover, 99).y, 140);
});

test("eases in and out but moves steadily through the middle", () => {
  const early = poseAt(flyover, 1).x, mid = poseAt(flyover, 5).x;
  assert.ok(early < 10, `eases in (x=${early})`);
  assert.ok(Math.abs(mid - 50) < 1e-9, `midpoint on the middle key (x=${mid})`);
});

test("turns the short way across ±π", () => {
  const yaw = poseAt(flyover, 2.5).yaw;
  assert.ok(Math.abs(Math.abs(yaw) - Math.PI) < 0.1, `yaw=${yaw}`);
});
