"""Acquire USGS NAIP imagery aligned to Freeport's committed 3DEP grid.

Deliberate data acquisition only; never called by the browser or production build.
"""
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from aerial import SERVICE, CREDIT, grid_extent

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "river-pulse/rivers/sacramento_river/scenes/middle/freeport/data"


def build():
    meta = json.loads((OUTPUT / "terrain.json").read_text())
    extent = grid_extent(meta)
    width = 1024
    height = round(width * (extent[3] - extent[1]) / (extent[2] - extent[0]))
    sr = meta["crs"].split(":")[1]
    bbox = ",".join(f"{v:.3f}" for v in extent)
    url = (f"{SERVICE}/exportImage?bbox={bbox}&bboxSR={sr}&imageSR={sr}"
           f"&size={width},{height}&format=jpg&bandIds=0,1,2&f=image")
    with urllib.request.urlopen(url, timeout=120) as response:
        body = response.read()
    if not body.startswith(b"\xff\xd8"):
        raise ValueError("USGS NAIP did not return JPEG imagery")
    (OUTPUT / "aerial.jpg").write_bytes(body)
    info = {"file": "aerial.jpg", "width": width, "height": height,
            "source": url, "service": SERVICE, "credit": CREDIT,
            "crs": meta["crs"], "extent": extent,
            "retrieval_time": datetime.now(timezone.utc).isoformat(),
            "interpretation": "Service mosaic imagery, not current conditions; exact terrain cell-edge extent."}
    (OUTPUT / "aerial.json").write_text(json.dumps(info, indent=2) + "\n")
    print(f"Freeport: NAIP {width}x{height}; {len(body)} bytes; aligned {meta['crs']}")


if __name__ == "__main__":
    build()
