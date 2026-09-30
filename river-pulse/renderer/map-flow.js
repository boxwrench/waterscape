import * as THREE from "../../vendor/three/three.webgpu.js";
import { attribute, color, fract, mix, pow, sin, uniform } from "../../vendor/three/three.tsl.js";
import { mapFlowIsMoving } from "../visual-bindings/map-flow.js";

// A symbolic animated stroke over exact map terrain. Source line ordering is a
// presentation direction, not a surveyed local velocity vector or inundation model.
export function createMapFlow(document, terrain) {
  const positions = [], distances = [], indices = [];
  for (const feature of document.features.filter((f) => f.name === "Russian River")) {
    for (const line of feature.lines) {
      let along = 0;
      for (let i = 1; i < line.length; i++) {
        const [ax, az] = line[i - 1], [bx, bz] = line[i], length = Math.hypot(bx - ax, bz - az);
        if (!length) continue;
        const nx = -(bz - az) / length * 5, nz = (bx - ax) / length * 5, a = positions.length / 3;
        for (const [x, z, s] of [[ax + nx, az + nz, along], [ax - nx, az - nz, along],
          [bx + nx, bz + nz, along + length], [bx - nx, bz - nz, along + length]]) {
          positions.push(x, terrain.ground(x, z) + 4.2, z); distances.push(s);
        }
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); along += length;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("flowDistance", new THREE.Float32BufferAttribute(distances, 1));
  geometry.setIndex(indices); geometry.computeBoundingSphere();
  const clock = uniform(0), tint = uniform(new THREE.Color(0x3f9585)), moving = uniform(0),
    phase = fract(attribute("flowDistance", "float").sub(clock.mul(24)).div(65)),
    pulse = pow(sin(phase.mul(Math.PI)).max(0), 18).mul(moving),
    material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  material.colorNode = mix(tint, color(0xe5ffff), pulse.mul(0.85));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Map river flow";
  mesh.userData = { bindingClass: "illustrative", moving: false,
    representation: "Symbolic flow pulses: fixed display width and speed, not measured velocity, direction, bank width or stage" };
  return { mesh, applyState(state) {
    mesh.userData.moving = mapFlowIsMoving(state);
    moving.value = mesh.userData.moving ? 1 : 0;
  }, setColor(value) { tint.value.setHex(value); }, update(seconds, reducedMotion) {
    clock.value = reducedMotion ? 0 : seconds;
  } };
}
