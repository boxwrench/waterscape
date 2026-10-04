import * as THREE from "../../vendor/three/three.webgpu.js";
import { color, mix, positionWorld, texture } from "../../vendor/three/three.tsl.js";
import { freeportChannel, freeportGround } from "./freeport-layout.js";
import { freeportLeveeRoad, freeportMarinaLayout } from "./freeport-riverfront-layout.js";
import { FREEPORT_BRIDGE as B, bridgeToWorld } from "./freeport-bridge-layout.js";
import { seededRandom } from "./bank-setting-layout.js";

// Original procedural soil texture; independent of the water's repeating noise.
export function freeportGroundTexture() {
  const size = 512, bytes = new Uint8Array(size * size * 4),
    hash = (x, y) => { const n = Math.sin(x * 173.1 + y * 317.7) * 43758.5453; return n - Math.floor(n); },
    sample = (x, y, frequency) => {
      const u = x * frequency / size, v = y * frequency / size, a = Math.floor(u), b = Math.floor(v),
        s = u - a, t = v - b, sx = s * s * (3 - 2 * s), sy = t * t * (3 - 2 * t),
        h = (i, j) => hash(i % frequency, j % frequency);
      return (h(a, b) * (1 - sx) + h(a + 1, b) * sx) * (1 - sy)
        + (h(a, b + 1) * (1 - sx) + h(a + 1, b + 1) * sx) * sy;
    };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    bytes[i] = Math.round(255 * (0.5 * sample(x, y, 4) + 0.3 * sample(x, y, 16) + 0.2 * sample(x, y, 64)));
    bytes[i + 1] = Math.round(255 * (0.6 * sample(x, y, 8) + 0.4 * hash(x, y)));
    bytes[i + 2] = Math.round(255 * hash(x, y)); bytes[i + 3] = 255;
  }
  const map = new THREE.DataTexture(bytes, size, size);
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true; map.needsUpdate = true;
  return map;
}

