import * as THREE from "../../vendor/three/three.webgpu.js";
import { color, mix, positionWorld, smoothstep, texture } from "../../vendor/three/three.tsl.js";
import { freeportChannel, freeportGround, freeportGrid, FREEPORT_VIEWS } from "./freeport-layout.js";
import { seededRandom } from "./bank-setting-layout.js";
import { createFreeportBridge } from "./freeport-bridge.js";
import { createFreeportSurroundings, freeportGroundTexture } from "./freeport-surroundings.js";

export async function createFreeportSetting(noise, maps) {
  const group = new THREE.Group(), grid = freeportGrid(), geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(grid.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1)); geometry.computeVertexNormals();
  const soil = new THREE.MeshStandardNodeMaterial({ roughness: 0.97 }), p = positionWorld, groundNoise = freeportGroundTexture(),
    grain = texture(groundNoise, p.xz.div(7)).g, patches = texture(groundNoise, p.xz.div(95)).r,
    edge = p.x.sub(p.z.div(900).sin().mul(48).sub(14)).abs().sub(p.z.div(440).sin().mul(9).add(96)),
    earth = mix(color(0x797968), color(0xa39e85), grain), grass = mix(color(0x536445), color(0x829060), patches),
    cover = smoothstep(3, 13, edge.add(patches.sub(0.5).mul(7))).mul(smoothstep(0.4, 1.7, p.y));
  soil.colorNode = mix(earth.mul(mix(0.48, 1, smoothstep(0.05, 1.2, p.y))), grass, cover)
    .mul(mix(0.93, 1.03, grain));
  const ground = new THREE.Mesh(geometry, soil); ground.receiveShadow = true; group.add(ground);
  addFields(group, groundNoise);
  group.add(createFreeportBridge(), createFreeportSurroundings(groundNoise)); addBanks(group, maps); await addTrees(group);
  group.name = "Freeport authored levee and bridge setting";
  group.userData = { bindingClass: "setting", surveyed: false };
  return group;
}

function addFields(group, noise) {
  const palettes = [[0x717d4f, 0x8b9464], [0x85836a, 0xaaa28a], [0x6c8051, 0x8b9a69]], p = positionWorld;
  for (const side of [-1, 1]) for (let i = 0; i < 10; i++) {
    const [a, b] = palettes[i % 3], surface = new THREE.MeshStandardNodeMaterial({ roughness: 1 }),
      x0 = side > 0 ? 280 : -960, z0 = -1900 + i * 380, positions = [], indices = [];
    surface.colorNode = mix(color(a), color(b), texture(noise, p.xz.div(110)).r)
      .mul(mix(0.94, 1, p.z.mul(0.55).sin().abs()));
    for (let z = 0; z <= 6; z++) for (let x = 0; x <= 6; x++) {
      const px = x0 + x * 105, pz = z0 + z * 54;
      positions.push(px, freeportGround(px, pz) + 0.018, pz);
    }
    for (let z = 0; z < 6; z++) for (let x = 0; x < 6; x++) { const n = z * 7 + x; indices.push(n, n + 7, n + 1, n + 1, n + 7, n + 8); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); const mesh = new THREE.Mesh(geometry, surface);
    mesh.receiveShadow = true; group.add(mesh);
  }
}

