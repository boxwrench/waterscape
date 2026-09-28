import * as THREE from "../../vendor/three/three.webgpu.js";
import {
  CORRIDOR_DISPLAY_MODES,
  corridorWaterBinding,
} from "../visual-bindings/corridor-water.js";

function centerlineSegments(mapped) {
  const source = mapped?.positions ?? new Float32Array(),
    segments = [];
  for (let i = 0; i + 5 < source.length; i += 6) {
    let a = { x: source[i], y: source[i + 1], z: source[i + 2] },
      b = { x: source[i + 3], y: source[i + 4], z: source[i + 5] };
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (!(length > 0.5)) continue;

    // Flow traces use terrain slope as a visual downstream cue. This does not claim measured velocity.
    if (a.y < b.y) [a, b] = [b, a];
    segments.push({
      a,
      b,
      dx: b.x - a.x,
      dy: b.y - a.y,
      dz: b.z - a.z,
      length,
      yaw: -Math.atan2(b.z - a.z, b.x - a.x),
    });
  }
  return segments;
}

function createRibbon(segments, terrain, { width, lift }) {
  const positions = new Float32Array(segments.length * 4 * 3),
    indices = new Uint32Array(segments.length * 6);

  for (let i = 0; i < segments.length; i++) {
    const v = i * 4,
      k = i * 6;
    indices[k] = v;
    indices[k + 1] = v + 2;
    indices[k + 2] = v + 1;
    indices[k + 3] = v + 2;
    indices[k + 4] = v + 3;
    indices[k + 5] = v + 1;
  }

  const geometry = new THREE.BufferGeometry(),
    attribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute("position", attribute);
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  function setWidth(nextWidth) {
    const half = Math.max(0.5, nextWidth / 2),
      out = attribute.array;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i],
        px = -segment.dz / segment.length,
        pz = segment.dx / segment.length,
        points = [
          [segment.a.x + px * half, segment.a.z + pz * half],
          [segment.a.x - px * half, segment.a.z - pz * half],
          [segment.b.x + px * half, segment.b.z + pz * half],
          [segment.b.x - px * half, segment.b.z - pz * half],
        ],
        offset = i * 12;
      for (let j = 0; j < 4; j++) {
        const x = points[j][0],
          z = points[j][1],
          y = terrain.ground(x, z) + lift,
          o = offset + j * 3;
        out[o] = x;
        out[o + 1] = y;
        out[o + 2] = z;
      }
    }
    attribute.needsUpdate = true;
  }

  setWidth(width);
  geometry.computeBoundingSphere();
  return { geometry, setWidth };
}

function traceInstances(segments, material) {
  const count = Math.min(72, Math.max(18, segments.length)),
    mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 5), material, count),
    assignments = [];
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;

  for (let i = 0; i < count; i++) {
    assignments.push({
      segment: segments[(i * 7) % segments.length],
      phase: (i * 0.61803398875) % 1,
      pulse: (i * 0.37) % (Math.PI * 2),
    });
  }
  return { mesh, assignments };
}

export function createRiverCorridorVisual({
  scene,
  terrain,
  mapped,
  initialMode = CORRIDOR_DISPLAY_MODES.FLOW_WIDTH,
}) {
  const segments = centerlineSegments(mapped);
  if (!segments.length) throw new Error("River corridor requires at least one mapped centerline segment");

  const baseRibbon = createRibbon(segments, terrain, { width: 20, lift: 2.35 }),
    sheenRibbon = createRibbon(segments, terrain, { width: 8, lift: 2.72 }),
    baseMaterial = new THREE.MeshBasicNodeMaterial({
      color: 0x2d99a4,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    sheenMaterial = new THREE.MeshBasicNodeMaterial({
      color: 0x9ce3df,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    traceMaterial = new THREE.MeshBasicNodeMaterial({
      color: 0xc5fbf3,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    }),
    baseMesh = new THREE.Mesh(baseRibbon.geometry, baseMaterial),
    sheenMesh = new THREE.Mesh(sheenRibbon.geometry, sheenMaterial),
    traces = traceInstances(segments, traceMaterial),
    dummy = new THREE.Object3D(),
    pale = new THREE.Color(0xd9fff7);

  baseMesh.frustumCulled = false;
  sheenMesh.frustumCulled = false;
  baseMesh.renderOrder = 2;
  sheenMesh.renderOrder = 3;
  scene.add(baseMesh, sheenMesh, traces.mesh);

  let mode = initialMode,
    state = null,
    condition = null,
    binding = corridorWaterBinding(state, condition, mode);

  function refresh() {
    binding = corridorWaterBinding(state, condition, mode);
    baseRibbon.setWidth(binding.width_m);
    sheenRibbon.setWidth(Math.max(4.5, binding.width_m * 0.38));
    baseMaterial.color.set(binding.color);
    traceMaterial.color.copy(new THREE.Color(binding.color).lerp(pale, 0.55));
    window.riverPulseCorridorBinding = binding;
  }

  function applyState(nextState) {
    state = nextState ?? null;
    refresh();
  }

  function applyCondition(nextCondition) {
    condition = nextCondition ?? null;
    refresh();
  }

  function setMode(nextMode) {
    mode = nextMode;
    refresh();
  }

  function update(timeSeconds) {
    const motionRate = binding.motion_rate ?? 0.2,
      displaySpeed = 12 + 38 * motionRate,
      shimmer = 0.15 + 0.055 * (0.5 + 0.5 * Math.sin(timeSeconds * 1.7));
    sheenMaterial.opacity = shimmer;

    for (let i = 0; i < traces.assignments.length; i++) {
      const assignment = traces.assignments[i],
        segment = assignment.segment,
        distance = (timeSeconds * displaySpeed + assignment.phase * segment.length) % segment.length,
        t = distance / segment.length,
        pulse = 0.88 + 0.18 * Math.sin(timeSeconds * 2.4 + assignment.pulse);
      dummy.position.set(
        segment.a.x + segment.dx * t,
        segment.a.y + segment.dy * t + 3.2,
        segment.a.z + segment.dz * t,
      );
      dummy.rotation.set(0, segment.yaw, 0);
      dummy.scale.set(4.8 * pulse, 0.28, 0.9 * pulse);
      dummy.updateMatrix();
      traces.mesh.setMatrixAt(i, dummy.matrix);
    }
    traces.mesh.instanceMatrix.needsUpdate = true;
  }

  refresh();

  return Object.freeze({
    applyState,
    applyCondition,
    setMode,
    update,
    get binding() {
      return binding;
    },
    get mode() {
      return mode;
    },
    representation:
      "Illustrative river corridor draped to terrain; width, color, and motion are visual mappings rather than measured banks, depth, stage, or local velocity.",
  });
}
