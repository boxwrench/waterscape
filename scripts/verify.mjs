import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("previews", { recursive: true });
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
  await page.goto("http://127.0.0.1:5186/");
  await page.waitForFunction(
    () =>
      window.clearwaterDiagnostics?.ready ||
      window.clearwaterDiagnostics?.errors.length,
    {},
    { timeout: 120000 },
  );
  let diag = await page.evaluate(() => window.clearwaterDiagnostics);
  assert.deepEqual(diag.errors, []);
  await page.waitForFunction(() => window.clearwaterDiagnostics.frames >= 20);
  const noReadback = await page.evaluate(
    () => window.clearwaterDiagnostics.readbackBytes,
  );
  assert.equal(noReadback, 0, "render loop must stay GPU resident");
  const model = await page.evaluate(() => {
    const { terrain, viewpoints: v } = window.calaverasModel;
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
    model.center < 0 && model.overlook > 0 && model.ridge > 0 && model.shoreline < 0,
    JSON.stringify(model),
  );
  // Lidar reservoir surface and a centre point that is actually on Calaveras Reservoir.
  assert.ok(model.waterLevel > 180 && model.waterLevel < 240, JSON.stringify(model));
  const [lat, lon] = model.centerLatLon;
  assert.ok(Math.abs(lat - 37.47) < 0.03 && Math.abs(lon + 121.82) < 0.03, JSON.stringify(model));
  await page.evaluate(() => window.clearwaterLab.seek(5));
  await page.screenshot({ path: "previews/calaveras-ui.png" });
  await page.locator("#toggle").click();
  await page.screenshot({ path: "previews/calaveras-overlook.png" });
  const fft = await page.evaluate(() => window.clearwaterLab.fftTest());
  assert.ok(
    fft.maxError < 5e-5 && fft.roundtripError < 2e-5,
    JSON.stringify(fft),
  );
  const optics = await page.evaluate(() =>
    window.clearwaterLab.inspectOptics(),
  );
  assert.ok(optics.hdrFinite && optics.glareFinite);
  for (const v of optics.causticMean) assert.ok(Math.abs(v - 1) < 0.03);
  for (const v of optics.psfEnergy) assert.ok(Math.abs(v - 1) < 1e-4);
  const first = await page.evaluate(() => window.clearwaterLab.inspect());
  assert.ok(first.finite && first.rms > 0.001);
  await page.locator("#toggle").click();
  await page.locator('[data-preset="shore"]').click();
  await page.waitForTimeout(300);
  await page.locator("#toggle").click();
  await page.screenshot({ path: "previews/calaveras-shoreline.png" });
  await page.evaluate(() => window.clearwaterLab.resume());
  await page.mouse.click(910, 740);
  await page.waitForTimeout(150);
  const ripple = await page.evaluate(() => window.clearwaterLab.inspect());
  assert.ok(ripple.ripplePeak > 0.00001, "tap must generate ripples");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(400);
  await page.keyboard.up("KeyW");
  // The shoreline view looks east, so flying forward increases x.
  assert.ok((await page.evaluate(() => window.clearwaterLab.state.x)) > -739.9);
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
    window.clearwaterLab.state.x = 10000;
    window.clearwaterLab.state.z = -10000;
  });
  await page.waitForTimeout(500);
  const distant = await page.evaluate(() => window.clearwaterLab.inspect());
  assert.ok(distant.finite);
  await page.locator("#toggle").click();
  await page.locator('[data-preset="overlook"]').click();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.clearwaterLab.seek(20));
  await page.locator("#toggle").click();
  await page.screenshot({ path: "previews/calaveras-late-water.png" });
  const overlook = await page.evaluate(() => window.clearwaterLab.inspect());
  assert.ok(overlook.finite);
  diag = await page.evaluate(() => window.clearwaterDiagnostics);
  assert.deepEqual(diag.errors, []);
  assert.deepEqual(errors, []);
  await page.locator("#toggle").click();
  await page.locator("#quality").selectOption("768");
  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForFunction(
    () =>
      window.clearwaterDiagnostics.width === 768 &&
      window.clearwaterDiagnostics.height === 600,
  );
  await page.locator("#view").selectOption("1");
  await page.waitForTimeout(100);
  await page.locator("#view").selectOption("2");
  await page.waitForTimeout(100);
  await page.locator("#view").selectOption("0");
  await page.locator("#season").selectOption("1");
  await page.waitForTimeout(100);
  await page.locator("#season").selectOption("0");
  await page.locator("#glare").uncheck();
  await page.waitForTimeout(100);
  await page.locator("#glare").check();
  const timeBefore = await page.evaluate(() => window.clearwaterLab.state.time);
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => window.clearwaterLab.state.time),
    timeBefore,
  );
  await page.locator("#reset").click();
  assert.equal(await page.evaluate(() => window.clearwaterLab.state.x), -1500);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#capture").click(),
  ]);
  assert.equal(download.suggestedFilename(), "Calaveras-Reservoir.png");
  await download.saveAs("previews/export.png");
  assert.deepEqual(errors, []);
  assert.deepEqual(
    await page.evaluate(() => window.clearwaterDiagnostics.errors),
    [],
  );
  const result = {
    fft,
    model,
    readout,
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
}
