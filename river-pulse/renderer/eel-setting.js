import * as THREE from "../../vendor/three/three.webgpu.js";
import { attribute, bumpMap, color, dot, float, mix, normalWorldGeometry, normalize, positionWorld, smoothstep, texture, transformNormalToView, triplanarTexture, uv, vec2, vec3 } from "../../vendor/three/three.tsl.js";
import { forestSites, forestDetailSites } from "./eel-setting-layout.js";
import { loadTerrainSurfaceDetail } from "./terrain-surface-detail.js";

const biomeBase = new URL("../../data/biomes/peninsula-oak-fir/", import.meta.url);

function groundNoise() {
  const size = 256, bytes = new Uint8Array(size * size * 4), hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + 17041) * 43758.5453; return n - Math.floor(n);
  }, sample = (x, y, frequency) => {
    const u = x * frequency / size, v = y * frequency / size, a = Math.floor(u), b = Math.floor(v),
      s = u - a, t = v - b, sx = s * s * (3 - 2 * s), sy = t * t * (3 - 2 * t),
      at = (i, j) => hash(i % frequency, j % frequency);
    return (at(a, b) * (1 - sx) + at(a + 1, b) * sx) * (1 - sy)
      + (at(a, b + 1) * (1 - sx) + at(a + 1, b + 1) * sx) * sy;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const k = (y * size + x) * 4;
    bytes[k] = Math.round(255 * (0.5 * sample(x, y, 8) + 0.3 * sample(x, y, 32) + 0.2 * sample(x, y, 64)));
    bytes[k + 1] = Math.round(255 * hash(x, y)); bytes[k + 2] = bytes[k]; bytes[k + 3] = 255;
  }
  const map = new THREE.DataTexture(bytes, size, size); map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.needsUpdate = true; return map;
}

function landMaterial(aerial, noise, surface = null) {
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 1 }), p = positionWorld,
    image = texture(aerial, uv()), r = image.r, g = image.g, b = image.b,
    woody = smoothstep(0.005, 0.035, g.sub(r)).mul(float(1).sub(smoothstep(0.28, 0.42, r.add(g).add(b).div(3)))),
    steep = float(1).sub(smoothstep(0.45, 0.87, normalWorldGeometry.y.abs())),
    grain = triplanarTexture(texture(noise), null, null, float(1 / 18), p, normalWorldGeometry).r,
    broad = texture(noise, p.xz.div(145)).r,
    // Uneven vertical weathering and restrained bedding are authored surface cues.
    streak = texture(noise, p.xz.div(70).add(p.y.mul(0.0008))).r,
    bed = p.y.mul(0.65).add(broad.mul(3)).sin().mul(0.035).add(1),
    rock = mix(color(0x737269), color(0xb1aa91), grain).mul(mix(0.84, 1.07, streak)).mul(bed),
    soil = mix(color(0x747964), color(0xaca78d), grain),
    cover = mix(color(0x263e32), color(0x46533d), broad).mul(mix(0.92, 1.06, grain));
  material.colorNode = mix(mix(soil, rock, steep), cover, woody.mul(float(1).sub(steep.mul(0.6))));
  material.normalNode = bumpMap(grain.mul(steep).add(broad.mul(0.12)), float(0.38));
  if (surface) {
    const detail = surface.modulate(p, normalWorldGeometry, material.colorNode, steep,
      float(1).sub(woody.mul(0.35))),
      baseNormal = transformNormalToView(normalWorldGeometry),
      detailedNormal = transformNormalToView(detail.normalNode);
    material.colorNode = detail.colorNode;
    // Keep the previous bump and add the photo normal offset in view space.
    material.normalNode = normalize(material.normalNode.add(detailedNormal.sub(baseNormal)));
  }
  return material;
}

function bakedPart(bytes, part) {
  const n = part.vertexCount, values = new Float32Array(bytes, part.offset, n * 8), geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(values.subarray(0, n * 3), 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(values.subarray(n * 3, n * 6), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(values.subarray(n * 6, n * 8), 2));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(bytes, part.offset + n * 32, part.indexCount), 1)); return geometry;
}

