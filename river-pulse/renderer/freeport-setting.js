import * as THREE from "../../vendor/three/three.webgpu.js";
import { color, mix, positionWorld, smoothstep, texture, vec3 } from "../../vendor/three/three.tsl.js";
import { freeportChannel, freeportGround, freeportGrid } from "./freeport-layout.js";
import { seededRandom } from "./bank-setting-layout.js";
import { grayStone } from "./beach-materials.js";

export async function createFreeportSetting(noise, maps) {
  const group = new THREE.Group(), grid = freeportGrid(), geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(grid.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1)); geometry.computeVertexNormals();
  const soil = new THREE.MeshStandardNodeMaterial({ roughness: 0.93 }), p = positionWorld,
    grain = texture(noise, p.xz.div(4)).r, patches = texture(noise, p.xz.div(160)).g,
    stone = maps ? grayStone(maps.rock.color, p.xz.div(4)).mul(vec3(0.95, 0.94, 0.84)) : mix(color(0x706e60), color(0xaaa58c), grain),
    grass = mix(color(0x64704c), color(0x8c8c59), patches), wet = smoothstep(0, 1.2, p.y);
  soil.colorNode = mix(stone.mul(mix(0.45, 1, wet)), grass, smoothstep(4.5, 6, p.y).mul(0.7));
  const ground = new THREE.Mesh(geometry, soil); ground.receiveShadow = true; group.add(ground);
  // Long quiet agricultural parcels outside the levees, authored context only.
  for (let side of [-1, 1]) for (let i = 0; i < 8; i++) {
    const field = new THREE.Mesh(new THREE.PlaneGeometry(760, 430), new THREE.MeshStandardNodeMaterial({
      color: i % 3 ? 0x7c8351 : 0x8c855f, roughness: 1 }));
    field.rotation.x = -Math.PI / 2; field.position.set(side * 690, 2.6, -1900 + i * 540); group.add(field);
  }
  addBridge(group); addBanks(group, maps); await addTrees(group);
  group.name = "Freeport authored levee and bridge setting";
  group.userData = { bindingClass: "setting", surveyed: false };
  return group;
}

function addBridge(group) {
  const steel = new THREE.MeshStandardNodeMaterial({ color: 0x698778, metalness: 0.32, roughness: 0.6 }),
    concrete = new THREE.MeshStandardNodeMaterial({ color: 0xb2b5a8, roughness: 0.95 }),
    road = new THREE.MeshStandardNodeMaterial({ color: 0x595c55, roughness: 0.94 }),
    bridge = new THREE.Group(), unit = new THREE.BoxGeometry(1, 1, 1);
  bridge.position.set(-18, 0, -95); bridge.rotation.y = -0.04; bridge.name = "Freeport green steel crossing · approximate";
  function box(x, y, z, sx, sy, sz, material) {
    const mesh = new THREE.Mesh(unit, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true; mesh.receiveShadow = true; bridge.add(mesh); return mesh;
  }
  function beam(a, b, thickness = 0.3) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start), mesh = new THREE.Mesh(unit, steel);
    mesh.position.copy(start.add(end).multiplyScalar(0.5)); mesh.scale.set(thickness, delta.length(), thickness);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); mesh.castShadow = true; bridge.add(mesh);
  }
  box(0, 7.8, 0, 330, 0.65, 8.5, road);
  // Two counterweight towers and the low central closed leaves: distinctive bascule silhouette.
  for (const x of [-67, 67]) {
    box(x, 3, 0, 5.5, 9, 13, concrete);
    for (const z of [-4.7, 4.7]) {
      box(x, 15, z, 1.1, 15, 0.7, steel);
      box(x + Math.sign(x) * 9, 18.7, z, 15, 5.6, 1.1, steel);
      beam([x - 10, 8, z], [x, 22, z], 0.55);
    }
    beam([x, 22, -4.7], [x, 22, 4.7], 0.55);
    box(x + Math.sign(x) * 11, 18, 0, 8, 5, 8, concrete);
    for (let z = -8; z <= 8; z += 4) box(x - 5, 0, z, 0.6, 6.8, 0.6, road);
  }
  for (let z of [-4.5, 4.5]) {
    for (let i = 0; i < 20; i++) {
      const x = -160 + i * 16, top = Math.abs(x + 8) < 110 ? 17 : 10.7;
      beam([x, 8.5, z], [x, top, z], 0.25);
      beam([x, top, z], [x + 16, top, z], 0.3);
      beam([x, 8.5, z], [x + 16, top, z], 0.24);
      beam([x, 8.5, z], [x + 16, 8.5, z], 0.3);
      if (top > 12) beam([x, top, -4.5], [x + 16, top, 4.5], 0.18);
    }
  }
  for (const x of [-157, 157]) box(x, 3.5, 0, 8, 8, 12, concrete);
  group.add(bridge);
}

