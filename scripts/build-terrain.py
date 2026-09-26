"""Build assets/calaveras-terrain.bin.gz from USGS 3DEP elevation (public domain).

Fetches a UTM 10N (EPSG:32610) float32 GeoTIFF around Calaveras Reservoir from the
National Map 3DEP ImageServer, then packs three uint16 channels per ~10 m cell. Channels
are stored planar (all of channel 0, then 1, then 2), each row as uint16 deltas from the
row above (mod 65536) so gzip can exploit the smooth terrain:

  0  height above the reservoir surface       (metres, see scale/offset in the .json)
  1  signed distance to the shoreline          (metres; negative over water)
  2  valley-ness from smoothed curvature       (0 ridge/spur .. 1 ravine bottom)

Local scene axes: x = east, z = south, y = up, origin at `origin` (UTM) on the water.
Requires numpy, scipy and Pillow.  Usage:  python scripts/build-terrain.py [--native]
--native also writes the same bytes uncompressed to assets/calaveras-terrain.bin (gitignored)
for the native CUDA host, which has no gzip decoder.
"""

import gzip
import io
import json
import math
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"
# Lon/lat box covering the reservoir, the dam, Arroyo Hondo and the enclosing ridges.
BBOX = (-121.875, 37.435, -121.770, 37.530)
SIZE = (900, 1050)
URL = (
    "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/"
    "exportImage?bbox={},{},{},{}&bboxSR=4326&imageSR=32610&size={},{}&format=tiff"
    "&pixelType=F32&noDataInterpretation=esriNoDataMatchAny"
    "&interpolation=RSP_BilinearInterpolation&f=image"
).format(*BBOX, *SIZE)


def utm10(lat, lon):
    """WGS84 lat/lon -> UTM zone 10N easting/northing (Snyder's series, < 1 mm here)."""
    a, f, k0 = 6378137.0, 1 / 298.257223563, 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    phi, lam = math.radians(lat), math.radians(lon)
    lam0 = math.radians(-123.0)
    n = a / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    t = math.tan(phi) ** 2
    c = ep2 * math.cos(phi) ** 2
    A = math.cos(phi) * (lam - lam0)
    m = a * (
        (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * phi
        - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * math.sin(2 * phi)
        + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * math.sin(4 * phi)
        - (35 * e2**3 / 3072) * math.sin(6 * phi)
    )
    east = k0 * n * (
        A + (1 - t + c) * A**3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * A**5 / 120
    ) + 500000.0
    north = k0 * (
        m
        + n
        * math.tan(phi)
        * (
            A * A / 2
            + (5 - t + 9 * c + 4 * c * c) * A**4 / 24
            + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * A**6 / 720
        )
    )
    return east, north


def fetch():
    cache = ROOT / "scripts" / ".cache-3dep.tif"
    if not cache.exists():
        print("Downloading USGS 3DEP elevation...")
        with urllib.request.urlopen(URL, timeout=120) as r:
            cache.write_bytes(r.read())
    img = Image.open(cache)
    scale = img.tag_v2[33550]  # ModelPixelScale
    tie = img.tag_v2[33922]  # ModelTiepoint: raster (0,0) -> UTM (x, y)
    return np.array(img, dtype=np.float32), float(scale[0]), float(scale[1]), tie[3], tie[4]


def main():
    dem, sx, sy, left, top = fetch()
    h, w = dem.shape
    # Lidar hydro-flattens water to one elevation: the most common value near the minimum.
    vals, counts = np.unique(np.round(dem * 10) / 10, return_counts=True)
    water_level = float(vals[counts.argmax()])
    water = np.abs(dem - water_level) < 0.15
    # Keep only the reservoir itself (largest connected flat region), not stray flats.
    labels, _ = ndimage.label(water)
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    water = labels == sizes.argmax()
    water = ndimage.binary_closing(water, iterations=2)
    inside = ndimage.distance_transform_edt(water) * sx
    outside = ndimage.distance_transform_edt(~water) * sx
    sdf = outside - inside

    height = dem - water_level
    height[water] = 0.0
    # Valley-ness: negative Laplacian of the ~120 m smoothed surface = concave ground.
    smooth = ndimage.gaussian_filter(height, 6.0)
    lap = ndimage.laplace(smooth) / (sx * sx)
    spread = np.percentile(np.abs(lap[~water]), 95)
    valley = np.clip(0.5 + 0.5 * lap / spread, 0.0, 1.0)

    # Origin: centroid of the water, rounded to whole cells.
    rows, cols = np.nonzero(water)
    oc, orow = float(cols.mean()), float(rows.mean())
    origin_e, origin_n = left + (oc + 0.5) * sx, top - (orow + 0.5) * sy

    # Lowlands below the dam sit ~200 m under the reservoir surface.
    h_off, h_scale = -250.0, 0.05  # -250 .. 3026 m at 5 cm
    d_off, d_scale = -4000.0, 0.25  # -4000 .. 12383 m at 25 cm
    planes = [
        np.clip(np.round((height - h_off) / h_scale), 0, 65535).astype(np.int64),
        np.clip(np.round((sdf - d_off) / d_scale), 0, 65535).astype(np.int64),
        np.round(valley * 1023).astype(np.int64) * 64,
    ]
    OUT.mkdir(exist_ok=True)
    body = b""
    for plane in planes:
        delta = plane.copy()
        delta[1:] = (plane[1:] - plane[:-1]) % 65536
        body += delta.astype("<u2").tobytes()
    with gzip.GzipFile(OUT / "calaveras-terrain.bin.gz", "wb", compresslevel=9, mtime=0) as g:
        g.write(body)
    if "--native" in sys.argv:
        (OUT / "calaveras-terrain.bin").write_bytes(body)

    def local(lat, lon):
        e, n = utm10(lat, lon)
        return round(e - origin_e, 1), round(origin_n - n, 1)

    meta = {
        "source": "USGS National Map 3D Elevation Program (3DEP), public domain",
        "service": "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer",
        "bbox_lonlat": BBOX,
        "crs": "EPSG:32610",
        "verticalDatum": "NAVD88 metres (3DEP)",
        "encoding": "gzip; 3 planar uint16 channels; rows delta-coded from the row above",
        "width": w,
        "height": h,
        "cell": [sx, sy],
        "waterLevel": water_level,
        "originUTM": [origin_e, origin_n],
        # Local position of raster cell (0,0) centre: x east, z south, metres.
        "gridOrigin": [left + 0.5 * sx - origin_e, origin_n - (top - 0.5 * sy)],
        "channels": {
            "height": {"offset": h_off, "scale": h_scale},
            "shoreDistance": {"offset": d_off, "scale": d_scale},
            "valley": {"offset": 0, "scale": 1 / 65472},
        },
        "landmarks": {
            "handoffReference": local(37.478472, -121.822639),
        },
    }
    (OUT / "calaveras-terrain.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps({k: meta[k] for k in ("waterLevel", "originUTM", "gridOrigin", "landmarks")}))
    print("water cells", int(water.sum()), "area km2", round(water.sum() * sx * sy / 1e6, 2))
    print("height range", float(height.min()), float(height.max()))
    print("bytes", (OUT / "calaveras-terrain.bin.gz").stat().st_size)


if __name__ == "__main__":
    main()