export function createFreeportSurroundings(groundNoise) {
  const group = new THREE.Group(), batches = new Map(), unitBox = new THREE.BoxGeometry(1, 1, 1),
    unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 8), identity = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0),
    material = (value, roughness = 0.9) => new THREE.MeshStandardNodeMaterial({ color: value, roughness }),
    asphalt = material(0x525951), gravel = material(0x989783), markings = material(0xc6b882),
    timber = material(0x6b6551), steel = material(0x647067), white = material(0xc8cdc5),
    roof = material(0x9ea99f), walls = material(0xb9b4a2), glass = material(0x354d4b, 0.3),
    boatWhite = material(0xd5d8ca, 0.45), boatDeck = material(0xb5aa88), dark = material(0x303e38),
    canvas = [material(0x3c6574), material(0x827d66), material(0x6a4d44), material(0xa7b0a1)];
  asphalt.colorNode = mix(color(0x4e554e), color(0x626a61), texture(groundNoise, positionWorld.xz.div(5)).g);
  timber.colorNode = mix(color(0x565748), color(0x89816b), texture(groundNoise, positionWorld.xz.div(12)).r);

  function append(geometry, position, scale, quaternion, surface) {
    let batch = batches.get(surface);
    if (!batch) { batch = { positions: [], normals: [], indices: [] }; batches.set(surface, batch); }
    const base = batch.positions.length / 3, matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale)),
      normal = new THREE.Matrix3().getNormalMatrix(matrix), point = new THREE.Vector3();
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      point.fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(matrix); batch.positions.push(...point.toArray());
      point.fromBufferAttribute(geometry.attributes.normal, i).applyNormalMatrix(normal); batch.normals.push(...point.toArray());
    }
    for (const index of geometry.index.array) batch.indices.push(base + index);
  }
  const box = (x, y, z, w, h, l, surface = timber) => append(unitBox, [x, y, z], [w, h, l], identity, surface),
    beam = (a, b, width, surface = timber, depth = width) => {
      const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
      append(unitBox, start.add(end).multiplyScalar(0.5).toArray(), [width, direction.length(), depth],
        new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()), surface);
    }, cylinder = (x, y, z, radius, height, surface = timber) => append(unitCylinder, [x, y, z], [radius, height, radius], identity, surface);
  function polygon(vertices, indices, surface) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); append(geometry, [0, 0, 0], [1, 1, 1], identity, surface); geometry.dispose();
  }
  function ribbon(points, width, surface) {
    const vertices = [], indices = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)],
        length = Math.hypot(b.x - a.x, b.z - a.z), nx = (b.z - a.z) / length * width / 2, nz = (a.x - b.x) / length * width / 2;
      vertices.push(p.x - nx, p.y, p.z - nz, p.x + nx, p.y, p.z + nz);
    }
    for (let i = 0; i < points.length - 1; i++) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    polygon(vertices, indices, surface);
  }
  // Quiet curving two-lane roads follow the crown of each authored levee.
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 801 }, (_, i) => freeportLeveeRoad(side, -1600 + i * 4));
    ribbon(points.map(p => ({ ...p, y: p.y - 0.025 })), 9.2, gravel); ribbon(points, 7.2, asphalt);
    for (const offset of [-3.1, 3.1]) ribbon(points.map(p => ({ ...p, x: p.x + offset, y: p.y + 0.01 })), 0.08, white);
    for (let z = -1580; z < 1600; z += 13) {
      const a = freeportLeveeRoad(side, z), b = freeportLeveeRoad(side, z + 4);
      ribbon([{ ...a, y: a.y + 0.012 }, { ...b, y: b.y + 0.012 }], 0.13, markings);
    }
    // Smooth bridge approach ramps meet the levee road instead of ending at grass.
    const end = B.mainSpan / 2 + B.fixedSpan + B.eastPony, local = side > 0 ? end : end - B.length,
      start = bridgeToWorld(local + side * 12, B.deckY - 0.1, 0), road = freeportLeveeRoad(side, start.z);
    const finishX = road.x + side * 6;
    polygon([start.x, start.y, start.z - 4.1, start.x, start.y, start.z + 4.1,
      finishX, road.y + 0.014, start.z - 4.1, finishX, road.y + 0.014, start.z + 4.1],
    side > 0 ? [0, 1, 2, 1, 3, 2] : [0, 2, 1, 1, 2, 3], asphalt);
  }

  function pitchedRoof(x, y, z, w, length, rise, surface) {
    const h = w / 2, l = length / 2;
    polygon([x - h, y, z - l, x - h, y, z + l, x, y + rise, z + l, x, y + rise, z - l,
      x + h, y, z - l, x + h, y, z + l], [0, 1, 2, 0, 2, 3, 3, 2, 5, 3, 5, 4], surface);
    polygon([x - h, y, z - l, x, y + rise, z - l, x + h, y, z - l,
      x - h, y, z + l, x + h, y, z + l, x, y + rise, z + l], [0, 1, 2, 3, 4, 5], surface);
  }
  const marina = freeportMarinaLayout();
  for (const [rowIndex, row] of marina.roofs.entries()) {
    const length = row.z1 - row.z0, middle = (row.z0 + row.z1) / 2;
    pitchedRoof(row.x, row.y, middle, row.width, length, 0.55, roof);
    for (const dx of [-row.width / 2, row.width / 2]) {
      box(row.x + dx, 0.32, middle, 1.5, 0.22, length + 3);
      beam([row.x + dx, row.y - 0.15, row.z0], [row.x + dx, row.y - 0.15, row.z1], 0.15, steel);
      for (let z = row.z0; z <= row.z1; z += 10.5) {
        cylinder(row.x + dx, 1.9, z, 0.07, 3.6, steel);
        box(row.x - 4, 0.32, z, 16, 0.22, 0.8);
      }
    }
    for (let z = row.z0 - 4; z <= row.z1 + 4; z += 24) cylinder(row.x + row.width / 2 + 1.5, 2.6, z, 0.14, 7.8);
    box(row.x, 0.32, row.z1, row.width + 2, 0.22, 2);
    if (rowIndex > 0) {
      const other = marina.roofs[0];
      beam([row.x + 5.5, 0.32, row.z1], [other.x - 5.5, 0.32, row.z1], 0.22, timber, 2);
      continue;
    }
    // Boarding ramp climbs from the floating head dock to the levee toe.
    const landX = marina.edge + 12, landY = freeportGround(landX, row.z1);
    beam([row.x + 5.5, 0.45, row.z1], [landX, landY + 0.15, row.z1], 0.2, timber, 1.6);
    for (const dz of [-0.78, 0.78]) {
      beam([row.x + 5.5, 1.45, row.z1 + dz], [landX, landY + 1.15, row.z1 + dz], 0.06, steel);
      for (let i = 0; i <= 6; i++) {
        const t = i / 6, x = row.x + 5.5 + (landX - row.x - 5.5) * t, y = 0.45 + (landY - 0.3) * t;
        beam([x, y, row.z1 + dz], [x, y + 1, row.z1 + dz], 0.045, steel);
      }
    }
  }
  for (const boat of marina.boats) addBoat(boat);
  function addBoat(site) {
    const q = new THREE.Quaternion().setFromAxisAngle(up, site.yaw),
      profile = [[-0.5, 0.38], [-0.35, 0.5], [0.12, 0.5], [0.34, 0.35], [0.5, 0.025]], vertices = [], indices = [];
    for (const [z, w] of profile) vertices.push(-w * site.width, 0.5, z * site.length,
      w * site.width, 0.5, z * site.length, w * site.width * 0.6, -0.22, z * site.length,
      -w * site.width * 0.6, -0.22, z * site.length);
    for (let i = 0; i < profile.length - 1; i++) for (let j = 0; j < 4; j++) {
      const a = i * 4 + j, b = i * 4 + (j + 1) % 4;
      indices.push(a, a + 4, b, b, a + 4, b + 4);
    }
    indices.push(0, 2, 3, 0, 1, 2, 16, 18, 17, 16, 19, 18);
    const hull = new THREE.BufferGeometry(); hull.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    hull.setIndex(indices); hull.computeVertexNormals(); append(hull, [site.x, 0, site.z], [1, 1, 1], q, boatWhite); hull.dispose();
    const detail = (x, y, z, w, h, l, surface) => {
      const p = new THREE.Vector3(x, y, z).applyQuaternion(q).add(new THREE.Vector3(site.x, 0, site.z));
      append(unitBox, p.toArray(), [w, h, l], q, surface);
    };
    detail(0, 0.55, -0.4, site.width * 0.72, 0.06, site.length * 0.56, boatDeck);
    if (site.cabin) {
      detail(0, 1.02, 0.6, site.width * 0.76, 0.85, site.length * 0.3, boatWhite);
      detail(0, 1.2, 0.6, site.width * 0.79, 0.4, site.length * 0.25, glass);
      detail(0, 1.52, 0.6, site.width * 0.84, 0.14, site.length * 0.33, white);
    } else {
      detail(0, 0.9, 1, site.width * 0.72, 0.58, 0.1, glass);
      detail(0, 1.65, -0.4, site.width * 0.84, 0.07, site.length * 0.31, canvas[site.color]);
      for (const x of [-site.width * 0.35, site.width * 0.35]) for (const z of [-1.5, 0.8]) detail(x, 1.1, z, 0.045, 1.1, 0.045, steel);
    }
    detail(0, 0.3, -site.length * 0.52, 0.5, 0.9, 0.65, dark);
  }

  const random = seededRandom(413);
  function building(x, z, w, length, height, roofSurface = roof) {
    const y = freeportGround(x, z);
    box(x, y + 0.22, z, w + 0.5, 0.44, length + 0.5, gravel);
    box(x, y + height / 2 + 0.3, z, w, height, length, walls);
    pitchedRoof(x, y + height + 0.3, z, w + 0.9, length + 1, w * 0.16, roofSurface);
    for (const side of [-1, 1]) for (const dx of [-w * 0.27, w * 0.27]) box(x + dx, y + 2.1, z + side * (length / 2 + 0.015), 1.3, 1.1, 0.04, glass);
    for (const side of [-1, 1]) box(x + side * (w / 2 + 0.015), y + 2.1, z, 0.04, 1.1, 1.8, glass);
    box(x - 1, y + 1.4, z - length / 2 - 0.025, 0.85, 2.2, 0.05, timber);
    box(x, y + height + w * 0.14, z + length * 0.28, 0.7, 1.2, 0.7, gravel);
  }
  // Low village buildings behind the east levee; quieter farm buildings opposite.
  for (const side of [-1, 1]) for (let i = 0; i < (side > 0 ? 17 : 7); i++) {
    const z = -520 + i * (side > 0 ? 62 : 170) + random() * 20,
      { center, halfWidth } = freeportChannel(z), x = center + side * (halfWidth + 56 + random() * 85);
    building(x, z, 7 + random() * 7, 9 + random() * 11, 3 + random() * 1.3, i % 4 ? roof : canvas[1]);
    const road = freeportLeveeRoad(side, z);
    ribbon(Array.from({ length: 13 }, (_, j) => {
      const px = road.x + (x - road.x) * j / 12;
      return { x: px, y: freeportGround(px, z) + 0.09, z };
    }), 3, gravel);
  }
  building(marina.edge + 51, -195, 12, 19, 3.4, white);
  // Modest utility poles with sagging wires give the road a inhabited scale.
  let previous = null;
  for (let z = -540; z <= 700; z += 86) {
    const road = freeportLeveeRoad(1, z), x = road.x + 6, y = freeportGround(x, z);
    cylinder(x, y + 5.3, z, 0.13, 10.6); box(x, y + 9.7, z, 3.1, 0.13, 0.14);
    for (const dx of [-1.2, 0, 1.2]) box(x + dx, y + 9.85, z, 0.1, 0.3, 0.1, white);
    if (previous) for (const dx of [-1.2, 1.2]) for (let i = 0; i < 12; i++) {
      const point = t => [previous.x + (x - previous.x) * t + dx,
        previous.y + (y - previous.y) * t + 10 - Math.sin(t * Math.PI) * 1.3, previous.z + (z - previous.z) * t];
      beam(point(i / 12), point((i + 1) / 12), 0.018, dark);
    }
    previous = { x, y, z };
  }
  for (const [surface, batch] of batches) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(batch.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(batch.normals, 3)); geometry.setIndex(batch.indices); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, surface); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }
  unitBox.dispose(); unitCylinder.dispose(); group.name = "Freeport riverfront · photo-informed setting";
  group.userData = { bindingClass: "setting", surveyed: false, marina };
  return group;
}
