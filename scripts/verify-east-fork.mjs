// Focused authored-scene and geographic navigation checks against the built artifact.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createStaticServer } from "./serve.mjs";

const server = createStaticServer(new URL("../dist/", import.meta.url).pathname), errors = [];
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`, out = "/tmp/waterscape-mendocino-review",
  browser = await chromium.launch({ headless: true,
    ...(process.env.RIVER_PULSE_BROWSER ? { executablePath: process.env.RIVER_PULSE_BROWSER } : {}),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
await mkdir(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", error => errors.push(String(error)));
  page.on("response", response => {
    if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { value: undefined }));
  const ready = async () => page.waitForFunction(() => window.eastForkScene && document.querySelector("#loading").hidden, null, { timeout: 90000 });
  const capture = name => page.screenshot({ path: `${out}/${name}.png`, animations: "disabled", timeout: 90000 });
  await page.goto(`${base}/river-pulse/rivers/russian_river/scenes/start/east_fork/index.html`); await ready();
  assert.equal(await page.locator("#error").isVisible(), false);
  const start = await page.evaluate(() => window.eastForkScene.clock.value);
  await page.waitForFunction(start => window.eastForkScene.clock.value > start, start);
  await page.click("#pause");
  const paused = await page.evaluate(() => window.eastForkScene.clock.value);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => window.eastForkScene.clock.value), paused);
  for (const view of ["shore", "outlet"]) {
    await page.click(`[data-view="${view}"]`);
    await page.waitForFunction(view => window.eastForkScene.view === view, view);
    assert.ok(await page.evaluate(async () => {
      const { forkGround, FORK_VIEWS } = await import("./east-fork-layout.js"), s = window.eastForkScene.state, b = FORK_VIEWS[window.eastForkScene.view].bounds;
      return forkGround(s.x, s.z) >= 0.16 && Math.abs(s.y - forkGround(s.x, s.z) - 1.8) < 1e-6 &&
        s.x >= b[0] && s.x <= b[1] && s.z >= b[2] && s.z <= b[3];
    }));
    await capture(view);
  }
  await page.click('[data-view="shore"]');
  await page.locator("#scene").focus(); await page.mouse.move(760, 560);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(-800, 0);
  assert.ok(await page.evaluate(async () => {
    const { forkGround } = await import("./east-fork-layout.js"), s = window.eastForkScene.state;
    return forkGround(s.x, s.z) >= 0.16 && Math.abs(s.y - forkGround(s.x, s.z) - 1.8) < 1e-6;
  }));
  await page.click("#inspect"); assert.match(await page.locator("#inspector").textContent(), /Historical; no current discharge/);
  await page.keyboard.press("Escape"); assert.equal(await page.locator("#inspector").isVisible(), false);
  await page.click("[data-river-map-toggle]");
  await page.waitForFunction(() => window.riverPlaceMap?.places.length === 3);
  assert.equal(await page.locator(".river-pin").count(), 3); await capture("map");
  await page.getByRole("link", { name: "Open Hacienda Bridge", exact: true }).click();
  await page.waitForURL(/hacienda\.html$/);
  await page.waitForFunction(() => window.riverPlaceMap?.places.length === 3);
  assert.equal(await page.locator("#river-place-map").isVisible(), true);
  await capture("hacienda-map");
  await page.getByRole("link", { name: "Open East Fork · Lake Mendocino outflow", exact: true }).click();
  await page.waitForURL(/east-fork\.html$/); await ready();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => window.eastForkScene.clock.value === 0);
  assert.equal(await page.locator("#pause").isDisabled(), true); await capture("mobile");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.click("[data-river-map-toggle]"); await capture("mobile-map");
  await page.getByRole("link", { name: "Open Jenner Estuary", exact: true }).click();
  await page.waitForURL(/jenner\.html$/);
  await page.waitForFunction(() => window.riverPlaceMap?.places.length === 3);
  await page.click("[data-river-map-toggle]");
  assert.equal(await page.getByRole("link", { name: "Open East Fork · Lake Mendocino outflow", exact: true }).isVisible(), true);
  assert.deepEqual(errors, []);
  console.log("East Fork scene, shoreline controls and map navigation passed.");
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
