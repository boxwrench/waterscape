// Landmarks from structures.json, at their true place and scale. Today: the Pulgas Water Temple
// (Crystal Springs), the Hetch Hetchy Aqueduct's terminus: the maintainer's model of the temple
// (pipeline/structure_mesh.py), its reflecting pool with coping, the paved forecourt with lavender
// beds, the cypress rows along the pool and the canal to the reservoir. Positions and sizes are
// measured on USGS NAIP and 3DEP (sources in structures.json); cypress shapes, lavender, paving
// and colours are illustrative. Lit like the dams (structures.js): sun and sky fill, no cast
// shadows; alpha 0.5 tags the pixels as already shaded for the water kernel (pack.js).
import * as THREE from "../../vendor/three/three.webgpu.js";
import {
  attribute, positionWorld, normalWorld, cameraPosition, vec3, float, max, dot, normalize, mix,
  smoothstep, step, fract, abs, pow, reflect, sqrt, mx_noise_float, time, reflector, Fn,
} from "../../vendor/three/three.tsl.js";

const TAG = 0.5;

// The landmark's frame in scene metres: centre, axis u (towards the pool) and n across it.
function frame(lm, meta) {
  const [e0, n0] = meta.originUTM,
    [e, n] = lm.centreUTM,
    l = Math.hypot(lm.axis[0], lm.axis[1]),
    ux = lm.axis[0] / l,
    uz = -lm.axis[1] / l;
  return {
    x: e - e0,
    z: n0 - n,
    ux,
    uz,
    // (s along the axis, t across) -> scene (x, z).
    at: (s, t) => [e - e0 + ux * s - uz * t, n0 - n + uz * s + ux * t],
  };
}

// The canal's centre line in scene metres: the traced line, carried on to the reservoir's water
// along the shore-distance slope when the bundle's shoreline lies beyond the traced mouth.
function canalLine(lm, terrain) {
  const [e0, n0] = terrain.meta.originUTM,
    pts = lm.canal.centreUTM.map(([e, n]) => [e - e0, n0 - n]);
  let [x, z] = pts.at(-1);
  for (let k = 0; k < 400 && terrain.shoreDistance(x, z) > -2; k++) {
    const e = 2,
      gx = terrain.shoreDistance(x + e, z) - terrain.shoreDistance(x - e, z),
      gz = terrain.shoreDistance(x, z + e) - terrain.shoreDistance(x, z - e),
      g = Math.hypot(gx, gz) || 1;
    x -= (gx / g) * 2;
    z -= (gz / g) * 2;
    if (k % 5 === 4) pts.push([x, z]);
  }
  pts.push([x, z]);
  return pts;
}

// Ground kept free of oaks and of grass (clearings.js), from the landmark's own layout.
export function landmarkClearings(structures, meta, terrain) {
  const trees = [],
    grass = [];
  for (const lm of structures?.landmarks ?? []) {
    const f = frame(lm, meta),
      { pool, cypress, forecourt } = lm,
      r = lm.radius,
      front = pool.centreAlong + pool.length / 2 + 4,
      back = -forecourt.plazaRadius - 2,
      [mx, mz] = f.at((front + back) / 2, 0);
    trees.push({ x: mx, z: mz, ux: f.ux, uz: f.uz, hs: (front - back) / 2, ht: cypress.rowOffset + 5, r: 3 });
    const poolHalf = pool.length / 2 + pool.coping,
      [px, pz] = f.at(pool.centreAlong, 0),
      fcLen = pool.centreAlong - poolHalf,
      [fx, fz] = f.at(fcLen / 2, 0);
    grass.push({ x: f.x, z: f.z, ux: f.ux, uz: f.uz, hs: 0, ht: 0, r: Math.max(forecourt.plazaRadius, r) + 0.3 });
    grass.push({ x: px, z: pz, ux: f.ux, uz: f.uz, hs: poolHalf, ht: pool.width / 2 + pool.coping, r: 0.4 });
    grass.push({ x: fx, z: fz, ux: f.ux, uz: f.uz, hs: fcLen / 2, ht: forecourt.width / 2, r: 0.3 });
    if (terrain) {
      const line = canalLine(lm, terrain);
      for (let i = 0; i + 1 < line.length; i++) {
        const [ax, az] = line[i],
          [bx, bz] = line[i + 1],
          l = Math.hypot(bx - ax, bz - az) || 1,
          seg = { x: (ax + bx) / 2, z: (az + bz) / 2, ux: (bx - ax) / l, uz: (bz - az) / l, hs: l / 2, r: 0 };
        trees.push({ ...seg, ht: lm.canal.width / 2 + 4 });
        grass.push({ ...seg, ht: lm.canal.width / 2 + lm.canal.wall + 0.2 });
      }
    }
  }
  return { trees, grass };
}

