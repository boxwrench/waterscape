// One-time documentation reorganisation (RP31). Kept for the record; do not re-run.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const P = path.posix, git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 28 });
const RP = "river-pulse/rivers";
const S = {
  hacienda: `${RP}/russian_river/scenes/middle/hacienda_bridge`, jenner: `${RP}/russian_river/scenes/end/jenner`,
  freeport: `${RP}/sacramento_river/scenes/end/freeport`, eel: `${RP}/eel_river/scenes/end/scotia_bluffs`,
  tuolumne: `${RP}/tuolumne_river/scenes/start/poopenaut_valley`,
};
const D = "docs/river-pulse/", REF = D + "reference/", ARC = "docs/archive/river-pulse-history/";
const docMoves = {
  "authored-water.md": `${S.hacienda}/README.md`,
  "hacienda-terrain-spike.md": `${S.hacienda}/notes/hacienda-terrain-spike.md`,
  "seasonal-streamflow-condition.md": `${S.hacienda}/notes/seasonal-streamflow-condition.md`,
  "jenner-scene.md": `${S.jenner}/README.md`,
  "sacramento-freeport-scene.md": `${S.freeport}/README.md`,
  "sacramento-foundation.md": `${RP}/sacramento_river/README.md`,
  "eel-visual-review.md": `${S.eel}/README.md`,
  "tuolumne-foundation.md": `${S.tuolumne}/README.md`,
  "california-overview.md": "river-pulse/app/README.md",
  "implementation-contract.md": REF + "implementation-contract.md",
  "IMPLEMENTATION_NOTES.md": REF + "known-traps.md",
  "waterscape-reuse-audit.md": REF + "waterscape-reuse-audit.md",
  "future-function-references.md": REF + "future-ideas.md",
  "reservoir-renderer-reuse.md": REF + "reservoir-renderer-reuse.md",
  "tuolumne-dam-reuse.md": REF + "tuolumne-dam-reuse.md",
  "ui-design.md": ARC + "ui-design.md", "visual-parity-plan.md": ARC + "visual-parity-plan.md",
  "river-scene-journey.md": ARC + "river-scene-journey.md", "visual-workspace.md": ARC + "visual-workspace.md",
  "rp27-performance-review.md": ARC + "rp27-performance-review.md", "rp27-water-land-review.md": ARC + "rp27-water-land-review.md",
};
for (const f of ["eel-source-audit", "eel-bluff-forest-review", "eel-reservoir-surface-review", "eel-reflection-contact-review",
  "eel-water-optics-review", "eel-water-optics-audit", "eel-hero-lidar-audit", "rp24-source-audit", "rp26-contact-audit", "rp26-reflection-audit"])
  docMoves[f + ".md"] = `${S.eel}/notes/${f}.md`;
for (const f of ["tuolumne-visual-review", "tuolumne-eye-camera-review", "rp24-tuolumne-performance-audit"])
  docMoves[f + ".md"] = `${S.tuolumne}/notes/${f}.md`;
const listed = fs.readdirSync("docs/river-pulse").filter(f => f.endsWith(".md"));
const unmapped = listed.filter(f => !docMoves[f]);
if (unmapped.length) throw new Error("Unmapped docs: " + unmapped);

// Old -> new for every moved path: code moves from the restructure commits, plus these doc moves.
const moved = new Map();
for (const line of git("diff", "--name-status", "-M", "pre-restructure-2026-10-05", "HEAD").split("\n")) {
  const [status, a, b] = line.split("\t"); if (status.startsWith("R")) moved.set(a, b);
}
for (const [f, to] of Object.entries(docMoves)) moved.set(D + f, to);
for (const [f, to] of Object.entries(docMoves)) {
  fs.mkdirSync(P.dirname(to), { recursive: true });
  git("mv", D + f, to);
}
git("mv", "docs/HANDOFF.md", "docs/archive/HANDOFF-through-RP30.md");
moved.set("docs/HANDOFF.md", "docs/archive/HANDOFF-through-RP30.md");

// Rewrite relative markdown links in every tracked .md, resolving against the file's OLD location.
const oldOf = new Map([...moved].map(([o, n]) => [n, o]));
let changed = 0, broken = [];
for (const now of git("ls-files", "*.md").split("\n").filter(Boolean)) {
  if (!fs.existsSync(now) || /^(node_modules|dist)\//.test(now)) continue;
  const old = oldOf.get(now) ?? now, before = fs.readFileSync(now, "utf8");
  const after = before.replace(/\]\((?!https?:|#|mailto:)([^)\s#]+)(#[^)\s]*)?\)/g, (whole, target, hash = "") => {
    const resolved = P.normalize(P.join(P.dirname(old), target));
    const mapped = moved.get(resolved);
    if (!mapped) return whole;
    let rel = P.relative(P.dirname(now), mapped); if (!rel.startsWith(".")) rel = "./" + rel;
    return `](${rel}${hash})`;
  });
  if (after !== before) { fs.writeFileSync(now, after); changed++; }
}
console.log(`Moved ${Object.keys(docMoves).length + 1} docs; rewrote links in ${changed} files.`);
