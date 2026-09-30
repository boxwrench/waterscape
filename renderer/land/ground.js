// Ground material for the land pass: the biome's CC0 photo textures (grass, soil, rock) blended
// by slope, the lidar valley channel and the waterline, graded by season, and lit like
// terrainShade in water.cu — preset sun and sky fill, with sun visibility and sky openness from
// the baked light map (bake_light). Trees are still drawn by the water kernel on top.
import * as THREE from "../../vendor/three/three.webgpu.js";
import { landLook } from "../engine/look.js";
import {
  Fn, texture, uniform, positionWorld, normalWorld, vec2, vec3, float, mix, smoothstep, dot,
  max, normalize, clamp, mx_noise_float, sin,
} from "../../vendor/three/three.tsl.js";

// Mean linear luminance of each texture (measured once), so its detail can modulate the tuned
// palette instead of replacing it.
const MEAN = { grass: 0.1448, soil: 0.1694, rock: 0.0766 };

function loadTexture(url, colour) {
  const t = new THREE.TextureLoader().load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (colour) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A lidar-grid-sized float texture (RGBA per cell) with linear filtering.
export function gridTexture(data, width, height) {
  const t = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export function createGroundMaterial(terrain, biomeBase, biome, look = landLook(null)) {
  // A layer's listed files (colour, normal; may point into another biome), else the convention.
  const files = (layer, kind) =>
    new URL(biome.ground[layer].files?.[kind === "color" ? 0 : 1] ?? `ground/${layer}_${kind}.jpg`, biomeBase).href,
    tex = {};
  for (const layer of Object.keys(biome.ground))
    tex[layer] = { colour: loadTexture(files(layer, "color"), true), normal: loadTexture(files(layer, "normal"), false) };
  const { width: w, height: h, cell, x0, z0 } = terrain,
    // (height, shoreDistance, valley, 0) per lidar cell — the same data the shader samples.
    terrainTex = gridTexture(new Float32Array(terrain.cells), w, h),
    // (sun visibility, sky openness) per cell, filled on the GPU by bake_light.
    lightTex = gridTexture(new Float32Array(w * h * 4).fill(1), w, h),
    u = {
      sun: uniform(new THREE.Vector3(0, 1, 0)),
      sunColor: uniform(new THREE.Vector3(2, 1.8, 1.5)),
      fill: uniform(new THREE.Vector3(0.36, 0.46, 0.62)),
      season: uniform(1),
    };

  const gridUv = (p) => vec2(p.x.sub(x0).div(cell).add(0.5).div(w), p.z.sub(z0).div(cell).add(0.5).div(h));
  // Two rotated, offset scales blended by low-frequency noise hide the tiling repeat.
  const antiTile = (t, xz, scale) => {
    const a = texture(t, xz.div(scale)),
      r = vec2(xz.x.mul(0.8).sub(xz.y.mul(0.6)), xz.x.mul(0.6).add(xz.y.mul(0.8))),
      b = texture(t, r.div(scale * 1.37).add(vec2(0.37, 0.71))),
      k = smoothstep(-0.25, 0.25, mx_noise_float(vec3(xz.mul(0.045), 0)));
    return mix(a, b, k);
  };
  const lum = (c) => dot(c, vec3(0.2126, 0.7152, 0.0722));

  const colorNode = Fn(() => {
    const p = positionWorld,
      xz = vec2(p.x, p.z),
      g = texture(terrainTex, gridUv(p)),
      light = texture(lightTex, gridUv(p)),
      n0 = normalize(normalWorld),
      slope = float(1).sub(n0.y),
      valley = g.z,
      macro = mx_noise_float(vec3(xz.mul(0.012), 3)).mul(0.5).add(0.5);
    // Grass: the palette terrainShade uses (spring green, summer straw), modulated by the photo.
    const grassPhoto = antiTile(tex.grass.colour, xz, 2.6).rgb,
      detail = clamp(lum(grassPhoto).div(MEAN.grass), 0.35, 2.2),
      spring = mix(vec3(0.13, 0.3, 0.03), vec3(0.3, 0.46, 0.06), macro),
      summer = mix(vec3(...look.summer.ground[0]), vec3(...look.summer.ground[1]), macro),
      grass = mix(spring, summer, u.season).mul(detail.mul(0.55).add(0.45)),
      // Bank soil: two photo soils in patches, large-scale tint, and faint "bathtub rings" —
      // bands left along a reservoir's drawdown zone by past water levels.
      soilMix = smoothstep(-0.3, 0.3, mx_noise_float(vec3(xz.mul(0.03), 11))),
      soilPhoto = mix(antiTile(tex.soil.colour, xz, 3.1).rgb, antiTile(tex.ochre.colour, xz, 3.7).rgb, soilMix),
      rings = sin(p.y.mul(9.0).add(mx_noise_float(vec3(xz.mul(0.02), 13)).mul(2.0))).mul(0.5).add(0.5),
      soilTint = mx_noise_float(vec3(xz.mul(0.008), 17)).mul(0.25).add(1.0),
      soil = soilPhoto.mul(1.25).mul(soilTint).mul(rings.mul(0.22).add(0.86)),
      rock = antiTile(tex.rock.colour, xz, 4.3).rgb.mul(2.1);
    // Rock on steep ground and spur crests; soil on the drawdown bank and in patches.
    const rockW = smoothstep(0.34, 0.55, slope.add(macro.sub(0.5).mul(0.25)))
        .mul(float(1).sub(valley.mul(0.6))),
      bank = float(1).sub(smoothstep(3, 6, p.y)),
      patch = smoothstep(0.72, 0.86, mx_noise_float(vec3(xz.mul(0.02), 7)).mul(0.5).add(0.5)),
      soilW = max(bank, patch.mul(0.6)),
      wet = float(1).sub(smoothstep(0.2, 0.9, p.y));
    let albedo = mix(grass, soil, soilW);
    albedo = mix(albedo, rock, rockW);
    albedo = mix(albedo, albedo.mul(0.45), wet);
    // Close-up detail normal from the dominant layer's normal map (tangent frame ≈ world x/z).
    const nm = mix(antiTile(tex.grass.normal, xz, 2.6).rgb, antiTile(tex.rock.normal, xz, 4.3).rgb, rockW),
      bump = vec3(nm.x.mul(2).sub(1), 0, float(1).sub(nm.y.mul(2))).mul(0.35),
      n = normalize(n0.add(bump)),
      sunLit = u.sunColor.mul(max(dot(n, u.sun), 0).mul(light.x)),
      skyLit = u.fill.mul(n0.y.mul(0.3).add(0.38).mul(light.y)),
      bounce = vec3(0.2, 0.16, 0.08).mul(float(1).sub(n0.y).mul(0.25));
    return albedo.mul(sunLit.add(skyLit).add(bounce));
  })();

  const material = new THREE.MeshBasicNodeMaterial();
  material.colorNode = colorNode;
  return {
    material,
    terrainTex,
    lightTex,
    // Light uniforms shared with the grass (grass.js).
    uniforms: u,
    // Match the preset the water kernel uses (renderer/engine/presets.js).
    setLight(preset, season) {
      u.sun.value.set(...preset.sun);
      u.sunColor.value.set(...preset.sunColor);
      u.fill.value.set(...preset.fill);
      u.season.value = season;
    },
    setSeason(season) {
      u.season.value = season;
    },
  };
}
