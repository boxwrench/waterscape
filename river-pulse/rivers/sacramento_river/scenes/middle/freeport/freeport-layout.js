// Photo-informed local setting. Dimensions are authored estimates, not a survey.
import { FREEPORT_BRIDGE, FREEPORT_BRIDGE_ANGLES, bridgeToWorld, worldToBridge } from "./freeport-bridge-layout.js";

export const FREEPORT_VIEWS = {
  bridge: { ...FREEPORT_BRIDGE_ANGLES.southeast, angle: "southeast", speed: 8, label: "Freeport bridge · Reference reconstruction" },
  bank: { x: 76, z: -390, yaw: -2.78, pitch: -0.04, speed: 5, label: "Marina shore · Photo-informed setting" },
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
  } else if (view === "bridge" && ["east", "west", "underside", "above"].includes(state.angle)) {
    const p = worldToBridge(state.x, state.z), b = FREEPORT_BRIDGE;
    if (state.angle === "above") {
      p.x = Math.max(-160, Math.min(160, p.x)); p.z = Math.max(-500, Math.min(500, p.z));
      state.y = Math.max(30, Math.min(240, state.y));
    } else if (state.angle === "underside") {
      p.x = Math.max(24, Math.min(64, p.x)); p.z = Math.max(14, Math.min(44, p.z)); state.y = 1.6;
    } else {
      const end = b.mainSpan / 2 + b.fixedSpan + b.eastPony;
      p.x = Math.max(end - b.length - 12, Math.min(end + 12, p.x));
      p.z = Math.max(-2.8, Math.min(2.8, p.z)); state.y = b.deckY + 1.7;
    }
    const world = bridgeToWorld(p.x, state.y, p.z); state.x = world.x; state.z = world.z;
  } else if (view === "bridge") {
    const north = state.angle?.includes("north"), west = state.angle?.includes("west"), side = west ? -1 : 1;
    state.z = Math.max(north ? -330 : -75, Math.min(north ? -115 : 240, state.z));
    const { center, halfWidth } = freeportChannel(state.z), distance = (state.x - center) * side;
    state.x = center + side * Math.max(halfWidth + 4, Math.min(halfWidth + 110, distance));
    state.y = freeportGround(state.x, state.z) + 1.8;
  } else {
    state.z = Math.max(-490, Math.min(420, state.z));
    const { center, halfWidth } = freeportChannel(state.z);
    state.x = Math.max(center + halfWidth + 4, Math.min(center + halfWidth + 155, state.x));
    state.y = freeportGround(state.x, state.z) + (view === "bank" ? 1.8 : 3.5);
  }
  return state;
}

export function freeportGrid() {
  // Fine bank triangles around the bridge keep photo-fitted piers/rocks grounded.
  const coordinates = (outer, inner) => {
    const values = [];
    for (let v = -outer; v <= outer;) { values.push(v); v += Math.abs(v) < inner ? 2 : 10; }
    return values;
  }, xs = coordinates(1500, 220), zs = coordinates(2500, 500), width = xs.length, height = zs.length,
    positions = new Float32Array(width * height * 3),
    ground = new Float32Array(width * height), indices = new Uint32Array((width - 1) * (height - 1) * 6);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const x = xs[i], z = zs[j], n = j * width + i;
    ground[n] = freeportGround(x, z); positions.set([x, ground[n], z], n * 3);
  }
  let n = 0;
  for (let j = 0; j < height - 1; j++) for (let i = 0; i < width - 1; i++) {
    const a = j * width + i; indices.set([a, a + width, a + 1, a + 1, a + width, a + width + 1], n); n += 6;
  }
  return { positions, ground, indices };
}
