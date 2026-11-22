// A dam's gated side spillway from structures.json (`dams[].spillway`). Today: O'Shaughnessy
// Dam's, at Hetch Hetchy: drum gates between round-nosed piers on the lake shore, the sill and
// spill face under them, the unlined channel behind them running back to the dam with its rock
// bank, the arch that carries it under the road (a dark opening in the dam's upstream face and a
// headwall at the mouth) and the run-out down the rock. The gate line, portal and run-out are
// traced on USGS NAIP, the gates' number, width and top from sources (structures.json); shapes
// and the other sizes are illustrative. Gates raised, spillway dry. Lit like the dams
// (structures.js); alpha 0.5 tags the pixels as already shaded for the water kernel (pack.js).
import * as THREE from "../../vendor/three/three.webgpu.js";
import {
  positionWorld, normalWorld, vec3, float, max, dot, normalize, mix, smoothstep, abs, fract, mx_noise_float,
} from "../../vendor/three/three.tsl.js";
import { crestCurve, crestScene } from "./structures.js";

// Cross-section across the gates, metres downstream (s) of their lake-side edge.
const SILL = -0.5, // the sill's upstream face
  FACE = 4, // the spill face starts here, under the gates' downstream side
  CHANNEL = 8, // the channel floor starts at the foot of the spill face
  BANK = 6, // width of the rock bank's top beyond the channel
  PIER_NOSE = -1.5,
  PIER_END = 10,
  ARCH_HALF = 3,
  ARCH_RISE = 2.5; // floor to springing line

// The spillway's frame in scene metres: gate line from the dam end A along u, n downstream.
export function spillwayFrame(dam, terrain) {
  const [e0, n0] = terrain.meta.originUTM,
    sp = dam.spillway,
    scene = ([e, n]) => [e - e0, n0 - n],
    [ax, az] = scene(sp.gatesUTM[0]),
    [bx, bz] = scene(sp.gatesUTM[1]),
    L = Math.hypot(bx - ax, bz - az),
    ux = (bx - ax) / L,
    uz = (bz - az) / L;
  // Downstream is the side away from the lake: the shore distance grows that way.
  let nx = -uz,
    nz = ux,
    away = 0;
  for (const f of [0.25, 0.5, 0.75]) {
    const x = ax + ux * L * f,
      z = az + uz * L * f;
    away += terrain.shoreDistance(x + nx * 15, z + nz * 15) - terrain.shoreDistance(x - nx * 15, z - nz * 15);
  }
  if (away < 0) (nx = -nx), (nz = -nz);
  return { ax, az, ux, uz, nx, nz, L, scene, at: (u, s) => [ax + ux * u + nx * s, az + uz * u + nz * s] };
}

// The channel's centre line from the far end of the gates back past the dam to the portal, and
// the run-out from the portal down the rock, in scene metres.
function lines(dam, f) {
  const sp = dam.spillway,
    mid = CHANNEL + sp.channelWidth / 2,
    portal = f.scene(sp.portalUTM);
  return {
    channel: [f.at(f.L, mid), f.at(0, mid), portal],
    runout: [portal, ...sp.runoutUTM.map(f.scene)],
  };
}

// Ground kept free of pines and grass (clearings.js): gates, channel and bank; the passage to
// the portal; the run-out.
export function spillwayClearings(structures, terrain) {
  const trees = [],
    grass = [];
  for (const dam of structures?.dams ?? []) {
    if (!dam.spillway || !terrain?.shoreDistance) continue;
    const f = spillwayFrame(dam, terrain),
      w = dam.spillway.channelWidth,
      s0 = PIER_NOSE - 1,
      s1 = CHANNEL + w + BANK,
      [cx, cz] = f.at(f.L / 2, (s0 + s1) / 2),
      body = { x: cx, z: cz, ux: f.ux, uz: f.uz, hs: f.L / 2 + 4, ht: (s1 - s0) / 2, r: 1 };
    trees.push({ ...body, ht: body.ht + 3 });
    grass.push(body);
    const { channel, runout } = lines(dam, f);
    for (const [pts, half] of [[channel.slice(1), ARCH_HALF + 2], [runout, 3.5]])
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, az] = pts[i],
          [bx, bz] = pts[i + 1],
          l = Math.hypot(bx - ax, bz - az) || 1,
          seg = { x: (ax + bx) / 2, z: (az + bz) / 2, ux: (bx - ax) / l, uz: (bz - az) / l, hs: l / 2, r: 0 };
        trees.push({ ...seg, ht: half + 3 });
        grass.push({ ...seg, ht: half + 0.5 });
      }
  }
  return { trees, grass };
}

