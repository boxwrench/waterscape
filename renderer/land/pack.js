// Turns three.js's land render (colour + depth) into the float4-per-pixel buffer the water
// kernel reads: rgb = colour, w = -(distance along the pixel's camera ray), 0 where no land.
// Grass (colour alpha < 0.5) is marked by pushing w a million metres further (past any real
// distance); the kernel then skips the procedural tree crowns for that pixel.
// The ray matches ray() in water.cu (vertical half-FOV atan(0.62487)).
const WGSL = /* wgsl */ `
@group(0) @binding(0) var colorTex: texture_2d<f32>;
@group(0) @binding(1) var depthTex: texture_depth_2d;
@group(0) @binding(2) var<storage, read_write> land: array<vec4f>;
struct Params { width: u32, height: u32, near: f32, far: f32 }
@group(0) @binding(3) var<uniform> p: Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= p.width || id.y >= p.height) { return; }
  let d = textureLoad(depthTex, vec2i(id.xy), 0);
  let c = textureLoad(colorTex, vec2i(id.xy), 0);
  var w = 0.0;
  if (d < 1.0) {
    // WebGPU depth in [0, 1], not reversed: view depth, then distance along the ray.
    let zv = p.near * p.far / (p.far - d * (p.far - p.near));
    let sx = 2.0 * (f32(id.x) + 0.5) / f32(p.width) - 1.0;
    let sy = 1.0 - 2.0 * (f32(id.y) + 0.5) / f32(p.height);
    let a = f32(p.width) / f32(p.height);
    let len = sqrt(1.0 + (sx * a * 0.62487) * (sx * a * 0.62487) + (sy * 0.62487) * (sy * 0.62487));
    w = -zv * len - select(0.0, 1.0e6, c.a < 0.5);
  }
  land[id.y * p.width + id.x] = vec4f(c.rgb, w);
}`;

export function createPack(device) {
  const pipeline = device.createComputePipeline({
      label: "land pack",
      layout: "auto",
      compute: { module: device.createShaderModule({ code: WGSL }), entryPoint: "main" },
    }),
    params = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
    words = new ArrayBuffer(16);
  return {
    run(colorTexture, depthTexture, gpuBuffer, width, height, near, far) {
      new Uint32Array(words, 0, 2).set([width, height]);
      new Float32Array(words, 8, 2).set([near, far]);
      device.queue.writeBuffer(params, 0, words);
      // three.js may recreate its textures on resize, so bind them fresh each frame.
      const bind = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: colorTexture.createView() },
            { binding: 1, resource: depthTexture.createView() },
            { binding: 2, resource: { buffer: gpuBuffer } },
            { binding: 3, resource: { buffer: params } },
          ],
        }),
        enc = device.createCommandEncoder({ label: "land pack" }),
        pass = enc.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind);
      pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
      pass.end();
      device.queue.submit([enc.finish()]);
    },
  };
}
