"""Build a River Pulse hydrography bundle from the USGS 3D Hydrography Program.

The source is the public USGS 3DHP Flowline FeatureServer. Geometry is requested in WGS84,
then projected into the same local x-east / z-south metre frame used by the River Pulse
terrain bundle. This script does not infer hydraulic width, depth, or velocity.

Usage:

    python pipeline/build_river_hydrography.py \
      river-pulse/data/russian_river/places/hacienda_bridge/source.json
"""

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import geo

FLOWLINE_SERVICE = (
    "https://3dhp.nationalmap.gov/arcgis/rest/services/"
    "usgs_3dhp_all/FeatureServer/50/query"
)
SCHEMA_VERSION = "river-pulse-hydrography-0.1"
OUT_FIELDS = [
    "id3dhp",
    "mainstemid",
    "gnisid",
    "gnisidlabel",
    "featuretype",
    "featuretypelabel",
    "flowdirection",
    "flowdirectionlabel",
    "streamorder",
    "lengthkm",
    "hydrosequence",
    "dnhydrosequence",
    "uphydrosequence",
    "workunitid",
]


def query_url(bbox):
    params = {
        "where": "featuretype=1",
        "geometry": ",".join(str(v) for v in bbox),
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": ",".join(OUT_FIELDS),
        "returnGeometry": "true",
        "returnZ": "false",
        "returnM": "false",
        "outSR": "4326",
        "resultRecordCount": "2500",
        "f": "geojson",
    }
    return f"{FLOWLINE_SERVICE}?{urllib.parse.urlencode(params)}"


def fetch_geojson(bbox, opener=urllib.request.urlopen):
    url = query_url(bbox)
    request = urllib.request.Request(url, headers={"User-Agent": "RiverPulse/0.1"})
    with opener(request, timeout=120) as response:
        payload = json.load(response)
    if payload.get("error"):
        raise RuntimeError(f"3DHP query failed: {payload['error']}")
    if payload.get("type") != "FeatureCollection":
        raise ValueError("3DHP response is not a GeoJSON FeatureCollection")
    return url, payload


def geometry_lines(geometry):
    if not geometry:
        return []
    kind = geometry.get("type")
    coordinates = geometry.get("coordinates") or []
    if kind == "LineString":
        return [coordinates]
    if kind == "MultiLineString":
        return coordinates
    return []


def localize_feature(feature, origin_e, origin_n, zone):
    lines = []
    for line in geometry_lines(feature.get("geometry")):
        local = []
        for coordinate in line:
            lon, lat = coordinate[:2]
            east, north = geo.utm(lat, lon, zone)
            local.append([round(east - origin_e, 2), round(origin_n - north, 2)])
        if len(local) >= 2:
            lines.append(local)
    if not lines:
        return None

    properties = feature.get("properties") or {}
    return {
        "id": str(properties.get("id3dhp") or feature.get("id") or "unknown"),
        "name": properties.get("gnisidlabel"),
        "featureType": properties.get("featuretypelabel") or "River",
        "mainstemId": properties.get("mainstemid"),
        "flowDirection": properties.get("flowdirectionlabel"),
        "streamOrder": properties.get("streamorder"),
        "lengthKm": properties.get("lengthkm"),
        "hydrosequence": properties.get("hydrosequence"),
        "downstreamHydrosequence": properties.get("dnhydrosequence"),
        "upstreamHydrosequence": properties.get("uphydrosequence"),
        "workunitId": properties.get("workunitid"),
        "lines": lines,
    }


def build_document(config, payload, query):
    anchor_lat, anchor_lon = config["anchor"]
    zone = geo.utm_zone(anchor_lon)
    origin_e, origin_n = geo.utm(anchor_lat, anchor_lon, zone)
    features = []
    for feature in payload.get("features", []):
        localized = localize_feature(feature, origin_e, origin_n, zone)
        if localized:
            features.append(localized)
    features.sort(key=lambda feature: feature["id"])
    return {
        "schemaVersion": SCHEMA_VERSION,
        "source": "U.S. Geological Survey 3D Hydrography Program (3DHP)",
        "sourceService": FLOWLINE_SERVICE.rsplit("/query", 1)[0],
        "sourceQuery": query,
        "sourceLicense": "U.S. Government public domain",
        "bboxLonLat": config["bbox"],
        "anchor": config["anchor"],
        "crs": f"EPSG:326{zone:02d}",
        "coordinateFrame": "local metres: x east, z south; origin at configured anchor",
        "featureFilter": "3DHP Flowline featuretype=1 (River), intersecting configured bbox",
        "features": features,
    }


def validate_config(config):
    for key in ("id", "name", "anchor", "bbox"):
        if key not in config:
            raise ValueError(f"source config lacks {key}")
    if len(config["anchor"]) != 2:
        raise ValueError("anchor must be [lat, lon]")
    if len(config["bbox"]) != 4:
        raise ValueError("bbox must be [west, south, east, north]")


def build(source_path):
    source_path = Path(source_path).resolve()
    config = json.loads(source_path.read_text())
    validate_config(config)
    url, payload = fetch_geojson(config["bbox"])
    document = build_document(config, payload, url)
    if not document["features"]:
        raise ValueError(f"{config['id']}: 3DHP returned no river flowlines inside configured bbox")
    output = source_path.parent / "hydrography.json"
    output.write_text(json.dumps(document, indent=2, separators=(",", ": ")) + "\n")
    named = sorted({f["name"] for f in document["features"] if f.get("name")})
    print(f"{config['id']}: wrote {len(document['features'])} 3DHP river flowlines to {output}")
    if named:
        print(f"{config['id']}: named rivers: {', '.join(named[:12])}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python pipeline/build_river_hydrography.py <source.json>")
    build(sys.argv[1])
