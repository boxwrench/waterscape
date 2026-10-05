import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

test("production ships every module and stylesheet referenced by the River Pulse page", async () => {
  const root = new URL("../../", import.meta.url);
  await import("../../scripts/build.mjs");
  const page = new URL("dist/river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/index.html", root),
    html = await readFile(page, "utf8");
  const assets = [
    ...html.matchAll(
      /<(?:script|link)\b[^>]*(?:src|href)=["'](\.\/[^"']+)["']/g,
    ),
  ].map((m) => m[1]);
  assert.ok(assets.includes("./hacienda-time.js"));
  assert.ok(assets.includes("./hacienda-seasonal.js"));
  for (const asset of assets) await access(new URL(asset, page));
  await access(new URL("dist/river-pulse/adapters/usgs-statistics.js", root));
});