function addBanks(group, maps) {
  const random = seededRandom(142), dummy = new THREE.Object3D(), tint = new THREE.Color(),
    rockMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 0.98, color: 0x999888 });
  if (maps) rockMaterial.map = maps.rock.color;
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), rockMaterial, 1800);
  for (let i = 0; i < rocks.count; i++) {
    const z = i < 900 ? -480 + random() * 330 : (random() - 0.5) * 3500,
      { center, halfWidth } = freeportChannel(z), side = i < 900 ? 1 : random() < 0.5 ? -1 : 1,
      x = center + side * (halfWidth + random() * 8), size = 0.04 + random() ** 2 * 0.42;
    dummy.position.set(x, freeportGround(x, z) + size * 0.3, z); dummy.rotation.set(random(), random() * 6.28, random());
    dummy.scale.set(size * 1.5, size * 0.65, size); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.11, 0.05, 0.4 + random() * 0.18); rocks.setColorAt(i, tint);
  }
  rocks.castShadow = true; rocks.receiveShadow = true; group.add(rocks);
  // Close reeds break the waterline, with open patches around the bank camera.
  const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 1, 3),
    new THREE.MeshStandardNodeMaterial({ color: 0x79805a, roughness: 1 }), 2400);
  for (let i = 0; i < reeds.count; i++) {
    const z = (random() - 0.5) * 1700, { center, halfWidth } = freeportChannel(z), side = i % 2 ? -1 : 1,
      x = center + side * (halfWidth + 1.2 + random() * 4);
    dummy.position.set(x, freeportGround(x, z) + 0.22, z); dummy.scale.set(1, 0.25 + random() * 0.8, 1);
    dummy.rotation.set(0.1 * random(), random() * 6, 0.25 * (random() - 0.5)); dummy.updateMatrix(); reeds.setMatrixAt(i, dummy.matrix);
  }
  group.add(reeds);
  const blades = [], bladeIndices = [];
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.399, c = Math.cos(angle), s = Math.sin(angle), height = 0.35 + (i % 3) * 0.08,
      n = blades.length / 3, turn = (x, y, z) => blades.push(x * c + z * s, y, -x * s + z * c);
    turn(-0.014, 0, 0); turn(0.014, 0, 0); turn(0.065, height * 0.65, 0.015);
    turn(0.035, height * 0.65, 0.015); turn(0.12, height, 0.025);
    bladeIndices.push(n, n + 1, n + 2, n, n + 2, n + 3, n + 3, n + 2, n + 4);
  }
  const grassGeometry = new THREE.BufferGeometry(); grassGeometry.setAttribute("position", new THREE.Float32BufferAttribute(blades, 3));
  grassGeometry.setIndex(bladeIndices); grassGeometry.computeVertexNormals();
  const grasses = new THREE.InstancedMesh(grassGeometry,
    new THREE.MeshStandardNodeMaterial({ color: 0xc7c7a1, roughness: 1, side: THREE.DoubleSide }), 6000);
  for (let i = 0; i < grasses.count; i++) {
    const side = i < 3600 ? 1 : -1, z = i < 3600 ? -500 + random() * 400 : (random() - 0.5) * 1400,
      { center, halfWidth } = freeportChannel(z), x = center + side * (halfWidth + 5 + random() * 16), size = 0.35 + random() * 0.5;
    dummy.position.set(x, freeportGround(x, z), z); dummy.scale.set(size, size * (0.6 + random() * 0.7), size);
    dummy.rotation.set(0, random() * Math.PI * 2, 0); dummy.updateMatrix(); grasses.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.18 + random() * 0.06, 0.08 + random() * 0.17, 0.66 + random() * 0.18); grasses.setColorAt(i, tint);
  }
  grasses.receiveShadow = true; group.add(grasses);
}

