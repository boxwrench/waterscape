import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { decodeRiverTerrain } from "../../river-pulse/renderer/terrain.js";
import { EEL_CAMERAS, reviewCamera, clippedWaterTriangle, mappedRiverAt } from "../../river-pulse/renderer/eel-layout.js";
const root = new URL("../../river-pulse/data/eel_river/places/scotia_bluffs/", import.meta.url);
const json = async file => JSON.parse(await readFile(new URL(file, root), "utf8"));

test("Eel geographic terrain and fixed review cameras retain native elevations and clearance", async () => {
  const meta = await json("terrain.json"), zipped = await readFile(new URL("terrain.bin.gz", root)), raw = gunzipSync(zipped),
    terrain = decodeRiverTerrain(meta, raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  assert.equal(meta.crs, "EPSG:32610"); assert.equal(terrain.verticalOffset, 0);
  assert.ok(terrain.elevationCells.every(Number.isFinite));
  for (const id of Object.keys(EEL_CAMERAS)) {
    const camera = reviewCamera(id, terrain), [x, y, z] = camera.position;
    assert.ok(camera.position.every(Number.isFinite)); assert.ok(camera.target.every(Number.isFinite));
    assert.ok(y >= terrain.ground(x, z) + 1.7, `${id} intersects terrain`);
    assert.ok(x >= terrain.x0 && x <= terrain.x0 + terrain.cellX * (terrain.width - 1));
    assert.ok(z >= terrain.z0 && z <= terrain.z0 + terrain.cellZ * (terrain.height - 1));
  }
  assert.deepEqual(reviewCamera("shore", terrain), reviewCamera("shore", terrain));
});

test("clipped water edges stay on the original terrain triangle plane", () => {
  // Bilinear height differs from this triangle plane. Interpolate height on its edges
  // to prevent land punching through clipped water, the observed runtime defect.
  const vertices = [{ x: 0, z: 0, y: 10, w: 1 }, { x: 0, z: 10, y: 30, w: 0 }, { x: 10, z: 0, y: 20, w: 0 }],
    polygon = clippedWaterTriangle(vertices);
  assert.equal(polygon.length, 3);
  for (const p of polygon) assert.ok(Math.abs(p.y - (10 + p.x + p.z * 2)) < 1e-10);
  assert.equal(clippedWaterTriangle(vertices.map(p => ({ ...p, w: 0 }))).length, 0);
  assert.equal(clippedWaterTriangle(vertices.map(p => ({ ...p, w: 1 }))).length, 3);
});

test("waterbody holes remain dry and Eel study cannot claim gauge capabilities", async () => {
  const polygons = [{ properties: { featuretypelabel: "River" }, rings: [
    [[0, 0], [20, 0], [20, 20], [0, 20]], [[5, 5], [15, 5], [15, 15], [5, 15]],
  ] }];
  assert.equal(mappedRiverAt(2, 2, polygons), true);
  assert.equal(mappedRiverAt(10, 10, polygons), false);
  assert.equal(mappedRiverAt(21, 21, polygons), false);
  const manifest = await json("place.json"), bodies = await json("waterbodies.json");
  assert.deepEqual(manifest.data_bindings, []);
  assert.ok(!manifest.supported_capabilities.some(c => /discharge|stage|velocity/.test(c)));
  assert.ok(bodies.polygons.some(p => p.properties.featuretypelabel === "River"));
  assert.ok(bodies.polygons.flatMap(p => p.rings.flat()).every(p => p.every(Number.isFinite)));
});
