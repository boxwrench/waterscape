"""Validate RP19 scientific source inputs without claiming a rendered scene."""
import gzip
import json
import math
from pathlib import Path

import numpy as np
import geo

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "river-pulse/rivers/tuolumne_river/scenes/middle/poopenaut_valley/data"


def read(name):
    return json.loads((OUT / name).read_text(encoding="utf-8"))


def finite_coordinates(value):
    if isinstance(value, list):
        return all(finite_coordinates(item) for item in value)
    return isinstance(value, (int, float)) and math.isfinite(value)


def main():
    source, meta = read("source.json"), read("terrain.json")
    assert meta["schemaVersion"] == "river-pulse-terrain-0.1"
    assert [meta["width"], meta["height"]] == source["size"]
    assert meta["verticalOrigin"]["type"] == "absolute"
    assert meta["crs"] == "EPSG:32611"
    assert meta["verticalDatum"] == "NAVD88 metres (3DEP)"
    assert "waterLevel" not in meta
    assert source["verticalExaggeration"] == 1
    raw = gzip.decompress((OUT / "terrain.bin.gz").read_bytes())
    assert len(raw) == meta["width"] * meta["height"] * 2
    delta = np.frombuffer(raw, dtype="<u2").reshape(meta["height"], meta["width"])
    heights = np.cumsum(delta.astype(np.int64), axis=0) % 65536
    elevation = heights * meta["channels"]["elevation"]["scale"] + meta["channels"]["elevation"]["offset"]
    assert np.isfinite(elevation).all()
    assert not np.any(heights == 65535), "Elevation clipping limit reached"
    assert not np.any(heights == 0), "Missing or clipped low elevations"
    assert np.ptp(elevation) > 100, "Valley relief missing"
    assert min(meta["cell"]) > 1, "Do not accidentally claim runtime 1 m lidar"
    state = read("calwater.json")
    assert state["provider"] == "California State Water Resources Control Board"
    assert state["hydrologicUnit"]["data"]["features"][0]["properties"]["HUNAME"] == "TUOLUMNE RIVER"
    assert "DWR" in state["sourceDescription"]
    for key in ("hydrologicUnit", "hydrologicArea"):
        assert state[key]["source"].startswith("https://gispublic.waterboards.ca.gov/")
        for feature in state[key]["data"]["features"]:
            assert feature["geometry"]["type"] in ("Polygon", "MultiPolygon")
            assert finite_coordinates(feature["geometry"]["coordinates"])
    hydro = read("hydrography.json")
    features = hydro["data"]["features"]
    assert features and any("Tuolumne" in str(f["properties"].get("gnisidlabel", "")) for f in features)
    for feature in features:
        assert finite_coordinates(feature["geometry"]["coordinates"])
    layout = read("layout.json")
    assert layout["source"] == hydro["source"] and layout["lines"]
    assert finite_coordinates(layout["lines"])
    named = next(f for f in features if f["properties"].get("gnisidlabel") == "Tuolumne River")
    coordinates = named["geometry"]["coordinates"]
    lon, lat = coordinates[0] if named["geometry"]["type"] == "LineString" else coordinates[0][0]
    e, n = geo.utm(lat, lon, meta["utmZone"])
    x, z = layout["lines"][0][0]
    assert abs(x - (e - meta["originUTM"][0])) < 0.01
    assert abs(z - (meta["originUTM"][1] - n)) < 0.01
    aerial = read("aerial.json")
    assert aerial["crs"] == meta["crs"] and len(aerial["extent"]) == 4
    assert (OUT / "aerial.jpg").read_bytes().startswith(b"\xff\xd8")
    cameras = read("review-cameras.json")["cameras"]
    assert len(cameras) == 5 and len({c["id"] for c in cameras}) == 5
    xmin, zmin = meta["gridOrigin"]
    xmax = xmin + (meta["width"] - 1) * meta["cell"][0]
    zmax = zmin + (meta["height"] - 1) * meta["cell"][1]
    for camera in cameras:
        for key in ("positionXZ", "targetXZ"):
            x, z = camera[key]
            assert xmin <= x <= xmax and zmin <= z <= zmax, f"{camera['id']} leaves the DEM"
        assert camera["groundClearance"] > 0
    print(f"Tuolumne foundation valid: {meta['width']}x{meta['height']} @ {meta['cell'][0]:.2f} m; "
        f"{len(features)} mapped flowlines; state CalWater unit/area; five review cameras.")


if __name__ == "__main__":
    main()
