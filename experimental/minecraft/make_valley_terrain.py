"""Terrain for a Minecraft world spanning several reservoirs, in the bundle format the builder reads.

  python experimental/minecraft/make_valley_terrain.py --site experimental/minecraft/sites/sunol_valley.json

The site file's "terrain" entry names the area (UTM, north-west corner and size in metres), the
grid cell (the block size), a coarse grid for the whole area and fine lidar windows around each
lake. Every grid comes from USGS 3DEP's exportImage; the URLs are recorded in terrain.json. The
fine windows are averaged down to the cell and blended into the coarse grid over a feather band,
so the lakes and their shores keep lidar detail and the rest is generally accurate.

Each lake ("lakes" in the site file) is found as the lidar's flattened water at its bundle's
anchor (pipeline/dem.py detect_water), at its own level. Heights are written relative to the
first lake's level; shoreDistance is the signed distance to the nearest lake; valley follows
pipeline/dem.py channels() with its smoothing kept in metres. Output: <out>/terrain.json,
terrain.bin.gz, land.json (the first lake's bundle) and cameras.json (all lakes' viewpoints).
"""

import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / 'pipeline'))
import dem as demlib  # noqa: E402
import geo  # noqa: E402

VALLEY_SMOOTH_M = 60.0   # dem.channels() smooths by 6 cells of its 10 m grid
TILE = 512               # blocks a side per fine request (1024 px at 2 m)


def export_url(e0, n0, e1, n1, px_w, px_h, interpolation='RSP_BilinearInterpolation'):
    return (f'{demlib.SERVICE}/exportImage?bbox={e0},{n0},{e1},{n1}&bboxSR=32610&imageSR=32610'
            f'&size={px_w},{px_h}&format=tiff&pixelType=F32&noDataInterpretation=esriNoDataMatchAny'
            f'&interpolation={interpolation}&f=image')


def fetch(url, cache):
    """A float32 grid from 3DEP, cached; the service sometimes answers 504, so retry."""
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        for attempt in range(6):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'waterscape-builder/1.0'}),
                                            timeout=300) as r:
                    body = r.read()
                if body[:2] in (b'II', b'MM'):
                    cache.write_bytes(body)
                    break
            except OSError as error:
                print('  retry after', error, flush=True)
            time.sleep(10 * (attempt + 1))
        else:
            raise SystemExit(f'3DEP did not answer: {url}')
    grid = np.array(Image.open(cache), dtype=np.float32)
    if (grid < -1000).any():
        raise SystemExit(f'No-data cells in {cache.name}')
    return grid


