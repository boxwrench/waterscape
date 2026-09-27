import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, QualityGovernor, forcedTier, startingLevel } from "../../renderer/engine/quality.js";

// Feed frames of `ms` duration back to back from `start` until `until`; return level changes.
function run(gov, ms, start, until) {
  const changes = [];
  for (let now = start; now < until; now += ms) {
    const next = gov.sample(ms, now);
    if (next) changes.push({ at: now, level: gov.level, ...next });
  }
  return changes;
}

test("starting level: NVIDIA high, everything else medium", () => {
  assert.deepEqual(LEVELS[startingLevel("nvidia")], { tier: 2, width: 1152 });
  for (const v of ["intel", "amd", "apple", "", "not exposed"])
    assert.deepEqual(LEVELS[startingLevel(v)], { tier: 1, width: 1152 });
});

test("forced tier names", () => {
  assert.equal(forcedTier("low"), 0);
  assert.equal(forcedTier("medium"), 1);
  assert.equal(forcedTier("high"), 2);
  assert.equal(forcedTier("ultra"), null);
  assert.equal(forcedTier(null), null);
});

test("slow frames step down one level at a time, after settling and a 2 s window", () => {
  const gov = new QualityGovernor(2);
  assert.deepEqual(run(gov, 40, 0, 2900), [], "no change before 1 s settle + 2 s window");
  const changes = run(gov, 40, 2900, 9000);
  assert.deepEqual(changes.map((c) => c.level), [1, 0]);
  assert.ok(changes[1].at - changes[0].at >= 3000, "each step waits for a fresh window");
  assert.equal(gov.level, 0, "never below the cheapest level");
});

test("fast frames step up once only", () => {
  const gov = new QualityGovernor(1);
  const changes = run(gov, 10, 0, 30000);
  assert.deepEqual(changes.map((c) => c.level), [2]);
});

test("struggling only at the cheapest level above 60 ms", () => {
  const slow = new QualityGovernor(0);
  run(slow, 80, 0, 4000);
  assert.equal(slow.struggling, true);
  const ok = new QualityGovernor(0);
  run(ok, 40, 0, 4000);
  assert.equal(ok.struggling, false, "over budget but not struggling");
  const high = new QualityGovernor(3);
  run(high, 80, 0, 2900);
  assert.equal(high.struggling, false, "not at the cheapest level");
});