async function addTrees(group) {
  // Reuse reservoir baked deciduous meshes and their alpha-tested leaf textures.
  // The placement is an authored riparian impression, not a species inventory.
  const biomeBase = new URL("../../data/biomes/diablo-oak/", import.meta.url),
    response = await fetch(new URL("biome.json", biomeBase));
  if (!response.ok) throw new Error("Freeport shared tree metadata unavailable");
  const biome = await response.json(), loader = new THREE.TextureLoader(),
    [leafMap, barkMap] = await Promise.all([loader.loadAsync(new URL(biome.trees.textures.leaf, biomeBase).href),
      loader.loadAsync(new URL(biome.trees.textures.bark, biomeBase).href)]);
  leafMap.colorSpace = barkMap.colorSpace = THREE.SRGBColorSpace;
  const leaf = new THREE.MeshStandardNodeMaterial({ map: leafMap, alphaTest: 0.48, side: THREE.DoubleSide,
    roughness: 0.95, color: 0xb3b79a }), bark = new THREE.MeshStandardNodeMaterial({ map: barkMap, roughness: 1, color: 0x8e8977 }),
    random = seededRandom(191), dummy = new THREE.Object3D(), tint = new THREE.Color(), placements = [];
  for (let i = 0; i < 480; i++) {
    const z = (random() - 0.5) * (i < 360 ? 1600 : 3700), { center, halfWidth } = freeportChannel(z), side = i % 2 ? -1 : 1,
      x = center + side * (halfWidth + 44 + random() * 65), h = 10 + random() * 11;
    if (Math.abs(z + 95) < 30 || Math.hypot(x - FREEPORT_VIEWS.bank.x, z - FREEPORT_VIEWS.bank.z) < 18) continue;
    placements.push({ x, z, h, yaw: random() * 6.28, bare: i % 5 === 0 });
  }
  // A few nearby canopies frame the river without blocking either bank camera.
  // Lower riparian groups break the bare far-bank strip visible through the steel.
  for (let i = 0; i < 190; i++) {
    const z = (random() - 0.5) * 1100, side = i % 2 ? -1 : 1, { center, halfWidth } = freeportChannel(z);
    const x = center + side * (halfWidth + 6 + random() * 13);
    if (Math.abs(z + 95) < 24 || Math.hypot(x - FREEPORT_VIEWS.bank.x, z - FREEPORT_VIEWS.bank.z) < 18
      || (side > 0 && z < -160 && z > -385)) continue;
    placements.push({ x, z, h: 5 + random() * 8, yaw: random() * 6.28, bare: i % 4 === 0 });
  }
  placements.push({ x: 146, z: 445, h: 22, yaw: 1 }, { x: 162, z: -45, h: 18, yaw: 2 },
    { x: -145, z: -10, h: 17, yaw: 1.6 }, { x: -166, z: -45, h: 20, yaw: 0.9 },
    { x: 92, z: -365, h: 12, yaw: 2.2 }, { x: 88, z: -450, h: 14, yaw: 0.4, bare: true });
  for (let i = 0; i < 110; i++) {
    const z = -510 + random() * 370, { center, halfWidth } = freeportChannel(z), x = center + halfWidth + 14 + random() * 7;
    if (Math.hypot(x - FREEPORT_VIEWS.bank.x, z - FREEPORT_VIEWS.bank.z) < 6 || Math.abs(z + 175) < 10) continue;
    placements.push({ x, z, h: 1.4 + random() * 1.7, yaw: random() * 6.28 });
  }
  for (const [variantIndex, id] of ["coast-live-a", "coast-live-b-far"].entries()) {
    const definition = biome.trees.baked.find(v => v.id === id), file = await fetch(new URL(definition.file, biomeBase));
    if (!file.ok) throw new Error(`Shared tree mesh unavailable: ${id}`);
    const bytes = await file.arrayBuffer(), part = metadata => {
      const n = metadata.vertexCount, values = new Float32Array(bytes, metadata.offset, n * 8), geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(values.subarray(0, n * 3), 3));
      geometry.setAttribute("normal", new THREE.BufferAttribute(values.subarray(n * 3, n * 6), 3));
      geometry.setAttribute("uv", new THREE.BufferAttribute(values.subarray(n * 6, n * 8), 2));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(bytes, metadata.offset + n * 32, metadata.indexCount), 1)); return geometry;
    }, sites = placements.filter((_, i) => i % 2 === variantIndex), leafy = sites.filter(site => !site.bare),
      branches = new THREE.InstancedMesh(part(definition.parts.branches), bark, sites.length),
      leaves = new THREE.InstancedMesh(part(definition.parts.leaves), leaf, leafy.length);
    let leafIndex = 0;
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i], scale = site.h / definition.height;
      dummy.position.set(site.x, freeportGround(site.x, site.z), site.z); dummy.scale.setScalar(scale);
      dummy.rotation.set(0, site.yaw, 0); dummy.updateMatrix(); branches.setMatrixAt(i, dummy.matrix);
      if (!site.bare) {
        leaves.setMatrixAt(leafIndex, dummy.matrix); tint.setHSL(0.20 + random() * 0.08, 0.08 + random() * 0.13, 0.78 + random() * 0.17);
        leaves.setColorAt(leafIndex++, tint);
      }
    }
    branches.castShadow = leaves.castShadow = true; leaves.receiveShadow = true; group.add(branches, leaves);
  }
}
