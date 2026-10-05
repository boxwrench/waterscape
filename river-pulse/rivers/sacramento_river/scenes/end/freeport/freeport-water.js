import * as THREE from "../../../../../../vendor/three/three.webgpu.js";
import { cameraPosition, color, dot, float, mix, normalize, positionWorld, pow, reflector, smoothstep, texture, uniform, vec2, vec3 } from "../../../../../../vendor/three/three.tsl.js";
import { freeportChannel } from "./freeport-layout.js";

export function createFreeportWater(noise) {
  const positions = [], indices = [], clock = uniform(0);
  for (let j = 0; j <= 500; j++) {
    const z = -2500 + j * 10, { center, halfWidth } = freeportChannel(z);
    positions.push(center - halfWidth, 0.015, z, center + halfWidth, 0.015, z);
    if (j < 500) { const a = j * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeBoundingSphere();
  const p = positionWorld.xz,
    detail = texture(noise, p.div(7.4).add(vec2(clock.mul(0.011), clock.mul(-0.009)))).rg.sub(0.5)
      .add(texture(noise, vec2(p.y.negate(), p.x).div(2.9).add(vec2(clock.mul(0.007), clock.mul(0.016)))).ba.sub(0.5).mul(0.4)),
    normal = normalize(vec3(detail.x.mul(0.13), 1, detail.y.mul(0.13))),
    eye = normalize(cameraPosition.sub(positionWorld)), facing = dot(normal, eye).clamp(0.02, 1),
    fresnel = pow(float(1).sub(facing), 5).mul(0.90).add(0.035),
    sun = normalize(vec3(-0.55, 0.7, 0.35)), glint = pow(dot(normal, normalize(sun.add(eye))).max(0), 320).mul(0.6),
    mirror = reflector({ resolutionScale: 0.55, bounces: false });
  mirror.target.rotation.x = -Math.PI / 2; mirror.target.position.y = 0.015;
  mirror.uvNode = mirror.uvNode.add(vec2(normal.x, normal.z).mul(0.023));
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  material.colorNode = mix(color(0x405847), mix(mirror.rgb, color(0x76887a), 0.06), fresnel)
    .add(color(0xfff0cc).mul(glint));
  const mesh = new THREE.Mesh(geometry, material); mesh.add(mirror.target); mesh.name = "Freeport illustrative reflective surface";
  mesh.userData = { bindingClass: "illustrative", surveyed: false, gaugeDriven: false,
    representation: "Fixed authored shoreline and optical ripples; no measured current, velocity, depth or turbidity" };
  return { mesh, update(seconds, reducedMotion) { clock.value = reducedMotion ? 0 : seconds; } };
}

export function createFreeportSky(noise) {
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false }),
    direction = positionWorld.normalize(), height = direction.y.max(0),
    sky = mix(color(0xd5ded6), color(0x79a7c4), smoothstep(0, 0.6, height)),
    cloud = texture(noise, direction.xz.div(height.mul(0.8).add(0.2)).mul(0.24)).r,
    haze = smoothstep(0.55, 0.77, cloud).mul(0.27).mul(smoothstep(0.01, 0.16, height));
  material.colorNode = mix(sky, color(0xf4eee0), haze);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(7000, 24, 16), material);
  mesh.name = "Freeport authored afternoon sky"; return mesh;
}
