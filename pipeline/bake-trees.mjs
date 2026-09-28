// Bake a biome's trees (pipeline only): generates each variant listed in
// data/biomes/<biome>/biome.json "trees" with ez-tree (MIT, devDependency) in Microsoft Edge and
// writes compact geometry plus the bark and leaf textures to data/biomes/<biome>/trees/.
// Usage: node pipeline/bake-trees.mjs <biome>
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createStaticServer } from "../scripts/serve.mjs";

const biome = process.argv[2];
if (!biome) throw new Error("Usage: node pipeline/bake-trees.mjs <biome>");
const root = path.resolve(import.meta.dirname, ".."),
  biomeDir = path.join(root, "data", "biomes", biome),
  manifestPath = path.join(biomeDir, "biome.json"),
  manifest = JSON.parse(await readFile(manifestPath, "utf8")),
  treesDir = path.join(biomeDir, "trees");
await mkdir(treesDir, { recursive: true });

const server = createStaticServer(root);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
// Not headless: the impostor photographs need WebGPU.
const browser = await chromium.launch({ channel: "msedge", headless: false, args: ["--enable-unsafe-webgpu"] });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/pipeline/bake-trees.html`);
  await page.waitForFunction(() => window.ready);
  // Each variant twice: full detail near the camera, and a lighter "-far" version (fewer, larger
  // leaves, fewer branch levels) for distance and the low tier.
  const lod = manifest.trees.lod ?? {},
    far = manifest.trees.variants.map((v) => {
      const leaves = v.options?.leaves ?? {};
      return {
        ...v,
        id: `${v.id}-far`,
        options: {
          ...v.options,
          branch: { ...v.options?.branch, ...lod.branch },
          leaves: {
            ...leaves,
            ...(leaves.count ? { count: Math.max(4, Math.round(leaves.count * (lod.leafCountScale ?? 1))) } : {}),
            ...(leaves.size ? { size: leaves.size * (lod.leafSizeScale ?? 1) } : {}),
          },
        },
      };
    }),
    baked = await page.evaluate((variants) => window.bake(variants), [...manifest.trees.variants, ...far]);

  // One little-endian binary per variant: branches then leaves, each as
  // position f32×3, normal f32×3, uv f32×2 per vertex, then u32 indices.
  const out = [];
  for (const v of baked.variants) {
    const parts = {},
      chunks = [];
    let offset = 0;
    for (const name of ["branches", "leaves"]) {
      const g = v[name],
        vertexCount = g.position.length / 3,
        floats = new Float32Array([...g.position, ...g.normal, ...g.uv]),
        indices = new Uint32Array(g.index);
      parts[name] = { vertexCount, indexCount: indices.length, offset };
      chunks.push(Buffer.from(floats.buffer), Buffer.from(indices.buffer));
      offset += floats.byteLength + indices.byteLength;
    }
    await writeFile(path.join(treesDir, `${v.id}.bin`), Buffer.concat(chunks));
    out.push({
      ...[...manifest.trees.variants, ...far].find((x) => x.id === v.id),
      file: `trees/${v.id}.bin`,
      parts,
      height: +v.height.toFixed(3),
      crownRadius: +v.crownRadius.toFixed(3),
      crownCentre: v.crownCentre.map((x) => +x.toFixed(3)),
    });
    console.log(`${biome}: ${v.id} — ${parts.branches.vertexCount} + ${parts.leaves.vertexCount} vertices, height ${v.height.toFixed(1)}, crown r ${v.crownRadius.toFixed(1)}`);
  }
  const textures = {};
  for (const [name, src] of Object.entries(baked.textures)) {
    if (!src?.startsWith("data:")) continue;
    const [, mime, data] = src.match(/^data:image\/(\w+);base64,(.*)$/),
      file = `trees/${name}.${mime === "jpeg" ? "jpg" : mime}`;
    await writeFile(path.join(biomeDir, file), Buffer.from(data, "base64"));
    textures[name] = file;
  }
  // Impostor sheets from the full-detail variants (one row each), spring-tinted per species.
  const spec = manifest.trees.impostors,
    rowsFor = manifest.trees.variants,
    sheets = await page.evaluate(
      ([ids, s]) => window.impostors(ids, s),
      [rowsFor.map((v) => v.id), { ...spec, tints: rowsFor.map((v) => manifest.trees.tints[v.species].spring) }],
    );
  for (const kind of ["albedo", "normal"]) {
    const file = `trees/impostor-${kind}.webp`;
    await writeFile(path.join(biomeDir, file), Buffer.from(sheets[kind].split(",")[1], "base64"));
    textures[`impostor${kind[0].toUpperCase()}${kind.slice(1)}`] = file;
  }
  const impostors = { ...spec, rows: sheets.rows.map((r) => ({ ...r, species: rowsFor.find((v) => v.id === r.id).species })) };
  console.log(`${biome}: impostor sheets ${spec.frames} frames x ${sheets.rows.length} trees`);
  manifest.trees = { ...manifest.trees, baked: out, textures, impostors, generator: "ez-tree 1.1.0 (MIT), pipeline/bake-trees.mjs" };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
} finally {
  await browser.close();
  server.close();
}
