// Regenerate the generated blocks in River Pulse READMEs from river.json and scene.json:
//   - each built scene's "Scene card"  (<!-- scene-card --> ... <!-- /scene-card -->)
//   - each river's slot table          (<!-- slots --> ... <!-- /slots -->)
// Edit scene.json / river.json, then run: node scripts/sync-river-readmes.mjs
import fs from "node:fs";
import path from "node:path";

const base = path.resolve("river-pulse/rivers"), read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const flagsText = (data) => Object.entries(data ?? {}).filter(([, v]) => v).map(([k]) => k.replace(/_/g, " ")).join(", ") || "geography only";
const nl = (s) => (s.includes("\r\n") ? "\r\n" : "\n");
function inject(file, startMarker, endMarker, block, afterFirstHeading = true) {
  const raw = fs.readFileSync(file, "utf8"), eol = nl(raw), text = raw.replace(/\r\n/g, "\n"), pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}\\n?`);
  let out;
  if (pattern.test(text)) out = text.replace(pattern, () => block);
  else {
    const heading = text.match(/^# .*\n/m);
    out = heading && afterFirstHeading ? text.slice(0, heading.index + heading[0].length) + "\n" + block + "\n" + text.slice(heading.index + heading[0].length) : block + "\n" + text;
  }
  if (out !== text) fs.writeFileSync(file, out.replace(/\n/g, eol));
}

let cards = 0, tables = 0;
for (const river of fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory())) {
  const riverDir = path.join(base, river.name), manifest = read(path.join(riverDir, "river.json")), rows = [];
  for (const { slot, id } of manifest.scenes) {
    const folder = path.join(riverDir, "scenes", slot, id), scene = read(path.join(folder, "scene.json"));
    if (scene.status !== "built") { rows.push(`| ${slot} | ${scene.name} | **planned** | n/a | n/a |`); continue; }
    rows.push(`| ${slot} | [${scene.name}](scenes/${slot}/${id}/README.md) | built | ${flagsText(scene.data)} | ${scene.views.join(", ")} |`);
    const url = `http://localhost:5173/river-pulse/rivers/${river.name}/scenes/${slot}/${id}/index.html`,
      block = [`<!-- scene-card: generated from scene.json; edit scene.json, then run node scripts/sync-river-readmes.mjs -->`,
        "> **Scene card**", ">", "> | | |", "> |---|---|", `> | River / slot | \`${scene.river}\` / \`${scene.slot}\` |`, `> | Place id | \`${scene.id}\` |`,
        `> | Fidelity | ${scene.fidelity} |`, `> | Data | ${flagsText(scene.data)} |`, `> | Views | ${scene.views.join(", ")} |`,
        `> | Open locally | <${url}> |`, "> | Layout | page `index.html`, scene code beside it, sourced data in `data/`, notes in `notes/` |", "<!-- /scene-card -->", ""].join("\n");
    const readme = path.join(folder, "README.md");
    if (!fs.existsSync(readme)) fs.writeFileSync(readme, `# ${scene.name}\n`);
    inject(readme, "<!-- scene-card", "<!-- /scene-card -->", block); cards++;
  }
  const table = ["<!-- slots: generated from river.json and scene.json files; run node scripts/sync-river-readmes.mjs -->",
    "| Slot | Scene | Status | Data | Views |", "|---|---|---|---|---|", ...rows, "<!-- /slots -->", ""].join("\n"),
    readme = path.join(riverDir, "README.md");
  if (fs.existsSync(readme) && /<!-- slots/.test(fs.readFileSync(readme, "utf8"))) { inject(readme, "<!-- slots", "<!-- /slots -->", table); tables++; }
}
console.log(`Synced ${cards} scene card(s) and ${tables} slot table(s).`);
