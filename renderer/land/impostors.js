// Distant oaks as impostors: camera-facing cards showing the baked photograph of each tree from
// the nearest of eight directions (pipeline/bake-trees.mjs). Like the grass, one instance per
// oak cell on a grid around the camera; the vertex shader repeats the placement rule
// (oak-placement.js, water.cu) with the same integer hash, so each card stands exactly where the
// oak's mesh and crown do. Between the mesh range and IMPOSTOR_RANGE; the shader draws crowns
// beyond. Lit like the ground and the meshes.
import * as THREE from "../../vendor/three/three.webgpu.js";
import {
  Fn, uniform, uniformArray, instanceIndex, positionLocal, positionWorld, texture, varying, vec2,
  vec3, vec4, float, int, uint, floor, fract, mix, max, dot, normalize, clamp, sin, cos, atan,
  If, Discard, select, uv,
} from "../../vendor/three/three.tsl.js";
import { OAK_CELL } from "./oak-placement.js";
import { landLook, speciesThresholds } from "../engine/look.js";

// Impostor range (m) per quality tier.
export const IMPOSTOR_RANGE = [250, 900, 1500];
const TAU = Math.PI * 2;

export function createImpostors(terrain, biome, biomeBase, ground, speciesOrder, look = landLook(null)) {
  const imp = biome.trees?.impostors,
    tex = biome.trees?.textures;
  if (!imp?.rows?.length || !tex?.impostorAlbedo) return null;
  const load = (file, colour) => {
      const t = new THREE.TextureLoader().load(new URL(file, biomeBase).href);
      if (colour) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    },
    albedoTex = load(tex.impostorAlbedo, true),
    normalTex = load(tex.impostorNormal, false),
    rows = imp.rows,
    frames = imp.frames,
    // Rows are grouped by species in speciesOrder, the same count each (checked here).
    perSpecies = rows.filter((r) => r.species === speciesOrder[0]).length;
  for (const s of speciesOrder)
    if (rows.filter((r) => r.species === s).length !== perSpecies) throw new Error("Impostor rows are uneven");
  const crownOf = Object.fromEntries((biome.trees.baked ?? []).map((v) => [v.id, v.crownRadius])),
    u = ground.uniforms,
    { width: w, height: h, cell, x0, z0 } = terrain,
    p = {
      cam: uniform(new THREE.Vector2()),
      camCell: uniform(new THREE.Vector2()),
      side: uniform(1),
      inner: uniform(80),
      outer: uniform(500),
      rowSize: uniformArray(rows.map((r) => r.size / crownOf[r.id])),
      rowCentreY: uniformArray(rows.map((r) => r.centre[1] / crownOf[r.id])),
      // Summer over spring leaf tint per species (the sheets are baked spring-tinted).
      summer: uniformArray(
        speciesOrder.map((s) => {
          const t = biome.trees.tints[s];
          return new THREE.Vector3(t.summer[0] / t.spring[0], t.summer[1] / t.spring[1], t.summer[2] / t.spring[2]);
        }),
      ),
    };

  // water.cu's hashU / random / hash in unsigned integer math.
  const hashU = (x0_) => {
    let x = x0_;
    x = x.bitXor(x.shiftRight(uint(16)));
    x = x.mul(uint(2146121005));
    x = x.bitXor(x.shiftRight(uint(15)));
    x = x.mul(uint(2221713035));
    x = x.bitXor(x.shiftRight(uint(16)));
    return x;
  };
  const hash = (a, b) =>
    float(hashU(uint(int(a).mul(1973).add(int(b).mul(9277)).add(89173))).bitAnd(uint(16777215)))
      .add(1)
      .div(16777217);
  const sm = (a, b, x) => {
    const t = clamp(x.sub(a).div(b - a), 0, 1);
    return t.mul(t).mul(float(3).sub(t.mul(2)));
  };
  const noise = (x, z) => {
    const ix = floor(x),
      iz = floor(z),
      fu = fract(x),
      fw = fract(z),
      uu = fu.mul(fu).mul(float(3).sub(fu.mul(2))),
      ww = fw.mul(fw).mul(float(3).sub(fw.mul(2)));
    return mix(mix(hash(ix, iz), hash(ix.add(1), iz), uu), mix(hash(ix, iz.add(1)), hash(ix.add(1), iz.add(1)), uu), ww);
  };
  const fbm = (x, z) =>
    noise(x, z)
      .mul(0.55)
      .add(noise(x.mul(2.03).add(17.1), z.mul(2.03).add(17.1)).mul(0.28))
      .add(noise(x.mul(4.12), z.mul(4.12)).mul(0.12))
      .add(noise(x.mul(8.36), z.mul(8.36)).mul(0.05));
  const gridUv = (x, z) => vec2(x.sub(x0).div(cell).add(0.5).div(w), z.sub(z0).div(cell).add(0.5).div(h));
  const terr = (x, z) => texture(ground.terrainTex, gridUv(x, z)).level(0);

  // (row, frame, rotation, 1 if drawn) per card, for the fragment stage.
  const vCard = varying(vec4(0), "vImpostorCard");

  const positionNode = Fn(() => {
    const i = int(instanceIndex),
      side = int(p.side),
      cx = p.camCell.x.add(float(i.mod(side))).sub(p.side.mul(0.5).floor()),
      cz = p.camCell.y.add(float(i.div(side))).sub(p.side.mul(0.5).floor()),
      x = cx.add(0.15).add(hash(cx.add(71), cz.sub(19)).mul(0.7)).mul(OAK_CELL),
      z = cz.add(0.15).add(hash(cx.sub(33), cz.add(57)).mul(0.7)).mul(OAK_CELL),
      // oakDensity (lidar normal from ±3 m, shore distance, valley channel, grove noise).
      g = terr(x, z),
      nx = terr(x.sub(3), z).x.sub(terr(x.add(3), z).x),
      nz = terr(x, z.sub(3)).x.sub(terr(x, z.add(3)).x),
      len = vec3(nx, 6, nz).length(),
      spur = float(1).sub(g.z),
      valley = float(1).sub(sm(0.22, 0.6, spur)),
      north = sm(0, -0.4, nz.div(len)),
      steep = sm(0.18, 0.45, float(1).sub(float(6).div(len))),
      grove = sm(0.46, 0.64, fbm(x.mul(0.0065).add(13), z.mul(0.0065).sub(4))),
      density = clamp(
        valley.mul(0.85).add(0.05).add(north.mul(0.55)).add(steep.mul(0.25)).add(grove.mul(0.75)).sub(sm(0.62, 0.88, spur).mul(0.7))
          .add(float(1).sub(sm(0.62, 0.88, spur)).mul(look.cover)),
        0,
        1,
      ).mul(sm(10, 35, g.y)),
      d = vec2(x, z).sub(p.cam).length(),
      drawn = hash(cx, cz).lessThanEqual(density).and(d.greaterThanEqual(p.inner)).and(d.lessThan(p.outer)),
      radius = hash(cx.add(11), cz.add(5)).mul(3.2).add(3.4),
      pick = hash(cx.add(5), cz.add(91)),
      turn = hash(cx.sub(7), cz.add(3)),
      // look.js pickSpecies: how many thresholds the pick has passed.
      // oak-placement.js standPick: the pick shifted by the ~80 m stand field.
      stand = look.stands > 0 ? clamp(pick.add(noise(x.mul(0.012).add(41), z.mul(0.012).sub(7)).sub(0.5).mul(2 * look.stands)), 0, 1) : pick,
      species = speciesThresholds(look, speciesOrder)
        .slice(0, -1)
        .reduce((n, t) => n.add(select(stand.greaterThanEqual(t), float(1), float(0))), float(0)),
      row = species.mul(perSpecies).add(floor(turn.mul(997)).mod(perSpecies)),
      theta = turn.mul(TAU),
      // Which photograph: the viewer's direction in the tree's own (unrotated) frame.
      wx = p.cam.x.sub(x),
      wz = p.cam.y.sub(z),
      lx = wx.mul(cos(theta)).sub(wz.mul(sin(theta))),
      lz = wx.mul(sin(theta)).add(wz.mul(cos(theta))),
      frame = floor(atan(lz, lx).div(TAU).mul(frames).add(0.5)).mod(frames).add(frames).mod(frames),
      size = p.rowSize.element(int(row)).mul(radius),
      centreY = p.rowCentreY.element(int(row)).mul(radius),
      wl = vec2(wx, wz).length().max(0.001),
      right = vec3(wz.div(wl), 0, wx.div(wl).negate()),
      scale = select(drawn, size, float(0)),
      base = vec3(x, g.x.sub(0.2).add(centreY), z);
    vCard.assign(vec4(row, frame, theta, select(drawn, float(1), float(0))));
    return base.add(right.mul(positionLocal.x.mul(scale))).add(vec3(0, 1, 0).mul(positionLocal.y.mul(scale)));
  })();

  const colorNode = Fn(() => {
    const row = vCard.x,
      frame = vCard.y,
      theta = vCard.z,
      q = uv(),
      at = vec2(frame.add(q.x).div(frames), float(rows.length).sub(row).sub(1).add(q.y).div(rows.length)),
      a = texture(albedoTex, at),
      n0 = texture(normalTex, at).xyz.mul(2).sub(1);
    If(a.a.lessThan(0.5).or(vCard.w.lessThan(0.5)), () => Discard());
    const n = normalize(vec3(n0.x.mul(cos(theta)).add(n0.z.mul(sin(theta))), n0.y, n0.x.mul(sin(theta)).negate().add(n0.z.mul(cos(theta))))),
      species = floor(row.div(perSpecies)),
      tint = mix(vec3(1), p.summer.element(int(species)), u.season),
      light = texture(ground.lightTex, gridUv(positionWorld.x, positionWorld.z)),
      wrap = float(0.45),
      sunLit = u.sunColor.mul(max(dot(n, u.sun), 0).mul(float(1).sub(wrap)).add(wrap).mul(light.x)),
      skyLit = u.fill.mul(n.y.mul(0.25).add(0.55).mul(light.y));
    return a.rgb.mul(tint).mul(sunLit.add(skyLit));
  })();

  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  material.positionNode = positionNode;
  material.colorNode = colorNode;
  // Alpha 0.5 marks tree pixels for pack.js, as the meshes do.
  material.opacityNode = float(0.5);
  const maxSide = Math.ceil((2 * IMPOSTOR_RANGE[2]) / OAK_CELL) + 1,
    mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, maxSide * maxSide);
  mesh.frustumCulled = false;

  return {
    mesh,
    update(state, meshRange) {
      const outer = IMPOSTOR_RANGE[Math.max(0, Math.min(2, state.quality))],
        side = Math.ceil((2 * outer) / OAK_CELL) + 1;
      p.cam.value.set(state.x, state.z);
      p.camCell.value.set(Math.floor(state.x / OAK_CELL), Math.floor(state.z / OAK_CELL));
      p.side.value = side;
      p.inner.value = meshRange;
      p.outer.value = outer;
      mesh.count = side * side;
      return outer;
    },
  };
}
