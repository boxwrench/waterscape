// A water body: one folder in data/<id>/ (lidar terrain, cameras, land profile) plus its
// biome from data/biomes/<biome>/.
import { loadTerrain } from "../terrain.js";

export async function loadBody(id, onProgress = () => {}) {
  if (!/^[a-z0-9_]+$/.test(id)) throw new Error(`Invalid water body id: ${id}`);
  const base = new URL(`../../data/${id}/`, import.meta.url),
    json = async (file) => {
      const r = await fetch(new URL(file, base));
      if (!r.ok) throw new Error(`${r.status} ${file}`);
      return r.json();
    };
  onProgress("Loading USGS lidar terrain…");
  const terrain = await loadTerrain(new URL("terrain", base).href),
    [cameras, land, biome] = await Promise.all([
      json("cameras.json"),
      json("land.json"),
      json(`../biomes/${terrain.meta.biome}/biome.json`),
    ]);
  return { id, base, terrain, viewpoints: cameras.viewpoints, flyover: cameras.flyover, land, biome };
}

// A named viewpoint as a camera pose, standing `above` metres over the lidar ground.
export function viewpoint(body, name) {
  const { x, z, above, yaw, pitch, speed } = body.viewpoints[name];
  return { x, z, y: body.terrain.ground(x, z) + above, yaw, pitch, speed };
}
