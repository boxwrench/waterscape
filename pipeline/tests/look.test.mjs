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

test("the light buffer carries the summer palette and cover in float4s 6 and 7", () => {
  const look = landLook({ grass: { summer: "sage" }, vegetation: { cover: 0.4 } }),
    b = presetBuffer(PRESETS.golden, look);
  assert.equal(b.length, 48);
  assert.deepEqual([...b.slice(24, 27)], SUMMER.sage.ground[0].map(Math.fround));
  assert.equal(b[27], Math.fround(0.4));
  assert.deepEqual([...b.slice(28, 31)], SUMMER.sage.ground[1].map(Math.fround));
});

test("a marine layer is written only for a fog-capable preset and a body with fog", () => {
  const fog = { from: [-1, 0], edge: 2200, width: 1500, top: 330, base: 60 },
    look = landLook({ fog });
  assert.deepEqual(look.fog, fog);
  const morning = presetBuffer(PRESETS.morning, look), golden = presetBuffer(PRESETS.golden, look);
  assert.equal(morning.length, 48);
  assert.ok(morning[32] > 0, "morning fog amount");
  assert.deepEqual([...morning.slice(33, 36)], [330, 60, 2200]);
  assert.deepEqual([...morning.slice(36, 39)], [-1, 0, 1500]);
  assert.equal(golden[32], 0);
  assert.equal(presetBuffer(PRESETS.morning, landLook({}))[32], 0);
});

test("an overcast fog morning dims the sun and closes the clouds; other presets are untouched", async () => {
  const { effectivePreset } = await import("../../renderer/engine/look.js");
  const look = landLook({ fog: { from: [0, 0], edge: -1, width: 1, top: 70, base: -20, overcast: 0.9 } }),
    m = effectivePreset(PRESETS.morning, look);
  assert.ok(m.cloudCoverage >= 0.9);
  assert.ok(m.sunColor[0] < PRESETS.morning.sunColor[0] * 0.6);
  assert.ok(m.hazeDensity > PRESETS.morning.hazeDensity);
  assert.equal(effectivePreset(PRESETS.golden, look), PRESETS.golden);
  assert.equal(effectivePreset(PRESETS.morning, landLook({})), PRESETS.morning);
});

test("water optics default to today's turbid profile and can be green", () => {
  const b = presetBuffer(PRESETS.golden, landLook({}));
  assert.equal(b.length, 48);
  assert.deepEqual([...b.slice(40, 43)], [0.62, 0.28, 0.3].map(Math.fround));
  assert.deepEqual([...b.slice(44, 47)], [0.022 / 0.62, 0.07 / 0.3, 0.105 / 0.4].map(Math.fround));
  const g = presetBuffer(PRESETS.golden, landLook({ water: { optics: "green" } }));
  assert.ok(g[41] < g[42], "green water loses blue faster than green");
});

test("bare cliffs and rock exposure default to none and reach the light buffer", () => {
  assert.equal(landLook({}).bare, 0);
  assert.equal(landLook({}).rock, 0);
  const look = landLook({ vegetation: { bare: 0.9 }, ground: { rock: 0.15 } });
  assert.equal(look.bare, 0.9);
  assert.equal(look.rock, 0.15);
  assert.equal(presetBuffer(PRESETS.golden, look)[31], Math.fround(0.9));
});
