import { test } from "node:test";
import assert from "node:assert/strict";
import { quantity } from "../../river-pulse/core/data-model/quantity.js";
import { riverState } from "../../river-pulse/core/data-model/river-state.js";
import {
  createReplaySnapshot,
  quantitiesFromReplay,
  restoreReplaySnapshot,
  serializeReplaySnapshot,
} from "../../river-pulse/core/data-model/replay-snapshot.js";
import { observedFlowStatus } from "../../river-pulse/core/visual-bindings/flow-status.js";

function currentQuantity() {
  return quantity({
    quantity_id: "usgs:test:2026-09-27T18:00:00Z",
    feature_id: "USGS-11467000",
    phenomenon: "discharge",
    value: 142,
    unit: "ft^3/s",
    evidence_type: "observation",
    time: { valid_start: "2026-09-27T18:00:00Z", as_of_time: null },
    source_approval: "provisional",
    provenance: {
      agency: "U.S. Geological Survey",
      dataset: "USGS Water Data latest-continuous",
      source_snapshot_id: "usgs-current-20260927T1805Z",
      retrieval_time: "2026-09-27T18:05:00Z",
    },
  });
}

test("replay snapshot survives JSON round trip with state and mappings unchanged", () => {
  const q = currentQuantity(),
    state = riverState({
      validTime: "2026-09-27T18:05:00Z",
      asOfTime: "2026-09-27T18:05:00Z",
      features: {
        gauges: [{ id: "USGS-11467000" }],
        authored_places: [{ id: "hacienda_bridge" }],
      },
      selections: [
        {
          feature_id: "USGS-11467000",
          phenomenon: "discharge",
          policy_id: "latest-at-or-before",
          result: { status: "selected", reason: "latest_at_or_before", age_ms: 300000, quantity: q },
        },
      ],
    }),
    flow = observedFlowStatus(state, "USGS-11467000"),
    snapshot = createReplaySnapshot({
      engineVersion: "river-pulse-0.1-dev",
      visualMappingVersion: "0.1",
      pack: { id: "russian-river", version: "0.1" },
      state,
      sourceSnapshots: [
        {
          source_snapshot_id: "usgs-current-20260927T1805Z",
          adapter_id: "usgs-latest-continuous",
          retrieval_time: "2026-09-27T18:05:00Z",
          quantities: [q],
        },
      ],
      selectedPlace: "hacienda_bridge",
      selectedFeature: "USGS-11467000",
      camera: { x: -120, y: 80, z: 180, yaw: 2.65, pitch: -0.22 },
      visualOutputs: { observed_flow_status: flow },
      createdAt: "2026-09-27T18:06:00Z",
    }),
    restored = restoreReplaySnapshot(serializeReplaySnapshot(snapshot));

  assert.deepEqual(restored.state, snapshot.state);
  assert.deepEqual(restored.visual_outputs, snapshot.visual_outputs);
  assert.deepEqual(restored.camera, snapshot.camera);
  assert.equal(restored.selection.place_id, "hacienda_bridge");
  assert.equal(restored.state.request.valid_time, "2026-09-27T18:05:00Z");
  assert.equal(restored.state.request.as_of_time, "2026-09-27T18:05:00Z");
});

test("offline replay exposes embedded quantities without a network fetch", () => {
  const q = currentQuantity(),
    snapshot = createReplaySnapshot({
      engineVersion: "river-pulse-0.1-dev",
      visualMappingVersion: "0.1",
      pack: { id: "russian-river", version: "0.1" },
      state: riverState({ validTime: "2026-09-27T18:05:00Z" }),
      sourceSnapshots: [
        {
          source_snapshot_id: "usgs-current-20260927T1805Z",
          adapter_id: "usgs-latest-continuous",
          quantities: [q],
        },
      ],
    }),
    quantities = quantitiesFromReplay(snapshot, "usgs-current-20260927T1805Z");

  assert.equal(quantities.length, 1);
  assert.equal(quantities[0].value, 142);
  assert.equal(quantities[0].provenance.agency, "U.S. Geological Survey");
});

test("replay snapshots reject duplicate source identities", () => {
  assert.throws(
    () =>
      createReplaySnapshot({
        engineVersion: "dev",
        visualMappingVersion: "0.1",
        pack: { id: "russian-river", version: "0.1" },
        state: riverState({ validTime: "2026-09-27T18:05:00Z" }),
        sourceSnapshots: [
          { source_snapshot_id: "same", quantities: [] },
          { source_snapshot_id: "same", quantities: [] },
        ],
      }),
    /Duplicate source_snapshot_id/,
  );
});
