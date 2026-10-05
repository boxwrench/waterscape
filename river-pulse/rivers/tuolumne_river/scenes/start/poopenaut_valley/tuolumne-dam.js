// Reuse the reservoir structure without importing its terrain or water assumptions.
import { vec3 } from "../../../../../../vendor/three/three.tsl.js";
import { createStructures, crestScene, crestCurve, gravityProfile } from "../../../../../../renderer/land/structures.js";

export function damTerrainAdapter(terrain, structures) {
  if (terrain.meta.crs !== "EPSG:32611") throw new Error("Hetch Hetchy dam requires UTM zone 11N.");
  const dam = structures.dams[0], reference = structures.rivers[0]?.centreUTM[0];
  if (!dam || dam.utmZone !== terrain.meta.utmZone || !reference)
    throw new Error("Dam placement needs its original crest and downstream reference.");
  const meta = { ...terrain.meta, waterLevel: terrain.verticalOffset },
    crest = crestScene(dam, meta), [cx, cz] = crest[Math.floor(crest.length / 2)],
    dx = reference[0] - meta.originUTM[0] - cx,
    dz = meta.originUTM[1] - reference[1] - cz;
  // This signed projection only chooses the dry side of the existing profile.
  // It is not a shoreline-distance dataset; no reservoir water level is copied.
  return { meta, shoreDistance: (x, z) => (x - cx) * dx + (z - cz) * dz };
}

export async function createTuolumneDam(terrain, structures, sun) {
  const direction = sun.position.clone().normalize(),
    uniforms = {
      sun: vec3(direction.x, direction.y, direction.z),
      sunColor: vec3(sun.color.r * sun.intensity, sun.color.g * sun.intensity, sun.color.b * sun.intensity),
      fill: vec3(0.72, 0.75, 0.72),
    };
  return createStructures(damTerrainAdapter(terrain, structures), { dams: structures.dams, rivers: [] }, { uniforms }, {
    waitForTextures: true, showOutletJets: false, packShadedTag: false,
  });
}

export function damContactPositions(positions, terrain, structures) {
  const out = positions.slice(), adapter = damTerrainAdapter(terrain, structures),
    dam = structures.dams[0], crest = crestCurve(crestScene(dam, adapter.meta)),
    top = dam.crestElevation - terrain.verticalOffset,
    width = Math.max(...gravityProfile(dam.height).map(([u]) => u)),
    margin = 1.6 * Math.max(terrain.cellX, terrain.cellZ),
    minX = Math.min(...crest.map(p => p.x)) - width - margin,
    maxX = Math.max(...crest.map(p => p.x)) + width + margin,
    minZ = Math.min(...crest.map(p => p.z)) - width - margin,
    maxZ = Math.max(...crest.map(p => p.z)) + width + margin;
  // Same authored clearance principle as pipeline/dem.py:carve_dams. Only the
  // visible structure contact is adjusted. Native cells/source mesh are retained.
  for (let k = 0; k < out.length; k += 3) {
    const x = out[k], z = out[k + 2];
    if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
    let best = Infinity, signed = 0, within = false;
    for (let i = 1; i < crest.length; i++) {
      const a = crest[i - 1], b = crest[i], dx = b.x - a.x, dz = b.z - a.z,
        l2 = dx * dx + dz * dz, raw = ((x - a.x) * dx + (z - a.z) * dz) / l2,
        t = Math.max(0, Math.min(1, raw)), px = a.x + t * dx, pz = a.z + t * dz,
        dist = Math.hypot(x - px, z - pz);
      if (dist >= best) continue;
      best = dist; signed = ((x - px) * -dz + (z - pz) * dx) / Math.sqrt(l2);
      within = !((i === 1 && raw < 0) || (i === crest.length - 1 && raw > 1));
    }
    if (!within) continue;
    if (signed >= 0 && best <= width) {
      const face = best <= 7.5 ? top - 1 : top - 6 - (best - 7.5) / 0.75;
      out[k + 1] = Math.min(out[k + 1], face - 6);
    }
    if (best <= margin) out[k + 1] = Math.min(out[k + 1], top - dam.height);
  }
  return out;
}
