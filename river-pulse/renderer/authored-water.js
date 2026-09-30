import * as THREE from "../../vendor/three/three.webgpu.js";
import {
  attribute, cameraPosition, color, cos, dot, exp, float, floor, fract, fwidth,
  mix, normalize, positionWorld, pow, reflector, refract, sin, texture, uniform, vec2, vec3,
} from "../../vendor/three/three.tsl.js";
import { buildAuthoredWaterGeometry } from "./authored-water-geometry.js";

export function createAuthoredWater(document, terrain, maps = null) {
  const grid = buildAuthoredWaterGeometry(document, terrain);
  if (!grid) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(grid.positions, 3));
  geometry.setAttribute("opticalDepth", new THREE.BufferAttribute(grid.depths, 1));
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1));
  geometry.computeBoundingSphere();
  const clock = uniform(0), p = positionWorld.xz;
  let slopeX = float(0), slopeZ = float(0);
  // Short-crested multi-directional detail avoids parallel wave bands. Filter
  // subpixel waves so the far reach stays calm instead of shimmering with aliasing.
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.3999632297, frequency = 0.8 * Math.pow(1.36, i),
      dx = Math.cos(angle), dz = Math.sin(angle),
      phase = p.x.mul(dx * frequency).add(p.y.mul(dz * frequency))
        .add(clock.mul(0.7 + i * 0.13)).add(i * 1.7),
      wandering = sin(p.x.mul(0.21).add(p.y.mul(0.17)).add(clock.mul(0.12))).mul(0.55),
      wave = cos(phase.add(wandering)).mul(0.021).mul(exp(fwidth(phase).mul(-1.5)));
    slopeX = slopeX.add(wave.mul(dx));
    slopeZ = slopeZ.add(wave.mul(dz));
  }
  const normal = normalize(vec3(slopeX, 1, slopeZ)),
    eye = normalize(cameraPosition.sub(positionWorld)),
    facing = dot(normal, eye).clamp(0.02, 1),
    fresnel = pow(float(1).sub(facing), 5).mul(0.98).add(0.02),
    depth = attribute("opticalDepth", "float"),
    // Analytic refraction onto a modeled gravel bed. No survey bathymetry is implied.
    refracted = refract(eye.negate(), normal, 1 / 1.333),
    bedUV = p.add(refracted.xz.div(refracted.y.abs().max(0.1)).mul(depth)),
    pebbleCell = floor(bedUV.mul(7)),
    gravel = fract(sin(dot(pebbleCell, vec2(127.1, 311.7))).mul(43758.5453)),
    bed = maps?.pebbles
      ? texture(maps.pebbles.color, bedUV.div(maps.pebbles.tileMetres)).rgb.mul(0.72)
      : mix(color(0x605b42), color(0xb7aa7a), gravel),
    bedNormal = maps?.pebbles
      ? texture(maps.pebbles.normal, bedUV.div(maps.pebbles.tileMetres)).xyz.mul(2).sub(1)
      : vec3(0, 0, 1),
    bedLight = dot(normalize(bedNormal), normalize(vec3(-0.5, -0.25, 0.83))).max(0.45),
    ca = sin(bedUV.x.mul(3.8).add(bedUV.y.mul(2.1)).add(clock.mul(0.7))),
    cb = sin(bedUV.x.mul(-2.6).add(bedUV.y.mul(4.3)).sub(clock.mul(0.5))),
    caustic = pow(float(1).sub(ca.add(cb).mul(0.5).abs()), 14).mul(0.28),
    transmission = exp(depth.mul(-0.8).div(facing.add(0.25))),
    underwater = mix(color(0x163b38), bed.mul(bedLight).mul(caustic.add(0.82)), transmission),
    sun = normalize(vec3(-0.5, 0.83, 0.25)),
    glint = pow(dot(normal, normalize(sun.add(eye))).max(0), 260).mul(1.8),
    mirror = reflector({ resolutionScale: 0.35, bounces: false });
  mirror.target.rotation.x = -Math.PI / 2;
  mirror.target.position.y = grid.focus.y;
  mirror.uvNode = mirror.uvNode.add(vec2(normal.x, normal.z).mul(0.012));
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.FrontSide });
  material.colorNode = mix(underwater, mirror.rgb, fresnel).add(color(0xffe6b4).mul(glint));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Hacienda authored water";
  mesh.add(mirror.target);
  mesh.visible = false;
  mesh.userData = { representation: grid.representation, bindingClass: "illustrative",
    optics: "derived from illustrative surface, bed and lighting", focus: grid.focus };
  return { mesh, focus: grid.focus, update(seconds, reducedMotion) {
    clock.value = reducedMotion ? 0 : seconds;
  } };
}
