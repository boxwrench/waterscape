const WET_FADE_START = 0.2, WET_FADE_END = 0.5, SEAM_COARSE_CELLS = 2;

function validateTerrain(terrain, label) {
  if (!terrain || !Number.isInteger(terrain.width) || !Number.isInteger(terrain.height) ||
      terrain.width < 2 || terrain.height < 2 || ![terrain.x0, terrain.z0, terrain.cellX, terrain.cellZ].every(Number.isFinite) ||
      terrain.cellX <= 0 || terrain.cellZ <= 0 || typeof terrain.ground !== "function")
    throw new Error(`${label} terrain grid is invalid.`);
}

function smoothstep(a, b, value) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function compatibleFrames(terrain, hero) {
  const a = terrain.meta ?? {}, b = hero.meta ?? {};
  if (a.crs && b.crs && a.crs !== b.crs) throw new Error("Hero and base terrain must use the same projected CRS.");
  if (Number.isFinite(a.utmZone) && Number.isFinite(b.utmZone) && a.utmZone !== b.utmZone)
    throw new Error("Hero and base terrain must use the same UTM zone.");
  const datum = (meta) => String(meta.verticalOrigin?.datum ?? meta.verticalDatum ?? "").toUpperCase().match(/NAVD88/)?.[0] ?? null,
    baseDatum = datum(a), heroDatum = datum(b);
  if (baseDatum && heroDatum && baseDatum !== heroDatum)
    throw new Error("Hero and base terrain must use the same vertical datum.");
}

function alignedBounds(terrain, hero) {
  const baseMaxX = terrain.x0 + (terrain.width - 1) * terrain.cellX,
    baseMaxZ = terrain.z0 + (terrain.height - 1) * terrain.cellZ,
    heroMaxX = hero.x0 + (hero.width - 1) * hero.cellX,
    heroMaxZ = hero.z0 + (hero.height - 1) * hero.cellZ,
    epsilon = 1e-7,
    x0 = Math.max(0, Math.ceil((Math.max(terrain.x0, hero.x0) - terrain.x0) / terrain.cellX - epsilon)),
    x1 = Math.min(terrain.width - 1, Math.floor((Math.min(baseMaxX, heroMaxX) - terrain.x0) / terrain.cellX + epsilon)),
    z0 = Math.max(0, Math.ceil((Math.max(terrain.z0, hero.z0) - terrain.z0) / terrain.cellZ - epsilon)),
    z1 = Math.min(terrain.height - 1, Math.floor((Math.min(baseMaxZ, heroMaxZ) - terrain.z0) / terrain.cellZ + epsilon));
  if (x1 <= x0 || z1 <= z0) return null;
  return {
    minX: terrain.x0 + x0 * terrain.cellX,
    maxX: terrain.x0 + x1 * terrain.cellX,
    minZ: terrain.z0 + z0 * terrain.cellZ,
    maxZ: terrain.z0 + z1 * terrain.cellZ,
    col0: x0, col1: x1, row0: z0, row1: z1,
  };
}

// Match buildRiverTerrainGrid's two triangles: TL-BL-TR, then TR-BL-BR.
function triangulatedGround(terrain, x, z) {
  const gx = Math.max(0, Math.min(terrain.width - 1.000001, (x - terrain.x0) / terrain.cellX)),
    gz = Math.max(0, Math.min(terrain.height - 1.000001, (z - terrain.z0) / terrain.cellZ)),
    i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j,
    x0 = terrain.x0 + i * terrain.cellX, z0 = terrain.z0 + j * terrain.cellZ,
    tl = terrain.ground(x0, z0), tr = terrain.ground(x0 + terrain.cellX, z0),
    bl = terrain.ground(x0, z0 + terrain.cellZ), br = terrain.ground(x0 + terrain.cellX, z0 + terrain.cellZ);
  return u + v <= 1
    ? tl * (1 - u - v) + bl * v + tr * u
    : tr * (1 - v) + bl * (1 - u) + br * (u + v - 1);
}

