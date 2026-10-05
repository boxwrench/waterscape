// Authored setting constrained by the bundled terrain, not surveyed bank assets.
export function localReach(document, terrain) {
  const segments = [];
  let focus = null;
  for (const feature of document.features ?? []) {
    if (feature.name !== "Russian River") continue;
    for (const line of feature.lines ?? []) for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], [bx, bz] = line[i],
        dx = bx - ax, dz = bz - az, length2 = dx * dx + dz * dz;
      if (!length2) continue;
      const segment = { ax, az, dx, dz, length2,
        ay: terrain.ground(ax, az), by: terrain.ground(bx, bz) };
      segments.push(segment);
      const t = Math.max(0, Math.min(1, -(ax * dx + az * dz) / length2)),
        x = ax + dx * t, z = az + dz * t, distance = Math.hypot(x, z);
      if (!focus || distance < focus.distance) focus = { x, z, distance, segment };
    }
  }
  if (!focus) return null;
  const length = Math.sqrt(focus.segment.length2),
    tangent = { x: focus.segment.dx / length, z: focus.segment.dz / length },
    normal = { x: -tangent.z, z: tangent.x };
  if (normal.x > 0) { normal.x *= -1; normal.z *= -1; }
  function sample(x, z) {
    let nearest = Infinity, y = 0, centerX = 0, centerZ = 0;
    for (const s of segments) {
      const t = Math.max(0, Math.min(1, ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.length2)),
        distance = Math.hypot(x - s.ax - s.dx * t, z - s.az - s.dz * t);
      if (distance < nearest) {
        nearest = distance; y = s.ay + (s.by - s.ay) * t + 0.24;
        centerX = s.ax + s.dx * t; centerZ = s.az + s.dz * t;
      }
    }
    return { distance: nearest, y, centerX, centerZ };
  }
  let lo = 0, hi = 1;
  while (hi < 80 && terrain.ground(focus.x + normal.x * hi, focus.z + normal.z * hi) <= sample(focus.x + normal.x * hi, focus.z + normal.z * hi).y) {
    lo = hi; hi += 1;
  }
  if (hi >= 80) return null;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2, x = focus.x + normal.x * mid, z = focus.z + normal.z * mid;
    if (terrain.ground(x, z) > sample(x, z).y) hi = mid; else lo = mid;
  }
  const shoreline = { x: focus.x + normal.x * hi, z: focus.z + normal.z * hi };
  shoreline.y = terrain.ground(shoreline.x, shoreline.z);
  const x = shoreline.x + normal.x * 0.8, z = shoreline.z + normal.z * 0.8,
    targetX = focus.x + tangent.x * 60, targetZ = focus.z + tangent.z * 60,
    camera = { x, z, y: terrain.ground(x, z) + 1.8,
      yaw: Math.atan2(targetX - x, z - targetZ), pitch: -0.22, speed: 4 };
  function shoreAt(along, side = 1) {
    const center = sample(focus.x + tangent.x * along, focus.z + tangent.z * along);
    for (let cross = 1; cross < 80; cross++) {
      const x = center.centerX + normal.x * cross * side,
        z = center.centerZ + normal.z * cross * side, y = terrain.ground(x, z);
      if (y > sample(x, z).y) return { x, y, z };
    }
    return null;
  }
  return { focus, tangent, normal, sample, shoreline, camera, shoreAt };
}

export function seededRandom(seed = 41) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

export function bankTreeSites(reach, terrain) {
  const random = seededRandom(41), sites = [];
  // Four stands on each bank, with overlapping crowns and gaps toward the water.
  for (const side of [-1, 1]) for (const along of [-100, -40, 55, 120]) {
    for (let i = 0; i < 6; i++) {
      const cross = side * (48 + random() * 30), advance = along + (random() - 0.5) * 34,
        x = reach.focus.x + reach.normal.x * cross + reach.tangent.x * advance,
        z = reach.focus.z + reach.normal.z * cross + reach.tangent.z * advance,
        y = terrain.ground(x, z), sample = reach.sample(x, z);
      if (y < sample.y + 1 || sample.distance < 35 || y > sample.y + 38) continue;
      sites.push({ x, y, z, scale: 0.38 + random() * 0.23, turn: random() * Math.PI * 2 });
    }
  }
  return sites;
}
