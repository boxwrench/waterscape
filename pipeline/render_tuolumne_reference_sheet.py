"""Create a source-reference sheet, explicitly not a browser/runtime render."""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "river-pulse/rivers/tuolumne_river/scenes/start/poopenaut_valley/data"


def main():
    state = json.loads((OUT / "calwater.json").read_text())
    source = json.loads((OUT / "source.json").read_text())
    image = Image.new("RGB", (1440, 840), "#101e25")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 21)
    small = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 16)
    title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 34)
    draw.text((30, 22), "Tuolumne / Poopenaut Valley", font=title, fill="#eff3e9")
    draw.text((32, 72), "Geographic reference foundation - source imagery, not an implemented 3D scene", font=small, fill="#b3c7c7")
    aerial = Image.open(OUT / "aerial.jpg").resize((1056, 704))
    image.paste(aerial, (30, 112))
    draw.rectangle((30, 112, 1085, 815), outline="#647d7e", width=1)
    draw.text((1110, 118), "CALIFORNIA STATE DATA", font=small, fill="#96d3c4")
    draw.text((1110, 150), "CalWater 2.2.1", font=font, fill="#eff3e9")
    draw.text((1110, 184), "Tuolumne River HU 6536", font=small, fill="#b3c7c7")
    data = state["hydrologicUnit"]["data"]["features"]
    rings = []
    for feature in data:
        geometry = feature["geometry"]
        polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        for polygon in polygons:
            rings.extend(polygon)
    factor = math.cos(math.radians(source["anchor"][0]))
    points = [(p[0] * factor, p[1]) for ring in rings for p in ring]
    west, south = min(p[0] for p in points), min(p[1] for p in points)
    east, north = max(p[0] for p in points), max(p[1] for p in points)
    scale = min(270 / (east - west), 370 / (north - south))
    def xy(lon, lat):
        return (1115 + (lon * factor - west) * scale, 225 + (north - lat) * scale)
    for ring in rings:
        draw.line([xy(p[0], p[1]) for p in ring], fill="#96d3c4", width=2)
    w, s, e, n = source["bbox"]
    draw.rectangle([xy(w, n), xy(e, s)], outline="#f0c96c", width=2)
    lon, lat = source["anchor"][1], source["anchor"][0]
    x, y = xy(lon, lat)
    draw.ellipse((x-4, y-4, x+4, y+4), fill="#f0c96c")
    draw.text((1110, 624), "Gold: selected study extent", font=small, fill="#f0c96c")
    draw.text((1110, 659), "State Water Boards GIS", font=small, fill="#eff3e9")
    draw.text((1110, 684), "DWR / CDF / interagency", font=small, fill="#b3c7c7")
    draw.text((1110, 709), "1999 map; 2004 attributes", font=small, fill="#b3c7c7")
    draw.text((1110, 754), "USGS / USDA NAIP at left", font=small, fill="#b3c7c7")
    draw.text((1110, 779), "Archival mosaic; north up", font=small, fill="#b3c7c7")
    image.save(OUT / "reference-sheet.jpg", quality=92)
    print("Tuolumne source sheet written: reference-sheet.jpg (not a runtime render).")


if __name__ == "__main__":
    main()
