import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { decodeRiverTerrain } from "../../river-pulse/renderer/terrain.js";
import { FREEPORT_VIEWS, freeportChannel, freeportGround, constrainFreeportCamera } from "../../river-pulse/renderer/freeport-layout.js";
import { freeportDischarge } from "../../river-pulse/visual-bindings/freeport-discharge.js";
import { parseLatestContinuousFeature } from "../../river-pulse/adapters/usgs.js";
import { riverDestination } from "../../river-pulse/data-model/overview-navigation.js";

import * as THREE from "../../vendor/three/three.webgpu.js";
import { createFreeportBridge } from "../../river-pulse/renderer/freeport-bridge.js";
import { FREEPORT_BRIDGE, FREEPORT_BRIDGE_ANGLES, bridgeToWorld, worldToBridge, freeportBridgeCamera } from "../../river-pulse/renderer/freeport-bridge-layout.js";
import { freeportLeveeRoad, freeportMarinaLayout } from "../../river-pulse/renderer/freeport-riverfront-layout.js";

const base = new URL("../../river-pulse/data/sacramento_river/places/freeport/", import.meta.url),
  json = async file => JSON.parse(await readFile(new URL(file, base), "utf8"));

test("Freeport bank, road and underside cameras stay in their intended domains", () => {
  for (const angle of Object.keys(FREEPORT_BRIDGE_ANGLES)) for (const portrait of [false, true]) {
    const camera = freeportBridgeCamera(angle, portrait);
    for (const [x, z] of [[camera.x, camera.z], [-10000, 10000], [10000, -10000], [0, 150]]) {
      const state = constrainFreeportCamera({ ...camera, angle, x, z }, "bridge");
      assert.ok([state.x, state.y, state.z].every(Number.isFinite));
      const local = worldToBridge(state.x, state.z), channel = freeportChannel(state.z);
      if (angle === "east" || angle === "west") {
        assert.ok(Math.abs(local.z) <= 2.80001);
        assert.equal(state.y, FREEPORT_BRIDGE.deckY + 1.7);
      } else if (angle === "above") {
        assert.ok(Math.abs(local.x) <= 160.001 && Math.abs(local.z) <= 500.001);
        assert.ok(state.y >= 30 && state.y <= 240);
      } else if (angle === "underside") {
        assert.ok(local.x >= 23.999 && local.x <= 64.001);
        assert.ok(local.z >= 13.999 && local.z <= 44.001);
        assert.equal(state.y, 1.6);
      } else {
        assert.ok(Math.abs(state.x - channel.center) >= channel.halfWidth + 3.999);
        assert.ok(freeportGround(state.x, state.z) > 0);
        assert.ok(state.y >= freeportGround(state.x, state.z) + 1.799);
        assert.equal(state.z < -100, angle.includes("north"));
        assert.equal(state.x < channel.center, angle.includes("west"));
      }
    }
  }
  for (const position of [FREEPORT_VIEWS.bank, { x: -10000, z: 10000 }, { x: 10000, z: -10000 }]) {
    const bank = constrainFreeportCamera({ ...FREEPORT_VIEWS.bank, ...position }, "bank");
    assert.ok(bank.z >= -490 && bank.z <= 420);
    assert.ok(bank.x >= freeportChannel(bank.z).center + freeportChannel(bank.z).halfWidth + 4);
    assert.ok(bank.y >= freeportGround(bank.x, bank.z) + 1.799);
  }
});

test("Freeport marina stays on water and levee roads follow dry ground", () => {
  for (const side of [-1, 1]) for (let z = -1600; z <= 1600; z += 37) {
    const road = freeportLeveeRoad(side, z);
    assert.ok(freeportGround(road.x, road.z) > 0);
    assert.ok(road.y > freeportGround(road.x, road.z));
  }
  const marina = freeportMarinaLayout();
  for (const roof of marina.roofs) for (const z of [roof.z0, roof.z1]) {
    assert.ok(freeportGround(roof.x - roof.width / 2, z) < 0);
    assert.ok(freeportGround(roof.x + roof.width / 2, z) < 0);
  }
  for (const boat of marina.boats) {
    assert.ok(freeportGround(boat.x - boat.length / 2, boat.z) < 0);
    assert.ok(freeportGround(boat.x + boat.length / 2, boat.z) < 0);
  }
});

test("Freeport reconstruction has finite, bounded 3D structure for every angle", () => {
  const bridge = createFreeportBridge(), bounds = new THREE.Box3().setFromObject(bridge);
  assert.ok(bridge.children.length < 20, "Detailed steel must be batched to avoid thousands of draw calls");
  assert.ok(bounds.max.y > 20 && bounds.max.y < 23, "Counterweight towers must rise above fixed trusses");
  assert.ok(bounds.min.y < 0, "Pier/fender piles extend below the illustrative waterline");
  let vertices = 0;
  for (const mesh of bridge.children) {
    assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
    assert.ok(mesh.geometry.attributes.normal.array.every(Number.isFinite));
    vertices += mesh.geometry.attributes.position.count;
  }
  assert.ok(vertices > 10000, "The bridge must include its three-dimensional member detail");
  for (const p of [[0, 0, 0], [91, 7.9, -2], [-83, 7.9, 2]]) {
    const world = bridgeToWorld(...p), local = worldToBridge(world.x, world.z);
    assert.ok(Math.abs(local.x - p[0]) < 1e-10 && Math.abs(local.z - p[2]) < 1e-10);
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
