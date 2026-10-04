// Photo-informed local setting. Dimensions are authored estimates, not a survey.
export const FREEPORT_VIEWS = {
  bridge: { x: 94, z: 55, yaw: -0.70, pitch: -0.055, speed: 12, label: "Freeport bridge · Authored setting" },
  bank: { x: 108, z: 210, yaw: -0.54, pitch: -0.055, speed: 5, label: "Riverbank · Authored setting" },
  terrain: { x: -900, y: 1250, z: 1400, yaw: 0.57, pitch: -0.67, speed: 160, label: "USGS terrain · Survey elevations" },
};

export function freeportChannel(z) {
  return { center: Math.sin(z / 900) * 48 - 14, halfWidth: 96 + Math.sin(z / 440) * 9 };
}

export function freeportGround(x, z) {
  const channel = freeportChannel(z), d = Math.abs(x - channel.center) - channel.halfWidth;
  if (d < 0) return -0.1 - Math.min(5, -d * 0.13);
  if (d < 21) return d * 0.27 + Math.sin(z * 0.1 + x * 0.13) * Math.min(0.14, d * 0.01);
  if (d < 32) return 5.67;
  return Math.max(2.4, 5.67 - (d - 32) * 0.12) + Math.sin(z * 0.021) * 0.12;
}

export function constrainFreeportCamera(state, view, terrain = null) {
  if (view === "terrain") {
    const meta = terrain?.meta;
    state.x = Math.max(meta ? terrain.x0 + 30 : -1300, Math.min(meta ? terrain.x0 + (terrain.width - 1) * terrain.cellX - 30 : 1300, state.x));
    state.z = Math.max(meta ? terrain.z0 + 30 : -1800, Math.min(meta ? terrain.z0 + (terrain.height - 1) * terrain.cellZ - 30 : 1800, state.z));
    state.y = Math.max((terrain?.ground(state.x, state.z) ?? 0) + 50, Math.min(2200, state.y));
  } else {
    state.z = Math.max(5, Math.min(420, state.z));
    const { center, halfWidth } = freeportChannel(state.z);
    state.x = Math.max(center + halfWidth + 4, Math.min(center + halfWidth + 155, state.x));
    state.y = freeportGround(state.x, state.z) + (view === "bank" ? 1.8 : 3.5);
  }
  return state;
}

export function freeportGrid() {
  const width = 301, height = 501, positions = new Float32Array(width * height * 3),
    ground = new Float32Array(width * height), indices = new Uint32Array((width - 1) * (height - 1) * 6);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const x = -1500 + i * 10, z = -2500 + j * 10, n = j * width + i;
    ground[n] = freeportGround(x, z); positions.set([x, ground[n], z], n * 3);
  }
  let n = 0;
  for (let j = 0; j < height - 1; j++) for (let i = 0; i < width - 1; i++) {
    const a = j * width + i; indices.set([a, a + width, a + 1, a + 1, a + width, a + width + 1], n); n += 6;
  }
  return { positions, ground, indices };
}
