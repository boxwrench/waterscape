import { dot, mix, texture, vec3 } from "../../vendor/three/three.tsl.js";

// Preserve photographic stone detail while grading the selected asset to the
// cool gray beach in the reference photos. Source files remain unchanged.
export function grayStone(tex, uv, desaturation = 0.8) {
  const albedo = texture(tex, uv).rgb,
    luminance = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
  return mix(albedo, vec3(luminance), desaturation).mul(vec3(0.95, 0.98, 1.02));
}
