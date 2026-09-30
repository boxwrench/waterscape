// Man-made structures from a water body's structures.json. Today: concrete gravity dams, built
// along the crest line traced from aerial imagery, at the crest elevation and height on record
// (see data/<id>/structures.json for sources). The cross-section is a generic gravity profile,
// not the as-built drawings. Lit like the trees; alpha 0.5 tells the water kernel the pixel is
// already shaded (pack.js), and hides the water behind it.
import * as THREE from "../../vendor/three/three.webgpu.js";
import {
  texture, positionWorld, normalWorld, cameraPosition, vec2, vec3, float, max, min, dot, normalize, uv, mix,
  smoothstep, fract, abs, pow, reflect, mx_noise_float, time,
} from "../../vendor/three/three.tsl.js";

// Cross-section across the dam in metres: u downstream from the upstream face, y below the
// crest. Closed polygon, walked upstream face → crest (with parapets) → downstream face →
// base. `h` is the dam's height; the base sinks into the rock below the recorded toe.
export function gravityProfile(h) {
  const base = h + 12,
    crest = 7.5,
    parapet = 1.2;
  return [
    [0, -base],
    [0, parapet],
    [0.45, parapet],
    [0.45, 0],
    [crest - 0.45, 0],
    [crest - 0.45, parapet],
    [crest, parapet],
    [crest, -6],
    // Downstream face at ~0.75 horizontal per 1 vertical, the usual gravity-dam batter.
    [crest + 0.75 * (base - 6), -base],
  ];
}

// Crest points [[x, z], ...] resampled every `step` metres along a Catmull-Rom curve.
export function crestCurve(points, step = 4) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  return curve.getSpacedPoints(Math.max(2, Math.round(curve.getLength() / step)));
}

// A dam's crest in scene metres (x east, z south) from its UTM points and the terrain origin.
export function crestScene(dam, meta) {
  const [e0, n0] = meta.originUTM;
  return dam.crestUTM.map(([e, n]) => [e - e0, n0 - n]);
}

