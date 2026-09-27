// Journey checks: cards, media, navigation, prefetch and failure fallback.
import { chromium } from "playwright";
import assert from "node:assert/strict";
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
  const links = await page.$$eval("#facts a", (a) => a.map((x) => x.href));
  assert.ok(links.length >= 3 && links.every((h) => h.startsWith("https://")), JSON.stringify(links));
  await page.waitForFunction(() => document.getElementById("poster").naturalWidth > 0);
  await page.waitForFunction(() => document.getElementById("flyover").currentTime > 0.2, null, {
    timeout: 15000,
  });
  assert.ok((await page.getAttribute("#flyover", "src")).endsWith("data/calaveras/flyover.mp4"));
  const prefetched = await page.$$eval("link[rel=prefetch]", (l) => l.map((x) => x.href));
  assert.ok(prefetched.some((h) => h.endsWith("data/san_antonio/flyover.mp4")), JSON.stringify(prefetched));

  // Navigation: keyboard, hash, map state, buttons at the ends.
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.textContent("#stopName"), "San Antonio Reservoir");
  assert.equal(new URL(page.url()).hash, "#stop=san_antonio");
  assert.deepEqual(
    await page.$$eval("#systemMap li", (li) => li.map((x) => x.classList.contains("active"))),
    [false, true],
  );
  assert.equal(await page.isDisabled("#next"), true);
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

  assert.deepEqual(errors, []);
  console.log("Journey checks passed.");
} finally {
  await browser.close();
  server.close();
}
