// Fractured granite for the ground's rock layer: sub-grid detail the 10 m lidar cannot hold.
// Granite breaks along joint sets — families of near-parallel planes: two vertical sets at
// different strikes and a dipping sheeting set (exfoliation). Each set is a warped stack of
// planes; its cracks run long, fairly straight and die out where a slow noise closes them.
// Close up, the blocks between planes keep their own flat faces, tilted a little from the
// terrain normal, so light breaks into angular facets; at wall scale the faces turn smoothly
// (hard steps there read as polygons). The rock photograph is sampled triplanar, so cliffs
// are not smeared by a top-down projection. Setting only; tuned to photographs of Hetch
// Hetchy (see data/biomes/sierra-granite/biome.json).
import {
  texture, vec3, float, floor, fract, sin, dot, abs, pow, mix, normalize, smoothstep, fwidth, mx_noise_float,
  mx_noise_vec3,
} from "../../vendor/three/three.tsl.js";

// A pseudo-random vec3 in [0, 1) per integer cell.
const hash3 = (c) =>
  fract(
    sin(vec3(dot(c, vec3(127.1, 311.7, 74.7)), dot(c, vec3(269.5, 183.3, 246.1)), dot(c, vec3(113.5, 271.9, 124.6)))).mul(
      43758.5453,
    ),
  );

// Triplanar sample of a tiling texture at world p, blended by the normal n.
export function triplanar(tex, p, n, scale) {
  const w0 = pow(abs(n), vec3(4)),
    w = w0.div(w0.x.add(w0.y).add(w0.z));
  return texture(tex, p.zy.div(scale))
    .mul(w.x)
    .add(texture(tex, p.xz.div(scale)).mul(w.y))
    .add(texture(tex, p.xy.div(scale)).mul(w.z));
}

// The biome's joint sets: unit direction (plane normal), spacing (m), the share of planes that
// never open (`closed`), and the gate that closes the rest in places (0 all open, 1 none).
const SETS = [
  { d: [0.82, 0, 0.57], spacing: 6, closed: 0.55, gate: 0.45 },
  { d: [-0.5, 0, 0.87], spacing: 9, closed: 0.6, gate: 0.5 },
  { d: [0.33, 0.94, 0], spacing: 5, closed: 0.7, gate: 0.55 },
];

// One octave of joints at `scale` × the set spacings: { shade, normal }.
function joints(p, n0, scale, tilt, crack, seed, toneAmp = 0.25) {
  let id = vec3(seed),
    dark = float(0),
    far = float(0),
    flat = float(0);
  SETS.forEach((set, k) => {
    const s = set.spacing * scale,
      // Gentle warp so planes are not ruled lines.
      warp = mx_noise_float(p.mul(0.02 / scale).add(seed + k * 7)).mul(0.35),
      c = dot(p, vec3(...set.d)).div(s).add(warp),
      idx = floor(c),
      // Distance to the nearest plane of the set, in metres; crack width ~0.3 m × scale.
      dist = abs(fract(c).sub(0.5)).mul(-1).add(0.5).mul(s),
      aa = fwidth(c).mul(s),
      line = float(1).sub(smoothstep(aa.max(0.12 * scale), aa.mul(2).max(0.12 * scale).add(0.25 * scale), dist)),
      // Where the joint is closed: a slow noise over the plane, so cracks end.
      open = smoothstep(set.gate, set.gate + 0.12, mx_noise_float(p.mul(0.035 / scale).add(idx.mul(3.7)).add(k)).mul(0.5).add(0.5))
        // Whole planes stay closed, so open joints are irregularly spaced.
        .mul(smoothstep(set.closed, set.closed + 0.02, fract(sin(idx.mul(12.9898).add(k * 78.233 + seed)).mul(43758.5453))));
    dark = dark.max(line.mul(open));
    // Faces change every few planes, not at each one (most planes are closed).
    id = id.add(vec3(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0).mul(floor(c.mul(0.4))));
    far = far.max(smoothstep(0.12, 0.3, fwidth(c)));
    // Facets fade much sooner than cracks: a block under ~15 pixels reads as a polygon.
    flat = flat.max(smoothstep(0.03, 0.08, fwidth(c)));
  });
  const h = hash3(id.add(17)),
    face = normalize(n0.add(h.sub(0.5).mul(tilt))),
    tone = mix(h.x.sub(0.5).mul(toneAmp).add(1), float(1), flat);
  return {
    shade: mix(tone.mul(float(1).sub(dark.mul(crack))), float(1), far),
    normal: normalize(mix(face, n0, flat.max(far))),
  };
}

// Rock at world p with smooth terrain normal n0 → { shade (albedo factor), normal }.
// `f` is the biome's rock.fracture: face tilt, crack darkness and `large`, the scale of a
// second octave of big faces that still reads across the lake (0 for none).
export function fracture(p, n0, f) {
  const fine = joints(p, n0, 1, f.tilt, f.crack, 0);
  let shade = fine.shade,
    normal = fine.normal;
  if (f.large) {
    // Big faces: planes that turn smoothly (per-block steps at this size read as polygons),
    // with faint long cracks from the joint sets at the large spacing.
    const big = joints(p, n0, f.large, 0, f.crack * 0.6, 11, 0),
      bend = mx_noise_vec3(p.mul(0.012)),
      face = normalize(n0.add(bend.mul(f.tilt * 0.45)));
    normal = normalize(normal.add(face.sub(n0)));
    shade = shade.mul(big.shade).mul(mx_noise_float(p.mul(0.008).add(5)).mul(0.14).add(1));
  }
  return { shade, normal };
}
