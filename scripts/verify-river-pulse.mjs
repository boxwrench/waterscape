// Browser verification against the production build. Hydrology below is deliberately
// synthetic test data; it is intercepted only in this test and never shipped to users.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createStaticServer } from "./serve.mjs";

const out = "previews/river-pulse-ui";
await mkdir(out, { recursive: true });
const server = createStaticServer(
  new URL("../dist/", import.meta.url).pathname,
);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/river-pulse/renderer/hacienda.html`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.RIVER_PULSE_BROWSER
    ? { executablePath: process.env.RIVER_PULSE_BROWSER }
    : {}),
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
// SwiftShader renders the scene on the CPU, so an animation frame can take seconds in CI and
// Playwright's "stable" check (two frames at the same position) outlasts the default 30 s.
// Give every action on every page more room; the checks themselves are unchanged.
const openPage = browser.newPage.bind(browser);
browser.newPage = async (options) => {
  const page = await openPage(options);
  page.setDefaultTimeout(120000);
  return page;
};
const errors = [];
function feature(time, value, daily = false) {
  return {
    type: "Feature",
    id: `TEST-FIXTURE-${time}`,
    geometry: null,
    properties: {
      monitoring_location_id: "USGS-11467000",
      parameter_code: "00060",
      time,
      value: String(value),
      unit_of_measure: "ft^3/s",
      approval_status: "Provisional",
      time_series_id: "TEST-FIXTURE",
      statistic_id: daily ? "00003" : "00011",
    },
  };
}
async function setup(page, { offline = false, noGpu = false, settingOffline = false } = {}) {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", { value: undefined }),
  );
  if (noGpu)
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", (r) => {
    if (r.url().includes("127.0.0.1") && r.status() >= 400 &&
        !(settingOffline && r.url().includes("/setting/")))
      errors.push(`${r.status()} ${r.url()}`);
  });
  await page.route("https://api.waterdata.usgs.gov/**", async (route) => {
    if (offline)
      return route.fulfill({
        status: 503,
        body: "Test fixture: service unavailable",
      });
    const requested = new URL(route.request().url());
    let body;
    if (requested.pathname.includes("latest-continuous"))
      body = { features: [feature(new Date().toISOString(), 120)] };
    else if (requested.pathname.includes("/daily/"))
      body = {
        features: [180, 150, 110, 80, 95, 120].map((v, i) =>
          feature(`2026-09-${22 + i}`, v, true),
        ),
      };
    else {
      const base = {
          monitoring_location_id: "USGS-11467000",
          parameter_code: "00060",
          unit_of_measure: "ft^3/s",
          normal_type: "DOY",
        },
        time_of_year = requested.searchParams.get("start_date");
      body = [
        {
          ...base,
          computation: "minimum",
          values: [{ time_of_year, value: "40", sample_count: 84 }],
        },
        {
          ...base,
          computation: "percentile",
          values: [
            {
              time_of_year,
              values: ["60", "100", "160", "200"],
              percentiles: [10, 25, 75, 90],
              sample_count: 84,
            },
          ],
        },
        {
          ...base,
          computation: "maximum",
          values: [{ time_of_year, value: "300", sample_count: 84 }],
        },
      ];
    }
    await route.fulfill({
      json: body,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  if (settingOffline) await page.route("**/setting/**", (route) => route.fulfill({
    status: 503, body: "Test fixture: setting assets unavailable",
  }));
  await page.goto(url);
  await page.waitForFunction(() =>
    document.querySelector("#loading").classList.contains("ready"),
  );
  // Terrain/data readiness precedes asynchronous optical/setting asset loading.
  // A data outage is not a signal that the map layer has finished initializing.
  if (!noGpu) await page.waitForFunction(() =>
    window.riverPulseMapFlow && window.riverPulseAuthoredWater,
  );
}
// Software-rendered CI can need more than 30 seconds for GPU readback and PNG capture.
// This only changes artifact capture; interaction assertions retain their existing limits.
async function capture(page, path) {
  await page.screenshot({ path, timeout: 90000, animations: "disabled" });
}
async function visible(page, selector) {
  return page.locator(selector).isVisible();
}
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  await setup(page);
  await page.waitForFunction(
    () =>
      window.riverPulseScene && window.riverPulseBankSetting &&
      window.riverPulseSeasonalCondition?.kind === "normal",
  );
  assert.equal(await page.locator("#flow-value").innerText(), "120 ft³/s");
  assert.equal(await page.locator("#render-backend").innerText(), "WebGL2");
  assert.equal(await visible(page, "#error"), false);
  await page.locator("#inspect-toggle").click();
  assert.match(
    await page.locator("#observation-evidence").innerText(),
    /observation/,
  );
  await page.keyboard.press("Escape");
  assert.equal(await visible(page, "#inspector"), false);
  await page.locator("#time-range").focus();
  const cameraBefore = await page.evaluate(() => ({
    ...window.riverPulseScene.state,
  }));
  await page.keyboard.press("Home");
  await page.waitForFunction(
    () => document.querySelector("#flow-quality").textContent === "History",
  );
  assert.equal(await page.locator("#flow-value").innerText(), "180 ft³/s");
  assert.equal(
    await page.evaluate(() => window.riverPulseScene.state.yaw),
    cameraBefore.yaw,
    "Timeline keyboard input must not move camera",
  );
  await page.waitForFunction(
    () => window.riverPulseRiverLayer?.userData.condition === "above-normal",
  );
  const highWidth = await page.evaluate(() => window.riverPulseMapFlow.binding.width);
  await page.waitForFunction(() => Math.abs(window.riverPulseMapFlow.mesh.userData.displayWidth -
    window.riverPulseMapFlow.binding.width) < 0.1);
  await capture(page, `${out}/map-ribbon-high.png`);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector("#flow-value").textContent === "80 ft³/s");
  const lowWidth = await page.evaluate(() => window.riverPulseMapFlow.binding.width);
  assert.ok(highWidth > lowWidth, "Historical high discharge widens the map ribbon");
  await page.waitForFunction(() => Math.abs(window.riverPulseMapFlow.mesh.userData.displayWidth -
    window.riverPulseMapFlow.binding.width) < 0.1 && window.riverPulseRiverLayer.userData.condition === "below-normal");
  await capture(page, `${out}/map-ribbon-low.png`);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => window.riverPulseMapFlow.animationTime === 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator("#return-now").click();
  await page.waitForFunction(
    () => window.riverPulseSeasonalCondition?.kind === "normal",
  );
  assert.equal(await page.evaluate(() => window.riverPulseMapFlow.mesh.userData.moving), true);
  await page.locator("#river-layer").click();
  assert.equal(
    await page.evaluate(() => window.riverPulseRiverLayer.visible),
    false,
  );
  await page.locator("#river-layer").click();
  await page.locator("#tint-layer").click();
  assert.equal(
    await page.evaluate(() => window.riverPulseScene.material.vertexColors),
    false,
  );
  await page.locator("#tint-layer").click();
  await page.locator("#bridge").click();
  await page.waitForFunction(
    () => Math.abs(window.riverPulseScene.state.x - window.riverPulseBankSetting.bridgeCamera.x) < 1,
  );
  assert.equal(await page.evaluate(() => window.riverPulseAuthoredWater.mesh.visible), true);
  await page.locator("#shallows").click();
  await page.waitForFunction(() => document.querySelector("#shallows").getAttribute("aria-pressed") === "true" &&
    Math.abs(window.riverPulseScene.state.x - window.riverPulseBankSetting.camera.x) < 1);
  assert.ok(await page.evaluate(() => window.riverPulseBankSetting.group.getObjectByName("Hacienda mixed woodland").userData.treeCount > 0));
  assert.ok(await page.evaluate(() => window.riverPulseBankSetting.group.getObjectByName("Bank rocks and pebbles").children.length > 1));
  await capture(page, `${out}/authored-shallows-desktop.png`);
  await page.locator("#focus-view").click();
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => window.riverPulseBankSetting.group.getObjectByName("Hacienda camelback bridge").userData.panels), 7);
  await capture(page, `${out}/shoreline-focus.png`);
  await page.locator("#scene").focus();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(400);
  await page.keyboard.up("KeyW");
  assert.ok(await page.evaluate(() => {
    const s = window.riverPulseScene.state;
    return s.z >= -35 && s.z <= 70 && s.y < 4;
  }), "Beach movement remains at eye height within authored bounds");
  await page.locator("#shallows").click();
  await page.locator("#focus-view").click();
  await page.locator("#river-layer").click();
  assert.equal(await page.evaluate(() => window.riverPulseRiverLayer.visible), false);
  assert.equal(await page.evaluate(() => window.riverPulseBankSetting.group.visible), true,
    "River toggle controls water, while the authored bank setting remains visible");
  await page.locator("#river-layer").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await capture(page, `${out}/authored-shallows-reduced-motion.png`);
  assert.match(await page.locator("#water-disclosure").innerText(), /not surveyed banks/);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator("#overview").click();
  await page.waitForFunction(
    () => Math.abs(window.riverPulseScene.state.x + 900) < 1,
  );
  assert.equal(await page.evaluate(() => window.riverPulseAuthoredWater.mesh.visible), false);
  assert.equal(await page.evaluate(() => window.riverPulseBankSetting.group.visible), false);
  await page.locator("#history-play").click();
  await page.waitForFunction(
    () => Number(document.querySelector("#time-range").value) >= 1,
  );
  await page.locator("#history-play").click();
  await page.locator("#return-now").click();
  await page.locator("#focus-view").click();
  assert.equal(await visible(page, ".control-deck"), false);
  await page.locator("#focus-view").click();
  await capture(page, `${out}/desktop.png`);
  await page.locator("#inspect-toggle").click();
  await capture(page, `${out}/evidence.png`);
  await page.locator("#inspect-close").click();

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.equal(await visible(page, "#history-panel"), false);
  await capture(page, `${out}/mobile.png`);
  await capture(page, `${out}/map-ribbon-mobile.png`);
  await page.locator("#shallows").click();
  await page.waitForFunction(() => Math.abs(window.riverPulseScene.state.x -
    window.riverPulseBankSetting.camera.x) < 1);
  await capture(page, `${out}/authored-shallows-mobile.png`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator("#timeline-toggle").click();
  assert.equal(await visible(page, "#history-panel"), true);
  await capture(page, `${out}/mobile-history.png`);
  await page.locator("#inspect-toggle").click();
  assert.equal(await visible(page, "#inspector"), true);
  await page.close();

  const unavailable = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  await setup(unavailable, { offline: true });
  await unavailable.waitForFunction(
    () => document.querySelector("#flow-quality").textContent === "Offline",
  );
  assert.equal(await unavailable.locator("#time-range").isDisabled(), true);
  assert.equal(
    await visible(unavailable, "#error"),
    false,
    "A data outage should not break terrain",
  );
  assert.equal(await unavailable.evaluate(() => window.riverPulseMapFlow.mesh.userData.moving), false);
  await unavailable.locator("#shallows").click();
  assert.equal(await unavailable.evaluate(() => window.riverPulseAuthoredWater.mesh.visible), true,
    "Optical preview survives data outage without deriving hydraulics from missing discharge");
  await unavailable.close();
  const missingSetting = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await setup(missingSetting, { settingOffline: true });
  await missingSetting.waitForFunction(() => window.riverPulseAuthoredWater);
  assert.equal(await visible(missingSetting, "#error"), false);
  assert.match(await missingSetting.locator("#water-disclosure").innerText(), /textures are unavailable/);
  await missingSetting.locator("#shallows").click();
  assert.equal(await missingSetting.evaluate(() => window.riverPulseAuthoredWater.mesh.visible), true);
  await missingSetting.close();
  const noGpu = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  await setup(noGpu, { noGpu: true });
  await noGpu.waitForFunction(
    () => document.querySelector("#flow-value").textContent === "120 ft³/s",
  );
  assert.equal(await visible(noGpu, "#error"), true);
  assert.equal(
    await noGpu.locator("#time-range").isDisabled(),
    false,
    "GPU failure must not disable history",
  );
  await capture(noGpu, `${out}/graphics-unavailable.png`);
  await noGpu.close();
  assert.deepEqual(errors, []);
  console.log(
    "River Pulse browser checks passed: production assets, WebGL fallback, timeline, evidence, camera/layers, mobile, data outage and GPU failure.",
  );
} catch (error) {
  console.error("River Pulse page errors before check failure:", errors);
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
