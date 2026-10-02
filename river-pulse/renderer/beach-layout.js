// Photo-informed local stage, deliberately separate from georeferenced map terrain.
// All dimensions except the documented bridge span/road width are authored estimates.
export function bankEdges(z) {
  const t = Math.max(0, Math.min(1, (-z - 130) / 170)),
    bend = 5 * Math.sin((z + 55) / 85) - 65 * t * t * (3 - 2 * t);
  const spit = 17 * Math.exp(-Math.pow((z - 25) / 32, 2));
  return { left: -31 + bend + spit, right: 32 + bend + 2 * Math.sin(z / 27) };
}

export function beachGround(x, z) {
  const e = bankEdges(z), outward = Math.max(e.left - x, x - e.right, (-z - 300) * 0.6),
    variation = Math.sin(x * 0.24 + z * 0.13) * Math.sin(z * 0.18) * 0.1;
  if (outward < 0) return -Math.min(2.8, -outward * 0.12) + variation * Math.min(1, -outward);
  const left = x < e.left, t = Math.max(0, Math.min(1, (z + 65) / 45)),
    slope = left ? 0.34 - 0.27 * t * t * (3 - 2 * t) : 0.55,
    terrace = outward * slope, ridge = Math.max(0, outward - 20) * 0.24;
  const relief = (Math.sin(z * 0.05 + x * 0.07) * 1.4 + Math.sin(z * 0.12 - x * 0.09) * 0.65)
    * Math.min(1, outward / 10);
  return Math.max(outward * 0.02, Math.min(55, terrace + ridge + relief + variation * Math.min(1, outward)));
}

export const BEACH_CAMERA = Object.freeze({ x: -16.9, y: 1.86, z: 25,
  yaw: 0.12, pitch: -0.08, speed: 2.5 });
export const BRIDGE_CAMERA = Object.freeze({ x: -25, y: 1.95, z: -12,
  yaw: 0.3, pitch: 0.015, speed: 2.5 });

export function constrainBeachCamera(state, waterLevel = -Infinity) {
  state.z = Math.max(-35, Math.min(70, state.z));
  const edge = bankEdges(state.z);
  state.x = Math.max(edge.left - 9, Math.min(edge.left - 0.5, state.x));
  state.y = Math.max(beachGround(state.x, state.z) + 1.8, waterLevel + 1.2);
  state.speed = 2.5;
  state.pitch = Math.max(-0.8, Math.min(0.55, state.pitch));
}

// The surface is built wider than the banks so a high stage can spread over them. Each vertex
// keeps the authored bed height; the shader derives depth from the surface height, so the
// waterline follows the terrain as the level changes.
export function beachWaterGrid({ flood = 34 } = {}) {
  const positions = [], depths = [], beds = [], indices = [], across = 200, along = 250;
  for (let j = 0; j <= along; j++) {
    const z = 105 - j * 1.6, e = bankEdges(z), left = e.left - flood, width = e.right + flood - left;
    for (let i = 0; i <= across; i++) {
      const x = left + width * i / across, bed = beachGround(x, z);
      positions.push(x, 0, z); depths.push(Math.max(0.01, -bed)); beds.push(bed);
    }
  }
  for (let j = 0; j < along; j++) for (let i = 0; i < across; i++) {
    const a = j * (across + 1) + i, b = a + 1, c = a + across + 1, d = c + 1;
    indices.push(a, b, c, b, d, c);
  }
  return { positions: new Float32Array(positions), depths: new Float32Array(depths),
    beds: new Float32Array(beds), indices: new Uint32Array(indices), focus: { x: 0, y: 0, z: -85 },
    representation: "Illustrative photo-informed Hacienda reach; surface and bed are authored, not gauge stage or surveyed bathymetry" };
}
