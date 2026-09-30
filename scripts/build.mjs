import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateRiverPackages } from "../pipeline/validate-river-packages.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  out = path.join(root, "dist");
await validateRiverPackages(root);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const modules = new Set();
async function moduleGraph(file) {
  file = path.resolve(file);
  if (modules.has(file)) return;
  modules.add(file);
  const source = await readFile(file, "utf8");
  // Specifiers never contain spaces or commas (keeps words like 'from' in string lists out).
  for (const match of source.matchAll(
    /(?:from\s*|import\s*\()\s*['"]([^'"\s,]+)['"]/g,
  )) {
    if (!match[1].startsWith("."))
      throw Error(`External browser import: ${match[1]}`);
    await moduleGraph(path.resolve(path.dirname(file), match[1]));
  }
}
// HTML is the source of truth for browser entry points and stylesheets. Independent
// timeline/seasonal modules must ship even when the scene does not import them.
const htmlFiles = [
    "index.html",
    "renderer/explore.html",
    "river-pulse/renderer/hacienda.html",
    "river-pulse/renderer/jenner.html",
  ],
  htmlAssets = new Set();
for (const entry of htmlFiles) {
  const file = path.join(root, entry),
    html = await readFile(file, "utf8");
  for (const match of html.matchAll(
    /<(script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/g,
  )) {
    const specifier = match[2];
    if (!specifier.startsWith(".")) continue;
    const asset = path.resolve(path.dirname(file), specifier);
    if (match[1] === "script") await moduleGraph(asset);
    else if (/rel=["']stylesheet["']/.test(match[0])) htmlAssets.add(asset);
  }
}
for (const file of [
  ...modules,
  ...htmlAssets,
  ...[
    "site/journey.css",
    "index.html",
    "renderer/explore.html",
    "renderer/explore.css",
    "renderer/water.cu",
    "renderer/assets/seabed.jpg",
    "river-pulse/renderer/hacienda.html",
    "river-pulse/renderer/jenner.html",
    "river-pulse/index.html",
    "river-pulse/renderer/hacienda.css",
    "river-pulse/renderer/hacienda-label.css",
    "river-pulse/renderer/hacienda-flow.css",
    "river-pulse/renderer/hacienda-time.css",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "vendor/cuda-webshader/LICENSE",
    "vendor/three/LICENSE",
    "docs/making-water-visible.md",
  ].map((f) => path.join(root, f)),
]) {
  const relative = path.relative(root, file);
  if (relative.startsWith("..")) throw Error("Asset outside project");
  await mkdir(path.dirname(path.join(out, relative)), { recursive: true });
  await cp(file, path.join(out, relative));
}
// Waterscape reservoir bundles ship whole; the uncompressed native twin never does.
await cp(path.join(root, "data"), path.join(out, "data"), {
  recursive: true,
  filter: (src) => !src.endsWith("terrain.bin"),
});
// River Pulse packages are additive and currently contain authored source plus generated terrain.
await cp(
  path.join(root, "river-pulse", "data"),
  path.join(out, "river-pulse", "data"),
  { recursive: true },
);
await writeFile(path.join(out, ".nojekyll"), "");
console.log(
  `Built Pages with ${modules.size} browser modules, shared CUDA source and licensed assets.`,
);
