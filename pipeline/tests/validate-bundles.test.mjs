import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { REQUIRED, validateBundle } from "../validate-bundles.mjs";

const view = { x: 0, z: 0, above: 3, yaw: 0, pitch: -0.1, speed: 40, label: "View" };
const good = {
  "terrain.json": {
    name: "Test Reservoir", biome: "diablo-oak", width: 2, height: 2, cell: [10, 10],
    gridOrigin: [0, 0], waterLevel: 100, originUTM: [0, 0], channels: {},
  },
  "cameras.json": {
    viewpoints: { overlook: view, ridge: view, shore: view },
    flyover: { duration: 10, keys: [{ t: 0 }, { t: 10 }] },
  },
  "story.json": {
    id: "test", name: "Test Reservoir", operator: "Someone", headline: "Hello.",
    facts: [{ label: "Capacity", value: "1 acre-foot", source: "https://example.gov/" }],
  },
  "land.json": {
    biome: "diablo-oak", vegetation: { density: 1, species: { "coast-live": 1 } },
    grass: { spring: "green", summer: "gold" }, presets: ["golden"], defaultPreset: "golden", defaultSeason: "summer",
  },
};

async function bundle(overrides = {}, drop = []) {
  const dir = path.join(await mkdtemp(path.join(os.tmpdir(), "bundle-")), "test");
  await mkdir(dir);
  for (const file of REQUIRED) {
    if (drop.includes(file)) continue;
    const body = file.endsWith(".json") ? JSON.stringify({ ...good[file], ...overrides[file] }) : "";
    await writeFile(path.join(dir, file), body);
  }
  return dir;
}

test("a complete bundle has no errors", async () => {
  const dir = await bundle();
  assert.deepEqual(await validateBundle(dir), []);
  await rm(path.dirname(dir), { recursive: true });
});

test("a missing file is reported", async () => {
  const dir = await bundle({}, ["story.json"]);
  assert.deepEqual(await validateBundle(dir), ["test: missing story.json"]);
});

test("a fact without an https source is reported", async () => {
  const dir = await bundle({
    "story.json": { facts: [{ label: "Capacity", value: "1", source: "" }] },
  });
  assert.deepEqual(await validateBundle(dir), ["test: fact 0 (Capacity) has no https source"]);
});

test("flyover keys must end at the duration", async () => {
  const dir = await bundle({ "cameras.json": { flyover: { duration: 12, keys: [{ t: 0 }, { t: 10 }] } } });
  assert.deepEqual(await validateBundle(dir), ["test: last flyover key must be at duration"]);
});

test("land.json must match the terrain biome and name known presets", async () => {
  const dir = await bundle({ "land.json": { biome: "sierra", presets: ["golden", "dusk"], defaultPreset: "midday" } });
  assert.deepEqual(await validateBundle(dir), [
    "test: land.json biome sierra differs from terrain.json diablo-oak",
    "test: land.json names unknown preset dusk",
    "test: land.json defaultPreset midday is not in its presets",
  ]);
  await rm(path.dirname(dir), { recursive: true });
});

test("land.json defaultSeason must be spring or summer", async () => {
  const dir = await bundle({ "land.json": { defaultSeason: "autumn" } });
  assert.deepEqual(await validateBundle(dir), ["test: land.json defaultSeason autumn is not spring or summer"]);
  await rm(path.dirname(dir), { recursive: true });
});
