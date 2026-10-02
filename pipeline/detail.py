"""1 m lidar detail patches around a bundle's close cameras (roadmap L4).

The bundle grid (``terrain.bin.gz``) samples USGS 3DEP at ~10 m. Near a camera at the water
that smooths away the bank and turns the waterline into stair-steps, so this writes a finer
patch around each viewpoint whose ``above`` is under 3 m:

  detail-<view>.bin.gz  planar uint16 channels on a grid ``sub`` times finer than the bundle's,
                        aligned to its cell lines: height above the water, signed shoreline
                        distance and valley (the bundle's codecs), then the blend weight
                        (0 at the patch edge, 1 inside); rows delta-coded like terrain.bin.gz
  detail.json           one entry per patch: placement, grid, source project and tiles

Heights come from the USGS 1 m DEM GeoTIFFs on S3, read by HTTP range (no full-tile download)
and resampled from NAD83 to the bundle's WGS84 UTM grid. The bundle's water level stays the
authority: 1 m ground at or below it is water, so a survey that caught the lake low adds the
exposed bank to the bed rather than moving the shoreline. The patch blends into the bundle grid
over its outer ``FEATHER`` metres and matches it exactly on its edge, where both are linear
along the shared cell lines.

Requires numpy, scipy and rasterio.  Usage:
  python pipeline/detail.py <id> [--project <USGS 1 m project>]... [--cells 61]
"""

import gzip
import json
import math
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from scipy import ndimage

import dem as demlib

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / ".cache"
S3 = "https://prd-tnm.s3.amazonaws.com"
PREFIX = "StagedProducts/Elevation/1m/Projects/"
SUB = 10            # patch cells per bundle cell (~1 m)
FEATHER = 50.0      # metres over which the patch blends into the bundle grid
NEAR = 3.0          # viewpoints with `above` below this get a patch
WEIGHT = {"offset": 0.0, "scale": 1 / 65535}
SHORE_FAR = (40.0, 60.0)  # beyond this from any shore the bundle's distance field is kept


def decode_bundle(rid):
    """(terrain.json, height, shoreDistance, valley) as float arrays, rows north to south."""
    meta = json.loads((ROOT / "data" / rid / "terrain.json").read_text())
    raw = gzip.open(ROOT / "data" / rid / "terrain.bin.gz").read()
    w, h = meta["width"], meta["height"]
    planes = []
    for c, key in enumerate(("height", "shoreDistance", "valley")):
        d = np.frombuffer(raw, "<u2", w * h, c * w * h * 2).reshape(h, w).astype(np.int64)
        codec = meta["channels"][key]
        planes.append((np.cumsum(d, axis=0) % 65536) * codec["scale"] + codec["offset"])
    return meta, planes[0], planes[1], planes[2]