// The compact mesh (pipeline/structure_mesh.py) as a BufferGeometry with aClass and aAO.
async function loadMesh(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const fetched = await r.arrayBuffer(),
    gz = new Uint8Array(fetched, 0, 2),
    // Some hosts send .gz with Content-Encoding: gzip, so it may arrive already inflated.
    buf = gz[0] === 0x1f && gz[1] === 0x8b
      ? await new Response(new Blob([fetched]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
      : fetched,
    head = new DataView(buf),
    magic = new TextDecoder().decode(new Uint8Array(buf, 0, 8));
  if (magic !== "WSMESH1\0") throw new Error(`Not a structure mesh: ${url}`);
  const V = head.getUint32(8, true),
    I = head.getUint32(12, true),
    min = [0, 1, 2].map((k) => head.getFloat32(16 + 4 * k, true)),
    size = [0, 1, 2].map((k) => head.getFloat32(28 + 4 * k, true)),
    align = (o) => o + ((4 - (o % 4)) % 4);
  let o = 40;
  const qp = new Uint16Array(buf, o, 3 * V);
  o = align(o + 6 * V);
  const qn = new Int8Array(buf, o, 3 * V);
  o = align(o + 3 * V);
  const qc = new Uint8Array(buf, o, V);
  o = align(o + V);
  const qa = new Uint8Array(buf, o, V);
  o = align(o + V);
  const index = new Uint32Array(buf.slice(o, o + 4 * I)),
    position = new Float32Array(3 * V),
    normal = new Float32Array(3 * V),
    cls = new Float32Array(V),
    ao = new Float32Array(V);
  for (let i = 0; i < V; i++) {
    for (let k = 0; k < 3; k++) {
      position[3 * i + k] = min[k] + (qp[3 * i + k] / 65535) * size[k];
      normal[3 * i + k] = qn[3 * i + k] / 127;
    }
    cls[i] = qc[i];
    ao[i] = qa[i] / 255;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  g.setAttribute("aClass", new THREE.BufferAttribute(cls, 1));
  g.setAttribute("aAO", new THREE.BufferAttribute(ao, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return g;
}

// Sun and sky light on an albedo, as structures.js lights the dams; `open` (0-1) dims the sky.
function lit(u, albedo, n, open = float(1), sunShade = float(1)) {
  return albedo.mul(u.sunColor.mul(max(dot(n, u.sun), 0)).mul(sunShade).add(u.fill.mul(n.y.mul(0.3).add(0.55)).mul(0.85).mul(open)));
}

function basic(colorNode, side = THREE.DoubleSide) {
  const m = new THREE.MeshBasicNodeMaterial({ side, blending: THREE.NoBlending });
  m.colorNode = colorNode;
  m.opacityNode = float(TAG);
  return m;
}

// Cast stone in the model's material classes (stone, ornament, terracotta, recessed), with a
// little grain and staining towards the steps, under baked occlusion.
function templeMaterial(u, base) {
  const n = normalize(normalWorld),
    cls = attribute("aClass", "float"),
    ao = attribute("aAO", "float"),
    stone = vec3(0.62, 0.59, 0.52),
    ornament = vec3(0.66, 0.63, 0.56),
    terracotta = vec3(0.45, 0.21, 0.12),
    recess = vec3(0.44, 0.42, 0.38),
    pick = mix(mix(mix(stone, ornament, step(0.5, cls)), terracotta, step(1.5, cls)), recess, step(2.5, cls)),
    grain = mx_noise_float(positionWorld.mul(2.7)).mul(0.07).add(1),
    stain = smoothstep(base + 2.5, base, positionWorld.y).mul(0.18),
    open = mix(float(0.45), float(1), sqrt(ao)),
    albedo = pick.mul(grain).mul(float(1).sub(stain)),
    // Sunlight thrown back up from the pale paving onto the faces turned towards it.
    bounce = u.sunColor.mul(max(u.sun.y, 0)).mul(n.y.negate().mul(0.5).add(0.5)).mul(0.22).mul(open);
  return basic(lit(u, albedo, n, open, mix(float(0.6), float(1), open)).add(albedo.mul(bounce)));
}

// Still water over a painted turquoise basin (or the canal's darker channel): a slow ripple, a
// Fresnel mix with the sky and the sun's glint.
function waterMaterial(u, body, flow = 0) {
  return basic(
    Fn(() => {
      const p = positionWorld,
        t = time.mul(0.35),
        nx = mx_noise_float(vec3(p.x.mul(0.8).sub(t.mul(flow)), p.z.mul(0.8), t)).mul(0.05),
        nz = mx_noise_float(vec3(p.x.mul(0.8), p.z.mul(0.8).add(t.mul(flow)), t.add(7))).mul(0.05),
        n = normalize(vec3(nx, 1, nz)),
        v = normalize(cameraPosition.sub(p)),
        fres = pow(float(1).sub(max(dot(n, v), 0)), 5).mul(0.9).add(0.06),
        glint = pow(max(dot(reflect(v.negate(), n), u.sun), 0), 220).mul(5),
        base = vec3(...body).mul(u.sunColor.mul(max(u.sun.y, 0)).mul(0.7).add(u.fill.mul(0.9)));
      return mix(base, u.fill.mul(0.85), fres).add(u.sunColor.mul(glint));
    })(),
  );
}

// The reflecting pool: the scene mirrored in its surface (three.js's planar reflector, at full
// resolution), blended with the basin by water's Fresnel term (2% straight down, nearly all at
// grazing angles). Sheltered water this shallow is glass-still: no ripple bends the mirror,
// only a faint, slow swell in the surface normal lets the sky's sheen drift (as River Pulse's
// authored water keeps its mirror offset small). Seen through the water the basin is dark, so
// the reflection reads even looking down at it. Where the mirror sees no geometry it shows a
// sky graded from the preset's fill colour; the kernel's own sky, haze and distant crowns are
// not in it.
function reflectingPool(u, at) {
  const mirror = reflector({ resolutionScale: 1, depth: true, bounces: false }),
    depth = mirror.getDepthNode();
  mirror.target.rotateX(-Math.PI / 2);
  mirror.target.position.copy(at);
  const p = positionWorld,
    t = time.mul(0.05),
    nx = mx_noise_float(vec3(p.x.mul(0.12), p.z.mul(0.12), t)).mul(0.006),
    nz = mx_noise_float(vec3(p.x.mul(0.12), p.z.mul(0.12), t.add(7))).mul(0.006);
  const material = basic(
    Fn(() => {
      const n = normalize(vec3(nx, 1, nz)),
        v = normalize(cameraPosition.sub(p)),
        fres = pow(float(1).sub(max(dot(n, v), 0)), 5).mul(0.98).add(0.02),
        up = reflect(v.negate(), n).y,
        sky = mix(u.fill.mul(1.25).add(vec3(0.16, 0.16, 0.17)), u.fill.mul(1.9), smoothstep(0, 0.6, up)),
        seen = mix(sky, mirror.rgb, step(depth.r, 0.99999)),
        basin = vec3(0.012, 0.045, 0.04).mul(u.sunColor.mul(max(u.sun.y, 0)).mul(0.7).add(u.fill.mul(0.9))),
        glint = pow(max(dot(reflect(v.negate(), n), u.sun), 0), 2000).mul(12);
      return mix(basin, seen, fres).add(u.sunColor.mul(glint));
    })(),
  );
  return { material, target: mirror.target };
}

// Paving: pale concrete slabs in a grid along the axis.
function pavingMaterial(u, f, albedo, slab) {
  const n = normalize(normalWorld),
    dx = positionWorld.x.sub(f.x),
    dz = positionWorld.z.sub(f.z),
    s = dx.mul(f.ux).add(dz.mul(f.uz)),
    t = dz.mul(f.ux).sub(dx.mul(f.uz)),
    joint = max(smoothstep(0.92, 0.98, abs(fract(s.div(slab)).sub(0.5)).mul(2)), smoothstep(0.92, 0.98, abs(fract(t.div(slab)).sub(0.5)).mul(2))),
    mottle = mx_noise_float(vec3(positionWorld.x.mul(0.6), positionWorld.z.mul(0.6), 2)).mul(0.06).add(1);
  return basic(lit(u, vec3(...albedo).mul(mottle).mul(float(1).sub(joint.mul(0.25))), n));
}

// Italian cypress: dense dark foliage in clumps, lighter where the sun catches the tips.
function cypressMaterial(u) {
  const n = normalize(normalWorld),
    p = positionWorld,
    clump = mx_noise_float(p.mul(1.7)).mul(0.5).add(0.5),
    fine = mx_noise_float(p.mul(6.1).add(3)).mul(0.5).add(0.5),
    albedo = mix(vec3(0.035, 0.07, 0.025), vec3(0.11, 0.17, 0.05), clump.mul(0.7).add(fine.mul(0.3))),
    wrap = max(dot(n, u.sun).mul(0.6).add(0.4), 0);
  return basic(albedo.mul(u.sunColor.mul(wrap).mul(clump.mul(0.5).add(0.6)).add(u.fill.mul(0.55).mul(clump.mul(0.4).add(0.6)))));
}

// Lavender: grey-green mounds, flowering purple on top.
function lavenderMaterial(u) {
  const n = normalize(normalWorld),
    p = positionWorld,
    bloom = smoothstep(0.3, 0.7, mx_noise_float(p.mul(5.3)).mul(0.5).add(0.5)),
    fine = mx_noise_float(p.mul(17)).mul(0.5).add(0.5),
    top = smoothstep(0.1, 0.7, n.y),
    albedo = mix(vec3(0.1, 0.12, 0.08), vec3(0.24, 0.17, 0.38), top.mul(bloom.mul(0.6).add(0.4))).mul(fine.mul(0.5).add(0.7));
  return basic(lit(u, albedo, n));
}

// A columnar crown of unit radius and height, base at y = 0: an Italian cypress's flame.
function cypressGeometry() {
  const pts = [];
  for (let k = 0; k <= 24; k++) {
    const t = k / 24,
      r = Math.min(1, Math.sqrt(t / 0.05)) * Math.pow(1 - t, 0.5) * (0.94 + 0.06 * Math.sin(t * 9));
    pts.push(new THREE.Vector2(Math.max(r, 0.001), t));
  }
  const g = new THREE.LatheGeometry(pts, 14);
  // Lumps: push vertices in and out a little so the silhouette is not a smooth spindle.
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i),
      a = Math.atan2(z, x),
      w = 1 + 0.12 * Math.sin(a * 5 + y * 23) * Math.sin(y * 31 + a * 2);
    pos.setXYZ(i, x * w, y, z * w);
  }
  g.computeVertexNormals();
  return g;
}

// A flat slab at height y over a footprint given as scene (x, z) outline, with a skirt down to
// `down` metres below it so uneven ground never shows a gap.
function slab(outline, y, down) {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z))),
    g = new THREE.ExtrudeGeometry(shape, { depth: down, bevelEnabled: false, curveSegments: 48 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y - down, 0);
  return g;
}

function rect(f, s0, s1, t0, t1) {
  return [f.at(s0, t0), f.at(s1, t0), f.at(s1, t1), f.at(s0, t1)];
}

function circle(f, r, n = 64) {
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    return [f.x + Math.cos(a) * r, f.z + Math.sin(a) * r];
  });
}

