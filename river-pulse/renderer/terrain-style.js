// Hypsometric display colors, not vegetation or land-cover measurements.
import * as THREE from "../../vendor/three/three.webgpu.js";

export function elevationColors(positions, { low = 0, high = 450 } = {}) {
  const colors = new Float32Array(positions.length),
    valley = new THREE.Color("#547b70"),
    hillside = new THREE.Color("#9caa7c"),
    ridge = new THREE.Color("#dacdab"),
    color = new THREE.Color();
  for (let i = 0; i < positions.length; i += 3) {
    const t = Math.max(0, Math.min(1, (positions[i + 1] - low) / (high - low)));
    if (t < 0.45) color.copy(valley).lerp(hillside, t / 0.45);
    else color.copy(hillside).lerp(ridge, (t - 0.45) / 0.55);
    // Thin elevation bands give the hills a readable contour without changing shape.
    const band = Math.abs(((positions[i + 1] % 25) + 25) % 25);
    if (band < 1) color.multiplyScalar(0.94);
    colors.set([color.r, color.g, color.b], i);
  }
  return colors;
}
