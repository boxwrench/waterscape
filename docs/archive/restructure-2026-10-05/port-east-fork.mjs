// One-time port of origin/task/RP13-publish (East Fork, river map, Jenner and Hacienda work, built on the
// pre-restructure layout) onto the RP31 layout. Kept for the record; do not re-run.
//   node port-east-fork.mjs --dry     list what happens to each file
//   node port-east-fork.mjs --apply   write ported files; three-way merges where both lines edited
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const P = path.posix, BASE = "7ec68d6", THEIRS = "origin/task/RP13-publish", RP = "river-pulse/", apply = process.argv.includes("--apply");
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 28 });
const show = (rev, f) => execFileSync("git", ["show", `${rev}:${f}`], { maxBuffer: 1 << 28 }).toString("utf8");

const SCENE = {
  hacienda: "rivers/russian_river/scenes/middle/hacienda_bridge", jenner: "rivers/russian_river/scenes/end/jenner",
  freeport: "rivers/sacramento_river/scenes/end/freeport", eel: "rivers/eel_river/scenes/end/scotia_bluffs",
  tuolumne: "rivers/tuolumne_river/scenes/start/poopenaut_valley", eastfork: "rivers/russian_river/scenes/start/east_fork",
};
const rules = [], file = (o, n) => rules.push([o, n]);
const inScene = (s, names, from = "renderer/") => names.forEach(n => file(from + n, `${SCENE[s]}/${n}`));
const toKit = names => names.forEach(n => file("renderer/" + n, "scene-kit/" + n));
for (const s of ["hacienda", "jenner", "freeport", "eel", "tuolumne"]) file(`renderer/${s}.html`, `${SCENE[s]}/index.html`);
inScene("hacienda", ["hacienda.js", "hacienda.css", "hacienda-beach.js", "hacienda-bridge.js", "hacienda-flow.css", "hacienda-interface.js",
  "hacienda-label.css", "hacienda-seasonal.js", "hacienda-time.css", "hacienda-time.js", "beach-layout.js", "beach-woodland.js"]);
inScene("jenner", ["jenner.js", "jenner.css", "jenner-layout.js", "jenner-setting.js", "jenner-water.js"]);
inScene("freeport", ["freeport.js", "freeport.css"]);
inScene("tuolumne", ["tuolumne.js", "tuolumne.css"]);
toKit(["terrain.js", "terrain-mesh.js", "terrain-style.js", "hydrography.js", "river-centerline.js", "map-flow.js", "map-ribbon-geometry.js",
  "authored-water.js", "authored-water-geometry.js", "bank-materials.js", "bank-setting.js", "bank-setting-layout.js", "beach-materials.js"]);
file("renderer/jenner-noise.js", "scene-kit/water-noise.js");
file("renderer/river-map.js", "scene-kit/river-map.js"); file("renderer/river-map.css", "ui/river-map.css");
file("renderer/east-fork.html", `${SCENE.eastfork}/index.html`);
inScene("eastfork", ["east-fork.js", "east-fork-layout.js", "east-fork-setting.js"]);
file("visual-bindings/hacienda-extremes.js", `${SCENE.hacienda}/hacienda-extremes.js`);
file("adapters", "core/adapters"); file("data-model", "core/data-model"); file("visual-bindings", "core/visual-bindings");
file("data/registry.json", "registry.json");
file("data/russian_river/overview.json", "rivers/russian_river/map/overview.json");
file("data/russian_river/places/hacienda_bridge", `${SCENE.hacienda}/data`);
file("data/russian_river/places/jenner", `${SCENE.jenner}/data`);
file("data/russian_river/places/east_fork", `${SCENE.eastfork}/data`);
file("data/sacramento_river/places/freeport", `${SCENE.freeport}/data`);
file("data/eel_river/places/scotia_bluffs", `${SCENE.eel}/data`);
for (const r of ["american_river", "eel_river", "russian_river", "sacramento_river", "san_joaquin_river", "tuolumne_river"]) file(`data/${r}/river.json`, `rivers/${r}/river.json`);
rules.sort((a, b) => b[0].length - a[0].length);
const mapSub = p => { for (const [o, n] of rules) { if (p === o) return n; if (p.startsWith(o + "/")) return n + p.slice(o.length); } return p; };
const mapRepo = p => p.startsWith(RP) ? RP + mapSub(p.slice(RP.length)) : p;
const SPECIAL = {
  "docs/river-pulse/east-fork-scene.md": `${RP}${SCENE.eastfork}/README.md`,
  "docs/river-pulse/river-structure.md": "docs/river-pulse/reference/choosing-places.md",
};
const SKIP = new Set(["README.md", "docs/HANDOFF.md", "river-pulse/README.md", "river-pulse/data/registry.json", "scripts/build.mjs", "scripts/verify-build.mjs"]);
const destOf = o => SPECIAL[o] ?? mapRepo(o);

