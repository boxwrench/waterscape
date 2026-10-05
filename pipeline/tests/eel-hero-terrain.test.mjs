import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { buildRiverTerrainGrid } from "../../river-pulse/scene-kit/terrain-mesh.js";
import { decodeRiverTerrain } from "../../river-pulse/scene-kit/terrain.js";
import { buildEelHeroLand, createHeroGroundSampler, heroGround } from "../../river-pulse/rivers/eel_river/scenes/end/scotia_bluffs/eel-hero-terrain.js";

const eelData = new URL("../../river-pulse/rivers/eel_river/scenes/end/scotia_bluffs/data/", import.meta.url);

function loadTerrainBundle(name) {
  const meta = JSON.parse(readFileSync(new URL(`${name}.json`, eelData), "utf8")),
    zipped = readFileSync(new URL(`${name}.bin.gz`, eelData)), raw = gunzipSync(zipped);
  return { meta, terrain: decodeRiverTerrain(meta, raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)) };
}

function makeTerrain({ x0 = 0, z0 = 0, cell = 10, width = 9, height = 9, elevation = () => 0,
  verticalOffset = 0, coverage = null } = {}) {
  const gridOrigin = coverage ? [coverage.x0, coverage.z0] : [x0, z0],
    cellSize = coverage?.cell ?? cell, cols = coverage?.width ?? width, rows = coverage?.height ?? height,
    cells = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++)
    cells[j * cols + i] = elevation(gridOrigin[0] + i * cellSize, gridOrigin[1] + j * cellSize);
  const meta = { crs: "EPSG:32610", utmZone: 10, verticalDatum: "NAVD88 metres", sceneVerticalOffset: verticalOffset },
    terrain = {
      width: cols, height: rows, x0: gridOrigin[0], z0: gridOrigin[1], cellX: cellSize, cellZ: cellSize,
      verticalOffset, meta, elevationCells: cells,
      sampleElevation(x, z) {
        const gx = Math.max(0, Math.min(cols - 1.000001, (x - gridOrigin[0]) / cellSize)),
          gz = Math.max(0, Math.min(rows - 1.000001, (z - gridOrigin[1]) / cellSize)),
          i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j,
          at = (xx, zz) => cells[zz * cols + xx],
          top = at(i, j) + (at(i + 1, j) - at(i, j)) * u,
          bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * u;
        return top + (bottom - top) * v;
      },
      ground(x, z) { return this.sampleElevation(x, z) - verticalOffset; },
    };
  return terrain;
}

function fieldFor(terrain, wetValue = 0) {
  const wet = new Float32Array(terrain.width * terrain.height).fill(wetValue),
    colors = new Float32Array(wet.length * 3);
  for (let j = 0; j < terrain.height; j++) for (let i = 0; i < terrain.width; i++) {
    const k = (j * terrain.width + i) * 3;
    colors.set([i / (terrain.width - 1), j / (terrain.height - 1), 0.25], k);
  }
  return { wet, colors };
}

function heroFor(terrain, { x0 = 20.25, z0 = 20.25, width = 41, height = 41,
  elevation = () => 100, verticalOffset = 0 } = {}) {
  return makeTerrain({ coverage: { x0, z0, width, height, cell: 1 }, elevation, verticalOffset });
}

test("snaps patch inward to coarse cell edges and removes only covered base cells", () => {
  const terrain = makeTerrain(), hero = heroFor(terrain), field = fieldFor(terrain), base = buildRiverTerrainGrid(terrain),
    result = buildEelHeroLand(terrain, hero, field, base, { step: 4 });
  assert.deepEqual(result.bounds, { minX: 30, maxX: 60, minZ: 30, maxZ: 60, col0: 3, col1: 6, row0: 3, row1: 6 });
  assert.equal(result.positions.length / 3, 81);
  assert.equal(result.indices.length / 3, 128);
  assert.equal(base.indices.length - result.baseIndices.length, 3 * 3 * 6);
  assert.equal(result.meta.meshStepMetres, 4);
  assert.deepEqual(result.meta.sourceCellMetres, [1, 1]);
  assert.equal(result.meta.seamWidthMetres, 20);
});

