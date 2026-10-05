"""Acquire RP19 source context deliberately; never called by browser or build.

Terrain is produced separately with build_river_terrain.py. The state watershed
geometry is retained in its actual queried coordinate frame; no inferred stage.
"""
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from aerial import SERVICE, CREDIT, grid_extent

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "river-pulse/rivers/tuolumne_river/scenes/start/poopenaut_valley/data"
CALWATER = "https://gispublic.waterboards.ca.gov/portalserver/rest/services/Hydrology/CalWater_Boundaries/MapServer"
FLOWLINES = "https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer/50"


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Waterscape-source-acquisition/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def query(service, params):
    url = service + "?" + urllib.parse.urlencode(params)
    payload = json.loads(fetch(url))
    if payload.get("error") or payload.get("exceededTransferLimit"):
        raise ValueError(f"Invalid or truncated service response: {url}")
    return payload, url


def write(name, payload):
    (OUT / name).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def build():
    meta = json.loads((OUT / "terrain.json").read_text())
    stamp = datetime.now(timezone.utc).isoformat()
    metadata, metadata_url = query(CALWATER, {"f": "pjson"})
    params = {"geometry": f"{meta['anchor'][1]},{meta['anchor'][0]}",
        "geometryType": "esriGeometryPoint", "inSR": 4326, "outSR": 4326,
        "spatialRel": "esriSpatialRelIntersects", "outFields": "*",
        "returnGeometry": "true", "f": "geojson"}
    unit, unit_url = query(CALWATER + "/5/query", params)
    area, area_url = query(CALWATER + "/3/query", params)
    if not unit.get("features") or not area.get("features"):
        raise ValueError("CalWater returned no watershed context at the study origin")
    write("calwater.json", {"provider": "California State Water Resources Control Board",
        "dataset": "California Interagency Watershed Map / CalWater 2.2.1",
        "origin": "State/interagency dataset finalized by Teale under DWR and CDF; 1999 boundaries, May 2004 attribute update.",
        "source": metadata_url, "sourceDescription": metadata["serviceDescription"],
        "attribution": metadata["copyrightText"], "retrievalTime": stamp,
        "sourceSpatialReference": metadata["spatialReference"],
        "queryCoordinateFrame": "WGS84 longitude/latitude, requested outSR 4326",
        "hydrologicUnit": {"source": unit_url, "data": unit},
        "hydrologicArea": {"source": area_url, "data": area},
        "interpretation": "Archival state watershed context, including administrative boundaries; not a legal jurisdiction map, current inundation, wetted channel or bathymetry."})
    flow, flow_url = query(FLOWLINES + "/query", {"where": "1=1",
        "geometry": ",".join(map(str, meta["bboxLonLat"])), "geometryType": "esriGeometryEnvelope",
        "inSR": 4326, "outSR": 4326, "spatialRel": "esriSpatialRelIntersects",
        "outFields": "id3dhp,gnisidlabel,featuretypelabel,lengthkm", "returnGeometry": "true",
        "returnZ": "false", "returnM": "false", "resultRecordCount": 2000, "f": "geojson"})
    if not flow.get("features"):
        raise ValueError("No 3DHP layout features returned")
    write("hydrography.json", {"source": flow_url, "sourceLicense": "USGS public domain",
        "retrievalTime": stamp, "coordinateFrame": "WGS84 longitude/latitude",
        "interpretation": "Mapped river layout, not today's channel width or water level.", "data": flow})
    extent = grid_extent(meta)
    sr = meta["crs"].split(":")[1]
    aerial_url = SERVICE + "/exportImage?" + urllib.parse.urlencode({
        "bbox": ",".join(map(str, extent)), "bboxSR": sr, "imageSR": sr,
        "size": "1536,1024", "format": "jpg", "bandIds": "0,1,2", "f": "image"})
    body = fetch(aerial_url)
    if not body.startswith(b"\xff\xd8"):
        raise ValueError("NAIP service returned a non-JPEG body")
    (OUT / "aerial.jpg").write_bytes(body)
    write("aerial.json", {"source": aerial_url, "credit": CREDIT, "crs": meta["crs"],
        "extent": extent, "width": 1536, "height": 1024, "retrievalTime": stamp,
        "interpretation": "Aligned archival service mosaic; acquisition year not resolved. No present-condition claim."})
    print(f"Tuolumne foundation: {len(flow['features'])} mapped flowlines; "
        f"{len(unit['features'])} state hydrologic unit; {len(area['features'])} state area; "
        f"NAIP {len(body)} bytes.")
    print("CalWater unit properties: " + json.dumps(unit["features"][0]["properties"]))


if __name__ == "__main__":
    build()
