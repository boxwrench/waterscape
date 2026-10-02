// The whole lidar grid as one triangle mesh for three.js (~1M vertices at 10 m), built once.
// Offshore it falls on a 1:3 bank (like the shader's bed) to `sink` metres, so the water
// surface is always nearer than the land behind it. A one-cell border ring drops by `skirt`
// so the crop's edge never shows a gap against the sky's painted ridges.
// 1 m detail patches (terrain.patches) replace the grid cells they cover with their own finer
// mesh; their edge vertices sit on the grid's cell edges at the grid's own heights, so the
// seam is closed.
export function buildTerrainGrid(terrain, { sink = 30, skirt = 200 } = {}) {
  const { width: w, height: h, cell, x0, z0 } = terrain,
    patches = terrain.patches ?? [],
    W = w + 2,
    H = h + 2,
    positions = new Float32Array(W * H * 3),
    surface = (x, z, shore, y) => (shore < 0 ? -Math.min(sink, -shore / 3) : y),
    // The grid's own vertex height (the bundle grid, not a patch).
    gridY = (gi, gj) => {
      const gx = x0 + gi * cell,
        gz = z0 + gj * cell,
        coarse = (terrain.coarse ?? terrain.sample).bind(terrain),
        shore = terrain.coarse ? coarse(gx, gz, 1) : terrain.shoreDistance(gx, gz);
      return surface(gx, gz, shore, coarse(gx, gz, 0));
    };
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const gi = Math.min(Math.max(i - 1, 0), w - 1),
        gj = Math.min(Math.max(j - 1, 0), h - 1),
        border = gi !== i - 1 || gj !== j - 1,
        y = gridY(gi, gj),
        k = (j * W + i) * 3;
      positions[k] = x0 + (i - 1) * cell;
      positions[k + 1] = border ? y - skirt : y;
      positions[k + 2] = z0 + (j - 1) * cell;
    }
  // Grid cells (gi, gj) covered by a patch are left out.
  const covered = (gi, gj) =>
    patches.some((p) => gi >= p.i0 && gj >= p.j0 && gi < p.i0 + p.n && gj < p.j0 + p.n);
  const quads = [];
  for (let j = 0; j < H - 1; j++)
    for (let i = 0; i < W - 1; i++) if (!covered(i - 1, j - 1)) quads.push(j * W + i);
  const indices = new Uint32Array(quads.length * 6);
  quads.forEach((a, n) => indices.set([a, a + W, a + 1, a + 1, a + W, a + W + 1], n * 6));
  return {
    positions,
    indices,
    count: W * H,
    patches: patches.map((p) => buildPatch(terrain, p, surface, gridY)),
  };
}

function buildPatch(terrain, p, surface, gridY) {
  const n = p.n * p.sub + 1,
    positions = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = p.x0 + i * p.step,
        z = p.z0 + j * p.step,
        k = (j * n + i) * 3;
      let y;
      if (i === 0 || j === 0 || i === n - 1 || j === n - 1) {
        // On the patch edge: linear between the grid vertices of this cell edge.
        const gi = p.i0 + Math.floor(i / p.sub),
          gj = p.j0 + Math.floor(j / p.sub),
          fi = (i % p.sub) / p.sub,
          fj = (j % p.sub) / p.sub;
        y = fi > 0 ? gridY(gi, gj) * (1 - fi) + gridY(gi + 1, gj) * fi
          : fj > 0 ? gridY(gi, gj) * (1 - fj) + gridY(gi, gj + 1) * fj
          : gridY(gi, gj);
      } else y = surface(x, z, terrain.sample(x, z, 1), terrain.sample(x, z, 0));
      positions[k] = x;
      positions[k + 1] = y;
      positions[k + 2] = z;
    }
  const indices = new Uint32Array((n - 1) * (n - 1) * 6);
  let m = 0;
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      indices.set([a, a + n, a + 1, a + 1, a + n, a + n + 1], m);
      m += 6;
    }
  return { positions, indices, count: n * n };
}
