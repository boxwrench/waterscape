import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gravityProfile, damGeometry } from "../../renderer/land/structures.js";

test("the gravity profile reaches the recorded height plus a footing, with a sloped downstream face", () => {
  const p = gravityProfile(95.1),
    ys = p.map(([, y]) => y),
    us = p.map(([u]) => u);
  assert.equal(Math.min(...ys), -(95.1 + 12));
  assert.ok(Math.max(...us) > 0.7 * 95.1, "base wider than 0.7 of the height");
});

test("O'Shaughnessy Dam's geometry spans its traced crest at the recorded crest elevation", () => {
  const { dams } = JSON.parse(readFileSync(new URL("../../data/hetch_hetchy/structures.json", import.meta.url))),
    meta = JSON.parse(readFileSync(new URL("../../data/hetch_hetchy/terrain.json", import.meta.url))),
    g = damGeometry(dams[0], meta, 1),
    pos = g.getAttribute("position").array;
  let top = -Infinity;
  for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i]);
  // Crest 1163.4 m, water 1151.7 m, parapets 1.2 m.
  assert.ok(Math.abs(top - (1163.4 - meta.waterLevel + 1.2)) < 0.01, `top ${top}`);
});
