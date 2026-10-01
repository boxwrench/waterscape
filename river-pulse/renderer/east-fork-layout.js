// Photo-informed scene metres, not surveyed dam dimensions or channel bathymetry.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function forkChannel(z) {
  return { center: z < -45 ? 0 : 12 * Math.sin((z + 45) * 0.007),
    radius: 12 + 9 * smooth(-75, 90, z) + 4 * smooth(100, 350, z) };
}
export function forkGround(x, z) {
  // Broad earthfill downstream face, flat gravel crest, dry abutment hills.
  const dam = 2.8 + 49 * Math.max(0, 1 - Math.abs(z + 235) / 145),
    side = smooth(265, 460, Math.abs(x)),
    hills = 24 + 37 * Math.sin(x * 0.006 + z * 0.003) ** 2,
    { center, radius } = forkChannel(z), bank = Math.abs(x - center) - radius;
  if (z < -105) return Math.max(dam, side * hills);
  const channel = bank < 0 ? Math.max(-3.5, bank * 0.32) :
    Math.min(2.8, bank * 0.19) + smooth(24, 180, bank) * (7 + side * hills);
  return channel + Math.sin(x * 0.07) * Math.sin(z * 0.035) * smooth(5, 25, bank) * 0.6;
}
const shoreX = forkChannel(18).center - forkChannel(18).radius - 1.3;
export const FORK_VIEWS = Object.freeze({
  shore: { x: shoreX, z: 18, y: forkGround(shoreX, 18) + 1.8, yaw: 0.09,
    pitch: 0.025, speed: 3, label: "East Fork riverbank", bounds: [-35, -8, -2, 70] },
  outlet: { x: -18, z: -18, y: forkGround(-18, -18) + 1.8, yaw: 0.17,
    pitch: 0.05, speed: 3, label: "Below the outlet", bounds: [-28, -16, -28, 5] },
});
export function constrainForkCamera(state, view, previous) {
  const b = FORK_VIEWS[view].bounds;
  state.x = clamp(state.x, b[0], b[1]); state.z = clamp(state.z, b[2], b[3]);
  if (forkGround(state.x, state.z) < 0.16) { state.x = previous.x; state.z = previous.z; }
  state.y = forkGround(state.x, state.z) + 1.8;
}
export function forkGrid({ cell = 3, extent = 900 } = {}) {
  const w = Math.ceil(extent * 2 / cell) + 1, h = w, positions = [], ground = [], indices = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = -extent + i * cell, z = -extent + j * cell;
    positions.push(x, forkGround(x, z), z); ground.push(forkGround(x, z));
  }
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const a = j * w + i; indices.push(a, a + w, a + 1, a + 1, a + w, a + w + 1);
  }
  return { positions: new Float32Array(positions), ground, indices: new Uint32Array(indices) };
}
export function forkWaterGrid() {
  const positions = [], depths = [], indices = [], across = 50, along = 520;
  for (let j = 0; j <= along; j++) {
    const z = -103 + j * 1.1, { center, radius } = forkChannel(z);
    for (let i = 0; i <= across; i++) {
      const x = center + (i / across * 2 - 1) * radius;
      positions.push(x, 0, z); depths.push(Math.max(0.04, -forkGround(x, z)));
    }
  }
  for (let j = 0; j < along; j++) for (let i = 0; i < across; i++) {
    const a = j * (across + 1) + i; indices.push(a, a + across + 1, a + 1, a + 1, a + across + 1, a + across + 2);
  }
  return { positions: new Float32Array(positions), depths: new Float32Array(depths),
    indices: new Uint32Array(indices), focus: { x: 0, y: 0, z: 0 },
    representation: "Photo-informed authored East Fork surface; modeled bed, not measured flow or stage" };
}
