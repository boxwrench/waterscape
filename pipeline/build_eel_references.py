"""Deliberate Eel visual-study acquisition; never runs in browser/build."""
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from aerial import SERVICE, CREDIT, grid_extent
import geo

OUT = Path(__file__).resolve().parent.parent / "river-pulse/rivers/eel_river/scenes/middle/scotia_bluffs/data"


def fetch(url):
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read()


def build():
    meta = json.loads((OUT / "terrain.json").read_text())
    extent = grid_extent(meta)
    sr = meta["crs"].split(":")[1]
    query = urllib.parse.urlencode({"bbox": ",".join(map(str, extent)),
        "bboxSR": sr, "imageSR": sr, "size": "1536,1536", "format": "jpg",
        "bandIds": "0,1,2", "f": "image"})
    url = f"{SERVICE}/exportImage?{query}"
    body = fetch(url)
    if not body.startswith(b"\xff\xd8"):
        raise ValueError("NAIP response is not JPEG")
    (OUT / "aerial.jpg").write_bytes(body)
    (OUT / "aerial.json").write_text(json.dumps({"source": url, "credit": CREDIT,
        "crs": meta["crs"], "extent": extent, "width": 1536, "height": 1536,
        "retrieval_time": datetime.now(timezone.utc).isoformat(),
        "interpretation": "Service mosaic, not current conditions or a water-level survey."}, indent=2) + "\n")
    service = "https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer/60/query"
    params = {"where": "1=1", "geometry": ",".join(map(str, meta["bboxLonLat"])),
        "geometryType": "esriGeometryEnvelope", "inSR": "4326", "outSR": "4326",
        "spatialRel": "esriSpatialRelIntersects", "outFields": "*",
        "returnGeometry": "true", "returnZ": "false", "f": "geojson", "resultRecordCount": 2000}
    url = service + "?" + urllib.parse.urlencode(params)
    payload = json.loads(fetch(url))
    if payload.get("type") != "FeatureCollection" or payload.get("exceededTransferLimit"):
        raise ValueError("Incomplete or invalid waterbody response")
    polygons = []
    oe, on = meta["originUTM"]
    for feature in payload["features"]:
        geometry = feature.get("geometry") or {}
        ringsets = [geometry["coordinates"]] if geometry.get("type") == "Polygon" else geometry.get("coordinates", [])
        for rings in ringsets:
            local = []
            for ring in rings:
                points = []
                for lon, lat, *_ in ring:
                    e, n = geo.utm(lat, lon, meta["utmZone"])
                    points.append([round(e - oe, 2), round(on - n, 2)])
                local.append(points)
            polygons.append({"properties": feature["properties"], "rings": local})
    (OUT / "waterbodies.json").write_text(json.dumps({"source": url,
        "source_license": "USGS public domain", "crs": meta["crs"],
        "retrieval_time": datetime.now(timezone.utc).isoformat(),
        "interpretation": "Mapped waterbody extent; not today's wetted channel or bathymetry.",
        "polygons": polygons}, indent=2) + "\n")
    print(f"Eel: NAIP {len(body)} bytes; {len(polygons)} mapped waterbody polygons.")


if __name__ == "__main__":
    build()
