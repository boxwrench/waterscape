"""Download a biome's CC0 ground textures (ambientCG) into data/biomes/<biome>/ground/.

Usage:  python pipeline/biome_assets.py <biome>
Reads "ground" from data/biomes/<biome>/biome.json: {layer: {"ambientcg": "<AssetId>"}}.
For each layer writes <layer>_color.jpg and <layer>_normal.jpg (OpenGL normal convention),
1024 px, and records the source URL. Requires Pillow.
"""
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SIZE = 1024


def fetch_layer(asset_id, out_dir, layer):
    url = f"https://ambientcg.com/get?file={asset_id}_1K-JPG.zip"
    request = urllib.request.Request(url, headers={"User-Agent": "waterscape-pipeline"})
    with urllib.request.urlopen(request, timeout=300) as r:
        archive = zipfile.ZipFile(io.BytesIO(r.read()))
    wanted = {"color": "_Color.jpg", "normal": "_NormalGL.jpg"}
    for kind, suffix in wanted.items():
        name = next((n for n in archive.namelist() if n.endswith(suffix)), None)
        if name is None:
            sys.exit(f"{asset_id}: no {suffix} in {url}")
        image = Image.open(io.BytesIO(archive.read(name))).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
        image.save(out_dir / f"{layer}_{kind}.jpg", quality=88)
    return url


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    biome = sys.argv[1]
    manifest_path = ROOT / "data" / "biomes" / biome / "biome.json"
    manifest = json.loads(manifest_path.read_text())
    out_dir = manifest_path.parent / "ground"
    out_dir.mkdir(exist_ok=True)
    for layer, entry in manifest["ground"].items():
        entry["source"] = fetch_layer(entry["ambientcg"], out_dir, layer)
        entry["files"] = [f"ground/{layer}_color.jpg", f"ground/{layer}_normal.jpg"]
        print(f"{biome}: {layer} <- {entry['ambientcg']}")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
