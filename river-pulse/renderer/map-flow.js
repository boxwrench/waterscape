import * as THREE from "../../vendor/three/three.webgpu.js";
import {
  attribute, cameraPosition, color, cos, dot, exp, float, fwidth, mix, normalize,
  positionWorld, pow, reflect, sin, smoothstep, uniform, vec3,
} from "../../vendor/three/three.tsl.js";
import { mapRibbonBinding } from "../visual-bindings/map-flow.js";
import { buildMapRibbonSkeleton, mapRibbonPositions } from "./map-ribbon-geometry.js";

export function createMapFlow(document, terrain) {
  const skeleton = buildMapRibbonSkeleton(document), geometry = new THREE.BufferGeometry();
  let state = null, history = null, binding = mapRibbonBinding(state, history), width = binding.width;
  const positions = new THREE.BufferAttribute(mapRibbonPositions(skeleton, terrain, width), 3);
  positions.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positions);
  geometry.setAttribute("flowDistance", new THREE.BufferAttribute(skeleton.distances, 1));
  geometry.setAttribute("flowAcross", new THREE.BufferAttribute(skeleton.across, 1));
  geometry.setAttribute("flowTangent", new THREE.BufferAttribute(skeleton.tangents, 2));
  geometry.setIndex(new THREE.BufferAttribute(skeleton.indices, 1));
  geometry.computeBoundingSphere();

  const clock = uniform(0), displayWidth = uniform(width), known = uniform(0),
    borderColor = uniform(new THREE.Color(0x8c9894)), borderOpacity = uniform(0.5),
    along = attribute("flowDistance", "float"), across = attribute("flowAcross", "float"),
    tangent = attribute("flowTangent", "vec2"), cross = across.mul(displayWidth).mul(0.5);
  let longitudinal = float(0), lateral = float(0), sparkle = float(0);
  // Meter-scale ripples are deliberately magnified for the overhead view. Their
  // speed is a presentation choice; gauge discharge controls width, not velocity.
  for (let i = 0; i < 5; i++) {
    const a = 0.3 + i * 0.12, b = i % 2 ? -0.31 : 0.24,
      phase = along.mul(a).add(cross.mul(b)).sub(clock.mul(1.2 + i * 0.21)).add(i * 2.1),
      filtered = exp(fwidth(phase).mul(-0.7)), wave = cos(phase).mul(0.15).mul(filtered);
    longitudinal = longitudinal.add(wave);
    lateral = lateral.add(wave.mul(i % 2 ? -0.65 : 0.7));
    sparkle = sparkle.add(pow(sin(phase).mul(0.5).add(0.5), 9).mul(filtered).mul(0.055));
  }
  const normal = normalize(vec3(tangent.x.mul(longitudinal).sub(tangent.y.mul(lateral)), 1,
      tangent.y.mul(longitudinal).add(tangent.x.mul(lateral)))),
    eye = normalize(cameraPosition.sub(positionWorld)), facing = dot(normal, eye).clamp(0, 1),
    fresnel = pow(float(1).sub(facing), 5).mul(0.98).add(0.02),
    reflected = reflect(eye.negate(), normal),
    sky = mix(color(0x647d67), color(0x8ec2d7), reflected.y.clamp(0, 1)),
    body = mix(color(0x234f4a), color(0x42796c), across.abs().pow(2)),
    sun = normalize(vec3(-0.5, 0.83, 0.25)),
    glint = pow(dot(normal, normalize(sun.add(eye))).max(0), 70).mul(0.7),
    rippled = mix(body, sky, fresnel.mul(0.65)).add(color(0xb6d6cc).mul(sparkle.add(glint))),
    water = mix(color(0x586c67), rippled, known),
    rim = smoothstep(0.83, 0.92, across.abs()),
    material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  material.colorNode = mix(water, borderColor.mul(borderOpacity.mul(0.35).add(0.65)), rim);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Map river flow";
  mesh.userData = { bindingClass: "illustrative", moving: false, displayWidth: width,
    representation: "Water-like map ribbon: width follows selected gauge discharge, border shows seasonal condition; exaggerated ripples are not measured waves, velocity, direction, banks or stage" };

  function refresh() {
    binding = mapRibbonBinding(state, history);
    mesh.userData.moving = binding.moving;
    mesh.userData.binding = binding;
    known.value = binding.availability === "present" ? 1 : 0;
  }
  refresh();
  return { mesh, applyState(next) { state = next; refresh(); },
    applyHistory(next) { history = next; refresh(); },
    setColor(value, opacity = 1) { borderColor.value.setHex(value); borderOpacity.value = opacity; },
    get binding() { return binding; },
    get animationTime() { return clock.value; },
    update(seconds, reducedMotion) {
      clock.value = reducedMotion || !binding.moving ? 0 : seconds;
      mesh.userData.reducedMotion = reducedMotion;
      // Ease the visual width only; the scientific selection updates immediately.
      const difference = binding.width - width;
      if (Math.abs(difference) > 0.01) {
        width += difference * (reducedMotion ? 1 : 0.15);
        mapRibbonPositions(skeleton, terrain, width, positions.array);
        positions.needsUpdate = true;
        displayWidth.value = width; mesh.userData.displayWidth = width;
        geometry.computeBoundingSphere();
      }
    } };
}
