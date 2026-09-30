"""USGS NAIP Plus orthoimagery (public domain) for a water body's map inset.

Usage:  python pipeline/aerial.py <id> [--width 640]
Writes data/<id>/aerial.jpg covering exactly the terrain grid of data/<id>/terrain.json (same
UTM zone and cell edges, so scene x/z map linearly onto the image) and data/<id>/aerial.json
with the request URL and credit.
"""
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVICE = "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer"
CREDIT = "USGS, USDA, The National Map: Orthoimagery (NAIP Plus), public domain"


def grid_extent(meta):
    """(left, bottom, right, top) UTM metres of the terrain grid's outer cell edges."""
    sx, sy = meta["cell"]
    oe, on = meta["originUTM"]
    x0, z0 = meta["gridOrigin"]
    left = oe + x0 - sx / 2
    top = on - z0 + sy / 2
    return left, top - meta["height"] * sy, left + meta["width"] * sx, top


def fetch(rid, width=640):
    out = ROOT / "data" / rid
    meta = json.loads((out / "terrain.json").read_text())
    left, bottom, right, top = grid_extent(meta)
    height = round(width * (top - bottom) / (right - left))
    sr = f"326{meta['utmZone']:02d}"
    url = (
        f"{SERVICE}/exportImage?bbox={left:.1f},{bottom:.1f},{right:.1f},{top:.1f}"
        f"&bboxSR={sr}&imageSR={sr}&size={width},{height}&format=jpg&bandIds=0,1,2&f=image"
    )
    with urllib.request.urlopen(url, timeout=120) as r:
        (out / "aerial.jpg").write_bytes(r.read())
    info = {"file": "aerial.jpg", "width": width, "height": height, "source": url, "service": SERVICE,
            "credit": CREDIT}
    (out / "aerial.json").write_text(json.dumps(info, indent=2) + "\n")
    print(f"{rid}: aerial {width}x{height} from NAIP Plus")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    fetch(sys.argv[1], int(sys.argv[sys.argv.index("--width") + 1]) if "--width" in sys.argv else 640)
