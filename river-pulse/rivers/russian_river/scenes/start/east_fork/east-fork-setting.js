import * as THREE from "../../../../../../vendor/three/three.webgpu.js";
import { color, float, instanceIndex, mix, normalWorld, positionGeometry, positionLocal, positionWorld, sin, smoothstep, texture, vec2, vec3 } from "../../../../../../vendor/three/three.tsl.js";
import { forkChannel, forkGrid, forkGround } from "./east-fork-layout.js";
import { grayStone } from "../../../../../scene-kit/beach-materials.js";
import { SETTING_BASE } from "../../../../../scene-kit/bank-materials.js";
import { seededRandom } from "../../../../../scene-kit/bank-setting-layout.js";

function terrain(noise, maps, grassMap) {
  const grid = forkGrid(), geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(grid.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1)); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.98 }), p = positionWorld,
    broad = texture(noise, p.xz.div(130)).r, detail = texture(noise, p.xz.div(4)).g,
    gold = mix(color(0x73664a), color(0xb0a071), broad.mul(0.6).add(detail.mul(0.25))),
    grass = gold.mul(texture(grassMap, p.xz.div(1.8)).rgb.mul(0.7).add(0.58)),
    pebble = grayStone(maps.pebbles.color, p.xz.div(1.8)),
    bank = mix(pebble.mul(0.62), pebble, smoothstep(-0.05, 1.4, p.y)),
    nearWater = smoothstep(1.1, 3.2, p.y);
  material.colorNode = mix(bank, grass, nearWater);
  const mesh = new THREE.Mesh(geometry, material); mesh.name = "Earthfill embankment and oak valley ground";
  mesh.receiveShadow = true; return mesh;
}

function outlet(noise) {
  const group = new THREE.Group(), concrete = new THREE.MeshStandardNodeMaterial({ roughness: 0.94 }),
    p = positionWorld, normal = normalWorld.abs(), weights = normal.div(normal.x.add(normal.y).add(normal.z)),
    n = texture(noise, p.zy.div(3)).r.mul(weights.x)
      .add(texture(noise, p.xz.div(3)).r.mul(weights.y))
      .add(texture(noise, p.xy.div(3)).r.mul(weights.z));
  concrete.colorNode = mix(color(0x96968b), color(0xb3b0a2), n)
    .mul(mix(color(0x65685b), color(0xffffff), smoothstep(0, 3.5, p.y)));
  const metal = new THREE.MeshStandardNodeMaterial({ color: 0x888a85, roughness: 0.67, metalness: 0.45 }),
    dark = new THREE.MeshStandardNodeMaterial({ color: 0x131814, roughness: 1 });
  function box(name, x, y, z, w, h, d, material = concrete) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh); return mesh;
  }
  // Two adjacent openings, tapered concrete wing walls, service railings. Display sizes.
  box("Outlet dark opening", -4.5, 3.5, -105.5, 10, 7, 0.3, dark);
  box("Tailrace dark opening", 8, 2.8, -103, 9, 5.5, 0.3, dark);
  box("Outlet left pier", -10.5, 4.5, -105, 2.2, 10, 5);
  box("Outlet central pier", 1.5, 4.6, -103, 2.2, 10.2, 7);
  box("Outlet headwall beam", -4.5, 8, -105, 14.2, 2, 5);
  box("Tailrace right pier", 13, 3.4, -102, 1.6, 7.4, 7);
  box("Tailrace lintel", 8, 6.4, -102, 11.5, 1.4, 7);
  box("Outlet service deck", -4.5, 10, -108, 10, 0.45, 6);
  box("Gate hoist frame", -4.5, 11.8, -108, 5.6, 2.6, 2.5, metal);
  box("Gate hoist dark front", -4.5, 11.8, -106.7, 4.8, 1.8, 0.06, dark);
  box("Gate hoist cap", -4.5, 13.2, -108, 6.3, 0.24, 3, concrete);
  box("Outlet control gate", -4.5, 7.3, -107, 9.3, 1.3, 0.4, metal);
  for (const x of [-12, 15]) {
    const vertices = [x - 0.7, -1.5, -104, x + 0.7, -1.5, -104,
      x - 0.7, 8, -104, x + 0.7, 8, -104, x - 0.7, -1.5, -42,
      x + 0.7, -1.5, -42, x - 0.7, 2, -42, x + 0.7, 2, -42],
      geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex([0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5, 2, 6, 3, 3, 6, 7,
      0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6]); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, concrete); mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = "Sloped stilling basin wing wall"; group.add(mesh);
  }
  // Metal railings along the service deck and dam's gravel crest.
  for (const z of [-111, -105]) {
    for (let x = -11; x <= 2; x += 2) box("Outlet railing post", x, 10.8, z, 0.09, 1.6, 0.09, metal);
    for (const y of [10.6, 11.3]) box("Outlet railing", -4.5, y, z, 13, 0.07, 0.07, metal);
  }
  const road = box("Gravel crest road", 0, 51.87, -235, 760, 0.24, 9,
    new THREE.MeshStandardNodeMaterial({ color: 0x918a7c, roughness: 1 }));
  road.receiveShadow = true;
  for (let x = -260; x <= 260; x += 5) {
    box("Crest fence post", x, 52.45, -230, 0.08, 1.4, 0.08, metal);
  }
  for (const y of [52.4, 52.9]) box("Crest fence wire", 0, y, -230, 520, 0.025, 0.025, metal);
  // A diagonal maintenance track across the broad dry face, visible in the references.
  const trackPositions = [], trackIndices = [];
  for (let i = 0; i <= 90; i++) {
    const x = -135 + i * 1.8, z = -115 - i * 1.2;
    for (const side of [-1, 1]) {
      const px = x + side * 0.7, pz = z + side * 1.05;
      trackPositions.push(px, forkGround(px, pz) + 0.14, pz);
    }
    if (i < 90) { const k = i * 2; trackIndices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const trackGeometry = new THREE.BufferGeometry();
  trackGeometry.setAttribute("position", new THREE.Float32BufferAttribute(trackPositions, 3));
  trackGeometry.setIndex(trackIndices); trackGeometry.computeVertexNormals();
  const track = new THREE.Mesh(trackGeometry, new THREE.MeshStandardNodeMaterial({ color: 0x9c9278, roughness: 1, side: THREE.DoubleSide }));
  track.name = "Embankment maintenance path"; group.add(track);
  group.name = "Photo-informed concrete outlet and crest road"; return group;
}

function riprap(maps) {
  const random = seededRandom(2301), sites = [], dummy = new THREE.Object3D(), tint = new THREE.Color();
  for (let i = 0; i < 2400; i++) {
    const z = -102 + random() * 245, edge = forkChannel(z), side = random() < 0.5 ? -1 : 1,
      x = edge.center + side * (edge.radius + random() ** 2 * 10), y = forkGround(x, z);
    if (z < -44 && x > -13 && x < 16) continue;
    sites.push({ x, y, z, size: 0.15 + random() ** 2 * 0.65 });
  }
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.97 }), p = positionWorld,
    n = normalWorld.abs(), w = n.div(n.x.add(n.y).add(n.z));
  material.colorNode = grayStone(maps.rock.color, p.zy.div(2)).mul(w.x)
    .add(grayStone(maps.rock.color, p.xz.div(2)).mul(w.y))
    .add(grayStone(maps.rock.color, p.xy.div(2)).mul(w.z));
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material, sites.length);
  sites.forEach((s, i) => {
    dummy.position.set(s.x, s.y + s.size * 0.18, s.z);
    dummy.rotation.set(random(), random() * 6.28, random());
    dummy.scale.set(s.size * 1.3, s.size * 0.6, s.size); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    tint.setScalar(0.7 + random() * 0.4); mesh.setColorAt(i, tint);
  });
  mesh.computeBoundingSphere(); mesh.receiveShadow = true; mesh.name = "Irregular grey bank riprap"; return mesh;
}

