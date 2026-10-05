// Fail on broken relative links in tracked Markdown. Run: node scripts/check-doc-links.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const P = path.posix, files = execFileSync("git", ["ls-files", "*.md"], { encoding: "utf8" }).split("\n").filter(f => f && fs.existsSync(f));
const broken = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const [, target] of text.matchAll(/\]\((?!https?:|#|mailto:)([^)\s#]+)(?:#[^)\s]*)?\)/g)) {
    const resolved = P.normalize(P.join(P.dirname(file), decodeURIComponent(target.replace(/\?.*$/, ""))));
    if (!fs.existsSync(resolved)) broken.push(`${file}: ${target}`);
  }
}
if (broken.length) { console.log(broken.join("\n")); console.log(`\n${broken.length} broken link(s) in ${files.length} Markdown files.`); process.exit(1); }
console.log(`Documentation links valid (${files.length} Markdown files).`);
