import * as THREE from "../../../../../../vendor/three/three.webgpu.js";
import { color, float, instanceIndex, mix, normalWorld, positionGeometry, positionLocal, positionWorld, sin, smoothstep, texture, vec3 } from "../../../../../../vendor/three/three.tsl.js";
import { jennerCoast, jennerGrid, jennerGround, jennerRiver, JENNER_VIEWS } from "./jenner-layout.js";
import { grayStone } from "../../../../../scene-kit/beach-materials.js";
import { seededRandom } from "../../../../../scene-kit/bank-setting-layout.js";
import { SETTING_BASE } from "../../../../../scene-kit/bank-materials.js";
import { treeAssets } from "../../middle/hacienda_bridge/beach-woodland.js";

function terrain(noise, maps, clock, grassMap) {
  const grid = jennerGrid(), geometry = new THREE.BufferGeometry();
  for (let i = 0; i < grid.ground.length; i++) grid.positions[i * 3 + 1] = grid.ground[i];
  geometry.setAttribute("position", new THREE.BufferAttribute(grid.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1)); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.9 }), p = positionWorld,
    mottle = texture(noise, p.xz.div(160)), grain = texture(noise, p.xz.div(3)).r,
    sand = mix(color(0x625f56), color(0x85827a), grain.mul(0.35).add(mottle.g.mul(0.30))),
    gravel = maps ? grayStone(maps.pebbles.color, p.xz.div(1.8)).mul(vec3(0.88, 0.86, 0.77)) : sand,
    beach = mix(sand, gravel, 0.26),
    grassTint = mix(color(0x485938), color(0x8b9762), mottle.r.mul(0.75).add(mottle.b.mul(0.2))),
    scrub = texture(noise, p.xz.div(38)).g.mul(0.6).add(texture(noise, p.xz.div(11)).b.mul(0.4)),
    scrubTint = mix(grassTint, color(0x2d4430), smoothstep(0.55, 0.72, scrub).mul(0.5)),
    grass = grassMap ? scrubTint.mul(texture(grassMap, p.xz.div(1.5)).rgb.mul(1.1).add(0.45)) : scrubTint,
    slope = floatSlope(normalWorld.y),
    n = normalWorld.abs(), weights = n.div(n.x.add(n.y).add(n.z)),
    rock = maps ? grayStone(maps.rock.color, p.zy.div(12), 0.55).mul(weights.x)
      .add(grayStone(maps.rock.color, p.xz.div(12), 0.55).mul(weights.y))
      .add(grayStone(maps.rock.color, p.xy.div(12), 0.55).mul(weights.z)) : color(0x74746a),
    upland = mix(rock.mul(vec3(0.87, 0.9, 0.82)), grass, slope),
    bank = smoothstep(3, 8, p.y),
    wetFront = sin(clock.mul(0.95).add(mottle.b.mul(2))).mul(0.24).add(0.85),
    dry = smoothstep(wetFront.sub(0.3), wetFront.add(1.1), p.y);
  material.colorNode = mix(beach.mul(mix(0.62, 1, dry)), upland, bank);
  material.roughnessNode = mix(0.34, 0.96, dry);
  const mesh = new THREE.Mesh(geometry, material); mesh.name = "Jenner sand spit and coastal bluffs";
  mesh.receiveShadow = true; return mesh;
}

function floatSlope(y) { return smoothstep(0.48, 0.8, y); }

