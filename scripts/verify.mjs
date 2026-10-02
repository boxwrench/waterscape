import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createStaticServer } from "./serve.mjs";
await mkdir("previews", { recursive: true });
// Reservoir grids come from the bundle at runtime, never from shader constants.
const cudaSource = await readFile("renderer/water.cu", "utf8");
assert.ok(!/#define TERRAIN_/.test(cudaSource), "shader must not hard-code a terrain grid");
const server = createStaticServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  channel: "msedge",
  headless: false,
  args: ["--enable-unsafe-webgpu"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  // The main suite pins today's settings; automatic quality has its own checks below.
  await page.goto(`${base}/renderer/explore.html?quality=high`);
  await page.waitForFunction(
    () =>
      window.waterscapeDiagnostics?.ready ||
      window.waterscapeDiagnostics?.errors.length,
    {},
    { timeout: 120000 },
  );
  let diag = await page.evaluate(() => window.waterscapeDiagnostics);
  assert.deepEqual(diag.errors, []);
  await page.waitForFunction(() => window.waterscapeDiagnostics.frames >= 20);
  const noReadback = await page.evaluate(
    () => window.waterscapeDiagnostics.readbackBytes,
  );
  assert.equal(noReadback, 0, "render loop must stay GPU resident");
  // Lighting comes from a preset (the bundle's default: golden hour).
  assert.equal(await page.evaluate(() => window.waterscapeDiagnostics.preset), "golden");
  // Hills open summer gold (the bundle's defaultSeason).
  assert.equal(await page.locator("#season").inputValue(), "1");
  await page.selectOption("#preset", "midday");
  assert.equal(await page.evaluate(() => window.waterscapeDiagnostics.preset), "midday");
  await page.selectOption("#preset", "golden");
  const model = await page.evaluate(() => {
    const { terrain, viewpoints: v } = window.waterscapeModel;
    return {
      center: terrain.shoreDistance(0, 0),
      overlook: terrain.shoreDistance(v.overlook.x, v.overlook.z),
      ridge: terrain.shoreDistance(v.ridge.x, v.ridge.z),
      shoreline: terrain.shoreDistance(v.shore.x, v.shore.z),
      waterLevel: terrain.waterLevel,
      overlookElevation: terrain.elevation(terrain.ground(v.overlook.x, v.overlook.z)),
      centerLatLon: terrain.latLon(0, 0),
    };
  });
  assert.ok(
    // Shoreline stands on the bank a step back from the real (1 m) waterline.
    model.center < 0 && model.overlook > 0 && model.ridge > 0 && Math.abs(model.shoreline) < 4,
    JSON.stringify(model),
  );
  // Lidar reservoir surface and a centre point that is actually on Calaveras Reservoir.
  assert.ok(model.waterLevel > 180 && model.waterLevel < 240, JSON.stringify(model));
  const [lat, lon] = model.centerLatLon;
  assert.ok(Math.abs(lat - 37.47) < 0.03 && Math.abs(lon + 121.82) < 0.03, JSON.stringify(model));
  // Viewpoint buttons come from the bundle's cameras.json.
  const presets = await page.$$eval("[data-preset]", (b) =>
    b.map((x) => [x.dataset.preset, x.textContent]),
  );
  assert.deepEqual(presets, [
    ["overlook", "North ridge"],
    ["ridge", "West ridge"],
    ["shore", "Shoreline"],
  ]);
  await page.evaluate(() => window.waterscapeLab.seek(5));
  await page.screenshot({ path: "previews/calaveras-ui.png" });
  await page.locator("#toggle").click();
  await page.screenshot({ path: "previews/calaveras-overlook.png" });
  const fft = await page.evaluate(() => window.waterscapeLab.fftTest());
  assert.ok(
    fft.maxError < 5e-5 && fft.roundtripError < 2e-5,
    JSON.stringify(fft),
  );
  const optics = await page.evaluate(() =>
    window.waterscapeLab.inspectOptics(),
  );
  assert.ok(optics.hdrFinite && optics.glareFinite);
  for (const v of optics.causticMean) assert.ok(Math.abs(v - 1) < 0.03);
  for (const v of optics.psfEnergy) assert.ok(Math.abs(v - 1) < 1e-4);
  const first = await page.evaluate(() => window.waterscapeLab.inspect());
  assert.ok(first.finite && first.rms > 0.001);
  await page.locator("#toggle").click();
  await page.locator('[data-preset="shore"]').click();
  await page.waitForTimeout(300);
  await page.locator("#toggle").click();
  await page.screenshot({ path: "previews/calaveras-shoreline.png" });
  await page.evaluate(() => window.waterscapeLab.resume());
  // Open water above the strip of bank at the bottom of the Shoreline view.
  await page.mouse.click(910, 520);
  await page.waitForTimeout(150);
  const ripple = await page.evaluate(() => window.waterscapeLab.inspect());
  assert.ok(ripple.ripplePeak > 0.00001, "tap must generate ripples");
  const shoreX = await page.evaluate(() => window.waterscapeLab.state.x);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(400);
  await page.keyboard.up("KeyW");
  // The shoreline view looks east, so flying forward increases x.
  assert.ok((await page.evaluate(() => window.waterscapeLab.state.x)) > shoreX + 0.1);
  await page.waitForTimeout(300);
  const readout = await page.evaluate(() => ({
    camera: document.getElementById("elevCamera").textContent,
    position: document.getElementById("elevPosition").textContent,
    water: document.getElementById("waterLevel").textContent,
    link: document.getElementById("dataLink").href,
  }));
  assert.match(readout.camera, /m · .* ft/, JSON.stringify(readout));
  assert.match(readout.position, /°.*N .*°.*W/, JSON.stringify(readout));
  assert.match(readout.link, /elevation\.nationalmap\.gov/, JSON.stringify(readout));
  await page.evaluate(() => {
    window.waterscapeLab.state.x = 10000;
    window.waterscapeLab.state.z = -10000;
  });
  await page.waitForTimeout(500);
  const distant = await page.evaluate(() => window.waterscapeLab.inspect());
  assert.ok(distant.finite);
  await page.locator("#toggle").click();
  await page.locator('[data-preset="overlook"]').click();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.waterscapeLab.seek(20));
  await page.locator("#toggle").click();
  await page.screenshot({ path: "previews/calaveras-late-water.png" });
  const overlook = await page.evaluate(() => window.waterscapeLab.inspect());
  assert.ok(overlook.finite);
  diag = await page.evaluate(() => window.waterscapeDiagnostics);
  assert.deepEqual(diag.errors, []);
  assert.deepEqual(errors, []);
  await page.locator("#toggle").click();
  await page.locator("#quality").selectOption("768");
  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForFunction(
    () =>
      window.waterscapeDiagnostics.width === 768 &&
      window.waterscapeDiagnostics.height === 600,
  );
  await page.locator("#view").selectOption("1");
  await page.waitForTimeout(100);
  await page.locator("#view").selectOption("2");
  await page.waitForTimeout(100);
  await page.locator("#view").selectOption("0");
  await page.locator("#season").selectOption("0");
  await page.waitForTimeout(100);
  await page.locator("#season").selectOption("1");
  await page.locator("#glare").uncheck();
  await page.waitForTimeout(100);
  await page.locator("#glare").check();
  const timeBefore = await page.evaluate(() => window.waterscapeLab.state.time);
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => window.waterscapeLab.state.time),
    timeBefore,
  );
  await page.locator("#reset").click();
  assert.equal(await page.evaluate(() => window.waterscapeLab.state.x), -1500);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#capture").click(),
  ]);
  assert.equal(download.suggestedFilename(), "Calaveras-Reservoir.png");
  await download.saveAs("previews/export.png");
  assert.deepEqual(errors, []);
  assert.deepEqual(
    await page.evaluate(() => window.waterscapeDiagnostics.errors),
    [],
  );
  const embed = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await embed.goto(
    `${base}/renderer/explore.html?reservoir=calaveras&embed=1&pose=-1200,420,-2600,2.5,-0.1`,
  );
  await embed.evaluate(() => {
    window.frameMessages = [];
    addEventListener("message", (e) => window.frameMessages.push(e.data));
  });
  await embed.waitForFunction(() => window.waterscapeDiagnostics?.ready, null, {
    timeout: 120000,
  });
  await embed.waitForFunction(() => window.frameMessages.length > 0, null, {
    timeout: 30000,
  });
  const embedState = await embed.evaluate(() => ({
    header: getComputedStyle(document.querySelector("header")).display,
    panel: getComputedStyle(document.getElementById("panel")).display,
    x: window.waterscapeLab.state.x,
    z: window.waterscapeLab.state.z,
    message: window.frameMessages[0],
  }));
  assert.equal(embedState.header, "none");
  assert.equal(embedState.panel, "none");
  assert.ok(Math.abs(embedState.x + 1200) < 1 && Math.abs(embedState.z + 2600) < 1, JSON.stringify(embedState));
  assert.equal(embedState.message.type, "waterscape:frame");
  assert.equal(embedState.message.reservoir, "calaveras");
  assert.equal(typeof embedState.message.tier, "number");
  assert.equal(typeof embedState.message.struggling, "boolean");
  await embed.close();
  // Land comes from three.js on the runtime's own device.
  const land = await page.evaluate(() => window.waterscapeDiagnostics.land);
  assert.equal(land?.shared, true, JSON.stringify(land));
  // Resolution changes resize the land pass with the frame buffers (Review Focus 1).
  const before = await page.evaluate(() => window.waterscapeDiagnostics.frames);
  await page.selectOption("#quality", "768");
  await page.waitForFunction((n) => window.waterscapeDiagnostics.frames > n + 10, before);
  await page.selectOption("#quality", "1152");
  // Far outside the lidar crop the sky and far ridges still render (Review Focus 2).
  await page.evaluate(() => Object.assign(window.waterscapeLab.state, { x: 20000, z: 20000, y: 400 }));
  const far = await page.evaluate(() => window.waterscapeDiagnostics.frames);
  await page.waitForFunction((n) => window.waterscapeDiagnostics.frames > n + 5, far);
  assert.deepEqual(await page.evaluate(() => window.waterscapeDiagnostics.errors), []);
  // The main page's checks are done; close it so it doesn't share the GPU with the timed pages below.
  await page.close();
  // Forced tiers render and report themselves; low meets its frame budget at 768 px.
  const tiers = {};
  for (const [name, tier] of [["low", 0], ["medium", 1], ["high", 2]]) {
    const tp = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await tp.goto(`${base}/renderer/explore.html?quality=${name}`);
    await tp.waitForFunction(() => window.waterscapeDiagnostics?.ready, null, { timeout: 120000 });
    const q = await tp.evaluate(() => window.waterscapeDiagnostics.quality);
    assert.equal(q.tier, tier, JSON.stringify(q));
    assert.equal(await tp.evaluate(() => window.waterscapeLab.state.quality), tier);
    if (name === "low") {
      // The budget is timed at the overlook; the page opens at the shoreline, where the water
      // fills most of the frame and costs more.
      await tp.locator('[data-preset="overlook"]').click();
      await tp.selectOption("#quality", "768");
      await tp.waitForFunction(() => window.waterscapeDiagnostics.width === 768);
      await tp.waitForTimeout(1500);
      const samples = [];
      for (let i = 0; i < 40; i++) {
        samples.push(await tp.evaluate(() => window.waterscapeDiagnostics.frameMs));
        await tp.waitForTimeout(50);
      }
      samples.sort((a, b) => a - b);
      tiers.lowMedianMs = samples[samples.length >> 1];
      assert.ok(tiers.lowMedianMs <= 33, `low tier median ${tiers.lowMedianMs} ms > 33 ms at 768 px`);
    }
    await tp.close();
  }

  // Automatic quality: on by default, starts from the vendor, off after a manual resolution pick.
  const auto = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await auto.goto(`${base}/renderer/explore.html`);
  await auto.waitForFunction(() => window.waterscapeDiagnostics?.ready, null, { timeout: 120000 });
  const autoStart = await auto.evaluate(() => ({ ...window.waterscapeDiagnostics.quality }));
  assert.equal(autoStart.auto, true, JSON.stringify(autoStart));
  assert.equal(autoStart.tier, autoStart.vendor === "nvidia" ? 2 : 1, JSON.stringify(autoStart));
  assert.equal(typeof autoStart.struggling, "boolean");
  await auto.selectOption("#quality", "1536");
  assert.equal(await auto.evaluate(() => window.waterscapeDiagnostics.quality.auto), false);
  await auto.close();
  // GPU chip everywhere in 3D; the tip on Intel (the test browser's default GPU) until dismissed.
  const gpu = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await gpu.goto(`${base}/renderer/explore.html?embed=1`);
  await gpu.evaluate(() => localStorage.removeItem("waterscape.gpuTipDismissed"));
  await gpu.reload();
  await gpu.waitForFunction(() => window.waterscapeDiagnostics?.ready, null, { timeout: 120000 });
  await gpu.waitForFunction(() => document.getElementById("gpuChip").textContent.includes("·"));
  const gpuState = await gpu.evaluate(() => ({
    chip: document.getElementById("gpuChip").textContent,
    shown: getComputedStyle(document.getElementById("gpu")).display !== "none",
    tip: !document.getElementById("gpuTip").hidden,
    vendor: window.waterscapeDiagnostics.quality.vendor,
    tier: window.waterscapeDiagnostics.quality.tier,
  }));
  assert.ok(gpuState.shown, "chip visible in embed mode");
  assert.ok(gpuState.chip.includes(gpuState.vendor), JSON.stringify(gpuState));
  assert.equal(gpuState.tip, gpuState.vendor === "intel" || gpuState.tier === 0, JSON.stringify(gpuState));
  if (gpuState.tip) {
    assert.match(await gpu.textContent("#gpuTip"), /Running on integrated graphics/);
    assert.match(await gpu.textContent("#gpuTip"), /chrome:\/\/flags/);
    await gpu.click("#gpuTipDismiss");
    assert.equal(await gpu.evaluate(() => document.getElementById("gpuTip").hidden), true);
    await gpu.reload();
    await gpu.waitForFunction(() => window.waterscapeDiagnostics?.ready, null, { timeout: 120000 });
    assert.equal(await gpu.evaluate(() => document.getElementById("gpuTip").hidden), true, "dismissal remembered");
  }
  await gpu.evaluate(() => localStorage.removeItem("waterscape.gpuTipDismissed"));
  await gpu.close();
  const result = {
    fft,
    model,
    readout,
    tiers,
    optics,
    noReadback,
    first,
    ripple,
    distant,
    overlook,
    controls: {pause:true,reset:true,viewpoints:true,season:true,resize:true,debugViews:true,glareToggle:true,pngExport:true},
    diagnostics: diag,
    browserErrors: errors,
  };
  await writeFile(
    "previews/verification.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  server.close();
}
