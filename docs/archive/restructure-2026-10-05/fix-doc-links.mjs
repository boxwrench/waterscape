// Second pass of the RP31 documentation move: repair links from moved files to unmoved targets.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const P = path.posix, git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 28 });
const moved = new Map();
for (const line of git("diff", "--name-status", "-M", "pre-restructure-2026-10-05", "HEAD").split("\n")) {
  const [s, a, b] = line.split("\t"); if (s.startsWith("R")) moved.set(a, b);
}
for (const line of git("diff", "--cached", "--name-status", "-M", "HEAD").split("\n")) {
  const [s, a, b] = line.split("\t"); if (s.startsWith("R")) moved.set(a, b);
}
const oldOf = new Map([...moved].map(([o, n]) => [n, o]));
let fixed = 0;
for (const now of git("ls-files", "*.md").split("\n").filter(Boolean)) {
  if (!fs.existsSync(now) || !oldOf.has(now)) continue;
  const old = oldOf.get(now), before = fs.readFileSync(now, "utf8");
  const after = before.replace(/\]\((?!https?:|#|mailto:)([^)\s#]+)(#[^)\s]*)?\)/g, (whole, target, hash = "") => {
    if (fs.existsSync(P.normalize(P.join(P.dirname(now), target.replace(/\?.*$/, ""))))) return whole;   // already fine
    const resolvedOld = P.normalize(P.join(P.dirname(old), target.replace(/\?.*$/, "")));
    const dest = moved.get(resolvedOld) ?? resolvedOld;
    if (!fs.existsSync(dest)) return whole;
    let rel = P.relative(P.dirname(now), dest) + (target.endsWith("/") ? "/" : "");
    if (!rel.startsWith(".")) rel = "./" + rel;
    const query = (target.match(/\?.*$/) ?? [""])[0];
    return `](${rel}${query}${hash})`;
  });
  if (after !== before) { fs.writeFileSync(now, after); fixed++; }
}
console.log(`Repaired links in ${fixed} files.`);
