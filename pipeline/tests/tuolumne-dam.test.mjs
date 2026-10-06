import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { damGeometry, crestScene } from "../../renderer/land/structures.js";
import { damTerrainAdapter, damContactPositions } from "../../river-pulse/rivers/tuolumne_river/scenes/middle/poopenaut_valley/tuolumne-dam.js";

const json = file => JSON.parse(readFileSync(new URL(file, import.meta.url))),
  structures = json("../../data/hetch_hetchy/structures.json"),
  river = json("../../river-pulse/rivers/tuolumne_river/scenes/middle/poopenaut_valley/data/terrain.json"),
  reservoir = json("../../data/hetch_hetchy/terrain.json");

test("reused dam retains absolute crest height and UTM position inside Tuolumne terrain", () => {
  const terrain = { meta: river, verticalOffset: 0 }, adapter = damTerrainAdapter(terrain, structures),
    dam = structures.dams[0], crest = crestScene(dam, adapter.meta),
    [x0, z0] = river.gridOrigin, x1 = x0 + (river.width - 1) * river.cell[0], z1 = z0 + (river.height - 1) * river.cell[1],
    g = damGeometry(dam, adapter.meta, 1), pos = g.getAttribute("position").array;
  for (const [x, z] of crest) {
    assert.ok(x >= x0 && x <= x1 && z >= z0 && z <= z1);
  }
  assert.ok(Math.abs(crest[0][0] - (dam.crestUTM[0][0] - river.originUTM[0])) < 1e-8);
  let top = -Infinity;
  for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i]);
  assert.ok(Math.abs(top - dam.crestElevation - 1.2) < 0.001);
  const translated = damTerrainAdapter({ meta: river, verticalOffset: 1000 }, structures);
  assert.equal(translated.meta.waterLevel, 1000);
  assert.equal(adapter.meta.waterLevel, 0);
  assert.equal(reservoir.waterLevel, 1151.7);
});

test("authored dam contact changes only nearby render heights and leaves input source positions intact", () => {
  const adapter = damTerrainAdapter({ meta: river, verticalOffset: 0 }, structures),
    dam = structures.dams[0], crest = crestScene(dam, adapter.meta), [cx, cz] = crest[5],
    native = new Float32Array([cx, 1200, cz, cx - 40, 1190, cz, cx - 1000, 1200, cz]),
    preserved = native.slice(), adjusted = damContactPositions(native, { meta: river, verticalOffset: 0, cellX: river.cell[0], cellZ: river.cell[1] }, structures);
  assert.deepEqual(native, preserved);
  assert.ok(adjusted[1] < native[1], "source smear under the crest cleared for the structure");
  assert.equal(adjusted[7], native[7], "far terrain stays unchanged");
  for (let i = 0; i < native.length; i += 3) {
    assert.equal(adjusted[i], native[i]); assert.equal(adjusted[i + 2], native[i + 2]);
    assert.ok(adjusted[i + 1] <= native[i + 1]);
  }
});

test("downstream reference chooses the original profile side and geometry is only translated", () => {
  const adapter = damTerrainAdapter({ meta: river, verticalOffset: 0 }, structures),
    dam = structures.dams[0], crest = crestScene(dam, adapter.meta), [cx, cz] = crest[Math.floor(crest.length / 2)],
    [ax, az] = crest[0], [bx, bz] = crest.at(-1), tx = bx - ax, tz = bz - az, l = Math.hypot(tx, tz);
  assert.ok(adapter.shoreDistance(cx - tz / l * 40, cz + tx / l * 40) > adapter.shoreDistance(cx + tz / l * 40, cz - tx / l * 40));
  const original = damGeometry(dam, reservoir, 1).getAttribute("position").array,
    reused = damGeometry(dam, adapter.meta, 1).getAttribute("position").array,
    dx = reservoir.originUTM[0] - river.originUTM[0], dz = river.originUTM[1] - reservoir.originUTM[1];
  assert.equal(original.length, reused.length);
  for (let i = 0; i < original.length; i += 3) {
    assert.ok(Math.abs(reused[i] - original[i] - dx) < 0.002);
    assert.ok(Math.abs(reused[i + 1] - original[i + 1] - reservoir.waterLevel) < 0.001);
    assert.ok(Math.abs(reused[i + 2] - original[i + 2] - dz) < 0.001);
  }
});
