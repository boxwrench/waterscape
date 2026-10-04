// Reproducible review cameras in the native USGS anchor frame; y is NAVD88 metres.
export const EEL_SEED = 17041;
export const EEL_CAMERAS = {
  overview: { label: "Reach overview", position: [-1300, 1950, 450], target: [250, 60, -1100], fov: 48 },
  primary: { label: "Scotia Bluffs", position: [320, 190, -900], target: [1100, 100, -1300], fov: 52 },
  eye: { label: "Across the river", position: [710, null, -1320], target: [1140, 75, -1470], fov: 58 },
  shore: { label: "Water & gravel", position: [835, null, -1180], target: [920, 14.5, -1220], fov: 60 },
  bend: { label: "Downstream bend", position: [600, 310, -1680], target: [-500, 35, -2110], fov: 54 },
};

export function reviewCamera(id, terrain) {
  const preset = EEL_CAMERAS[id];
  if (!preset) throw new Error(`Unknown Eel camera: ${id}`);
  const position = [...preset.position];
  position[1] ??= terrain.ground(position[0], position[2]) + 1.8;
  return { ...preset, position, target: [...preset.target] };
}

export function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function mappedRiverAt(x, z, polygons) {
  return polygons.some(p => p.properties.featuretypelabel === "River" &&
    pointInRing(x, z, p.rings[0]) && !p.rings.slice(1).some(r => pointInRing(x, z, r)));
}

// Marching triangles produces sub-cell boundaries rather than square raster edges.
// This is a visual interpolation of a classification, never a surveyed shoreline.
export function clippedWaterTriangle(vertices, threshold = 0.5) {
  const result = [];
  for (let i = 0; i < 3; i++) {
    const a = vertices[i], b = vertices[(i + 1) % 3], ain = a.w >= threshold, bin = b.w >= threshold;
    if (ain) result.push(a);
    if (ain !== bin) {
      const t = (threshold - a.w) / (b.w - a.w);
      result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
        y: a.y + (b.y - a.y) * t, w: threshold });
    }
  }
  return result;
}
