// Sierra granite for the ground's rock layer, from photographs rather than drawn cracks:
// jointed rock on walls (two scales, so real fractures read close up and across the lake),
// smooth weathered slab on gentle ground and the bleached drawdown band, dark fractured rock
// in the canyon below a dam. Each CC0 photo is sampled triplanar (cliffs are not smeared by a
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

// A layer's photo at `scale` metres, recoloured: photo / its mean × target albedo.
function photo(layer, mean, target, p, n, scale, upright = false) {
  return triplanar(layer.colour, p, n, scale, upright).rgb.div(vec3(...mean)).mul(target);
}

// { albedo, normal } for granite at world p, smooth terrain normal n0 and steepness `slope`
// (1 - n.y). `bank` is 0-1 over the drawdown band, `deep` 0-1 below the dam.
export function graniteRock(tex, g, p, n0, slope, bank, deep) {
  const target = vec3(...g.rock.albedo),
    wall = smoothstep(0.15, 0.45, slope),
    // Slowly turning big faces (no hard steps: at this size they read as polygons).
    bend = normalize(n0.add(mx_noise_vec3(p.mul(0.012)).mul(0.35))),
    // Walls: jointed rock at 7 m, its tone varied by the same photo at 31 m.
    near = photo(tex.joints, g.joints.mean, target, p, bend, 7, true),
    far = triplanar(tex.joints.colour, p, bend, 31, true).rgb,
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
    mix(triplanarNormal(tex.slab.normal, p, bend, 9), triplanarNormal(tex.joints.normal, p, bend, 7, true), wall).add(
      triplanarNormal(tex.joints.normal, p, bend, 31, true).mul(wall.mul(1.3)),
    ),
    triplanarNormal(tex.canyon.normal, p, bend, 6),
    deep,
  );
  return { albedo, normal: normalize(bend.add(offset.mul(0.8))) };
}