async function woodland() {
  const r = await fetch(new URL("broadleaf.json", SETTING_BASE)), manifest = await r.json(),
    loader = new THREE.TextureLoader(), [bark, leaf] = await Promise.all(["oak-bark.jpg", "oak-leaf.png"]
      .map(f => loader.loadAsync(new URL(f, SETTING_BASE).href)));
  bark.colorSpace = leaf.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group(), random = seededRandom(4891), sites = [];
  for (const [cx, cz, spread, count] of [[-54, -38, 32, 15], [62, -44, 38, 18], [-115, 110, 105, 55], [110, 150, 125, 70],
    [-260, -60, 145, 85], [260, -35, 140, 80], [-410, -310, 190, 120], [435, -300, 220, 120],
    [-170, 380, 240, 100], [210, 430, 260, 130]]) {
    for (let i = 0; i < count; i++) {
      const x = cx + (random() - 0.5) * spread, z = cz + (random() - 0.5) * spread;
      if (Math.abs(x - forkChannel(z).center) < forkChannel(z).radius + 12 ||
        z < -105 && Math.abs(x) < 300) continue;
      sites.push({ x, y: forkGround(x, z), z, height: 6 + random() * 12, turn: random() * 6.28 });
    }
  }
  for (const [vi, variant] of manifest.variants.entries()) {
    const raw = await (await fetch(new URL(variant.file, SETTING_BASE))).arrayBuffer(),
      selected = sites.filter((s, i) => i % manifest.variants.length === vi);
    for (const [part, map] of [["branches", bark], ["leaves", leaf]]) {
      const p = variant.parts[part], n = p.vertexCount, f = new Float32Array(raw, p.offset, n * 8), g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(f.subarray(0, n * 3), 3));
      g.setAttribute("normal", new THREE.BufferAttribute(f.subarray(n * 3, n * 6), 3));
      g.setAttribute("uv", new THREE.BufferAttribute(f.subarray(n * 6, n * 8), 2));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(raw, p.offset + n * 32, p.indexCount), 1));
      const material = new THREE.MeshStandardNodeMaterial({ map, roughness: 0.95,
        alphaTest: part === "leaves" ? 0.45 : 0, side: THREE.DoubleSide }),
        mesh = new THREE.InstancedMesh(g, material, selected.length), dummy = new THREE.Object3D(), tint = new THREE.Color();
      selected.forEach((s, i) => {
        dummy.position.set(s.x, s.y, s.z); dummy.rotation.set(0, s.turn, 0);
        dummy.scale.setScalar(s.height / variant.height); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        tint.setHSL(0.23 + random() * 0.04, 0.15 + random() * 0.15, 0.32 + random() * 0.2);
        mesh.setColorAt(i, part === "leaves" ? tint : new THREE.Color(0xb3afa3));
      });
      mesh.computeBoundingSphere(); mesh.receiveShadow = true; group.add(mesh);
    }
  }
  group.name = "Clustered valley oaks"; group.userData.treeCount = sites.length; return group;
}

