// A bounded, terrain-constrained illustration over the mapped Tuolumne River line.
// Width, lift and optical depth are review controls; the source line does not encode them.
import { createAuthoredWater } from "../../../../../scene-kit/authored-water.js";

export function createTuolumneWater(terrain, lines, options = {}) {
  const grid = buildTuolumneWaterGeometry(terrain, { lines }, options);
  if (!grid) return null;
  const waterOptions = {
    filterProceduralBed: true,
    reflection: grid.reflectionSuitable,
    sunDirection: options.sunDirection ?? [-1600, 2300, 700],
  };
  if (grid.reflectionSuitable) waterOptions.shoreReflectionRange = [0.02, 2.6];
  const water = createAuthoredWater(null, terrain, null, grid, waterOptions);
  if (!water) return null;
  water.mesh.name = "Tuolumne illustrative river water";
  water.mesh.visible = true;
  water.mesh.userData.representation = grid.representation;
  water.mesh.userData.reflection = grid.reflectionSuitable
    ? "single-plane mirror with shallow-gap guard"
    : "analytic sky reflection; full-scene mirror omitted because mapped terrain-following surface exceeds the single-plane height range";
  return { ...water, depthBytes: grid.depths.byteLength,
    geometryBytes: grid.positions.byteLength + grid.depths.byteLength + grid.indices.byteLength,
    heightRange: grid.heightRange, reflectionSuitable: grid.reflectionSuitable,
    reflectionMode: grid.reflectionSuitable ? "single-plane mirror" : "analytic sky",
    stationCount: grid.stationCount, centerlineParts: grid.centerlineParts,
    halfWidth: grid.halfWidth };
}

