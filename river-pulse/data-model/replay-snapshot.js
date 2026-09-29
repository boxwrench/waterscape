export const REPLAY_SNAPSHOT_SCHEMA = "river-pulse-replay-0.1";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value;
}

export function validateReplaySnapshot(snapshot) {
  if (!snapshot || snapshot.schema_version !== REPLAY_SNAPSHOT_SCHEMA)
    throw new Error(`Unsupported replay snapshot schema: ${snapshot?.schema_version}`);
  requireString(snapshot.engine_version, "engine_version");
  requireString(snapshot.visual_mapping_version, "visual_mapping_version");
  requireString(snapshot.pack?.id, "pack.id");
  requireString(snapshot.pack?.version, "pack.version");
  if (!snapshot.state?.request?.valid_time || !Number.isFinite(Date.parse(snapshot.state.request.valid_time)))
    throw new Error("Replay snapshot requires a valid state.request.valid_time");
  if (snapshot.state.request.as_of_time && !Number.isFinite(Date.parse(snapshot.state.request.as_of_time)))
    throw new Error("Replay snapshot has invalid state.request.as_of_time");

  const ids = new Set();
  for (const source of snapshot.source_snapshots ?? []) {
    const id = requireString(source.source_snapshot_id, "source_snapshot_id");
    if (ids.has(id)) throw new Error(`Duplicate source_snapshot_id: ${id}`);
    ids.add(id);
    if (!Array.isArray(source.quantities)) throw new Error(`Source snapshot ${id} requires quantities[]`);
  }
  return true;
}

export function createReplaySnapshot({
  engineVersion,
  visualMappingVersion,
  pack,
  state,
  sourceSnapshots = [],
  modelRunIds = [],
  selectedPlace = null,
  selectedFeature = null,
  camera = null,
  visualOutputs = {},
  createdAt = new Date().toISOString(),
}) {
  const snapshot = {
    schema_version: REPLAY_SNAPSHOT_SCHEMA,
    created_at: new Date(createdAt).toISOString(),
    engine_version: engineVersion,
    visual_mapping_version: visualMappingVersion,
    pack: clone(pack),
    state: clone(state),
    source_snapshots: clone(sourceSnapshots),
    model_run_ids: [...modelRunIds],
    selection: {
      place_id: selectedPlace,
      feature_id: selectedFeature,
    },
    camera: clone(camera),
    visual_outputs: clone(visualOutputs),
  };
  validateReplaySnapshot(snapshot);
  return deepFreeze(snapshot);
}

export function serializeReplaySnapshot(snapshot) {
  validateReplaySnapshot(snapshot);
  return JSON.stringify(snapshot);
}

export function restoreReplaySnapshot(serializedOrObject) {
  const parsed =
    typeof serializedOrObject === "string" ? JSON.parse(serializedOrObject) : clone(serializedOrObject);
  validateReplaySnapshot(parsed);
  return deepFreeze(parsed);
}

export function quantitiesFromReplay(snapshot, sourceSnapshotId) {
  validateReplaySnapshot(snapshot);
  const source = snapshot.source_snapshots.find((item) => item.source_snapshot_id === sourceSnapshotId);
  if (!source) return [];
  return clone(source.quantities);
}
