// Land pass: three.js draws the lidar terrain on the CUDA WebShader runtime's own GPUDevice,
// then pack.js hands the water kernel a per-pixel land distance. Foundation only: the land's
// colour is still shaded by the kernel (terrainShade), so the mesh material is plain black.
import * as THREE from "../../vendor/three/three.webgpu.js";
import { buildTerrainGrid } from "./terrain-mesh.js";
import { createPack } from "./pack.js";

const NEAR = 1,
  FAR = 40000,
  // Same vertical field of view as ray() in water.cu.
  FOV_Y = (2 * Math.atan(0.62487) * 180) / Math.PI;

export async function createLandPass(rt, terrain) {
  const renderer = new THREE.WebGPURenderer({
    canvas: document.createElement("canvas"),
    device: rt.device,
    antialias: false,
  });
  await renderer.init();
  const shared = renderer.backend.device === rt.device;

  const grid = buildTerrainGrid(terrain),
    geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(grid.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1));
  geometry.computeBoundingSphere();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicNodeMaterial({ color: 0x000000 })));

  const camera = new THREE.PerspectiveCamera(FOV_Y, 1, NEAR, FAR);
  camera.rotation.order = "YXZ";
  const pack = createPack(rt.device);
  let target = null,
    buffer = null,
    width = 0,
    height = 0;

  return {
    shared,
    get buffer() {
      return buffer;
    },
    resize(w, h) {
      width = w;
      height = h;
      target?.dispose();
      target = new THREE.RenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true });
      target.depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
      if (buffer) rt.destroyBuffer(buffer);
      buffer = rt.createBuffer(w * h * 16);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    render(state) {
      // Our yaw turns the forward vector (sin yaw, ., -cos yaw); three's camera looks down -z.
      camera.position.set(state.x, state.y, state.z);
      camera.rotation.set(state.pitch, -state.yaw, 0);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const tex = (t) => renderer.backend.get(t).texture;
      pack.run(tex(target.texture), tex(target.depthTexture), buffer.gpuBuffer, width, height, NEAR, FAR);
    },
  };
}