export function buildTuolumneWaterGeometry(terrain, layout, options = {}) {
  validateInputs(terrain, layout);
  const focusXZ = options.focusXZ ?? [700, 1100],
    radius = options.radius ?? 1900,
    halfWidth = options.halfWidth ?? 20,
    stationSpacing = options.stationSpacing ?? 4,
    crossSpacing = options.crossSpacing ?? 2.5,
    surfaceLift = options.surfaceLift ?? 0.35,
    maxDepth = options.maxDepth ?? 2.6,
    depthMetresPerMetre = options.depthMetresPerMetre ?? 0.18;
  if (!Array.isArray(focusXZ) || focusXZ.length !== 2 || !focusXZ.every(Number.isFinite) ||
      ![radius, halfWidth, stationSpacing, crossSpacing, surfaceLift, maxDepth,
        depthMetresPerMetre].every(Number.isFinite) || radius <= 0 || halfWidth <= 0 ||
      stationSpacing <= 0 || crossSpacing <= 0 || surfaceLift <= 0 || maxDepth <= 0 ||
      depthMetresPerMetre <= 0)
    throw new Error("Tuolumne water settings must be finite and positive.");

  const maxX = terrain.x0 + (terrain.width - 1) * terrain.cellX,
    maxZ = terrain.z0 + (terrain.height - 1) * terrain.cellZ,
    clipRadius = radius + halfWidth,
    crossCount = Math.ceil(halfWidth * 2 / crossSpacing) + 1,
    positions = [], depths = [], indices = [], stationsUsed = [], centerlineParts = [],
    heightRange = [Infinity, -Infinity];

  for (const line of layout.lines) {
    if (line.length < 2) continue;
    const cumulative = new Float64Array(line.length);
    for (let i = 1; i < line.length; i++)
      cumulative[i] = cumulative[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    const intervals = [];
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], interval = segmentCircleInterval(a, b, focusXZ, clipRadius);
      if (interval) intervals.push([cumulative[i - 1] + interval[0] * (cumulative[i] - cumulative[i - 1]),
        cumulative[i - 1] + interval[1] * (cumulative[i] - cumulative[i - 1])]);
    }
    for (const [start, end] of mergeIntervals(intervals)) {
      const span = end - start;
      if (span < 0.5) continue;
      const count = Math.max(1, Math.ceil(span / stationSpacing)),
        firstVertex = positions.length / 3,
        rows = new Array(count + 1), sampledPart = new Array(count + 1).fill(null);
      for (let j = 0; j <= count; j++) {
        const s = start + span * j / count,
          p = pointAt(line, cumulative, s), before = pointAt(line, cumulative, Math.max(0, s - 1)),
          after = pointAt(line, cumulative, Math.min(cumulative.at(-1), s + 1)),
          tx = after[0] - before[0], tz = after[1] - before[1], length = Math.hypot(tx, tz);
        if (length < 1e-8) { rows[j] = null; continue; }
        const nx = -tz / length, nz = tx / length,
          centerX = p[0], centerZ = p[1];
        if (centerX < terrain.x0 || centerX > maxX || centerZ < terrain.z0 || centerZ > maxZ) {
          rows[j] = null; continue;
        }
        const surfaceY = tuolumneTerrainSurfaceGround(terrain, centerX, centerZ) + surfaceLift;
        if (!Number.isFinite(surfaceY)) { rows[j] = null; continue; }
        const left = wetExtent(1), right = wetExtent(-1), row = new Int32Array(crossCount);
        row.fill(-1);
        if (left < 0.2 || right < 0.2) { rows[j] = null; continue; }
        for (let k = 0; k < crossCount; k++) {
          const t = k / (crossCount - 1), offset = -right + (left + right) * t,
            x = centerX + nx * offset, z = centerZ + nz * offset;
          if (x < terrain.x0 || x > maxX || z < terrain.z0 || z > maxZ ||
              tuolumneTerrainSurfaceGround(terrain, x, z) > surfaceY + 1e-4) continue;
          const id = positions.length / 3,
            edgeDistance = Math.min(offset + right, left - offset);
          positions.push(x, surfaceY, z);
          depths.push(Math.min(maxDepth, Math.max(0, edgeDistance * depthMetresPerMetre)));
          heightRange[0] = Math.min(heightRange[0], surfaceY);
          heightRange[1] = Math.max(heightRange[1], surfaceY);
          row[k] = id;
        }
        rows[j] = row;
        stationsUsed.push({ x: centerX, z: centerZ, y: surfaceY });
        sampledPart[j] = { x: centerX, z: centerZ, y: surfaceY };

        function wetExtent(side) {
          const samples = Math.ceil(halfWidth / Math.min(crossSpacing, 3));
          let lastWet = 0;
          for (let n = 1; n <= samples; n++) {
            const offset = side * halfWidth * n / samples,
              x = centerX + nx * offset, z = centerZ + nz * offset;
            if (x < terrain.x0 || x > maxX || z < terrain.z0 || z > maxZ ||
                tuolumneTerrainSurfaceGround(terrain, x, z) > surfaceY) {
              let lo = lastWet, hi = offset;
              for (let q = 0; q < 12; q++) {
                const mid = (lo + hi) * 0.5, mx = centerX + nx * mid, mz = centerZ + nz * mid;
                if (mx >= terrain.x0 && mx <= maxX && mz >= terrain.z0 && mz <= maxZ &&
                    tuolumneTerrainSurfaceGround(terrain, mx, mz) <= surfaceY) lo = mid;
                else hi = mid;
              }
              return Math.abs(lo);
            }
            lastWet = offset;
          }
          return Math.abs(lastWet);
        }
      }
      const connected = new Array(count).fill(false);
      for (let j = 0; j < count; j++) {
        const aRow = rows[j], bRow = rows[j + 1];
        if (!aRow || !bRow) continue;
        let hasFace = false;
        for (let k = 0; k < crossCount - 1; k++) {
          const a = aRow[k], b = aRow[k + 1], c = bRow[k], d = bRow[k + 1];
          if (a < 0 || b < 0 || c < 0 || d < 0) continue;
          // Across then downstream gives an upward-facing normal for x-east/z-south.
          if (!piercesTerrain(a, b, c)) { indices.push(a, b, c); hasFace = true; }
          if (!piercesTerrain(b, d, c)) { indices.push(b, d, c); hasFace = true; }
        }
        connected[j] = hasFace;
      }
      let run = [];
      for (let j = 0; j < count; j++) {
        if (connected[j] && sampledPart[j] && sampledPart[j + 1]) {
          if (!run.length) run.push(sampledPart[j]);
          run.push(sampledPart[j + 1]);
        } else if (run.length > 1) { centerlineParts.push(run); run = []; }
        else run = [];
      }
      if (run.length > 1) centerlineParts.push(run);
      if (positions.length / 3 === firstVertex) continue;
      }

      function piercesTerrain(a, b, c) {
        const x = (positions[a * 3] + positions[b * 3] + positions[c * 3]) / 3,
          z = (positions[a * 3 + 2] + positions[b * 3 + 2] + positions[c * 3 + 2]) / 3,
          y = (positions[a * 3 + 1] + positions[b * 3 + 1] + positions[c * 3 + 1]) / 3;
        return tuolumneTerrainSurfaceGround(terrain, x, z) > y + 1e-4;
      }
    }
  if (!indices.length) return null;

  let focusIndex = indices[0], bestDistance = Infinity;
  for (const index of indices) {
    const dx = positions[index * 3] - focusXZ[0], dz = positions[index * 3 + 2] - focusXZ[1], d = dx * dx + dz * dz;
    if (d < bestDistance) { focusIndex = index; bestDistance = d; }
  }
  heightRange[0] = Infinity; heightRange[1] = -Infinity;
  for (const index of indices) {
    const y = positions[index * 3 + 1];
    heightRange[0] = Math.min(heightRange[0], y);
    heightRange[1] = Math.max(heightRange[1], y);
  }
  const focus = { x: positions[focusIndex * 3], y: positions[focusIndex * 3 + 1], z: positions[focusIndex * 3 + 2] };
  return { positions: new Float32Array(positions), depths: new Float32Array(depths),
    indices: new Uint32Array(indices), focus, heightRange,
    centerlineParts, halfWidth,
    stationCount: stationsUsed.length,
    // Renderer heuristic only: the shared reflector uses a single horizontal plane.
    reflectionSuitable: heightRange[1] - heightRange[0] <= 1.5,
    representation: "illustrative river ribbon on mapped Tuolumne centerline; terrain-clipped banks and modeled optical depth, not measured width, stage or bathymetry" };
}

