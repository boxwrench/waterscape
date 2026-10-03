"""USGS 3DEP 1 m relief for a water body's detail tiles: real cracks, ledges and outcrops that
the 10 m terrain grid cannot hold, used as lighting (surface normals) by the ground shader.

Usage:  python pipeline/detail.py <id>
Reads "detail" from data/<id>/land.json: [{"name": ..., "centre": [lat, lon], "size": [w, h]}]
(metres). For each tile writes data/<id>/detail-<name>.webp — the 1 m surface normal, x (east)
in red and z (south) in green, 128 = level, and local relief in blue — and lists the tiles, their UTM extents and the
request URLs in data/<id>/detail.json.
"""
import io
import json
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

import dem as demlib
import geo

ROOT = Path(__file__).resolve().parent.parent
RES = 1.0
CHUNK = 1000  # metres per request; the service times out on larger 1 m exports


def fetch_chunk(left, bottom, size_x, size_y, zone):
    cache = ROOT / "pipeline" / ".cache" / f"3dep1m_{zone}_{left}_{bottom}_{size_x}_{size_y}.npy"
    url = (
        f"{demlib.SERVICE}/exportImage?bbox={left},{bottom},{left + size_x},{bottom + size_y}"
        f"&bboxSR=326{zone:02d}&imageSR=326{zone:02d}&size={int(size_x / RES)},{int(size_y / RES)}"
        "&format=tiff&pixelType=F32&interpolation=RSP_BilinearInterpolation&f=image"
    )
    if cache.exists():
        return np.load(cache), url
    for attempt in range(6):
        try:
            with urllib.request.urlopen(url, timeout=300) as r:
                data = np.array(Image.open(io.BytesIO(r.read())), dtype=np.float32)
            cache.parent.mkdir(parents=True, exist_ok=True)
            np.save(cache, data)
            return data, url
        except Exception as error:  # the service answers 502/504 under load; retry
            print(f"  retry {attempt + 1}: {error}")
            time.sleep(10 * (attempt + 1))
    raise RuntimeError(f"3DEP export failed: {url}")


def encode_normals(dem, cell):
    """RGB uint8: the surface normal's x (east) and z (south) as 128 + 127·n; blue the local
    relief (metres above the 3 m-blurred surface, ±1.5 m as 128 ± 127): hollows and cracks
    are dark, edges and knobs light."""
    gz, gx = np.gradient(dem, cell)  # rows run south, columns east
    nx, ny, nz = -gx, np.ones_like(gx), gz
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.zeros(dem.shape + (3,), np.uint8)
    rgb[..., 0] = np.clip(np.round(128 + 127 * nx / length), 0, 255)
    rgb[..., 1] = np.clip(np.round(128 + 127 * nz / length), 0, 255)
    local = np.clip(dem - ndimage.gaussian_filter(dem, 3.0 / cell), -1.5, 1.5)
    rgb[..., 2] = np.clip(np.round(128 + 127 * local / 1.5), 0, 255)
    return rgb


def build(rid):
    out = ROOT / "data" / rid
    land = json.loads((out / "land.json").read_text())
    meta = json.loads((out / "terrain.json").read_text())
    zone = meta["utmZone"]
    tiles = []
    for tile in land.get("detail", []):
        e, n = geo.utm(*tile["centre"], zone)
        w, h = tile["size"]
        left, top = round(e - w / 2), round(n + h / 2)
        rows, urls = [], []
        for y in range(0, h, CHUNK):
            row = []
            for x in range(0, w, CHUNK):
                cw, ch = min(CHUNK, w - x), min(CHUNK, h - y)
                part, url = fetch_chunk(left + x, top - y - ch, cw, ch, zone)
                row.append(part)
                urls.append(url)
            rows.append(np.hstack(row))
        relief = np.vstack(rows)
        file = f"detail-{tile['name']}.webp"
        Image.fromarray(encode_normals(relief, RES)).save(out / file, quality=88, method=6)
        tiles.append({"name": tile["name"], "file": file, "extentUTM": [left, top - h, left + w, top],
                      "cell": RES, "sources": urls})
        print(f"{rid}: detail {tile['name']} {w}x{h} m at {RES} m -> {file} ({(out / file).stat().st_size // 1024} KB)")
    (out / "detail.json").write_text(json.dumps({
        "source": "USGS National Map 3D Elevation Program (3DEP) 1 m, public domain",
        "encoding": "red = normal x (east), green = normal z (south), 128 + 127·n; blue = local relief, metres above the 3 m-blurred surface, 128 + 127·h/1.5",
        "tiles": tiles,
    }, indent=2) + "\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    build(sys.argv[1])
