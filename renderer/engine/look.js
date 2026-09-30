// A water body's land look, from its land.json: the summer grass palette, how wooded the hills
// are and the mix of tree species. Shared by the water kernel (light buffer, presets.js), the
// three.js ground, the grass blades and the trees, so every layer agrees.

// Summer grass: ground (dark, light) as in terrainShade, and blades (base, tip, bright tip).
export const SUMMER = {
  // Diablo Range annual grass, cured to straw.
  gold: {
    ground: [[0.3, 0.21, 0.075], [0.5, 0.37, 0.15]],
    blade: [[0.34, 0.25, 0.09], [0.5, 0.38, 0.15], [0.62, 0.5, 0.24]],
  },
  // Fog-belt Peninsula: hills stay green-dominant through summer (July aerials show sage-green
  // slopes with only small tan patches), so drier olive appears only in patches.
  // Sierra granite benches: no cured grass, only dark evergreen shrubs and duff (photos show
  // bare stone and green clumps, no gold).
  granite: {
    ground: [[0.04, 0.055, 0.03], [0.09, 0.1, 0.05]],
    blade: [[0.05, 0.08, 0.03], [0.1, 0.14, 0.05], [0.16, 0.19, 0.08]],
  },
  sage: {
    ground: [[0.13, 0.16, 0.06], [0.3, 0.32, 0.15]],
    blade: [[0.13, 0.18, 0.05], [0.27, 0.33, 0.11], [0.4, 0.42, 0.19]],
  },
};

// Water optics (water.cu): absorption per metre and in-scattered colour, rgb.
export const WATER = {
  // Turbid reservoir water, a few metres of visibility: red and blue go first.
  turbid: { absorb: [0.62, 0.28, 0.3], scatter: [0.022 / 0.62, 0.07 / 0.3, 0.105 / 0.4] },
  // Greener water (phytoplankton, dissolved organics): blue absorbed faster, green scattered.
  green: { absorb: [0.6, 0.22, 0.42], scatter: [0.026, 0.25, 0.15] },
};

export function landLook(land, biome) {
  const v = land?.vegetation ?? {};
  return {
    summer: SUMMER[land?.grass?.summer] ?? SUMMER.gold,
    cover: v.cover ?? 0,
    species: v.species ?? null,
    // 0: species mixed tree by tree; 1: grouped in stands (oak-placement.js standPick).
    stands: v.stands ?? 0,
    // 0-1: how bare of trees cliffs steeper than ~45° are (granite walls).
    bare: v.bare ?? 0,
    // Lowers the slope at which rock shows through the ground (domes and slabs), 0-0.3.
    rock: land?.ground?.rock ?? 0,
    // Linear albedo of the biome's rock for the kernel's own shading (reflections); none: no rock.
    rockAlbedo: biome?.ground?.rock?.albedo ?? null,
    // Share of the near grass field that grows (1 default; granite benches far less).
    grassCover: land?.grass?.cover ?? 1,
    // Haze multiplier for the place's air (1 default; clear high-Sierra air less).
    haze: land?.air?.haze ?? 1,
    // A fog layer (water.cu fogLayer), shown by presets with fog: `from` the unit direction it
    // lies in ([0, 0]: everywhere), `edge` metres from the scene origin along it where it
    // begins, thickening over `width`; `top` and `base` in metres above the water surface;
    // `density` scales its thickness (default 1); `overcast` 0-1 (effectivePreset).
    fog: land?.fog ?? null,
    water: WATER[land?.water?.optics] ?? WATER.turbid,
  };
}

// Cumulative pick thresholds for `order` (the biome's species): a tree whose pick hash is below
// thresholds[i] and above thresholds[i - 1] is species i. Even shares without weights.
export function speciesThresholds(look, order) {
  const weights = order.map((s) => (look.species ? look.species[s] ?? 0 : 1)),
    total = weights.reduce((a, b) => a + b, 0) || 1;
  let sum = 0;
  return weights.map((w, i) => (i === order.length - 1 ? 1 : (sum += w) / total));
}

// The species index for a pick hash in [0, 1).
export function pickSpecies(thresholds, pick) {
  const i = thresholds.findIndex((t) => pick < t);
  return i < 0 ? thresholds.length - 1 : i;
}

// The light a preset gives this water body: a fog preset (Morning) under a body whose fog is
// `overcast` (0-1) closes the clouds, weakens and greys the sun, lifts a grey sky fill and
// thickens the haze. Shared by the water kernel and the three.js land.
export function effectivePreset(p, look) {
  const o = p.fog ? look.fog?.overcast ?? 0 : 0;
  if (look.haze !== undefined && look.haze !== 1) p = { ...p, hazeDensity: p.hazeDensity * look.haze };
  if (!o) return p;
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  return {
    ...p,
    // The cloud layer's coverage is not linear: +0.3 closes the sky at a full overcast.
    cloudCoverage: Math.max(p.cloudCoverage, Math.min(1, o + 0.3)),
    cloudDensity: Math.max(p.cloudDensity, 0.9 * o),
    sunColor: p.sunColor.map((c) => c * (1 - 0.8 * o)),
    fill: mix(p.fill, [0.5, 0.52, 0.56], 0.6 * o),
    haze: mix(p.haze, [0.72, 0.74, 0.76], o),
    hazeDensity: p.hazeDensity * (1 + 2 * o),
  };
}
