// The live renderer for one water body: the CUDA WebShader runtime and the kernels of
// renderer/water.cu (FFT waves, ripples, caustics, water, lens glare, bloom), the three.js land
// pass on the same GPUDevice, and the preset light. The page owns input and UI; it keeps
// `settings` in sync with its controls and calls step() once per frame.
import { GpuRuntime } from "../../vendor/cuda-webshader/runtime/runtime.js";
import { PRESETS, choosePreset, presetBuffer } from "./presets.js";
import { createLandPass } from "../land/scene.js";

const WG = [32, 32, 3],
  RG = [32, 32, 1];

export async function createWaterscape(
  canvas,
  body,
  { onError = () => {}, onProgress = () => {}, time = 0, playing = true } = {},
) {
  const rt = await GpuRuntime.create({ onError }),
    terrain = body.terrain,
    state = {
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      pitch: 0,
      speed: 40,
      quality: 2,
      preset: "golden",
      viewpoint: "overlook",
      time,
      playing,
      frames: 0,
    },
    // The page's controls: wave energy, basin depth (m), exposure, debug view, season, glare.
    settings = { energy: 0.38, depth: 18, exposure: 0.8, view: 0, season: 1, glare: true },
    diag = {
      ready: false,
      errors: [],
      state,
      frames: 0,
      cascades: [4.6, 37, 293],
      fftSize: 256,
      location: terrain.meta.name,
      coordinates: terrain.latLon(0, 0),
    },
    ctx = canvas.getContext("webgpu"),
    k = {};
  let seed,
    scales,
    rows,
    fft,
    surface,
    rip,
    ripNormals,
    photons,
    caustics,
    pebbles,
    hdr,
    bloom,
    pixels,
    lensKernel,
    lensFFT,
    landPass = null,
    width = 0,
    height = 0,
    ripIndex = 0,
    centerX = 0,
    centerZ = 0,
    accumulator = 0,
    tap = null,
    pendingWidth = null,
    locked = false;

  const source = await (await fetch(new URL("../water.cu", import.meta.url))).text(),
    terrainCells = rt.createBuffer(terrain.gpuCells()),
    lightBuf = rt.createBuffer(24 * 4);

  // Lighting preset: the shader reads six float4s (sun, radiance, fill, sky, haze, clouds).
  function setPreset(name) {
    state.preset = choosePreset(name, body.land);
    const p = PRESETS[state.preset];
    rt.write(lightBuf, presetBuffer(p));
    settings.exposure = p.exposure;
    diag.preset = state.preset;
    return state.preset;
  }
  setPreset(null);

  // Land from three.js on our device; if it cannot start, keep the traced land.
  try {
    landPass = await createLandPass(rt, terrain);
    diag.land = { shared: landPass.shared, error: null };
  } catch (e) {
    landPass = null;
    diag.land = { shared: false, error: String(e) };
  }

  for (const name of [...source.matchAll(/__global__ void (\w+)/g)].map((m) => m[1])) {
    onProgress(`Compiling ${name.replaceAll("_", " ")}…`);
    k[name] = await rt.kernel(source, {
      entry: name,
      workgroupSize: ["spectrum_rows", "spectrum_norm", "lens_rows"].includes(name)
        ? [64, 1, 1]
        : [8, 8, 1],
    });
  }
  lensKernel = rt.createBuffer(3 * 65536 * 16);
  lensFFT = [rt.createBuffer(3 * 65536 * 16), rt.createBuffer(3 * 65536 * 16)];
  seed = rt.createBuffer(3 * 65536 * 8);
  rows = rt.createBuffer(768 * 4);
  scales = rt.createBuffer(3 * 4);
  fft = [rt.createBuffer(3 * 65536 * 16), rt.createBuffer(3 * 65536 * 16)];
  surface = rt.createBuffer(3 * 65536 * 16);
  rip = [rt.createBuffer(65536 * 16), rt.createBuffer(65536 * 16)];
  ripNormals = rt.createBuffer(65536 * 16);
  photons = rt.createBuffer(512 * 512 * 3 * 4);
  caustics = rt.createBuffer(512 * 512 * 16);
  // Asset decoding only: the source asset is converted to linear floats once.
  const bitmap = await createImageBitmap(
      await (await fetch(new URL("../assets/seabed.jpg", import.meta.url))).blob(),
    ),
    off = new OffscreenCanvas(1024, 1024),
    dc = off.getContext("2d");
  dc.drawImage(bitmap, 0, 0, 1024, 1024);
  const rgba = dc.getImageData(0, 0, 1024, 1024).data,
    linear = new Float32Array(1024 * 1024 * 4);
  for (let i = 0; i < rgba.length; i++) linear[i] = i % 4 === 3 ? 1 : Math.pow(rgba[i] / 255, 2.2);
  pebbles = rt.createBuffer(linear);
  bitmap.close();
  rt.batch()
    .dispatch(k.seed_spectrum.bind({ seed }, { seedValue: 7 }), WG)
    .dispatch(k.spectrum_rows.bind({ seed, rows }), [12, 1, 1])
    .dispatch(k.spectrum_norm.bind({ rows, scales }), [1, 1, 1])
    .submit();
  await rt.idle();
  setupLens();
  await rt.idle();

  async function applyResize() {
    await rt.idle();
    width = pendingWidth;
    pendingWidth = null;
    height = Math.ceil((width * innerHeight) / innerWidth / 8) * 8;
    canvas.width = width;
    canvas.height = height;
    for (const b of [hdr, ...(bloom || []), pixels]) if (b) rt.destroyBuffer(b);
    hdr = rt.createBuffer(width * height * 16);
    bloom = [rt.createBuffer(width * height * 16), rt.createBuffer(width * height * 16)];
    pixels = rt.createBuffer(width * height * 4);
    landPass?.resize(width, height);
    ctx.configure({
      device: rt.device,
      format: "rgba8unorm",
      alphaMode: "opaque",
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    Object.assign(diag, { width, height });
  }
  function waves(batch) {
    batch.dispatch(
      k.evolve_spectrum.bind(
        { seed, scales, output: fft[0] },
        { time: state.time, sea: settings.energy, depth: settings.depth },
      ),
      WG,
    );
    let src = 0;
    for (let axis = 0; axis < 2; axis++)
      for (let p = 1; p < 256; p *= 2) {
        batch.dispatch(
          k.fft_pass.bind({ input: fft[src], output: fft[1 - src] }, { p, axis, sign: 1 }),
          WG,
        );
        src = 1 - src;
      }
    batch.dispatch(k.resolve_surface.bind({ input: fft[src], surface }), WG);
  }
  function ripples(batch, dt) {
    accumulator = Math.min(0.1, accumulator + dt);
    const steps = Math.floor(accumulator * 120);
    accumulator -= steps / 120;
    for (let i = 0; i < steps; i++) {
      const nx = Math.round(state.x * 16) / 16,
        nz = Math.round(state.z * 16) / 16,
        shiftX = Math.round((nx - centerX) * 16),
        shiftZ = Math.round((nz - centerZ) * 16);
      centerX = nx;
      centerZ = nz;
      batch.dispatch(
        k.ripple_step.bind(
          { previous: rip[ripIndex], next: rip[1 - ripIndex] },
          {
            shiftX,
            shiftZ,
            centerX,
            centerZ,
            camX: state.x,
            camZ: state.z,
            camY: state.y,
            yaw: state.yaw,
            pitch: state.pitch,
            aspect: width / height,
            tapX: tap?.[0] || 0,
            tapY: tap?.[1] || 0,
            drop: tap ? 1 : 0,
          },
        ),
        RG,
      );
      tap = null;
      ripIndex = 1 - ripIndex;
    }
    batch.dispatch(k.ripple_normals.bind({ input: rip[ripIndex], output: ripNormals }), RG);
  }
  function transform(batch, pair, sign) {
    let src = 0;
    for (let axis = 0; axis < 2; axis++)
      for (let p = 1; p < 256; p *= 2) {
        batch.dispatch(
          k.fft_pass.bind({ input: pair[src], output: pair[1 - src] }, { p, axis, sign }),
          WG,
        );
        src = 1 - src;
      }
    return pair[src];
  }
  function setupLens() {
    const batch = rt.batch();
    batch.dispatch(k.lens_aperture.bind({ output: lensFFT[0] }), WG);
    transform(batch, lensFFT, -1);
    batch
      .dispatch(k.lens_power.bind({ amplitude: lensFFT[0], psf: lensFFT[1] }), WG)
      .dispatch(k.lens_rows.bind({ psf: lensFFT[1], sums: rows }), [12, 1, 1])
      .dispatch(k.lens_normalize.bind({ psf: lensFFT[1], sums: rows, output: lensFFT[0] }), WG);
    transform(batch, lensFFT, -1);
    batch.submit();
    const enc = rt.device.createCommandEncoder();
    enc.copyBufferToBuffer(lensFFT[0].gpuBuffer, 0, lensKernel.gpuBuffer, 0, 3 * 65536 * 16);
    rt.device.queue.submit([enc.finish()]);
  }
  function render() {
    landPass?.render(state);
    const batch = rt.batch(),
      grid = [width / 8, height / 8, 1];
    batch
      .dispatch(k.clear_caustics.bind({ photons }), [64, 64, 1])
      .dispatch(
        k.trace_caustics.bind({ surface, photons, light: lightBuf }, { depth: settings.depth }),
        [128, 128, 1],
      )
      .dispatch(k.filter_caustics.bind({ photons, caustics }), [64, 64, 1]);
    batch.dispatch(
      k.render_water.bind(
        {
          surface,
          rip: ripNormals,
          caustics,
          pebbles,
          terrain: terrainCells,
          light: lightBuf,
          land: landPass ? landPass.buffer : terrainCells,
          hdr,
        },
        {
          width,
          height,
          camX: state.x,
          camZ: state.z,
          camY: state.y,
          yaw: state.yaw,
          pitch: state.pitch,
          centerX,
          centerZ,
          depth: settings.depth,
          time: state.time,
          view: settings.view,
          season: settings.season,
          quality: state.quality,
          landPass: landPass ? 1 : 0,
        },
      ),
      grid,
    );
    if (settings.glare) {
      batch.dispatch(k.glare_source.bind({ hdr, output: lensFFT[0] }, { width, height }), WG);
      transform(batch, lensFFT, -1);
      batch.dispatch(
        k.glare_multiply.bind({ input: lensFFT[0], kernel: lensKernel, output: lensFFT[1] }),
        WG,
      );
      transform(batch, [lensFFT[1], lensFFT[0]], 1);
    }
    batch
      .dispatch(k.bloom_pass.bind({ input: hdr, output: bloom[0] }, { width, height, axis: 0 }), grid)
      .dispatch(k.bloom_pass.bind({ input: bloom[0], output: bloom[1] }, { width, height, axis: 1 }), grid)
      .dispatch(
        k.present.bind(
          { hdr, bloom: bloom[1], diffraction: lensFFT[1], image: pixels },
          { width, height, exposure: settings.exposure, glare: settings.glare ? 1 : 0 },
        ),
        grid,
      )
      .submit();
    const enc = rt.device.createCommandEncoder();
    enc.copyBufferToTexture(
      { buffer: pixels.gpuBuffer, bytesPerRow: width * 4, rowsPerImage: height },
      { texture: ctx.getCurrentTexture() },
      [width, height],
    );
    rt.device.queue.submit([enc.finish()]);
  }
  // One frame: advance time, simulate, draw, wait for the GPU. Returns the frame's GPU time.
  async function step(dt) {
    if (pendingWidth !== null) await applyResize();
    const start = performance.now();
    if (state.playing) state.time += dt;
    const batch = rt.batch();
    waves(batch);
    ripples(batch, state.playing ? dt : 0);
    batch.submit();
    render();
    await rt.idle();
    diag.frameMs = performance.now() - start;
    diag.frames = ++state.frames;
    diag.ready = true;
    diag.readbackBytes = rt.stats.readbackBytes;
    return diag.frameMs;
  }
  // Readbacks for tests and exports, outside the frame loop.
  async function exclusive(fn) {
    locked = true;
    try {
      await rt.idle();
      return await fn();
    } finally {
      locked = false;
    }
  }
  const lab = {
    async inspect() {
      return exclusive(async () => {
        const a = await rt.read(surface),
          r = await rt.read(rip[ripIndex]);
        let min = Infinity,
          max = -Infinity,
          sum = 0,
          finite = true,
          ripplePeak = 0;
        for (let i = 0; i < a.length; i++) {
          finite &&= Number.isFinite(a[i]);
          if (i % 4 === 0) {
            min = Math.min(min, a[i]);
            max = Math.max(max, a[i]);
            sum += a[i] * a[i];
          }
        }
        for (let i = 0; i < r.length; i += 4) ripplePeak = Math.max(ripplePeak, Math.abs(r[i]));
        return {
          finite,
          min,
          max,
          rms: Math.sqrt(sum / (3 * 65536)),
          ripplePeak,
          adapter: rt.describe(),
          errors: diag.errors,
          stats: { ...rt.stats },
        };
      });
    },
    async seek(t) {
      return exclusive(async () => {
        state.time = t;
        state.playing = false;
        const b = rt.batch();
        waves(b);
        b.submit();
        render();
        await rt.idle();
      });
    },
    async fftTest() {
      return exclusive(async () => {
        const n = 256,
          data = new Float32Array(n * n * 3 * 4);
        const modes = [
          { x: 1, z: 0, re: 0.5, im: 0, c: 0, f: 0 },
          { x: 255, z: 0, re: 0.5, im: 0, c: 0, f: 0 },
          { x: 3, z: 7, re: 0.3, im: -0.2, c: 1, f: 0 },
          { x: 11, z: 253, re: -0.4, im: 0.15, c: 2, f: 2 },
          { x: 51, z: 89, re: 0.07, im: 0.11, c: 0, f: 2 },
        ];
        for (const m of modes) {
          const i = (m.c * n * n + m.z * n + m.x) * 4 + m.f;
          data[i] = m.re;
          data[i + 1] = m.im;
        }
        const a = rt.createBuffer(data),
          b = rt.createBuffer(data.byteLength),
          batch = rt.batch();
        transform(batch, [a, b], 1);
        batch.submit();
        const out = await rt.read(a);
        let maxError = 0;
        for (let c = 0; c < 3; c++)
          for (let z = 0; z < n; z++)
            for (let x = 0; x < n; x++)
              for (let f = 0; f < 4; f += 2) {
                let re = 0,
                  im = 0;
                for (const m of modes) {
                  if (m.c !== c || m.f !== f) continue;
                  const angle = (2 * Math.PI * (m.x * x + m.z * z)) / n;
                  re += m.re * Math.cos(angle) - m.im * Math.sin(angle);
                  im += m.re * Math.sin(angle) + m.im * Math.cos(angle);
                }
                const id = (c * n * n + z * n + x) * 4 + f;
                maxError = Math.max(maxError, Math.abs(out[id] - re), Math.abs(out[id + 1] - im));
              }
        const back = rt.batch();
        transform(back, [a, b], -1);
        back.submit();
        const round = await rt.read(a);
        let roundtripError = 0;
        for (let i = 0; i < data.length; i++)
          roundtripError = Math.max(roundtripError, Math.abs(round[i] / (n * n) - data[i]));
        rt.destroyBuffer(a);
        rt.destroyBuffer(b);
        return { maxError, roundtripError, modes: modes.length, axes: 2, cascades: 3, complexFields: 2 };
      });
    },
    async inspectOptics() {
      return exclusive(async () => {
        const ca = await rt.read(caustics),
          im = await rt.read(hdr),
          psf = await rt.read(lensKernel),
          gl = await rt.read(lensFFT[1]);
        const means = [0, 0, 0];
        for (let i = 0; i < ca.length; i += 4)
          for (let c = 0; c < 3; c++) means[c] += ca[i + c] / (512 * 512);
        return {
          causticMean: means,
          hdrFinite: im.every(Number.isFinite),
          glareFinite: gl.every(Number.isFinite),
          psfEnergy: [0, 1, 2].map((c) => psf[c * 65536 * 4] * 65536),
        };
      });
    },
    // The presented frame as RGBA bytes (for PNG export).
    async readPixels() {
      return exclusive(async () => ({ data: await rt.read(pixels, Uint32Array), width, height }));
    },
  };

  return {
    rt,
    state,
    settings,
    diag,
    lab,
    setPreset,
    step,
    // Render at `w` pixels wide from the next frame (height follows the window's aspect).
    resize(w) {
      pendingWidth = w;
    },
    // Drop a ripple at screen coordinates in [-1, 1].
    tap(sx, sy) {
      tap = [sx, sy];
    },
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get locked() {
      return locked;
    },
  };
}
