// The whole lidar grid as one triangle mesh for three.js (~1M vertices at 10 m), built once.
// Offshore it falls on a 1:3 bank (like the shader's bed) to `sink` metres, so the water
// surface is always nearer than the land behind it. A one-cell border ring drops by `skirt`
// so the crop's edge never shows a gap against the sky's painted ridges.
export function buildTerrainGrid(terrain, { sink = 30, skirt = 200 } = {}) {
  const { width: w, height: h, cell, x0, z0 } = terrain,
    W = w + 2,
    H = h + 2,
    positions = new Float32Array(W * H * 3);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const gi = Math.min(Math.max(i - 1, 0), w - 1),
        gj = Math.min(Math.max(j - 1, 0), h - 1),
        border = gi !== i - 1 || gj !== j - 1,
        gx = x0 + gi * cell,
        gz = z0 + gj * cell,
        shore = terrain.shoreDistance(gx, gz),
        y = shore < 0 ? -Math.min(sink, -shore / 3) : terrain.sample(gx, gz, 0),
        k = (j * W + i) * 3;
      positions[k] = x0 + (i - 1) * cell;
      positions[k + 1] = border ? y - skirt : y;
      positions[k + 2] = z0 + (j - 1) * cell;
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