function rocks(maps) {
  const group = new THREE.Group(), random = seededRandom(891),
    geometry = new THREE.IcosahedronGeometry(1, 4), position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i),
      fracture = 0.89 + 0.11 * Math.sin(x * 17 + y * 7) * Math.sin(z * 11 - y * 9),
      top = 0.62 * Math.tanh(y / 0.62) + Math.sin(x * 13) * Math.sin(z * 8) * 0.025;
    position.setXYZ(i, x * fracture, top * fracture, z * fracture);
  }
  geometry.computeVertexNormals();
  // Icosphere faces share positions but not vertices. Average their normals to
  // keep weathered rock from reading as a faceted low-poly boulder.
  const normals = geometry.attributes.normal, shared = new Map();
  for (let i = 0; i < position.count; i++) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)].map(v => Math.round(v * 1e5)).join(","),
      entry = shared.get(key) ?? { normal: new THREE.Vector3(), indices: [] };
    entry.normal.add(new THREE.Vector3().fromBufferAttribute(normals, i)); entry.indices.push(i); shared.set(key, entry);
  }
  for (const { normal, indices } of shared.values()) {
    normal.normalize(); for (const i of indices) normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  const material = new THREE.MeshStandardNodeMaterial({ color: 0x787970, roughness: 0.96 });
  if (maps) {
    const p = positionWorld, n = normalWorld.abs(), w = n.div(n.x.add(n.y).add(n.z));
    material.colorNode = grayStone(maps.rock.color, p.zy.div(9), 0.55).mul(w.x)
      .add(grayStone(maps.rock.color, p.xz.div(9), 0.55).mul(w.y))
      .add(grayStone(maps.rock.color, p.xy.div(9), 0.55).mul(w.z))
      .mul(mix(color(0x4a4d47), color(0x8d8c80), smoothstep(-0.2, 12, p.y)));
    // Sea stacks and Goat Rock carry a green turf cap on their upward faces, as in photographs.
    material.colorNode = mix(material.colorNode, color(0x4f6234), smoothstep(0.55, 0.85, normalWorld.y).mul(smoothstep(8, 20, p.y)));
  }
  for (const [name, x, z, sx, sy, sz] of [
    ["Goat Rock silhouette", jennerCoast(1720) - 44, 1720, 78, 80, 125],
    ["Offshore sea stack", jennerCoast(2110) - 220, 2110, 65, 31, 50],
    ["River-mouth anchor rock", 40, -365, 9, 10, 12],
    ["Southern bluff outcrop", jennerCoast(1450) + 160, 1450, 26, 24, 36],
  ]) {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.position.set(x, name.includes("stack") ? 8 : name.includes("Goat") ? 12 : jennerGround(x, z) + sy * 0.25, z);
    mesh.scale.set(sx, sy, sz); mesh.rotation.y = 0.25;
    mesh.receiveShadow = true; mesh.castShadow = true; group.add(mesh);
  }
  const stones = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardNodeMaterial({ roughness: 0.92 }), 500), dummy = new THREE.Object3D(), tint = new THREE.Color();
  for (let i = 0; i < 500; i++) {
    const origin = i < 250 ? JENNER_VIEWS.river : JENNER_VIEWS.ocean,
      x = origin.x + (random() - 0.5) * 45, z = origin.z + (random() - 0.5) * 90,
      size = 0.018 + random() ** 3 * 0.15;
    dummy.position.set(x, jennerGround(x, z) + size * 0.24, z);
    dummy.scale.set(size * 1.5, size * 0.6, size); dummy.rotation.set(random(), random() * 6.28, random());
    dummy.updateMatrix(); stones.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.10, random() * 0.05, 0.15 + random() * 0.28); stones.setColorAt(i, tint);
  }
  stones.computeBoundingSphere(); stones.name = "Shore pebbles"; group.add(stones);
  group.name = "Jenner coastal rocks"; return group;
}

