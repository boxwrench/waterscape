import test from "node:test";
import assert from "node:assert/strict";
import { forestSites, forestDetailSites } from "../../river-pulse/rivers/eel_river/scenes/end/scotia_bluffs/eel-setting-layout.js";

test("forest scatter is deterministic and excludes mapped water, steep faces and cameras", () => {
  const terrain = { width: 40, height: 40, x0: 900, z0: -1600, cellX: 14, cellZ: 14,
    ground: (x, z) => x > 1200 ? 40 + (x - 1200) * 2 : 40 },
    pixels = new Uint8Array(40 * 40 * 4), mapped = new Uint8Array(40 * 40);
  for (let i = 0; i < mapped.length; i++) pixels.set([36, 66, 38, 255], i * 4);
  for (let j = 0; j < 40; j++) for (let i = 0; i < 12; i++) mapped[j * 40 + i] = 1;
  const sites = forestSites(terrain, pixels, mapped);
  assert.ok(sites.length > 0); assert.deepEqual(sites, forestSites(terrain, pixels, mapped));
  for (const site of sites) {
    assert.ok(Object.values(site).every(Number.isFinite));
    // The finite 16 m slope stencil blends across the slope transition; its
    // steep interior must be empty while the transition itself can remain eligible.
    assert.ok(site.x < 1208); assert.equal(site.y, terrain.ground(site.x, site.z));
    const k = Math.round((site.z - terrain.z0) / terrain.cellZ) * terrain.width + Math.round((site.x - terrain.x0) / terrain.cellX);
    assert.equal(mapped[k], 0);
  }
  mapped.fill(1); assert.equal(forestSites(terrain, pixels, mapped).length, 0);
});

test("camera-dependent detail keeps every site once and spends its budget in view", () => {
  const sites = Array.from({ length: 1000 }, (_, i) => ({ x: i - 500, z: 0 })),
    selected = forestDetailSites(sites, [0, 100, 0], 160, [1000, 100, 0]);
  assert.equal(selected.detailed.length, 160);
  assert.equal(selected.detailed.length + selected.distant.length, sites.length);
  assert.equal(new Set([...selected.detailed, ...selected.distant]).size, sites.length);
  assert.ok(selected.detailed.every(site => site.x > 0));
  assert.deepEqual(selected, forestDetailSites(sites, [0, 100, 0], 160, [1000, 100, 0]));
});
