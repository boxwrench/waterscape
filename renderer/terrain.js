// Reservoir terrain (USGS 3DEP lidar, public domain) for the host: decoding the packed
// asset for the GPU, CPU-side sampling for collisions and elevation readouts, cursor picking,
// and local metres -> WGS84. The renderer is the visual authority; this mirrors its lidar
// surface without the shader's sub-grid detail noise.

export class Terrain {
  constructor(meta, cells) {
    this.meta = meta;
    this.cells = cells; // Float32 (height, shoreDistance, valley, drawdown or 0) per cell
    this.width = meta.width;
    this.height = meta.height;
    this.cell = meta.cell[0];
    [this.x0, this.z0] = meta.gridOrigin;
    this.waterLevel = meta.waterLevel;
  }
  // GPU layout read by terrainSample() in water.cu: two header texels
  // (width, height, x0, z0) and (cell, 0, 0, 0), then the cells.
  gpuCells() {
    const out = new Float32Array(this.cells.length + 8);
    out.set([this.width, this.height, this.x0, this.z0, this.cell, 0, 0, 0]);
    out.set(this.cells, 8);
    return out;
  }
  // Bilinear lookup of one channel, clamped at the grid edge exactly like terrainSample().
  sample(x, z, channel) {
    const w = this.width,
      u = Math.min(Math.max((x - this.x0) / this.cell, 0), w - 1.001),
      v = Math.min(Math.max((z - this.z0) / this.cell, 0), this.height - 1.001),
      iu = u | 0,
      iv = v | 0,
      fu = u - iu,
      fv = v - iv,
      i = (iv * w + iu) * 4 + channel,
      c = this.cells,
      top = c[i] + (c[i + 4] - c[i]) * fu,
      bottom = c[i + w * 4] + (c[i + w * 4 + 4] - c[i + w * 4]) * fu;
    return top + (bottom - top) * fv;
  }
  shoreDistance(x, z) {
    return this.sample(x, z, 1);
  }
  // Ground (or water surface) height in scene metres, 0 = reservoir surface.
  ground(x, z) {
    return this.shoreDistance(x, z) < 0 ? 0 : this.sample(x, z, 0);
  }
  // Scene y -> metres above sea level (NAVD88).
  elevation(y) {
    return y + this.waterLevel;
  }
  // First hit of a view ray on land or water, or null. Coarse march plus bisection.
  pick(ox, oy, oz, dx, dy, dz, maxDistance = 16000) {
    let t = 0,
      prev = 0;
    while (t < maxDistance) {
      const x = ox + dx * t,
        y = oy + dy * t,
        z = oz + dz * t,
        delta = y - this.ground(x, z);
      if (delta < 0) {
        let lo = prev,
          hi = t;
        for (let k = 0; k < 20; k++) {
          const mid = (lo + hi) / 2;
          if (oy + dy * mid - this.ground(ox + dx * mid, oz + dz * mid) < 0) hi = mid;
          else lo = mid;
        }
        const hx = ox + dx * hi,
          hz = oz + dz * hi;
        return {
          x: hx,
          z: hz,
          y: this.ground(hx, hz),
          distance: hi,
          water: this.shoreDistance(hx, hz) < 0,
        };
      }
      prev = t;
      t += Math.max(2, Math.min(40 + t * 0.02, delta * 0.5));
    }
    return null;
  }
  // Local metres (x east, z south) -> [lat, lon] via inverse UTM (the bundle's zone; older
  // bundles without utmZone are zone 10).
  latLon(x, z) {
    const [oe, on] = this.meta.originUTM;
    return utmInverse(oe + x, on - z, this.meta.utmZone ?? 10);
  }
}

async function fetchOk(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
}

export async function loadTerrain(base) {
  const meta = await (await fetchOk(`${base}.json`)).json(),
    fetched = await (await fetchOk(`${base}.bin.gz`)).arrayBuffer(),
    magic = new Uint8Array(fetched, 0, 2),
    // Some hosts send .gz with Content-Encoding: gzip, so it may arrive already inflated.
    raw =
      magic[0] === 0x1f && magic[1] === 0x8b
        ? await new Response(
            new Blob([fetched]).stream().pipeThrough(new DecompressionStream("gzip")),
          ).arrayBuffer()
        : fetched,
    { width: w, height: h, channels } = meta,
    n = w * h,
    view = new DataView(raw),
    cells = new Float32Array(n * 4),
    row = new Uint16Array(w),
    // An optional fourth channel: the full-pool drawdown zone (0-1), where a body has one.
    codecs = [channels.height, channels.shoreDistance, channels.valley, channels.drawdown].filter(Boolean);
  if (raw.byteLength !== n * 2 * codecs.length) throw new Error("Terrain asset has an unexpected size.");
  // Planar channels, each row stored as uint16 deltas from the row above.
  codecs.forEach(({ scale, offset }, c) => {
    row.fill(0);
    for (let r = 0; r < h; r++)
      for (let i = 0; i < w; i++) {
        row[i] += view.getUint16(2 * (c * n + r * w + i), true);
        cells[(r * w + i) * 4 + c] = row[i] * scale + offset;
      }
  });
  return new Terrain(meta, cells);
}

// Inverse transverse Mercator (Snyder), WGS84, northern-hemisphere UTM zone.
export function utmInverse(east, north, zone) {
  const a = 6378137,
    f = 1 / 298.257223563,
    k0 = 0.9996,
    e2 = f * (2 - f),
    ep2 = e2 / (1 - e2),
    e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2)),
    m = north / k0,
    mu = m / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256)),
    phi1 =
      mu +
      ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
      ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
      ((151 * e1 ** 3) / 96) * Math.sin(6 * mu),
    s = Math.sin(phi1),
    c1 = ep2 * Math.cos(phi1) ** 2,
    t1 = Math.tan(phi1) ** 2,
    n1 = a / Math.sqrt(1 - e2 * s * s),
    r1 = (a * (1 - e2)) / (1 - e2 * s * s) ** 1.5,
    d = (east - 500000) / (n1 * k0),
    lat =
      phi1 -
      ((n1 * Math.tan(phi1)) / r1) *
        ((d * d) / 2 -
          ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4) / 24 +
          ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6) / 720),
    lon =
      (d -
        ((1 + 2 * t1 + c1) * d ** 3) / 6 +
        ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5) / 120) /
      Math.cos(phi1);
  return [(lat * 180) / Math.PI, -183 + 6 * zone + (lon * 180) / Math.PI];
}

export function formatElevation(metres) {
  return `${Math.round(metres).toLocaleString()} m · ${Math.round(metres * 3.28084).toLocaleString()} ft`;
}

export function formatLatLon([lat, lon]) {
  const dms = (v, pos, neg) => {
    const a = Math.abs(v),
      d = Math.floor(a),
      m = Math.floor((a - d) * 60),
      s = ((a - d) * 60 - m) * 60;
    return `${d}°${String(m).padStart(2, "0")}′${s.toFixed(1).padStart(4, "0")}″${v >= 0 ? pos : neg}`;
  };
  return `${dms(lat, "N", "S")} ${dms(lon, "E", "W")}`;
}
