// A bounded optical preview, not reconstructed bank geometry or hydraulic stage.
export function buildAuthoredWaterGeometry(document, terrain, {
  radius = 420,
  halfWidth = 42,
  step = 1.5,
  lift = 0.24,
} = {}) {
  if (![radius, halfWidth, step, lift].every(Number.isFinite) ||
      radius <= 0 || halfWidth <= 0 || step <= 0 || lift <= 0)
    throw new Error("Authored water requires positive finite geometry settings");
  const segments = [];
  let focus = null;
  for (const feature of document.features ?? []) {
    if (feature.name !== "Russian River") continue;
    for (const line of feature.lines ?? []) {
      for (let i = 1; i < line.length; i++) {
        const [ax, az] = line[i - 1], [bx, bz] = line[i],
          dx = bx - ax, dz = bz - az, length2 = dx * dx + dz * dz;
        if (!length2) continue;
        const t = Math.max(0, Math.min(1, -(ax * dx + az * dz) / length2)),
          x = ax + dx * t, z = az + dz * t, distance = Math.hypot(x, z);
        if (!focus || distance < focus.distance) focus = { x, z, distance };
        segments.push({ ax, az, dx, dz, length2,
          ay: terrain.ground(ax, az), by: terrain.ground(bx, bz) });
      }
    }
  }
  if (!focus) return null;
  segments.splice(0, segments.length, ...segments.filter((s) => {
    const t = Math.max(0, Math.min(1,
      ((focus.x - s.ax) * s.dx + (focus.z - s.az) * s.dz) / s.length2));
    return Math.hypot(s.ax + s.dx * t - focus.x, s.az + s.dz * t - focus.z) < radius + halfWidth;
  }));
  const count = Math.ceil(radius * 2 / step) + 1,
    positions = [], depths = [], indices = [], grid = new Int32Array(count * count);
  grid.fill(-1);
  for (let j = 0; j < count; j++) {
    for (let i = 0; i < count; i++) {
      const x = focus.x - radius + i * step, z = focus.z - radius + j * step;
      if (Math.hypot(x - focus.x, z - focus.z) > radius ||
          x < terrain.x0 || z < terrain.z0 ||
          x > terrain.x0 + (terrain.width - 1) * terrain.cellX ||
          z > terrain.z0 + (terrain.height - 1) * terrain.cellZ) continue;
      let nearest = Infinity, y = 0;
      for (const s of segments) {
        const t = Math.max(0, Math.min(1, ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.length2)),
          distance = Math.hypot(x - s.ax - s.dx * t, z - s.az - s.dz * t);
        if (distance < nearest) {
          nearest = distance;
          y = s.ay + (s.by - s.ay) * t + lift;
        }
      }
      // Clip at sampled terrain. Never drape an opaque water ribbon up a hillside.
      if (nearest > halfWidth || terrain.ground(x, z) > y) continue;
      grid[j * count + i] = positions.length / 3;
      positions.push(x, y, z);
      // Modeled optical depth: shallow edge, deeper center. Not measured bathymetry.
      depths.push(0.12 + 2.6 * Math.pow(1 - nearest / halfWidth, 1.4));
    }
  }
  for (let j = 0; j < count - 1; j++) {
    for (let i = 0; i < count - 1; i++) {
      const a = grid[j * count + i], b = grid[j * count + i + 1],
        c = grid[(j + 1) * count + i], d = grid[(j + 1) * count + i + 1];
      if (a >= 0 && b >= 0 && c >= 0) indices.push(a, c, b);
      if (b >= 0 && c >= 0 && d >= 0) indices.push(b, c, d);
    }
  }
  if (!indices.length) return null;
  return { positions: new Float32Array(positions), depths: new Float32Array(depths),
    indices: new Uint32Array(indices), focus: { x: focus.x, z: focus.z,
      y: terrain.ground(focus.x, focus.z) + lift },
    representation: "illustrative local surface and modeled bed; terrain-constrained centerline context" };
}