function driftwood() {
  const group = new THREE.Group(), random = seededRandom(157),
    bark = new THREE.MeshStandardNodeMaterial({ color: 0xa49d89, roughness: 0.98 }),
    cut = new THREE.MeshStandardNodeMaterial({ color: 0x8b816a, roughness: 1 }),
    trunk = new THREE.CylinderGeometry(0.25, 0.31, 1, 7, 3);
  for (let i = 0; i < 100; i++) {
    const z = i < 54 ? -200 + random() * 1550 : -405 + random() * 145,
      coast = jennerCoast(z), x = i < 54 ? coast + 30 + random() * 95 : -10 + random() * 310;
    if (jennerGround(x, z) < 0.8 || jennerGround(x, z) > 3) continue;
    const log = new THREE.Group(), length = 2 + random() * 7, mesh = new THREE.Mesh(trunk, [bark, cut, cut]);
    mesh.rotation.z = Math.PI / 2; mesh.scale.y = length; mesh.castShadow = true; log.add(mesh);
    for (let j = 0; j < 2; j++) {
      const branch = new THREE.Mesh(trunk, bark); branch.scale.set(0.3, length * 0.3, 0.3);
      branch.position.x = (random() - 0.5) * length * 0.8; branch.rotation.z = random() * 2 - 1; log.add(branch);
    }
    log.position.set(x, jennerGround(x, z) + 0.23, z); log.rotation.y = random() * Math.PI;
    group.add(log);
  }
  group.name = "Bleached driftwood"; return group;
}

async function coastalGrass(clock) {
  const textureMap = await new THREE.TextureLoader().loadAsync(new URL("../../../../../../data/biomes/diablo-oak/grass/fluffy-mask.jpg", import.meta.url).href),
    geometry = new THREE.BufferGeometry(), points = [], uvs = [], indices = [];
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI / 3, dx = Math.cos(angle), dz = Math.sin(angle), start = points.length / 3;
    points.push(-dx * 0.5, 0, -dz * 0.5, dx * 0.5, 0, dz * 0.5,
      -dx * 0.65 + 0.15, 1, -dz * 0.65, dx * 0.65 + 0.15, 1, dz * 0.65);
    uvs.push(0, 0, 1, 0, 0, 1, 1, 1); indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardNodeMaterial({ alphaMap: textureMap, alphaTest: 0.3,
    side: THREE.DoubleSide, roughness: 0.94 }), random = seededRandom(981), sites = [];
  material.positionNode = positionLocal.add(vec3(sin(clock.mul(0.6).add(float(instanceIndex).mul(0.37)))
    .mul(positionGeometry.y.pow(2)).mul(0.12), 0, 0));
  // Prairie on the bluffs the three views look at: behind the lookout, and the southern headland
  // that the Pacific beach faces. Patchy, denser on lower slopes. Setting, not a plant survey.
  for (const [x0, x1, z0, z1, count, size] of [[-420, 560, -860, -330, 36000, 1],
    [-120, 700, 850, 1950, 30000, 1.7]]) for (let i = 0; i < count; i++) {
    const x = x0 + random() * (x1 - x0), z = z0 + random() * (z1 - z0), y = jennerGround(x, z);
    if (y < 5 || y > 175 || jennerRiver(x, z).bankDistance < 6) continue;
    const patch = Math.sin(x * 0.045) * Math.sin(z * 0.061);
    if (random() > 0.62 + patch * 0.35 - y / 600) continue;
    sites.push({ x, y, z, size });
  }
  const mesh = new THREE.InstancedMesh(geometry, material, sites.length), dummy = new THREE.Object3D(), tint = new THREE.Color();
  sites.forEach((s, i) => {
    dummy.position.set(s.x, s.y - 0.04, s.z); dummy.rotation.set(0, random() * 6.28, 0);
    const h = (0.22 + random() * 0.54) * s.size; dummy.scale.set((0.6 + random() * 0.5) * s.size, h, (0.6 + random() * 0.5) * s.size);
    dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.19 + random() * 0.06, 0.24 + random() * 0.18, 0.27 + random() * 0.14); mesh.setColorAt(i, tint);
  });
  mesh.computeBoundingSphere(); mesh.name = "Coastal grass clumps"; return mesh;
}

