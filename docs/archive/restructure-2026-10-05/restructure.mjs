// One-time River Pulse restructure (RP31). Kept for the record; do not re-run.
//   node restructure.mjs --dry     print the move table and checks
//   node restructure.mjs --apply   git mv every file, then rewrite path references
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const P = path.posix, RP = "river-pulse/", apply = process.argv.includes("--apply");
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 28 });
const tracked = git("ls-files").split("\n").filter(Boolean);
const oldFiles = tracked.filter(f => f.startsWith(RP)).map(f => f.slice(RP.length));

const SCENE = {
  hacienda: "rivers/russian_river/scenes/middle/hacienda_bridge",
  jenner: "rivers/russian_river/scenes/end/jenner",
  freeport: "rivers/sacramento_river/scenes/end/freeport",
  eel: "rivers/eel_river/scenes/end/scotia_bluffs",
  tuolumne: "rivers/tuolumne_river/scenes/start/poopenaut_valley",
};
const rules = [];                                   // [old, new]; old is a file or a directory prefix
const file = (o, n) => rules.push([o, n]);
const inScene = (scene, names, from = "renderer/") => names.forEach(n => file(from + n, `${SCENE[scene]}/${n}`));
const toKit = names => names.forEach(n => file("renderer/" + n, "scene-kit/" + n));

// Scene code. Each page becomes the scene's index.html.
for (const s of Object.keys(SCENE)) file(`renderer/${s}.html`, `${SCENE[s]}/index.html`);
inScene("hacienda", ["hacienda.js", "hacienda.css", "hacienda-beach.js", "hacienda-bridge.js", "hacienda-flow.css",
  "hacienda-interface.js", "hacienda-label.css", "hacienda-seasonal.js", "hacienda-time.css", "hacienda-time.js",
  "beach-layout.js", "beach-woodland.js"]);
inScene("jenner", ["jenner.js", "jenner.css", "jenner-layout.js", "jenner-setting.js", "jenner-water.js"]);
inScene("freeport", ["freeport.js", "freeport.css", "freeport-bridge-layout.js", "freeport-bridge.js", "freeport-layout.js",
  "freeport-riverfront-layout.js", "freeport-setting.js", "freeport-surroundings.js", "freeport-water.js"]);
inScene("eel", ["eel.js", "eel-hero-terrain.js", "eel-layout.js", "eel-setting-layout.js", "eel-setting.js",
  "eel-state-layout.js", "eel-state.js", "eel-water-depth.js", "eel-water-spike.js"]);
inScene("tuolumne", ["tuolumne.js", "tuolumne.css", "tuolumne-dam.js", "tuolumne-water.js"]);
file("visual-bindings/jenner-level.js", `${SCENE.jenner}/jenner-level.js`);
file("visual-bindings/freeport-discharge.js", `${SCENE.freeport}/freeport-discharge.js`);

// Shared 3D and chrome.
toKit(["terrain.js", "terrain-mesh.js", "terrain-style.js", "terrain-surface-detail.js", "hydrography.js",
  "river-centerline.js", "map-flow.js", "map-ribbon-geometry.js", "authored-water.js", "authored-water-geometry.js",
  "bank-materials.js", "bank-setting.js", "bank-setting-layout.js", "beach-materials.js", "reservoir-context.js",
  "reservoir-context-pose.js"]);
file("renderer/jenner-noise.js", "scene-kit/water-noise.js");
file("renderer/eel.css", "ui/study-scene.css");

// Generic logic and the two pages.
file("adapters", "core/adapters"); file("data-model", "core/data-model"); file("visual-bindings", "core/visual-bindings");
for (const f of ["atlas.js", "atlas.css", "river.js", "river.css"]) file(f, "app/" + f);
file("data/registry.json", "registry.json");
file("data/california-overview.json", "app/data/california-overview.json");
file("data/california-relief.jpg", "app/data/california-relief.jpg");

// Data: river manifests, thumbnails, and each place's data folder.
for (const r of ["american_river", "eel_river", "russian_river", "sacramento_river", "san_joaquin_river", "tuolumne_river"])
  file(`data/${r}/river.json`, `rivers/${r}/river.json`);