test("keeps patch edges on the base triangulation and fades source elevation across two coarse cells", () => {
  const terrain = makeTerrain(), hero = heroFor(terrain), field = fieldFor(terrain), base = buildRiverTerrainGrid(terrain),
    result = buildEelHeroLand(terrain, hero, field, base, { step: 2 }),
    edge = result.positions.findIndex((_, i) => i % 3 === 0 && result.positions[i] === 30 && result.positions[i + 2] === 40);
  assert.notEqual(edge, -1);
  assert.equal(result.positions[edge + 1], 0, "the source weight is zero at the aligned patch edge");
  assert.equal(heroGround(terrain, hero, field, 40, 45), 50, "half the source change remains halfway through the seam");
  assert.equal(heroGround(terrain, hero, field, 45, 45), 84.375, "a narrow patch retains a smooth seam across its full interior");
});

test("wet vertices and the 0.5 neighbour guard preserve base ground beneath water contact", () => {
  const terrain = makeTerrain(), hero = heroFor(terrain), field = fieldFor(terrain), base = buildRiverTerrainGrid(terrain);
  field.wet[4 * terrain.width + 4] = 0.35;
  assert.ok(Math.abs(heroGround(terrain, hero, field, 40, 40) - 25) < 1e-5, "wet values fade source displacement from 0.2 to 0.5");
  field.wet.fill(0); field.wet[3 * terrain.width + 3] = 0.6;
  assert.equal(heroGround(terrain, hero, field, 40, 40), 0, "a nearby refined-wet value at or above 0.5 protects the edge");
  const result = buildEelHeroLand(terrain, hero, field, base, { step: 2 });
  const k = (40 - 30) / 2 * 16 + (40 - 30) / 2;
  assert.equal(result.positions[k * 3 + 1], 0);
});