async function grass(clock) {
  const mask = await new THREE.TextureLoader().loadAsync(new URL("../../../../../../data/biomes/diablo-oak/grass/fluffy-mask.jpg", import.meta.url).href),
    points = [], uv = [], indices = [], geometry = new THREE.BufferGeometry();
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3, dx = Math.cos(a), dz = Math.sin(a), k = points.length / 3;
    points.push(-dx * 0.5, 0, -dz * 0.5, dx * 0.5, 0, dz * 0.5, -dx * 0.6, 1, -dz * 0.6, dx * 0.6 + 0.15, 1, dz * 0.6);
    uv.push(0, 0, 1, 0, 0, 1, 1, 1); indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardNodeMaterial({ alphaMap: mask, alphaTest: 0.3,
    side: THREE.DoubleSide, roughness: 1 }), random = seededRandom(324), sites = [];
  material.positionNode = positionLocal.add(vec3(sin(clock.mul(0.6).add(float(instanceIndex).mul(0.4)))
    .mul(positionGeometry.y.pow(2)).mul(0.09), 0, 0));
  for (let i = 0; i < 20000; i++) {
    const x = -190 + random() * 380, z = -350 + random() * 540, y = forkGround(x, z);
    if (y < 2 || z < -226 && z > -244 || random() > 0.65 + Math.sin(x * 0.09) * Math.sin(z * 0.06) * 0.3) continue;
    sites.push({ x, y, z });
  }
  const mesh = new THREE.InstancedMesh(geometry, material, sites.length), dummy = new THREE.Object3D(), tint = new THREE.Color();
  sites.forEach((s, i) => {
    dummy.position.set(s.x, s.y - 0.04, s.z); dummy.rotation.set(0, random() * 6.28, 0);
    const h = 0.2 + random() * 0.4; dummy.scale.set(0.8, h, 0.8); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.12 + random() * 0.04, 0.22 + random() * 0.15, 0.32 + random() * 0.16); mesh.setColorAt(i, tint);
  });
  mesh.computeBoundingSphere(); mesh.receiveShadow = true; mesh.name = "Dry grass clumps"; return mesh;
}

function releaseFoam(noise, clock) {
  const g = new THREE.PlaneGeometry(19, 65, 1, 1); g.rotateX(-Math.PI / 2); g.translate(-2, 0.09, -70);
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false }), p = positionWorld,
    n = texture(noise, vec2(p.x.mul(0.21), p.z.mul(0.15).sub(clock.mul(0.32)))).r,
    downstream = smoothstep(-104, -90, p.z).mul(float(1).sub(smoothstep(-84, -37, p.z))),
    edge = float(1).sub(smoothstep(6, 9.5, p.x.add(2).abs()));
  m.colorNode = color(0xc7d3c3); m.opacityNode = smoothstep(0.32, 0.62, n).mul(downstream).mul(edge).mul(0.62);
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 3; mesh.name = "Illustrative outlet turbulence"; return mesh;
}

export async function createForkSetting(noise, maps, clock) {
  const group = new THREE.Group(), grassMap = await new THREE.TextureLoader().loadAsync(
    new URL("../../../../../../data/biomes/diablo-oak/ground/grass_color.jpg", import.meta.url).href);
  grassMap.colorSpace = THREE.SRGBColorSpace; grassMap.wrapS = grassMap.wrapT = THREE.RepeatWrapping;
  grassMap.anisotropy = 4;
  group.add(terrain(noise, maps, grassMap), outlet(noise), riprap(maps), releaseFoam(noise, clock));
  group.add(...await Promise.all([woodland(), grass(clock)]));
  group.name = "East Fork photo-informed setting"; group.userData = { bindingClass: "setting", surveyed: false };
  return group;
}
