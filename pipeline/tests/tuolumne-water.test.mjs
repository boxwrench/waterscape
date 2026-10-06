import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { buildTuolumneWaterGeometry, createTuolumneWater,
  buildTuolumneContactPositions, tuolumneTerrainSurfaceGround } from "../../river-pulse/rivers/tuolumne_river/scenes/middle/poopenaut_valley/tuolumne-water.js";
import { decodeRiverTerrain } from "../../river-pulse/scene-kit/terrain.js";
import { buildRiverTerrainGrid } from "../../river-pulse/scene-kit/terrain-mesh.js";

test("Tuolumne ribbon follows the source line and clips against a sloped dry bank", () => {
  const terrain = { x0: -50, z0: -80, width: 101, height: 161, cellX: 1, cellZ: 1,
    ground(x, z) { return Math.abs(x) < 10 ? 0 : 3 + Math.abs(x) * 0.1; } },
    grid = buildTuolumneWaterGeometry(terrain, { lines: [[[0, -70], [0, 70]]] },
      { focusXZ: [0, 0], radius: 30, halfWidth: 20, stationSpacing: 3, crossSpacing: 2, surfaceLift: 0.5 });
  assert.ok(grid);
  assert.ok(grid.positions.length / 3 > 100);
  assert.ok(grid.indices.length / 3 > 50);
  assert.equal(grid.depths.length * 3, grid.positions.length);
  assert.ok(grid.indices.every((id) => id < grid.depths.length));
  for (let i = 0; i < grid.positions.length; i += 3) {
    assert.ok(Math.abs(grid.positions[i]) <= 10.01, "clipped vertices stay inside the low channel");
    assert.ok(grid.positions[i + 1] >= tuolumneTerrainSurfaceGround(terrain, grid.positions[i], grid.positions[i + 2]));
  }
  const [a, b, c] = grid.indices.slice(0, 3), p = (i) => [grid.positions[i * 3], grid.positions[i * 3 + 1], grid.positions[i * 3 + 2]],
    ab = p(b).map((v, i) => v - p(a)[i]), ac = p(c).map((v, i) => v - p(a)[i]),
    normalY = ab[2] * ac[0] - ab[0] * ac[2];
  assert.ok(normalY > 0, "surface triangles face upward for front-side water rendering");
  assert.ok(grid.depths.some((depth) => depth === 0));
  assert.ok(grid.depths.some((depth) => depth > 0.5));
  assert.equal(grid.reflectionSuitable, true);
  assert.match(grid.representation, /not measured width, stage or bathymetry/);
});

test("Tuolumne ribbon validates source data and leaves terrain untouched", () => {
  const terrain = { x0: -10, z0: -10, width: 21, height: 21, cellX: 1, cellZ: 1,
    ground() { return 0; } }, before = [terrain.x0, terrain.z0, terrain.width, terrain.height],
    lines = [[[0, -5], [0, 5]]];
  assert.throws(() => buildTuolumneWaterGeometry(terrain, { lines }, { halfWidth: Infinity }), /finite and positive/);
  assert.throws(() => buildTuolumneWaterGeometry(terrain, { lines: [[[0, NaN]]] }), /finite mapped centerline/);
  assert.deepEqual([terrain.x0, terrain.z0, terrain.width, terrain.height], before);
  assert.equal(buildTuolumneWaterGeometry(terrain, { lines: [[[40, 40], [45, 45]]] }), null);
});

test("study contact cut is copied, bounded under the ribbon, and reports its authored depth", () => {
  const terrain = { x0: -10, z0: -10, width: 21, height: 21, cellX: 1, cellZ: 1,
    ground() { return 0; } }, width = terrain.width + 2, height = terrain.height + 2,
    source = new Float32Array(width * height * 3);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const k = (j * width + i) * 3;
    source[k] = terrain.x0 + (i - 1); source[k + 1] = i === 0 || j === 0 || i === width - 1 || j === height - 1 ? -150 : 0;
    source[k + 2] = terrain.z0 + (j - 1);
  }
  const before = source.slice(), water = { halfWidth: 2,
      centerlineParts: [Array.from({ length: 11 }, (_, i) => ({ x: 0, y: 0.35, z: -5 + i }))] },
    cut = buildTuolumneContactPositions(terrain, source, water);
  assert.notEqual(cut.positions, source);
  assert.deepEqual(source, before);
  assert.ok(cut.changedCount > 0);
  assert.ok(cut.maxCut <= 0.451);
  assert.equal(cut.maxLowering, 1);
  assert.ok(cut.cutBounds[0] >= -3 && cut.cutBounds[2] <= 3);
  assert.ok(cut.cutBounds[1] >= -6 && cut.cutBounds[3] <= 6);
  assert.match(cut.representation, /not bathymetry/);
  assert.throws(() => buildTuolumneContactPositions(terrain, source, water,
    { contactHalfWidth: 4 }), /one-cell transition/);
});

