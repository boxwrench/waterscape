// Splayed alpha-cutout clumps, inspired by Ebenezer's FluffyGrass (see third-party notices).
// World-anchored 8 m chunks are culled by the camera; three card LODs reduce distant geometry.
// Roots sample the same lidar/light textures as the ground, with seasonal tint and rolling wind.
import * as THREE from "../../vendor/three/three.webgpu.js";
import { landLook } from "../engine/look.js";
import {
  Fn, uniform, attribute, instanceIndex, positionLocal, modelPosition, texture, varying, vec2, vec3, vec4, float, int,
  mix, smoothstep, dot, max, normalize, fract, sin, cos, mx_noise_float, time, uv, select, If, Discard,
} from "../../vendor/three/three.tsl.js";

// Clumps per square metre, with a shorter range and wider cards on lower tiers.
export const GRASS_TIERS = [
  { radius: 22, perCell: 3, widthScale: 1.2 },
  { radius: 35, perCell: 5, widthScale: 1.05 },
  { radius: 50, perCell: 6, widthScale: 1 },
];
const CELL = 1, CHUNK = 8;

function tuftGeometry(cards, segments) {
  const pos = [], uvs = [], aBlade = [], index = [];
  for (let b = 0; b < cards; b++) {
    const out = (b / cards) * Math.PI * 2,
      base = pos.length / 3;
    // Curved cards fan out radially, so their surfaces remain visible from above.
    for (let row = 0; row <= segments; row++)
      for (let col = 0; col < 2; col++) {
        pos.push(col - 0.5, row / segments, 0);
        uvs.push(col, row / segments);
        aBlade.push(Math.cos(out) * 0.08, Math.sin(out) * 0.08, out, 0.85 + 0.15 * Math.sin(b * 3.7 + 0.5));
      }
    for (let row = 0; row < segments; row++) {
      const i = base + row * 2;
      index.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute("aBlade", new THREE.Float32BufferAttribute(aBlade, 4));
  g.setIndex(index);
  return g;
}

export function createGrass(terrain, terrainTex, lightTex, lightUniforms, look = landLook(null)) {
  const [summerBase, summerTip, summerBright] = look.summer.blade;
  const geometries = [tuftGeometry(6, 3), tuftGeometry(3, 2), tuftGeometry(2, 1)],
    mask = new THREE.TextureLoader().load(new URL("../../data/biomes/diablo-oak/grass/fluffy-mask.jpg", import.meta.url).href),
    { width: w, height: h, cell, x0, z0 } = terrain,
    u = {
      camPos: uniform(new THREE.Vector2()),
      radius: uniform(GRASS_TIERS[2].radius),
      perCell: uniform(GRASS_TIERS[2].perCell),
      widthScale: uniform(1),
    },
    windDir = vec2(0.94, 0.34);

  mask.anisotropy = 4;

  // Cheap per-clump random numbers from the world cell and blade index.
  const hash = (p, k) => fract(sin(dot(p, vec2(127.1, 311.7)).add(k.mul(74.7))).mul(43758.5453));
  const gridUv = (x, z) =>
    vec2(x.sub(x0).div(cell).add(0.5).div(w), z.sub(z0).div(cell).add(0.5).div(h));

  const vShade = varying(vec4(0), "vGrassShade"); // (visibility, openness, tip tint, clump)

  const positionNode = Fn(() => {
    const i = int(instanceIndex),
      k = i.mod(int(u.perCell)),
      c = i.div(int(u.perCell)),
      gx = float(c.mod(int(CHUNK))),
      gz = float(c.div(int(CHUNK))),
      worldCell = modelPosition.xz.div(CELL).add(vec2(gx, gz)),
      kf = float(k),
      jx = hash(worldCell, kf),
      jz = hash(worldCell.add(17.3), kf),
      x = worldCell.x.add(jx).mul(CELL),
      z = worldCell.y.add(jz).mul(CELL),
      g = texture(terrainTex, gridUv(x, z)).level(0),
      light = texture(lightTex, gridUv(x, z)).level(0),
      d = vec2(x, z).sub(u.camPos).length(),
      // Fewer, shorter blades toward the edge; none in the water or on the bare bank.
      // A slow noise clumps tufts into patches with thin gaps between them.
      clump = smoothstep(0.3, 0.7, mx_noise_float(vec3(x.mul(0.22), z.mul(0.22), 3.1)).mul(0.5).add(0.5)),
      keep = hash(worldCell.add(5.1), kf).lessThan(
        float(1).sub(smoothstep(u.radius.mul(0.6), u.radius, d)).mul(mix(float(0.5), float(1), clump)).mul(look.grassCover),
      ),
      inside = x.greaterThanEqual(x0).and(x.lessThan(x0 + (w - 1) * cell)).and(z.greaterThanEqual(z0)).and(z.lessThan(z0 + (h - 1) * cell)),
      onLand = smoothstep(4, 7, g.x).mul(smoothstep(1, 4, g.y)),
      a = attribute("aBlade", "vec4"),
      tuftHeight = hash(worldCell.add(2.7), kf).mul(0.45).add(0.3).mul(mix(float(0.75), float(1.15), clump)),
      height = tuftHeight.mul(a.w).mul(onLand).mul(select(keep.and(inside), float(1), float(0))),
      width = hash(worldCell.add(9.4), kf).mul(0.35).add(0.7).mul(u.widthScale),
      // The tuft's yaw; each blade fans out from its centre and leans outward (grass is rarely
      // upright), with a little extra lean of its own.
      yaw = hash(worldCell.add(4.2), kf).mul(6.2832),
      outward = yaw.add(a.z),
      leanDir = outward,
      lean = hash(worldCell.add(1.9), kf).mul(0.25).add(0.45),
      angle = outward.add(1.5708),
      ox = a.x.mul(cos(yaw)).sub(a.y.mul(sin(yaw))),
      oz = a.x.mul(sin(yaw)).add(a.y.mul(cos(yaw))),
      phase = hash(worldCell.add(8.8), kf).mul(6.2832),
      t = positionLocal.y,
      along = x.mul(windDir.x).add(z.mul(windDir.y)),
      gust = smoothstep(0.35, 0.8, mx_noise_float(vec3(along.mul(0.035).sub(time.mul(0.9)), z.mul(0.02), 0)).mul(0.5).add(0.5)),
      flutter = sin(time.mul(5.5).add(phase)).mul(0.08),
      bend = t.mul(t).mul(height).mul(float(0.18).add(gust.mul(0.75)).add(flutter)),
      side = positionLocal.x.mul(width);
    vShade.assign(vec4(light.x, light.y, hash(worldCell.add(3.3), kf), clump));
    const rest = t.mul(t).mul(height).mul(lean);
    return vec3(
      x.sub(modelPosition.x).add(ox).add(side.mul(cos(angle))).add(windDir.x.mul(bend)).add(cos(leanDir).mul(rest)),
      g.x.add(t.mul(height)).sub(bend.mul(bend).mul(0.6)).sub(rest.mul(rest).mul(0.5)),
      z.sub(modelPosition.z).add(oz).add(side.mul(sin(angle))).add(windDir.y.mul(bend)).add(sin(leanDir).mul(rest)),
    );
  })();

  const colorNode = Fn(() => {
    // Discard holes before writing depth. Output alpha is reserved for the land-pack tag.
    If(texture(mask, uv()).r.lessThan(0.35), () => Discard());
    const t = uv().y,
      shade = vShade,
      season = lightUniforms.season,
      tipSpring = mix(vec3(0.24, 0.42, 0.05), vec3(0.36, 0.48, 0.1), shade.z),
      tipSummer = mix(vec3(...summerTip), vec3(...summerBright), shade.z),
      baseSpring = vec3(0.1, 0.22, 0.04),
      baseSummer = vec3(...summerBase),
      albedo = mix(mix(baseSpring, tipSpring, t), mix(baseSummer, tipSummer, t), season),
      // Blades lean up: soft, mostly-top lighting, some light through the blade from behind.
      n = normalize(vec3(0, 1, 0)),
      sunLit = lightUniforms.sunColor.mul(max(dot(n, lightUniforms.sun), 0).mul(0.75).add(0.25).mul(shade.x)),
      skyLit = lightUniforms.fill.mul(float(0.6).mul(shade.y)),
      occlusion = mix(float(0.7), float(1), t),
      // Per-blade brightness (0.75-1.2) so the sward is not a uniform carpet.
      variation = shade.z.mul(0.45).add(0.75).mul(mix(float(0.85), float(1.1), shade.w));
    return albedo.mul(sunLit.add(skyLit)).mul(occlusion).mul(variation);
  })();

  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  material.positionNode = positionNode;
  material.colorNode = colorNode;
  // Alpha 0 marks grass for pack.js (the material is opaque; nothing blends).
  material.opacityNode = float(0);
  const mesh = new THREE.Group(), chunks = new Map();
  let tier = GRASS_TIERS[2];

  function placeChunk(chunk, cx, cz) {
    chunk.position.set(cx * CHUNK, 0, cz * CHUNK);
    // Include all lidar nodes touching the chunk, not just its corners, so slopes/crests
    // cannot disappear under frustum culling. Padding covers card width, height and wind.
    let lo = Infinity, hi = -Infinity;
    const ix0 = Math.floor((cx * CHUNK - x0) / cell),
      iz0 = Math.floor((cz * CHUNK - z0) / cell),
      ix1 = Math.ceil(((cx + 1) * CHUNK - x0) / cell),
      iz1 = Math.ceil(((cz + 1) * CHUNK - z0) / cell);
    for (let iz = iz0; iz <= iz1; iz++)
      for (let ix = ix0; ix <= ix1; ix++) {
        const y = terrain.cells[(Math.max(0, Math.min(h - 1, iz)) * w + Math.max(0, Math.min(w - 1, ix))) * 4];
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
    chunk.boundingBox = new THREE.Box3(new THREE.Vector3(-2, lo - 2, -2), new THREE.Vector3(CHUNK + 2, hi + 2, CHUNK + 2));
    chunk.boundingSphere = chunk.boundingBox.getBoundingSphere(new THREE.Sphere());
  }

  return {
    mesh,
    setTier(level) {
      tier = GRASS_TIERS[Math.max(0, Math.min(2, level))];
      u.radius.value = tier.radius;
      u.perCell.value = tier.perCell;
      u.widthScale.value = tier.widthScale;
    },
    update(state) {
      u.camPos.value.set(state.x, state.z);
      const wanted = new Map(), spare = [],
        xMin = Math.floor((state.x - tier.radius) / CHUNK),
        xMax = Math.floor((state.x + tier.radius) / CHUNK),
        zMin = Math.floor((state.z - tier.radius) / CHUNK),
        zMax = Math.floor((state.z + tier.radius) / CHUNK);
      for (let cz = zMin; cz <= zMax; cz++)
        for (let cx = xMin; cx <= xMax; cx++) {
          const dx = Math.max(cx * CHUNK - state.x, 0, state.x - (cx + 1) * CHUNK),
            dz = Math.max(cz * CHUNK - state.z, 0, state.z - (cz + 1) * CHUNK),
            distance = Math.hypot(dx, dz);
          if (distance < tier.radius) wanted.set(`${cx},${cz}`, { cx, cz, distance });
        }
      for (const [key, chunk] of chunks)
        if (!wanted.has(key)) {
          chunks.delete(key);
          spare.push(chunk);
        }
      for (const [key, { cx, cz, distance }] of wanted) {
        let chunk = chunks.get(key);
        if (!chunk) {
          chunk = spare.pop() ?? new THREE.InstancedMesh(geometries[0], material, CHUNK * CHUNK * GRASS_TIERS[2].perCell);
          placeChunk(chunk, cx, cz);
          chunks.set(key, chunk);
          mesh.add(chunk);
        }
        chunk.geometry = geometries[distance < 10 ? 0 : distance < 22 ? 1 : 2];
        chunk.count = CHUNK * CHUNK * tier.perCell;
      }
      for (const chunk of spare) {
        mesh.remove(chunk);
        chunk.dispose();
      }
    },
  };
}
