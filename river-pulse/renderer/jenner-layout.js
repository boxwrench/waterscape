// Photo-informed local coordinates, not surveyed Jenner banks or bathymetry.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const channel = [[-310, -345], [-65, -250], [175, -145], [295, 160], [370, 510], [700, 900], [1260, 1320], [2100, 1800]];

export function jennerCoast(z) {
  return -160 + 75 * Math.sin((z + 200) / 940) + 0.055 * z;
}

export function jennerRiver(x, z) {
  let distance = Infinity, radius = 130;
  for (let i = 1; i < channel.length; i++) {
    const [ax, az] = channel[i - 1], [bx, bz] = channel[i], dx = bx - ax, dz = bz - az,
      t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1),
      d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < distance) { distance = d; radius = 112 + 30 * smooth(-200, 600, az + dz * t); }
  }
  return { distance, radius, bankDistance: distance - radius };
}

export function jennerGround(x, z) {
  const offshore = x - jennerCoast(z), river = jennerRiver(x, z),
    shore = Math.min(offshore, river.bankDistance);
  if (shore < 0) return Math.max(-32, shore * (offshore < 0 ? 0.065 : 0.038));
  const north = 1 - smooth(-630, -390, z),
    southBluff = smooth(1550, 1900, z),
    rise = smooth(14, 360, shore) * north +
      smooth(130 - southBluff * 122, 580 - southBluff * 260, shore) * (1 - north),
    hills = 62 + 45 * Math.sin(x * 0.003 + z * 0.0017) ** 2 + 38 * Math.sin(z * 0.0023) ** 2,
    beach = Math.min(2.5, shore * 0.065),
    detail = (Math.sin(x * 0.033 + Math.sin(z * 0.018) * 2) * Math.sin(z * 0.027 + x * 0.007)
      + Math.sin(x * 0.078 + z * 0.06) * 0.35) * Math.min(2.6, rise * 3);
  return beach + rise * hills * (1 + north * 0.25) + detail;
}

function riverShore() {
  const x = 220;
  for (let z = -430; z < -150; z += 0.5) {
    const ground = jennerGround(x, z);
    if (ground > 0.16 && ground < 0.2) return { x, z, y: ground + 1.8 };
  }
  throw new Error("Jenner shore camera has no dry water-edge position");
}

export const JENNER_VIEWS = Object.freeze({
  lookout: { x: 0, z: -570, y: jennerGround(0, -570) + 1.8,
    yaw: 3.01, pitch: -0.22, speed: 8,
    label: "Estuary lookout", bounds: [-90, 150, -690, -500] },
  river: { ...riverShore(), yaw: -3.04, pitch: -0.035, speed: 4,
    label: "River shore", bounds: [150, 350, -450, -230] },
  ocean: { x: jennerCoast(650) + 3.5, z: 650,
    y: jennerGround(jennerCoast(650) + 3.5, 650) + 1.8,
    yaw: -2.9, mobileYaw: -3.06, pitch: -0.09, speed: 4,
    label: "Pacific beach", bounds: [-200, 200, 510, 840] },
});

export function constrainJennerCamera(state, view, previous) {
  const bounds = JENNER_VIEWS[view].bounds;
  state.x = clamp(state.x, bounds[0], bounds[1]); state.z = clamp(state.z, bounds[2], bounds[3]);
  if (jennerGround(state.x, state.z) < 0.12) { state.x = previous.x; state.z = previous.z; }
  state.y = jennerGround(state.x, state.z) + 1.8;
}

export function jennerGrid({ x0 = -580, x1 = 2300, z0 = -1600, z1 = 3600, cell = 6 } = {}) {
  const w = Math.ceil((x1 - x0) / cell) + 1, h = Math.ceil((z1 - z0) / cell) + 1,
    positions = new Float32Array(w * h * 3), ground = new Float32Array(w * h),
    indices = new Uint32Array((w - 1) * (h - 1) * 6);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, x = x0 + i * cell, z = z0 + j * cell;
    positions.set([x, 0, z], k * 3); ground[k] = jennerGround(x, z);
  }
  let index = 0;
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const a = j * w + i;
    indices.set([a, a + w, a + 1, a + 1, a + w, a + w + 1], index); index += 6;
  }
  return { positions, ground, indices };
}
