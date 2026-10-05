// Validate deployable river packages separately from still-water reservoir bundles.
// Layout: river-pulse/rivers/<river>/river.json and scenes/<slot>/<place>/{scene.json, data/place.json, ...}
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SLOTS = ["start", "middle", "end", "extra"];
const exists = async (file) => { try { await stat(file); return true; } catch { return false; } };

async function validatePlace(root, river, slot, scene, dir, json) {
  const manifest = await json(path.join(dir, "place.json"));
  assert.equal(manifest.schema_version, "river-pulse-place-0.1");
  assert.equal(manifest.id, scene);
  assert.equal(manifest.river_pack, river);
  const entry = {
    river_pack: river,
    id: scene,
    name: manifest.name,
    hydrologic_context: manifest.hydrologic_context,
    manifest: `rivers/${river}/scenes/${slot}/${scene}/data/place.json`,
    supported_capabilities: [...new Set(manifest.supported_capabilities)].sort(),
  };
  // Scientific terrain is optional; authored Setting geometry (Jenner) is not a DEM.
  if (!manifest.terrain_source) return entry;
  assert.equal(manifest.terrain_source, "source.json");
  const source = await json(path.join(dir, "source.json")),
    terrain = await json(path.join(dir, "terrain.json"));
  assert.equal(source.id, manifest.id);
  assert.equal(terrain.id, manifest.id);
  assert.equal(terrain.schemaVersion, "river-pulse-terrain-0.1");
  assert.equal(terrain.verticalOrigin.type, "absolute");
  assert.equal(terrain.verticalDatum, "NAVD88 metres (3DEP)");
  assert.equal(terrain.crs, manifest.horizontal_crs);
  assert.equal("waterLevel" in terrain, false, "River terrain cannot assume one reservoir level");
  assert.match(terrain.sourceService, /^https:\/\//);
  assert.deepEqual([terrain.width, terrain.height], source.size);
  assert.ok(source.size.every((n) => Number.isInteger(n) && n >= 2));
  const hydrography = await json(path.join(dir, "hydrography.json"));
  assert.equal(hydrography.schemaVersion, "river-pulse-hydrography-0.1");
  assert.ok(hydrography.source.startsWith("U.S. Geological Survey 3D Hydrography Program"));
  assert.ok(hydrography.features.length > 0, "River centerline payload is empty");
  const bytes = gunzipSync(await readFile(path.join(dir, "terrain.bin.gz")));
  assert.equal(bytes.byteLength, terrain.width * terrain.height * 2, "River elevation payload size");
  return entry;
}

export async function validateRiverPackages(root) {
  const base = path.join(root, "river-pulse"),
    json = async (file) => JSON.parse(await readFile(file, "utf8")),
    registry = await json(path.join(base, "registry.json")),
    discovered = [], rivers = [];
  assert.equal(registry.schema_version, "river-pulse-registry-0.1");
  for (const river of (await readdir(path.join(base, "rivers"), { withFileTypes: true })).filter((e) => e.isDirectory())) {
    const riverDir = path.join(base, "rivers", river.name), manifest = await json(path.join(riverDir, "river.json"));
    assert.equal(manifest.schema_version, "river-pulse-river-0.2");
    assert.equal(manifest.id, river.name);
    assert.ok(["available", "in_development", "planned"].includes(manifest.status));
    assert.ok(typeof manifest.name === "string" && manifest.name.trim());
    assert.ok(typeof manifest.summary === "string" && manifest.summary.trim());
    assert.ok(manifest.references?.length > 0);
    for (const reference of manifest.references) assert.match(reference.url, /^https:\/\//);
    assert.ok(manifest.scenes?.length > 0, "Every river lists its slots; use planned placeholders for empty ones");
    const listed = new Set();
    for (const { slot, id } of manifest.scenes) {
      assert.ok(SLOTS.includes(slot), `Unknown slot ${slot}`);
      assert.ok(!listed.has(`${slot}/${id}`), `Duplicate scene ${slot}/${id}`);
      listed.add(`${slot}/${id}`);
      const folder = path.join(riverDir, "scenes", slot, id), scene = await json(path.join(folder, "scene.json"));
      assert.equal(scene.schema_version, "river-pulse-scene-0.1");
      assert.deepEqual([scene.id, scene.river, scene.slot], [id, river.name, slot]);
      assert.ok(["built", "planned"].includes(scene.status));
      assert.ok(typeof scene.name === "string" && scene.name.trim());
      if (scene.status === "planned") continue;
      for (const file of [scene.entry, scene.thumb]) assert.ok(file && (await exists(path.join(folder, file))), `${slot}/${id} needs ${file}`);
      for (const view of scene.views ?? []) assert.ok(typeof view === "string" && view.trim());
      if (await exists(path.join(folder, "data", "place.json")))
        discovered.push(await validatePlace(root, river.name, slot, id, path.join(folder, "data"), json));
    }
    // A scene folder that river.json does not list would be invisible on the river home.
    for (const slot of await readdir(path.join(riverDir, "scenes")))
      for (const id of await readdir(path.join(riverDir, "scenes", slot)))
        assert.ok(listed.has(`${slot}/${id}`), `Scene folder ${slot}/${id} is not listed in ${river.name}/river.json`);
    rivers.push({ id: manifest.id, name: manifest.name, status: manifest.status, manifest: `rivers/${river.name}/river.json` });
  }
  discovered.sort((a, b) => a.river_pack.localeCompare(b.river_pack) || a.id.localeCompare(b.id));
  assert.deepEqual(registry.places, discovered, "River registry is stale; run pipeline/build_river_registry.py");
  rivers.sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(registry.rivers, rivers, "River catalog is stale");
  return discovered;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await validateRiverPackages(path.resolve(import.meta.dirname, ".."));
  console.log("River packages valid.");
}