function array2dSample(values, width, height, channels, gx, gz, channel = 0) {
  const x = Math.max(0, Math.min(width - 1.000001, gx)), z = Math.max(0, Math.min(height - 1.000001, gz)),
    i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j,
    at = (xx, zz) => values[(zz * width + xx) * channels + channel],
    top = at(i, j) + (at(i + 1, j) - at(i, j)) * u,
    bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * u;
  return top + (bottom - top) * v;
}

function wetRisk(fieldWet, terrain, x, z) {
  const gx = Math.max(0, Math.min(terrain.width - 1.000001, (x - terrain.x0) / terrain.cellX)),
    gz = Math.max(0, Math.min(terrain.height - 1.000001, (z - terrain.z0) / terrain.cellZ)),
    i = Math.floor(gx), j = Math.floor(gz), center = array2dSample(fieldWet, terrain.width, terrain.height, 1, gx, gz);
  let neighbourMax = center;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const xIndex = i + dx, zIndex = j + dz;
    if (xIndex < 0 || xIndex >= terrain.width || zIndex < 0 || zIndex >= terrain.height) continue;
    neighbourMax = Math.max(neighbourMax, fieldWet[zIndex * terrain.width + xIndex]);
  }
  return neighbourMax;
}

function sourceElevation(hero, terrain, x, z) {
  const absolute = typeof hero.sampleElevation === "function"
    ? hero.sampleElevation(x, z)
    : hero.ground(x, z) + (hero.verticalOffset ?? hero.meta?.sceneVerticalOffset ?? 0);
  return absolute - (terrain.verticalOffset ?? terrain.meta?.sceneVerticalOffset ?? 0);
}

