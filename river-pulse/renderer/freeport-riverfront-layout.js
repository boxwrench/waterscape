import { freeportChannel, freeportGround } from "./freeport-layout.js";

// Authored local placements fitted to the supplied aerial composition.
export function freeportLeveeRoad(side, z, offset = 0) {
  const { center, halfWidth } = freeportChannel(z), x = center + side * (halfWidth + 27) + offset;
  return { x, y: freeportGround(x, z) + 0.08, z };
}

export function freeportMarinaLayout() {
  const roofs = [], boats = [], z0 = -365, z1 = -175,
    { center, halfWidth } = freeportChannel((z0 + z1) / 2), edge = center + halfWidth;
  for (const [row, inset] of [16, 40].entries()) {
    const x = edge - inset;
    roofs.push({ x, z0, z1, width: 11, y: 3.7 });
    for (let i = 0; i < 17; i++) boats.push({
      x: x - 8, z: z0 + 8 + i * 10.5, yaw: -Math.PI / 2,
      length: 7.3 + ((i * 7 + row * 3) % 6) * 0.6, width: 2.4 + (i % 3) * 0.18,
      cabin: i % 3 === 0, color: (i + row) % 4,
    });
  }
  return { roofs, boats, edge, z0, z1 };
}
