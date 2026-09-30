import * as THREE from "../../vendor/three/three.webgpu.js";
import { color, mix, normalMap, normalWorld, positionWorld, texture, vec2 } from "../../vendor/three/three.tsl.js";
import { BEACH_CAMERA, BRIDGE_CAMERA, bankEdges, beachGround, beachWaterGrid } from "./beach-layout.js";
import { createHaciendaBridge } from "./hacienda-bridge.js";
import { createBeachWoodland } from "./beach-woodland.js";
import { seededRandom } from "./bank-setting-layout.js";
import { grayStone } from "./beach-materials.js";

function ground(maps) {
  const positions = [], indices = [], w = 201, h = 321;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = -150 + i * 1.5, z = 105 - j * 1.5;
    positions.push(x, beachGround(x, z), z);
  }
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const a = j * w + i; indices.push(a, a + 1, a + w, a + 1, a + w + 1, a + w);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.92, color: 0x999383 });
  if (maps) {
    const uv = positionWorld.xz.div(maps.pebbles.tileMetres),
      wet = positionWorld.y.div(0.35).clamp(0, 1),
      forest = positionWorld.y.sub(3).div(6).clamp(0, 1);
    const n = normalWorld.abs(), weight = n.div(n.x.add(n.y).add(n.z)),
      scale = maps.rock.tileMetres,
      rock = grayStone(maps.rock.color, positionWorld.zy.div(scale), 0.6).mul(weight.x)
        .add(grayStone(maps.rock.color, positionWorld.xz.div(scale), 0.6).mul(weight.y))
        .add(grayStone(maps.rock.color, positionWorld.xy.div(scale), 0.6).mul(weight.z)),
      gravel = grayStone(maps.pebbles.color, uv).mul(mix(0.52, 0.91, wet)),
      bank = positionWorld.y.sub(0.7).div(1.6).clamp(0, 1);
    material.colorNode = mix(gravel, rock.mul(0.59), bank)
      .mul(mix(color(0xffffff), color(0x495137), forest));
    material.normalNode = normalMap(texture(maps.pebbles.normal, uv), vec2(0.75));
    material.roughnessNode = texture(maps.pebbles.roughness, uv).r.mul(mix(0.55, 1, wet));
  }
  const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true;
  mesh.name = "Hacienda pebble beach"; return mesh;
}

function bankRocks(maps) {
  const group = new THREE.Group(), random = seededRandom(233),
    geometry = new THREE.IcosahedronGeometry(1, 3), p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i),
      relief = 0.9 + 0.13 * Math.sin(x * 9 + y * 5) * Math.sin(z * 8 - y * 3);
    p.setXYZ(i, x * relief, y * relief, z * relief);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardNodeMaterial({ color: 0x9d9787, roughness: 0.95,
    ...(maps ? { map: maps.rock.color, normalMap: maps.rock.normal,
      roughnessMap: maps.rock.roughness, normalScale: new THREE.Vector2(1.2, 1.2) } : {}) });
  // The left pier stands on one continuous exposed crag. Its river-facing toe
  // reaches into the channel; fracture relief is an authored estimate from photos.
  const points = [], faces = [], rows = 27, cols = 21;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = -64 + i * 1.9, z = -112 + j * 1.85,
      footprint = Math.max(0, 1 - Math.pow((x + 44) / 22, 4) - Math.pow((z + 87) / 26, 4)),
      ridge = 2.3 + 5.8 * footprint,
      fracture = Math.abs(Math.sin(x * 0.58 + z * 0.16)) * 0.8 + Math.sin(z * 0.72) * 0.35,
      y = Math.max(beachGround(x, z) + 0.04, (ridge + fracture) * Math.min(1, footprint * 5) - 0.3);
    points.push(x, y, z);
  }
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
    const a = j * cols + i; faces.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
  }
  const perimeter = [];
  for (let i = 0; i < cols; i++) perimeter.push(i);
  for (let j = 1; j < rows; j++) perimeter.push(j * cols + cols - 1);
  for (let i = cols - 2; i >= 0; i--) perimeter.push((rows - 1) * cols + i);
  for (let j = rows - 2; j > 0; j--) perimeter.push(j * cols);
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length], start = points.length / 3;
    points.push(points[a * 3], -1, points[a * 3 + 2], points[b * 3], -1, points[b * 3 + 2]);
    faces.push(a, start, b, b, start, start + 1);
  }
  const cragGeometry = new THREE.BufferGeometry();
  cragGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  cragGeometry.setIndex(faces); cragGeometry.computeVertexNormals();
  const cragMaterial = new THREE.MeshStandardNodeMaterial({ color: 0x777b7d, roughness: 0.98 });
  if (maps) {
    const n = normalWorld.abs(), w = n.div(n.x.add(n.y).add(n.z)), scale = maps.rock.tileMetres;
    cragMaterial.colorNode = grayStone(maps.rock.color, positionWorld.zy.div(scale), 0.65).mul(w.x)
      .add(grayStone(maps.rock.color, positionWorld.xz.div(scale), 0.65).mul(w.y))
      .add(grayStone(maps.rock.color, positionWorld.xy.div(scale), 0.65).mul(w.z)).mul(0.8);
  }
  const crag = new THREE.Mesh(cragGeometry, cragMaterial);
  crag.name = "Left pier bedrock outcrop"; crag.castShadow = true; crag.receiveShadow = true; group.add(crag);
  for (let i = 0; i < 10; i++) {
    const x = -28 - random() * 7, z = -66 - random() * 13, rock = new THREE.Mesh(geometry, material);
    rock.position.set(x, beachGround(x, z) + 0.4, z);
    rock.scale.set(1.4 + random() * 2, 1 + random() * 1.5, 1.4 + random() * 2);
    rock.rotation.set(random() * 0.4, random() * 6.28, random() * 0.6);
    rock.castShadow = true; rock.receiveShadow = true; group.add(rock);
  }
  const pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardNodeMaterial({ roughness: 0.82 }), 1200), dummy = new THREE.Object3D(), tint = new THREE.Color();
  let count = 0;
  for (let i = 0; i < 1200; i++) {
    const z = 5 + random() * 73, edge = bankEdges(z), x = edge.left - random() * 13,
      y = beachGround(x, z), size = 0.025 + random() * 0.08;
    dummy.position.set(x, y + size * 0.15, z); dummy.rotation.set(random(), random() * 6.28, random());
    dummy.scale.set(size * 1.5, size * 0.55, size); dummy.updateMatrix(); pebbles.setMatrixAt(count, dummy.matrix);
    tint.setHSL(0.55 + random() * 0.06, random() * 0.04, 0.10 + random() * 0.28);
    pebbles.setColorAt(count++, tint);
  }
  pebbles.computeBoundingSphere(); group.add(pebbles);
  group.name = "Bank rocks and pebbles"; return group;
}