async function woodland() {
  const response = await fetch(new URL("broadleaf.json", SETTING_BASE));
  if (!response.ok) throw new Error("Coastal woodland asset manifest unavailable");
  const manifest = await response.json(), variant = manifest.variants[0],
    raw = await (await fetch(new URL(variant.file, SETTING_BASE))).arrayBuffer(), loader = new THREE.TextureLoader(),
    [bark, leaf] = await Promise.all(["oak-bark.jpg", "oak-leaf.png"].map(name => loader.loadAsync(new URL(name, SETTING_BASE).href)));
  bark.colorSpace = leaf.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group(), random = seededRandom(918), sites = [];
  // Low broadleaf groups in gullies, with more woodland inland. General Setting
  // silhouettes reused from existing assets, not a local species census.
  for (const [cx, cz, count, spread] of [[570, -750, 65, 230], [1050, 1350, 80, 340],
    [1200, 700, 60, 170], [400, -400, 35, 95], [700, 2100, 70, 220]]) {
    for (let i = 0; i < count; i++) {
      const x = cx + (random() - 0.5) * spread, z = cz + (random() - 0.5) * spread,
        y = jennerGround(x, z);
      if (y < 6 || jennerRiver(x, z).bankDistance < 30) continue;
      sites.push({ x, y, z, height: 4 + random() * 10, turn: random() * 6.28 });
    }
  }
  for (const [part, imageMap] of [["branches", bark], ["leaves", leaf]]) {
    const p = variant.parts[part], n = p.vertexCount, f = new Float32Array(raw, p.offset, n * 8), g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(f.subarray(0, n * 3), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(f.subarray(n * 3, n * 6), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(f.subarray(n * 6, n * 8), 2));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(raw, p.offset + n * 32, p.indexCount), 1));
    const material = new THREE.MeshStandardNodeMaterial({ map: imageMap, roughness: 0.97,
      alphaTest: part === "leaves" ? 0.45 : 0, side: THREE.DoubleSide }),
      mesh = new THREE.InstancedMesh(g, material, sites.length), dummy = new THREE.Object3D(), tint = new THREE.Color();
    sites.forEach((s, i) => {
      dummy.position.set(s.x, s.y, s.z); dummy.rotation.set(0, s.turn, 0);
      dummy.scale.setScalar(s.height / variant.height); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      tint.setHSL(0.24, 0.15 + random() * 0.2, 0.42 + random() * 0.15); mesh.setColorAt(i, tint);
    });
    mesh.computeBoundingSphere(); group.add(mesh);
  }
  group.name = "Coastal woodland groups"; return group;
}