// Place a geometry built in a local frame: its x, y and z axes become the world vectors X, Y, Z
// at `origin`. Mirrored frames have their triangles turned so faces keep pointing out.
function place(g, X, Y, Z, origin) {
  const m = new THREE.Matrix4().set(
    X[0], Y[0], Z[0], origin[0],
    X[1], Y[1], Z[1], origin[1],
    X[2], Y[2], Z[2], origin[2],
    0, 0, 0, 1,
  );
  g = g.index ? g.toNonIndexed() : g;
  g.applyMatrix4(m);
  if (m.determinant() < 0) {
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 9)
      for (let k = 0; k < 3; k++) [p[i + 3 + k], p[i + 6 + k]] = [p[i + 6 + k], p[i + 3 + k]];
  }
  g.deleteAttribute("normal");
  g.computeVertexNormals();
  return g;
}

function merge(list) {
  const total = list.reduce((n, g) => n + g.attributes.position.count, 0),
    pos = new Float32Array(total * 3),
    nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o);
    nor.set(g.attributes.normal.array, o);
    o += g.attributes.position.array.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}

function shape(points) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

const extrude = (s, depth, curveSegments = 12) => new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments });

// A strip along a polyline: top at y(i) for each point, `half(i)` metres either side, with sides
// running down to `foot`. Returns triangles in world space.
function strip(pts, y, half, foot) {
  const pos = [],
    quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  const edges = pts.map(([x, z], i) => {
    const [px, pz] = pts[Math.max(0, i - 1)],
      [qx, qz] = pts[Math.min(pts.length - 1, i + 1)],
      l = Math.hypot(qx - px, qz - pz) || 1,
      cx = -(qz - pz) / l,
      cz = (qx - px) / l,
      h = half(i);
    return { l: [x - cx * h, y(i), z - cz * h], r: [x + cx * h, y(i), z + cz * h] };
  });
  for (let i = 0; i + 1 < edges.length; i++) {
    const a = edges[i],
      b = edges[i + 1],
      down = (p) => [p[0], foot, p[2]];
    quad(a.l, b.l, b.r, a.r);
    quad(a.r, b.r, down(b.r), down(a.r));
    quad(b.l, a.l, down(a.l), down(b.l));
  }
  // Keep the top facing up (the turn of the left/right edges depends on the line's direction).
  const e1 = [pos[3] - pos[0], pos[4] - pos[1], pos[5] - pos[2]],
    e2 = [pos[6] - pos[0], pos[7] - pos[1], pos[8] - pos[2]];
  if (e1[2] * e2[0] - e1[0] * e2[2] < 0)
    for (let i = 0; i < pos.length; i += 9)
      for (let k = 0; k < 3; k++) [pos[i + 3 + k], pos[i + 6 + k]] = [pos[i + 6 + k], pos[i + 3 + k]];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Points every `step` metres along a polyline.
function resample(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1],
      [bx, bz] = pts[i],
      n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return out;
}

