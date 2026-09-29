import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { REQUIRED, validateBiomes, validateBundle, validateTours } from "../validate-bundles.mjs";

const view = { x: 0, z: 0, above: 3, yaw: 0, pitch: -0.1, speed: 40, label: "View" };
const good = {
  "source.json": {
    name: "Test Reservoir", biome: "diablo-oak", anchor: [37.5, -121.8],
    bbox: [-121.9, 37.4, -121.7, 37.6], size: [2, 2],
  },
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
  await mkdir(path.join(path.dirname(dir), "biomes", "diablo-oak"), { recursive: true });
  await writeFile(path.join(path.dirname(dir), "biomes", "diablo-oak", "biome.json"),
    JSON.stringify({ id: "diablo-oak", name: "Diablo Range oak woodland", description: "x" }));
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

test("optional card summaries need sourced text and featured flags must be boolean", async () => {
  const dir = await bundle({ "story.json": {
    summary: { value: " ", source: "http://example.gov/" },
    facts: [{ ...good["story.json"].facts[0], featured: "true" }],
  } });
  assert.deepEqual(await validateBundle(dir), [
    "test: summary needs text", "test: summary has no https source", "test: fact 0 featured must be boolean",
  ]);
  await rm(path.dirname(dir), { recursive: true });
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

test("the body's biome must exist and agree across files", async () => {
  const dir = await bundle({ "source.json": { biome: "sierra" } });
  assert.deepEqual(await validateBundle(dir), [
    "test: biome sierra has no data/biomes/sierra/biome.json",
    "test: source.json biome sierra differs from terrain.json diablo-oak",
  ]);
  await rm(path.dirname(dir), { recursive: true });
});

test("tour stops must name existing bodies", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "tours-"));
  await mkdir(path.join(root, "data", "tours"), { recursive: true });
  await mkdir(path.join(root, "data", "calaveras"), { recursive: true });
  await writeFile(path.join(root, "data", "tours", "t.json"),
    JSON.stringify({ title: "T", stops: [{ id: "calaveras", caption: "c" }, { id: "nowhere", caption: "n" }] }));
  assert.deepEqual(await validateTours(root), ["tour t: no bundle for stop nowhere"]);
  await rm(root, { recursive: true });
});

test("a biome's listed ground files must exist", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "biomes-"));
  await mkdir(path.join(root, "data", "biomes", "b", "ground"), { recursive: true });
  await writeFile(path.join(root, "data", "biomes", "b", "ground", "grass_color.jpg"), "");
  await writeFile(path.join(root, "data", "biomes", "b", "biome.json"), JSON.stringify({
    id: "b", name: "B", description: "x",
    ground: { grass: { files: ["ground/grass_color.jpg", "ground/grass_normal.jpg"] } },
  }));
  assert.deepEqual(await validateBiomes(root), ["biome b: missing ground/grass_normal.jpg"]);
  await rm(root, { recursive: true });
});

test("water depth needs positive numbers and a source", async () => {
  const dir = await bundle({ "land.json": { water: { maxDepth: -3, bankSlope: 0.25, maxDepthSource: "x" } } });
  assert.deepEqual(await validateBundle(dir), [
    "test: land.json water.maxDepth must be a positive number",
    "test: land.json water.maxDepthSource must be an https URL",
  ]);
  await rm(path.dirname(dir), { recursive: true });
});
