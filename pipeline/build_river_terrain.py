"""Build a River Pulse terrain bundle from USGS 3DEP without still-water assumptions.

Unlike ``pipeline/build.py`` this builder does not detect a flat reservoir surface, derive a
single water level, or center the scene on a water-body centroid. Elevation is stored as
absolute NAVD88 metres from 3DEP, with a local x/z origin pinned to the configured anchor.

Usage:

    python pipeline/build_river_terrain.py river-pulse/data/russian_river/places/hacienda_bridge/source.json

The source JSON must contain ``id``, ``name``, ``anchor`` [lat, lon], ``bbox``
[west, south, east, north], and ``size`` [width, height].
"""

import gzip
import json
import sys
from pathlib import Path

import numpy as np

import dem as demlib
import geo

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "pipeline"

SCHEMA_VERSION = "river-pulse-terrain-0.1"
ELEVATION = {"offset": -250.0, "scale": 0.05}


def pack_elevation(elevation):
    """Pack absolute elevation as row-delta-coded little-endian uint16 values."""
    plane = np.clip(
        np.round((elevation - ELEVATION["offset"]) / ELEVATION["scale"]),
        0,
        65535,
    ).astype(np.int64)
    delta = plane.copy()
    delta[1:] = (plane[1:] - plane[:-1]) % 65536
    return delta.astype("<u2").tobytes()


def write_gzip(path, body):
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.GzipFile(path, "wb", compresslevel=9, mtime=0) as stream:
        stream.write(body)


def terrain_metadata(config, dem, sx, sy, left, top, zone, origin_e, origin_n):
    h, w = dem.shape
    return {
        "schemaVersion": SCHEMA_VERSION,
        "id": config["id"],
        "name": config["name"],
        "source": "USGS National Map 3D Elevation Program (3DEP), public domain",
        "sourceService": demlib.SERVICE,
        "sourceConfig": "source.json",
        "bboxLonLat": config["bbox"],
        "anchor": config["anchor"],
        "crs": f"EPSG:326{zone:02d}",
        "utmZone": zone,
        "verticalDatum": "NAVD88 metres (3DEP)",
        "verticalOrigin": {
            "type": "absolute",
            "datum": "NAVD88",
            "units": "metres",
        },
        "encoding": "gzip; 1 planar uint16 elevation channel; rows delta-coded from the row above",
        "width": w,
        "height": h,
        "cell": [sx, sy],
        "originUTM": [origin_e, origin_n],
        "gridOrigin": [left + 0.5 * sx - origin_e, origin_n - (top - 0.5 * sy)],
        "channels": {"elevation": ELEVATION},
    }


def validate_config(config):
    for key in ("id", "name", "anchor", "bbox", "size"):
        if key not in config:
            raise ValueError(f"source config lacks {key}")
    if len(config["anchor"]) != 2:
        raise ValueError("anchor must be [lat, lon]")
    if len(config["bbox"]) != 4:
        raise ValueError("bbox must be [west, south, east, north]")
    if len(config["size"]) != 2 or min(config["size"]) < 2:
        raise ValueError("size must be [width, height] with both dimensions >= 2")


def build(source_path):
    source_path = Path(source_path).resolve()
    config = json.loads(source_path.read_text())
    validate_config(config)

    anchor_lat, anchor_lon = config["anchor"]
    zone = geo.utm_zone(anchor_lon)
    dem, sx, sy, left, top = demlib.fetch_dem(
        f"river_{config['id']}",
        config["bbox"],
        config["size"],
        PIPELINE / ".cache",
        zone,
    )
    origin_e, origin_n = geo.utm(anchor_lat, anchor_lon, zone)
    meta = terrain_metadata(config, dem, sx, sy, left, top, zone, origin_e, origin_n)

    out = source_path.parent
    body = pack_elevation(dem)
    write_gzip(out / "terrain.bin.gz", body)
    (out / "terrain.json").write_text(json.dumps(meta, indent=2) + "\n")

    finite = dem[np.isfinite(dem)]
    if finite.size == 0:
        raise ValueError(f"{config['id']}: DEM contains no finite elevation samples")
    print(
        f"{config['id']}: grid {meta['width']}x{meta['height']} @ "
        f"{sx:.2f} x {sy:.2f} m; elevation {finite.min():.1f}..{finite.max():.1f} m NAVD88"
    )
    print(f"{config['id']}: local origin pinned to {config['anchor']} in UTM zone {zone}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python pipeline/build_river_terrain.py <source.json>")
    build(sys.argv[1])