// Where the channel's passage (a -> b) crosses the dam's crest line, and the crest's tangent.
function crestCrossing(dam, meta, a, b) {
  const crest = crestCurve(crestScene(dam, meta)).map((p) => [p.x, p.z]);
  for (let i = 1; i < crest.length; i++) {
    const [px, pz] = crest[i - 1],
      [qx, qz] = crest[i],
      rx = qx - px,
      rz = qz - pz,
      sx = b[0] - a[0],
      sz = b[1] - a[1],
      d = rx * sz - rz * sx;
    if (Math.abs(d) < 1e-9) continue;
    const t = ((a[0] - px) * sz - (a[1] - pz) * sx) / d,
      w = ((a[0] - px) * rz - (a[1] - pz) * rx) / d;
    if (t >= 0 && t <= 1 && w >= 0 && w <= 1) {
      const l = Math.hypot(rx, rz);
      return { p: [px + rx * t, pz + rz * t], t: [rx / l, rz / l] };
    }
  }
  return null;
}

// An arched opening (dark) in a vertical plane: x across, y up from the floor.
function archShape() {
  const s = new THREE.Shape();
  s.moveTo(-ARCH_HALF, 0);
  s.lineTo(ARCH_HALF, 0);
  s.lineTo(ARCH_HALF, ARCH_RISE);
  s.absarc(0, ARCH_RISE, ARCH_HALF, 0, Math.PI, false);
  s.lineTo(-ARCH_HALF, 0);
  return s;
}

function lit(u, albedo, relief = 0) {
  const n = relief ? rockNormal(normalize(normalWorld), float(relief)) : normalize(normalWorld);
  return albedo.mul(u.sunColor.mul(max(dot(n, u.sun), 0)).add(u.fill.mul(n.y.mul(0.3).add(0.55)).mul(0.8)));
}

function material(colorNode, tag) {
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, blending: THREE.NoBlending });
  m.colorNode = colorNode;
  m.opacityNode = float(tag);
  return m;
}

// Grey granite, mottled at three scales, with darker weathered patches.
export function graniteAlbedo() {
  const pos = positionWorld,
    granite = mx_noise_float(pos.mul(0.3)).mul(0.35).add(mx_noise_float(pos.mul(1.1)).mul(0.2)).add(mx_noise_float(pos.mul(3.7)).mul(0.1)).add(0.5),
    fleck = mx_noise_float(pos.mul(9.3)).mul(0.07).add(1),
    patch = smoothstep(0.1, 0.45, mx_noise_float(pos.mul(0.08).add(3)));
  return mix(vec3(0.36, 0.35, 0.32), vec3(0.66, 0.65, 0.61), granite)
    .mul(fleck)
    .mul(mix(float(1), float(0.72), patch));
}

// Relief for flat rock: the normal tilted by noise (0-1 `amount`), so light breaks up over it.
export function rockNormal(n, amount) {
  const p = positionWorld.mul(0.35);
  return normalize(n.add(vec3(mx_noise_float(p), mx_noise_float(p.add(5)).mul(0.4), mx_noise_float(p.add(11))).mul(amount)));
}

// The traced edge where the dam's downstream face meets the rock, and which side is rock (the
// side of the crest end nearest the portal); `downstreamOf` is the distance downstream of the
// crest line, or -Infinity past either end of it.
function faceEdge(dam, terrain, crestPts, side) {
  const sp = dam.spillway,
    [e0, n0] = terrain.meta.originUTM,
    [ea, eb] = sp.faceEdgeUTM.map(([e, n]) => [e - e0, n0 - n]),
    portal = [sp.portalUTM[0] - e0, n0 - sp.portalUTM[1]],
    dx = eb[0] - ea[0],
    dz = eb[1] - ea[1],
    l = Math.hypot(dx, dz),
    across = (x, z) => ((x - ea[0]) * dz - (z - ea[1]) * dx) / l,
    end = [crestPts[0], crestPts.at(-1)].sort((a, b) => Math.hypot(a[0] - portal[0], a[1] - portal[1]) - Math.hypot(b[0] - portal[0], b[1] - portal[1]))[0],
    sign = Math.sign(across(...end)) || 1;
  const downstreamOf = (x, z) => {
    let best = Infinity,
      signed = 0,
      within = false;
    for (let i = 1; i < crestPts.length; i++) {
      const [ax, az] = crestPts[i - 1],
        [bx, bz] = crestPts[i],
        cx = bx - ax,
        cz = bz - az,
        l2 = cx * cx + cz * cz,
        raw = ((x - ax) * cx + (z - az) * cz) / l2,
        t = Math.max(0, Math.min(1, raw)),
        d = Math.hypot(x - ax - t * cx, z - az - t * cz);
      if (d >= best) continue;
      best = d;
      signed = (((x - ax) * -cz + (z - az) * cx) / Math.sqrt(l2)) * side;
      within = !((i === 1 && raw < 0) || (i === crestPts.length - 1 && raw > 1));
    }
    return within ? signed : -Infinity;
  };
  return { ea, dx, dz, l, sign, downstreamOf };
}

