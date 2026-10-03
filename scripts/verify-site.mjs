// Journey checks: cards, media, navigation, prefetch and failure fallback.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStaticServer } from "./serve.mjs";

const server = createStaticServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  channel: "msedge",
  headless: false,
  args: ["--enable-unsafe-webgpu"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/?tier=video`);
  await page.waitForFunction(() => document.getElementById("stopName").textContent.length > 0);

  // Stop 1: card, sourced facts, poster, playing video, next stop prefetched.
  assert.equal(await page.textContent("#stopName"), "Calaveras Reservoir");
  const links = await page.$$eval(".facts a", (a) => a.map((x) => x.href));
  assert.ok(links.length >= 3 && links.every((h) => h.startsWith("https://")), JSON.stringify(links));
  await page.waitForFunction(() => document.getElementById("poster").naturalWidth > 0);
  await page.waitForFunction(() => document.getElementById("flyover").currentTime > 0.2, null, {
    timeout: 15000,
  });
  assert.ok((await page.getAttribute("#flyover", "src")).endsWith("data/calaveras/flyover.mp4"));
  await page.waitForSelector('link[rel=prefetch][href$="san_antonio/flyover.mp4"]', { state: "attached" });
  const prefetched = await page.$$eval("link[rel=prefetch]", (l) => l.map((x) => x.href));
  assert.ok(prefetched.some((h) => h.endsWith("data/san_antonio/flyover.mp4")), JSON.stringify(prefetched));

  // Compact sourced context leaves the water visible; detail is keyboard-accessible.
  const previewDir = await mkdtemp(path.join(os.tmpdir(), "waterscape-d1-"));
  console.log(`Card previews: ${previewDir}`);
  assert.match(await page.textContent("#supply"), /San Francisco.*Alameda.*Santa Clara.*San Mateo/);
  assert.match(await page.getAttribute("#supply a", "href"), /^https:\/\/www.sfpuc.gov\//);
  assert.equal(await page.locator("#facts dd").count(), 1);
  assert.match(await page.textContent("#facts"), /96,850 acre-feet/);
  assert.equal(await page.locator("#reservoirDetails").getAttribute("open"), null);
  await page.screenshot({ path: path.join(previewDir, "desktop-compact.png") });
  await page.focus("#reservoirDetails summary");
  await page.keyboard.press("Enter");
  assert.equal(await page.isVisible("#detailFacts"), true);
  assert.match(await page.textContent("#detailFacts"), /USGS reference · 2006/);
  assert.match(await page.textContent(".detail-body"), /not a depth survey or live measurements/);
  assert.ok((await page.getAttribute("#terrainSource", "href")).endsWith("calaveras/terrain.json"));
  await page.keyboard.press("PageDown");
  assert.equal(await page.textContent("#stopName"), "Calaveras Reservoir", "reading does not change stops");
  await page.screenshot({ path: path.join(previewDir, "desktop-details.png") });
  await page.keyboard.press("Enter");
  await page.click(".brand");

  // Navigation: keyboard, hash, map state, buttons at the ends.
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.textContent("#stopName"), "San Antonio Reservoir");
  assert.match(await page.textContent("#facts"), /50,500 acre-feet as built/);
  assert.match(await page.textContent("#detailFacts"), /USGS reference · 2021/);
  assert.equal(await page.locator("#reservoirDetails").getAttribute("open"), null);
  assert.equal(new URL(page.url()).hash, "#stop=san_antonio");
  assert.deepEqual(
    await page.$$eval("#systemMap li", (li) => li.map((x) => x.classList.contains("active"))),
    [false, true, false, false, false],
  );
  assert.equal(await page.isDisabled("#next"), false);
  // The last stop disables "Next".
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.textContent("#stopName"), "Hetch Hetchy Reservoir");
  assert.equal(await page.isDisabled("#next"), true);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.click("#prev");
  assert.equal(await page.textContent("#stopName"), "Calaveras Reservoir");

  // Deep link.
  await page.goto(`${base}/?tier=video#stop=san_antonio`);
  await page.waitForFunction(() => document.getElementById("stopName").textContent === "San Antonio Reservoir");

  // Broken video: the poster and card carry the stop.
  const broken = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await broken.route("**/flyover.mp4", (r) => r.abort());
  await broken.goto(`${base}/?tier=video`);
  await broken.waitForFunction(() => document.getElementById("stage").classList.contains("video-failed"));
  assert.ok(await broken.evaluate(() => document.getElementById("poster").naturalWidth > 0));
  assert.equal(await broken.textContent("#stopName"), "Calaveras Reservoir");
  await broken.close();

  // Video tier: no 3D offer.
  assert.equal(await page.isVisible("#explore"), false);

  // Mobile and short screens: disclosures scroll within the card; controls remain reachable.
  for (const viewport of [{ width: 390, height: 844 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    await page.locator("#reservoirDetails summary").click();
    const bounds = await page.evaluate(() => {
      const card = document.getElementById("card"), rect = card.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: innerWidth, height: innerHeight, scrollWidth: card.scrollWidth, clientWidth: card.clientWidth };
    });
    assert.ok(bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= 0 && bounds.bottom <= bounds.height,
      JSON.stringify(bounds));
    assert.ok(bounds.scrollWidth <= bounds.clientWidth, JSON.stringify(bounds));
    await page.locator("#reservoirDetails summary").hover();
    await page.mouse.wheel(0, 250);
    await page.waitForFunction(() => document.getElementById("card").scrollTop > 0);
    assert.equal(await page.textContent("#stopName"), "San Antonio Reservoir");
    await page.screenshot({ path: path.join(previewDir, `details-${viewport.width}.png`) });
    await page.locator("#prev").click();
    assert.equal(await page.textContent("#stopName"), "Calaveras Reservoir");
    assert.equal(await page.locator("#reservoirDetails").getAttribute("open"), null);
    await page.screenshot({ path: path.join(previewDir, `compact-${viewport.width}.png`) });
    await page.locator("#next").click();
  }
  await page.setViewportSize({ width: 1280, height: 800 });

  // Existing/custom bundles without optional card metadata keep their headline and first fact.
  const legacy = await browser.newPage(),
    legacyStory = JSON.parse(await readFile("data/calaveras/story.json", "utf8"));
  delete legacyStory.summary;
  legacyStory.facts.forEach((f) => delete f.featured);
  await legacy.route("**/data/calaveras/story.json", (r) => r.fulfill({ json: legacyStory }));
  await legacy.goto(`${base}/?tier=video`);
  await legacy.waitForFunction(() => document.getElementById("stopName").textContent.length > 0);
  assert.equal(await legacy.textContent("#supply"), legacyStory.headline);
  assert.equal(await legacy.locator("#facts dd").count(), 1);
  assert.equal(await legacy.locator(".facts dd").count(), legacyStory.facts.length);
  await legacy.close();

  // Live tier: the page opens straight into 3D at the shoreline viewpoint and reports frame times.
  const live = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  live.on("pageerror", (e) => errors.push(String(e)));
  const requests = [];
  live.on("request", (r) => requests.push(new URL(r.url()).pathname));
  let releaseTerrain;
  const terrainGate = new Promise((resolve) => { releaseTerrain = resolve; });
  await live.route("**/data/calaveras/terrain.bin.gz", async (r) => {
    await terrainGate;
    await r.continue();
  });
  await live.goto(`${base}/?tier=live&quality=low`, { waitUntil: "domcontentloaded" });
  await live.waitForSelector("#explore", { state: "visible" });
  const frame = await (await live.waitForSelector("#liveFrame", { state: "attached" })).contentFrame();
  // Artificially stalled terrain must leave the video moving and avoid next-video traffic.
  await live.waitForFunction(() => document.getElementById("flyover").currentTime > 0.2);
  const videoTime = await live.evaluate(() => document.getElementById("flyover").currentTime);
  await live.waitForFunction((t) => document.getElementById("flyover").currentTime > t + 0.3, videoTime);
  assert.equal(await live.evaluate(() => document.getElementById("flyover").paused), false);
  assert.equal(await live.evaluate(() => window.waterscapeJourney.live.firstFrame), false);
  assert.equal(await live.locator('link[rel=prefetch][href$="flyover.mp4"]').count(), 0);
  assert.ok(!requests.includes("/data/san_antonio/flyover.mp4"));
  releaseTerrain();
  await frame.waitForFunction(() => window.waterscapeDiagnostics?.ready, null, { timeout: 120000 });
  await live.waitForFunction(() => window.waterscapeJourney.live?.frameTimes.length > 0, null, {
    timeout: 30000,
  });
  const expected = await live.evaluate(() => window.waterscapeJourney.live.pose),
    actual = await frame.evaluate(() => ({ ...window.waterscapeLab.state }));
  assert.ok(Math.abs(actual.x - expected.x) < 1 && Math.abs(actual.z - expected.z) < 1,
    JSON.stringify({ expected, actual }));
  assert.equal(await live.textContent("#explore"), "Back to video");
  assert.equal(await live.evaluate(() => document.getElementById("flyover").paused), true);
  const trees = requests.filter((p) => /\/trees\/.*\.bin$/.test(p));
  assert.equal(trees.length, 6, JSON.stringify(trees));
  assert.ok(trees.every((p) => p.endsWith("-far.bin")), JSON.stringify(trees));
  const startup = await frame.evaluate(() => window.waterscapeDiagnostics.startup);
  assert.ok(startup.bodyMs > 0 && startup.engineMs > 0 && startup.firstFrameMs > 0, JSON.stringify(startup));
  assert.ok(!requests.includes("/data/san_antonio/flyover.mp4"));
  // The journey forwards ?quality= and trusts the renderer's struggling flag, not raw frame times.
  await live.screenshot({ path: path.join(previewDir, "live-water-desktop.png") });
  await live.setViewportSize({ width: 390, height: 844 });
  const liveBounds = await live.evaluate(() => {
    const card = document.getElementById("card"), rect = card.getBoundingClientRect();
    return { right: rect.right, width: innerWidth, scrollWidth: card.scrollWidth, clientWidth: card.clientWidth };
  });
  assert.ok(liveBounds.right <= liveBounds.width && liveBounds.scrollWidth <= liveBounds.clientWidth,
    JSON.stringify(liveBounds));
  await live.screenshot({ path: path.join(previewDir, "live-water-mobile.png") });
  await live.setViewportSize({ width: 1280, height: 800 });
  assert.ok((await live.getAttribute("#liveFrame", "src")).includes("quality=low"));
  await frame.evaluate(() =>
    parent.postMessage({ type: "waterscape:frame", ms: 250, reservoir: "calaveras", tier: 0, struggling: false }, location.origin),
  );
  await live.waitForTimeout(300);
  assert.equal(await live.isVisible("#slowNotice"), false, "slow frames alone do not show the notice");
  await frame.evaluate(() =>
    parent.postMessage({ type: "waterscape:frame", ms: 250, reservoir: "calaveras", tier: 0, struggling: true }, location.origin),
  );
  await live.waitForSelector("#slowNotice", { state: "visible" });
  // Presets: the journey offers them in live mode and forwards the choice to the renderer.
  assert.equal(await live.isVisible("#livePreset"), true);
  await live.selectOption("#livePreset", "midday");
  await frame.waitForFunction(() => window.waterscapeDiagnostics?.preset === "midday");
  await live.evaluate(() => { window.previousLiveWindow = document.getElementById("liveFrame").contentWindow; });
  let releaseNext;
  const nextGate = new Promise((resolve) => { releaseNext = resolve; });
  await live.route("**/data/san_antonio/terrain.bin.gz", async (r) => {
    await nextGate;
    await r.continue().catch(() => {}); // navigation may cancel this held request
  });
  // Changing stop while live opens the next stop live.
  await live.click("#next");
  await live.waitForSelector('#liveFrame[src*="reservoir=san_antonio"]', { state: "attached" });
  await live.evaluate(() => {
    for (const type of ["waterscape:frame", "waterscape:failed"])
      dispatchEvent(new MessageEvent("message", {
        origin: location.origin, source: window.previousLiveWindow,
        data: { type, ms: 1, reservoir: "calaveras" },
      }));
  });
  assert.equal(await live.evaluate(() => window.waterscapeJourney.live.firstFrame), false);
  assert.equal(await live.evaluate(() => window.waterscapeJourney.live.id), "san_antonio");
  // Back to video closes the renderer and later stops stay on video.
  await live.click("#explore");
  releaseNext();
  assert.equal(await live.$("#liveFrame"), null);
  await live.click("#prev");
  await live.waitForTimeout(300);
  assert.equal(await live.$("#liveFrame"), null);
  await live.waitForSelector('link[rel=prefetch][href$="san_antonio/flyover.mp4"]', { state: "attached" });
  await live.close();

  // Exercise the real tree loader without GPU timing: no detail on frame zero or low,
  // delayed detail on upgrade, and a failed variant retains its usable far geometry.
  const treePage = await browser.newPage();
  treePage.on("pageerror", (e) => errors.push(String(e)));
  let releaseDetails;
  const detailGate = new Promise((resolve) => { releaseDetails = resolve; }),
    detailRequests = [],
    warnings = [];
  treePage.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await treePage.route(/\/trees\/.*(?<!-far)\.bin$/, async (r) => {
    detailRequests.push(new URL(r.request().url()).pathname);
    await detailGate;
    if (r.request().url().endsWith("coast-live-a.bin")) await r.fulfill({ status: 404, body: "missing" });
    else await r.continue();
  });
  await treePage.goto(`${base}/?tier=video`);
  await treePage.evaluate(async () => {
    const { loadBody, viewpoint } = await import("/renderer/engine/body.js"),
      { createGroundMaterial } = await import("/renderer/land/ground.js"),
      { createTrees } = await import("/renderer/land/trees.js"),
      body = await loadBody("calaveras"),
      biomeBase = new URL("/data/biomes/diablo-oak/", location.href),
      ground = createGroundMaterial(body.terrain, biomeBase, body.biome);
    window.testTrees = await createTrees(body.terrain, body.biome, biomeBase, ground);
    window.testTreeState = { ...viewpoint(body, "shore"), frames: 0, quality: 2 };
    window.testTrees.update(window.testTreeState, 1);
  });
  assert.equal(detailRequests.length, 0, "first frame never waits for detail");
  const species = await treePage.evaluate(() => window.testTrees.species);
  await treePage.evaluate(() => {
    Object.assign(window.testTreeState, { frames: 1, quality: 0 });
    window.testTrees.update(window.testTreeState, 1);
  });
  assert.equal(detailRequests.length, 0, "low tier never requests detail");
  await treePage.evaluate(() => {
    window.testTreeState.quality = 1;
    window.testTrees.update(window.testTreeState, 1);
  });
  await treePage.waitForFunction(() => window.testTrees.group.children.length === 12);
  // Flush the browser's fetch events before counting intercepted requests.
  await treePage.waitForTimeout(300);
  assert.equal(detailRequests.length, 6);
  releaseDetails();
  await treePage.waitForFunction(() => window.testTrees.group.children.length === 22);
  assert.deepEqual(await treePage.evaluate(() => window.testTrees.species), species);
  const names = await treePage.evaluate(() => {
    window.testTrees.update(window.testTreeState, 1);
    window.testTreeState.quality = 0;
    window.testTrees.update(window.testTreeState, 1);
    return window.testTrees.group.children.map((m) => ({ name: m.name, count: m.count }));
  });
  assert.ok(names.some((m) => m.name === "coast-live-a-far"));
  assert.ok(!names.some((m) => m.name === "coast-live-a"));
  assert.ok(names.filter((m) => !m.name.endsWith("-far")).every((m) => m.count === 0));
  assert.equal(detailRequests.length, 6, "no repeated detail requests");
  assert.ok(warnings.some((m) => m.includes("Keeping lightweight tree coast-live-a: 404")), JSON.stringify(warnings));
  await treePage.close();

  // Forced live-asset failure: falls back to video, poster/card stay put.
  const failing = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await failing.route("**/data/calaveras/terrain.bin.gz", (r) => r.abort());
  await failing.goto(`${base}/?tier=live`);
  await failing.waitForSelector("#liveFrame", { state: "attached" });
  await failing.waitForFunction(
    () => !document.getElementById("liveFrame") && !document.getElementById("stage").classList.contains("live"),
    null,
    { timeout: 30000 },
  );
  assert.ok(await failing.evaluate(() => document.getElementById("poster").naturalWidth > 0));
  assert.equal(await failing.textContent("#stopName"), "Calaveras Reservoir");
  await failing.close();

  assert.deepEqual(errors, []);
  console.log("Journey checks passed.");
} finally {
  await browser.close();
  server.close();
}
