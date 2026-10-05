// Continuous strip, subdivided along the centerline to follow map terrain. Width
// is cartographic exaggeration. Every location stays tied to its source centerline.
export function buildMapRibbonSkeleton(document, step = 12) {
  const sites = [], lines = [], distances = [], across = [], tangents = [], indices = [];
  for (const feature of document.features ?? []) {
    if (feature.name !== "Russian River") continue;
    for (const line of feature.lines ?? []) {
      const points = [];
      for (let i = 1; i < line.length; i++) {
        const [ax, az] = line[i - 1], [bx, bz] = line[i], length = Math.hypot(bx - ax, bz - az);
        if (!(length > 0)) continue;
        if (!points.length) points.push([ax, az]);
        const count = Math.ceil(length / step);
        for (let j = 1; j <= count; j++) points.push([ax + (bx - ax) * j / count, az + (bz - az) * j / count]);
      }
      if (points.length < 2) continue;
      let along = 0;
      const first = sites.length;
      lines.push({ first, count: points.length });
      for (let i = 0; i < points.length; i++) {
        const [x, z] = points[i], prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)],
          length = Math.hypot(next[0] - prev[0], next[1] - prev[1]),
          tx = length ? (next[0] - prev[0]) / length : 1,
          tz = length ? (next[1] - prev[1]) / length : 0;
        if (i) along += Math.hypot(x - prev[0], z - prev[1]);
        sites.push({ x, z, nx: -tz, nz: tx });
        for (const side of [-1, 1]) {
          distances.push(along); across.push(side); tangents.push(tx, tz);
        }
        if (i) {
          const a = (first + i - 1) * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
  }
  return { sites, lines, distances: new Float32Array(distances), across: new Float32Array(across),
    tangents: new Float32Array(tangents), indices: new Uint32Array(indices) };
}

export function mapRibbonPositions(skeleton, terrain, width, out = new Float32Array(skeleton.sites.length * 6)) {
  for (let i = 0; i < skeleton.sites.length; i++) {
    const s = skeleton.sites[i];
    for (let j = 0; j < 2; j++) {
      const side = j ? 1 : -1, x = s.x + s.nx * width * 0.5 * side,
        z = s.z + s.nz * width * 0.5 * side, offset = i * 6 + j * 3;
      out[offset] = x; out[offset + 1] = terrain.ground(x, z) + 4.2; out[offset + 2] = z;
    }
  }
  return out;
}
