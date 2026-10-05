// Derived reach dynamics along the map centerline: how steeply the terrain falls and how sharply
// the line bends. Both come from observed geometry (3DEP terrain, 3DHP centerline). The map
// ribbon maps them to streak speed and bank foam as an Illustrative binding; neither is a
// velocity, shear stress or erosion estimate.

const quantile = (values, q) => {
  const sorted = Float32Array.from(values).sort();
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
};

// Per site: `slope` 0..1 (downstream drop relative to this reach's steep end) and `bend`
// -1..1 (signed turning; positive turns toward the +normal side, so the outer bank is the
// -normal side). `window` is the half-width in sites over which both are averaged.
export function reachDynamics(skeleton, ground, window = 8) {
  const n = skeleton.sites.length, slope = new Float32Array(n), bend = new Float32Array(n);
  for (const { first, count } of skeleton.lines) {
    const sites = skeleton.sites.slice(first, first + count), s = [0];
    for (let i = 1; i < count; i++) s.push(s[i - 1] + Math.hypot(sites[i].x - sites[i - 1].x, sites[i].z - sites[i - 1].z));
    const g = sites.map((site) => ground(site.x, site.z)),
      heading = sites.map((site) => Math.atan2(-site.nx, site.nz));
    for (let i = 0; i < count; i++) {
      const a = Math.max(0, i - window), b = Math.min(count - 1, i + window), run = s[b] - s[a] || 1;
      let turn = heading[b] - heading[a];
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      slope[first + i] = Math.max(0, (g[a] - g[b]) / run);
      bend[first + i] = turn / run;
    }
  }
  const steep = quantile(slope, 0.9) || 1, sharp = quantile(Array.from(bend, Math.abs), 0.9) || 1;
  for (let i = 0; i < n; i++) {
    slope[i] = Math.min(1, slope[i] / steep);
    bend[i] = Math.max(-1, Math.min(1, bend[i] / sharp));
  }
  return { slope, bend };
}
