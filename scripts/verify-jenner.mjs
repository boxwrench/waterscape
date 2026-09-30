// Production-artifact smoke test. Observations below are synthetic fixtures only.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createStaticServer } from "./serve.mjs";

const out = "previews/jenner-ui", errors = [], server = createStaticServer(new URL("../dist/", import.meta.url).pathname);
await mkdir(out, { recursive: true });
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/river-pulse/renderer/jenner.html`,
  browser = await chromium.launch({ headless: true,
    ...(process.env.RIVER_PULSE_BROWSER ? { executablePath: process.env.RIVER_PULSE_BROWSER } : {}),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

async function setup(page, { offline = false, noGpu = false } = {}) {
  page.on("pageerror", error => errors.push(String(error)));
  page.on("response", response => {
    if (response.url().includes("127.0.0.1") && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { value: undefined }));
  if (noGpu) await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.route("https://api.waterdata.usgs.gov/**", route => {
    const request = new URL(route.request().url());
    assert.equal(request.searchParams.get("monitoring_location_id"), "USGS-11467270");
    assert.equal(request.searchParams.get("parameter_code"), "63160");
    return route.fulfill({ status: offline ? 503 : 200, contentType: "application/json", body: JSON.stringify({ features: [{
      type: "Feature", id: "TEST-JENNER-BROWSER", geometry: null, properties: {
        monitoring_location_id: "USGS-11467270", parameter_code: "63160", value: "1.23", unit_of_measure: "ft",
        time: new Date(Date.now() - 5 * 60000).toISOString(), approval_status: "Provisional", qualifier: "TEST FLAG",
        time_series_id: "TEST-JENNER-BROWSER",
      },
    }] }) });
  });
  await page.goto(url);
  await page.waitForFunction(() => window.jennerData, null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector("#loading").hidden, null, { timeout: 90000 });
  assert.equal(await page.locator("#level-value").textContent(), offline ? "Unavailable" : "1.23 ft");
  assert.equal(await page.locator("#error").isVisible(), noGpu);
}
async function choose(page, view) {
  await page.click(`[data-view="${view}"]`);
  await page.waitForFunction(view => window.jennerScene.view === view &&
    window.jennerScene.camera.position.x === window.jennerScene.state.x, view);
  assert.equal(await page.locator(`[data-view="${view}"]`).getAttribute("aria-pressed"), "true");
}
async function capture(page, name) {
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 60000, animations: "disabled" });
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1120, height: 760 } });
  await setup(desktop);
  const start = await desktop.evaluate(() => window.jennerScene.water.clock.value);
  await desktop.waitForFunction(start => window.jennerScene.water.clock.value > start, start);
  await desktop.click("#pause");
  const stopped = await desktop.evaluate(() => window.jennerScene.water.clock.value);
  await desktop.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await desktop.evaluate(() => window.jennerScene.water.clock.value), stopped);
  for (const view of ["lookout", "river", "ocean"]) { await choose(desktop, view); await capture(desktop, `${view}-desktop`); }
  // Shore movement must remain dry and bounded at eye height.
  await desktop.locator("#scene").focus(); await desktop.keyboard.down("w");
  await desktop.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await desktop.keyboard.up("w");
  assert.ok(await desktop.evaluate(async () => {
    const { jennerGround, JENNER_VIEWS } = await import("./jenner-layout.js"), s = window.jennerScene.state, b = JENNER_VIEWS.ocean.bounds;
    return s.x >= b[0] && s.x <= b[1] && s.z >= b[2] && s.z <= b[3] && jennerGround(s.x, s.z) >= 0.12 &&
      Math.abs(s.y - jennerGround(s.x, s.z) - 1.8) < 1e-6;
  }));
  await desktop.click("#inspect"); assert.ok((await desktop.locator("#record").textContent()).includes("TEST FLAG"));
  assert.match(await desktop.locator("#inspector").textContent(), /shoreline stays fixed/);
  await desktop.click("#inspect-close"); await desktop.click("#explore");
  assert.ok(await desktop.evaluate(() => document.body.classList.contains("exploring")));
  await capture(desktop, "ocean-explore-desktop");
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await setup(mobile); assert.equal(await mobile.evaluate(() => window.jennerScene.water.clock.value), 0);
  assert.equal(await mobile.locator("#pause").isDisabled(), true);
  await capture(mobile, "lookout-mobile");
  await choose(mobile, "ocean"); await capture(mobile, "ocean-mobile");
  await mobile.click("#explore"); await capture(mobile, "ocean-explore-mobile");
  await mobile.click("#inspect"); assert.ok(await mobile.locator("#inspector").isVisible());
  await capture(mobile, "evidence-mobile");
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.close();

  const outage = await browser.newPage({ viewport: { width: 960, height: 640 }, reducedMotion: "reduce" });
  await setup(outage, { offline: true }); assert.ok(await outage.evaluate(() => !!window.jennerScene));
  assert.match(await outage.locator("#level-time").textContent(), /connection unavailable/); await outage.close();
  const fallback = await browser.newPage({ viewport: { width: 960, height: 640 } });
  await setup(fallback, { noGpu: true }); await fallback.click("#inspect");
  assert.ok((await fallback.locator("#record").textContent()).includes("1.23"));
  assert.match(await fallback.locator("#gauge-source").getAttribute("href"), /11467270/);
  await fallback.close();
  assert.deepEqual(errors, []);
  console.log("Jenner views, motion, mobile, data outage and GPU fallback passed.");
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