function riversideHouse() {
  const group = new THREE.Group(), wood = new THREE.MeshStandardNodeMaterial({ color: 0x624337, roughness: 0.96 }),
    roofMat = new THREE.MeshStandardNodeMaterial({ color: 0x2e3029, roughness: 0.9 });
  const house = new THREE.Mesh(new THREE.BoxGeometry(8, 7, 9), wood);
  house.position.y = 3.5; group.add(house);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 3.5, 4), roofMat);
  roof.rotation.y = Math.PI / 4; roof.scale.z = 1.12; roof.position.y = 8; group.add(roof);
  for (const x of [-2.2, 2.2]) for (const y of [2.5, 5]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 0.07),
      new THREE.MeshStandardNodeMaterial({ color: 0x829b9c, roughness: 0.25 }));
    window.position.set(x, y, 4.54); group.add(window);
  }
  for (let y = 0.3; y < 7; y += 0.32) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.035, 0.04), roofMat);
    board.position.set(0, y, 4.53); group.add(board);
  }
  group.position.set(-67, beachGround(-67, -87), -87); group.rotation.y = 0.08;
  group.name = "Photo-informed riverside house"; return group;
}

function sky() {
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false }),
    up = positionWorld.y.div(1000).clamp(0, 1);
  material.colorNode = mix(color(0x97cfee), color(0x2877d9), up.pow(0.45));
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), material);
  mesh.name = "Hacienda daylight sky"; return mesh;
}

export async function createHaciendaBeach(maps) {
  const group = new THREE.Group(); group.name = "Hacienda authored beach"; group.visible = false;
  group.add(ground(maps), bankRocks(maps), createHaciendaBridge(), riversideHouse(), sky());
  try { group.add(await createBeachWoodland()); }
  catch (error) { console.warn("Woodland assets unavailable", error); }
  group.userData = { bindingClass: "setting",
    representation: "Photo-informed Hacienda composition, not surveyed bank or infrastructure geometry" };
  const camera = { ...BEACH_CAMERA };
  camera.x = bankEdges(camera.z).left - 0.7;
  camera.y = beachGround(camera.x, camera.z) + 1.8;
  const bridgeCamera = { ...BRIDGE_CAMERA };
  bridgeCamera.x = bankEdges(bridgeCamera.z).left - 0.8;
  bridgeCamera.y = beachGround(bridgeCamera.x, bridgeCamera.z) + 1.8;
  return { group, camera, bridgeCamera, waterGrid: beachWaterGrid() };
}
