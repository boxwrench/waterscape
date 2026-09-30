// Adapted from Tidewater's SeaDetail.js makeNoiseTexture (MIT).
// Copyright (c) 2026 DRG Software Solutions LLC. See THIRD_PARTY_NOTICES.md.
import * as THREE from "../../vendor/three/three.webgpu.js";
import { seededRandom } from "./bank-setting-layout.js";

export function createJennerNoise(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let c = 0; c < 4; c++) {
    const random = seededRandom(11 + c * 17), tables = [], values = new Float32Array(size * size);
    for (let o = 0; o < 4; o++) {
      const n = (4 + c) << o, gradients = new Float32Array(n * n * 2);
      for (let i = 0; i < n * n; i++) {
        const angle = random() * Math.PI * 2;
        gradients[i * 2] = Math.cos(angle); gradients[i * 2 + 1] = Math.sin(angle);
      }
      tables.push({ n, gradients });
    }
    let minimum = Infinity, maximum = -Infinity;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let value = 0, amplitude = 1, total = 0;
      for (const { n, gradients } of tables) {
        const fx = x / size * n, fy = y / size * n, ix = Math.floor(fx), iy = Math.floor(fy),
          dx = fx - ix, dy = fy - iy,
          fade = v => v * v * v * (v * (v * 6 - 15) + 10), u = fade(dx), v = fade(dy),
          grad = (gx, gy, tx, ty) => {
            const k = (((gy % n) + n) % n) * n + (((gx % n) + n) % n);
            return gradients[k * 2] * tx + gradients[k * 2 + 1] * ty;
          },
          a = grad(ix, iy, dx, dy), b = grad(ix + 1, iy, dx - 1, dy),
          d = grad(ix, iy + 1, dx, dy - 1), e = grad(ix + 1, iy + 1, dx - 1, dy - 1),
          lower = a + (b - a) * u, upper = d + (e - d) * u;
        value += (lower + (upper - lower) * v) * amplitude;
        total += amplitude; amplitude *= 0.5;
      }
      value /= total; values[y * size + x] = value;
      minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
    }
    for (let i = 0; i < values.length; i++) data[i * 4 + c] = Math.round((values[i] - minimum) / (maximum - minimum) * 255);
  }
  const result = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.magFilter = THREE.LinearFilter; result.minFilter = THREE.LinearMipmapLinearFilter;
  result.generateMipmaps = true; result.anisotropy = 4; result.needsUpdate = true;
  return result;
}
