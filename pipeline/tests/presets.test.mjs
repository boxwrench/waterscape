import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, PRESET_NAMES, choosePreset, presetBuffer } from "../../renderer/land/presets.js";

test("three presets, suns above the horizon and normalised", () => {
  assert.deepEqual(Object.keys(PRESETS).sort(), [...PRESET_NAMES].sort());
  for (const name of PRESET_NAMES) {
    const [x, y, z] = PRESETS[name].sun;
    assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-6, name);
    assert.ok(y > 0, name);
  }
  // Morning sun in the east (+x), golden hour in the west (−x), midday high.
  assert.ok(PRESETS.morning.sun[0] > 0.5 && PRESETS.golden.sun[0] < -0.5);
  assert.ok(PRESETS.midday.sun[1] > 0.8);
});

test("preset buffer layout matches the shader's six float4s", () => {
  const p = PRESETS.golden, b = presetBuffer(p);
  assert.equal(b.length, 24);
  assert.deepEqual([...b.slice(0, 3)], p.sun.map(Math.fround));
  assert.equal(b[3], Math.fround(p.cloudCoverage));
  assert.equal(b[11], Math.fround(p.skyGain));
  assert.equal(b[19], Math.fround(p.hazeDensity));
  assert.equal(b[22], Math.fround(p.exposure));
});

test("unknown or unoffered presets fall back to the bundle default", () => {
  const profile = { presets: ["golden", "midday"], defaultPreset: "golden" };
  assert.equal(choosePreset("midday", profile), "midday");
  assert.equal(choosePreset("morning", profile), "golden");
  assert.equal(choosePreset("sunset", profile), "golden");
  assert.equal(choosePreset(null, profile), "golden");
  assert.equal(choosePreset("midday", null), "midday");
  assert.equal(choosePreset(null, null), "golden");
});
