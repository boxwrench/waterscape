import { test } from "node:test";
import assert from "node:assert/strict";
import { OAK_CELL, hash, oakSite, oaksNear } from "../../renderer/land/oak-placement.js";

// Flat, dry, far-from-shore ground in a valley: dense woodland (valley channel 1).
const woodland = { sample: (x, z, c) => (c === 0 ? 100 : c === 1 ? 500 : 1) };

test("hash matches water.cu's integer hash", () => {
  // hashU(89173) & 0xffffff, by hand: the lattice origin's value in the shader.
  const v = hash(0, 0);
  assert.ok(v > 0 && v < 1);
  assert.equal(hash(0, 0), hash(0.9, 0.9), "truncates like (int)x");
  assert.notEqual(hash(1, 0), hash(0, 1));
});

test("sites stay inside their cell and radii span 3.4-6.6 m", () => {
  for (let cx = -20; cx < 20; cx++)
    for (let cz = -20; cz < 20; cz++) {
      const s = oakSite(woodland, cx, cz);
      if (!s) continue;
      assert.ok(s.x >= cx * OAK_CELL && s.x < (cx + 1) * OAK_CELL);
      assert.ok(s.radius >= 3.4 && s.radius <= 6.6);
    }
});

test("no oaks at the shore", () => {
  const beach = { sample: (x, z, c) => (c === 1 ? 2 : c === 2 ? 1 : 100) };
  assert.equal(oaksNear(beach, 0, 0, 100).length, 0);
  assert.ok(oaksNear(woodland, 0, 0, 100).length > 50);
});

test("stands group the rarer species instead of scattering it", async () => {
  const { standPick } = await import("../../renderer/land/oak-placement.js");
  // Neighbouring trees 9 m apart agree far more often with stands than without.
  let agreeMixed = 0, agreeStands = 0, n = 0;
  for (let cx = 0; cx < 200; cx++)
    for (let cz = 0; cz < 20; cz++) {
      const x = cx * 9, z = cz * 9, a = hash(cx + 5, cz + 91), b = hash(cx + 6, cz + 91);
      agreeMixed += (a >= 0.9) === (b >= 0.9) && a >= 0.9 ? 1 : 0;
      agreeStands += (standPick(x, z, a, 1) >= 0.9) && (standPick(x + 9, z, b, 1) >= 0.9) ? 1 : 0;
      n++;
    }
  assert.ok(agreeStands > 3 * agreeMixed, `${agreeStands} vs ${agreeMixed} of ${n}`);
  assert.equal(standPick(10, 20, 0.42, 0), 0.42);
});
