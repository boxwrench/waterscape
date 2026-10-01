// Check the deployable artifact, including every HTML module and stylesheet entry.
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { validateRiverPackages } from "../pipeline/validate-river-packages.mjs";

const root = path.resolve("dist"),
  pages = ["index.html", "renderer/explore.html", "river-pulse/index.html", "river-pulse/renderer/hacienda.html", "river-pulse/renderer/jenner.html", "river-pulse/renderer/east-fork.html"];
for (const page of pages) {
  const html = await readFile(path.join(root, page), "utf8");
  for (const [, ref] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    if (/^(https?:|data:|#)/.test(ref)) continue;
    const file = path.resolve(root, path.dirname(page), ref.split(/[?#]/)[0]);
    assert.ok(file === root || file.startsWith(root + path.sep), `Asset outside Pages root: ${ref}`);
    const info = await stat(file);
    if (info.isDirectory()) await stat(path.join(file, "index.html"));
  }
}
await validateRiverPackages(root);
console.log("Built experience pages and river assets valid.");
