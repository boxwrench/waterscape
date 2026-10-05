// River Pulse terrain loader: absolute USGS 3DEP elevations with no still-water assumptions.
//
// The bundle stores one row-delta-coded uint16 elevation plane. Scene x is east, z is south,
// and scene y is elevation relative to an optional sceneVerticalOffset. The absolute NAVD88
// relation remains available through elevation().
import { utmInverse } from "../../renderer/terrain.js";

export const RIVER_TERRAIN_SCHEMA = "river-pulse-terrain-0.1";

export class RiverTerrain {
  constructor(meta, elevation) {
    if (meta.schemaVersion !== RIVER_TERRAIN_SCHEMA)
      throw new Error(`Unsupported River Pulse terrain schema: ${meta.schemaVersion}`);
    if (elevation.length !== meta.width * meta.height)
      throw new Error("River terrain elevation length does not match metadata.");

    this.meta = meta;
    this.elevationCells = elevation;
    this.width = meta.width;
    this.height = meta.height;
    [this.cellX, this.cellZ] = meta.cell;
    [this.x0, this.z0] = meta.gridOrigin;
    this.verticalOffset = meta.sceneVerticalOffset ?? 0;
  }

  // Bilinear scene elevation in metres. Source elevation remains absolute in the decoded cells;
  // verticalOffset is only a rendering-space translation.
  ground(x, z) {
    return this.sampleElevation(x, z) - this.verticalOffset;
  }

  sampleElevation(x, z) {
    const u = Math.min(Math.max((x - this.x0) / this.cellX, 0), this.width - 1.001),
      v = Math.min(Math.max((z - this.z0) / this.cellZ, 0), this.height - 1.001),
      iu = u | 0,
      iv = v | 0,
      fu = u - iu,
      fv = v - iv,
      i = iv * this.width + iu,
      c = this.elevationCells,
      top = c[i] + (c[i + 1] - c[i]) * fu,
      bottom = c[i + this.width] + (c[i + this.width + 1] - c[i + this.width]) * fu;
    return top + (bottom - top) * fv;
  }

  // Scene y -> source vertical datum elevation.
  elevation(sceneY) {
    return sceneY + this.verticalOffset;
  }

  // Local metres -> WGS84. originUTM is the configured place anchor; z grows south.
  latLon(x, z) {
    const [oe, on] = this.meta.originUTM;
    return utmInverse(oe + x, on - z, this.meta.utmZone);
  }

  // First ray hit on the lidar surface. Used for inspection/clicking and compatible with the
  // Waterscape camera's terrain-clearance contract.
  pick(ox, oy, oz, dx, dy, dz, maxDistance = 20000) {
    let t = 0,
      previous = 0;
    while (t < maxDistance) {
      const x = ox + dx * t,
        y = oy + dy * t,
        z = oz + dz * t,
        delta = y - this.ground(x, z);
      if (delta < 0) {
        let lo = previous,
          hi = t;
        for (let k = 0; k < 20; k++) {
          const mid = (lo + hi) / 2;
          if (oy + dy * mid - this.ground(ox + dx * mid, oz + dz * mid) < 0) hi = mid;
          else lo = mid;
        }
        const hx = ox + dx * hi,
          hz = oz + dz * hi,
          hy = this.ground(hx, hz);
        return { x: hx, y: hy, z: hz, elevation: this.elevation(hy), distance: hi };
      }
      previous = t;
      t += Math.max(2, Math.min(50 + t * 0.02, Math.max(2, delta * 0.5)));
    }
    return null;
  }

  // Generic GPU representation for future River Pulse passes: two float4 header texels followed
  // by one float4 per terrain cell. X contains scene elevation; remaining channels are reserved.
  gpuCells() {
    const out = new Float32Array(this.elevationCells.length * 4 + 8);
    out.set([this.width, this.height, this.x0, this.z0, this.cellX, this.cellZ, this.verticalOffset, 0]);
    for (let i = 0; i < this.elevationCells.length; i++) out[8 + i * 4] = this.elevationCells[i] - this.verticalOffset;
    return out;
  }
}

export function decodeRiverTerrain(meta, raw) {
  if (meta.schemaVersion !== RIVER_TERRAIN_SCHEMA)
    throw new Error(`Unsupported River Pulse terrain schema: ${meta.schemaVersion}`);
  const n = meta.width * meta.height,
    codec = meta.channels?.elevation;
  if (!codec || !Number.isFinite(codec.scale) || !Number.isFinite(codec.offset))
    throw new Error("River terrain metadata lacks a valid elevation codec.");
  if (raw.byteLength !== n * 2) throw new Error("River terrain asset has an unexpected size.");

  const view = new DataView(raw),
    row = new Uint16Array(meta.width),
    elevation = new Float32Array(n);
  row.fill(0);
  for (let r = 0; r < meta.height; r++)
    for (let i = 0; i < meta.width; i++) {
      row[i] = (row[i] + view.getUint16(2 * (r * meta.width + i), true)) & 0xffff;
      elevation[r * meta.width + i] = row[i] * codec.scale + codec.offset;
    }
  return new RiverTerrain(meta, elevation);
}

async function fetchOk(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}

export async function loadRiverTerrain(base) {
  const meta = await (await fetchOk(`${base}.json`)).json(),
    fetched = await (await fetchOk(`${base}.bin.gz`)).arrayBuffer(),
    magic = new Uint8Array(fetched, 0, Math.min(2, fetched.byteLength)),
    raw =
      magic.length === 2 && magic[0] === 0x1f && magic[1] === 0x8b
        ? await new Response(new Blob([fetched]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
        : fetched;
  return decodeRiverTerrain(meta, raw);
}
