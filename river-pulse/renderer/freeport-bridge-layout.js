// Overall horizontal dimensions: archived 2012 NBI, bridge 24C0001.
// All elevations, other span splits and member sizes are photo-fitted estimates.
export const FREEPORT_BRIDGE = Object.freeze({
  length: 198.9,
  mainSpan: 68.9,
  roadway: 6.4,
  deckWidth: 6.8,
  fixedSpan: 37.5,
  eastPony: 30.7848, // 101 ft approach in historical documentation.
  deckY: 6.2,
  trussZ: 3.85,
  fixedTop: 13.5,
  towerTop: 20.6,
  x: -18,
  z: -95,
  yaw: -0.04,
  source: "https://historicbridges.org/california/freeportbridge/nbisheet.pdf",
});

export function bridgeToWorld(x, y, z) {
  const b = FREEPORT_BRIDGE, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  return { x: b.x + c * x + s * z, y, z: b.z - s * x + c * z };
}

export function worldToBridge(x, z) {
  const b = FREEPORT_BRIDGE, dx = x - b.x, dz = z - b.z, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  return { x: c * dx - s * dz, z: s * dx + c * dz };
}

export function bridgeCamera(x, y, z, tx = 0, ty = 10, tz = 0) {
  const p = bridgeToWorld(x, y, z), target = bridgeToWorld(tx, ty, tz),
    dx = target.x - p.x, dz = target.z - p.z;
  return { ...p, target, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(target.y - y, Math.hypot(dx, dz)) };
}

export const FREEPORT_BRIDGE_ANGLES = {
  southeast: { ...bridgeCamera(102, 3.5, 38, 20, 9), label: "Southeast bank" },
  northeast: { ...bridgeCamera(112, 5, -22, 67, 9), label: "Northeast bank" },
  southwest: { ...bridgeCamera(-107, 5, 66, 6, 9), label: "Southwest bank" },
  northwest: { ...bridgeCamera(-108, 5, -60, 0, 9), label: "Northwest bank" },
  east: { ...bridgeCamera(91, 7.9, 0, 0, 8.4), label: "East approach" },
  west: { ...bridgeCamera(-83, 7.9, 0, 0, 8.4), label: "West approach" },
  underside: { ...bridgeCamera(59, 1.6, 31, 61, 6.2, 0), label: "Piers and underside" },
  above: { ...bridgeCamera(65, 70, 75, 0, 7, 0), label: "Above the bridge" },
};

export function freeportBridgeCamera(angle, portrait = false) {
  const view = FREEPORT_BRIDGE_ANGLES[angle];
  if (!portrait) return { ...view };
  if (angle === "above") return { ...view, ...bridgeCamera(155, 125, 60, 0, 7, 0) };
  if (angle === "underside") return { ...view, ...bridgeCamera(64, 1.6, 31, 66, 4.5, 0) };
  if (angle !== "east" && angle !== "west") {
    // Portrait frames the near counterweight assembly instead of clipping it offscreen.
    const side = angle.includes("west") ? -1 : 1;
    return { ...view, target: bridgeToWorld(side * 57, 10.5, 0) };
  }
  return { ...view };
}
