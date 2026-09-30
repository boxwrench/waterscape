import { test } from "node:test";
import assert from "node:assert/strict";
import { landLook, SUMMER, speciesThresholds } from "../../renderer/engine/look.js";
import { PRESETS, presetBuffer } from "../../renderer/engine/presets.js";

test("a land profile without a look keeps the Diablo gold summer and cover", () => {
  const look = landLook({ grass: { summer: "gold" } });
  assert.equal(look.summer, SUMMER.gold);
  assert.equal(look.cover, 0);
});

test("the Peninsula profile reads sage grass, extra cover and species weights", () => {
  const look = landLook({ grass: { summer: "sage" }, vegetation: { cover: 0.4, species: { "coast-live": 3, "douglas-fir": 1 } } });
  assert.equal(look.summer, SUMMER.sage);
  assert.equal(look.cover, 0.4);
  assert.deepEqual(speciesThresholds(look, ["coast-live", "douglas-fir"]), [0.75, 1]);
});

test("species missing from the weights share evenly when no weights are given", () => {
  assert.deepEqual(speciesThresholds(landLook({}), ["a", "b"]), [0.5, 1]);
});

test("the light buffer carries the summer palette and cover in its last two float4s", () => {
  const look = landLook({ grass: { summer: "sage" }, vegetation: { cover: 0.4 } }),
    b = presetBuffer(PRESETS.golden, look);
  assert.equal(b.length, 32);
  assert.deepEqual([...b.slice(24, 27)], SUMMER.sage.ground[0].map(Math.fround));
  assert.equal(b[27], Math.fround(0.4));
  assert.deepEqual([...b.slice(28, 31)], SUMMER.sage.ground[1].map(Math.fround));
});