// 0-1 over the part of a dam's downstream face that is really rock: beyond the traced face edge
// on the portal's side, not past the toe end of the edge, below the crest; the border broken
// up by noise. For the dam's material (structures.js); null for a dam without a spillway.
export function faceRockMask(dam, terrain, side, top) {
  if (!dam.spillway?.faceEdgeUTM) return null;
  const crestPts = crestCurve(crestScene(dam, terrain.meta)).map((p) => [p.x, p.z]),
    { ea, dx, dz, l, sign } = faceEdge(dam, terrain, crestPts, side),
    pos = positionWorld,
    rx = pos.x.sub(ea[0]),
    rz = pos.z.sub(ea[1]),
    across = rx.mul(dz).sub(rz.mul(dx)).div(l).mul(sign),
    along = rx.mul(dx).add(rz.mul(dz)).div(l * l),
    jitter = mx_noise_float(pos.mul(0.12)).mul(3).add(mx_noise_float(pos.mul(0.5)).mul(1));
  return smoothstep(-0.4, 0.4, across.add(jitter))
    .mul(smoothstep(1.2, 1.05, along))
    .mul(smoothstep(top - 0.8, top - 2, pos.y));
}

export function createSpillway(dam, terrain, u, options = {}) {
  const sp = dam.spillway,
    meta = terrain.meta,
    f = spillwayFrame(dam, terrain),
    tag = options.packShadedTag === false ? 1 : 0.5,
    crestY = dam.crestElevation - meta.waterLevel,
    gateTop = crestY - sp.gateTopBelowCrest,
    sill = gateTop - sp.gateHeight,
    w = sp.channelWidth,
    { channel, runout } = lines(dam, f),
    // The channel floor falls a little towards the dam (illustrative), and stays above the
    // lake and the bundle's ground under it.
    floorAt = (k) => crestY - 9 + 0.6 * k,
    U = [f.ux, 0, f.uz],
    N = [f.nx, 0, f.nz],
    UP = [0, 1, 0];
  let low = Infinity;
  for (let su = -4; su <= f.L + 6; su += 2)
    for (let ss = PIER_NOSE - 1; ss <= CHANNEL + w + BANK; ss += 2) low = Math.min(low, terrain.ground(...f.at(su, ss)));
  const foot = Math.min(low, 0) - 4,
    floorFar = floorAt(1),
    floorDam = floorAt(0),
    concrete = [],
    steel = [],
    rock = [],
    dark = [];

  // Sill and spill face under the gates, the full length of the gate line.
  const section = shape([
    [SILL, foot], [SILL, sill], [FACE, sill], [CHANNEL, floorDam], [CHANNEL, foot],
  ]);
  concrete.push(place(extrude(section, f.L), N, UP, U, [f.ax, 0, f.az]));

  // Piers between the gates: two at the ends (the far one a thicker abutment), round noses
  // upstream, up to the crest.
  const t = (f.L - sp.gates * sp.gateWidth) / (sp.gates + 1);
  for (let k = 0; k <= sp.gates; k++) {
    const uc = t / 2 + k * (t + sp.gateWidth),
      lo = k === sp.gates ? t / 2 + 3 : t / 2,
      s = new THREE.Shape();
    s.moveTo(-t / 2, PIER_END + (k === sp.gates ? 2 : 0));
    s.lineTo(-t / 2, PIER_NOSE);
    s.absarc(0, PIER_NOSE, t / 2, Math.PI, 2 * Math.PI, false);
    s.lineTo(lo, PIER_NOSE);
    s.lineTo(lo, PIER_END + (k === sp.gates ? 2 : 0));
    s.closePath();
    const [ox, oz] = f.at(uc, 0);
    concrete.push(place(extrude(s, crestY - foot), U, N, UP, [ox, foot, oz]));
  }

  // Drum gates, raised: a curved skin facing the lake from the sill to the gate top.
  const R = sp.gateHeight;
  for (let k = 0; k < sp.gates; k++) {
    const u0 = t + k * (t + sp.gateWidth),
      s = new THREE.Shape();
    s.moveTo(0, sill);
    s.absarc(R, sill, R, Math.PI, Math.PI / 2, true);
    s.lineTo(R + 0.7, gateTop);
    s.lineTo(R + 0.7, sill);
    s.closePath();
    const [ox, oz] = f.at(u0, 0);
    steel.push(place(extrude(s, sp.gateWidth, 16), N, UP, U, [ox, 0, oz]));
  }

  // The channel floor from the far end, back past the dam to the portal, narrowing to the arch.
  const path = resample(channel, 2),
    along = [0];
  for (let i = 1; i < path.length; i++) along.push(along[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const gatesEnd = f.L,
    floorY = (i) => (along[i] <= gatesEnd ? floorFar + (floorDam - floorFar) * (along[i] / gatesEnd) : floorDam - 0.5 * ((along[i] - gatesEnd) / (along.at(-1) - gatesEnd))),
    halfW = (i) => (along[i] <= gatesEnd - 6 ? w / 2 : Math.max(ARCH_HALF, w / 2 - ((along[i] - gatesEnd + 6) / 10) * (w / 2 - ARCH_HALF)));
  rock.push(strip(path, floorY, halfW, foot));

  // Rock bank on the far side of the channel, from the floor up to below the road, and a rock
  // wall closing the channel's far end.
  const bankTop = crestY - 3.5,
    bank = shape([
      [CHANNEL + w, floorFar - 1], [CHANNEL + w + 2.5, bankTop], [CHANNEL + w + BANK, bankTop], [CHANNEL + w + BANK, foot], [CHANNEL + w, foot],
    ]);
  rock.push(place(extrude(bank, f.L + 6), N, UP, U, [f.ax, 0, f.az]));
  const end = shape([[CHANNEL - 1, foot], [CHANNEL - 1, bankTop], [CHANNEL + w + 1, bankTop], [CHANNEL + w + 1, foot]]),
    [ex, ez] = f.at(f.L + 1, 0);
  rock.push(place(extrude(end, 5), N, UP, U, [ex, 0, ez]));

  // The arch: a dark opening where the channel meets the dam's upstream face, and a concrete
  // headwall with the same opening at the mouth on the far side of the road.
  const [p1, p2] = [channel[1], channel[2]],
    cross = crestCrossing(dam, meta, p1, p2),
    dl = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]),
    dir = [(p2[0] - p1[0]) / dl, (p2[1] - p1[1]) / dl];
  if (cross) {
    // Facing upstream: against the passage's direction, square to the crest.
    let fx = -cross.t[1],
      fz = cross.t[0];
    if (fx * dir[0] + fz * dir[1] > 0) (fx = -fx), (fz = -fz);
    const across = [-fz, 0, fx],
      y0 = floorDam - 0.1;
    dark.push(place(new THREE.ShapeGeometry(archShape(), 12), across, UP, [fx, 0, fz], [cross.p[0] + fx * 0.08, y0, cross.p[1] + fz * 0.08]));
  }
  {
    const across = [-dir[1], 0, dir[0]],
      out = [dir[0], 0, dir[1]],
      [px, pz] = p2,
      y0 = floorDam - 0.6,
      headFoot = Math.min(foot, terrain.ground(px, pz) - 4),
      wall = shape([[-ARCH_HALF - 3, headFoot], [ARCH_HALF + 3, headFoot], [ARCH_HALF + 3, crestY], [-ARCH_HALF - 3, crestY]]);
    concrete.push(place(extrude(wall, 1.2), across, UP, out, [px - dir[0] * 1.2, 0, pz - dir[1] * 1.2]));
    dark.push(place(new THREE.ShapeGeometry(archShape(), 12), across, UP, out, [px + dir[0] * 0.06, y0, pz + dir[1] * 0.06]));
  }

  // Run-out: from the portal down the rock beside the dam face (painted granite there by the
  // dam's material, faceRockMask), then over the ground beyond the dam.
  const crestPts = crestCurve(crestScene(dam, meta)).map((p) => [p.x, p.z]),
    edge = faceEdge(dam, terrain, crestPts, options.downstream ?? 1),
    faceAt = (x, z) => {
      const d = edge.downstreamOf(x, z);
      return d >= 7.5 ? crestY - 6 - (d - 7.5) / 0.75 : -Infinity;
    },
    fall = resample(runout, 2),
    fallY = fall.map(([x, z], i) => {
      if (i === 0) return floorDam - 0.6;
      const [px, pz] = fall[i - 1],
        l = Math.hypot(x - px, z - pz) || 1,
        cx = -(z - pz) / l,
        cz = (x - px) / l;
      return Math.max(...[-2, 0, 2].flatMap((d) => [terrain.ground(x + cx * d, z + cz * d), faceAt(x + cx * d, z + cz * d)])) + 0.15;
    });
  for (let i = 1; i < fallY.length; i++) fallY[i] = Math.min(fallY[i], fallY[i - 1]);
  const worn = strip(fall, (i) => fallY[i], (i) => Math.min(ARCH_HALF + 0.5, 2.5 + i * 0.1), Math.min(...fallY) - 6);

  // Materials: weathered concrete with pour lines; painted steel; grey granite; paler worn rock.
  const pos = positionWorld,
    lift = smoothstep(0.9, 0.97, abs(fract(pos.y.div(1.5)).sub(0.5)).mul(2)),
    blotch = mx_noise_float(pos.mul(0.15)).mul(0.5).add(0.5),
    grain = mx_noise_float(pos.mul(1.7)).mul(0.08).add(1),
    concreteAlbedo = vec3(0.6, 0.58, 0.53).mul(float(1).sub(lift.mul(0.25))).mul(mix(float(0.78), float(1.05), blotch)).mul(grain),
    steelAlbedo = vec3(0.34, 0.38, 0.37).mul(mix(float(0.8), float(1.1), mx_noise_float(vec3(pos.x.mul(0.6), pos.y.mul(4), pos.z.mul(0.6))).mul(0.5).add(0.5))),
    rockAlbedo = graniteAlbedo(),
    // The run-out: rock streaked dark down the fall line by water.
    streak = mx_noise_float(vec3(pos.x.mul(1.3), pos.y.mul(0.12), pos.z.mul(1.3))).mul(0.5).add(0.5),
    wornAlbedo = graniteAlbedo().mul(mix(float(0.25), float(0.55), streak)),
    group = new THREE.Group();
  for (const [list, albedo, name, relief] of [
    [concrete, concreteAlbedo, "piers and sill", 0],
    [steel, steelAlbedo, "drum gates", 0],
    [rock, rockAlbedo, "channel", 0.5],
    [[worn], wornAlbedo, "run-out", 0.5],
  ]) {
    const mesh = new THREE.Mesh(merge(list), material(lit(u, albedo, relief), tag));
    mesh.name = `${dam.name} spillway ${name}`;
    group.add(mesh);
  }
  const openings = new THREE.Mesh(merge(dark), material(vec3(0.012, 0.012, 0.011), tag));
  openings.name = `${dam.name} spillway arch`;
  group.add(openings);
  return group;
}
