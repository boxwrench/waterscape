export const PLACE_SCHEMA = "river-pulse-place-0.1";
export const REGISTRY_SCHEMA = "river-pulse-registry-0.1";

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value;
}

export function validatePlaceManifest(manifest) {
  if (!manifest || manifest.schema_version !== PLACE_SCHEMA)
    throw new Error(`Unsupported place schema: ${manifest?.schema_version}`);
  for (const key of ["id", "river_pack", "name", "minimum_engine_version", "hydrologic_context", "horizontal_crs"])
    requiredString(manifest[key], key);
  if (!manifest.anchor || !Number.isFinite(Number(manifest.anchor.latitude)) || !Number.isFinite(Number(manifest.anchor.longitude)))
    throw new Error("Place manifest requires a numeric anchor latitude/longitude");
  if (!Array.isArray(manifest.supported_capabilities))
    throw new Error("Place manifest requires supported_capabilities[]");
  if (manifest.data_bindings != null && !Array.isArray(manifest.data_bindings))
    throw new Error("Place manifest data_bindings must be an array when present");
  return true;
}

export function validatePlaceRegistry(registry) {
  if (!registry || registry.schema_version !== REGISTRY_SCHEMA)
    throw new Error(`Unsupported place registry schema: ${registry?.schema_version}`);
  if (!Array.isArray(registry.places)) throw new Error("Place registry requires places[]");
  return true;
}

export function findPlaceEntry(registry, riverPack, placeId) {
  validatePlaceRegistry(registry);
  return registry.places.find((entry) => entry.river_pack === riverPack && entry.id === placeId) ?? null;
}

export function placeCapabilityState(manifest) {
  validatePlaceManifest(manifest);
  const supported = new Set(manifest.supported_capabilities),
    installedBindings = new Set((manifest.data_bindings ?? []).map((binding) => binding.phenomenon).filter(Boolean));
  return Object.freeze({
    supported: Object.freeze([...supported]),
    installed_bindings: Object.freeze([...installedBindings]),
  });
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

export async function loadPlaceRegistry(url = "../data/registry.json", fetchImpl = fetch) {
  const registry = await fetchJson(url, fetchImpl);
  validatePlaceRegistry(registry);
  return Object.freeze(registry);
}

export async function loadPlaceManifest(url, fetchImpl = fetch) {
  const manifest = await fetchJson(url, fetchImpl);
  validatePlaceManifest(manifest);
  return Object.freeze(manifest);
}

export async function loadPlaceFromRegistry({ registryUrl, riverPack, placeId, fetchImpl = fetch, baseUrl = null }) {
  const registry = await loadPlaceRegistry(registryUrl, fetchImpl),
    entry = findPlaceEntry(registry, riverPack, placeId);
  if (!entry) throw new Error(`Unknown River Pulse place: ${riverPack}/${placeId}`);

  const runtimeBase = baseUrl ?? (typeof location !== "undefined" ? location.href : "https://river-pulse.local/"),
    registryAbsolute = new URL(registryUrl, runtimeBase),
    manifestUrl = new URL(entry.manifest, registryAbsolute).toString(),
    manifest = await loadPlaceManifest(manifestUrl, fetchImpl);
  if (manifest.id !== entry.id || manifest.river_pack !== entry.river_pack)
    throw new Error(`Registry/manifest identity mismatch for ${riverPack}/${placeId}`);
  return Object.freeze({ entry, manifest, manifest_url: manifestUrl });
}