def smooth(lo, hi, v):
    t = np.clip((v - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--site', type=Path, required=True)
    args = p.parse_args()
    site = json.loads(args.site.read_text())
    t = site['terrain']
    out = REPO / site['bundle']
    cache = out.parent / 'cache'
    cell = float(site['metresPerBlock'])
    E0, N0 = t['westUTM'], t['northUTM']
    W, L = site['crop']['width'], site['crop']['length']
    E1, N1 = E0 + W * cell, N0 - L * cell
    sources = []

    # The whole area at the coarse spacing, a margin all round, resampled to the block grid.
    c = t['coarseMetres']
    m = 4 * c
    cw, ch = int(round((E1 - E0 + 2 * m) / c)), int(round((N0 - N1 + 2 * m) / c))
    url = export_url(E0 - m, N1 - m, E0 - m + cw * c, N1 - m + ch * c, cw, ch)
    sources.append({'grid': f'whole area at {c} m', 'url': url})
    print('coarse', cw, 'x', ch, flush=True)
    coarse = fetch(url, cache / f'coarse_{c:g}m.tif')
    top = N1 - m + ch * c
    cols = (E0 + (np.arange(W) + .5) * cell - (E0 - m)) / c - .5
    rows = (top - (N0 - (np.arange(L) + .5) * cell)) / c - .5
    rr, cc = np.meshgrid(rows, cols, indexing='ij')
    height = ndimage.map_coordinates(coarse, [rr, cc], order=3, mode='nearest').astype(np.float32)

    # Fine lidar windows around each lake: averaged down to the cell, feathered into the coarse.
    f = t['fineMetres']
    k = int(round(cell / f))
    feather = t['featherMetres']
    lakes = site['lakes']
    detail = np.zeros((L, W), np.float32)
    for lake in lakes:
        we, wn, ww, wl = lake['window']   # block-grid west, north, width, length (blocks)
        # In tiles of at most TILE blocks a side: the service times out on large requests.
        fine = np.zeros((wl, ww), np.float32)
        tiles = []
        for tz in range(0, wl, TILE):
            for tx in range(0, ww, TILE):
                tw, tl = min(TILE, ww - tx), min(TILE, wl - tz)
                e0, n0 = E0 + (we + tx) * cell, N0 - (wn + tz) * cell
                url = export_url(e0, n0 - tl * cell, e0 + tw * cell, n0, tw * k, tl * k)
                tiles.append(url)
                grid = fetch(url, cache / f'{lake["id"]}_{f:g}m_{tx}_{tz}.tif')
                fine[tz:tz + tl, tx:tx + tw] = grid.reshape(tl, k, tw, k).mean(axis=(1, 3))
        sources.append({'grid': f'{lake["name"]} window at {f} m, {len(tiles)} tiles', 'urls': tiles})
        print(lake['name'], 'fine', ww * k, 'x', wl * k, 'in', len(tiles), 'tiles', flush=True)
        d = np.minimum.outer(np.minimum(np.arange(wl), wl - 1 - np.arange(wl)),
                             np.minimum(np.arange(ww), ww - 1 - np.arange(ww))) * cell
        weight = smooth(0, feather, d)
        sl = np.s_[wn:wn + wl, we:we + ww]
        height[sl] = weight * fine + (1 - weight) * height[sl]
        detail[sl] = np.maximum(detail[sl], weight)

    # Each lake: the lidar's flattened water at its bundle's anchor, at its own level.
    water = np.zeros((L, W), bool)
    levels = []
    for lake in lakes:
        src = json.loads((REPO / lake['bundle'] / 'source.json').read_text())
        e, n = geo.utm(*src['anchor'], 10)
        r, cc_ = int((N0 - n) // cell), int((e - E0) // cell)
        if detail[r, cc_] < 1:
            raise SystemExit(f'{lake["name"]}: anchor outside its fine window')
        mask, level = demlib.detect_water(height, anchor=(r, cc_))
        bundle_level = json.loads((REPO / lake['bundle'] / 'terrain.json').read_text())['waterLevel']
        print(f'{lake["name"]}: {int(mask.sum())} cells at {level} m (bundle {bundle_level} m)', flush=True)
        if abs(level - bundle_level) > 0.5:
            raise SystemExit(f'{lake["name"]}: lidar level {level} differs from the bundle\'s {bundle_level}')
        # More of the same lake flattened at another level (3DEP joins surveys of different dates):
        # each extra anchor's flat water joins the lake, at the lake's level.
        extra = np.zeros((L, W), bool)
        for e, n in lake.get('extraAnchorsUTM', []):
            er, ec = int((N0 - n) // cell), int((e - E0) // cell)
            more, more_level = demlib.detect_water(height, anchor=(er, ec), min_area_cells=500)
            if abs(more_level - level) > 5:
                raise SystemExit(f'{lake["name"]}: extra water at {more_level} m is too far from {level} m')
            print(f'  joined {int((more & ~mask).sum())} cells flattened at {more_level} m', flush=True)
            extra |= more & ~mask
        if extra.any():   # close the seam where the two flattened surveys meet
            extra |= ndimage.binary_closing(mask | extra, iterations=2) & ~mask
        lake['_extra'] = extra
        water |= mask | extra
        levels.append(level)
    ref = levels[0]

    sdf = (ndimage.distance_transform_edt(~water) - ndimage.distance_transform_edt(water)) * cell
    # Height above the first lake; each lake flat at its own level.
    rel = height - ref
    labels, _ = ndimage.label(water)
    lake_of = np.zeros((L, W), np.int8)
    for i, lake in enumerate(lakes):
        src = json.loads((REPO / lake['bundle'] / 'source.json').read_text())
        e, n = geo.utm(*src['anchor'], 10)
        lab = labels[int((N0 - n) // cell), int((e - E0) // cell)]
        mine = (labels == lab) | lake['_extra']
        lake_of[mine] = i + 1
        rel[mine] = levels[i] - ref
    lap = ndimage.laplace(ndimage.gaussian_filter(rel, VALLEY_SMOOTH_M / cell)) / (cell * cell)
    spread = np.percentile(np.abs(lap[~water]), 95)
    valley = np.clip(0.5 + 0.5 * lap / spread, 0.0, 1.0)

    out.mkdir(parents=True, exist_ok=True)
    demlib.write_gzip(out / 'terrain.bin.gz', demlib.pack(rel, sdf, valley))
    meta = {
        'source': 'USGS National Map 3D Elevation Program (3DEP), public domain',
        'name': site['name'], 'biome': json.loads((REPO / lakes[0]['bundle'] / 'land.json').read_text())['biome'],
        'service': demlib.SERVICE, 'crs': 'EPSG:32610', 'utmZone': 10, 'verticalDatum': 'NAVD88 metres (3DEP)',
        'encoding': 'gzip; 3 planar uint16 channels; rows delta-coded from the row above',
        'width': W, 'height': L, 'cell': [cell, cell], 'waterLevel': ref,
        'originUTM': [E0, N0], 'gridOrigin': [cell / 2, cell / 2],
        'channels': {'height': demlib.HEIGHT, 'shoreDistance': demlib.SHORE, 'valley': demlib.VALLEY},
        'lakes': [{'name': lake['name'], 'waterLevel': lv, 'cells': int((lake_of == i + 1).sum())}
                  for i, (lake, lv) in enumerate(zip(lakes, levels))],
        'detail': f'{f} m lidar averaged to {cell:g} m in the lake windows (feathered over {feather:g} m); {c} m elsewhere',
        'sources': sources,
    }
    (out / 'terrain.json').write_text(json.dumps(meta, indent=2) + '\n')
    # land.json from the first lake's bundle (the builder takes biome and vegetation from it).
    (out / 'land.json').write_text((REPO / lakes[0]['bundle'] / 'land.json').read_text())
    # Viewpoints: every lake's, moved into this grid (scene metres from the north-west corner).
    views = {}
    for lake in lakes:
        bt = json.loads((REPO / lake['bundle'] / 'terrain.json').read_text())
        be, bn = bt['originUTM']
        for name, v in json.loads((REPO / lake['bundle'] / 'cameras.json').read_text())['viewpoints'].items():
            views[f'{lake["id"]}-{name}'] = {**v, 'x': be + v['x'] - E0, 'z': N0 - (bn - v['z'])}
    spawn = site.get('spawnView')
    if spawn:
        views = {'overlook': views[spawn], **views}
    (out / 'cameras.json').write_text(json.dumps({'viewpoints': views}, indent=2) + '\n')
    print('wrote', out, 'heights', round(float(height.min()), 1), round(float(height.max()), 1), flush=True)


if __name__ == '__main__':
    main()