// Douglas-fir stands on the inland ridges and low coastal scrub on the bluffs, as in the reference
// photographs (dark conifer ridgelines, scattered shrubs on green slopes). Reuses the Hacienda
// ez-tree bakes; stand centres are authored Setting, not a species census.
async function conifersAndScrub() {
  const [firs, oaks] = await Promise.all([
    treeAssets("conifers.json", "douglas-fir-bark.jpg", "douglas-fir-leaf.png"),
    treeAssets("broadleaf.json", "oak-bark.jpg", "oak-leaf.png"),
  ]), random = seededRandom(443), sites = [], group = new THREE.Group();
  // Distant foliage: mip-mapped alpha thins leaves out until only trunks remain, so keep more of it.
  for (const v of [...firs, ...oaks]) for (const part of v.parts) if (part.leaf) part.material.alphaTest = 0.1;
  const place = (centres, make) => {
    for (const [cx, cz, count, spread] of centres) for (let i = 0; i < count; i++) {
      const x = cx + (random() - 0.5) * spread, z = cz + (random() - 0.5) * spread, y = jennerGround(x, z);
      if (y < 8 || jennerRiver(x, z).bankDistance < 40) continue;
      // Clearings and thinner edges, so stands read as patches and not rows.
      if (Math.sin(x * 0.021 + 1.3) * Math.sin(z * 0.017 + 0.4) + random() * 0.8 < -0.15) continue;
      sites.push({ x, y, z, turn: random() * 6.28, lean: 0.8 + random() * 0.45, ...make(y) });
    }
  };
  place([[640, -640, 110, 300], [930, -330, 90, 280], [260, -840, 60, 200], [1000, 1150, 120, 340],
    [1300, 1750, 100, 340], [560, 1500, 50, 200], [420, -220, 90, 260], [520, 150, 120, 300],
    [650, 520, 100, 300], [300, -520, 50, 160]], () => ({ fir: true, height: 9 + random() * random() * 26 + random() * 6 }));
  place([[-150, -520, 70, 160], [60, -720, 70, 200], [150, 950, 80, 220], [100, 1400, 90, 260],
    [-60, 1700, 60, 180], [230, -380, 90, 200], [260, 30, 90, 240], [300, 330, 80, 240]], () => ({ fir: false, shrub: true, height: 2.2 + random() * 3 }));
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  for (const [variants, isFir] of [[oaks, false], [firs, true]]) variants.forEach((v, vi) => {
    const selected = sites.filter((s, i) => s.fir === isFir && i % variants.length === vi);
    for (const part of v.parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, selected.length);
      selected.forEach((s, i) => {
        const scale = s.height / v.height;
        dummy.position.set(s.x, s.y - (s.shrub ? s.height * 0.3 : 0.3), s.z); dummy.rotation.set(0, s.turn, 0);
        dummy.scale.set(scale * (s.shrub ? 1.5 : 1.35) * s.lean, scale * (s.shrub ? 0.75 : 1), scale * (s.shrub ? 1.5 : 1.35) * (2 - s.lean));
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        if (isFir) tint.setHSL(0.27, 0.2 + random() * 0.15, 0.2 + random() * 0.1);
        else tint.setHSL(0.22 + random() * 0.04, 0.2 + random() * 0.15, 0.25 + random() * 0.1);
        mesh.setColorAt(i, part.leaf ? tint : new THREE.Color(0xb4aea0));
      });
      mesh.computeBoundingSphere(); group.add(mesh);
    }
  });
  group.name = "Douglas-fir stands and coastal scrub"; return group;
}

export async function createJennerSetting(noise, maps, clock) {
  const group = new THREE.Group(); group.name = "Jenner photo-informed setting";
  const grassMap = await new THREE.TextureLoader().loadAsync(new URL("../../../../../../data/biomes/diablo-oak/ground/grass_color.jpg", import.meta.url).href)
    .catch(error => { console.warn("Coastal ground texture unavailable", error); return null; });
  if (grassMap) {
    grassMap.colorSpace = THREE.SRGBColorSpace; grassMap.wrapS = grassMap.wrapT = THREE.RepeatWrapping; grassMap.anisotropy = 4;
  }
  group.add(terrain(noise, maps, clock, grassMap), rocks(maps), driftwood());
  const results = await Promise.allSettled([coastalGrass(clock), woodland(), conifersAndScrub()]);
  for (const result of results) {
    if (result.status === "fulfilled") group.add(result.value);
    else console.warn("Coastal vegetation unavailable", result.reason);
  }
  group.userData = { bindingClass: "setting", surveyed: false };
  return group;
}

export function createJennerSky(noise) {
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false }),
    direction = positionWorld.normalize(), height = direction.y.max(0),
    sky = mix(color(0xb1cbd3), color(0x4c8bb4), smoothstep(0, 0.32, height)),
    clouds = texture(noise, direction.xz.div(height.mul(0.7).add(0.18)).mul(0.18)).r,
    cloud = smoothstep(0.51, 0.75, clouds).mul(0.25).mul(smoothstep(0.02, 0.20, height));
  material.colorNode = mix(sky, color(0xe5e9e6), cloud);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(19000, 32, 16), material);
  mesh.name = "Pacific marine haze sky"; return mesh;
}
