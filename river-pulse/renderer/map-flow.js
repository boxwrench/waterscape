import * as THREE from "../../vendor/three/three.webgpu.js";
import {
  attribute, cameraPosition, color, dot, exp, float, fwidth, mix, mx_noise_vec3,
  normalize, positionWorld, pow, reflect, smoothstep, uniform, vec2, vec3,
} from "../../vendor/three/three.tsl.js";
import { mapRibbonBinding } from "../visual-bindings/map-flow.js";
import { buildMapRibbonSkeleton, mapRibbonPositions } from "./map-ribbon-geometry.js";

export function createMapFlow(document, terrain) {
  const skeleton = buildMapRibbonSkeleton(document), geometry = new THREE.BufferGeometry();
  let state = null, history = null, binding = mapRibbonBinding(state, history), width = binding.width,
    previousUpdate = null;
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
  // Advected, warped noise provides broken surface detail without periodic wave
  // bands or a repeating texture. These scales/speeds are illustrative, not measured.
  const drift = along.sub(clock.mul(4.5)),
    warp = mx_noise_vec3(vec2(drift.mul(0.012), cross.mul(0.028))).xy.mul(1.7),
    broadUV = vec2(drift.mul(0.095), cross.mul(0.065)).add(warp),
    fineUV = vec2(along.sub(clock.mul(6.1)).mul(0.27), cross.mul(0.19))
      .add(warp.mul(0.7)).add(vec2(19.3, 7.1)),
    broad = mx_noise_vec3(broadUV),
    fine = mx_noise_vec3(fineUV).mul(exp(fwidth(fineUV).length().mul(-1.2))),
    slopes = broad.xy.mul(0.85).add(fine.xy.mul(0.38)),
    longitudinal = slopes.x, lateral = slopes.y;
  const normal = normalize(vec3(tangent.x.mul(longitudinal).sub(tangent.y.mul(lateral)), 1,
      tangent.y.mul(longitudinal).add(tangent.x.mul(lateral)))),
    eye = normalize(cameraPosition.sub(positionWorld)), facing = dot(normal, eye).clamp(0, 1),
    fresnel = pow(float(1).sub(facing), 5).mul(0.98).add(0.02),
    reflected = reflect(eye.negate(), normal),
    sky = mix(color(0x547a99), color(0xb2d5e5), reflected.y.clamp(0, 1)),
    body = mix(color(0x205e87), color(0x3c83a4), across.abs().pow(2).mul(0.65)
      .add(broad.z.mul(0.12)).add(0.12).clamp(0, 1)),
    sun = normalize(vec3(-0.5, 0.83, 0.25)),
    glint = pow(dot(normal, normalize(sun.add(eye))).max(0), 45).mul(0.6),
    rippled = mix(body, sky, fresnel.mul(0.85)).add(color(0xc4dfed).mul(glint)),
    water = mix(color(0x586c78), rippled, known),
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
      const elapsed = previousUpdate === null ? 1 / 60 : Math.max(0, Math.min(1, seconds - previousUpdate));
      previousUpdate = seconds;
      clock.value = reducedMotion || !binding.moving ? 0 : seconds;
      mesh.userData.reducedMotion = reducedMotion;
      // Ease the visual width only; scientific selection updates immediately.
      // Elapsed time keeps settling duration consistent on slow software renderers.
      const difference = binding.width - width;
      if (Math.abs(difference) > 0.01) {
        width += difference * (reducedMotion ? 1 : 1 - Math.exp(-9.75 * elapsed));
        mapRibbonPositions(skeleton, terrain, width, positions.array);
        positions.needsUpdate = true;
        displayWidth.value = width; mesh.userData.displayWidth = width;
        geometry.computeBoundingSphere();
      }
    } };
}
