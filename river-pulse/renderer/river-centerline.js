function expectedUtmCrs(terrain) {
  return `EPSG:${32600 + Number(terrain.meta.utmZone)}`;
}

function clipSegmentToBounds(a, b, bounds) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    p = [-dx, dx, -dz, dz],
    q = [a.x - bounds.xMin, bounds.xMax - a.x, a.z - bounds.zMin, bounds.zMax - a.z];
  let t0 = 0,
    t1 = 1;

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }

  return [
    { x: a.x + t0 * dx, z: a.z + t0 * dz },
    { x: a.x + t1 * dx, z: a.z + t1 * dz },
  ];
}

export function projectedToScene(terrain, [east, north]) {
  const [originEast, originNorth] = terrain.meta.originUTM;
  return { x: east - originEast, z: originNorth - north };
}

export function buildRiverCenterlineSegments(layer, terrain, { lift = 1.5, margin = 40 } = {}) {
  const expected = expectedUtmCrs(terrain);
  if (layer.horizontal_crs !== expected)
    throw new Error(`River geometry CRS ${layer.horizontal_crs} does not match terrain ${expected}`);

  const x1 = terrain.x0 + (terrain.width - 1) * terrain.cellX,
    z1 = terrain.z0 + (terrain.height - 1) * terrain.cellZ,
    bounds = {
      xMin: Math.min(terrain.x0, x1) - margin,
      xMax: Math.max(terrain.x0, x1) + margin,
      zMin: Math.min(terrain.z0, z1) - margin,
      zMax: Math.max(terrain.z0, z1) + margin,
    },
    positions = [],
    featureIds = [];

  for (const feature of layer.features ?? []) {
    for (const path of feature.paths ?? []) {
      for (let i = 1; i < path.length; i++) {
        const a = projectedToScene(terrain, path[i - 1]),
          b = projectedToScene(terrain, path[i]),
          clipped = clipSegmentToBounds(a, b, bounds);
        if (!clipped) continue;
        const [c0, c1] = clipped,
          y0 = terrain.ground(c0.x, c0.z) + lift,
          y1 = terrain.ground(c1.x, c1.z) + lift;
        positions.push(c0.x, y0, c0.z, c1.x, y1, c1.z);
        featureIds.push(feature.feature_id);
      }
    }
  }

  return Object.freeze({
    positions: new Float32Array(positions),
    segment_count: positions.length / 6,
    feature_ids: Object.freeze(featureIds),
    source_crs: layer.horizontal_crs,
    representation: "authoritative-centerline-draped-to-terrain",
  });
}
