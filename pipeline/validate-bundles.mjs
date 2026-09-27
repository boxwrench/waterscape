// Schema checks for reservoir bundles in data/<id>/ (and, from Task 7, journey.json).
// Usage: node pipeline/validate-bundles.mjs   (exits 1 and lists problems on failure)
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED = ["terrain.bin.gz", "terrain.json", "cameras.json", "story.json", "flyover.mp4", "poster.jpg"];

export async function validateBundle(dir) {
  const id = path.basename(dir),
    errors = [];
  for (const file of REQUIRED)
    await stat(path.join(dir, file)).catch(() => errors.push(`${id}: missing ${file}`));
  if (errors.length) return errors;
  const json = async (file) => JSON.parse(await readFile(path.join(dir, file), "utf8"));
  const [terrain, cameras, story] = await Promise.all(
    ["terrain.json", "cameras.json", "story.json"].map(json),
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
  (story.facts ?? []).forEach((f, i) => {
    if (!f.label || !f.value) errors.push(`${id}: fact ${i} needs a label and a value`);
    if (!/^https:\/\//.test(f.source ?? ""))
      errors.push(`${id}: fact ${i} (${f.label}) has no https source`);
  });
  return errors;
}

export async function validateJourney(root) {
  const journey = JSON.parse(await readFile(path.join(root, "journey.json"), "utf8")),
    errors = [];
  if (!journey.stops?.length) errors.push("journey.json has no stops");
  for (const stop of journey.stops ?? []) {
    if (!stop.caption) errors.push(`journey.json: stop ${stop.id} has no caption`);
    await stat(path.join(root, "data", stop.id)).catch(() =>
      errors.push(`journey.json: no bundle for stop ${stop.id}`),
    );
  }
  return errors;
}

export async function validateAll(root) {
  const dirs = (await readdir(path.join(root, "data"), { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => path.join(root, "data", d.name));
  return [...(await Promise.all(dirs.map(validateBundle))).flat(), ...(await validateJourney(root))];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await validateAll(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  for (const e of errors) console.error(e);
  console.log(errors.length ? `${errors.length} bundle problem(s)` : "Bundles valid.");
  process.exitCode = errors.length ? 1 : 0;
}
