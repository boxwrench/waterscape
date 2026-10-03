// Ground material for the land pass: the biome's CC0 photo textures (grass, soil, rock) blended
// by slope, the lidar valley channel and the waterline, graded by season, and lit like
// terrainShade in water.cu — preset sun and sky fill, with sun visibility and sky openness from
// the baked light map (bake_light). Trees are still drawn by the water kernel on top.
import * as THREE from "../../vendor/three/three.webgpu.js";
import { landLook } from "../engine/look.js";
import { graniteRock, triplanar } from "./granite.js";
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

export function createGroundMaterial(terrain, biomeBase, biome, look = landLook(null), detail = null) {
  // 1 m relief tiles (pipeline/detail.py): surface normals that replace the 10 m mesh's inside
  // each tile, fading out over its outer 40 m. Scene x/z → UTM via the terrain's origin.
  const [originE, originN] = terrain.meta.originUTM,
    tiles = (detail?.tiles ?? []).map((t) => {
      const tex = new THREE.TextureLoader().load(new URL(t.file, detail.base).href);
      tex.anisotropy = 8;
      return { ...t, tex };
    });
  // A layer's listed files (colour, normal; may point into another biome), else the convention.
  const files = (layer, kind) =>
    new URL(biome.ground[layer].files?.[kind === "color" ? 0 : 1] ?? `ground/${layer}_${kind}.jpg`, biomeBase).href,
    tex = {};
  for (const layer of Object.keys(biome.ground))
    tex[layer] = { colour: loadTexture(files(layer, "color"), true), normal: loadTexture(files(layer, "normal"), false) };
  const { width: w, height: h, cell, x0, z0 } = terrain,
    // (height, shoreDistance, valley, drawdown) per lidar cell — the same data the shader samples.
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
  // Rock brightness per biome, a number or rgb (Sierra granite is warm and pale).
  const gain = biome.ground.rock?.gain ?? 2.1,
    rockGain = Array.isArray(gain) ? vec3(...gain) : float(gain);
  const rockStreaks = float(biome.ground.rock?.streaks ?? 0),
    // Below a dam: bare, water-polished dark granite from `canyon.below` metres under the lake.
    canyon = biome.ground.rock?.canyon,
    // Photographed granite (granite.js) where the biome supplies its joints/slab/canyon layers.
    granite = !!(tex.joints && tex.slab && tex.canyon);

  const colorNode = Fn(() => {
    const p = positionWorld,
      xz = vec2(p.x, p.z),
      g = texture(terrainTex, gridUv(p)),
      light = texture(lightTex, gridUv(p)),
      nMesh = normalize(normalWorld),
      // Inside a relief tile the lidar's own 1 m normal; `relief` is how much of it applies.
      fromTiles = tiles.reduce(
        (acc, t) => {
          const [l, b, r, top] = t.extentUTM,
            e = p.x.add(originE),
            nn = float(originN).sub(p.z),
            uv2 = vec2(e.sub(l).div(r - l), nn.sub(b).div(top - b)),
            edge = smoothstep(0, 40, e.sub(l))
              .mul(smoothstep(0, 40, float(r).sub(e)))
              .mul(smoothstep(0, 40, nn.sub(b)))
              .mul(smoothstep(0, 40, float(top).sub(nn))),
            c = texture(t.tex, uv2).rgb.mul(255).sub(128).div(127),
            n1 = vec3(c.x, max(float(1).sub(c.x.mul(c.x)).sub(c.y.mul(c.y)), 0).sqrt(), c.y),
            // A plan-view map stretches down a near-vertical face: step back to a third there.
            w = edge.mul(mix(float(1), float(0.35), smoothstep(0.55, 0.85, float(1).sub(nMesh.y))));
          // h: metres above the 3 m-blurred surface (hollows negative), from the blue channel.
          return { n: mix(acc.n, n1, w), w: max(acc.w, w), h: mix(acc.h, c.z.mul(1.5), w) };
        },
        { n: nMesh, w: float(0), h: float(0) },
      ),
      relief = fromTiles.w,
      hollow = fromTiles.h,
      n0 = normalize(fromTiles.n),
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
      // Brightness per biome: Diablo sandstone and greywacke 2.1, pale Sierra granite brighter.
      // Projected from three sides: from above alone it stretches down steep faces.
      rockPhoto = triplanar(tex.rock.colour, p, n0, 4.3).rgb.mul(rockGain),
      // Streaked walls (biome rock.streaks, 0 default): fine noise across the ground becomes
      // vertical water streaks on a cliff face, plus broad rust staining.
      streak = mx_noise_float(vec3(xz.mul(0.035), 23)).mul(0.5).add(0.5).mul(0.6).add(mx_noise_float(vec3(xz.mul(0.11), 31)).mul(0.2).add(0.2)),
      rust = smoothstep(0.55, 0.8, mx_noise_float(vec3(xz.mul(0.015), 29)).mul(0.5).add(0.5)),
      rock = mix(
        rockPhoto,
        rockPhoto.mul(streak.mul(0.9).add(0.45)).mul(mix(vec3(1), vec3(1.1, 0.86, 0.66), rust)),
        rockStreaks,
      );
    // Rock on steep ground and spur crests; soil on the drawdown bank and in patches.
    // look.rock lowers the threshold where the land is bare granite (domes and slabs).
    const rockW = smoothstep(0.34 - look.rock, 0.55 - look.rock, slope.add(macro.sub(0.5).mul(0.25)))
        .mul(float(1).sub(valley.mul(0.6))),
      bank = float(1).sub(smoothstep(3, 6, p.y)),
      patch = smoothstep(0.72, 0.86, mx_noise_float(vec3(xz.mul(0.02), 7)).mul(0.5).add(0.5)),
      wet = float(1).sub(smoothstep(0.2, 0.9, p.y));
    if (granite) {
      // Granite country: the drawdown band up to full pool is bare bleached rock (look.bathtub
      // metres above the surveyed water), the canyon below a dam dark wet rock; no soil bank.
      // Only inside the full-pool zone the build found (terrain channel w): not the canyon
      // below a dam at the same height.
      const band = float(1).sub(smoothstep(look.bathtub - 1.5, look.bathtub + 1.5, p.y)).mul(smoothstep(-3, -1, p.y)).mul(g.w),
        // The canyon rock fades in over ~45 m of height, its edge warped ±20 m by two octaves
        // of noise so it never follows a level contour.
        edgeY = p.y
          .add(mx_noise_float(vec3(xz.mul(0.02), 51)).mul(14))
          .add(mx_noise_float(vec3(xz.mul(0.08), 53)).mul(6)),
        deep = canyon ? float(1).sub(smoothstep(canyon.below - 25, canyon.below + 20, edgeY)) : float(0),
        stone = graniteRock(tex, biome.ground, p, n0, slope, band, deep, relief),
        cover = max(rockW, max(band, deep)),
        nm = antiTile(tex.grass.normal, xz, 2.6).rgb,
        bump = vec3(nm.x.mul(2).sub(1), 0, float(1).sub(nm.y.mul(2))).mul(0.35),
        n = normalize(mix(n0.add(bump), stone.normal, cover));
      let albedo = mix(mix(grass, soil, patch.mul(0.6)), stone.albedo, cover);
      // Wet only at the lake's own shore (the drawdown zone), not the canyon below a dam,
      // which lies far below the lake surface.
      albedo = mix(albedo, albedo.mul(0.45), wet.mul(g.w));
      // Inside relief tiles: hollows and cracks see less sky (and a little less sun), edges a
      // little more; the 10 m baked shadow gets firmer edges; the flat sky fill comes down a
      // touch so sun and shade read on the rock.
      // The baked light (sun visibility .x, sky openness .y) is one value per 10 m cell looked
      // up from above: on a cliff each cell smears down the whole face into blobs. On steep
      // ground it mostly gives way to the face's own angle to the sun and the 1 m hollows.
      const occlusion = clamp(hollow.mul(0.36).add(1), 0.45, 1.15),
        steepFace = smoothstep(0.4, 0.75, float(1).sub(nMesh.y)),
        sunShadow = mix(mix(light.x, smoothstep(0.2, 0.8, light.x), relief), float(1), steepFace.mul(0.85)),
        skyOpen = mix(light.y, float(0.8), steepFace.mul(0.7)),
        sunLit = u.sunColor.mul(max(dot(n, u.sun), 0).mul(sunShadow).mul(clamp(hollow.mul(0.2).add(1), 0.7, 1.08))),
        skyLit = u.fill.mul(n.y.mul(0.3).add(0.38).mul(skyOpen).mul(occlusion).mul(mix(float(1), float(0.85), relief))),
        bounce = vec3(0.2, 0.16, 0.08).mul(float(1).sub(n0.y).mul(0.25)).mul(occlusion);
      return albedo.mul(sunLit.add(skyLit).add(bounce));
    }
    const soilW = max(bank, patch.mul(0.6));
    let albedo = mix(grass, soil, soilW);
    albedo = mix(albedo, rock, rockW);
    if (canyon) {
      const deep = float(1).sub(smoothstep(canyon.below, canyon.below + 15, p.y));
      // Grey, not the warm weathered granite above: the photos show near-black wet rock with
      // pale veins.
      const grey = vec3(dot(rock, vec3(0.3333))).mul(canyon.gain),
        vein = smoothstep(0.62, 0.7, mx_noise_float(vec3(xz.x.mul(0.3), p.y.mul(0.03), xz.y.mul(0.3))).mul(0.5).add(0.5));
      albedo = mix(albedo, mix(grey, grey.mul(2.2), vein), deep);
    }
    albedo = mix(albedo, albedo.mul(0.45), wet);
    // Close-up detail normal from the dominant layer's normal map (tangent frame ≈ world x/z).
    const nm = mix(antiTile(tex.grass.normal, xz, 2.6).rgb, antiTile(tex.rock.normal, xz, 4.3).rgb, rockW),
      bump = vec3(nm.x.mul(2).sub(1), 0, float(1).sub(nm.y.mul(2))).mul(0.35),
      n = normalize(n0.add(bump)),
      // Baked light on steep faces gives way to the face's own angle (see the granite branch).
      steepFace = smoothstep(0.4, 0.75, float(1).sub(nMesh.y)),
      sunLit = u.sunColor.mul(max(dot(n, u.sun), 0).mul(mix(light.x, float(1), steepFace.mul(0.85)))),
      skyLit = u.fill.mul(n0.y.mul(0.3).add(0.38).mul(mix(light.y, float(0.8), steepFace.mul(0.7)))),
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
