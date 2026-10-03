// Sierra granite for the ground's rock layer, from photographs rather than drawn cracks:
// streaked wall rock (two scales, so it reads close up and across the lake), speckled rough
// granite on gentle ground and the bleached drawdown band, smooth water-polished rock in the
// canyon below a dam. A layer marked `upright` turns its side projections 90°. Each CC0 photo is sampled triplanar (cliffs are not smeared by a
// top-down projection), normalised by its mean colour to the biome's granite albedo, and its
// normal map perturbs the terrain normal. Big faces turn slowly with a low-frequency bend.
// Setting only; tuned to photographs of Hetch Hetchy (data/biomes/sierra-granite/biome.json).
import {
  texture, vec2, vec3, float, abs, pow, dot, mix, normalize, smoothstep, mx_noise_float, mx_noise_vec3,
} from "../../vendor/three/three.tsl.js";

const LUMA = vec3(0.2126, 0.7152, 0.0722);

// Triplanar blend weights for normal n.
function weights(n) {
  const w0 = pow(abs(n), vec3(4));
  return w0.div(w0.x.add(w0.y).add(w0.z));
}

// Triplanar sample of a tiling texture at world p, blended by the normal n. `upright` turns
// the side projections 90° (the photo's layering then runs up a wall: granite's vertical
// joints, not sedimentary beds).
export function triplanar(tex, p, n, scale, upright = false) {
  const w = weights(n);
  return texture(tex, (upright ? p.yz : p.zy).div(scale))
    .mul(w.x)
    .add(texture(tex, p.xz.div(scale)).mul(w.y))
    .add(texture(tex, (upright ? p.yx : p.xy).div(scale)).mul(w.z));
}

// Triplanar normal map (OpenGL convention) as a world-space offset to add to n ("UDN" blend).
function triplanarNormal(tex, p, n, scale, upright = false) {
  const w = weights(n),
    t = (uv) => texture(tex, uv).xyz.mul(2).sub(1);
  const tx = t((upright ? p.yz : p.zy).div(scale)),
    ty = t(p.xz.div(scale)),
    tz = t((upright ? p.yx : p.xy).div(scale));
  // Tangent u/v follow the projection's axes (swapped when upright).
  return (upright ? vec3(0, tx.x, tx.y) : vec3(0, tx.y, tx.x))
    .mul(w.x)
    .add(vec3(ty.x, 0, ty.y.negate()).mul(w.y))
    .add((upright ? vec3(tz.y, tz.x, 0) : vec3(tz.x, tz.y, 0)).mul(w.z));
}

// The same point in a second, rotated and offset frame: a different stretch of the photo, so
// two samples blended by slow noise hide the tile's repeat.
const turned = (p) => vec3(p.x.mul(0.6).sub(p.z.mul(0.8)), p.y.add(p.x.mul(0.3)), p.x.mul(0.8).add(p.z.mul(0.6))).add(37.3);
const tileMix = (p, scale, seed) =>
  smoothstep(-0.3, 0.3, mx_noise_float(p.mul(0.35 / scale).add(seed)));

// A tiling texture without a visible repeat: triplanar at `scale` and at 1.37× in a turned
// frame, chosen between by slow noise.
function untiled(tex, p, n, scale, upright = false) {
  return mix(triplanar(tex, p, n, scale, upright), triplanar(tex, turned(p), n, scale * 1.37, upright), tileMix(p, scale, 3));
}
function untiledNormal(tex, p, n, scale, upright = false) {
  return mix(
    triplanarNormal(tex, p, n, scale, upright),
    triplanarNormal(tex, turned(p), n, scale * 1.37, upright),
    tileMix(p, scale, 3),
  );
}

// A layer's photo at `scale` metres, recoloured: photo / its mean × target albedo, with broad
// light and dark patches over several tiles.
function photo(layer, mean, target, p, n, scale, upright = false) {
  // Mostly the photo's light and dark, in the target's colour; a fifth of its own hue (full
  // hue amplifies a photo's tints, e.g. yellow veins into orange, once divided by its mean).
  const rgb = untiled(layer.colour, p, n, scale, upright).rgb.div(vec3(...mean)),
    grey = vec3(dot(rgb, LUMA)),
    patches = mx_noise_float(p.mul(0.25 / scale).add(11)).mul(0.22).add(1);
  return mix(grey, rgb, 0.2).mul(target).mul(patches);
}

// { albedo, normal } for granite at world p, smooth terrain normal n0 and steepness `slope`
// (1 - n.y). `bank` is 0-1 over the drawdown band, `deep` 0-1 below the dam.
// `relief` (0-1): where measured 1 m relief already shapes n0, the photos' bump and the
// slow bend are mostly turned off.
export function graniteRock(tex, g, p, n0, slope, bank, deep, relief = float(0)) {
  const target = vec3(...g.rock.albedo),
    wall = smoothstep(0.15, 0.45, slope),
    // Slowly turning big faces (no hard steps: at this size they read as polygons).
    bend = normalize(n0.add(mx_noise_vec3(p.mul(0.012)).mul(float(0.35).mul(float(1).sub(relief))))),
    // Walls: jointed rock at 7 m, its tone varied by the same photo at 31 m.
    up = !!g.joints.upright,
    near = photo(tex.joints, g.joints.mean, target, p, bend, 7, up),
    far = triplanar(tex.joints.colour, p, bend, 31, up).rgb,
    variation = dot(far, LUMA).div(dot(vec3(...g.joints.mean), LUMA)).max(0.05),
    // Water stains: the same photo stretched 6× tall on walls reads as vertical streaks.
    streaks = dot(texture(tex.joints.colour, vec2(p.x.add(p.z).div(18), p.y.div(110))).rgb, LUMA)
      .div(dot(vec3(...g.joints.mean), LUMA))
      .max(0.05),
    walls = near.mul(variation).mul(mix(float(1), pow(streaks, 0.8), wall)),
    // Gentle ground: smooth weathered slab, mottled at 60 m.
    slab = photo(tex.slab, g.slab.mean, target, p, bend, 9).mul(mx_noise_float(p.mul(0.017)).mul(0.18).add(1)),
    // The drawdown band: the same slab, bleached pale (no lichen or stain below full pool).
    bleached = mix(slab, vec3(dot(slab, LUMA)), 0.6).mul(1.45),
    // Below a dam: the fractured-rock photo's texture in the same granite colour, a little
    // darker where the river keeps it wet.
    canyon = photo(tex.canyon, g.canyon.mean, target.mul(g.rock.canyon?.gain ?? 1), p, bend, 6);
  let albedo = mix(slab, walls, wall);
  albedo = mix(albedo, bleached, bank);
  albedo = mix(albedo, canyon, deep);
  const offset = mix(
    mix(untiledNormal(tex.slab.normal, p, bend, 9), untiledNormal(tex.joints.normal, p, bend, 7, up), wall).add(
      triplanarNormal(tex.joints.normal, p, bend, 31, up).mul(wall.mul(1.3)),
    ),
    untiledNormal(tex.canyon.normal, p, bend, 6),
    deep,
  );
  return { albedo, normal: normalize(bend.add(offset.mul(mix(float(0.8), float(0.25), relief)))) };
}
