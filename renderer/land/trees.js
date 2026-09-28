// Oak meshes near the camera: the biome's baked variants (pipeline/bake-trees.mjs), instanced at
// the same sites as the shader's procedural crowns (oak-placement.js) within the tier's range;
// beyond it the shader keeps drawing crowns. Lit like the ground (sun, sky fill, baked light).
import * as THREE from "../../vendor/three/three.webgpu.js";
import {
  Fn, texture, positionWorld, positionLocal, normalWorld, vec2, vec3, float, max, dot, normalize,
  sin, time, instanceIndex, instanceColor, If, Discard, uv,
} from "../../vendor/three/three.tsl.js";
import { oaksNear } from "./oak-placement.js";

// Near-oak range (m) per quality tier; the kernel fades its crowns in just inside this.
export const TREE_RANGE = [40, 100, 200];
// Full-detail oaks within this distance (m) on medium and high; the lighter "-far" bake beyond it
// and everywhere on low.
const NEAR_DETAIL = 50;
const MAX_TREES = 4000;


async function loadVariant(biomeBase, v) {
  const buffer = await (await fetch(new URL(v.file, biomeBase))).arrayBuffer(),
    part = (p) => {
      const n = p.vertexCount,
        f = new Float32Array(buffer, p.offset, n * 8),
        g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(f.subarray(0, n * 3), 3));
      g.setAttribute("normal", new THREE.BufferAttribute(f.subarray(n * 3, n * 6), 3));
      g.setAttribute("uv", new THREE.BufferAttribute(f.subarray(n * 6, n * 8), 2));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, p.offset + n * 32, p.indexCount), 1));
      return g;
    };
  return { ...v, branches: part(v.parts.branches), leaves: part(v.parts.leaves) };
}

export async function createTrees(terrain, biome, biomeBase, ground) {
  const baked = biome.trees?.baked ?? [];
  if (!baked.length) return null;
  const variants = await Promise.all(baked.map((v) => loadVariant(biomeBase, v))),
    tex = (file, colour) => {
      const t = new THREE.TextureLoader().load(new URL(file, biomeBase).href);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (colour) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    },
    bark = tex(biome.trees.textures.bark, true),
    leaf = tex(biome.trees.textures.leaf, true),
    u = ground.uniforms,
    { width: w, height: h, cell, x0, z0 } = terrain,
    lightAt = (p) =>
      texture(ground.lightTex, vec2(p.x.sub(x0).div(cell).add(0.5).div(w), p.z.sub(z0).div(cell).add(0.5).div(h))),
    lit = (albedo, wrap) => {
      const n = normalize(normalWorld),
        light = lightAt(positionWorld),
        sunLit = u.sunColor.mul(max(dot(n, u.sun), 0).mul(float(1).sub(wrap)).add(wrap).mul(light.x)),
        skyLit = u.fill.mul(n.y.mul(0.25).add(0.55).mul(light.y));
      return albedo.mul(sunLit.add(skyLit));
    };

  // Bark: the texture, lit. Alpha 0.5 marks tree pixels for pack.js (see water.cu).
  const barkMat = new THREE.MeshBasicNodeMaterial();
  barkMat.colorNode = lit(texture(bark, uv()).rgb.mul(0.8), float(0.15));
  barkMat.opacityNode = float(0.5);
  // Leaves: alpha-tested cards, tinted per tree, lit with a wide wrap (light through foliage),
  // swaying a little in the wind (more toward the crown's edge).
  const leafMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  leafMat.colorNode = Fn(() => {
    const t = texture(leaf, uv());
    If(t.a.lessThan(0.5), () => Discard());
    return lit(t.rgb.mul(instanceColor), float(0.45));
  })();
  leafMat.opacityNode = float(0.5);
  leafMat.positionNode = Fn(() => {
    const p = positionLocal,
      phase = float(instanceIndex).mul(1.7),
      sway = sin(time.mul(1.3).add(phase).add(p.y.mul(0.08))).mul(p.y.mul(0.004));
    return p.add(vec3(sway, 0, sway.mul(0.6)));
  })();

  const group = new THREE.Group(),
    meshes = variants.map((v) => {
      const b = new THREE.InstancedMesh(v.branches, barkMat, MAX_TREES),
        l = new THREE.InstancedMesh(v.leaves, leafMat, MAX_TREES);
      l.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_TREES * 3), 3);
      for (const m of [b, l]) {
        m.count = 0;
        m.frustumCulled = false;
        group.add(m);
      }
      return { v, b, l };
    });
  const bySpecies = {},
    byId = {};
  for (const m of meshes) {
    byId[m.v.id] = m;
    if (!m.v.id.endsWith("-far")) (bySpecies[m.v.species] ??= []).push(m);
  }
  const species = Object.keys(bySpecies);

  let last = null,
    range = TREE_RANGE[2],
    season = 1;
  const m4 = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    up = new THREE.Vector3(0, 1, 0),
    colour = new THREE.Color();
  function rebuild(x, z, tier) {
    for (const m of meshes) m.b.count = m.l.count = 0;
    for (const site of oaksNear(terrain, x, z, range)) {
      const s = species[Math.min(species.length - 1, Math.floor(site.pick * species.length))],
        list = bySpecies[s],
        full = list[Math.floor(site.turn * 997) % list.length],
        near = tier > 0 && Math.hypot(site.x - x, site.z - z) < NEAR_DETAIL,
        m = near ? full : (byId[`${full.v.id}-far`] ?? full),
        i = m.b.count;
      if (i >= MAX_TREES) continue;
      const k = site.radius / m.v.crownRadius;
      m4.compose(
        new THREE.Vector3(site.x, terrain.ground(site.x, site.z) - 0.2, site.z),
        q.setFromAxisAngle(up, site.turn * Math.PI * 2),
        new THREE.Vector3(k, k, k),
      );
      m.b.setMatrixAt(i, m4);
      m.l.setMatrixAt(i, m4);
      colour.setRGB(...biome.trees.tints[s][season ? "summer" : "spring"]).multiplyScalar(0.9 + 0.2 * site.pick);
      m.l.setColorAt(i, colour);
      m.b.count = m.l.count = i + 1;
    }
    for (const m of meshes) {
      m.b.instanceMatrix.needsUpdate = m.l.instanceMatrix.needsUpdate = true;
      m.l.instanceColor.needsUpdate = true;
    }
  }

  return {
    group,
    // Species in the order the impostor sheet's rows follow.
    species,
    // Recompute the near oaks when the camera has moved a fifth of the range, or on a tier or
    // season change.
    update(state, seasonNow) {
      const r = TREE_RANGE[Math.max(0, Math.min(2, state.quality))];
      // (Near/far detail switches at NEAR_DETAIL, so rebuild at least every 10 m of travel.)
      if (!last || r !== range || seasonNow !== season || Math.hypot(state.x - last.x, state.z - last.z) > Math.min(10, r * 0.2)) {
        range = r;
        season = seasonNow;
        last = { x: state.x, z: state.z };
        rebuild(state.x, state.z, state.quality);
      }
    },
    get range() {
      return range;
    },
  };
}