export async function createEelSetting(terrain, classification, aerial) {
  const response = await fetch(new URL("biome.json", biomeBase));
  if (!response.ok) throw new Error(`Eel vegetation asset metadata: ${response.status}`);
  const biome = await response.json(), loader = new THREE.TextureLoader(),
    textures = biome.trees.textures.species["douglas-fir"],
    [treeMaps, surface] = await Promise.all([
      Promise.all([textures.bark, textures.leaf, biome.trees.textures.impostorAlbedo, biome.trees.textures.impostorNormal].map(file => loader.loadAsync(new URL(file, biomeBase).href))),
      loadTerrainSurfaceDetail(),
    ]), [barkMap, leafMap, atlas, atlasNormal] = treeMaps;
  barkMap.colorSpace = leafMap.colorSpace = atlas.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group(), sites = forestSites(terrain, classification.pixels, classification.mapped),
    dummy = new THREE.Object3D(), tint = new THREE.Color(), noise = groundNoise(),
    bark = new THREE.MeshStandardNodeMaterial({ map: barkMap, color: 0xc1b8a0, roughness: 1 }),
    needles = new THREE.MeshStandardNodeMaterial({ map: leafMap, color: 0xb2b6a4, alphaTest: 0.48, side: THREE.DoubleSide, roughness: 1 }),
    farGeometry = new THREE.PlaneGeometry(1, 1),
    offsets = new Float32Array(sites.length * 2), turns = new Float32Array(sites.length),
    farMaterial = new THREE.MeshBasicNodeMaterial({ alphaTest: 0.42, side: THREE.DoubleSide }),
    far = new THREE.InstancedMesh(farGeometry, farMaterial, sites.length), batches = [],
    atlasUv = uv().div(vec2(biome.trees.impostors.frames, biome.trees.impostors.rows.length)).add(attribute("atlasOffset", "vec2")),
    atlasSample = texture(atlas, atlasUv), n0 = texture(atlasNormal, atlasUv).xyz.mul(2).sub(1),
    turn = attribute("treeYaw", "float"),
    n = normalize(vec3(n0.x.mul(turn.cos()).add(n0.z.mul(turn.sin())), n0.y,
      n0.x.mul(turn.sin()).negate().add(n0.z.mul(turn.cos())))),
    light = dot(n, normalize(vec3(-1600, 2300, 700))).max(0).mul(2.0).add(n.y.mul(0.3).add(1.6));
  farGeometry.setAttribute("atlasOffset", new THREE.InstancedBufferAttribute(offsets, 2));
  farGeometry.setAttribute("treeYaw", new THREE.InstancedBufferAttribute(turns, 1));
  const luma = dot(atlasSample.rgb, vec3(0.2126, 0.7152, 0.0722)),
    graded = mix(atlasSample.rgb, vec3(luma), float(0.4)).mul(vec3(1.06, 0.91, 0.86));
  farMaterial.colorNode = graded.mul(light); farMaterial.opacityNode = atlasSample.a;
  group.add(far);
  const variants = biome.trees.baked.filter(v => /douglas-fir-[ab]-far$/.test(v.id)),
    impostors = biome.trees.impostors.rows.map((row, rowIndex) => {
      const definition = biome.trees.baked.find(v => v.id === row.id);
      return { definition, rowIndex, row };
    });
  for (const [v, variant] of variants.entries()) {
    const asset = await fetch(new URL(variant.file, biomeBase));
    if (!asset.ok) throw new Error(`Eel tree asset ${variant.id}: ${asset.status}`);
    const bytes = await asset.arrayBuffer(), meshes = [];
    for (const [part, material] of [["branches", bark], ["leaves", needles]]) {
      const mesh = new THREE.InstancedMesh(bakedPart(bytes, variant.parts[part]), material, 96);
      meshes.push(mesh); group.add(mesh);
    }
    batches.push({ v, variant, meshes });
  }
  function write(mesh, selected, naturalHeight = 1) {
    mesh.count = selected.length;
    selected.forEach((site, i) => {
      const scale = site.h / naturalHeight;
      dummy.position.set(site.x, site.y - 0.35, site.z); dummy.rotation.set(0, site.yaw, 0);
      dummy.scale.set(scale * site.width, scale, scale * site.width); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      tint.setRGB(site.tint, site.tint, site.tint); mesh.setColorAt(i, tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  const originalGrounds = Float64Array.from(sites, site => site.y);
  let detailCount = 0;
  function setCamera(position, target) {
    const { detailed, distant } = forestDetailSites(sites, position, 96, target); detailCount = detailed.length;
    far.count = distant.length;
    distant.forEach((site, i) => {
      const { definition, rowIndex, row } = impostors[site.variant],
        scale = site.h / definition.height, angle = Math.atan2(position[0] - site.x, position[2] - site.z),
        frame = ((Math.round((angle - site.yaw) / (2 * Math.PI) * biome.trees.impostors.frames) % 8) + 8) % 8;
      dummy.position.set(site.x, site.y + row.centre[1] * scale, site.z);
      dummy.rotation.set(0, angle, 0); dummy.scale.set(row.size * scale * site.width, row.size * scale, 1);
      dummy.updateMatrix(); far.setMatrixAt(i, dummy.matrix); tint.setRGB(site.tint, site.tint, site.tint); far.setColorAt(i, tint);
      offsets[i * 2] = frame / 8; offsets[i * 2 + 1] = 1 - (rowIndex + 1) / biome.trees.impostors.rows.length;
      turns[i] = site.yaw;
    });
    far.instanceMatrix.needsUpdate = true;
    if (far.instanceColor) far.instanceColor.needsUpdate = true;
    farGeometry.attributes.atlasOffset.needsUpdate = true; farGeometry.attributes.treeYaw.needsUpdate = true; far.computeBoundingSphere();
    for (const { v, variant, meshes } of batches) {
      const selected = detailed.filter(site => site.variant - 2 === v);
      for (const mesh of meshes) write(mesh, selected, variant.height);
    }
  }
  group.name = "Eel photo-informed forest Setting";
  group.userData = { bindingClass: "setting", surveyed: false, seed: 17041 };
  return { group, material: landMaterial(aerial, noise, surface), previousMaterial: landMaterial(aerial, noise),
    setCamera, setGroundSampler(sample) {
      for (let i = 0; i < sites.length; i++)
        sites[i].y = sample ? sample(sites[i].x, sites[i].z) : originalGrounds[i];
    }, treeCount: sites.length, detailCount: () => detailCount,
    textures: [noise, barkMap, leafMap, atlas, atlasNormal, ...surface.textures] };
}
