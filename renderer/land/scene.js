// Land pass: three.js draws and shades the lidar terrain (ground.js) on the CUDA WebShader
// runtime's own GPUDevice, then pack.js hands the water kernel each pixel's colour and land
// distance. The kernel adds trees, haze and water (landPass 2).
import * as THREE from "../../vendor/three/three.webgpu.js";
import { buildTerrainGrid } from "./terrain-mesh.js";
import { createPack } from "./pack.js";
import { createGroundMaterial } from "./ground.js";
import { createGrass } from "./grass.js";
import { createTrees } from "./trees.js";

const NEAR = 1,
  FAR = 40000,
  // Same vertical field of view as ray() in water.cu.
  FOV_Y = (2 * Math.atan(0.62487) * 180) / Math.PI;

export async function createLandPass(rt, terrain, { biome, biomeBase }) {
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
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const ground = createGroundMaterial(terrain, biomeBase, biome),
    scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, ground.material));
  const grass = createGrass(terrain, ground.terrainTex, ground.lightTex, ground.uniforms);
  scene.add(grass.mesh);
  let grassTier = -1;
  // Oak meshes near the camera (none if the biome has no baked trees).
  const trees = await createTrees(terrain, biome, biomeBase, ground);
  if (trees) scene.add(trees.group);
  let season = 1;
  renderer.initTexture(ground.lightTex);

  const camera = new THREE.PerspectiveCamera(FOV_Y, 1, NEAR, FAR);
  camera.rotation.order = "YXZ";
  const pack = createPack(rt.device);
  let target = null,
    buffer = null,
    width = 0,
    height = 0;

  return {
    shared,
    // 2: this pass shades the ground; the water kernel adds trees, haze and water.
    mode: 2,
    setLight: ground.setLight,
    setSeason(s) {
      season = s;
      ground.setSeason(s);
    },
    // Within this distance the oaks are meshes; the kernel draws crowns beyond it.
    get treeRange() {
      return trees ? trees.range : 0;
    },
    // Copy bake_light's output (rows of `stride` float4s) into the ground's light texture.
    updateLight(bakeBuffer, stride) {
      const enc = rt.device.createCommandEncoder({ label: "baked light" });
      enc.copyBufferToTexture(
        { buffer: bakeBuffer.gpuBuffer, bytesPerRow: stride * 16, rowsPerImage: terrain.height },
        { texture: renderer.backend.get(ground.lightTex).texture },
        [terrain.width, terrain.height],
      );
      rt.device.queue.submit([enc.finish()]);
    },
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
      if (state.quality !== grassTier) grass.setTier((grassTier = state.quality));
      grass.update(state);
      trees?.update(state, season);
      camera.position.set(state.x, state.y, state.z);
      camera.rotation.set(state.pitch, -state.yaw, 0);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const tex = (t) => renderer.backend.get(t).texture;
      pack.run(tex(target.texture), tex(target.depthTexture), buffer.gpuBuffer, width, height, NEAR, FAR);
    },
  };
}