const theirFiles = git("ls-tree", "-r", "--name-only", THEIRS).split("\n").filter(Boolean);
const exists = new Set(theirFiles), dirs = new Set();
for (const f of theirFiles) for (let d = P.dirname(f); d !== "."; d = P.dirname(d)) dirs.add(d);
const known = t => exists.has(t) || dirs.has(t) || theirFiles.some(f => f.startsWith(t + ".") || f.startsWith(t + "/"));
const textExt = /\.(js|mjs|html|css|json|py)$/;

// Translate a file's path strings from the old layout to the new one.
function rewrite(text, oldPath, newPath) {
  let out = text.replace(/(["'`(])(\.{1,2}\/[^"'`)\s${}]*)/g, (whole, q, lit) => {
    const [pathPart, tail = ""] = lit.split(/(?=[?#])/), target = P.normalize(P.join(P.dirname(oldPath), pathPart)).replace(/\/$/, "");
    if (target.startsWith("..") || !known(target)) return whole;
    let rel = P.relative(P.dirname(newPath), destOf(target)); if (!rel.startsWith(".")) rel = "./" + rel;
    return q + rel + (pathPart.endsWith("/") ? "/" : "") + tail;
  });
  out = out.replace(/(?<![\w./-])river-pulse\/([\w./@-]*[\w/])/g, (whole, sub) => { const m = mapSub(sub); return m === sub ? whole : RP + m; });
  return out;
}

const changes = git("diff", "--name-status", BASE, THEIRS).split("\n").filter(Boolean).map(l => l.split("\t"));
const plan = [];
for (const [status, o] of changes) {
  if (SKIP.has(o)) { plan.push({ o, action: "skip" }); continue; }
  plan.push({ o, n: destOf(o), action: status === "A" ? "add" : "merge" });
}
if (!apply) { for (const p of plan) console.log(`${p.action.padEnd(5)} ${p.o}${p.n ? "  ->  " + p.n : ""}`); process.exit(0); }

const conflicts = [];
for (const p of plan) {
  if (p.action === "skip") continue;
  const theirs = show(THEIRS, p.o), theirsR = textExt.test(p.o) ? rewrite(theirs, p.o, p.n) : theirs;
  fs.mkdirSync(P.dirname(p.n), { recursive: true });
  if (p.action === "add" || !fs.existsSync(p.n)) { fs.writeFileSync(p.n, theirsR); console.log("added   ", p.n); continue; }
  const baseR = textExt.test(p.o) ? rewrite(show(BASE, p.o), p.o, p.n) : show(BASE, p.o), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "port-"));
  const a = path.join(tmp, "ours"), b = path.join(tmp, "base"), c = path.join(tmp, "theirs");
  // The checkout is CRLF (core.autocrlf); git blobs are LF. Compare like with like.
  fs.writeFileSync(a, fs.readFileSync(p.n, "utf8").replace(/\r\n/g, "\n")); fs.writeFileSync(b, baseR); fs.writeFileSync(c, theirsR);
  const r = spawnSync("git", ["merge-file", "-p", "-L", "ours(RP31)", "-L", "base", "-L", "east-fork(RP13)", a, b, c], { encoding: "utf8", maxBuffer: 1 << 28 });
  fs.writeFileSync(p.n, r.stdout);
  console.log(r.status === 0 ? "merged  " : `CONFLICT(${r.status})`, p.n);
  if (r.status > 0) conflicts.push(`${p.n} (${r.status})`);
}
console.log("\nconflicts:", conflicts.length ? "\n  " + conflicts.join("\n  ") : "none");
