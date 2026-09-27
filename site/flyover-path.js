// Camera pose along a bundle's flyover (cameras.json). Time is eased once over the whole
// flight (smooth start and stop) and positions interpolate linearly between keys, so the
// camera never pauses at a key. Yaw turns the short way. Shared by the journey and the
// flyover renderer.
export function poseAt(flyover, t) {
  const { duration, keys } = flyover,
    f = Math.min(1, Math.max(0, t / duration)),
    u = duration * f * f * (3 - 2 * f);
  if (u <= keys[0].t) return { ...keys[0], t };
  if (u >= keys.at(-1).t) return { ...keys.at(-1), t };
  let i = 1;
  while (keys[i].t < u) i++;
  const a = keys[i - 1],
    b = keys[i],
    s = (u - a.t) / (b.t - a.t),
    mix = (k) => a[k] + (b[k] - a[k]) * s,
    turn = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
  return { t, x: mix("x"), y: mix("y"), z: mix("z"), yaw: a.yaw + turn * s, pitch: mix("pitch") };
}
