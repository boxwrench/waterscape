import { EEL_CAMERAS, EEL_SEED } from "./eel-layout.js";

export function settingRandom(seed = EEL_SEED) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

// Authored woody-cover heuristic, not a vegetation classification/species inventory.
export function canopyCandidate(r, g, b) {
  return g > r * 1.06 && (r + g + b) / 3 < 0.36 && r < 0.32;
}

export function forestSites(terrain, pixels, mapped, seed = EEL_SEED) {
  const random = settingRandom(seed), sites = [], step = 15,
    { width, height, x0, z0, cellX, cellZ } = terrain;
  for (let z = z0 + 35; z < z0 + (height - 1) * cellZ - 35; z += step)
    for (let x = x0 + 35; x < x0 + (width - 1) * cellX - 35; x += step) {
      const px = x + (random() - 0.5) * step * 0.9, pz = z + (random() - 0.5) * step * 0.9,
        i = Math.round((px - x0) / cellX), j = Math.round((pz - z0) / cellZ), k = j * width + i;
      if (mapped[k] || !canopyCandidate(pixels[k * 4] / 255, pixels[k * 4 + 1] / 255, pixels[k * 4 + 2] / 255)) continue;
      const y = terrain.ground(px, pz), slope = Math.hypot(
        terrain.ground(px + 8, pz) - terrain.ground(px - 8, pz),
        terrain.ground(px, pz + 8) - terrain.ground(px, pz - 8)) / 16;
      if (y < 22 || slope > 1.05 || random() > 0.84) continue;
      if (Object.values(EEL_CAMERAS).some(camera => Math.hypot(px - camera.position[0], pz - camera.position[2]) < 28)) continue;
      const cluster = 0.5 + 0.5 * Math.sin(px / 96 + Math.cos(pz / 123)),
        h = 19 + random() * 17 + cluster * 7;
      const variant = random() < (y < 75 ? 0.45 : 0.18) ? Math.floor(random() * 2) : 2 + Math.floor(random() * 2);
      sites.push({ x: px, y, z: pz, h: variant < 2 ? h * 0.64 : h, variant, width: 0.95 + random() * 0.45,
        yaw: random() * Math.PI * 2, tint: 0.78 + random() * 0.35 });
    }
  return sites;
}

export function forestDetailSites(sites, camera, maxDetailed = 96, target = null) {
  const forward = target ? [target[0] - camera[0], target[2] - camera[2]] : null;
  const ordered = sites.map((site, index) => ({ index, distance: Math.hypot(site.x - camera[0], site.z - camera[2]) }))
    .filter(entry => {
      const site = sites[entry.index];
      return (site.variant === undefined || site.variant >= 2) && entry.distance < 450 && (!forward ||
        (site.x - camera[0]) * forward[0] + (site.z - camera[2]) * forward[1] > entry.distance * Math.hypot(...forward) * 0.7);
    }).sort((a, b) => a.distance - b.distance || a.index - b.index),
    detailed = new Set(ordered.slice(0, maxDetailed).map(site => site.index));
  return { detailed: sites.filter((_, i) => detailed.has(i)), distant: sites.filter((_, i) => !detailed.has(i)) };
}
