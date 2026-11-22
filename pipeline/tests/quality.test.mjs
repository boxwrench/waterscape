import { test } from "node:test";
import assert from "node:assert/strict";
import { CHOICES, LEVELS, QualityGovernor, SlowWatch, choiceWidth, forcedTier, startingLevel } from "../../renderer/engine/quality.js";

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

test("the explorer's Quality choices: full is high at the window's device pixels, up to 4K", () => {
  assert.equal(CHOICES.full.tier, 2);
  assert.equal(choiceWidth("full", 1280, 2), 2560);
  assert.equal(choiceWidth("full", 3000, 2), 3840);
  assert.deepEqual([1536, 1152, 768].map((w) => [choiceWidth(String(w), 2560, 1), CHOICES[w].tier]), [[1536, 2], [1152, 1], [768, 0]]);
});

test("slow watch: struggling after the settle and a full window over 60 ms, cleared by reset", () => {
  const w = new SlowWatch();
  let now = 0;
  for (; now < 2900; now += 80) w.sample(80, now);
  assert.equal(w.struggling, false, "not before 1 s settle + 2 s window");
  for (; now < 4000; now += 80) w.sample(80, now);
  assert.equal(w.struggling, true);
  w.reset();
  assert.equal(w.struggling, false);
  const ok = new SlowWatch();
  for (now = 0; now < 5000; now += 40) ok.sample(40, now);
  assert.equal(ok.struggling, false, "slow but not struggling");
});