// Match terrain-mesh.js's [a,b,c] / [c,b,d] diagonal split exactly. Bilinear
// terrain sampling can disagree with rendered land triangles inside a coarse cell.
export function tuolumneTerrainSurfaceGround(terrain, x, z) {
  const u = Math.min(Math.max((x - terrain.x0) / terrain.cellX, 0), terrain.width - 1),
    v = Math.min(Math.max((z - terrain.z0) / terrain.cellZ, 0), terrain.height - 1),
    i = Math.min(terrain.width - 2, Math.floor(u)), j = Math.min(terrain.height - 2, Math.floor(v)),
    fu = u - i, fv = v - j,
    node = (ii, jj) => terrain.elevationCells
      ? terrain.elevationCells[jj * terrain.width + ii] - (terrain.verticalOffset ?? 0)
      : terrain.ground(terrain.x0 + ii * terrain.cellX, terrain.z0 + jj * terrain.cellZ),
    a = node(i, j), b = node(i, j + 1), c = node(i + 1, j), d = node(i + 1, j + 1);
  return fu + fv <= 1
    ? a * (1 - fu - fv) + b * fv + c * fu
    : c * (1 - fv) + b * (1 - fu) + d * (fu + fv - 1);
}

// Makes a study-only contact variant of the existing DEM mesh positions. This
// authored display cut follows the rendered water surface; it is not a surveyed bed.
export function buildTuolumneContactPositions(terrain, sourcePositions, water, options = {}) {
  validateTerrain(terrain);
  const expected = (terrain.width + 2) * (terrain.height + 2) * 3,
    halfWidth = water?.halfWidth,
    transition = Math.max(terrain.cellX, terrain.cellZ),
    contactHalfWidth = options.contactHalfWidth ?? halfWidth + transition,
    centerCutDepth = options.centerCutDepth ?? 0.8,
    edgeCutDepth = options.edgeCutDepth ?? 0.25,
    maxLowering = options.maxLowering ?? 1;
  if (!(sourcePositions instanceof Float32Array) || sourcePositions.length !== expected ||
      !sourcePositions.every(Number.isFinite))
    throw new Error("Tuolumne contact cut requires the padded DEM terrain mesh positions.");
  if (!water || !Number.isFinite(halfWidth) || halfWidth <= 0 ||
      !Array.isArray(water.centerlineParts) || !water.centerlineParts.length ||
      !water.centerlineParts.every((part) => Array.isArray(part) && part.length > 1 &&
        part.every((p) => p && [p.x, p.y, p.z].every(Number.isFinite))) ||
      ![contactHalfWidth, centerCutDepth, edgeCutDepth, maxLowering].every(Number.isFinite) ||
      contactHalfWidth <= halfWidth || contactHalfWidth > halfWidth + transition + 1e-6 ||
      centerCutDepth <= 0 || edgeCutDepth <= 0 || edgeCutDepth > centerCutDepth || maxLowering <= 0)
    throw new Error("Tuolumne contact cut settings exceed the authored channel and one-cell transition.");

  const positions = sourcePositions.slice(), nearest = new Float32Array(expected / 3),
    targetHeights = new Float32Array(expected / 3);
  nearest.fill(Infinity); targetHeights.fill(Infinity);
  let changedCount = 0, maxCut = 0,
    minX = Infinity, minZ = Infinity, maxChangedX = -Infinity, maxChangedZ = -Infinity;
  const paddedWidth = terrain.width + 2;
  for (const part of water.centerlineParts) for (let n = 1; n < part.length; n++) {
    const a = part[n - 1], b = part[n], dx = b.x - a.x, dz = b.z - a.z,
      length2 = dx * dx + dz * dz;
    if (length2 < 1e-8) continue;
    const i0 = Math.max(1, Math.ceil((Math.min(a.x, b.x) - contactHalfWidth - terrain.x0) / terrain.cellX) + 1),
      i1 = Math.min(terrain.width, Math.floor((Math.max(a.x, b.x) + contactHalfWidth - terrain.x0) / terrain.cellX) + 1),
      j0 = Math.max(1, Math.ceil((Math.min(a.z, b.z) - contactHalfWidth - terrain.z0) / terrain.cellZ) + 1),
      j1 = Math.min(terrain.height, Math.floor((Math.max(a.z, b.z) + contactHalfWidth - terrain.z0) / terrain.cellZ) + 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const index = j * paddedWidth + i, x = sourcePositions[index * 3], z = sourcePositions[index * 3 + 2],
        t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / length2)),
        cx = a.x + dx * t, cz = a.z + dz * t, distance = Math.hypot(x - cx, z - cz);
      if (distance > contactHalfWidth || distance >= nearest[index]) continue;
      nearest[index] = distance;
      const surfaceY = a.y + (b.y - a.y) * t,
        depth = distance <= halfWidth
          ? centerCutDepth - (centerCutDepth - edgeCutDepth) * (distance / halfWidth) ** 2
          : edgeCutDepth * (1 - (distance - halfWidth) / (contactHalfWidth - halfWidth)) ** 2,
        targetY = surfaceY - depth;
      targetHeights[index] = targetY;
    }
  }
  for (let j = 1; j <= terrain.height; j++) for (let i = 1; i <= terrain.width; i++) {
    const index = j * paddedWidth + i, targetY = targetHeights[index];
    if (!Number.isFinite(targetY)) continue;
    const oldY = sourcePositions[index * 3 + 1], newY = Math.min(oldY, targetY), cut = oldY - newY;
    // Leave steep banks alone when contact would require a conspicuous cut.
    if (cut <= 1e-5 || cut > maxLowering) continue;
    positions[index * 3 + 1] = newY;
    changedCount++;
    maxCut = Math.max(maxCut, cut);
    const x = sourcePositions[index * 3], z = sourcePositions[index * 3 + 2];
    minX = Math.min(minX, x); minZ = Math.min(minZ, z);
    maxChangedX = Math.max(maxChangedX, x); maxChangedZ = Math.max(maxChangedZ, z);
  }
  return { positions, changedCount, maxCut,
    cutBounds: changedCount ? [minX, minZ, maxChangedX, maxChangedZ] : null,
    contactHalfWidth, centerCutDepth, edgeCutDepth, maxLowering,
    representation: `study-only display cut under illustrative ${halfWidth * 2} m water width plus one terrain-cell transition; ${centerCutDepth} m modeled center clearance and at most ${maxLowering} m land lowering, not bathymetry` };
}

