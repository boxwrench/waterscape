import * as THREE from "../../vendor/three/three.webgpu.js";
import { attribute, mix, normalMap, positionWorld, texture, vec2 } from "../../vendor/three/three.tsl.js";
import { SETTING_BASE } from "./bank-materials.js";
import { localReach, bankTreeSites, seededRandom } from "./bank-setting-layout.js";

// Match the original terrain triangles; bilinear resampling could sink this overlay
// below the rendered land at a saddle. This does not alter the source elevation grid.
function meshHeight(terrain, x, z) {
  const u = (x - terrain.x0) / terrain.cellX, v = (z - terrain.z0) / terrain.cellZ,
    i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j,
    px = terrain.x0 + i * terrain.cellX, pz = terrain.z0 + j * terrain.cellZ,
    h00 = terrain.ground(px, pz), h10 = terrain.ground(px + terrain.cellX, pz),
    h01 = terrain.ground(px, pz + terrain.cellZ), h11 = terrain.ground(px + terrain.cellX, pz + terrain.cellZ);
  return a + b <= 1 ? h00 + (h10 - h00) * a + (h01 - h00) * b :
    h11 + (h01 - h11) * (1 - a) + (h10 - h11) * (1 - b);
}

function pebbleBank(reach, terrain, maps) {
  const positions = [], wetness = [], indices = [], count = 141, step = 2,
    lookup = new Int32Array(count * count);
  lookup.fill(-1);
  for (let j = 0; j < count; j++) for (let i = 0; i < count; i++) {
    const x = reach.focus.x + (i - 70) * step, z = reach.focus.z + (j - 70) * step,
      sample = reach.sample(x, z), y = meshHeight(terrain, x, z), above = y - sample.y;
    if (sample.distance > 72 || above < -0.2 || above > 3.5) continue;
    lookup[j * count + i] = positions.length / 3;
    positions.push(x, y + 0.055, z);
    wetness.push(Math.max(0, Math.min(1, 1 - above / 0.8)));
  }
  for (let j = 0; j < count - 1; j++) for (let i = 0; i < count - 1; i++) {
    const a = lookup[j * count + i], b = lookup[j * count + i + 1],
      c = lookup[(j + 1) * count + i], d = lookup[(j + 1) * count + i + 1];
    if (a >= 0 && b >= 0 && c >= 0) indices.push(a, c, b);
    if (b >= 0 && c >= 0 && d >= 0) indices.push(b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("wetness", new THREE.Float32BufferAttribute(wetness, 1));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const uv = positionWorld.xz.div(maps.tileMetres), wet = attribute("wetness", "float"),
    material = new THREE.MeshStandardNodeMaterial();
  material.colorNode = texture(maps.color, uv).rgb.mul(mix(1, 0.58, wet));
  material.normalNode = normalMap(texture(maps.normal, uv), vec2(0.7));
  material.roughnessNode = texture(maps.roughness, uv).r.mul(mix(1, 0.55, wet));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Hacienda pebble bank";
  return mesh;
}

function stones(reach, terrain, maps) {
  const group = new THREE.Group(), random = seededRandom(53),
    geometry = new THREE.IcosahedronGeometry(1, 2), position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i),
      relief = 0.87 + 0.12 * Math.sin(x * 7 + z * 5) * Math.cos(y * 9);
    position.setXYZ(i, x * relief, y * relief, z * relief);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardNodeMaterial({ map: maps.rock.color,
    normalMap: maps.rock.normal, roughnessMap: maps.rock.roughness, normalScale: new THREE.Vector2(0.7, 0.7) });
  for (let i = 0; i < 12; i++) {
    const along = (i - 2) * 9 + random() * 5, cross = 1.5 + random() * 3,
      bank = reach.shoreAt(along);
    if (!bank) continue;
    const x = bank.x + reach.normal.x * cross,
      z = bank.z + reach.normal.z * cross, y = terrain.ground(x, z);
    if (y < reach.sample(x, z).y) continue;
    const rock = new THREE.Mesh(geometry, material);
    rock.position.set(x, y + 0.4, z);
    rock.scale.set(1.4 + random() * 2.2, 1 + random() * 1.6, 1.4 + random() * 2);
    rock.rotation.set(random() * 0.3, random() * 6.28, random() * 0.4);
    group.add(rock);
  }
  const small = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardNodeMaterial({ color: 0x9a9585, roughness: 0.86 }), 180),
    dummy = new THREE.Object3D(), tint = new THREE.Color();
  let count = 0;
  for (let i = 0; i < 180; i++) {
    const along = (random() - 0.5) * 24, cross = random() * 8,
      x = reach.shoreline.x + reach.tangent.x * along + reach.normal.x * cross,
      z = reach.shoreline.z + reach.tangent.z * along + reach.normal.z * cross,
      y = meshHeight(terrain, x, z), sample = reach.sample(x, z);
    if (y < sample.y || y > sample.y + 2) continue;
    const size = 0.045 + random() * 0.09;
    dummy.position.set(x, y + size * 0.28, z);
    dummy.rotation.set(random(), random() * 6.28, random());
    dummy.scale.set(size * 1.4, size * 0.7, size); dummy.updateMatrix();
    small.setMatrixAt(count, dummy.matrix);
    tint.setHSL(0.1 + random() * 0.04, 0.06 + random() * 0.08, 0.25 + random() * 0.3);
    small.setColorAt(count++, tint);
  }
  small.count = count; small.computeBoundingSphere(); small.name = "Foreground pebbles";
  group.add(small); group.name = "Bank rocks and pebbles";
  return group;
}

