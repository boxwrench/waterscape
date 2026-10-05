// Translate a camera, not terrain or water state, between two compatible source frames.
export function riverPoseToReservoir(position, target, river, reservoir) {
  if (!river.crs || river.crs !== reservoir.crs || river.utmZone !== reservoir.utmZone ||
      !river.verticalDatum || river.verticalDatum !== reservoir.verticalDatum)
    throw new Error("Reservoir camera frames must share CRS, UTM zone and vertical datum.");
  if (![...position, ...target, ...river.originUTM, ...reservoir.originUTM,
    river.sceneVerticalOffset ?? 0, reservoir.waterLevel].every(Number.isFinite) ||
      position.length !== 3 || target.length !== 3)
    throw new Error("Reservoir camera coordinates must be finite metres.");
  const convert = ([x, y, z]) => [
    river.originUTM[0] + x - reservoir.originUTM[0],
    y + (river.sceneVerticalOffset ?? 0) - reservoir.waterLevel,
    reservoir.originUTM[1] - river.originUTM[1] + z,
  ], [x, y, z] = convert(position), [tx, ty, tz] = convert(target),
    dx = tx - x, dy = ty - y, dz = tz - z;
  if (Math.hypot(dx, dy, dz) === 0) throw new Error("Reservoir camera needs a distinct target.");
  return { x, y, z, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), speed: 6 };
}