function validateInputs(terrain, layout) {
  validateTerrain(terrain);
  if (!layout || !Array.isArray(layout.lines) || !layout.lines.length ||
      !layout.lines.every((line) => Array.isArray(line) && line.every((p) => Array.isArray(p) &&
        p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))))
    throw new Error("Tuolumne water requires finite mapped centerline parts.");
}

function validateTerrain(terrain) {
  if (!terrain || !Number.isInteger(terrain.width) || !Number.isInteger(terrain.height) ||
      terrain.width < 2 || terrain.height < 2 || typeof terrain.ground !== "function" ||
      ![terrain.x0, terrain.z0, terrain.cellX, terrain.cellZ].every(Number.isFinite) ||
      terrain.cellX <= 0 || terrain.cellZ <= 0)
    throw new Error("Tuolumne water requires a finite terrain grid.");
}

function segmentCircleInterval(a, b, center, radius) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
  if (length2 < 1e-12) return null;
  const closest = ((center[0] - a[0]) * dx + (center[1] - a[1]) * dz) / length2,
    px = a[0] + dx * closest - center[0], pz = a[1] + dz * closest - center[1],
    distance2 = px * px + pz * pz;
  if (distance2 > radius * radius) return null;
  const half = Math.sqrt((radius * radius - distance2) / length2),
    lo = Math.max(0, closest - half), hi = Math.min(1, closest + half);
  return hi > lo ? [lo, hi] : null;
}

function mergeIntervals(intervals) {
  intervals.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const interval of intervals) {
    const last = out.at(-1);
    if (last && interval[0] <= last[1] + 1e-4) last[1] = Math.max(last[1], interval[1]);
    else out.push(interval.slice());
  }
  return out;
}

function pointAt(line, cumulative, distance) {
  let lo = 0, hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] < distance) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo), span = cumulative[i] - cumulative[i - 1],
    t = span > 0 ? Math.max(0, Math.min(1, (distance - cumulative[i - 1]) / span)) : 0;
  return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t,
    line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
}
