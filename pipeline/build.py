"""Build one water-body bundle in data/<id>/ from its source.json and USGS 3DEP elevation
(public domain).

  terrain.bin.gz  planar uint16 channels (height, shoreline distance, valley), rows
                  delta-coded; scales/offsets in terrain.json
  terrain.json    grid, datum, water level, origin, channel codecs, name, biome
  cameras.json    viewpoints (pinned in source.json or searched) and flyover keys

Local axes: x east, z south, y up from the reservoir surface, origin at the water centroid.
Requires numpy, scipy, Pillow.  Usage:  python pipeline/build.py <id> [--native]
--native also writes the uncompressed terrain.bin (gitignored) for the native CUDA host.
"""

import json
import sys
from pathlib import Path

import numpy as np

import cameras
import dem as demlib
import geo

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "pipeline"


def build(rid, native=False):
    config = json.loads((ROOT / "data" / rid / "source.json").read_text())
    anchor_lat, anchor_lon = config["anchor"]
    zone = geo.utm_zone(anchor_lon)
    dem, sx, sy, left, top = demlib.fetch_dem(rid, config["bbox"], config["size"], PIPELINE / ".cache", zone)
    h, w = dem.shape

    def cell_of(lat, lon):
        e, n = geo.utm(lat, lon, zone)
        row, col = round((top - n) / sy - 0.5), round((e - left) / sx - 0.5)
        if not (0 <= row < h and 0 <= col < w):
            raise ValueError(f"{rid}: anchor {[lat, lon]} falls outside the raster")
        return row, col

    # Optional "extraAnchors": more water at the same level, e.g. a lake split by a causeway.
    extra = [cell_of(*a) for a in config.get("extraAnchors", [])]
    water, level = demlib.detect_water(dem, anchor=cell_of(anchor_lat, anchor_lon), extra=extra)
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
    meta = {
        "source": "USGS National Map 3D Elevation Program (3DEP), public domain",
        "name": config["name"],
        "biome": config["biome"],
        "anchor": config["anchor"],
        "service": demlib.SERVICE,
        "bbox_lonlat": config["bbox"],
        "crs": f"EPSG:326{zone:02d}",
        "utmZone": zone,
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
        sys.exit("usage: python pipeline/build.py <id> [--native]")
    build(sys.argv[1], native="--native" in sys.argv)
