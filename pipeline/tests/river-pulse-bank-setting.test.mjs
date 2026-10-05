import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { decodeRiverTerrain } from "../../river-pulse/scene-kit/terrain.js";
import { localReach, bankTreeSites } from "../../river-pulse/scene-kit/bank-setting-layout.js";

const base = new URL("../../river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/data/", import.meta.url),
  raw = gunzipSync(readFileSync(new URL("terrain.bin.gz", base))),
  terrain = decodeRiverTerrain(JSON.parse(readFileSync(new URL("terrain.json", base))),
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)),
  document = JSON.parse(readFileSync(new URL("hydrography.json", base))),
  reach = localReach(document, terrain);

test("shoreline camera stands on the dry side near the clipped local water edge", () => {
  assert.ok(reach);
  assert.ok(Math.abs(reach.shoreline.y - reach.sample(reach.shoreline.x, reach.shoreline.z).y) < 0.001);
  assert.ok(terrain.ground(reach.camera.x, reach.camera.z) >= reach.sample(reach.camera.x, reach.camera.z).y);
  assert.ok(Math.hypot(reach.camera.x - reach.shoreline.x, reach.camera.z - reach.shoreline.z) < 1);
  assert.ok(Math.abs(reach.camera.y - terrain.ground(reach.camera.x, reach.camera.z) - 1.8) < 0.001);
  assert.equal(localReach({ features: [] }, terrain), null);
});
test("conifer stands are deterministic, bounded and above the local water", () => {
  const sites = bankTreeSites(reach, terrain);
  assert.ok(sites.length > 10 && sites.length <= 48);
  assert.deepEqual(sites, bankTreeSites(reach, terrain));
  for (const site of sites) {
    assert.ok(site.y >= reach.sample(site.x, site.z).y + 1);
    assert.ok(Math.hypot(site.x - reach.focus.x, site.z - reach.focus.z) < 200);
  }
});
test("bundled material maps match upstream hashes and conifer buffers match part metadata", () => {
  const setting = new URL("setting/", base), manifest = JSON.parse(readFileSync(new URL("materials.json", setting)));
  for (const material of manifest.materials) {
    assert.equal(material.license, "CC0-1.0");
    assert.ok(material.tileMetres > 0);
    for (const map of Object.values(material.maps)) {
      const data = readFileSync(new URL(map.file, setting));
      assert.equal(createHash("md5").update(data).digest("hex"), map.md5);
      assert.ok(map.source.startsWith("https://dl.polyhaven.org/"));
    }
  }
  const trees = JSON.parse(readFileSync(new URL("conifers.json", setting)));
  for (const variant of trees.variants) {
    const data = readFileSync(new URL(variant.file, setting));
    for (const part of Object.values(variant.parts)) assert.ok(part.offset + part.vertexCount * 32 + part.indexCount * 4 <= data.length);
  }
});