const thumb = (r, id, s) => file(`data/${r}/scenes/${id}.jpg`, `${SCENE[s]}/thumb.jpg`);
thumb("russian_river", "hacienda_bridge", "hacienda"); thumb("russian_river", "jenner_estuary", "jenner");
thumb("sacramento_river", "freeport", "freeport"); thumb("eel_river", "scotia_bluffs", "eel");
thumb("tuolumne_river", "poopenaut_valley", "tuolumne");
file("data/russian_river/places/hacienda_bridge", `${SCENE.hacienda}/data`);
file("data/russian_river/places/jenner", `${SCENE.jenner}/data`);
file("data/sacramento_river/places/freeport", `${SCENE.freeport}/data`);
file("data/eel_river/places/scotia_bluffs", `${SCENE.eel}/data`);
file("data/tuolumne_river/foundation/poopenaut", `${SCENE.tuolumne}/data`);

// Most specific rule first. A rule matches a file, a directory prefix, or an extensionless prefix ("x/terrain").
rules.sort((a, b) => b[0].length - a[0].length);
const mapPath = p => {
  for (const [o, n] of rules) {
    if (p === o) return n;
    if (p.startsWith(o + "/")) return n + p.slice(o.length);
    if (p.startsWith(o + ".") && !o.endsWith("/")) return n + p.slice(o.length);
  }
  return p;                                          // README.md, index.html, river.html stay
};

const moves = oldFiles.map(o => [o, mapPath(o)]);
const dup = moves.map(m => m[1]).filter((n, i, a) => a.indexOf(n) !== i);
if (dup.length) throw new Error("Collisions: " + dup.join(", "));
const unmapped = moves.filter(([o, n]) => o === n && !["README.md", "index.html", "river.html"].includes(o));
if (unmapped.length) throw new Error("Unmapped files: " + unmapped.map(m => m[0]).join(", "));

if (!apply) {
  for (const [o, n] of moves) if (o !== n) console.log(`${o}  ->  ${n}`);
  console.log(`\n${moves.filter(m => m[0] !== m[1]).length} files move; ${moves.length} total; no collisions, nothing unmapped.`);
  process.exit(0);
}

// ---------- apply: git mv, then rewrite references ----------
for (const [o, n] of moves) {
  if (o === n) continue;
  fs.mkdirSync(P.dirname(RP + n), { recursive: true });
  git("mv", RP + o, RP + n);
}
const newOf = new Map(moves.map(([o, n]) => [RP + o, RP + n]));          // old repo path -> new repo path
const oldOfNew = new Map([...newOf].map(([o, n]) => [n, o]));
const oldAll = new Set(tracked), oldDirs = new Set();
for (const f of tracked) for (let d = P.dirname(f); d !== "."; d = P.dirname(d)) oldDirs.add(d);
const existsOld = t => oldAll.has(t) || oldDirs.has(t) || tracked.some(f => f.startsWith(t + ".") || f.startsWith(t + "/"));
const mapRepo = t => t.startsWith(RP) ? RP + mapPath(t.slice(RP.length)) : t;
const textExt = /\.(js|mjs|html|css|json|py|yml|yaml)$/;
const skipDir = /^(node_modules|dist|vendor|\.git|docs|previews)\//;
const report = [];
let changed = 0;

for (const nowPath of git("ls-files").split("\n").filter(Boolean)) {
  if (!textExt.test(nowPath) || skipDir.test(nowPath) && !/^previews\/.*\.html$/.test(nowPath)) continue;
  const oldPath = oldOfNew.get(nowPath) ?? nowPath;
  if (!fs.existsSync(nowPath)) continue;
  const before = fs.readFileSync(nowPath, "utf8");
  // (1) relative path literals: quoted strings and url() starting ./ or ../
  let after = before.replace(/(["'`(])(\.{1,2}\/[^"'`)\s${}]*)/g, (whole, q, lit) => {
    const [pathPart, tail = ""] = lit.split(/(?=[?#])/);
    const target = P.normalize(P.join(P.dirname(oldPath), pathPart));
    if (target.startsWith("..") || !existsOld(target.replace(/\/$/, ""))) return whole;
    const trailing = pathPart.endsWith("/") ? "/" : "";
    let rel = P.relative(P.dirname(nowPath), mapRepo(target.replace(/\/$/, "")));
    if (!rel.startsWith(".")) rel = "./" + rel;
    return q + rel + trailing + tail;
  });
  // (2) repo-root-relative mentions of river-pulse/... (tests, scripts, python, workflows)
  after = after.replace(/(?<![\w./-])river-pulse\/([\w./@-]*[\w/])/g, (whole, sub) => {
    const mapped = mapPath(sub);
    return mapped === sub ? whole : RP + mapped;
  });
  if (after !== before) { fs.writeFileSync(nowPath, after); changed++; }
}
console.log(`Rewrote references in ${changed} files.`);
