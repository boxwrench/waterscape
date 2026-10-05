import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { validateRiverPackages } from "../validate-river-packages.mjs";

const root = path.resolve(import.meta.dirname, "../..");
async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "river-packages-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(path.join(root, "river-pulse"), path.join(dir, "river-pulse"), { recursive: true });
  return dir;
}
test("river packages include a scene and a manifest-only estuary", async () => {
  const places = await validateRiverPackages(root);
  assert.deepEqual(places.map((p) => p.id), ["scotia_bluffs", "hacienda_bridge", "jenner", "freeport"]);
});
test("deployment rejects missing terrain instead of shipping a broken scene", async (t) => {
  const dir = await fixture(t);
  await rm(path.join(dir, "river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/data/terrain.bin.gz"));
  await assert.rejects(validateRiverPackages(dir), /ENOENT/);
});
test("deployment rejects truncated elevation data", async (t) => {
  const dir = await fixture(t);
  await writeFile(path.join(dir, "river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/data/terrain.bin.gz"), gzipSync(Buffer.alloc(2)));
  await assert.rejects(validateRiverPackages(dir), /River elevation payload size/);
});
test("deployment rejects missing river centerlines", async (t) => {
  const dir = await fixture(t);
  await rm(path.join(dir, "river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/data/hydrography.json"));
  await assert.rejects(validateRiverPackages(dir), /ENOENT/);
});
