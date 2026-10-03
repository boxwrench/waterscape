// Schema checks for water-body bundles in data/<id>/, their biomes (data/biomes/<biome>/)
// and tours (data/tours/<tour>.json).
// Usage: node pipeline/validate-bundles.mjs   (exits 1 and lists problems on failure)
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRESET_NAMES } from "../renderer/engine/presets.js";

export const REQUIRED = ["terrain.bin.gz", "terrain.json", "cameras.json", "story.json", "land.json", "source.json", "flyover.mp4", "poster.jpg"];

export async function validateBundle(dir) {
  const id = path.basename(dir),
    errors = [];
  for (const file of REQUIRED)
    await stat(path.join(dir, file)).catch(() => errors.push(`${id}: missing ${file}`));
  if (errors.length) return errors;
  const json = async (file) => JSON.parse(await readFile(path.join(dir, file), "utf8"));
  const [terrain, cameras, story, land, source] = await Promise.all(
    ["terrain.json", "cameras.json", "story.json", "land.json", "source.json"].map(json),
  );
  for (const key of ["name", "biome", "width", "height", "cell", "gridOrigin", "waterLevel", "originUTM", "channels"])
    if (terrain[key] === undefined) errors.push(`${id}: terrain.json lacks ${key}`);
  for (const name of ["overlook", "ridge", "shore"]) {
    const v = cameras.viewpoints?.[name];
    if (!v) errors.push(`${id}: cameras.json lacks viewpoint ${name}`);
    else
      for (const key of ["x", "z", "above", "yaw", "pitch", "speed", "label"])
        if (v[key] === undefined) errors.push(`${id}: viewpoint ${name} lacks ${key}`);
  }
  const keys = cameras.flyover?.keys ?? [];
  if (keys.length < 2) errors.push(`${id}: flyover needs at least 2 keys`);
  keys.forEach((k, i) => {
    if (i && !(k.t > keys[i - 1].t)) errors.push(`${id}: flyover key ${i} is out of order`);
  });
  if (keys.length >= 2 && Math.abs(keys.at(-1).t - cameras.flyover.duration) > 1e-6)
    errors.push(`${id}: last flyover key must be at duration`);
  if (story.id !== id) errors.push(`${id}: story.json id is ${story.id}`);
  for (const key of ["name", "operator", "headline"])
    if (!story[key]) errors.push(`${id}: story.json lacks ${key}`);
  if (!story.facts?.length) errors.push(`${id}: story.json has no facts`);
  if (story.summary !== undefined) {
    if (typeof story.summary?.value !== "string" || !story.summary.value.trim())
      errors.push(`${id}: summary needs text`);
    if (!/^https:\/\//.test(story.summary?.source ?? ""))
      errors.push(`${id}: summary has no https source`);
  }
  (story.facts ?? []).forEach((f, i) => {
    if (f.featured !== undefined && typeof f.featured !== "boolean")
      errors.push(`${id}: fact ${i} featured must be boolean`);
    if (!f.label || !f.value) errors.push(`${id}: fact ${i} needs a label and a value`);
    if (!/^https:\/\//.test(f.source ?? ""))
      errors.push(`${id}: fact ${i} (${f.label}) has no https source`);
  });
  if (land.biome !== terrain.biome)
    errors.push(`${id}: land.json biome ${land.biome} differs from terrain.json ${terrain.biome}`);
  for (const name of land.presets ?? [])
    if (!PRESET_NAMES.includes(name)) errors.push(`${id}: land.json names unknown preset ${name}`);
  if (!land.presets?.includes(land.defaultPreset))
    errors.push(`${id}: land.json defaultPreset ${land.defaultPreset} is not in its presets`);
  if (!["spring", "summer"].includes(land.defaultSeason))
    errors.push(`${id}: land.json defaultSeason ${land.defaultSeason} is not spring or summer`);
  if (land.water) {
    for (const key of ["maxDepth", "bankSlope"])
      if (!(land.water[key] > 0)) errors.push(`${id}: land.json water.${key} must be a positive number`);
    if (!/^https:\/\//.test(land.water.maxDepthSource ?? ""))
      errors.push(`${id}: land.json water.maxDepthSource must be an https URL`);
  }
  // Optional map inset (pipeline/aerial.py): its image must exist and its source be recorded.
  const aerial = await readFile(path.join(dir, "aerial.json"), "utf8").then(JSON.parse, () => null);
  if (aerial) {
    await stat(path.join(dir, aerial.file ?? "")).catch(() => errors.push(`${id}: aerial.json names a missing image`));
    if (!/^https:\/\//.test(aerial.source ?? "")) errors.push(`${id}: aerial.json source must be an https URL`);
  }
  const biomeFile = path.join(path.dirname(dir), "biomes", source.biome ?? "", "biome.json");
  await stat(biomeFile).catch(() =>
    errors.push(`${id}: biome ${source.biome} has no data/biomes/${source.biome}/biome.json`),
  );
  if (source.biome !== terrain.biome)
    errors.push(`${id}: source.json biome ${source.biome} differs from terrain.json ${terrain.biome}`);
  return errors;
}

// Biomes (data/biomes/<biome>/biome.json): every file a biome lists must exist.
export async function validateBiomes(root) {
  const dir = path.join(root, "data", "biomes"),
    errors = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const biome = JSON.parse(await readFile(path.join(dir, d.name, "biome.json"), "utf8"));
    for (const layer of Object.values(biome.ground ?? {}))
      for (const file of layer.files ?? [])
        await stat(path.join(dir, d.name, file)).catch(() => errors.push(`biome ${d.name}: missing ${file}`));
  }
  return errors;
}

// Tours (data/tours/<tour>.json): ordered stops, each an existing water body.
export async function validateTours(root) {
  const dir = path.join(root, "data", "tours"),
    errors = [];
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json"))) {
    const tour = JSON.parse(await readFile(path.join(dir, file), "utf8")),
      name = file.slice(0, -5);
    if (!tour.title) errors.push(`tour ${name}: no title`);
    if (!tour.stops?.length) errors.push(`tour ${name}: no stops`);
    for (const stop of tour.stops ?? []) {
      if (!stop.caption) errors.push(`tour ${name}: stop ${stop.id} has no caption`);
      await stat(path.join(root, "data", stop.id)).catch(() =>
        errors.push(`tour ${name}: no bundle for stop ${stop.id}`),
      );
    }
  }
  return errors;
}

export async function validateAll(root) {
  const dirs = (await readdir(path.join(root, "data"), { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !["biomes", "tours", "structures"].includes(d.name))
    .map((d) => path.join(root, "data", d.name));
  return [...(await Promise.all(dirs.map(validateBundle))).flat(), ...(await validateTours(root)), ...(await validateBiomes(root))];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await validateAll(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  for (const e of errors) console.error(e);
  console.log(errors.length ? `${errors.length} bundle problem(s)` : "Bundles valid.");
  process.exitCode = errors.length ? 1 : 0;
}