test("bundled Poopenaut source builds bounded, DEM-clipped illustrative water", () => {
  const base = new URL("../../river-pulse/rivers/tuolumne_river/scenes/middle/poopenaut_valley/data/", import.meta.url),
    meta = JSON.parse(readFileSync(new URL("terrain.json", base))),
    compressed = gunzipSync(readFileSync(new URL("terrain.bin.gz", base))),
    terrain = decodeRiverTerrain(meta, compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength)),
    layout = JSON.parse(readFileSync(new URL("layout.json", base))),
    grid = buildTuolumneWaterGeometry(terrain, layout);
  assert.ok(grid);
  assert.ok(grid.stationCount > 100);
  assert.ok(grid.indices.length / 3 > 500);
  assert.ok(grid.positions.length / 3 < 100_000);
  assert.ok(grid.heightRange.every(Number.isFinite));
  assert.ok(grid.heightRange[1] >= grid.heightRange[0]);
  assert.equal(grid.reflectionSuitable, false, "the 79 m valley reach cannot share one horizontal mirror plane");
  assert.ok(grid.heightRange[1] - grid.heightRange[0] > 70);
  let maxBilinearOvershoot = 0, countBilinearOcclusionRisk = 0;
  for (let i = 0; i < grid.positions.length; i += 3) {
    assert.ok(Math.hypot(grid.positions[i] - 700, grid.positions[i + 2] - 1100) <= 1940.1,
      "rendered ribbon remains within its bounded centerline ROI plus bank width");
    const bilinearDifference = terrain.ground(grid.positions[i], grid.positions[i + 2]) -
      tuolumneTerrainSurfaceGround(terrain, grid.positions[i], grid.positions[i + 2]);
    maxBilinearOvershoot = Math.max(maxBilinearOvershoot, bilinearDifference);
    if (bilinearDifference > 0.35) countBilinearOcclusionRisk++;
    assert.ok(grid.positions[i + 1] >= tuolumneTerrainSurfaceGround(terrain, grid.positions[i], grid.positions[i + 2]) - 0.01);
  }
  for (let i = 0; i < grid.indices.length; i += 3) {
    const ids = grid.indices.slice(i, i + 3),
      x = ids.reduce((sum, id) => sum + grid.positions[id * 3], 0) / 3,
      y = ids.reduce((sum, id) => sum + grid.positions[id * 3 + 1], 0) / 3,
      z = ids.reduce((sum, id) => sum + grid.positions[id * 3 + 2], 0) / 3;
    assert.ok(tuolumneTerrainSurfaceGround(terrain, x, z) <= y + 0.001,
      "rendered triangle centroids stay above the matching land facet");
  }
  const landGrid = buildRiverTerrainGrid(terrain), beforeLand = landGrid.positions.slice(),
    contact = buildTuolumneContactPositions(terrain, landGrid.positions, grid),
    water = createTuolumneWater(terrain, layout.lines);
  assert.notEqual(contact.positions, landGrid.positions);
  assert.deepEqual(landGrid.positions, beforeLand);
  assert.ok(contact.changedCount > 0);
  assert.ok(contact.maxCut <= 1);
  assert.ok(contact.contactHalfWidth <= grid.halfWidth + Math.max(terrain.cellX, terrain.cellZ));
  assert.match(contact.representation, /not bathymetry/);
  assert.ok(water.mesh.visible);
  assert.equal(water.reflectionEnabled, false);
  assert.equal(water.reflectionDepthEnabled, false);
  assert.equal(water.reflectionMode, "analytic sky");
  assert.equal(water.geometryBytes, water.mesh.geometry.getAttribute("position").array.byteLength +
    water.mesh.geometry.getAttribute("opticalDepth").array.byteLength + water.mesh.geometry.index.array.byteLength);
  assert.ok(maxBilinearOvershoot > 2.5, "coarse-cell bilinear height differs materially from rendered land facets");
  assert.ok(countBilinearOcclusionRisk > 1000);
  assert.match(grid.representation, /illustrative/);
  console.log(`Poopenaut illustrative water: ${grid.stationCount} stations, ${grid.positions.length / 3} vertices, ${grid.indices.length / 3} triangles, surface ${grid.heightRange[0].toFixed(2)}–${grid.heightRange[1].toFixed(2)} m scene y; bilinear overshoot max ${maxBilinearOvershoot.toFixed(2)} m at ${countBilinearOcclusionRisk} vertices; study contact cut ${contact.changedCount} vertices, max ${contact.maxCut.toFixed(2)} m.`);
});