function groundAt(terrain, hero, fieldWet, bounds, x, z) {
  if (!bounds || x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return terrain.ground(x, z);
  const base = triangulatedGround(terrain, x, z);
  const edge = Math.min(x - bounds.minX, bounds.maxX - x, z - bounds.minZ, bounds.maxZ - z),
    seam = smoothstep(0, SEAM_COARSE_CELLS * Math.max(terrain.cellX, terrain.cellZ), edge),
    dry = 1 - smoothstep(WET_FADE_START, WET_FADE_END, wetRisk(fieldWet, terrain, x, z)),
    weight = seam * dry;
  if (weight <= 0) return base;
  return base + (sourceElevation(hero, terrain, x, z) - base) * weight;
}

function sampleAxis(start, end, step) {
  const values = [start];
  for (let value = start + step; value < end - 1e-7; value += step) values.push(value);
  if (end - values.at(-1) > 1e-7) values.push(end);
  return values;
}

function validateField(terrain, field) {
  const wet = field?.wet, colors = field?.colors, n = terrain.width * terrain.height;
  if (!wet || wet.length !== n || !colors || colors.length !== n * 3)
    throw new Error("Hero terrain needs refined wet and source-aligned RGB field arrays.");
  for (let i = 0; i < wet.length; i++) if (!Number.isFinite(wet[i]) || wet[i] < 0 || wet[i] > 1)
    throw new Error("Hero terrain wet field must contain finite values in [0, 1].");
  return { wet, colors };
}

function validateBaseGrid(terrain, baseGrid) {
  const width = terrain.width + 2, height = terrain.height + 2, vertexCount = width * height;
  if (!baseGrid?.positions || baseGrid.positions.length !== vertexCount * 3 ||
      !baseGrid.indices || baseGrid.indices.length !== (width - 1) * (height - 1) * 6)
    throw new Error("Base grid must be the padded buildRiverTerrainGrid mesh.");
}

/** Build a bounded, source-derived Eel land patch while retaining the existing wet edge. */
export function buildEelHeroLand(terrain, hero, field, baseGrid, { step = 2 } = {}) {
  validateTerrain(terrain, "Base"); validateTerrain(hero, "Hero"); compatibleFrames(terrain, hero);
  if (!Number.isFinite(step) || step <= 0) throw new Error("Hero mesh step must be finite and positive.");
  validateBaseGrid(terrain, baseGrid);
  const { wet, colors: sourceColors } = validateField(terrain, field), bounds = alignedBounds(terrain, hero);
  if (!bounds) return null;

  const xs = sampleAxis(bounds.minX, bounds.maxX, step), zs = sampleAxis(bounds.minZ, bounds.maxZ, step),
    columns = xs.length, rows = zs.length, positions = new Float32Array(columns * rows * 3),
    colors = new Float32Array(columns * rows * 3), uv = new Float32Array(columns * rows * 2), indices = new Uint32Array((columns - 1) * (rows - 1) * 6);
  let cursor = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const x = xs[i], z = zs[j], gx = (x - terrain.x0) / terrain.cellX, gz = (z - terrain.z0) / terrain.cellZ,
      k = j * columns + i, p = k * 3;
    positions.set([x, groundAt(terrain, hero, wet, bounds, x, z), z], p);
    for (let c = 0; c < 3; c++) colors[p + c] = array2dSample(sourceColors, terrain.width, terrain.height, 3, gx, gz, c);
    uv[k * 2] = (gx + 0.5) / terrain.width;
    uv[k * 2 + 1] = 1 - (gz + 0.5) / terrain.height;
  }
  const rowStride = columns;
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < columns - 1; i++) {
    const a = j * rowStride + i;
    indices.set([a, a + rowStride, a + 1, a + 1, a + rowStride, a + rowStride + 1], cursor); cursor += 6;
  }

  const baseIndices = [], meshWidth = terrain.width + 2, meshHeight = terrain.height + 2;
  for (let j = 0; j < meshHeight - 1; j++) for (let i = 0; i < meshWidth - 1; i++) {
    const coarseX = i - 1, coarseZ = j - 1,
      covered = coarseX >= bounds.col0 && coarseX < bounds.col1 && coarseZ >= bounds.row0 && coarseZ < bounds.row1;
    if (covered) continue;
    const a = j * meshWidth + i;
    baseIndices.push(a, a + meshWidth, a + 1, a + 1, a + meshWidth, a + meshWidth + 1);
  }

  return {
    positions, indices, colors, uv, baseIndices: new Uint32Array(baseIndices), bounds,
    meta: {
      source: hero.meta?.source ?? null,
      horizontalCrs: hero.meta?.crs ?? terrain.meta?.crs ?? null,
      verticalDatum: hero.meta?.verticalOrigin?.datum ?? hero.meta?.verticalDatum ?? null,
      sourceCellMetres: [hero.cellX, hero.cellZ],
      meshStepMetres: step,
      alignment: "patch bounds snapped inward to base-cell edges; base triangles inside are omitted",
      seamWidthMetres: SEAM_COARSE_CELLS * Math.max(terrain.cellX, terrain.cellZ),
      wetProtection: "source displacement fades to zero as refined wet max-neighbour approaches 0.5 from 0.2",
      elevationUse: "source-derived land form only; water-adjacent elevations retain the base terrain",
    },
  };
}

/** Sample the same bounded source/seam/wet blend used by the hero patch vertices. */
export function heroGround(terrain, hero, field, x, z) {
  return createHeroGroundSampler(terrain, hero, field).sample(x, z);
}

/** Validate once, then reuse for camera and vegetation samples on the source patch. */
export function createHeroGroundSampler(terrain, hero, field) {
  validateTerrain(terrain, "Base"); validateTerrain(hero, "Hero"); compatibleFrames(terrain, hero);
  const { wet } = validateField(terrain, field), bounds = alignedBounds(terrain, hero);
  return {
    bounds,
    sample(x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error("Hero ground coordinates must be finite.");
      return groundAt(terrain, hero, wet, bounds, x, z);
    },
  };
}
