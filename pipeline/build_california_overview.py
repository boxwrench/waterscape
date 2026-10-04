"""Acquire a compact, sourced California overview. Run deliberately, not on every build."""

import json
import math
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "river-pulse" / "data"
BOUNDARY = "https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2022/State_County/MapServer/7/query"
RIVERS = "https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer/50/query"
RELIEF = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage"
NAMES = {
    "russian_river": ["Russian River"],
    "sacramento_river": ["Sacramento River"],
    "san_joaquin_river": ["San Joaquin River"],
    "eel_river": ["Eel River"],
    "tuolumne_river": ["Tuolumne River"],
    "american_river": ["American River", "North Fork American River", "Middle Fork American River", "South Fork American River"],
}
WIDTH, HEIGHT = 900, 1100


def url(base, params):
    return base + "?" + urllib.parse.urlencode(params)


def acquire(request_url):
    request = urllib.request.Request(request_url, headers={"User-Agent": "Waterscape-RiverPulse/0.1"})
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.load(response)
    if payload.get("error"):
        raise RuntimeError(f"{request_url}: {payload['error']}")
    return payload


def build():
    boundary_url = url(BOUNDARY, {"where": "STATE='06'", "outFields": "NAME,STATE",
        "outSR": 3857, "returnGeometry": "true", "f": "json"})
    boundary = acquire(boundary_url)
    assert len(boundary["features"]) == 1
    rings = boundary["features"][0]["geometry"]["rings"]
    points = [point for ring in rings for point in ring]
    west, east = min(p[0] for p in points), max(p[0] for p in points)
    south, north = min(p[1] for p in points), max(p[1] for p in points)
    # Expand the source extent to match the image aspect ratio and leave label margins.
    scale = max((east - west) / (WIDTH - 140), (north - south) / (HEIGHT - 100))
    center_x, center_y = (west + east) / 2, (south + north) / 2
    extent = [center_x - WIDTH * scale / 2, center_y - HEIGHT * scale / 2,
              center_x + WIDTH * scale / 2, center_y + HEIGHT * scale / 2]

    def project(point):
        return [round((point[0] - extent[0]) / scale, 2), round((extent[3] - point[1]) / scale, 2)]

    def svg_path(lines, closed=False):
        return " ".join(" ".join(("M" if i == 0 else "L") + f"{p[0]},{p[1]}"
                                 for i, point in enumerate(line) for p in [project(point)])
                        + (" Z" if closed else "") for line in lines)

    where = "gnisidlabel IN (" + ",".join("'" + name + "'" for names in NAMES.values() for name in names) + ")"
    features, queries, offset = [], [], 0
    while True:
        query = url(RIVERS, {"where": where, "geometry": "-124.6,32.3,-114,42.1",
            "geometryType": "esriGeometryEnvelope", "inSR": 4326, "outSR": 3857,
            "outFields": "id3dhp,gnisidlabel", "returnGeometry": "true", "returnZ": "false",
            "returnM": "false", "maxAllowableOffset": 200, "orderByFields": "id3dhp",
            "resultRecordCount": 2000, "resultOffset": offset, "f": "json"})
        payload = acquire(query)
        batch = payload.get("features", [])
        if payload.get("exceededTransferLimit") and not batch:
            raise RuntimeError("River query truncated without records")
        queries.append(query)
        features.extend(batch)
        if not payload.get("exceededTransferLimit"):
            break
        offset += len(batch)

    river_entries = []
    for river_id, names in NAMES.items():
        selected = [f for f in features if f["attributes"]["gnisidlabel"] in names]
        lines = [line for f in selected for line in f.get("geometry", {}).get("paths", []) if len(line) >= 2]
        if not lines:
            raise RuntimeError(f"No sourced geometry for {river_id}")
        # A label connector is anchored on a real source vertex; label placement is authored.
        main_lines = [line for f in selected if f["attributes"]["gnisidlabel"] == names[0]
                      for line in f.get("geometry", {}).get("paths", []) if len(line) >= 2]
        longest = max(main_lines, key=lambda line: sum(math.dist(a[:2], b[:2]) for a, b in zip(line, line[1:])))
        anchor = project(longest[len(longest) // 2])
        river_entries.append({"id": river_id, "name": names[0], "path": svg_path(lines),
                              "anchor": anchor, "included_names": names, "feature_count": len(selected)})

    relief_url = url(RELIEF, {"bbox": ",".join(str(v) for v in extent), "bboxSR": 3857,
        "imageSR": 3857, "size": f"{WIDTH},{HEIGHT}", "format": "jpg",
        "interpolation": "RSP_BilinearInterpolation", "adjustAspectRatio": "false",
        "renderingRule": json.dumps({"rasterFunction": "Hillshade Elevation Tinted"}), "f": "image"})
    with urllib.request.urlopen(relief_url, timeout=120) as response:
        image = response.read()
    if not image.startswith(b"\xff\xd8"):
        raise RuntimeError("Relief service did not return a JPEG")
    from PIL import Image
    from io import BytesIO
    assert Image.open(BytesIO(image)).size == (WIDTH, HEIGHT)
    DATA.mkdir(exist_ok=True)
    (DATA / "california-relief.jpg").write_bytes(image)
    document = {"schema_version": "river-pulse-overview-0.1", "crs": "EPSG:3857",
        "width": WIDTH, "height": HEIGHT, "extent": extent, "state_path": svg_path(rings, closed=True),
        "relief": "california-relief.jpg", "rivers": river_entries,
        "retrieval_time": datetime.now(timezone.utc).isoformat(),
        "sources": [{"label": "U.S. Census Bureau · California boundary (2022, 1:500,000)", "url": boundary_url},
                    {"label": "USGS 3D Hydrography Program · named flowlines", "url": RIVERS.rsplit("/query", 1)[0], "queries": queries},
                    {"label": "USGS 3DEP · elevation-tinted hillshade", "url": relief_url}],
        "processing": "Web Mercator; north up; uniform source-to-SVG transform. Flowline generalization 200 projected metres. Rivers retain disconnected source segments. American forks included. Width, glow, floating edge and labels are presentation styling, not channel width, discharge, elevation extrusion or hydraulic state."}
    (DATA / "california-overview.json").write_text(json.dumps(document, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"California overview: {len(river_entries)} rivers, {len(features)} source flowlines; {len(image):,} relief bytes.")


if __name__ == "__main__":
    build()
