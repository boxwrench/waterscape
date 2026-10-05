"""Project acquired federal layout into the existing RP19 local metre frame."""
import json
from pathlib import Path

import geo

OUT = Path(__file__).resolve().parent.parent / "river-pulse/rivers/tuolumne_river/scenes/start/poopenaut_valley/data"


def main():
    hydro = json.loads((OUT / "hydrography.json").read_text())
    meta = json.loads((OUT / "terrain.json").read_text())
    oe, on = meta["originUTM"]
    lines = []
    for feature in hydro["data"]["features"]:
        if feature["properties"].get("gnisidlabel") != "Tuolumne River":
            continue
        geometry = feature["geometry"]
        parts = [geometry["coordinates"]] if geometry["type"] == "LineString" else geometry["coordinates"]
        for part in parts:
            local = []
            for lon, lat, *_ in part:
                e, n = geo.utm(lat, lon, meta["utmZone"])
                local.append([round(e - oe, 2), round(on - n, 2)])
            lines.append(local)
    if not lines:
        raise ValueError("Named Tuolumne River source lines missing")
    document = {"source": hydro["source"], "retrievalTime": hydro["retrievalTime"],
        "coordinateFrame": "Local x east, z south metres in EPSG:32611 relative to terrain originUTM",
        "method": "WGS84 source positions projected with pipeline/geo.py; centimetre output rounding",
        "interpretation": "Symbolic layout guide, not measured channel width, stage or hydraulic surface", "lines": lines}
    (OUT / "layout.json").write_text(json.dumps(document, indent=2) + "\n")
    print(f"Tuolumne layout: {len(lines)} named mapped lines projected to the terrain frame.")


if __name__ == "__main__":
    main()
