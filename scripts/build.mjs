import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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
// Every built scene is rivers/<river>/scenes/<slot>/<place>/index.html; no per-river list to maintain.
async function riverSceneEntries() {
  const entries = [], base = path.join(root, "river-pulse", "rivers");
  for (const river of await readdir(base, { withFileTypes: true })) {
    if (!river.isDirectory()) continue;
    for (const slot of await readdir(path.join(base, river.name, "scenes")))
      for (const place of await readdir(path.join(base, river.name, "scenes", slot))) {
        const page = path.join(base, river.name, "scenes", slot, place, "index.html");
        try { await stat(page); entries.push(path.relative(root, page).split(path.sep).join("/")); } catch { /* planned slot */ }
      }
  }
  return entries;
}
// HTML is the source of truth for browser entry points and stylesheets. Independent
// timeline/seasonal modules must ship even when the scene does not import them.
const htmlFiles = [
    "index.html",
    "renderer/explore.html",
    "river-pulse/index.html",
    "river-pulse/river.html",
    ...(await riverSceneEntries()),
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
// Stylesheets may @import others (shared tokens, scene chrome); ship those too.
for (const sheet of [...htmlAssets]) {
  const pending = [sheet];
  while (pending.length) {
    const current = pending.pop(), css = await readFile(current, "utf8");
    for (const match of css.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/g)) {
      if (!match[1].startsWith(".")) continue;
      const imported = path.resolve(path.dirname(current), match[1]);
      if (!htmlAssets.has(imported)) { htmlAssets.add(imported); pending.push(imported); }
    }
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
    ...htmlFiles, // every page, including every built scene (discovered, not listed)
    "river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/hacienda.css",
    "river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/hacienda-label.css",
    "river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/hacienda-flow.css",
    "river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/hacienda-time.css",
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
// Source files ship through the module and HTML graph above; everything else (data, textures, thumbnails) ships whole.
const isSource = (src) => /\.(js|html|css|md)$/.test(src);
await cp(path.join(root, "river-pulse", "rivers"), path.join(out, "river-pulse", "rivers"), {
  recursive: true, filter: (src) => !isSource(src),
});
await cp(path.join(root, "river-pulse", "app", "data"), path.join(out, "river-pulse", "app", "data"), { recursive: true });
await cp(path.join(root, "river-pulse", "registry.json"), path.join(out, "river-pulse", "registry.json"));
// Pre-restructure scene URLs (river-pulse/renderer/<scene>.html) keep working as redirects.
const movedScenes = {
  hacienda: "rivers/russian_river/scenes/middle/hacienda_bridge/",
  jenner: "rivers/russian_river/scenes/end/jenner/",
  freeport: "rivers/sacramento_river/scenes/end/freeport/",
  eel: "rivers/eel_river/scenes/end/scotia_bluffs/",
  tuolumne: "rivers/tuolumne_river/scenes/start/poopenaut_valley/",
};
await mkdir(path.join(out, "river-pulse", "renderer"), { recursive: true });
for (const [name, target] of Object.entries(movedScenes)) {
  const to = `../${target}`;
  await writeFile(path.join(out, "river-pulse", "renderer", `${name}.html`),
    `<!doctype html><meta charset="utf-8"><title>Moved</title><meta http-equiv="refresh" content="0; url=${to}">` +
    `<link rel="canonical" href="${to}"><p>This scene moved to <a href="${to}">${target}</a>.</p>
`);
}
await writeFile(path.join(out, ".nojekyll"), "");
console.log(
  `Built Pages with ${modules.size} browser modules, shared CUDA source and licensed assets.`,
);
