// Camera math shared by the engine and the page: the same view ray the shader casts, and
// keyboard flight over the lidar surface.

// Same camera ray as ray() in renderer/water.cu, so picking matches the image.
export function viewRay(sx, sy, aspect, yaw, pitch) {
  const cy = Math.cos(yaw),
    syaw = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    f = 0.62487,
    d = [
      syaw * cp + sx * aspect * f * cy - sy * f * syaw * sp,
      sp + sy * f * cp,
      -cy * cp + sx * aspect * f * syaw + sy * f * cy * sp,
    ],
    l = Math.hypot(...d);
  return d.map((v) => v / l);
}

// The shader adds up to ~1.4 m of sub-grid relief on top of the lidar surface.
export function terrainClearance(terrain, x, z) {
  return terrain.ground(x, z) + 2.5;
}

// Flight speed scales with height above the ground, like a map fly-through: precise when
// skimming the grass, kilometres in seconds once you climb. 1× below 25 m, 20× at 500 m.
export function altitudeFactor(state, terrain) {
  const above = state.y - terrain.ground(state.x, state.z);
  return Math.min(80, Math.max(1, above / 25));
}

// Arrows turn, W/S along the view, A/D sideways, E/Q up and down, Shift boosts; `cruise`
// drifts forward. Moves `state` in place and returns the speed multiplier used.
export function fly(state, { keys, cruise }, dt, terrain) {
  const boost =
      (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 6 : 1) * altitudeFactor(state, terrain),
    speed = state.speed * boost * dt;
  state.yaw += ((keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0)) * dt;
  state.pitch = Math.max(
    -1.55,
    Math.min(
      1.55,
      state.pitch + ((keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0)) * dt,
    ),
  );
  let forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0) + (cruise ? 1 : 0),
    side = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
    up = (keys.has("KeyE") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0);
  const length = Math.max(1, Math.hypot(forward, side, up));
  forward /= length;
  side /= length;
  up /= length;
  state.x +=
    speed * (Math.sin(state.yaw) * Math.cos(state.pitch) * forward + Math.cos(state.yaw) * side);
  state.z +=
    speed * (-Math.cos(state.yaw) * Math.cos(state.pitch) * forward + Math.sin(state.yaw) * side);
  state.y = Math.max(
    terrainClearance(terrain, state.x, state.z),
    state.y + speed * (Math.sin(state.pitch) * forward + up),
  );
  return boost;
}
