"""Build a bounded 1 m Eel hero terrain patch from the USGS TNM source GeoTIFF.

Reads the 64 KiB TIFF header and only source blocks intersecting local x=600..1400,
z=-1750..-1000. Requires numpy, Pillow, and pyproj. HTTP range fetching is performed
by Windows PowerShell because Python networking may be disabled in managed environments.
"""
import argparse
import gzip
import json
import math
import struct
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from pyproj import Transformer

ROOT = Path(__file__).resolve().parent.parent
ASSET = ROOT / "river-pulse/data/eel_river/places/scotia_bluffs"
AUDIT = ROOT / "previews/river-pulse/rp27/lidar-audit"
SOURCE_URL = ("https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1m/Projects/"
              "CA_NoCAL_Wildfires_B4_2018/TIFF/USGS_1m_x40y449_CA_NoCAL_Wildfires_B4_2018.tif")
TILE_NAME = SOURCE_URL.rsplit("/", 1)[-1]
SCENE_ORIGIN = (406802.0529470353, 4482891.382122604)
BOUNDS = (600.0, 1400.0, -1750.0, -1000.0)  # xmin, xmax, zmin, zmax
SCALE, OFFSET = 0.05, -250.0


def range_fetch(start, end, target):
    """Fetch one inclusive byte range via .NET and reject servers that ignore Range."""
    ps = f'''$ErrorActionPreference='Stop'
$u=[System.Net.HttpWebRequest]::Create('{SOURCE_URL}')
$u.Method='GET'; $u.AddRange({start},{end})
$r=$u.GetResponse()
if ($r.StatusCode -ne [System.Net.HttpStatusCode]::PartialContent) {{ throw "Expected 206, got $($r.StatusCode)" }}
$s=$r.GetResponseStream(); $f=[IO.File]::Create('{str(target).replace("'", "''")}')
try {{ $s.CopyTo($f) }} finally {{ $f.Dispose(); $s.Dispose(); $r.Dispose() }}
'''
    with tempfile.NamedTemporaryFile("w", suffix=".ps1", delete=False, encoding="utf-8") as f:
        psfile = Path(f.name)
        f.write(ps)
    try:
        subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(psfile)], check=True)
    finally:
        psfile.unlink(missing_ok=True)
    expected = end - start + 1
    if target.stat().st_size != expected:
        raise RuntimeError(f"Range {start}-{end}: expected {expected} bytes, got {target.stat().st_size}")


