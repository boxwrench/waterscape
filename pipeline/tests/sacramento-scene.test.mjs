import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { decodeRiverTerrain } from "../../river-pulse/renderer/terrain.js";
import { FREEPORT_VIEWS, freeportChannel, freeportGround, constrainFreeportCamera } from "../../river-pulse/renderer/freeport-layout.js";
import { freeportDischarge } from "../../river-pulse/visual-bindings/freeport-discharge.js";
import { parseLatestContinuousFeature } from "../../river-pulse/adapters/usgs.js";
import { riverDestination } from "../../river-pulse/data-model/overview-navigation.js";

const base = new URL("../../river-pulse/data/sacramento_river/places/freeport/", import.meta.url),
  json = async file => JSON.parse(await readFile(new URL(file, base), "utf8"));

test("Freeport close-view cameras stay on dry authored banks during large movement", () => {
  for (const view of ["bridge", "bank"]) {
    const start = constrainFreeportCamera({ ...FREEPORT_VIEWS[view] }, view);
    assert.ok(freeportGround(start.x, start.z) > 0);
    for (const [x, z] of [[-10000, 10000], [10000, -10000], [0, 150]]) {
      const state = constrainFreeportCamera({ ...start, x, z }, view), channel = freeportChannel(state.z);
      assert.ok(state.x >= channel.center + channel.halfWidth + 4);
      assert.ok(state.z >= 5 && state.z <= 420);
      assert.ok(state.y >= freeportGround(state.x, state.z) + 1.8);
    }
  }
});

test("Freeport terrain, hydrography and imagery share the sourced gauge frame", async () => {
  const place = await json("place.json"), meta = await json("terrain.json"), hydrography = await json("hydrography.json"), aerial = await json("aerial.json"),
    bytes = gunzipSync(await readFile(new URL("terrain.bin.gz", base))), terrain = decodeRiverTerrain(meta, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.deepEqual(meta.anchor, [place.anchor.latitude, place.anchor.longitude]);
  assert.deepEqual(hydrography.anchor, meta.anchor); assert.equal(meta.crs, hydrography.crs); assert.equal(aerial.crs, meta.crs);
  assert.ok(hydrography.features.some(f => f.name === "Sacramento River"));
  assert.ok(terrain.elevationCells.every(Number.isFinite));
  assert.equal(meta.sceneVerticalOffset ?? 0, 0); assert.equal("waterLevel" in meta, false);
  const [oe, on] = meta.originUTM, [x0, z0] = meta.gridOrigin, [cx, cz] = meta.cell;
  assert.ok(Math.abs(aerial.extent[0] - (oe + x0 - cx / 2)) < 1e-5);
  assert.ok(Math.abs(aerial.extent[3] - (on - z0 + cz / 2)) < 1e-5);
  assert.match(aerial.source, /^https:\/\/imagery.nationalmap.gov\//);
  assert.deepEqual([...((await readFile(new URL(aerial.file, base))).subarray(0, 2))], [255, 216]);
  const state = constrainFreeportCamera({ x: -1e9, z: 1e9, y: -100 }, "terrain", terrain);
  assert.ok(state.x >= terrain.x0 && state.z <= terrain.z0 + (terrain.height - 1) * terrain.cellZ);
  assert.ok(state.y >= terrain.ground(state.x, state.z) + 50);
});

test("Freeport observation excludes future/wrong-series/daily readings and preserves staleness", async () => {
  const place = await json("place.json"), binding = place.data_bindings.find(b => b.phenomenon === "discharge"), validTime = "2026-10-03T12:00:00Z",
    q = parseLatestContinuousFeature({ id: "test-only", properties: { monitoring_location_id: binding.feature_id,
      parameter_code: "00060", time: "2026-10-03T11:45:00Z", time_series_id: binding.time_series_id,
      statistic_id: binding.statistic_id, value: "100", unit_of_measure: "ft^3/s", approval_status: "Provisional" } }, { retrievalTime: validTime });
  const current = freeportDischarge([q], binding, validTime);
  assert.equal(current.presentation.kind, "current"); assert.equal(current.presentation.quantity.value, 100);
  assert.equal(freeportDischarge([q], binding, "2026-10-03T13:00:00Z").presentation.kind, "stale");
  assert.equal(freeportDischarge([q], binding, "2026-10-03T11:00:00Z").presentation.kind, "unavailable");
  assert.equal(freeportDischarge([{ ...q, phenomenon: "tidally_filtered_discharge" }], binding, validTime).presentation.kind, "unavailable");
  assert.equal(freeportDischarge([], binding, validTime).presentation.quantity, null);
  assert.deepEqual(current.state.selected_quantities, [q], "Discharge must not create additional quantities");
  assert.equal(current.state.features.model_fields.length, 0, "Discharge must not create local hydraulics");
});

test("Sacramento navigation resolves to its first immersive scene and retains separate history", async () => {
  const river = JSON.parse(await readFile(new URL("../../river.json", base), "utf8"));
  assert.equal(riverDestination(river), "./renderer/freeport.html");
  await access(new URL(river.scenes[0].entry, new URL("../../river.json", base)));
  const html = await readFile(new URL("../../../../renderer/freeport.html", base), "utf8");
  assert.ok(html.includes("../river.html?river=sacramento_river"));
  assert.ok(html.includes("photo-informed") && html.includes("approximately 7.7 m"));
});
