// Local, cold-context startup observations; no network throttling or production CDN cache.
import { chromium } from "playwright";
import { createStaticServer } from "./serve.mjs";

const server = createStaticServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  channel: "msedge",
  headless: false,
  args: ["--enable-unsafe-webgpu"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => performance.setResourceTimingBufferSize(2000));
  const observations = [];
  async function measure(label, action) {
    const started = performance.now();
    await action();
    await page.waitForFunction(() => window.waterscapeJourney?.live?.firstFrame, null, { timeout: 120000 });
    const firstFrameMs = Math.round(performance.now() - started);
    const frame = await (await page.locator("#liveFrame").elementHandle()).contentFrame();
    const resources = (await Promise.all([page, frame].map((context) => context.evaluate(() =>
      performance.getEntriesByType("resource").map((r) => ({
        name: new URL(r.name).pathname, bytes: r.encodedBodySize,
      })),
    )))).flat();
    observations.push({
      label, firstFrameMs,
      startup: await frame.evaluate(() => window.waterscapeDiagnostics?.startup ?? null),
      resourceBodyBytes: resources.reduce((sum, r) => sum + r.bytes, 0),
      treeBodyBytes: resources.filter((r) => /\/trees\/.*\.bin$/.test(r.name)).reduce((sum, r) => sum + r.bytes, 0),
      treeRequests: resources.filter((r) => /\/trees\/.*\.bin$/.test(r.name)).length,
    });
  }
  await measure("cold low", () => page.goto(`http://127.0.0.1:${server.address().port}/?tier=live&quality=low`));
  await page.evaluate(() => performance.clearResourceTimings());
  await measure("next stop low", () => page.click("#next"));
  console.log(JSON.stringify({ environment: "Local Edge, unthrottled; completed resource body bytes through first-frame observation (not wire transfer bytes)", observations }, null, 2));
  console.log("Startup measurements complete.");
} finally {
  await browser.close();
  server.close();
}