def decode_tile(payload, width=256, height=256):
    """Wrap original compressed TIFF tile bytes in a minimal TIFF IFD for Pillow/LZW."""
    entries = [
        (256, 4, 1, width), (257, 4, 1, height), (258, 3, 1, 32),
        (259, 3, 1, 5), (262, 3, 1, 1), (273, 4, 1, 0),
        (277, 3, 1, 1), (278, 4, 1, height), (279, 4, 1, len(payload)),
        (284, 3, 1, 1), (317, 3, 1, 3), (339, 3, 1, 3),
    ]
    # Header + IFD + next-IFD pointer; compressed strip immediately follows.
    data_at = 8 + 2 + 12 * len(entries) + 4
    entries[5] = (273, 4, 1, data_at)
    body = bytearray(b"II" + struct.pack("<HI", 42, 8))
    body += struct.pack("<H", len(entries))
    for tag, typ, count, value in entries:
        if typ == 3:
            body += struct.pack("<HHI", tag, typ, count) + struct.pack("<H", value) + b"\0\0"
        else:
            body += struct.pack("<HHII", tag, typ, count, value)
    body += struct.pack("<I", 0) + payload
    return np.asarray(Image.open(__import__("io").BytesIO(body)), dtype=np.float32)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fetch", action="store_true", help="fetch the header and required blocks by HTTP Range")
    args = parser.parse_args()
    AUDIT.mkdir(parents=True, exist_ok=True)
    header_path = AUDIT / "tnm-b4-header-range.bin"
    if args.fetch:
        range_fetch(0, 65535, header_path)
    if not header_path.is_file():
        raise SystemExit(f"Missing bounded source header: {header_path}; run with --fetch")

    image = Image.open(header_path)
    tags = image.tag_v2
    width, height = int(tags[256]), int(tags[257])
    block_w, block_h = int(tags[322]), int(tags[323])
    offsets, counts = tags[324], tags[325]
    tie = tags[33922]
    left, top = float(tie[3]), float(tie[4])
    if (width, height, block_w, block_h, int(tags[259]), int(tags[317])) != (10012, 10012, 256, 256, 5, 3):
        raise RuntimeError("Source header does not match the audited 10012px LZW/Predictor3 tile")

    # EPSG:32610 scene footprint -> source EPSG:26910. GeoTIFF tiepoint is the
    # upper-left pixel corner; select nearest native pixel centers to the requested bounds.
    to_source = Transformer.from_crs(32610, 26910, always_xy=True)
    sx0, sx1, sz0, sz1 = BOUNDS
    corners = [to_source.transform(SCENE_ORIGIN[0] + x, SCENE_ORIGIN[1] - z)
               for x in (sx0, sx1) for z in (sz0, sz1)]
    min_e, max_e = min(p[0] for p in corners), max(p[0] for p in corners)
    min_n, max_n = min(p[1] for p in corners), max(p[1] for p in corners)
    c0 = math.ceil(min_e - left - 0.5)
    c1 = math.ceil(max_e - left - 0.5) - 1
    r0 = math.ceil(top - max_n - 0.5)
    r1 = math.ceil(top - min_n - 0.5) - 1
    c0, c1 = max(0, c0), min(width - 1, c1)
    r0, r1 = max(0, r0), min(height - 1, r1)
    cols, rows = c1 - c0 + 1, r1 - r0 + 1
    if cols < 2 or rows < 2:
        raise RuntimeError("Computed crop falls outside the source raster")

    block_cols = range(c0 // block_w, c1 // block_w + 1)
    block_rows = range(r0 // block_h, r1 // block_h + 1)
    needed = []
    for br in block_rows:
        for bc in block_cols:
            idx = br * math.ceil(width / block_w) + bc
            off, count = int(offsets[idx]), int(counts[idx])
            blockfile = AUDIT / f"b4-block-{idx}.bin"
            if args.fetch:
                range_fetch(off, off + count - 1, blockfile)
            if not blockfile.is_file() or blockfile.stat().st_size != count:
                raise RuntimeError(f"Missing block {idx} ({off}-{off + count - 1}); run with --fetch")
            needed.append((idx, br, bc, off, count, blockfile))

    crop = np.empty((rows, cols), dtype=np.float32)
    valid = np.zeros((rows, cols), dtype=bool)
    for idx, br, bc, off, count, path in needed:
        block = decode_tile(path.read_bytes())
        gr0, gc0 = br * block_h, bc * block_w
        ir0, ir1 = max(r0, gr0), min(r1 + 1, gr0 + block_h)
        ic0, ic1 = max(c0, gc0), min(c1 + 1, gc0 + block_w)
        crop[ir0-r0:ir1-r0, ic0-c0:ic1-c0] = block[ir0-gr0:ir1-gr0, ic0-gc0:ic1-gc0]
        valid[ir0-r0:ir1-r0, ic0-c0:ic1-c0] = True
    nodata = float(tags[42113])
    if not valid.all() or np.any(~np.isfinite(crop)) or np.any(crop == nodata):
        raise RuntimeError("Crop contains missing, non-finite, or NoData source cells")
    q = np.clip(np.rint((crop - OFFSET) / SCALE), 0, 65535).astype(np.uint16)
    if np.any(q == 65535) or np.any(q == 0):
        raise RuntimeError("Elevation exceeds existing uint16 codec range")
    delta = q.copy()
    delta[1:] = (q[1:].astype(np.int32) - q[:-1].astype(np.int32)) % 65536
    raw = delta.astype("<u2").tobytes()
    target_dir = ASSET
    target_dir.mkdir(parents=True, exist_ok=True)
    base = target_dir / "hero-terrain"
    with (base.with_suffix(".bin.gz")).open("wb") as out:
        with gzip.GzipFile(fileobj=out, mode="wb", compresslevel=9, mtime=0) as gz:
            gz.write(raw)

    # Store upper-left cell-center position in the scene's EPSG:32610 frame.
    source_e, source_n = left + c0 + 0.5, top - r0 - 0.5
    to_scene = Transformer.from_crs(26910, 32610, always_xy=True)
    grid_e, grid_n = to_scene.transform(source_e, source_n)
    meta = {
        "schemaVersion": "river-pulse-terrain-0.1",
        "id": "scotia_bluffs_hero_1m",
        "name": "Eel Scotia Bluffs hero terrain crop",
        "source": "USGS 3D Elevation Program (3DEP), public domain; native 1 m bare-earth DEM",
        "sourceUrl": SOURCE_URL,
        "sourceTile": TILE_NAME,
        "sourceProduct": "USGS 1m x40y449 CA NoCAL Wildfires B4 2018",
        "sourceProductCreated": "2020-01-28",
        "sourceProductPublished": "2020-01-24",
        "sourceProductUpdated": "2020-11-16",
        "sourceLicense": "Public domain (3DEP metadata)",
        "sourceCrs": "EPSG:26910",
        "sourceVerticalDatum": "NAVD88 metres",
        "sourceNoData": nodata,
        "sourceResolutionMetres": [1, 1],
        "sourcePixelInterpretation": "area; GeoTIFF ModelTiepoint is upper-left cell corner",
        "sourceRangeRetrieval": "HTTP 206 byte ranges only; see previews/river-pulse/rp27/lidar-audit/eel-hero-range-manifest.json",
        "sourceCropPixelWindow": {"columnStart": c0, "rowStart": r0, "width": cols, "height": rows},
        "sourceCropBoundsEPSG26910": [source_e - 0.5, source_n - rows + 0.5, source_e + cols - 0.5, source_n + 0.5],
        "crs": "EPSG:32610",
        "utmZone": 10,
        "verticalDatum": "NAVD88 metres (3DEP)",
        "verticalOrigin": {"type": "absolute", "datum": "NAVD88", "units": "metres"},
        "encoding": "gzip; 1 planar uint16 elevation channel; rows delta-coded from the row above; quantized to 0.05 m",
        "width": cols,
        "height": rows,
        "cell": [1.0, 1.0],
        "originUTM": list(SCENE_ORIGIN),
        "gridOrigin": [grid_e - SCENE_ORIGIN[0], SCENE_ORIGIN[1] - grid_n],
        "channels": {"elevation": {"offset": OFFSET, "scale": SCALE}},
        "nativeValues": {"min": float(crop.min()), "max": float(crop.max()), "mean": float(crop.mean()),
                         "validCells": int(crop.size), "nodataCells": 0,
                         "encodingMaximumAbsoluteQuantizationErrorMetres": SCALE / 2},
    }
    base.with_suffix(".json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    manifest = {
        "sourceUrl": SOURCE_URL, "sourceFileSizeBytes": 394497744,
        "headerRange": {"start": 0, "end": 65535, "file": header_path.name, "bytes": header_path.stat().st_size},
        "tileRanges": [{"tileIndex": i, "start": off, "end": off + count - 1,
                        "bytes": count, "file": p.name} for i, _, _, off, count, p in needed],
        "cropPixelWindow": meta["sourceCropPixelWindow"],
        "cropDimensions": [cols, rows], "validCells": int(crop.size), "nodataCells": 0,
        "sourceMinMaxMeanMetres": meta["nativeValues"],
        "sourceTargetSamples": {
            "primary": float(crop[round(source_n - 4484191.382123), round(407902.052947 - source_e)]),
            "eye": float(crop[round(source_n - 4484361.382123), round(407942.052947 - source_e)]),
            "shore": float(crop[round(source_n - 4484111.382123), round(407722.052947 - source_e)]),
        },
        "retrievedAtUtc": "2026-10-04",
        "note": "Only TIFF header plus intersecting compressed source blocks were transferred; full 394 MB raster was not downloaded.",
    }
    (AUDIT / "eel-hero-range-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"meta": str(base.with_suffix('.json')), "binary": str(base.with_suffix('.bin.gz')),
                      "pixels": [cols, rows], "sourceWindow": meta['sourceCropPixelWindow'],
                      "gridOrigin": meta['gridOrigin'], "nativeValues": meta['nativeValues'],
                      "targetSamples": manifest['sourceTargetSamples']}, indent=2))


if __name__ == "__main__":
    main()