function addBanks(group, maps) {
  const random = seededRandom(142), dummy = new THREE.Object3D(), tint = new THREE.Color(),
    rockMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 0.98, color: 0x999888 });
  if (maps) rockMaterial.map = maps.rock.color;
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), rockMaterial, 2200);
  for (let i = 0; i < rocks.count; i++) {
    const z = i < 1200 ? 130 + random() * 170 : (random() - 0.5) * 4400,
      { center, halfWidth } = freeportChannel(z), side = i < 1200 ? 1 : random() < 0.5 ? -1 : 1,
      x = center + side * (halfWidth + random() * 20), size = 0.12 + random() ** 2 * 0.9;
    dummy.position.set(x, freeportGround(x, z) + size * 0.3, z); dummy.rotation.set(random(), random() * 6.28, random());
    dummy.scale.set(size * 1.5, size * 0.65, size); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.11, 0.05, 0.4 + random() * 0.18); rocks.setColorAt(i, tint);
  }
  rocks.castShadow = true; rocks.receiveShadow = true; group.add(rocks);
  // Close reeds break the waterline, with open patches around the bank camera.
  const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 1, 3),
    new THREE.MeshStandardNodeMaterial({ color: 0x686d40, roughness: 1 }), 950);
  for (let i = 0; i < reeds.count; i++) {
    const z = 90 + random() * 370, { center, halfWidth } = freeportChannel(z), x = center + halfWidth + 1.5 + random() * 3;
    dummy.position.set(x, freeportGround(x, z) + 0.4, z); dummy.scale.set(1, 0.6 + random() * 1.1, 1);
    dummy.rotation.set(0.1 * random(), random() * 6, 0.25 * (random() - 0.5)); dummy.updateMatrix(); reeds.setMatrixAt(i, dummy.matrix);
  }
  group.add(reeds);
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
    roughness: 0.95, color: 0x87966d }), bark = new THREE.MeshStandardNodeMaterial({ map: barkMap, roughness: 1 }),
    random = seededRandom(191), dummy = new THREE.Object3D(), tint = new THREE.Color(), placements = [];
  for (let i = 0; i < 400; i++) {
    const z = (random() - 0.5) * (i < 320 ? 1600 : 4100), { center, halfWidth } = freeportChannel(z), side = i % 2 ? -1 : 1,
      x = center + side * (halfWidth + 30 + random() * 65), h = 16 + random() * 12;
    if (Math.abs(z + 95) < 36 || (side > 0 && z > 5 && z < 430)) continue;
    placements.push({ x, z, h, yaw: random() * 6.28 });
  }
  // A few nearby canopies frame the river without blocking either bank camera.
  placements.push({ x: 146, z: 445, h: 22, yaw: 1 }, { x: 162, z: -45, h: 18, yaw: 2 },
    { x: -145, z: -10, h: 23, yaw: 1.6 }, { x: -166, z: -45, h: 28, yaw: 0.9 });
  for (const [variantIndex, id] of ["coast-live-a", "coast-live-b-far"].entries()) {
    const definition = biome.trees.baked.find(v => v.id === id), file = await fetch(new URL(definition.file, biomeBase));
    if (!file.ok) throw new Error(`Shared tree mesh unavailable: ${id}`);
    const bytes = await file.arrayBuffer(), part = metadata => {
      const n = metadata.vertexCount, values = new Float32Array(bytes, metadata.offset, n * 8), geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(values.subarray(0, n * 3), 3));
      geometry.setAttribute("normal", new THREE.BufferAttribute(values.subarray(n * 3, n * 6), 3));
      geometry.setAttribute("uv", new THREE.BufferAttribute(values.subarray(n * 6, n * 8), 2));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(bytes, metadata.offset + n * 32, metadata.indexCount), 1)); return geometry;
    }, sites = placements.filter((_, i) => i % 2 === variantIndex),
      branches = new THREE.InstancedMesh(part(definition.parts.branches), bark, sites.length),
      leaves = new THREE.InstancedMesh(part(definition.parts.leaves), leaf, sites.length);
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i], scale = site.h / definition.height;
      dummy.position.set(site.x, freeportGround(site.x, site.z), site.z); dummy.scale.setScalar(scale);
      dummy.rotation.set(0, site.yaw, 0); dummy.updateMatrix(); branches.setMatrixAt(i, dummy.matrix); leaves.setMatrixAt(i, dummy.matrix);
      tint.setHSL(0.20 + random() * 0.08, 0.12 + random() * 0.12, 0.75 + random() * 0.15); leaves.setColorAt(i, tint);
    }
    branches.castShadow = leaves.castShadow = true; leaves.receiveShadow = true; group.add(branches, leaves);
  }
}