def patch_window(meta, x, z, cells):
    """Bundle cell (i0, j0) of the patch's north-west corner, centred on scene (x, z)."""
    cell = meta["cell"][0]
    x0, z0 = meta["gridOrigin"]
    ci, cj = round((x - x0) / cell), round((z - z0) / cell)
    i0 = min(max(ci - cells // 2, 0), meta["width"] - 1 - cells)
    j0 = min(max(cj - cells // 2, 0), meta["height"] - 1 - cells)
    return i0, j0


def fine_coords(meta, i0, j0, cells, sub=SUB):
    """Scene x (columns) and z (rows) of the patch's vertices."""
    cell = meta["cell"][0]
    x0, z0 = meta["gridOrigin"]
    k = np.arange(cells * sub + 1) / sub
    return x0 + (i0 + k) * cell, z0 + (j0 + k) * cell


def coarse_at(plane, i0, j0, cells, sub=SUB):
    """Bilinear bundle values at the patch vertices (exact on the shared cell lines)."""
    k = np.arange(cells * sub + 1) / sub
    rows, cols = np.meshgrid(j0 + k, i0 + k, indexing="ij")
    return ndimage.map_coordinates(plane, [rows, cols], order=1, mode="nearest")


def feather_weight(n, step, width=FEATHER):
    """0 on the patch edge rising smoothly to 1 at `width` metres inside."""
    d = np.minimum(np.arange(n), np.arange(n)[::-1]) * step
    edge = np.minimum.outer(d, d)
    t = np.clip(edge / width, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def signed_shore(water, step):
    """Signed distance to the waterline in metres: negative over water, positive on land."""
    return (ndimage.distance_transform_edt(~water) - ndimage.distance_transform_edt(water)) * step


def combine(h1, h10, s10, v10, step):
    """Patch channels from 1 m heights above the water (`h1`, NaN where unsurveyed) and the
    bundle's values at the same vertices. Returns (height, shore, valley, weight)."""
    water = np.where(np.isnan(h1), s10 < 0, h1 <= 0.0)
    s1 = signed_shore(water, step)
    # Far from any shore the patch-limited distance transform is wrong; keep the bundle's field.
    far = np.clip((np.abs(s10) - SHORE_FAR[0]) / (SHORE_FAR[1] - SHORE_FAR[0]), 0.0, 1.0)
    s1 = s1 * (1 - far) + s10 * far
    hfine = np.where(np.isnan(h1), h10, np.where(water, 0.0, h1))
    w = feather_weight(h1.shape[0], step)
    return (w * hfine + (1 - w) * h10, w * s1 + (1 - w) * s10, v10, w)


def pack(height, shore, valley, weight):
    """Four planar uint16 channels, rows delta-coded from the row above (mod 65536)."""
    body = demlib.pack(height, shore, valley)
    plane = np.clip(np.round(weight / WEIGHT["scale"]), 0, 65535).astype(np.int64)
    delta = plane.copy()
    delta[1:] = (plane[1:] - plane[:-1]) % 65536
    return body + delta.astype("<u2").tobytes()


def tile_name(zone, e, n):
    """USGS 1 m DEM tile key (10 km tiles named by their north-west corner)."""
    return f"x{math.floor(e / 1e4)}y{math.ceil(n / 1e4)}"


def _list(prefix):
    out, token = [], None
    while True:
        q = {"list-type": "2", "prefix": prefix, "delimiter": "/"}
        if token:
            q["continuation-token"] = token
        with urllib.request.urlopen(f"{S3}/?{urllib.parse.urlencode(q)}", timeout=60) as r:
            text = r.read().decode()
        out += [p.split("<")[0] for p in text.split("<Prefix>")[1:]]
        if "<NextContinuationToken>" not in text:
            return out
        token = text.split("<NextContinuationToken>")[1].split("<")[0]


def find_projects(state, zone, tile):
    """1 m projects (newest survey year first) that publish `tile`, from a cached S3 index."""
    CACHE.mkdir(parents=True, exist_ok=True)
    index = CACHE / f"usgs-1m-{state}.json"
    if index.exists():
        links = json.loads(index.read_text())
    else:
        links = {}
        for p in _list(PREFIX):
            name = p[len(PREFIX):].strip("/")
            if not name.startswith(state + "_"):
                continue
            try:
                with urllib.request.urlopen(f"{S3}/{PREFIX}{name}/0_file_download_links.txt", timeout=60) as r:
                    links[name] = r.read().decode()
            except OSError:
                continue
        index.write_text(json.dumps(links))
    key = f"USGS_1M_{zone}_{tile}_"
    year = lambda n: max([int(y) for y in re.findall(r"(?:19|20)\d\d", n)] or [0])
    return sorted((n for n, text in links.items() if key in text), key=lambda n: (year(n), n), reverse=True)


def read_1m(projects, zone, xs_utm, ys_utm):
    """1 m elevations (NaN where unsurveyed) at WGS84 UTM points, first project wins."""
    import rasterio
    from rasterio.warp import transform
    from rasterio.windows import from_bounds

    shape = xs_utm.shape
    out = np.full(shape, np.nan)
    used = []
    ex, ny = transform(f"EPSG:326{zone:02d}", f"EPSG:269{zone:02d}", xs_utm.ravel(), ys_utm.ravel())
    ex, ny = np.asarray(ex).reshape(shape), np.asarray(ny).reshape(shape)
    tiles = {(math.floor(e / 1e4), math.ceil(n / 1e4))
             for e in (ex.min(), ex.max()) for n in (ny.min(), ny.max())}
    for project in projects:
        for tx, ty in sorted(tiles):
            url = f"/vsicurl/{S3}/{PREFIX}{project}/TIFF/USGS_1M_{zone}_x{tx}y{ty}_{project}.tif"
            try:
                src = rasterio.open(url)
            except Exception:
                continue
            with src:
                win = from_bounds(ex.min() - 2, ny.min() - 2, ex.max() + 2, ny.max() + 2, src.transform)
                win = win.round_offsets().round_lengths()
                a = src.read(1, window=win, boundless=True, fill_value=np.nan).astype(np.float64)
                if src.nodata is not None:
                    a[a == src.nodata] = np.nan
                inv = ~src.window_transform(win)
                col, row = inv * (ex, ny)
                vals = ndimage.map_coordinates(a, [row - 0.5, col - 0.5], order=1, cval=np.nan)
            fill = np.isnan(out) & ~np.isnan(vals)
            if fill.any():
                out[fill] = vals[fill]
                used.append(f"USGS_1M_{zone}_x{tx}y{ty}_{project}")
        if not np.isnan(out).any():
            break
    return out, used


def build(rid, projects=None, cells=61):
    meta, height, shore, valley = decode_bundle(rid)
    views = json.loads((ROOT / "data" / rid / "cameras.json").read_text())["viewpoints"]
    zone, level = meta["utmZone"], meta["waterLevel"]
    oe, on = meta["originUTM"]
    step = meta["cell"][0] / SUB
    patches = []
    for name, view in views.items():
        if view["above"] >= NEAR:
            continue
        i0, j0 = patch_window(meta, view["x"], view["z"], cells)
        xs, zs = fine_coords(meta, i0, j0, cells)
        X, Z = np.meshgrid(xs, zs)
        found = projects or find_projects("CA", zone, tile_name(zone, oe + view["x"], on - view["z"]))
        if not found:
            raise ValueError(f"{rid}/{name}: no USGS 1 m project covers the camera")
        elev, used = read_1m(found, zone, oe + X, on - Z)
        if not used:
            raise ValueError(f"{rid}/{name}: could not read 1 m tiles from {found}")
        h10, s10, v10 = (coarse_at(p, i0, j0, cells) for p in (height, shore, valley))
        h, s, v, w = combine(elev - level, h10, s10, v10, step)
        file = f"detail-{name}.bin.gz"
        demlib.write_gzip(ROOT / "data" / rid / file, pack(h, s, v, w))
        coverage = float(np.mean(~np.isnan(elev)))
        patches.append({
            "view": name, "file": file, "i0": i0, "j0": j0, "cells": cells, "sub": SUB,
            "width": cells * SUB + 1, "height": cells * SUB + 1,
            "source": "USGS 3DEP 1 m DEM, public domain",
            "tiles": sorted(set(used)), "coverage": round(coverage, 4),
        })
        print(f"{rid}/{name}: {cells * step * SUB:.0f} m patch at cell ({i0}, {j0}), "
              f"{coverage:.1%} surveyed, from {', '.join(sorted(set(used)))}")
    out = {
        "encoding": "gzip; 4 planar uint16 channels (height, shoreDistance, valley, weight); "
                    "rows delta-coded from the row above",
        "channels": {"height": demlib.HEIGHT, "shoreDistance": demlib.SHORE, "valley": demlib.VALLEY,
                     "weight": WEIGHT},
        "feather": FEATHER,
        "patches": patches,
    }
    (ROOT / "data" / rid / "detail.json").write_text(json.dumps(out, indent=2) + "\n")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        sys.exit("usage: python pipeline/detail.py <id> [--project <name>]... [--cells 61]")
    rid, projects, cells = args[0], [], 61
    for i, a in enumerate(args):
        if a == "--project":
            projects.append(args[i + 1])
        if a == "--cells":
            cells = int(args[i + 1])
    build(rid, projects or None, cells)
