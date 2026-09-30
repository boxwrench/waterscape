import * as THREE from "../../vendor/three/three.webgpu.js";
import {
  attribute, cameraPosition, color, cos, dot, exp, float, mix, normalize,
  positionLocal, positionWorld, pow, reflector, reflect, sin, smoothstep, texture, uniform, vec2, vec3,
} from "../../vendor/three/three.tsl.js";
import { jennerCoast, jennerGrid } from "./jenner-layout.js";
import { grayStone } from "./beach-materials.js";

export function createJennerWater(noise, maps) {
  const clock = uniform(0), group = new THREE.Group(), grid = jennerGrid(),
    geometry = new THREE.BufferGeometry(), ocean = new Float32Array(grid.ground.length),
    offshore = new Float32Array(grid.ground.length);
  for (let i = 0; i < ocean.length; i++) {
    const x = grid.positions[i * 3], z = grid.positions[i * 3 + 2], d = x - jennerCoast(z);
    offshore[i] = d; ocean[i] = Math.max(0, Math.min(1, (100 - d) / 140));
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(grid.positions, 3));
  geometry.setAttribute("bedElevation", new THREE.BufferAttribute(grid.ground, 1));
  geometry.setAttribute("seaWeight", new THREE.BufferAttribute(ocean, 1));
  geometry.setAttribute("shoreDistance", new THREE.BufferAttribute(offshore, 1));
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1)); geometry.computeBoundingSphere();

  const p = positionLocal.xz, depth = attribute("bedElevation", "float").negate().max(0),
    sea = attribute("seaWeight", "float"), shore = attribute("shoreDistance", "float"),
    slow = texture(noise, p.div(260).add(vec2(clock.mul(-0.001), 0))).r,
    short = texture(noise, p.div(31).add(vec2(clock.mul(-0.006), clock.mul(0.003))));
  let height = float(0.03), sx = float(0), sz = float(0);
  // Directional swell at multiple scales, with set/alongshore variation. Geometry,
  // depth, period and speed are hand-authored, not local measurements or a forecast.
  for (const [kx, kz, amplitude, speed] of [[0.037, 0.006, 0.8, 0.65],
    [0.081, -0.019, 0.34, 0.93], [0.19, 0.047, 0.12, 1.4], [0.33, -0.21, 0.06, 1.9]]) {
    const phase = p.x.mul(kx).add(p.y.mul(kz)).sub(clock.mul(speed))
      .add(slow.sub(0.5).mul(2.4)),
      amp = sea.mul(amplitude).mul(slow.mul(0.45).add(0.75))
        .mul(smoothstep(0, 1.3, depth).mul(0.75).add(0.25));
    height = height.add(sin(phase).mul(amp));
    sx = sx.add(cos(phase).mul(amp).mul(kx));
    sz = sz.add(cos(phase).mul(amp).mul(kz));
  }
  const breakerPhase = shore.mul(0.21).sub(clock.mul(0.95))
      .add(slow.sub(0.5).mul(2.6)).add(sin(p.y.mul(0.027)).mul(0.35)),
    breaker = sin(breakerPhase),
    breakZone = sea.mul(smoothstep(-0.5, 1, depth)).mul(float(1).sub(smoothstep(3, 7.5, depth))),
    breakerHeight = breaker.max(0).pow(3).mul(0.7).mul(breakZone),
    surface = height.add(breakerHeight),
    material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, alphaTest: 0.02 });
  material.positionNode = vec3(positionLocal.x, surface, positionLocal.z);
  material.opacityNode = smoothstep(attribute("bedElevation", "float").add(0.015),
    attribute("bedElevation", "float").add(0.10), positionWorld.y);

  const wp = positionWorld.xz,
    detail = texture(noise, wp.div(37).add(vec2(clock.mul(-0.015), clock.mul(0.008)))).rg.sub(0.5)
      .add(texture(noise, vec2(wp.y.negate(), wp.x).div(9.3)
        .add(vec2(clock.mul(0.022), 0.31))).ba.sub(0.5).mul(0.4)),
    normal = normalize(vec3(sx.negate().add(detail.x.mul(mix(0.10, 0.4, sea)))
      .sub(cos(breakerPhase).mul(breaker.max(0).pow(2)).mul(breakZone).mul(0.38)),
      1, sz.negate().add(detail.y.mul(mix(0.10, 0.4, sea))))),
    eye = normalize(cameraPosition.sub(positionWorld)), facing = dot(normal, eye).clamp(0.02, 1),
    fresnel = pow(float(1).sub(facing), 5).mul(0.98).add(0.02),
    reflected = reflect(eye.negate(), normal),
    sky = mix(color(0xb1cbd3), color(0x4c8bb4), reflected.y.clamp(0, 1).pow(0.5)),
    mirror = reflector({ resolutionScale: 0.65, bounces: false });
  mirror.target.rotation.x = -Math.PI / 2; mirror.target.position.y = 0;
  mirror.uvNode = mirror.uvNode.add(normal.xz.mul(0.018));

  const body = mix(color(0x304b3f), color(0x154b51), sea),
    bed = maps ? grayStone(maps.pebbles.color, wp.div(0.65)).mul(vec3(0.68, 0.70, 0.62)) : color(0x6a695b),
    transmission = exp(depth.mul(-2.4)).mul(float(0.52).sub(sea.mul(0.44))),
    underwater = mix(body, bed, transmission),
    reflection = mix(mirror.rgb, sky, sea.mul(0.78)),
    sun = normalize(vec3(-0.58, 0.69, 0.32)),
    glint = pow(dot(normal, normalize(sun.add(eye))).max(0), 180).mul(1.1),
    swash = sea.mul(float(1).sub(smoothstep(0.12, 1.8, depth)))
      .mul(smoothstep(0.15, 0.7, breaker.mul(0.5).add(0.5))),
    crest = smoothstep(0.42, 0.86, breaker).mul(breakZone),
    foamDensity = short.r.mul(0.68).add(short.b.mul(0.42)),
    foamCoverage = crest.mul(0.74).add(swash.mul(0.62)).clamp(0, 1),
    lace = smoothstep(float(1).sub(foamCoverage), float(1.12).sub(foamCoverage), foamDensity),
    bubbles = texture(noise, wp.div(2.4).add(vec2(clock.mul(-0.035), clock.mul(0.013)))).r,
    foam = lace.mul(sea).mul(float(1).sub(smoothstep(0.56, 0.78, bubbles).mul(0.72))),
    optical = mix(underwater, reflection, fresnel.mul(mix(0.48, 0.65, sea)))
      .add(color(0xf6eee0).mul(glint));
  material.colorNode = mix(optical, color(0xe5e9df).mul(short.g.mul(0.18).add(0.83)), foam);
  const mesh = new THREE.Mesh(geometry, material); mesh.name = "Jenner estuary and surf";
  mesh.frustumCulled = false; mesh.add(mirror.target); group.add(mesh);

  // Distant ocean has a flat silhouette; optical detail carries subpixel swell.
  const farGeometry = new THREE.PlaneGeometry(10000, 22000);
  farGeometry.rotateX(-Math.PI / 2); farGeometry.translate(-5580, 0, 2500);
  const farMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide }),
    farNormal = normalize(vec3(detail.x.mul(0.35), 1, detail.y.mul(0.35))),
    farRay = reflect(eye.negate(), farNormal),
    farSky = mix(color(0xb1cbd3), color(0x4c8bb4), farRay.y.clamp(0, 1).pow(0.5)),
    farFresnel = pow(float(1).sub(dot(farNormal, eye).clamp(0, 1)), 5),
    farGlint = pow(dot(farNormal, normalize(sun.add(eye))).max(0), 200).mul(0.8);
  farMaterial.colorNode = mix(color(0x154b51), farSky, farFresnel.mul(0.65))
    .add(color(0xf6eee0).mul(farGlint));
  const far = new THREE.Mesh(farGeometry, farMaterial); far.name = "Pacific horizon"; group.add(far);
  group.name = "Jenner coastal water";
  group.userData = { bindingClass: "illustrative", surveyed: false,
    representation: "Authored open-mouth composition; swell, surf, water color and shoreline are not today's measured conditions" };
  return { group, clock, update(seconds, reducedMotion) { clock.value = reducedMotion ? 0 : seconds; } };
}
