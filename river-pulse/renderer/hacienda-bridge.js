import * as THREE from "../../vendor/three/three.webgpu.js";

// Seven-panel camelback and 61 m span / 7.71 m roadway from HistoricBridges.
// Deck height, details, approach placement and pier profile are photo-informed estimates.
export function createHaciendaBridge() {
  const group = new THREE.Group(), beams = [], concrete = [],
    span = 61, deck = 13, width = 7.71, panels = 7,
    heights = [0, 8.8, 11.2, 12, 12, 11.2, 8.8, 0],
    steel = new THREE.MeshStandardNodeMaterial({ color: 0xb7c1cb, roughness: 0.62, metalness: 0.2 }),
    slab = new THREE.MeshStandardNodeMaterial({ color: 0x9a9b96, roughness: 0.96 });
  function beam(a, b, thickness = 0.18, depth = thickness, target = beams) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b),
      matrix = new THREE.Matrix4(), turn = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    matrix.compose(start.clone().add(end).multiplyScalar(0.5), turn,
      new THREE.Vector3(thickness, start.distanceTo(end), depth));
    target.push(matrix);
  }
  for (const side of [-1, 1]) {
    const z = side * width / 2;
    for (let i = 0; i < panels; i++) {
      const x = -span / 2 + i * span / panels, next = x + span / panels,
        a = [x, deck + heights[i], z], b = [next, deck + heights[i + 1], z];
      beam(a, b, 0.32, 0.26);
      beam([x, deck, z], [next, deck, z], 0.4, 0.27);
      if (i > 0) beam([x, deck, z], a, 0.21, 0.24);
      if (i > 0 && i < panels - 1) {
        beam([x, deck, z], b, 0.11, 0.16);
        beam(a, [next, deck, z], 0.11, 0.16);
      }
      // Short paired flange lines give the upper chord an I-beam silhouette.
      beam([a[0], a[1] + 0.17, z], [b[0], b[1] + 0.17, z], 0.08, 0.42);
    }
    beam([-31, deck + 0.85, z + side * 0.7], [31, deck + 0.85, z + side * 0.7], 0.08);
    for (let x = -30; x <= 30; x += 2) {
      beam([x, deck, z + side * 0.7], [x, deck + 0.85, z + side * 0.7], 0.055);
      beam([x, deck + 0.42, z + side * 0.7], [x + 2, deck + 0.42, z + side * 0.7], 0.045);
    }
  }
  for (const side of [-1, 1])
    beam([-31, deck - 0.85, side * width / 2], [31, deck - 0.85, side * width / 2], 0.9, 0.32);
  for (let i = 1; i < panels; i++) {
    const x = -span / 2 + i * span / panels, y = deck + heights[i];
    beam([x, y, -width / 2], [x, y, width / 2], 0.2);
    if (i < panels - 1) {
      const next = x + span / panels, nextY = deck + heights[i + 1];
      beam([x, y, -width / 2], [next, nextY, width / 2], 0.08);
      beam([x, y, width / 2], [next, nextY, -width / 2], 0.08);
    }
    beam([x, deck - 0.6, -width / 2], [x, deck - 0.6, width / 2], 0.42);
    if (i < panels - 1) {
      const next = x + span / panels;
      beam([x, deck - 1.1, -width / 2], [next, deck - 1.1, width / 2], 0.14);
      beam([x, deck - 1.1, width / 2], [next, deck - 1.1, -width / 2], 0.14);
    }
  }
  beam([-31, deck - 0.35, 0], [31, deck - 0.35, 0], 0.45, width + 1.8, concrete);
  for (const [start, end] of [[-85, -31], [31, 70]]) {
    beam([start, deck - 0.45, 0], [end, deck - 0.45, 0], 0.7, width + 1.8, concrete);
    for (const side of [-1, 1]) {
      const z = side * (width / 2 + 0.6);
      beam([start, deck + 0.9, z], [end, deck + 0.9, z], 0.2, 0.23, concrete);
      beam([start, deck + 0.2, z], [end, deck + 0.2, z], 0.18, 0.22, concrete);
      for (let x = start; x < end; x += 1.6)
        beam([x, deck + 0.2, z], [x, deck + 0.9, z], 0.18, 0.22, concrete);
    }
    for (let x = start + 8; x < end - 4; x += 14) {
      beam([x, 2, -2.5], [x, deck - 0.6, -2.5], 0.85, 0.85, concrete);
      beam([x, 2, 2.5], [x, deck - 0.6, 2.5], 0.85, 0.85, concrete);
    }
  }
  for (const x of [-31, 31]) {
    beam([x, 1, 0], [x, deck - 0.8, 0], 2.6, width + 2.5, concrete);
    beam([x, deck - 1, -5.3], [x, deck - 1, 5.3], 3.6, 1.4, concrete);
  }
  for (const [matrices, material] of [[beams, steel], [concrete, slab]]) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh);
  }
  group.position.z = -85;
  group.name = "Hacienda camelback bridge";
  group.userData = { bindingClass: "setting", panels, span, roadwayWidth: width,
    source: "https://historicbridges.org/bridges/browser/?bridgebrowser=california/riverroadrussianriver/",
    representation: "Photo-informed bridge model; not surveyed engineering geometry" };
  return group;
}
