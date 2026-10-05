import * as THREE from "../../../../../../vendor/three/three.webgpu.js";
import { SETTING_BASE } from "../../../../../scene-kit/bank-materials.js";
import { seededRandom } from "../../../../../scene-kit/bank-setting-layout.js";
import { bankEdges, beachGround } from "./beach-layout.js";

export async function treeAssets(manifestFile, barkFile, leafFile) {
  const r = await fetch(new URL(manifestFile, SETTING_BASE));
  if (!r.ok) throw new Error(`Woodland manifest: ${r.status}`);
  const manifest = await r.json(), loader = new THREE.TextureLoader(),
    [bark, leaf] = await Promise.all([barkFile, leafFile].map((f) => loader.loadAsync(new URL(f, SETTING_BASE).href)));
  for (const t of [bark, leaf]) t.colorSpace = THREE.SRGBColorSpace;
  const barkMat = new THREE.MeshStandardNodeMaterial({ map: bark, roughness: 0.95 }),
    leafMat = new THREE.MeshStandardNodeMaterial({ map: leaf, alphaTest: 0.45,
      side: THREE.DoubleSide, roughness: 0.95 });
  return Promise.all(manifest.variants.map(async (v) => {
    const asset = await fetch(new URL(v.file, SETTING_BASE));
    if (!asset.ok) throw new Error(`Woodland geometry: ${asset.status}`);
    const raw = await asset.arrayBuffer(), parts = [];
    for (const [part, material] of [["branches", barkMat], ["leaves", leafMat]]) {
      const p = v.parts[part], n = p.vertexCount, f = new Float32Array(raw, p.offset, n * 8), g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(f.subarray(0, n * 3), 3));
      g.setAttribute("normal", new THREE.BufferAttribute(f.subarray(n * 3, n * 6), 3));
      g.setAttribute("uv", new THREE.BufferAttribute(f.subarray(n * 6, n * 8), 2));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(raw, p.offset + n * 32, p.indexCount), 1));
      parts.push({ geometry: g, material, leaf: part === "leaves" });
    }
    return { ...v, parts };
  }));
}

export async function createBeachWoodland() {
  const [oaks, firs] = await Promise.all([
    treeAssets("broadleaf.json", "oak-bark.jpg", "oak-leaf.png"),
    treeAssets("conifers.json", "douglas-fir-bark.jpg", "douglas-fir-leaf.png"),
  ]), random = seededRandom(137), sites = [], group = new THREE.Group();
  // Overlapping broadleaf crowns, fir groups behind, and low bank-edge shrubs.
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
    for (let z = -310; z < 90; z += 10 + random() * 7) {
      const edge = bankEdges(z), cross = 8 + row * 15 + random() * 8,
        x = (side < 0 ? edge.left : edge.right) + side * cross;
      if (side < 0 && z > -36 && row < 2) continue;
      if (x < -57 && x > -79 && z < -73 && z > -107) continue;
      if (side < 0 && row === 0 && z < -60 && z > -113) continue;
      if (Math.abs(z + 85) < 7) continue; // Road opening, leaves around its edges.
      sites.push({ x, z, y: beachGround(x, z), fir: row > 0 && random() < 0.57,
        height: row === 0 ? 8 + random() * 11 : 16 + random() * 23, turn: random() * 6.28 });
    }
  }
  for (const side of [-1, 1]) for (const row of [0, 1]) for (let z = -300; z < 60; z += 4 + random() * 3) {
    if (side < 0 && z > -38) continue;
    if (side < 0 && z < -60 && z > -113) continue;
    const e = bankEdges(z), cross = 1.5 + row * 4 + random() * 2,
      x = side < 0 ? e.left - cross : e.right + cross;
    sites.push({ x, z, y: beachGround(x, z), fir: false, shrub: true,
      height: 3.5 + random() * 4, turn: random() * 6.28 });
  }
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  for (const [variants, isFir] of [[oaks, false], [firs, true]]) {
    variants.forEach((v, vi) => {
      const selected = sites.filter((s, i) => s.fir === isFir && i % variants.length === vi);
      for (const part of v.parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, selected.length);
        selected.forEach((s, i) => {
          const scale = s.height / v.height;
          dummy.position.set(s.x, s.y - (s.shrub ? s.height * 0.28 : 0.2), s.z); dummy.rotation.set(0, s.turn, 0);
          dummy.scale.set(scale * (s.shrub ? 1.25 : isFir ? 1 : 0.85), scale * (s.shrub ? 0.8 : 1), scale); dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          tint.setHSL(isFir ? 0.26 : 0.24 + random() * 0.05, 0.17 + random() * 0.22,
            0.34 + random() * 0.18);
          if (part.leaf) tint.multiplyScalar(s.x > bankEdges(s.z).right ? 0.68 : 1.05);
          mesh.setColorAt(i, part.leaf ? tint : new THREE.Color(0xb4aea0));
        });
        mesh.computeBoundingSphere(); mesh.receiveShadow = true;
        // This woodland has hundreds of crowns; lighting varies per instance and
        // receives architectural shadows. Avoid duplicating the full canopy in a shadow pass.
        group.add(mesh);
      }
    });
  }
  group.name = "Hacienda mixed woodland"; group.userData.treeCount = sites.length;
  return group;
}
