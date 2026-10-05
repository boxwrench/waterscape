// Validate deployable river packages separately from still-water reservoir bundles.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function validateRiverPackages(root) {
  const data = path.join(root, "river-pulse", "data"),
    json = async (file) => JSON.parse(await readFile(file, "utf8")),
    registry = await json(path.join(data, "registry.json")),
    discovered = [];
  assert.equal(registry.schema_version, "river-pulse-registry-0.1");
  for (const river of await readdir(data, { withFileTypes: true })) {
    if (!river.isDirectory()) continue;
    const places = path.join(data, river.name, "places");
    // Planned river packages have river metadata but no authored places yet.
    let placeEntries;
    try { placeEntries = await readdir(places, { withFileTypes: true }); }
    catch (error) { if (error.code !== "ENOENT") throw error; placeEntries = []; }
    for (const place of placeEntries) {
      if (!place.isDirectory()) continue;
      const dir = path.join(places, place.name), manifest = await json(path.join(dir, "place.json"));
      assert.equal(manifest.schema_version, "river-pulse-place-0.1");
      assert.equal(manifest.id, place.name);
      assert.equal(manifest.river_pack, river.name);
      discovered.push({
        river_pack: river.name,
        id: place.name,
        name: manifest.name,
        hydrologic_context: manifest.hydrologic_context,
        manifest: `${river.name}/places/${place.name}/place.json`,
        supported_capabilities: [...new Set(manifest.supported_capabilities)].sort(),
      });
      // Scientific terrain is optional; authored Setting geometry (Jenner) is not a DEM.
      if (!manifest.terrain_source) continue;
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
    }
  }
  discovered.sort((a, b) => a.river_pack.localeCompare(b.river_pack) || a.id.localeCompare(b.id));
  assert.deepEqual(registry.places, discovered, "River registry is stale; run pipeline/build_river_registry.py");
  const rivers = [];
  for (const river of await readdir(data, { withFileTypes: true })) {
    if (!river.isDirectory()) continue;
    const manifest = await json(path.join(data, river.name, "river.json"));
    assert.equal(manifest.schema_version, "river-pulse-river-0.1");
    assert.equal(manifest.id, river.name);
    assert.ok(["available", "in_development", "planned"].includes(manifest.status));
    assert.ok(typeof manifest.name === "string" && manifest.name.trim());
    assert.ok(typeof manifest.summary === "string" && manifest.summary.trim());
    assert.ok(manifest.references?.length > 0);
    for (const reference of manifest.references) assert.match(reference.url, /^https:\/\//);
    for (const scene of manifest.scenes ?? []) {
      const entry = path.resolve(data, river.name, scene.entry);
      assert.ok(entry.startsWith(path.join(root, "river-pulse") + path.sep));
      await readFile(entry);
      if (scene.image) {
        const image = path.resolve(data, river.name, scene.image);
        assert.ok(image.startsWith(path.join(data, river.name) + path.sep), "Scene image must stay in its river package");
        assert.ok((await readFile(image)).length > 0);
      }
      for (const view of scene.views ?? []) assert.ok(typeof view === "string" && view.trim());
    }
    rivers.push({ id: manifest.id, name: manifest.name, status: manifest.status,
      manifest: `${river.name}/river.json` });
  }
  rivers.sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(registry.rivers, rivers, "River catalog is stale");
  return discovered;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await validateRiverPackages(path.resolve(import.meta.dirname, ".."));
  console.log("River packages valid.");
}
