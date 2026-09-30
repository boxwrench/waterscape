"""Draft a data/<id>/source.json from a lake's name, using the USGS National Hydrography Dataset.

Usage:  python pipeline/locate.py "<NHD lake name>" <biome> [--pad-km 2]
Prints JSON to stdout: name, biome, anchor (a point well inside the water), bbox (the lake plus
--pad-km of land on every side) and size (about 10 m grid cells). Review it, then save it as
data/<id>/source.json.
"""
import json
import math
import sys
import urllib.parse
import urllib.request

NHD = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/12/query"


def fetch_outline(name):
    """Largest NHD waterbody with this exact name: (area_km2, rings of [lon, lat])."""
    query = urllib.parse.urlencode({
        "where": f"gnis_name='{name}'",
        "outFields": "gnis_name,areasqkm",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "json",
    })
    with urllib.request.urlopen(f"{NHD}?{query}", timeout=60) as r:
        data = json.load(r)
    features = data.get("features") or []
    if not features:
        sys.exit(f"No NHD waterbody named {name!r}. Check the exact name at https://apps.nationalmap.gov/viewer/")
    best = max(features, key=lambda f: f["attributes"]["AREASQKM"])
    return best["attributes"]["AREASQKM"], best["geometry"]["rings"]


def inside(x, y, rings):
    """Even-odd point-in-polygon over all rings (holes count as outside)."""
    hit = False
    for ring in rings:
        for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
            if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                hit = not hit
    return hit


def anchor_point(rings, coslat):
    """The grid point inside the water that is farthest from any shoreline vertex."""
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    edge = [(p[0], p[1]) for r in rings for p in r]
    best, best_d = None, -1.0
    steps = 60
    for i in range(steps + 1):
        for j in range(steps + 1):
            x = min(xs) + (max(xs) - min(xs)) * i / steps
            y = min(ys) + (max(ys) - min(ys)) * j / steps
            if not inside(x, y, rings):
                continue
            d = min(((x - ex) * coslat) ** 2 + (y - ey) ** 2 for ex, ey in edge)
            if d > best_d:
                best, best_d = (y, x), d
    if best is None:
        sys.exit("Could not find a point inside the outline.")
    return [round(best[0], 5), round(best[1], 5)]


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    name, biome = sys.argv[1], sys.argv[2]
    pad_km = float(sys.argv[sys.argv.index("--pad-km") + 1]) if "--pad-km" in sys.argv else 2.0
    area, rings = fetch_outline(name)
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    lat = (min(ys) + max(ys)) / 2
    coslat = math.cos(math.radians(lat))
    dlat = pad_km / 111.32
    dlon = pad_km / (111.32 * coslat)
    west, south, east, north = min(xs) - dlon, min(ys) - dlat, max(xs) + dlon, max(ys) + dlat
    width_m = (east - west) * 111320 * coslat
    height_m = (north - south) * 111320
    print(json.dumps({
        "name": name,
        "biome": biome,
        "anchor": anchor_point(rings, coslat),
        "bbox": [round(west, 4), round(south, 4), round(east, 4), round(north, 4)],
        "size": [round(width_m / 10), round(height_m / 10)],
        "nhdAreaKm2": round(area, 3),
    }, indent=2))


if __name__ == "__main__":
    main()
