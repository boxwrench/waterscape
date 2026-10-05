import * as THREE from "../../vendor/three/three.webgpu.js";
import {
  abs, cameraPosition, clamp, dot, float, mix, mx_noise_float, normalize, pow, smoothstep,
  texture, vec3,
} from "../../vendor/three/three.tsl.js";
import { triplanar } from "../../renderer/land/granite.js";

const ROOT = new URL("../../data/biomes/diablo-oak/ground/", import.meta.url),
  LUMA = vec3(0.2126, 0.7152, 0.0722),
  SCALE = 9,
  TURN_COS = 0.6,
  TURN_SIN = 0.8;

function turned(p) {
  return vec3(p.x.mul(TURN_COS).sub(p.z.mul(TURN_SIN)), p.y,
    p.x.mul(TURN_SIN).add(p.z.mul(TURN_COS))).add(37.3);
}

function turnedNormal(n) {
  return vec3(n.x.mul(TURN_COS).sub(n.z.mul(TURN_SIN)), n.y,
    n.x.mul(TURN_SIN).add(n.z.mul(TURN_COS)));
}

function weights(n) {
  const w = pow(abs(n), vec3(4));
  return w.div(w.x.add(w.y).add(w.z).max(1e-5));
}

// Decode tangent slopes in the SAME fixed UV axes as the unreflected color samples.
// World UV gradients are independent of face direction; project their blend onto
// the actual tangent plane below. Flipping only normal U/V would detach relief from color.
function projectedNormalOffset(map, p, n, scale, rotated = false) {
  const frame = rotated ? turned(p) : p,
    normal = rotated ? turnedNormal(n) : n,
    w = weights(normal),
    sample = uv => {
      const decoded = texture(map, uv.div(scale)).xyz.mul(2).sub(1);
      return decoded.xy.div(decoded.z.max(0.25));
    },
    x = sample(frame.zy), y = sample(frame.xz), z = sample(frame.xy),
    local = vec3(0, x.y, x.x).mul(w.x)
      .add(vec3(y.x, 0, y.y).mul(w.y))
      .add(vec3(z.x, z.y, 0).mul(w.z));
  if (!rotated) return local;
  return vec3(local.x.mul(TURN_COS).add(local.z.mul(TURN_SIN)), local.y,
    local.x.mul(TURN_SIN).negate().add(local.z.mul(TURN_COS)));
}

export async function loadTerrainSurfaceDetail() {
  const loader = new THREE.TextureLoader(),
    [colorMap, normalMap] = await Promise.all([
      loader.loadAsync(new URL("rock_color.jpg", ROOT).href),
      loader.loadAsync(new URL("rock_normal.jpg", ROOT).href),
    ]);
  for (const map of [colorMap, normalMap]) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;
  }
  colorMap.colorSpace = THREE.SRGBColorSpace;

  return {
    textures: [colorMap, normalMap],
    modulate(p, n, baseColor, steep, strength) {
      const blend = smoothstep(-0.3, 0.3,
          mx_noise_float(vec3(p.x.mul(0.018), p.y.mul(0.001), p.z.mul(0.018)).add(13))),
        colorSample = mix(triplanar(colorMap, p, n, SCALE),
          triplanar(colorMap, turned(p), turnedNormal(n), SCALE * 1.37), blend).rgb,
        luminance = dot(colorSample, LUMA),
        distanceFade = float(1).sub(smoothstep(400, 1400, cameraPosition.sub(p).length())),
        mask = clamp(smoothstep(0.2, 0.65, steep).mul(strength).mul(distanceFade), 0, 1),
        // Use only restrained luminance variation so the caller's Eel palette stays legible.
        colorGain = mix(float(1), clamp(luminance.div(0.0766), 0.82, 1.18), mask),
        firstNormal = projectedNormalOffset(normalMap, p, n, SCALE),
        secondNormal = projectedNormalOffset(normalMap, p, n, SCALE * 1.37, true),
        gradient = mix(firstNormal, secondNormal, blend),
        normalOffset = gradient.sub(n.mul(dot(gradient, n))).mul(mask.mul(0.42));
      return {
        colorNode: baseColor.mul(colorGain),
        // World-space normal; the caller converts it to the view-space basis it needs.
        normalNode: normalize(n.add(normalOffset)),
      };
    },
  };
}
