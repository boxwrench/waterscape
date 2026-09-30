// Oak placement, ported line for line from water.cu (hashU, random, hash, noise, fbm and the
// density rule in terrainShade, the site rule in oakCrowns) so each oak mesh stands exactly where
// the shader draws that oak's crown at a distance.
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const sat = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;

function hashU(x) {
  x ^= x >>> 16;
  x = Math.imul(x, 2146121005);
  x ^= x >>> 15;
  x = Math.imul(x, 2221713035);
  x ^= x >>> 16;
  return x >>> 0;
}
// hash() in water.cu: a float in (0, 1) from integer lattice coordinates.
export function hash(x, z) {
  const seed = (Math.imul(Math.trunc(x), 1973) + Math.imul(Math.trunc(z), 9277) + 89173) >>> 0;
  return ((hashU(seed) & 16777215) + 1) / 16777217;
}
export function noise(x, z) {
  const ix = Math.floor(x),
    iz = Math.floor(z);
  let u = x - ix,
    w = z - iz;
  u = u * u * (3 - 2 * u);
  w = w * w * (3 - 2 * w);
  return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), u), lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), w);
}
export function fbm(x, z) {
  return (
    0.55 * noise(x, z) +
    0.28 * noise(x * 2.03 + 17.1, z * 2.03 + 17.1) +
    0.12 * noise(x * 4.12, z * 4.12) +
    0.05 * noise(x * 8.36, z * 8.36)
  );
}

// Tree cover at (x, z), as in terrainShade: ravines, north-facing and steep ground, and grove
// patches, thinned on spur crests and near the shore; `cover` (look.js) adds woodland everywhere
// but the crests.
// The terrain normal uses the lidar surface.
export function oakDensity(terrain, x, z, cover = 0) {
  const e = 3,
    h = (a, b) => terrain.sample(a, b, 0),
    nx = h(x - e, z) - h(x + e, z),
    nz = h(x, z - e) - h(x, z + e),
    l = Math.hypot(nx, 2 * e, nz),
    ny = (2 * e) / l,
    shore = terrain.sample(x, z, 1),
    spur = 1 - terrain.sample(x, z, 2),
    valley = 1 - smooth(0.22, 0.6, spur),
    northFacing = smooth(0, -0.4, nz / l),
    steep = smooth(0.18, 0.45, 1 - ny),
    grove = smooth(0.46, 0.64, fbm(x * 0.0065 + 13, z * 0.0065 - 4));
  return (
    sat(0.05 + 0.85 * valley + 0.55 * northFacing + 0.25 * steep + 0.75 * grove - 0.7 * smooth(0.62, 0.88, spur) + cover * (1 - smooth(0.62, 0.88, spur))) *
    smooth(10, 35, shore)
  );
}

export const OAK_CELL = 9;

// Species pick in stands (look.js `stands`): a slow ~80 m noise field pushes the pick up or
// down, so the rarer species grows in groups instead of as isolated trees. Mirrored in
// impostors.js.
export function standPick(x, z, pick, stands) {
  return stands > 0 ? sat(pick + stands * 2 * (noise(x * 0.012 + 41, z * 0.012 - 7) - 0.5)) : pick;
}

// The oak of lattice cell (cx, cz), or null: trunk position, crown radius (m) and two hashes for
// choosing its species and variant — the same numbers oakCrowns() uses.
export function oakSite(terrain, cx, cz, cover = 0) {
  const x = (cx + 0.15 + 0.7 * hash(cx + 71, cz - 19)) * OAK_CELL,
    z = (cz + 0.15 + 0.7 * hash(cx - 33, cz + 57)) * OAK_CELL;
  if (hash(cx, cz) > oakDensity(terrain, x, z, cover)) return null;
  return { x, z, radius: 3.4 + 3.2 * hash(cx + 11, cz + 5), pick: hash(cx + 5, cz + 91), turn: hash(cx - 7, cz + 3) };
}

// Every oak within `range` metres of (x, z).
export function oaksNear(terrain, x, z, range, cover = 0) {
  const out = [],
    c0x = Math.floor((x - range) / OAK_CELL),
    c1x = Math.floor((x + range) / OAK_CELL),
    c0z = Math.floor((z - range) / OAK_CELL),
    c1z = Math.floor((z + range) / OAK_CELL);
  for (let cz = c0z; cz <= c1z; cz++)
    for (let cx = c0x; cx <= c1x; cx++) {
      const site = oakSite(terrain, cx, cz, cover);
      if (site && Math.hypot(site.x - x, site.z - z) <= range) out.push(site);
    }
  return out;
}
