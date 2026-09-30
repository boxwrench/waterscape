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
  sage: {
    ground: [[0.13, 0.16, 0.06], [0.3, 0.32, 0.15]],
    blade: [[0.13, 0.18, 0.05], [0.27, 0.33, 0.11], [0.4, 0.42, 0.19]],
  },
};

export function landLook(land) {
  const v = land?.vegetation ?? {};
  return {
    summer: SUMMER[land?.grass?.summer] ?? SUMMER.gold,
    cover: v.cover ?? 0,
    species: v.species ?? null,
    // 0: species mixed tree by tree; 1: grouped in stands (oak-placement.js standPick).
    stands: v.stands ?? 0,
    // A marine layer lying beyond a ridge line (water.cu fogLayer), shown by presets with fog:
    // `from` the unit direction it lies in, `edge` metres from the scene origin along it where
    // it begins, thickening over `width`; `top` and `base` in metres above the water surface.
    fog: land?.fog ?? null,
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