async function conifers(reach, terrain) {
  const response = await fetch(new URL("conifers.json", SETTING_BASE));
  if (!response.ok) throw new Error(`Conifer manifest: ${response.status}`);
  const manifest = await response.json(), loader = new THREE.TextureLoader(),
    [bark, leaf] = await Promise.all(["douglas-fir-bark.jpg", "douglas-fir-leaf.png"].map((file) => loader.loadAsync(new URL(file, SETTING_BASE).href)));
  for (const t of [bark, leaf]) t.colorSpace = THREE.SRGBColorSpace;
  const barkMat = new THREE.MeshStandardNodeMaterial({ map: bark, roughness: 0.95 }),
    leafMat = new THREE.MeshStandardNodeMaterial({ map: leaf, alphaTest: 0.5, side: THREE.DoubleSide,
      color: 0x719369, roughness: 0.9 }),
    sites = bankTreeSites(reach, terrain), group = new THREE.Group(), dummy = new THREE.Object3D();
  for (let v = 0; v < manifest.variants.length; v++) {
    const variant = manifest.variants[v], asset = await fetch(new URL(variant.file, SETTING_BASE));
    if (!asset.ok) throw new Error(`Conifer geometry: ${asset.status}`);
    const raw = await asset.arrayBuffer(), selected = sites.filter((_, i) => i % manifest.variants.length === v);
    for (const [partName, material] of [["branches", barkMat], ["leaves", leafMat]]) {
      const p = variant.parts[partName], n = p.vertexCount, f = new Float32Array(raw, p.offset, n * 8),
        geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(f.subarray(0, n * 3), 3));
      geometry.setAttribute("normal", new THREE.BufferAttribute(f.subarray(n * 3, n * 6), 3));
      geometry.setAttribute("uv", new THREE.BufferAttribute(f.subarray(n * 6, n * 8), 2));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(raw, p.offset + n * 32, p.indexCount), 1));
      const mesh = new THREE.InstancedMesh(geometry, material, selected.length);
      selected.forEach((site, i) => {
        dummy.position.set(site.x, site.y - 0.2, site.z); dummy.rotation.set(0, site.turn, 0);
        dummy.scale.setScalar(site.scale); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.computeBoundingSphere(); group.add(mesh);
    }
  }
  group.name = "Hacienda conifer stands"; group.userData.treeCount = sites.length;
  return group;
}

export async function createBankSetting(document, terrain, maps) {
  const reach = localReach(document, terrain);
  if (!reach) return null;
  const group = new THREE.Group(); group.name = "Hacienda bank setting"; group.visible = false;
  group.add(pebbleBank(reach, terrain, maps.pebbles), stones(reach, terrain, maps));
  try { group.add(await conifers(reach, terrain)); }
  catch (error) { console.warn("Keeping bank setting without conifers", error); }
  group.userData = { bindingClass: "setting", representation: "Authored rocks, gravel and stands; not surveyed objects" };
  return { group, camera: reach.camera, shoreline: reach.shoreline };
}
