import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  findPlaceEntry,
  loadPlaceFromRegistry,
  placeCapabilityState,
  validatePlaceManifest,
  validatePlaceRegistry,
} from "../../river-pulse/core/data-model/place-registry.js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url)),
  dataRoot = `${repoRoot}river-pulse`;

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("committed registry exposes Hacienda and Jenner through the same place schema", async () => {
  const registry = await json(`${dataRoot}/registry.json`),
    hacienda = await json(`${dataRoot}/rivers/russian_river/scenes/middle/hacienda_bridge/data/place.json`),
    jenner = await json(`${dataRoot}/rivers/russian_river/scenes/end/jenner/data/place.json`);

  assert.equal(validatePlaceRegistry(registry), true);
  assert.equal(validatePlaceManifest(hacienda), true);
  assert.equal(validatePlaceManifest(jenner), true);
  assert.ok(findPlaceEntry(registry, "russian_river", "hacienda_bridge"));
  assert.ok(findPlaceEntry(registry, "russian_river", "jenner"));
  assert.equal(hacienda.hydrologic_context, "river_reach");
  assert.equal(jenner.hydrologic_context, "estuary");
});

test("supported capability remains distinct from installed data binding", async () => {
  const jenner = await json(`${dataRoot}/rivers/russian_river/scenes/end/jenner/data/place.json`),
    state = placeCapabilityState(jenner);
  assert.ok(state.supported.includes("upstream_discharge_context"));
  assert.ok(state.supported.includes("observed_water_surface_elevation"));
  assert.ok(state.installed_bindings.includes("water_surface_elevation"));
  assert.ok(state.installed_bindings.includes("river_centerline"));
  assert.equal(state.installed_bindings.includes("upstream_discharge_context"), false);
});

test("common loader loads either authored place without place-specific engine code", async () => {
  const registry = await json(`${dataRoot}/registry.json`),
    manifests = new Map();
  for (const entry of registry.places)
    manifests.set(
      `https://example.test/river-pulse/${entry.manifest}`,
      await json(`${dataRoot}/${entry.manifest}`),
    );

  const fetchImpl = async (url) => {
    if (url === "https://example.test/river-pulse/registry.json")
      return { ok: true, async json() { return registry; } };
    const manifest = manifests.get(String(url));
    if (!manifest) return { ok: false, status: 404, async json() { return {}; } };
    return { ok: true, async json() { return manifest; } };
  };

  const hacienda = await loadPlaceFromRegistry({
      registryUrl: "https://example.test/river-pulse/registry.json",
      riverPack: "russian_river",
      placeId: "hacienda_bridge",
      fetchImpl,
    }),
    jenner = await loadPlaceFromRegistry({
      registryUrl: "https://example.test/river-pulse/registry.json",
      riverPack: "russian_river",
      placeId: "jenner",
      fetchImpl,
    });

  assert.equal(hacienda.manifest.id, "hacienda_bridge");
  assert.equal(jenner.manifest.id, "jenner");
  assert.equal(hacienda.manifest_url, "https://example.test/river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/data/place.json");
  assert.equal(jenner.manifest_url, "https://example.test/river-pulse/rivers/russian_river/scenes/end/jenner/data/place.json");
});
