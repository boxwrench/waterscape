import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { riverDestination, overviewRiverOrder } from "../../river-pulse/data-model/overview-navigation.js";

const root = new URL("../../", import.meta.url);
const load = async file => JSON.parse(await readFile(new URL(file, root), "utf8"));

test("every mapped river resolves to its own home with available scenes", async () => {
  const registry = await load("river-pulse/data/registry.json"),
    geography = await load("river-pulse/data/california-overview.json");
  assert.deepEqual(geography.rivers.map(r => r.id).sort(), registry.rivers.map(r => r.id).sort());
  for (const entry of registry.rivers) {
    const manifest = await load(`river-pulse/data/${entry.manifest}`), destination = riverDestination(manifest);
    await access(new URL(destination, new URL("river-pulse/index.html", root)));
    assert.ok(destination.startsWith("./river.html?"));
    assert.equal(new URL(destination, "https://example.test/river-pulse/").searchParams.get("river"), entry.id);
    for (const scene of manifest.scenes ?? [])
      await access(new URL(scene.entry, new URL(`river-pulse/data/${entry.manifest}`, root)));
  }
});

test("state and river paths retain finite geographic coordinates and source evidence", async () => {
  const geography = await load("river-pulse/data/california-overview.json");
  assert.equal(geography.schema_version, "river-pulse-overview-0.1");
  assert.equal(geography.crs, "EPSG:3857");
  assert.ok(geography.state_path.includes("Z"));
  assert.ok(Math.abs(geography.width / geography.height -
    (geography.extent[2] - geography.extent[0]) / (geography.extent[3] - geography.extent[1])) < 1e-9);
  for (const path of [geography.state_path, ...geography.rivers.map(r => r.path)]) {
    assert.match(path, /^M/); assert.doesNotMatch(path, /NaN|Infinity/);
    for (const match of path.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)) {
      assert.ok(Number(match[1]) >= -1 && Number(match[1]) <= geography.width + 1);
      assert.ok(Number(match[2]) >= -1 && Number(match[2]) <= geography.height + 1);
    }
  }
  for (const river of geography.rivers) { assert.ok(river.feature_count > 0); assert.ok(river.anchor.every(Number.isFinite)); }
  assert.equal(geography.sources.length, 3);
  for (const source of geography.sources) assert.match(source.url, /^https:\/\/.*(?:census\.gov|nationalmap\.gov)\//);
  assert.ok(Number.isFinite(Date.parse(geography.retrieval_time)));
  const relief = await readFile(new URL(`river-pulse/data/${geography.relief}`, root));
  assert.deepEqual([...relief.subarray(0, 2)], [255, 216]);
});

test("overview order is deterministic and does not mutate the registry", () => {
  const entries = [{id: "sacramento_river", name: "Sacramento"}, {id: "russian_river", name: "Russian"}];
  assert.equal(overviewRiverOrder(entries)[0].id, "russian_river");
  assert.equal(entries[0].id, "sacramento_river");
});
