"""Deliberate California watershed acquisition and local 1 m DEM coverage audit."""
import json
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "river-pulse/rivers/eel_river/scenes/end/scotia_bluffs/data"
CALWATER = "https://gispublic.waterboards.ca.gov/arcgis/rest/services/Hydrography/CalWater_Boundaries/MapServer"
DWR_DEM = "https://gis.water.ca.gov/arcgisimg/rest/services/elevation/CA_NoCAL_Wildfires_B5a_2018/ImageServer"
TNM = "https://tnmaccess.nationalmap.gov/api/v1/products"
FOOTPRINT = "https://raw.githubusercontent.com/OpenTopography/Data_Catalog_Spatial_Boundaries/main/OpenTopography_Raster/CA09_Perkins.geojson"


def fetch(endpoint, params):
    url = endpoint + ("?" + urllib.parse.urlencode(params) if params else "")
    request = urllib.request.Request(url, headers={"User-Agent": "Waterscape/1.0 public-geographic-data", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read()
        try:
            payload = json.loads(body)
        except json.JSONDecodeError as error:
            raise ValueError(f"{url}: {response.status} {response.headers.get('Content-Type')} {body[:300]!r}") from error
    if "error" in payload:
        raise ValueError(f"{url}: {payload['error']}")
    return url, payload


def write(name, payload):
    (OUT / name).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def build():
    source = json.loads((OUT / "source.json").read_text())
    lat, lon = source["anchor"]
    retrieved = datetime.now(timezone.utc).isoformat()
    url, service = fetch(CALWATER, {"f": "pjson"})
    write("calwater-service.json", {"source": url, "retrieval_time": retrieved, "metadata": service})
    for layer, name in [(5, "unit"), (3, "area")]:
        url, payload = fetch(f"{CALWATER}/{layer}/query", {
            "geometry": f"{lon},{lat}", "geometryType": "esriGeometryPoint",
            "inSR": 4326, "spatialRel": "esriSpatialRelIntersects", "outFields": "*",
            "returnGeometry": "true", "outSR": 4326, "f": "geojson"})
        if payload.get("type") != "FeatureCollection" or len(payload["features"]) != 1 or payload.get("exceededTransferLimit"):
            raise ValueError(f"Expected one complete CalWater {name} at the station")
        payload["source"] = url
        payload["retrieval_time"] = retrieved
        write(f"calwater-{name}.geojson", payload)
        print(f"CalWater {name}: {payload['features'][0]['properties']}")
    url, meta = fetch(DWR_DEM, {"f": "pjson"})
    write("dwr-dem-service.json", {"source": url, "retrieval_time": retrieved, "metadata": meta})
    url, footprints = fetch(DWR_DEM + "/query", {
        "geometry": ",".join(map(str, source["bbox"])), "geometryType": "esriGeometryEnvelope",
        "inSR": 4326, "spatialRel": "esriSpatialRelIntersects", "outFields": "*",
        "returnGeometry": "true", "outSR": 4326, "f": "json"})
    write("dwr-dem-coverage.json", {"source": url, "retrieval_time": retrieved, "response": footprints})
    print(f"DWR catalog: {len(footprints.get('features', []))} intersecting footprints; native pixel {meta.get('pixelSizeX')}; fields {[f['name'] for f in meta.get('fields', [])]}")
    params = {"datasets": "Digital Elevation Model (DEM) 1 meter", "bbox": ",".join(map(str, source["bbox"])),
        "max": 50, "outputFormat": "JSON"}
    url = TNM + "?" + urllib.parse.urlencode(params)
    try:
        url, products = fetch(TNM, params)
        write("usgs-1m-catalog.json", {"source": url, "retrieval_time": retrieved, "status": "queried", "response": products})
        print(f"USGS 1 m catalog: {products.get('total')} products; inspect footprints before claiming coverage.")
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        # A catalog outage is an unknown result, never evidence that coverage is absent.
        write("usgs-1m-catalog.json", {"source": url, "retrieval_time": retrieved, "status": "unverified", "error": str(error)})
        print("USGS 1 m catalog unavailable; full-scene 1 m availability remains UNVERIFIED.")
    url, footprint = fetch(FOOTPRINT, {})
    footprint["source"] = url
    footprint["retrieval_time"] = datetime.now(timezone.utc).isoformat()
    write("lidar-reference-footprint.geojson", footprint)
    print("CA09_Perkins survey footprint downloaded for coverage comparison; no DEM/point cloud downloaded.")


if __name__ == "__main__":
    build()
