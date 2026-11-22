// Clearings: ground kept free of oaks (meshes and impostors) or of the grass field, around a
// landmark from structures.json (landmarks.js). Each clearing is a rounded rectangle in scene
// metres: centre (x, z), unit axis (ux, uz), half-lengths hs along and ht across, corner radius
// r. The kernel's distant crowns (water.cu, beyond the impostor range) do not know about them.
import { float, abs, max, min, vec2, select } from "../../vendor/three/three.tsl.js";

// Signed distance (m) from (x, z) to a clearing: negative inside.
export function clearingDistance(c, x, z) {
  const dx = x - c.x,
    dz = z - c.z,
    s = Math.abs(dx * c.ux + dz * c.uz) - c.hs,
    t = Math.abs(-dx * c.uz + dz * c.ux) - c.ht;
  return Math.hypot(Math.max(s, 0), Math.max(t, 0)) + Math.min(Math.max(s, t), 0) - c.r;
}

export function inClearing(list, x, z, margin = 0) {
  return (list ?? []).some((c) => clearingDistance(c, x, z) < margin);
}

// The same test as a shader node: 1 inside any clearing (grown by `margin` metres), else 0.
// The clearings are fixed for a scene, so they are written into the shader as constants.
export function clearingNode(list, x, z, margin = 0) {
  let inside = float(0);
  for (const c of list ?? []) {
    const dx = x.sub(c.x),
      dz = z.sub(c.z),
      s = abs(dx.mul(c.ux).add(dz.mul(c.uz))).sub(c.hs),
      t = abs(dx.mul(-c.uz).add(dz.mul(c.ux))).sub(c.ht),
      d = vec2(max(s, 0), max(t, 0)).length().add(min(max(s, t), 0)).sub(c.r + margin);
    inside = max(inside, select(d.lessThan(0), float(1), float(0)));
  }
  return inside;
}
