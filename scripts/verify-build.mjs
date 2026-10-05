// Check the deployable artifact, including every HTML module and stylesheet entry.
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { validateRiverPackages } from "../pipeline/validate-river-packages.mjs";

const root = path.resolve("dist"),
  pages = ["index.html", "renderer/explore.html", "river-pulse/index.html", "river-pulse/river.html", ...(await builtScenePages())];
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
const overview = JSON.parse(await readFile(path.join(root, "river-pulse/app/data/california-overview.json"), "utf8")),
  registry = JSON.parse(await readFile(path.join(root, "river-pulse/registry.json"), "utf8"));
assert.equal(overview.schema_version, "river-pulse-overview-0.1");
assert.deepEqual(overview.rivers.map(r => r.id).sort(), registry.rivers.map(r => r.id).sort());
assert.ok((await stat(path.join(root, "river-pulse/app/data", overview.relief))).size > 0);
console.log("Built experience pages and river assets valid.");

// Every built scene page under rivers/<river>/scenes/<slot>/<place>/index.html (planned slots have none).
async function builtScenePages() {
  const found = [], base = path.join(path.resolve("dist"), "river-pulse/rivers");
  for (const river of await readdir(base)) for (const slot of await readdir(path.join(base, river, "scenes")))
    for (const place of await readdir(path.join(base, river, "scenes", slot)))
      try { await stat(path.join(base, river, "scenes", slot, place, "index.html")); found.push(`river-pulse/rivers/${river}/scenes/${slot}/${place}/index.html`); } catch { /* planned */ }
  return found;
}
