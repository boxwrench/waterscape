// Render a reservoir's flyover with the live renderer: data/<id>/flyover.mp4 + poster.jpg.
// Usage: node pipeline/render-flyover.mjs <id> [--seconds N] [--fps N]
// Needs Microsoft Edge (Playwright channel "msedge") and ffmpeg on PATH.
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStaticServer } from "../scripts/serve.mjs";
import { poseAt } from "../site/flyover-path.js";

const root = path.resolve(import.meta.dirname, ".."),
  args = process.argv.slice(2),
  id = args[0],
  option = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i < 0 ? fallback : Number(args[i + 1]);
  };
if (!id) throw new Error("Usage: node pipeline/render-flyover.mjs <id> [--seconds N] [--fps N]");
const bundle = path.join(root, "data", id),
  { flyover } = JSON.parse(await readFile(path.join(bundle, "cameras.json"), "utf8")),
  fps = option("fps", 30),
  seconds = Math.min(option("seconds", flyover.duration), flyover.duration),
  frames = Math.round(seconds * fps),
  tmp = await mkdtemp(path.join(os.tmpdir(), `flyover-${id}-`)),
  server = createStaticServer(root);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
// On hybrid laptops Edge otherwise picks the integrated GPU (~7x slower).
const browser = await chromium.launch({
  channel: "msedge",
  headless: false,
  args: ["--enable-unsafe-webgpu", "--force_high_performance_gpu"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(
    `http://127.0.0.1:${server.address().port}/renderer/explore.html?reservoir=${id}&embed=1&quality=high`,
  );
  await page.waitForFunction(
    () => window.waterscapeDiagnostics?.ready || window.waterscapeDiagnostics?.errors.length,
    null,
    { timeout: 180000 },
  );
  const errors = await page.evaluate(() => window.waterscapeDiagnostics.errors);
  if (errors.length) throw new Error(errors.join("\n"));
  await page.evaluate(() => {
    const q = document.getElementById("quality");
    q.value = "1536";
    q.dispatchEvent(new Event("change"));
  });
  await page.waitForFunction(() => window.waterscapeDiagnostics.width === 1536, null, {
    timeout: 30000,
  });
  for (let i = 0; i < frames; i++) {
    const pose = poseAt(flyover, i / fps);
    await page.evaluate(
      async ({ pose, t }) => {
        const { state, seek } = window.waterscapeLab;
        Object.assign(state, { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, pitch: pose.pitch });
        await seek(t);
      },
      { pose, t: 5 + i / fps },
    );
    await page.screenshot({ path: path.join(tmp, `frame_${String(i).padStart(5, "0")}.png`) });
    if (i % fps === 0) console.log(`${id}: frame ${i}/${frames}`);
  }
} finally {
  await browser.close();
  server.close();
}
const ffmpeg = (a) => {
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${a.join(" ")}`);
};
ffmpeg([
  "-framerate", String(fps), "-i", path.join(tmp, "frame_%05d.png"),
  "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", path.join(bundle, "flyover.mp4"),
]);
ffmpeg(["-i", path.join(tmp, "frame_00000.png"), "-q:v", "3", path.join(bundle, "poster.jpg")]);
await rm(tmp, { recursive: true });
console.log(`${id}: wrote ${frames} frames to data/${id}/flyover.mp4 and poster.jpg`);