// Highest ground under a footprint, sampled every 2 m.
function highest(terrain, f, s0, s1, t0, t1) {
  let h = -Infinity;
  for (let s = s0; s <= s1; s += 2)
    for (let t = t0; t <= t1; t += 2) {
      const [x, z] = f.at(s, t);
      h = Math.max(h, terrain.ground(x, z));
    }
  return h;
}

// The canal: water between low concrete walls along its line, stepping down to the lake. The
// bundle's 10 m ground cannot hold a cut channel, so it runs a little above the surface.
function canalGeometry(lm, terrain) {
  const line = canalLine(lm, terrain),
    pts = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, az] = line[i],
      [bx, bz] = line[i + 1],
      l = Math.hypot(bx - ax, bz - az),
      k = Math.max(1, Math.round(l / 2));
    for (let j = 0; j < k; j++) pts.push([ax + ((bx - ax) * j) / k, az + ((bz - az) * j) / k]);
  }
  pts.push(line.at(-1));
  const half = lm.canal.width / 2,
    wall = lm.canal.wall,
    water = [],
    walls = [];
  // The water follows the ground smoothed over ±8 m (never under it), down to the lake's level.
  const ground = pts.map(([x, z]) => terrain.ground(x, z)),
    rows = pts.map(([x, z], i) => {
      const [ax, az] = pts[Math.max(0, i - 1)],
        [bx, bz] = pts[Math.min(pts.length - 1, i + 1)],
        l = Math.hypot(bx - ax, bz - az) || 1,
        nx = -(bz - az) / l,
        nz = (bx - ax) / l,
        near = ground.slice(Math.max(0, i - 4), i + 5),
        g = ground[i],
        y = Math.max(near.reduce((a, b) => a + b, 0) / near.length, ...near.map((h) => h - 0.1)) + 0.25;
      return { x, z, nx, nz, g, y: Math.max(y, 0.04), top: Math.max(y + 0.3, g + 0.35) };
    });
  // Cross-section, left to right: outer foot, wall top, inner top edge, water edge (both sides).
  const section = (r) => [
    [-half - wall, r.g - 0.4], [-half - wall, r.top], [-half, r.top], [-half, r.y - 0.25],
    [half, r.y - 0.25], [half, r.top], [half + wall, r.top], [half + wall, r.g - 0.4],
  ];
  const strip = (target, get) => {
    const positions = [],
      index = [],
      cols = get(rows[0]).length;
    rows.forEach((r) => {
      for (const [o, y] of get(r)) positions.push(r.x + r.nx * o, y, r.z + r.nz * o);
    });
    for (let i = 0; i + 1 < rows.length; i++)
      for (let c = 0; c + 1 < cols; c++) {
        const a = i * cols + c,
          b = a + cols;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    target.push(g);
  };
  strip(walls, section);
  strip(water, (r) => [[-half, r.y], [half, r.y]]);
  return { walls: walls[0], water: water[0], length: rows.length * 2 };
}

