"""Build one reservoir bundle in data/<id>/ from USGS 3DEP elevation (public domain).

  terrain.bin.gz  planar uint16 channels (height, shoreline distance, valley), rows
                  delta-coded; scales/offsets in terrain.json
  terrain.json    grid, datum, water level, origin, channel codecs, name, biome
  cameras.json    viewpoints (pinned in reservoirs.json or searched) and flyover keys

Local axes: x east, z south, y up from the reservoir surface, origin at the water centroid.
Requires numpy, scipy, Pillow.  Usage:  python pipeline/build_bundle.py <id> [--native]
--native also writes the uncompressed terrain.bin (gitignored) for the native CUDA host.
"""

import json
import sys
from pathlib import Path

import numpy as np

import cameras
import dem as demlib

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "pipeline"


def build(rid, native=False):
    config = json.loads((PIPELINE / "reservoirs.json").read_text())[rid]
    dem, sx, sy, left, top = demlib.fetch_dem(rid, config["bbox"], config["size"], PIPELINE / ".cache")
    water, level = demlib.detect_water(dem)
    height, sdf, valley = demlib.channels(dem, water, level, sx)
    rows, cols = np.nonzero(water)
    origin_e = left + (float(cols.mean()) + 0.5) * sx
    origin_n = top - (float(rows.mean()) + 0.5) * sy
    grid_origin = [left + 0.5 * sx - origin_e, origin_n - (top - 0.5 * sy)]

    out = ROOT / "data" / rid
    out.mkdir(parents=True, exist_ok=True)
    body = demlib.pack(height, sdf, valley)
    demlib.write_gzip(out / "terrain.bin.gz", body)
    if native:
        (out / "terrain.bin").write_bytes(body)
    h, w = dem.shape
    meta = {
        "source": "USGS National Map 3D Elevation Program (3DEP), public domain",
        "name": config["name"],
        "biome": config["biome"],
        "service": demlib.SERVICE,
        "bbox_lonlat": config["bbox"],
        "crs": "EPSG:32610",
        "verticalDatum": "NAVD88 metres (3DEP)",
        "encoding": "gzip; 3 planar uint16 channels; rows delta-coded from the row above",
        "width": w,
        "height": h,
        "cell": [sx, sy],
        "waterLevel": level,
        "originUTM": [origin_e, origin_n],
        "gridOrigin": grid_origin,
        "channels": {"height": demlib.HEIGHT, "shoreDistance": demlib.SHORE, "valley": demlib.VALLEY},
    }
    (out / "terrain.json").write_text(json.dumps(meta, indent=2) + "\n")

    grid = cameras.Grid(height, sdf, grid_origin[0], grid_origin[1], sx)
    views = config.get("viewpoints") or cameras.search_viewpoints(grid)
    cams = {"viewpoints": views, "flyover": cameras.flyover_keys(grid, views["overlook"])}
    (out / "cameras.json").write_text(json.dumps(cams, indent=2) + "\n")
    area = water.sum() * sx * sy / 1e6
    print(f"{rid}: water {level:.1f} m, {area:.2f} km2, grid {w}x{h} @ {sx:.2f} m, origin {grid_origin}")
    print(f"{rid}: viewpoints {', '.join(v['label'] for v in views.values())}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: python pipeline/build_bundle.py <id> [--native]")
    build(sys.argv[1], native="--native" in sys.argv)
