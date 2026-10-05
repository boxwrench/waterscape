// Build a triangle mesh from River Pulse's absolute-elevation terrain.
// No shoreline, basin-depth, or still-water assumptions are permitted here.
export function buildRiverTerrainGrid(terrain, { skirt = 150 } = {}) {
  const { width: w, height: h, cellX, cellZ, x0, z0 } = terrain,
    W = w + 2,
    H = h + 2,
    positions = new Float32Array(W * H * 3);

  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const gi = Math.min(Math.max(i - 1, 0), w - 1),
        gj = Math.min(Math.max(j - 1, 0), h - 1),
        border = gi !== i - 1 || gj !== j - 1,
        gx = x0 + gi * cellX,
        gz = z0 + gj * cellZ,
        y = terrain.ground(gx, gz),
        k = (j * W + i) * 3;
      positions[k] = x0 + (i - 1) * cellX;
      positions[k + 1] = border ? y - skirt : y;
      positions[k + 2] = z0 + (j - 1) * cellZ;
    }

  const indices = new Uint32Array((W - 1) * (H - 1) * 6);
  let n = 0;
  for (let j = 0; j < H - 1; j++)
    for (let i = 0; i < W - 1; i++) {
      const a = j * W + i;
      indices.set([a, a + W, a + 1, a + 1, a + W, a + W + 1], n);
      n += 6;
    }
  return { positions, indices, count: W * H };
}
