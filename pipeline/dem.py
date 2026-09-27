"""USGS 3DEP elevation: fetch, reservoir detection, derived channels and packing."""

import gzip
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SERVICE = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"
HEIGHT = {"offset": -250.0, "scale": 0.05}  # -250 .. 3026 m at 5 cm
SHORE = {"offset": -4000.0, "scale": 0.25}  # -4000 .. 12383 m at 25 cm
VALLEY = {"offset": 0, "scale": 1 / 65472}


def fetch_dem(rid, bbox, size, cache_dir, zone):
    """Float32 UTM elevation grid in the given zone; returns (dem, cell_x, cell_y, left, top)."""
    cache = Path(cache_dir) / f"{rid}_z{zone}.tif"
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        url = (
            f"{SERVICE}/exportImage?bbox={bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}&bboxSR=4326"
            f"&imageSR=326{zone:02d}&size={size[0]},{size[1]}&format=tiff&pixelType=F32"
            "&noDataInterpretation=esriNoDataMatchAny&interpolation=RSP_BilinearInterpolation&f=image"
        )
        with urllib.request.urlopen(url, timeout=120) as r:
            cache.write_bytes(r.read())
    img = Image.open(cache)
    scale, tie = img.tag_v2[33550], img.tag_v2[33922]
    return np.array(img, dtype=np.float32), float(scale[0]), float(scale[1]), tie[3], tie[4]


def detect_water(dem, anchor=None, min_area_cells=5000):
    """Lidar hydro-flattens water: the reservoir is the largest connected region at the
    most common elevation, or (with an anchor) the flat region containing the anchor.
    Returns (mask, water_level)."""
    if anchor is not None:
        r, c = anchor
        anchor_level = float(dem[r, c])
        neighbourhood = dem[max(r - 1, 0):r + 2, max(c - 1, 0):c + 2]
        if not np.all(np.abs(neighbourhood - anchor_level) < 0.15):
            raise ValueError(f"anchor {anchor} is not on lidar-flattened water")
        level = round(anchor_level * 10) / 10
        labels, _ = ndimage.label(np.abs(dem - level) < 0.15)
        water = ndimage.binary_closing(labels == labels[r, c], iterations=2)
    else:
        vals, counts = np.unique(np.round(dem * 10) / 10, return_counts=True)
        level = float(vals[counts.argmax()])
        labels, _ = ndimage.label(np.abs(dem - level) < 0.15)
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        water = ndimage.binary_closing(labels == sizes.argmax(), iterations=2)
    if water.sum() < min_area_cells:
        raise ValueError(f"no reservoir found (largest flat region {int(water.sum())} cells)")
    return water, level


def channels(dem, water, level, cell):
    """(height above water, signed shoreline distance in metres, valley-ness 0..1)."""
    sdf = ndimage.distance_transform_edt(~water) * cell - ndimage.distance_transform_edt(water) * cell
    height = dem - level
    height[water] = 0.0
    lap = ndimage.laplace(ndimage.gaussian_filter(height, 6.0)) / (cell * cell)
    spread = np.percentile(np.abs(lap[~water]), 95)
    valley = np.clip(0.5 + 0.5 * lap / spread, 0.0, 1.0)
    return height, sdf, valley


def pack(height, sdf, valley):
    """Planar uint16 channels, each row delta-coded from the row above (mod 65536)."""
    planes = [
        np.clip(np.round((height - HEIGHT["offset"]) / HEIGHT["scale"]), 0, 65535).astype(np.int64),
        np.clip(np.round((sdf - SHORE["offset"]) / SHORE["scale"]), 0, 65535).astype(np.int64),
        np.round(valley * 1023).astype(np.int64) * 64,
    ]
    body = b""
    for plane in planes:
        delta = plane.copy()
        delta[1:] = (plane[1:] - plane[:-1]) % 65536
        body += delta.astype("<u2").tobytes()
    return body


def write_gzip(path, body):
    with gzip.GzipFile(path, "wb", compresslevel=9, mtime=0) as g:
        g.write(body)