// One dam as a BufferGeometry: each profile edge swept along the crest as its own strip, so
// faces keep crisp normals. `downstream` is +1 or -1: which side of the crest line is dry.
export function damGeometry(dam, meta, downstream) {
  const pts = crestCurve(crestScene(dam, meta)),
    profile = gravityProfile(dam.height),
    top = dam.crestElevation - meta.waterLevel,
    positions = [],
    uvs = [],
    index = [];
  let along = 0;
  const frames = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)],
      t = new THREE.Vector3().subVectors(b, a).normalize(),
      n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(downstream);
    if (i) along += p.distanceTo(pts[i - 1]);
    return { p, n, along };
  });
  for (let k = 0; k < profile.length; k++) {
    const [u0, y0] = profile[k],
      [u1, y1] = profile[(k + 1) % profile.length],
      edge = Math.hypot(u1 - u0, y1 - y0),
      start = positions.length / 3;
    for (const { p, n, along } of frames)
      for (const [u, y, v] of [[u0, y0, 0], [u1, y1, edge]]) {
        positions.push(p.x + n.x * u, top + y, p.z + n.z * u);
        uvs.push(along / 11, v / 11);
      }
    for (let i = 0; i + 1 < frames.length; i++) {
      const a = start + i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  // Caps at both abutments: the profile polygon, fanned from its first corner.
  for (const { p, n } of [frames[0], frames.at(-1)]) {
    const start = positions.length / 3;
    for (const [u, y] of profile) {
      positions.push(p.x + n.x * u, top + y, p.z + n.z * u);
      uvs.push(u / 11, y / 11);
    }
    for (let k = 1; k + 1 < profile.length; k++) index.push(start, start + k, start + k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// A river as a ribbon of water along its centre line, at its recorded surface (scene y), each
// point `width` metres across. uv: x metres downstream, y 0-1 across.
export function riverGeometry(river, meta) {
  const [e0, n0] = meta.originUTM,
    pts = river.centreUTM.map(([e, n]) => new THREE.Vector3(e - e0, 0, n0 - n)),
    positions = [],
    uvs = [],
    index = [];
  let along = 0;
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)],
      t = new THREE.Vector3().subVectors(b, a).normalize(),
      half = river.width[i] / 2,
      y = river.surface[i] - meta.waterLevel;
    if (i) along += p.distanceTo(pts[i - 1]);
    for (const s of [-1, 1]) {
      positions.push(p.x - t.z * half * s, y, p.z + t.x * half * s);
      uvs.push(along, (s + 1) / 2);
    }
    if (i) index.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  return g;
}

// Dark canyon water: a slowly moving rippled normal, a Fresnel mix of the sky fill over the
// deep colour, and the sun's glint. Illustrative only (no flow is modelled); tagged as shaded.
function riverMaterial(u) {
  const q = uv(),
    flow = time.mul(0.6),
    nx = mx_noise_float(vec3(q.x.mul(0.25).sub(flow), q.y.mul(3), 1)).mul(0.18),
    nz = mx_noise_float(vec3(q.x.mul(0.25).sub(flow), q.y.mul(3), 7)).mul(0.18),
    n = normalize(vec3(nx, 1, nz)),
    v = normalize(cameraPosition.sub(positionWorld)),
    fres = pow(float(1).sub(max(dot(n, v), 0)), 5).mul(0.95).add(0.05),
    glint = pow(max(dot(reflect(v.negate(), n), u.sun), 0), 120).mul(4),
    deep = vec3(0.006, 0.01, 0.011),
    sky = u.fill.mul(0.3),
    m = new THREE.MeshBasicNodeMaterial({ blending: THREE.NoBlending });
  m.colorNode = mix(deep, sky, fres).add(u.sunColor.mul(glint));
  m.opacityNode = float(0.5);
  return m;
}

export async function createStructures(terrain, structures, ground) {
  const dams = structures?.dams ?? [],
    rivers = structures?.rivers ?? [];
  if (!dams.length && !rivers.length) return null;
  const load = (file, colour) => {
      const t = new THREE.TextureLoader().load(new URL(`../../data/structures/${file}`, import.meta.url).href);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      if (colour) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    },
    concrete = load("concrete_color.jpg", true),
    u = ground.uniforms,
    { width: w, height: h, cell, x0, z0 } = terrain,
    light = texture(ground.lightTex, vec2(positionWorld.x.sub(x0).div(cell).add(0.5).div(w), positionWorld.z.sub(z0).div(cell).add(0.5).div(h))),
    n = normalize(normalWorld),
    // No blending: the 0.5 alpha is a tag for pack.js, and blending a face over another
    // (or over the ground) would change it and turn the dam into plain ground.
    material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, blending: THREE.NoBlending });
  // Weathered grey-tan concrete as in photographs of the downstream face: the texture tinted
  // warm, darker pour lines every 1.5 m of height, panel joints every 15 m along the crest,
  // and broad dark water staining down the face; lit by sun, sky fill and baked terrain light.
  const q = uv(),
    lift = smoothstep(0.9, 0.97, abs(fract(positionWorld.y.div(1.5)).sub(0.5)).mul(2)),
    joint = smoothstep(0.93, 0.99, abs(fract(q.x.mul(11 / 15)).sub(0.5)).mul(2)),
    stain = smoothstep(0.55, 0.85, mx_noise_float(vec3(q.x.mul(0.25), positionWorld.y.mul(0.012), 5)).mul(0.5).add(0.5)),
    photo = texture(concrete, uv()).rgb,
    albedo = mix(photo, vec3(0.36), 0.7)
      .mul(vec3(1.25, 1.17, 1.05))
      .mul(float(1).sub(lift.mul(0.3)).sub(joint.mul(0.2)))
      .mul(mix(float(1), float(0.55), stain));
  material.colorNode = albedo.mul(
    u.sunColor.mul(max(dot(n, u.sun), 0).mul(light.x)).add(u.fill.mul(n.y.mul(0.3).add(0.55).mul(light.y))),
  );
  material.opacityNode = float(0.5);
  const group = new THREE.Group();
  for (const dam of dams) {
    // The dry side is the one whose shore distance grows away from the crest.
    const crest = crestScene(dam, terrain.meta),
      [cx, cz] = crest[Math.floor(crest.length / 2)],
      [ax, az] = crest[0],
      [bx, bz] = crest[crest.length - 1],
      tx = bx - ax,
      tz = bz - az,
      l = Math.hypot(tx, tz),
      side = terrain.shoreDistance(cx - (tz / l) * 40, cz + (tx / l) * 40) > terrain.shoreDistance(cx + (tz / l) * 40, cz - (tx / l) * 40) ? 1 : -1,
      mesh = new THREE.Mesh(damGeometry(dam, terrain.meta, side), material);
    mesh.name = dam.name;
    group.add(mesh);
  }
  if (rivers.length) {
    const water = riverMaterial(u);
    for (const river of rivers) {
      const mesh = new THREE.Mesh(riverGeometry(river, terrain.meta), water);
      mesh.name = river.name;
      group.add(mesh);
    }
  }
  return { group };
}