export async function createLandmarks(terrain, structures, ground) {
  const list = structures?.landmarks ?? [];
  if (!list.length) return null;
  const u = ground.uniforms,
    group = new THREE.Group(),
    meta = terrain.meta,
    pools = [];
  for (const lm of list) {
    if (lm.type !== "pulgas-temple") continue;
    const f = frame(lm, meta),
      { pool, cypress, forecourt } = lm,
      base = terrain.ground(f.x, f.z) - 0.15;

    // The temple: model x along the pool axis (a gap between columns faces the pool).
    const temple = new THREE.Mesh(await loadMesh(new URL(lm.mesh, structures.base).href), templeMaterial(u, base));
    temple.position.set(f.x, base, f.z);
    temple.rotation.y = Math.atan2(-f.uz, f.ux);
    temple.name = lm.name;
    group.add(temple);

    // Paving: the round plaza about the temple and the forecourt to the pool.
    const poolLo = pool.centreAlong - pool.length / 2 - pool.coping,
      pave = highest(terrain, f, -forecourt.plazaRadius, poolLo, -forecourt.width / 2, forecourt.width / 2) + 0.04,
      paving = pavingMaterial(u, f, [0.4, 0.39, 0.36], 1.2);
    for (const outline of [circle(f, forecourt.plazaRadius), rect(f, 0, poolLo, -forecourt.width / 2, forecourt.width / 2)])
      group.add(new THREE.Mesh(slab(outline, pave, 1.2), paving));

    // The pool: coping all round, the water a little below its top.
    const poolHi = pool.centreAlong + pool.length / 2,
      ph = pool.width / 2,
      top = highest(terrain, f, poolLo, poolHi + pool.coping, -ph - pool.coping, ph + pool.coping) + 0.18,
      coping = pavingMaterial(u, f, [0.6, 0.59, 0.55], 0.9),
      c = pool.coping;
    for (const [s0, s1, t0, t1] of [
      [poolLo, poolHi + c, -ph - c, -ph], [poolLo, poolHi + c, ph, ph + c],
      [poolLo, poolLo + c, -ph, ph], [poolHi, poolHi + c, -ph, ph],
    ])
      group.add(new THREE.Mesh(slab(rect(f, s0, s1, t0, t1), top, 1.4), coping));
    const surface = top - 0.12,
      [pcx, pcz] = f.at((poolLo + c + poolHi) / 2, 0),
      pool_ = reflectingPool(u, new THREE.Vector3(pcx, surface, pcz)),
      still = waterMaterial(u, [0.06, 0.34, 0.33]),
      water = new THREE.Mesh(slab(rect(f, poolLo + c, poolHi, -ph, ph), surface, 0.05), pool_.material);
    water.name = `${lm.name} reflecting pool`;
    group.add(water, pool_.target);
    // The mirror re-renders the scene; far away or on the lowest tier, plain water (update()).
    pools.push({ mesh: water, x: pcx, z: pcz, mirror: pool_.material, still });

    // Lavender beds either side of the path to the front steps: mounds inside a stone edge.
    const bed = forecourt.bed,
      edge = pavingMaterial(u, f, [0.33, 0.32, 0.3], 0.6),
      mound = new THREE.IcosahedronGeometry(1, 2),
      mounds = [];
    for (const side of [-1, 1]) {
      const t0 = side * bed.inner,
        t1 = side * bed.outer;
      group.add(new THREE.Mesh(slab(rect(f, bed.from, bed.to, Math.min(t0, t1), Math.max(t0, t1)), pave + 0.22, 0.3), edge));
      for (let s = bed.from + 0.45; s < bed.to - 0.3; s += 0.5)
        for (let t = bed.inner + 0.45; t < bed.outer - 0.3; t += 0.5) {
          const j = Math.sin(s * 12.9898 + t * 78.233) * 43758.5453,
            r = 0.24 + 0.08 * (j - Math.floor(j));
          mounds.push([...f.at(s, side * t), r]);
        }
    }
    const beds = new THREE.InstancedMesh(mound, lavenderMaterial(u), mounds.length),
      m4 = new THREE.Matrix4();
    mounds.forEach(([x, z, r], i) => beds.setMatrixAt(i, m4.compose(new THREE.Vector3(x, pave + 0.22, z), new THREE.Quaternion(), new THREE.Vector3(r, r * 0.75, r))));
    group.add(beds);

    // Cypress rows along the pool's long sides; heights vary between the recorded bounds.
    const crowns = [],
      [lo, hi] = cypress.height;
    for (const side of [-1, 1])
      for (let s = pool.centreAlong - pool.length / 2 + cypress.spacing / 2; s < poolHi; s += cypress.spacing) {
        const [x, z] = f.at(s, side * cypress.rowOffset),
          j = Math.sin(s * 3.17 + side * 1.9) * 43758.5453,
          h = lo + (hi - lo) * (j - Math.floor(j));
        crowns.push({ x, z, h, g: terrain.ground(x, z), turn: j });
      }
    const crownMesh = new THREE.InstancedMesh(cypressGeometry(), cypressMaterial(u), crowns.length),
      trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1, 7), basic(lit(u, vec3(0.2, 0.18, 0.16), normalize(normalWorld))), crowns.length),
      q = new THREE.Quaternion(),
      upAxis = new THREE.Vector3(0, 1, 0);
    crowns.forEach(({ x, z, h, g, turn }, i) => {
      const crownH = h - cypress.clearTrunk,
        r = cypress.crownRadius;
      crownMesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, g + cypress.clearTrunk - 0.6, z), q.setFromAxisAngle(upAxis, turn), new THREE.Vector3(r, crownH, r)));
      trunkMesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, g + cypress.clearTrunk / 2 - 0.2, z), q.identity(), new THREE.Vector3(1, cypress.clearTrunk + 0.4, 1)));
    });
    crownMesh.name = `${lm.name} cypress`;
    group.add(crownMesh, trunkMesh);

    // The canal to the reservoir.
    const canal = canalGeometry(lm, terrain);
    group.add(new THREE.Mesh(canal.walls, pavingMaterial(u, f, [0.36, 0.35, 0.33], 2)));
    const canalWater = new THREE.Mesh(canal.water, waterMaterial(u, [0.03, 0.12, 0.11], 1));
    canalWater.name = `${lm.name} canal`;
    group.add(canalWater);
  }
  return {
    group,
    update(state) {
      // The mirror costs a second render of the scene: only within 500 m and above the lowest tier.
      for (const pl of pools)
        pl.mesh.material = state.quality > 0 && Math.hypot(state.x - pl.x, state.z - pl.z) < 500 ? pl.mirror : pl.still;
    },
  };
}
