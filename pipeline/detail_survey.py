"""L4 survey: what the ~10 m bundle grid loses against USGS 1 m lidar around each Shoreline camera.

Reads 640 m windows straight from the USGS staged 1 m DEM GeoTIFFs on S3 (no full-tile
download) and compares them with each bundle's terrain: water level over the lake, relief
lost on land within 300 m, and how much of that land is ahead of the camera.

Requires numpy, scipy and rasterio (for HTTP range reads of the GeoTIFFs).
Usage:  python pipeline/detail_survey.py [out_dir]   (writes <id>_1m.npy / <id>_10m.npy)
"""
import gzip
import json
import math
import sys

import numpy as np
import rasterio
from rasterio.windows import from_bounds
from scipy import ndimage

from pathlib import Path
ROOT = str(Path(__file__).resolve().parent.parent / "data")
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
S3 = "https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1m/Projects"
PROJECTS = {"calaveras": ["CA_AlamedaCounty_2021_B21", "CA_SantaClaraCounty_2020_A20"],
            "san_antonio": ["CA_AlamedaCounty_2021_B21", "CA_SantaClaraCounty_2020_A20"],
            "crystal_springs": ["CA_CaliforniaGaps_B23"], "san_andreas": ["CA_CaliforniaGaps_B23"]}
HALF = 320

def bundle(rid):
    t = json.load(open(f"{ROOT}/{rid}/terrain.json"))
    raw = gzip.open(f"{ROOT}/{rid}/terrain.bin.gz").read()
    w, h = t["width"], t["height"]; n = w * h
    planes = []
    for c, key in enumerate(["height", "shoreDistance"]):
        d = np.frombuffer(raw, "<u2", n, c * n * 2).reshape(h, w).astype(np.int64)
        p = np.cumsum(d, axis=0) % 65536
        codec = t["channels"][key]
        planes.append(p * codec["scale"] + codec["offset"])
    return t, planes

def sample(plane, t, x, z):
    sx = t["cell"][0]; x0, z0 = t["gridOrigin"]
    return ndimage.map_coordinates(plane, [(z - z0) / sx, (x - x0) / sx], order=1, mode="nearest")

def read_1m(projects, e, n):
    out = np.full((2 * HALF, 2 * HALF), np.nan, np.float32); used = []
    for proj in projects:
        for tx in range(math.floor((e - HALF) / 1e4), math.floor((e + HALF) / 1e4) + 1):
            for ty in range(math.ceil((n - HALF) / 1e4), math.ceil((n + HALF) / 1e4) + 1):
                url = f"/vsicurl/{S3}/{proj}/TIFF/USGS_1M_10_x{tx}y{ty}_{proj}.tif"
                try:
                    with rasterio.open(url) as r:
                        win = from_bounds(e - HALF, n - HALF, e + HALF, n + HALF, r.transform).round_offsets().round_lengths()
                        a = r.read(1, window=win, boundless=True, fill_value=np.nan, masked=False).astype(np.float32)
                        if r.nodata is not None: a[a == r.nodata] = np.nan
                        a = a[:2 * HALF, :2 * HALF]
                        m = np.isnan(out) & ~np.isnan(a[:out.shape[0], :out.shape[1]])
                        if m.any(): out[m] = a[m]; used.append(f"{proj} x{tx}y{ty}")
                except Exception:
                    pass
        if not np.isnan(out).any(): break
    return out, used

for rid in PROJECTS:
    t, (height, shore) = bundle(rid)
    cam = json.load(open(f"{ROOT}/{rid}/cameras.json"))["viewpoints"]["shore"]
    oe, on = t["originUTM"]; e, n = oe + cam["x"], on - cam["z"]
    one, used = read_1m(PROJECTS[rid], e, n)
    # local grid of the 1 m window (pixel centres), scene x/z
    xs = cam["x"] + np.arange(-HALF, HALF) + 0.5
    zs = cam["z"] + np.arange(-HALF, HALF) + 0.5
    X, Z = np.meshgrid(xs, zs)  # raster row 0 is north = smallest scene z
    h10 = sample(height, t, X.ravel(), Z.ravel()).reshape(X.shape) + t["waterLevel"]
    s10 = sample(shore, t, X.ravel(), Z.ravel()).reshape(X.shape)
    level = t["waterLevel"]
    wet = s10 < -15
    lvl1 = float(np.nanmedian(one[wet])) if wet.any() else float("nan")
    r = np.hypot(X - cam["x"], Z - cam["z"])
    land = (s10 > 2) & (r < 300) & ~np.isnan(one)
    diff = (one - h10)[land]
    # forward half-plane per camera yaw (yaw 0 = north = -z)
    fx, fz = math.sin(cam["yaw"]), -math.cos(cam["yaw"])
    ahead = ((X - cam["x"]) * fx + (Z - cam["z"]) * fz) > 0
    print(f"\n{rid}: shore camera x {cam['x']} z {cam['z']}; tiles {used or 'NONE'}")
    if not used: continue
    print(f"  water level: bundle {level:.2f} m, 1 m lidar over the lake {lvl1:.2f} m (diff {lvl1 - level:+.2f})")
    print(f"  land within 300 m: {land.sum()/ (math.pi*300**2):.0%} of the circle; ahead of the camera {(land & ahead).sum() / max(land.sum(),1):.0%} of that land")
    print(f"  1 m minus 10 m on that land: RMS {np.sqrt(np.mean(diff**2)):.2f} m, 95th pct |d| {np.percentile(np.abs(diff),95):.2f} m, max {np.abs(diff).max():.1f} m, mean {diff.mean():+.2f} m")
    near = land & (r < 60)
    if near.any():
        d2 = (one - h10)[near]
        print(f"  within 60 m: RMS {np.sqrt(np.mean(d2**2)):.2f} m, max {np.abs(d2).max():.1f} m")
    # exposed bed: 1 m ground below the bundle water level where the bundle says land (lake was low) or vice versa
    low = (s10 < 0) & (one > level + 0.3) & (r < 300)
    print(f"  bundle-water cells that 1 m shows dry (>0.3 m above level): {low.sum()} m2")
    np.save(OUT / f"{rid}_1m.npy", one)
    np.save(OUT / f"{rid}_10m.npy", h10)
