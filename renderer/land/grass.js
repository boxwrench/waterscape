// Grass field for the land pass: instanced tapered blades on a world-anchored grid of cells
// around the camera. Each blade's place, size and tilt come from a hash of its world cell, so
// blades stay put as the camera moves; height, shoreline and baked light come from the same
// lidar and light textures as the ground (ground.js). Wind: rolling gusts, swell and flutter.
import * as THREE from "../../vendor/three/three.webgpu.js";
import {
  Fn, uniform, instanceIndex, positionLocal, texture, varying, vec2, vec3, vec4, float, int,
  mix, smoothstep, dot, max, normalize, fract, sin, cos, mx_noise_float, time, uv, select,
} from "../../vendor/three/three.tsl.js";

// Blades per 1 m cell and field radius (m) per quality tier (0 low, 1 medium, 2 high).
export const GRASS_TIERS = [
  { radius: 20, perCell: 10 },
  { radius: 35, perCell: 16 },
  { radius: 50, perCell: 24 },
];
const CELL = 1;

export function createGrass(terrain, terrainTex, lightTex, lightUniforms) {
  const maxTier = GRASS_TIERS[2],
    maxSide = Math.ceil((2 * maxTier.radius) / CELL),
    maxCount = maxSide * maxSide * maxTier.perCell,
    blade = new THREE.PlaneGeometry(1, 1, 1, 4).translate(0, 0.5, 0),
    { width: w, height: h, cell, x0, z0 } = terrain,
    u = {
      camCell: uniform(new THREE.Vector2()),
      camPos: uniform(new THREE.Vector2()),
      radius: uniform(maxTier.radius),
      side: uniform(maxSide),
      perCell: uniform(maxTier.perCell),
    },
    windDir = vec2(0.94, 0.34);

  // Cheap per-blade random numbers from the world cell and blade index.
  const hash = (p, k) => fract(sin(dot(p, vec2(127.1, 311.7)).add(k.mul(74.7))).mul(43758.5453));
  const gridUv = (x, z) =>
    vec2(x.sub(x0).div(cell).add(0.5).div(w), z.sub(z0).div(cell).add(0.5).div(h));

  const vShade = varying(vec4(0), "vGrassShade"); // (visibility, openness, tip tint, 0)

  const positionNode = Fn(() => {
    const i = int(instanceIndex),
      k = i.mod(int(u.perCell)),
      c = i.div(int(u.perCell)),
      gx = float(c.mod(int(u.side))),
      gz = float(c.div(int(u.side))),
      worldCell = u.camCell.add(vec2(gx, gz)).sub(u.side.mul(0.5).floor()),
      kf = float(k),
      jx = hash(worldCell, kf),
      jz = hash(worldCell.add(17.3), kf),
      x = worldCell.x.add(jx).mul(CELL),
      z = worldCell.y.add(jz).mul(CELL),
      g = texture(terrainTex, gridUv(x, z)).level(0),
      light = texture(lightTex, gridUv(x, z)).level(0),
      d = vec2(x, z).sub(u.camPos).length(),
      // Fewer, shorter blades toward the edge; none in the water or on the bare bank.
      keep = hash(worldCell.add(5.1), kf).lessThan(float(1).sub(smoothstep(u.radius.mul(0.45), u.radius, d))),
      onLand = smoothstep(4, 7, g.x).mul(smoothstep(1, 4, g.y)),
      height = hash(worldCell.add(2.7), kf).mul(0.45).add(0.3).mul(onLand).mul(select(keep, float(1), float(0))),
      width = hash(worldCell.add(9.4), kf).pow(2).mul(0.05).add(0.02),
      // A resting lean (grass is rarely upright) in the blade's own random direction.
      leanDir = hash(worldCell.add(6.6), kf).mul(6.2832),
      lean = hash(worldCell.add(1.9), kf).mul(0.35),
      angle = hash(worldCell.add(4.2), kf).mul(6.2832),
      phase = hash(worldCell.add(8.8), kf).mul(6.2832),
      t = positionLocal.y,
      along = x.mul(windDir.x).add(z.mul(windDir.y)),
      gust = smoothstep(0.35, 0.8, mx_noise_float(vec3(along.mul(0.035).sub(time.mul(0.9)), z.mul(0.02), 0)).mul(0.5).add(0.5)),
      flutter = sin(time.mul(5.5).add(phase)).mul(0.08),
      bend = t.mul(t).mul(height).mul(float(0.18).add(gust.mul(0.75)).add(flutter)),
      side = positionLocal.x.mul(width).mul(float(1).sub(t.mul(0.9)));
    vShade.assign(vec4(light.x, light.y, hash(worldCell.add(3.3), kf), 0));
    const rest = t.mul(t).mul(height).mul(lean);
    return vec3(
      x.add(side.mul(cos(angle))).add(windDir.x.mul(bend)).add(cos(leanDir).mul(rest)),
      g.x.add(t.mul(height)).sub(bend.mul(bend).mul(0.6)).sub(rest.mul(rest).mul(0.5)),
      z.add(side.mul(sin(angle))).add(windDir.y.mul(bend)).add(sin(leanDir).mul(rest)),
    );
  })();

  const colorNode = Fn(() => {
    const t = uv().y,
      shade = vShade,
      season = lightUniforms.season,
      tipSpring = mix(vec3(0.24, 0.42, 0.05), vec3(0.36, 0.48, 0.1), shade.z),
      tipSummer = mix(vec3(0.5, 0.38, 0.15), vec3(0.62, 0.5, 0.24), shade.z),
      baseSpring = vec3(0.05, 0.11, 0.02),
      baseSummer = vec3(0.2, 0.14, 0.05),
      albedo = mix(mix(baseSpring, tipSpring, t.mul(t)), mix(baseSummer, tipSummer, t.mul(t)), season),
      // Blades lean up: soft, mostly-top lighting, some light through the blade from behind.
      n = normalize(vec3(0, 1, 0)),
      sunLit = lightUniforms.sunColor.mul(max(dot(n, lightUniforms.sun), 0).mul(0.75).add(0.25).mul(shade.x)),
      skyLit = lightUniforms.fill.mul(float(0.6).mul(shade.y)),
      occlusion = mix(float(0.4), float(1), t),
      // Per-blade brightness (0.75-1.2) so the sward is not a uniform carpet.
      variation = shade.z.mul(0.45).add(0.75);
    return albedo.mul(sunLit.add(skyLit)).mul(occlusion).mul(variation);
  })();

  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  material.positionNode = positionNode;
  material.colorNode = colorNode;
  // Alpha 0 marks grass for pack.js (the material is opaque; nothing blends).
  material.opacityNode = float(0);
  const mesh = new THREE.InstancedMesh(blade, material, maxCount);
  mesh.frustumCulled = false;

  return {
    mesh,
    setTier(tier) {
      const t = GRASS_TIERS[Math.max(0, Math.min(2, tier))],
        side = Math.ceil((2 * t.radius) / CELL);
      u.radius.value = t.radius;
      u.side.value = side;
      u.perCell.value = t.perCell;
      mesh.count = side * side * t.perCell;
    },
    update(state) {
      u.camPos.value.set(state.x, state.z);
      u.camCell.value.set(Math.floor(state.x / CELL), Math.floor(state.z / CELL));
    },
  };
}