test("uses the base mesh diagonal in the transition instead of bilinear ground", () => {
  const elevations = [[0, 0, 0, 0], [0, 10, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    terrain = makeTerrain({ width: 4, height: 4, elevation: (x, z) => elevations[z / 10][x / 10] }),
    hero = heroFor(terrain, { x0: 0, z0: 0, width: 31, height: 31, elevation: () => 100 }),
    field = fieldFor(terrain, 0.8);
  const sample = heroGround(terrain, hero, field, 7.5, 7.5), bilinear = terrain.ground(7.5, 7.5);
  assert.equal(sample, 5);
  assert.equal(bilinear, 5.625);
});

test("interpolates coarse colors and aerial UVs in the original terrain frame", () => {
  const terrain = makeTerrain(), hero = heroFor(terrain), field = fieldFor(terrain), base = buildRiverTerrainGrid(terrain),
    result = buildEelHeroLand(terrain, hero, field, base, { step: 10 }), k = result.positions.findIndex((_, i) => i % 3 === 0 && result.positions[i] === 40 && result.positions[i + 2] === 50),
    vertex = k / 3;
  assert.ok(k >= 0);
  assert.deepEqual([...result.colors.slice(vertex * 3, vertex * 3 + 3)], [0.5, 0.625, 0.25]);
  assert.ok(Math.abs(result.uv[vertex * 2] - 0.5) < 1e-7);
  assert.ok(Math.abs(result.uv[vertex * 2 + 1] - (1 - 5.5 / 9)) < 1e-7);
});

test("ground sampler validates once and preserves original terrain outside hero bounds", () => {
  let groundCalls = 0;
  const terrain = makeTerrain(), originalGround = terrain.ground.bind(terrain);
  terrain.ground = (x, z) => { groundCalls++; return originalGround(x, z); };
  const hero = heroFor(terrain), field = fieldFor(terrain), sampler = createHeroGroundSampler(terrain, hero, field);
  const afterCreation = groundCalls;
  assert.equal(sampler.sample(100, 100), originalGround(100, 100));
  assert.equal(sampler.sample(45, 45), 84.375);
  assert.equal(sampler.sample(45, 45), 84.375);
  assert.ok(groundCalls - afterCreation < 20, "each sample does bounded terrain interpolation without rescanning the wet field");
  assert.deepEqual(sampler.bounds, { minX: 30, maxX: 60, minZ: 30, maxZ: 60, col0: 3, col1: 6, row0: 3, row1: 6 });
});

test("preserves upward winding, handles absent coverage, and rejects incompatible inputs", () => {
  const terrain = makeTerrain(), field = fieldFor(terrain), base = buildRiverTerrainGrid(terrain),
    hero = heroFor(terrain), result = buildEelHeroLand(terrain, hero, field, base, { step: 4 }),
    [a, b, c] = [...result.indices.slice(0, 3)].map(id => [result.positions[id * 3], result.positions[id * 3 + 1], result.positions[id * 3 + 2]]),
    normalY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  assert.ok(normalY > 0);
  assert.equal(buildEelHeroLand(terrain, heroFor(terrain, { x0: 100, z0: 100 }), field, base), null);
  assert.throws(() => buildEelHeroLand(terrain, hero, field, base, { step: 0 }), /step must be finite and positive/);
  assert.throws(() => buildEelHeroLand(terrain, { ...hero, meta: { ...hero.meta, crs: "EPSG:32611" } }, field, base), /same projected CRS/);
  assert.throws(() => heroGround(terrain, hero, { wet: field.wet }, 40, 40), /RGB field arrays/);
});

test("checked-in hero crop decodes as valid native 1 m terrain in the Eel scene frame", () => {
  const { meta: baseMeta, terrain: base } = loadTerrainBundle("terrain"),
    { meta, terrain: hero } = loadTerrainBundle("hero-terrain");
  assert.equal(meta.schemaVersion, "river-pulse-terrain-0.1");
  assert.equal(meta.sourceCrs, "EPSG:26910");
  assert.equal(meta.crs, baseMeta.crs); assert.equal(meta.crs, "EPSG:32610");
  assert.equal(meta.utmZone, baseMeta.utmZone); assert.equal(meta.utmZone, 10);
  assert.deepEqual(meta.originUTM, baseMeta.originUTM);
  assert.equal(meta.sourceVerticalDatum, "NAVD88 metres");
  assert.equal(meta.verticalOrigin.datum, baseMeta.verticalOrigin.datum);
  assert.equal(meta.verticalOrigin.datum, "NAVD88");
  assert.match(meta.sourceUrl, /^https:\/\/prd-tnm\.s3\.amazonaws\.com\/.+\.tif$/);
  assert.match(meta.sourceLicense, /public domain/i);
  assert.deepEqual(meta.sourceResolutionMetres, [1, 1]);
  assert.deepEqual(meta.cell, [1, 1]);
  assert.deepEqual([meta.width, meta.height], [800, 750]);
  assert.deepEqual(meta.sourceCropPixelWindow, { columnStart: 7408, rowStart: 5365, width: 800, height: 750 });
  assert.equal(meta.nativeValues.validCells, meta.width * meta.height);
  assert.equal(meta.nativeValues.nodataCells, 0);
  assert.equal(hero.elevationCells.length, 600_000);
  assert.ok(hero.elevationCells.every(Number.isFinite));
  const [minElevation, maxElevation] = hero.elevationCells.reduce(([min, max], value) =>
    [Math.min(min, value), Math.max(max, value)], [Infinity, -Infinity]);
  assert.ok(minElevation >= meta.nativeValues.min - 0.051);
  assert.ok(maxElevation <= meta.nativeValues.max + 0.051);
  assert.ok(minElevation > 0 && maxElevation < 300);
  // The raw nearest cells are recorded from the source tile; these camera coordinates fall
  // between cells, so sampleElevation's bilinear output is separately pinned below.
  for (const [x, z, expectedCell] of [[1100, -1300, 155.95], [1140, -1470, 174.20], [920, -1220, 19.80]]) {
    const i = Math.round((x - hero.x0) / hero.cellX), j = Math.round((z - hero.z0) / hero.cellZ);
    assert.ok(Math.abs(hero.elevationCells[j * hero.width + i] - expectedCell) <= 0.025);
  }
  for (const [x, z, expectedInterpolated] of [[1100, -1300, 155.7813], [1140, -1470, 174.5088], [920, -1220, 19.6831]])
    assert.ok(Math.abs(hero.sampleElevation(x, z) - expectedInterpolated) <= 0.005,
      `bilinear source-grid sample at ${x},${z} matches ${expectedInterpolated} m`);
  for (const [x, z] of [[1100, -1300], [1140, -1470], [920, -1220], [710, -1320], [835, -1180]]) {
    assert.ok(x >= hero.x0 && x <= hero.x0 + (hero.width - 1) * hero.cellX, `x=${x} is covered`);
    assert.ok(z >= hero.z0 && z <= hero.z0 + (hero.height - 1) * hero.cellZ, `z=${z} is covered`);
    assert.ok(Number.isFinite(hero.sampleElevation(x, z)), `sample at ${x},${z} is valid`);
  }
});

test("actual hero crop respects 2 m eye/shore and 4 m other-view geometry budgets without mutating source arrays", () => {
  const { terrain: base } = loadTerrainBundle("terrain"), { terrain: hero } = loadTerrainBundle("hero-terrain"),
    wet = new Float32Array(base.width * base.height), colors = new Float32Array(base.width * base.height * 3).fill(0.4),
    field = { wet, colors }, grid = buildRiverTerrainGrid(base),
    baseBefore = base.elevationCells.slice(), heroBefore = hero.elevationCells.slice(),
    wetBefore = wet.slice(), colorsBefore = colors.slice(), positionsBefore = grid.positions.slice(), indicesBefore = grid.indices.slice(),
    patch4 = buildEelHeroLand(base, hero, field, grid, { step: 4 }), patch2 = buildEelHeroLand(base, hero, field, grid, { step: 2 });

  for (const [patch, step, maxVertices] of [[patch4, 4, 45_000], [patch2, 2, 175_000]]) {
    assert.ok(patch);
    assert.equal(patch.meta.meshStepMetres, step);
    assert.deepEqual(patch.meta.sourceCellMetres, [1, 1]);
    assert.equal(patch.meta.horizontalCrs, "EPSG:32610");
    assert.ok(patch.positions.length / 3 <= maxVertices);
    const columns = new Set(Array.from({ length: patch.positions.length / 3 }, (_, i) => patch.positions[i * 3])).size,
      rows = new Set(Array.from({ length: patch.positions.length / 3 }, (_, i) => patch.positions[i * 3 + 2])).size;
    assert.equal(patch.positions.length / 3, columns * rows);
    assert.equal(patch.indices.length, (columns - 1) * (rows - 1) * 6);
    assert.ok(patch.indices.every(index => index < patch.positions.length / 3));
    assert.ok(patch.positions.every(Number.isFinite));
    assert.ok(patch.indices.length / 3 <= maxVertices * 2);
    assert.ok(patch.bounds.minX >= hero.x0 && patch.bounds.maxX <= hero.x0 + (hero.width - 1) * hero.cellX);
    assert.ok(patch.bounds.minZ >= hero.z0 && patch.bounds.maxZ <= hero.z0 + (hero.height - 1) * hero.cellZ);
  }
  assert.ok(patch2.positions.length > patch4.positions.length);
  assert.deepEqual(base.elevationCells, baseBefore);
  assert.deepEqual(hero.elevationCells, heroBefore);
  assert.deepEqual(wet, wetBefore); assert.deepEqual(colors, colorsBefore);
  assert.deepEqual(grid.positions, positionsBefore); assert.deepEqual(grid.indices, indicesBefore);
});
