const SHORE_THRESHOLD = 0.5;

// Builds the illustrative optical field consumed by createAuthoredWater's custom-grid path.
// Distance approximates the final wet field's interpolated 0.5 shoreline, including holes.
export function buildEelOpticalGrid(terrain, field, positions, indices, options = {}) {
  const { width, height, x0, z0, cellX, cellZ } = terrain ?? {},
    maxDepth = options.maxDepth ?? 2.6,
    depthMetresPerMetre = options.depthMetresPerMetre ?? 0.08,
    target = options.focusXZ ?? [900, -1250];
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 ||
      ![x0, z0, cellX, cellZ].every(Number.isFinite) || cellX <= 0 || cellZ <= 0)
    throw new Error("Eel optical grid requires finite terrain bounds and positive cells.");
  if (!(field instanceof Float32Array) || field.length !== width * height ||
      !field.every(Number.isFinite))
    throw new Error("Eel optical grid requires a finite Float32 wet field matching terrain.");
  if (!(positions instanceof Float32Array) || !positions.length || positions.length % 3 ||
      !positions.every(Number.isFinite))
    throw new Error("Eel optical grid requires finite clipped Float32 positions.");
  if (!(indices instanceof Uint32Array) || !indices.length || indices.length % 3 ||
      !indices.every((index) => index < positions.length / 3))
    throw new Error("Eel optical grid requires valid clipped Uint32 triangle indices.");
  if (!Number.isFinite(maxDepth) || maxDepth <= 0 ||
      !Number.isFinite(depthMetresPerMetre) || depthMetresPerMetre <= 0 ||
      !Array.isArray(target) || target.length !== 2 || !target.every(Number.isFinite))
    throw new Error("Eel optical grid options must be finite and positive.");

  const size = width * height,
    wet = Uint8Array.from(field, (value) => value >= SHORE_THRESHOLD ? 1 : 0),
    distance = new Float64Array(size),
    heap = new MinHeap(),
    maxX = x0 + (width - 1) * cellX,
    maxZ = z0 + (height - 1) * cellZ,
    boundsTolerance = Math.max(Math.abs(x0), Math.abs(maxX), Math.abs(z0), Math.abs(maxZ)) * 2 ** -22 + 1e-6,
    contourTolerance = Math.max(1e-6, boundsTolerance / Math.min(cellX, cellZ) * 2);
  distance.fill(Infinity);

  // Seed both sides of every threshold-crossing grid edge with distance to its linearly
  // interpolated crossing. Dijkstra then propagates a grid-metric approximation.
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const k = j * width + i, value = field[k];
    if (value === SHORE_THRESHOLD) seed(k, 0);
    if (i + 1 < width) seedCrossing(k, k + 1, cellX);
    if (j + 1 < height) seedCrossing(k, k + width, cellZ);
  }

  // Dijkstra on the anisotropic 8-neighbour grid approximates Euclidean in-map shore distance
  // while respecting holes and dry islands. Distances stay signed by the final wet mask.
  const diagonal = Math.hypot(cellX, cellZ), neighbors = [
    [-1, 0, cellX], [1, 0, cellX], [0, -1, cellZ], [0, 1, cellZ],
    [-1, -1, diagonal], [1, -1, diagonal], [-1, 1, diagonal], [1, 1, diagonal],
  ];
  while (heap.length) {
    const [k, d] = heap.pop();
    if (d !== distance[k]) continue;
    const i = k % width, j = Math.floor(k / width);
    for (const [di, dj, cost] of neighbors) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || ni >= width || nj < 0 || nj >= height) continue;
      const nk = nj * width + ni;
      if (wet[nk] !== wet[k]) continue;
      const candidate = d + cost;
      if (candidate < distance[nk]) {
        distance[nk] = candidate;
        heap.push(nk, candidate);
      }
    }
  }

  const depths = new Float32Array(positions.length / 3);
  let focusIndex = -1, focusDistance2 = Infinity;
  for (let i = 0; i < depths.length; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (x < x0 - boundsTolerance || x > maxX + boundsTolerance ||
        z < z0 - boundsTolerance || z > maxZ + boundsTolerance)
      throw new Error("Eel clipped water vertex lies outside terrain bounds.");
    const triangleWet = interpolatedWetValue(x, z),
      d = Math.abs(triangleWet - SHORE_THRESHOLD) <= contourTolerance
      ? 0 : sampleSignedDistance(x, z);
    depths[i] = Math.max(0, Math.min(maxDepth, d * depthMetresPerMetre));
    if (!Number.isFinite(y)) throw new Error("Eel optical grid focus height must be finite.");
  }
  for (const vertexIndex of indices) {
    const x = positions[vertexIndex * 3], z = positions[vertexIndex * 3 + 2],
      distance2 = (x - target[0]) ** 2 + (z - target[1]) ** 2;
    if (distance2 < focusDistance2) {
      focusDistance2 = distance2;
      focusIndex = vertexIndex;
    }
  }
  const focus = { x: positions[focusIndex * 3], y: positions[focusIndex * 3 + 1],
    z: positions[focusIndex * 3 + 2] };
  return { positions, depths, indices, focus,
    representation: "illustrative optical depth from mapped wet-mask shore distance; not bathymetry" };

  function seed(index, value) {
    if (value < distance[index]) {
      distance[index] = value;
      heap.push(index, value);
    }
  }

  function seedCrossing(a, b, length) {
    if (wet[a] === wet[b]) return;
    const va = field[a], vb = field[b], fraction = Math.max(0, Math.min(1,
      (SHORE_THRESHOLD - va) / (vb - va)));
    seed(a, fraction * length);
    seed(b, (1 - fraction) * length);
  }

  function sampleSignedDistance(x, z) {
    const u = Math.max(0, Math.min(width - 1, (x - x0) / cellX)),
      v = Math.max(0, Math.min(height - 1, (z - z0) / cellZ)),
      i = Math.min(width - 2, Math.floor(u)), j = Math.min(height - 2, Math.floor(v)),
      fu = u - i, fv = v - j,
      at = (ii, jj) => {
        const k = jj * width + ii, sign = wet[k] ? 1 : -1;
        return sign * (Number.isFinite(distance[k]) ? distance[k] : maxDepth / depthMetresPerMetre);
      },
      top = at(i, j) * (1 - fu) + at(i + 1, j) * fu,
      bottom = at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu;
    return top * (1 - fv) + bottom * fv;
  }

  function interpolatedWetValue(x, z) {
    const u = Math.max(0, Math.min(width - 1, (x - x0) / cellX)),
      v = Math.max(0, Math.min(height - 1, (z - z0) / cellZ)),
      i = Math.min(width - 2, Math.floor(u)), j = Math.min(height - 2, Math.floor(v)),
      fu = u - i, fv = v - j,
      a = field[j * width + i], b = field[(j + 1) * width + i],
      c = field[j * width + i + 1], d = field[(j + 1) * width + i + 1];
    // Match eel.js waterGeometry's split: triangles [a,b,c] and [c,b,d].
    return fu + fv <= 1
      ? a * (1 - fu - fv) + b * fv + c * fu
      : c * (1 - fv) + b * (1 - fu) + d * (fu + fv - 1);
  }
}

class MinHeap {
  values = [];

  get length() { return this.values.length; }

  push(index, distance) {
    const values = this.values;
    let i = values.length;
    values.push([index, distance]);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (values[parent][1] <= distance) break;
      values[i] = values[parent];
      i = parent;
    }
    values[i] = [index, distance];
  }

  pop() {
    const values = this.values, first = values[0], last = values.pop();
    if (values.length) {
      let i = 0;
      while (true) {
        const left = i * 2 + 1, right = left + 1;
        if (left >= values.length) break;
        const child = right < values.length && values[right][1] < values[left][1] ? right : left;
        if (values[child][1] >= last[1]) break;
        values[i] = values[child];
        i = child;
      }
      values[i] = last;
    }
    return first;
  }
}
